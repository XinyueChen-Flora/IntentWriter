"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";
import { createAdminClient } from "@/lib/supabase/server";
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

  // Fetch full proposal using admin client (bypasses RLS)
  const admin = createAdminClient();
  const { data: proposal, error: fetchError } = await admin
    .from("proposals")
    .select("id, status, propose_type, negotiate_rules, notify_user_ids, proposed_by")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) {
    console.error("[vote] Proposal lookup failed:", { proposalId, fetchError: fetchError?.message, hasProposal: !!proposal });
    return NextResponse.json({ error: "Proposal not found", detail: fetchError?.message }, { status: 404 });
  }

  if (proposal.status !== "pending") {
    return NextResponse.json({ error: "Proposal is no longer pending" }, { status: 400 });
  }

  // Insert vote/reply — unique constraint removed, multiple replies allowed
  const { data: voteData, error: voteError } = await admin
    .from("proposal_votes")
    .insert({
      proposal_id: proposalId,
      user_id: user.id,
      vote,
      comment: comment || null,
      voted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (voteError) {
    console.error("Failed to cast vote:", voteError);
    return NextResponse.json({ error: "Failed to cast vote", detail: voteError.message }, { status: 500 });
  }

  // ─── Check if proposal should auto-resolve via coordination engine ───
  const resolution = await checkResolution(admin, proposal);

  if (resolution) {
    const { error: updateError } = await admin
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
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  proposal: {
    id: string;
    propose_type: string;
    negotiate_rules: { voteThreshold?: string; discussionResolution?: string } | null;
    notify_user_ids: string[];
    proposed_by: string;
  }
): Promise<'approved' | 'rejected' | null> {
  const pathId = proposal.propose_type;

  // Build path config: prefer path_config (v2), fall back to negotiate_rules (v1)
  const pathConfig: Record<string, unknown> = proposal.negotiate_rules ?? {};

  // Voters = everyone in notify_user_ids (not the proposer)
  const voterIds = (proposal.notify_user_ids || []).filter(
    (id: string) => id !== proposal.proposed_by
  );
  const eligibleCount = voterIds.length;
  if (eligibleCount === 0 && pathId !== 'decided') return null;

  // Fetch all votes for this proposal from eligible voters
  const { data: votes } = await (supabase as any)
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
