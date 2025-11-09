import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    // Verify user has access to this document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, owner_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

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
  } catch (error) {
    console.error("Restore API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
