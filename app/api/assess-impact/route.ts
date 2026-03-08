"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

type AssessImpactRequest = {
  sectionId: string;
  sectionIntent: string;
  sectionChildren?: Array<{ id: string; content: string; position: number }>;
  proposedChanges: Array<{
    id: string;
    content: string;
    status: 'new' | 'modified' | 'removed';
  }>;
  relatedSections: Array<{
    id: string;
    intentContent: string;
    childIntents: Array<{ id: string; content: string; position: number }>;
    writingContent: string;
  }>;
};

type SuggestedChange = {
  action: 'add' | 'modify' | 'remove';
  intentId?: string;
  content: string;
  position: number;
  reason: string;
};

type ImpactResult = {
  sectionId: string;
  sectionIntent: string;
  impactLevel: 'none' | 'minor' | 'significant';
  reason: string;
  suggestedChanges?: SuggestedChange[];
};

type AssessImpactResponse = {
  impacts: ImpactResult[];
  summary: string;
};

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens: number = 2000) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

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
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", errorText);
    throw new Error("AI request failed");
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content?.trim() || "{}";
  const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
  return JSON.parse(jsonStr);
}

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: AssessImpactRequest = await request.json();
  const { sectionId, sectionIntent, sectionChildren, proposedChanges, relatedSections } = body;

  if (!proposedChanges || proposedChanges.length === 0) {
    return NextResponse.json({ error: "Missing proposed changes" }, { status: 400 });
  }

  if (!relatedSections || relatedSections.length === 0) {
    return NextResponse.json({ impacts: [], summary: "No other sections to assess." });
  }

  // Format proposed changes
  const proposedChangesText = proposedChanges
    .map(c => `- [${c.status.toUpperCase()}] ${c.content}`)
    .join('\n');

  // Format source section's current outline
  const sourceOutlineText = sectionChildren && sectionChildren.length > 0
    ? sectionChildren.sort((a, b) => a.position - b.position)
        .map(c => `  - [${c.id}] ${c.content}`)
        .join('\n')
    : '  (no children)';

  // Format all sections overview for relationship detection
  const allSectionsOverview = relatedSections.map((s, i) => {
    const childrenText = s.childIntents.length > 0
      ? s.childIntents
          .sort((a, b) => a.position - b.position)
          .map(c => `    - ${c.content}`)
          .join('\n')
      : '    (no children)';
    return `Section [${s.id}]: "${s.intentContent}"\n${childrenText}`;
  }).join('\n\n');

  // ─── Step 1: Identify which sections are related ───

  let relatedIds: string[];
  try {
    const step1Result = await callOpenAI(
      `You identify which sections of a collaborative document are semantically related to a proposed change.

Given the source section and its proposed changes, determine which other sections might need to be updated for consistency.

Return a JSON object:
{
  "relatedSectionIds": ["id1", "id2"],
  "reasoning": "Brief explanation of why these sections are related"
}

Rules:
- Only include sections that have a real semantic dependency (shared concepts, cross-references, constraints, or logical flow)
- If the change is purely local with no cross-section implications, return an empty array
- Be selective — not every section is related
- Return ONLY the JSON object, no markdown fences.`,

      `## Source Section
Intent: "${sectionIntent}"
Current outline:
${sourceOutlineText}

Proposed changes:
${proposedChangesText}

## All Other Sections
${allSectionsOverview}

Which sections might need updates due to the proposed changes?`,
      500,
    );

    relatedIds = Array.isArray(step1Result.relatedSectionIds)
      ? step1Result.relatedSectionIds.filter((id: string) =>
          relatedSections.some(s => s.id === id)
        )
      : [];
  } catch (error) {
    console.error("Step 1 (relationship detection) failed:", error);
    // Fallback: send all sections to step 2
    relatedIds = relatedSections.map(s => s.id);
  }

  // If no sections are related, return early
  if (relatedIds.length === 0) {
    return NextResponse.json({
      impacts: relatedSections.map(s => ({
        sectionId: s.id,
        sectionIntent: s.intentContent.slice(0, 50),
        impactLevel: 'none' as const,
        reason: 'No semantic relationship to the proposed changes.',
      })),
      summary: "The proposed changes don't affect other sections.",
    });
  }

  // ─── Step 2: Deep impact analysis on related sections only ───

  const relatedSectionsForAnalysis = relatedSections.filter(s => relatedIds.includes(s.id));

  const detailedSectionsText = relatedSectionsForAnalysis.map((s, i) => {
    const childrenText = s.childIntents.length > 0
      ? s.childIntents
          .sort((a, b) => a.position - b.position)
          .map(c => `    [${c.id}] (pos ${c.position}) ${c.content}`)
          .join('\n')
      : '    (no children)';

    return `Section [${s.id}]
  Main intent: "${s.intentContent}"
  Children:
${childrenText}
  Writing excerpt: "${s.writingContent.slice(0, 300)}${s.writingContent.length > 300 ? '...' : ''}"`;
  }).join('\n\n');

  try {
    const step2Result = await callOpenAI(
      `You analyze how proposed changes to one section of a collaborative document require updates to related sections.

## Task
For each related section, determine:
1. Does this section need to update its outline to stay aligned?
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
- "none": No changes needed
- "minor": Small adjustment for consistency
- "significant": Important changes needed to avoid conflict

## Rules
- Only include suggestedChanges if impactLevel is NOT "none"
- Position is 0-indexed within the section's children
- For "modify", include the intentId of the intent to change
- For "remove", include the intentId of the intent to remove
- Be conservative — only suggest changes that are truly necessary
- Keep reasons concise (under 15 words)
- Return ONLY the JSON object, no markdown fences.`,

      `## Source Section (being modified)
Intent: "${sectionIntent}"
Current outline:
${sourceOutlineText}

Proposed changes:
${proposedChangesText}

## Related Sections to Analyze
${detailedSectionsText}

Analyze how the proposed changes might require updates to these related sections.`,
      2000,
    );

    // Sanitize results
    const sanitizedImpacts: ImpactResult[] = Array.isArray(step2Result.impacts)
      ? step2Result.impacts.map((impact: any) => {
          const result: ImpactResult = {
            sectionId: impact.sectionId || '',
            sectionIntent: (impact.sectionIntent || '').slice(0, 50),
            impactLevel: ['none', 'minor', 'significant'].includes(impact.impactLevel)
              ? impact.impactLevel
              : 'none',
            reason: impact.reason || '',
          };

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

    // Include unrelated sections as 'none' impact
    const allImpacts = relatedSections.map(s => {
      const analyzed = sanitizedImpacts.find(i => i.sectionId === s.id);
      if (analyzed) return analyzed;
      return {
        sectionId: s.id,
        sectionIntent: s.intentContent.slice(0, 50),
        impactLevel: 'none' as const,
        reason: 'No relationship to the proposed changes.',
      };
    });

    return NextResponse.json({
      impacts: allImpacts,
      summary: step2Result.summary || '',
    });
  } catch (error) {
    console.error("Step 2 (deep analysis) failed:", error);
    return NextResponse.json({ error: "AI assessment failed" }, { status: 500 });
  }
});
