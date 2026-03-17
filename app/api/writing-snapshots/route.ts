import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

/**
 * POST /api/writing-snapshots — Save a writing snapshot for a section
 *
 * Body: { documentId, sectionId, contentMarkdown, contributors, wordCount }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { documentId, sectionId, contentMarkdown, contributors, wordCount, paragraphAttributions } = body;

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { user, admin } = docResult;

  const { data, error } = await admin
    .from("writing_snapshots")
    .insert({
      document_id: documentId,
      section_id: sectionId,
      content_markdown: contentMarkdown ?? "",
      trigger: "check",  // periodic snapshot
      created_by: user.id,
      contributors: contributors ?? [],
      word_count: wordCount ?? 0,
      paragraph_attributions: paragraphAttributions ?? [],
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to save writing snapshot", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id, createdAt: data.created_at });
});

/**
 * GET /api/writing-snapshots?documentId=xxx&sectionId=yyy&limit=10
 *
 * Returns writing snapshots for a section (most recent first).
 */
export const GET = withErrorHandler(async (request: Request) => {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const sectionId = url.searchParams.get("sectionId");
  const limit = parseInt(url.searchParams.get("limit") ?? "20");

  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { admin } = docResult;

  let query = admin
    .from("writing_snapshots")
    .select("id, section_id, content_markdown, contributors, word_count, trigger, created_at, created_by, paragraph_attributions")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sectionId) {
    query = query.eq("section_id", sectionId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch writing snapshots", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ snapshots: data });
});
