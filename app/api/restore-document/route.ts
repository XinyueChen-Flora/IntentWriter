import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { documentId } = body;

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { supabase } = docResult;

  // Get latest backup
  const { data: backup, error: backupError } = await supabase
    .from("document_backups")
    .select("*")
    .eq("document_id", documentId)
    .order("backed_up_at", { ascending: false })
    .limit(1)
    .single();

  if (backupError || !backup) {
    return NextResponse.json(
      { error: "No backup found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    backup: {
      intentBlocks: backup.intent_blocks || [],
      writingBlocks: backup.writing_blocks || [],
      yjsSnapshots: backup.yjs_snapshots || {},
      backedUpAt: backup.backed_up_at,
    },
  });
});
