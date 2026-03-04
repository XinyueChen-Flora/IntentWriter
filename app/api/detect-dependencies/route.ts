import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";
import { RELATIONSHIP_TYPES } from "@/lib/relationship-types";

// Valid relationship types for AI detection
const VALID_TYPES = RELATIONSHIP_TYPES.map(t => t.value);

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

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

  // Build relationship types description for the prompt
  const typesDescription = RELATIONSHIP_TYPES.map(t =>
    `- "${t.value}": ${t.description}`
  ).join('\n');

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
          content: `You analyze a collaborative writing outline and find relationships between sections.

RELATIONSHIP TYPES with DIRECTION (from → to):
- "depends-on": FROM requires information/concepts that are defined in TO. Example: "Methods depends-on Background" means Methods needs Background to be understood.
- "builds-upon": FROM extends or elaborates on ideas introduced in TO. Example: "Discussion builds-upon Results" means Discussion takes Results further.
- "supports": FROM provides evidence or backing for claims in TO. Example: "Data supports Hypothesis" means Data backs up Hypothesis.
- "must-be-consistent": FROM and TO must not contradict each other. Direction doesn't matter here.
- "contrasts-with": FROM presents a different perspective than TO. Direction doesn't matter here.

DIRECTION IS CRITICAL:
- For "depends-on": FROM is the section that NEEDS the other. TO is the section that provides the prerequisite.
- For "builds-upon": FROM is the section that EXTENDS. TO is the section being extended.
- For "supports": FROM is the evidence. TO is the claim being supported.

RULES:
- Do NOT flag parent-child pairs already in the tree.
- Focus on CROSS-BRANCH relationships between different sections.
- Be selective: 3–6 suggestions for a typical outline.
- Reason should explain the relationship clearly.

Return a JSON array:
{
  "fromIntentId": "id of the FROM section",
  "toIntentId": "id of the TO section",
  "relationshipType": "depends-on" | "must-be-consistent" | "builds-upon" | "contrasts-with" | "supports",
  "label": "Depends on" | "Must be consistent" | "Builds upon" | "Contrasts with" | "Supports",
  "reason": "One sentence: '[FROM section] [relationship verb] [TO section] because...'"
}

Return ONLY the JSON array, no markdown.`,
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
      d.label.length > 0
  ).map((d: any) => ({
    ...d,
    // Ensure relationshipType is valid, default to custom if not
    relationshipType: VALID_TYPES.includes(d.relationshipType) ? d.relationshipType : 'custom',
    // Default direction to bidirectional
    direction: 'bidirectional',
  }));

  return NextResponse.json({
    dependencies: validDeps,
  });
});
