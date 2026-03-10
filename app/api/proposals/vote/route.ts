"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// POST /api/proposals/vote — cast or update a vote
export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;
  const { user, supabase } = authResult;

  const { proposalId, vote, comment } = await request.json();

  const validVotes = ["approve", "reject", "acknowledge", "escalate", "response"];
  if (!proposalId || !vote || !validVotes.includes(vote)) {
    return NextResponse.json(
      { error: `Missing required fields: proposalId, vote (${validVotes.join("|")})` },
      { status: 400 }
    );
  }

  // Fetch full proposal (need propose_type, negotiate_rules, notify_user_ids for resolution)
  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, status, propose_type, negotiate_rules, notify_user_ids, proposed_by")
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

  // ─── Check if proposal should auto-resolve ───
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

// Check vote threshold and determine if proposal should resolve
async function checkResolution(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  proposal: {
    id: string;
    propose_type: string;
    negotiate_rules: { voteThreshold?: string; discussionResolution?: string } | null;
    notify_user_ids: string[];
    proposed_by: string;
  }
): Promise<'approved' | 'rejected' | null> {
  const proposeType = proposal.propose_type;

  // Input type: first approve/reject from assignee resolves it
  if (proposeType === 'input') {
    const { data: votes } = await supabase
      .from("proposal_votes")
      .select("vote")
      .eq("proposal_id", proposal.id)
      .in("vote", ["approve", "reject"]);

    if (votes && votes.length > 0) {
      return votes[0].vote === 'approve' ? 'approved' : 'rejected';
    }
    return null;
  }

  // Negotiate (vote) type: check threshold
  if (proposeType === 'negotiate') {
    const threshold = proposal.negotiate_rules?.voteThreshold || 'majority';
    // Voters = everyone in notify_user_ids (not the proposer)
    const voterIds = (proposal.notify_user_ids || []).filter((id: string) => id !== proposal.proposed_by);
    const totalVoters = voterIds.length;
    if (totalVoters === 0) return null;

    const { data: votes } = await supabase
      .from("proposal_votes")
      .select("user_id, vote")
      .eq("proposal_id", proposal.id)
      .in("user_id", voterIds);

    if (!votes) return null;

    const approves = votes.filter((v: { vote: string }) => v.vote === 'approve').length;
    const rejects = votes.filter((v: { vote: string }) => v.vote === 'reject').length;

    if (threshold === 'any') {
      if (approves >= 1) return 'approved';
      if (rejects >= 1) return 'rejected';
    } else if (threshold === 'majority') {
      const needed = Math.ceil(totalVoters / 2);
      if (approves >= needed) return 'approved';
      if (rejects >= needed) return 'rejected';
    } else if (threshold === 'all') {
      if (approves === totalVoters) return 'approved';
      if (rejects >= 1) return 'rejected'; // any reject blocks unanimous
    }

    return null;
  }

  // Discussion type: no auto-resolve (proposer resolves manually)
  return null;
}
