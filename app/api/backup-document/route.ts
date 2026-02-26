import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { documentId, intentBlocks, writingBlocks, yjsSnapshots } = body;

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { supabase, admin } = docResult;

  // Insert backup using admin client to bypass RLS
  const { data: backup, error: backupError } = await admin
    .from("document_backups")
    .insert({
      document_id: documentId,
      intent_blocks: intentBlocks || [],
      writing_blocks: writingBlocks || [],
      yjs_snapshots: yjsSnapshots || {},
    })
    .select()
    .single();

  if (backupError) {
    return NextResponse.json(
      { error: "Failed to create backup", details: backupError.message },
      { status: 500 }
    );
  }

  // Update document's updated_at timestamp
  await supabase
    .from("documents")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", documentId);

  // Clean up old backups (keep last 100 per document) using admin client
  const { data: oldBackups } = await admin
    .from("document_backups")
    .select("id")
    .eq("document_id", documentId)
    .order("backed_up_at", { ascending: false })
    .range(100, 1000);

  if (oldBackups && oldBackups.length > 0) {
    const idsToDelete = oldBackups.map((b) => b.id);
    await admin.from("document_backups").delete().in("id", idsToDelete);
  }

  return NextResponse.json({
    success: true,
    backupId: backup.id,
    backedUpAt: backup.backed_up_at,
  });
});
