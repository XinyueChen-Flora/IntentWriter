"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// POST /api/proposals/resolve — manually resolve a proposal (discussion type / proposer)
export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;
  const { user, supabase } = authResult;

  const { proposalId, resolution } = await request.json();

  if (!proposalId || !['approved', 'rejected'].includes(resolution)) {
    return NextResponse.json(
      { error: "Missing proposalId or invalid resolution (approved|rejected)" },
      { status: 400 }
    );
  }

  // Fetch proposal
  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, status, proposed_by, propose_type")
    .eq("id", proposalId)
    .single();

  if (fetchError || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.status !== "pending") {
    return NextResponse.json({ error: "Proposal is already resolved" }, { status: 400 });
  }

  // Only proposer can manually resolve (for discussion type)
  if (proposal.proposed_by !== user.id) {
    return NextResponse.json({ error: "Only the proposer can resolve this proposal" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Failed to resolve proposal" }, { status: 500 });
  }

  return NextResponse.json({ resolved: resolution });
});
