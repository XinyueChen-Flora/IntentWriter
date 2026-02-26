import { NextResponse } from "next/server";
import { requireDocument, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";
import crypto from "crypto";

export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { documentId, intentBlocks, dependencies } = body;

  const docResult = await requireDocument(documentId);
  if (isErrorResponse(docResult)) return docResult;
  const { user, admin } = docResult;

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
  const { data: latestBaseline } = await admin
    .from("intent_baselines")
    .select("version")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const newVersion = (latestBaseline?.version || 0) + 1;

  // Insert baseline using admin client to bypass RLS
  const { data: baseline, error: baselineError } = await admin
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
});
