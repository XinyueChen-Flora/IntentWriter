"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// Enhanced request - includes proposed changes and full outline context
type AssessImpactRequest = {
  sectionId: string;
  sectionIntent: string;
  // The proposed changes to this section's outline
  proposedChanges: Array<{
    id: string;
    content: string;
    status: 'new' | 'modified' | 'removed';
  }>;
  // Related sections with their full outline
  relatedSections: Array<{
    id: string;
    intentContent: string;
    childIntents: Array<{ id: string; content: string; position: number }>;
    writingContent: string;
    relationship: string;
  }>;
};

// Enhanced response - includes suggested changes for each section
type SuggestedChange = {
  action: 'add' | 'modify' | 'remove';
  intentId?: string;  // for modify/remove
  content: string;
  position: number;
  reason: string;
};

type ImpactResult = {
  sectionId: string;
  sectionIntent: string;
  impactLevel: 'none' | 'minor' | 'significant';
  reason: string;
  // Only present when impactLevel !== 'none'
  suggestedChanges?: SuggestedChange[];
};

type AssessImpactResponse = {
  impacts: ImpactResult[];
  summary: string;
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: AssessImpactRequest = await request.json();
  const { sectionId, sectionIntent, proposedChanges, relatedSections } = body;

  if (!proposedChanges || proposedChanges.length === 0) {
    return NextResponse.json(
      { error: "Missing proposed changes" },
      { status: 400 }
    );
  }

  // If no related sections, return empty impacts
  if (!relatedSections || relatedSections.length === 0) {
    return NextResponse.json({
      impacts: [],
      summary: "No related sections to assess.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  const systemPrompt = `You analyze how proposed changes to one section might require updates to related sections.

## Input
- Section A's proposed outline changes (new/modified/removed intents)
- Related sections with their current outline and writing

## Task
For each related section, determine:
1. Does this section need to update its outline to stay aligned with Section A's changes?
2. If yes, what specific changes are needed?

## Output Format
Return a JSON object:
{
  "impacts": [
    {
      "sectionId": "id",
      "sectionIntent": "the section's main intent (first 50 chars)",
      "impactLevel": "none" | "minor" | "significant",
      "reason": "Why this section is/isn't affected (1 sentence)",
      "suggestedChanges": [
        {
          "action": "add" | "modify" | "remove",
          "intentId": "existing-id (for modify/remove)",
          "content": "The intent text",
          "position": 0,
          "reason": "Why this change is needed (1 sentence)"
        }
      ]
    }
  ],
  "summary": "Overall summary (1 sentence)"
}

## Impact Levels
- "none": No changes needed, sections remain aligned
- "minor": Small adjustment recommended for consistency (e.g., rewording, clarification)
- "significant": Important changes needed to avoid conflict or maintain coherence

## Rules
- Only include suggestedChanges if impactLevel is NOT "none"
- Position is 0-indexed within the section's children
- For "add", position indicates where to insert
- For "modify", include the intentId of the intent to change
- For "remove", include the intentId of the intent to remove
- Be conservative - only suggest changes that are truly necessary
- Keep reasons concise (under 15 words)

Return ONLY the JSON object, no markdown fences.`;

  // Format proposed changes
  const proposedChangesText = proposedChanges
    .map(c => `- [${c.status.toUpperCase()}] ${c.content}`)
    .join('\n');

  // Format related sections with their full outline
  const relatedSectionsText = relatedSections.map((s, i) => {
    const childrenText = s.childIntents.length > 0
      ? s.childIntents
          .sort((a, b) => a.position - b.position)
          .map(c => `    [${c.id}] (pos ${c.position}) ${c.content}`)
          .join('\n')
      : '    (no children)';

    return `Section ${i + 1} [${s.id}] - Relationship: ${s.relationship}
  Main intent: "${s.intentContent}"
  Children:
${childrenText}
  Writing excerpt: "${s.writingContent.slice(0, 300)}${s.writingContent.length > 300 ? '...' : ''}"`;
  }).join('\n\n');

  const userPrompt = `## Section A (being modified)
Intent: "${sectionIntent}"

Proposed changes:
${proposedChangesText}

## Related Sections
${relatedSectionsText}

Analyze how Section A's proposed changes might require updates to the related sections.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", errorText);
    return NextResponse.json(
      { error: "AI assessment failed" },
      { status: 500 }
    );
  }

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content?.trim() || "{}";

  let parsed: any;
  try {
    const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse AI response:", content);
    parsed = {
      impacts: [],
      summary: "Could not assess impact.",
    };
  }

  // Sanitize and validate the response
  const sanitizedImpacts: ImpactResult[] = Array.isArray(parsed.impacts)
    ? parsed.impacts.map((impact: any) => {
        const result: ImpactResult = {
          sectionId: impact.sectionId || '',
          sectionIntent: (impact.sectionIntent || '').slice(0, 50),
          impactLevel: ['none', 'minor', 'significant'].includes(impact.impactLevel)
            ? impact.impactLevel
            : 'none',
          reason: impact.reason || '',
        };

        // Only include suggestedChanges if impactLevel is not 'none'
        if (result.impactLevel !== 'none' && Array.isArray(impact.suggestedChanges)) {
          result.suggestedChanges = impact.suggestedChanges.map((sc: any) => ({
            action: ['add', 'modify', 'remove'].includes(sc.action) ? sc.action : 'add',
            intentId: sc.intentId,
            content: sc.content || '',
            position: typeof sc.position === 'number' ? sc.position : 0,
            reason: sc.reason || '',
          }));
        }

        return result;
      })
    : [];

  const result: AssessImpactResponse = {
    impacts: sanitizedImpacts,
    summary: parsed.summary || '',
  };

  return NextResponse.json(result);
});
