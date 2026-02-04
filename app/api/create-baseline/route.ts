import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, intentBlocks, dependencies } = body;

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

    // Compute structure hash for drift detection
    const structureData = JSON.stringify({
      intents: (intentBlocks || []).map((b: any) => ({
        id: b.id,
        content: b.content,
        parentId: b.parentId,
        level: b.level,
        position: b.position,
      })),
      deps: (dependencies || []).map((d: any) => ({
        from: d.fromIntentId,
        to: d.toIntentId,
        label: d.label,
        direction: d.direction,
      })),
    });
    const structureHash = crypto
      .createHash("sha256")
      .update(structureData)
      .digest("hex");

    // Get current max version for this document
    const { data: latestBaseline } = await adminClient
      .from("intent_baselines")
      .select("version")
      .eq("document_id", documentId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestBaseline?.version || 0) + 1;

    // Insert baseline using admin client to bypass RLS
    const { data: baseline, error: baselineError } = await adminClient
      .from("intent_baselines")
      .insert({
        document_id: documentId,
        version: newVersion,
        intent_blocks: intentBlocks || [],
        dependencies: dependencies || [],
        structure_hash: structureHash,
        created_by: user.id,
      })
      .select()
      .single();

    if (baselineError) {
      return NextResponse.json(
        { error: "Failed to create baseline", details: baselineError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      baselineId: baseline.id,
      version: newVersion,
      structureHash,
    });
  } catch (error) {
    console.error("Create baseline API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
