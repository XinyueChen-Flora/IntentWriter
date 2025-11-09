import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[Backup API] Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Backup API] User authenticated:", user.id);

    const body = await request.json();
    const { documentId, intentBlocks, writingBlocks, yjsSnapshots } = body;

    console.log("[Backup API] Request body:", {
      documentId,
      intentBlocksCount: intentBlocks?.length,
      writingBlocksCount: writingBlocks?.length
    });

    if (!documentId) {
      console.error("[Backup API] Missing documentId");
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    // Verify user has access to this document
    console.log("[Backup API] Checking document access:", documentId);
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, owner_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("[Backup API] Document check failed:", {
        error: docError,
        document
      });
      return NextResponse.json(
        { error: "Document not found", details: docError?.message },
        { status: 404 }
      );
    }

    console.log("[Backup API] Document found:", document.id);

    // Insert backup using admin client to bypass RLS
    console.log("[Backup API] Inserting backup...");
    const { data: backup, error: backupError } = await adminClient
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
      console.error("[Backup API] Backup insert failed:", backupError);
      return NextResponse.json(
        { error: "Failed to create backup", details: backupError.message },
        { status: 500 }
      );
    }

    console.log("[Backup API] Backup created successfully:", backup.id);

    // Update document's updated_at timestamp
    await supabase
      .from("documents")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", documentId);

    // Clean up old backups (keep last 100 per document) using admin client
    const { data: oldBackups } = await adminClient
      .from("document_backups")
      .select("id")
      .eq("document_id", documentId)
      .order("backed_up_at", { ascending: false })
      .range(100, 1000);

    if (oldBackups && oldBackups.length > 0) {
      const idsToDelete = oldBackups.map((b) => b.id);
      await adminClient.from("document_backups").delete().in("id", idsToDelete);
    }

    return NextResponse.json({
      success: true,
      backupId: backup.id,
      backedUpAt: backup.backed_up_at,
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
