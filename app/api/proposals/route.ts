"use server";

import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// GET /api/proposals?documentId=xxx — list proposals for a document
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  const result = await requireDocument(documentId);
  if (isErrorResponse(result)) return result;
  const { supabase } = result;

  const { data: proposals, error } = await supabase
    .from("proposals")
    .select(`
      *,
      proposal_votes (
        id, user_id, vote, comment, voted_at
      )
    `)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch proposals:", error);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }

  return NextResponse.json({ proposals: proposals || [] });
});

// POST /api/proposals — create a new proposal
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const {
    documentId,
    sectionId,
    reasoning,
    proposeType,
    comment,
    sourceChanges,
    sectionImpacts,
    writingPreviews,
    notifyUserIds,
    notifyLevels,
    personalNotes,
    question,
    assignedTo,
    negotiateRules,
  } = body;

  if (!documentId || !sectionId || !reasoning) {
    return NextResponse.json(
      { error: "Missing required fields: documentId, sectionId, reasoning" },
      { status: 400 }
    );
  }

  const result = await requireDocument(documentId);
  if (isErrorResponse(result)) return result;
  const { user, admin } = result;

  // Get user's display name
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const baseRow = {
    document_id: documentId,
    section_id: sectionId,
    proposed_by: user.id,
    proposed_by_name: profile?.display_name || user.email?.split("@")[0] || "Unknown",
    reasoning,
    propose_type: ['negotiate', 'input', 'discussion'].includes(proposeType) ? proposeType : 'decided',
    notify_user_ids: notifyUserIds || [],
    question: question || null,
    assigned_to: assignedTo || null,
    comment: comment || null,
    source_changes: sourceChanges || [],
    section_impacts: sectionImpacts || [],
    writing_previews: writingPreviews || {},
    status: "pending",
  };

  // Try inserting with new columns; fall back without them if columns don't exist yet
  let { data: proposal, error } = await admin
    .from("proposals")
    .insert({
      ...baseRow,
      notify_levels: notifyLevels || {},
      personal_notes: personalNotes || {},
      negotiate_rules: negotiateRules || null,
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes('column')) {
      // New columns not migrated yet — insert without them
      ({ data: proposal, error } = await admin
        .from("proposals")
        .insert(baseRow)
        .select()
        .single());
    }
  }

  if (error) {
    console.error("Failed to create proposal:", error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }

  // Run defaultFunctions.propose for this path (async, non-blocking)
  // Results are stored in the interaction store and attached to the proposal
  const resolvedPathType = baseRow.propose_type;
  let attachedResults: Array<{ functionId: string; data: unknown }> = [];
  try {
    // Dynamic import to avoid circular deps in the API route
    const { getCoordinationPath } = await import('@/platform/coordination/protocol');
    await import('@/platform/coordination/builtin');
    const pathDef = getCoordinationPath(resolvedPathType);
    const proposeFunctions = (pathDef?.propose.steps ?? [])
      .filter((s) => !!s.run)
      .map(s => s.run!);

    if (proposeFunctions.length > 0) {
      const { runFunction } = await import('@/platform/functions/runner');
      await import('@/platform/functions/builtin');

      for (const fnId of proposeFunctions) {
        try {
          const result = await runFunction(fnId, {
            snapshot: {
              documentId,
              phase: 'writing' as const,
              nodes: [],
              assignments: [],
              dependencies: [],
              writing: [],
              members: [],
              currentUserId: user.id,
            },
            focus: {
              sectionId,
              proposedChanges: sourceChanges ?? [],
            },
            config: {},
          });
          attachedResults.push({ functionId: fnId, data: result.data });
        } catch (e) {
          console.warn(`[proposals] Failed to run defaultFunction ${fnId}:`, e);
        }
      }
    }
  } catch (e) {
    // Non-critical: don't fail the proposal if functions fail
    console.warn('[proposals] Failed to run defaultFunctions:', e);
  }

  return NextResponse.json({ proposal, attachedResults });
});
