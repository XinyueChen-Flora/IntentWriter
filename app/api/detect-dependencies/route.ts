import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { intentBlocks } = body;

    if (!intentBlocks || intentBlocks.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 intent blocks to detect dependencies" },
        { status: 400 }
      );
    }

    // Build intent hierarchy description
    const intentDescriptions = intentBlocks
      .sort((a: any, b: any) => a.position - b.position)
      .map((block: any) => {
        const indent = "  ".repeat(block.level || 0);
        const parent = block.parentId ? ` (child of ${block.parentId})` : "";
        return `${indent}[${block.id}] L${block.level}${parent}: ${block.content || "(empty)"}`;
      })
      .join("\n");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You analyze a collaborative writing outline and find hidden relationships between sections that writers might overlook.

RULES:
- Do NOT flag parent-child pairs that are already in the tree — those are obvious.
- Focus on CROSS-BRANCH relationships: sections under different parents that affect each other.
- Each dependency gets a short human-readable "label" (≤15 characters) describing HOW they relate. Use the same language as the outline. Examples: "must be consistent", "provides evidence", "prerequisite for", "scope overlap", "may contradict".
- Each dependency has a "direction":
  - "directed" means A affects/constrains B (one-way influence)
  - "bidirectional" means they mutually constrain each other
- Be selective. Only suggest relationships that are genuinely useful for writers to be aware of. 3–6 suggestions for a typical outline is plenty.

Return a JSON array. Each object has:
  { "fromIntentId": "...", "toIntentId": "...", "label": "...", "direction": "directed" | "bidirectional" }

Return ONLY the JSON array, no markdown fences or other text.`,
          },
          {
            role: "user",
            content: `Outline:\n${intentDescriptions}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "[]";

    let suggestedDeps;
    try {
      const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
      suggestedDeps = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      suggestedDeps = [];
    }

    // Validate
    const intentIds = new Set(intentBlocks.map((b: any) => b.id));
    const validDeps = (suggestedDeps || []).filter(
      (d: any) =>
        d.fromIntentId &&
        d.toIntentId &&
        d.fromIntentId !== d.toIntentId &&
        intentIds.has(d.fromIntentId) &&
        intentIds.has(d.toIntentId) &&
        typeof d.label === "string" &&
        d.label.length > 0 &&
        ["directed", "bidirectional"].includes(d.direction)
    );

    return NextResponse.json({
      dependencies: validDeps,
    });
  } catch (error) {
    console.error("Detect dependencies API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
