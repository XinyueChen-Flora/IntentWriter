"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";
import { checkResolution as engineCheckResolution } from "@/platform/coordination/engine";
import "@/platform/coordination/builtin"; // ensure paths are registered

// POST /api/proposals/vote — cast or update a vote
export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;
  const { user, supabase } = authResult;

  const { proposalId, vote, comment } = await request.json();

  if (!proposalId || !vote) {
    return NextResponse.json(
      { error: "Missing required fields: proposalId, vote" },
      { status: 400 }
    );
  }

  // Fetch full proposal (need propose_type, negotiate_rules, notify_user_ids for resolution)
  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, status, propose_type, negotiate_rules, path_config, notify_user_ids, proposed_by")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.status !== "pending") {
    return NextResponse.json({ error: "Proposal is no longer pending" }, { status: 400 });
  }

  // Upsert vote (one per user per proposal)
  const { data: voteData, error: voteError } = await supabase
    .from("proposal_votes")
    .upsert(
      {
        proposal_id: proposalId,
        user_id: user.id,
        vote,
        comment: comment || null,
        voted_at: new Date().toISOString(),
      },
      { onConflict: "proposal_id,user_id" }
    )
    .select()
    .single();

  if (voteError) {
    console.error("Failed to cast vote:", voteError);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }

  // ─── Check if proposal should auto-resolve via coordination engine ───
  const resolution = await checkResolution(supabase, proposal);

  if (resolution) {
    const { error: updateError } = await supabase
      .from("proposals")
      .update({
        status: resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", proposalId);

    if (updateError) {
      console.error("Failed to resolve proposal:", updateError);
    }

    return NextResponse.json({ vote: voteData, resolved: resolution });
  }

  return NextResponse.json({ vote: voteData });
});

// Delegate resolution to the coordination engine
async function checkResolution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: {
    id: string;
    propose_type: string;
    negotiate_rules: { voteThreshold?: string; discussionResolution?: string } | null;
    path_config: Record<string, unknown> | null;
    notify_user_ids: string[];
    proposed_by: string;
  }
): Promise<'approved' | 'rejected' | null> {
  const pathId = proposal.propose_type;

  // Build path config: prefer path_config (v2), fall back to negotiate_rules (v1)
  const pathConfig: Record<string, unknown> = proposal.path_config
    ?? proposal.negotiate_rules
    ?? {};

  // Voters = everyone in notify_user_ids (not the proposer)
  const voterIds = (proposal.notify_user_ids || []).filter(
    (id: string) => id !== proposal.proposed_by
  );
  const eligibleCount = voterIds.length;
  if (eligibleCount === 0 && pathId !== 'decided') return null;

  // Fetch all votes for this proposal from eligible voters
  const { data: votes } = await supabase
    .from("proposal_votes")
    .select("user_id, vote")
    .eq("proposal_id", proposal.id)
    .in("user_id", voterIds);

  if (!votes) return null;

  // Map DB votes to engine format
  const voteRecords = votes.map((v: { user_id: string; vote: string }) => ({
    userId: v.user_id,
    action: v.vote,
  }));

  // Delegate to the coordination engine — reads the path definition from registry
  return engineCheckResolution(pathId, pathConfig, voteRecords, eligibleCount);
}
