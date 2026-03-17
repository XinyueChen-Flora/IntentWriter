import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

/**
 * POST /api/outline-versions — Save a new outline version
 *
 * Body: { documentId, nodes, assignments, dependencies, trigger, changeSummary? }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { documentId, nodes, assignments, dependencies, trigger, changeSummary } = body;

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { user, admin } = docResult;

  // Get next version number
  const { data: versionData } = await admin
    .rpc("next_outline_version", { doc_id: documentId });
  const version = versionData ?? 1;

  const { data, error } = await admin
    .from("outline_versions")
    .insert({
      document_id: documentId,
      version,
      nodes: nodes ?? [],
      assignments: assignments ?? [],
      dependencies: dependencies ?? [],
      trigger: trigger ?? "user-edit",
      changed_by: user.id,
      changed_by_name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0],
      change_summary: changeSummary ?? {},
    })
    .select("id, version, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save outline version", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, version: data.version, id: data.id, createdAt: data.created_at });
});

/**
 * GET /api/outline-versions?documentId=xxx&limit=10&before=version
 *
 * Returns outline version history (most recent first).
 */
export const GET = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");
  const before = url.searchParams.get("before"); // version number

  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { admin } = docResult;

  let query = admin
    .from("outline_versions")
    .select("id, version, trigger, changed_by, changed_by_name, change_summary, created_at")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("version", parseInt(before));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch outline versions", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ versions: data });
});
