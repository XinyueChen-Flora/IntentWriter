"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

type Inconsistency = {
  fromSectionId: string;
  toSectionId: string;
  relationship: string;
  issue: string;
  severity: 'warning' | 'conflict';
  fromExcerpt: string;
  toExcerpt: string;
};

type CrossConsistencyResponse = {
  inconsistencies: Inconsistency[];
  summary: string;
  overallConsistency: 'consistent' | 'minor-issues' | 'inconsistent';
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json();
  const { sections, dependencies } = body;

  if (!sections || !Array.isArray(sections) || sections.length < 2) {
    return NextResponse.json({
      inconsistencies: [],
      summary: 'Need at least 2 sections to check consistency.',
      overallConsistency: 'consistent',
    });
  }

  if (!dependencies || dependencies.length === 0) {
    return NextResponse.json({
      inconsistencies: [],
      summary: 'No dependencies defined between sections.',
      overallConsistency: 'consistent',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  // Format sections for the prompt
  const sectionsText = sections.map((s: {
    id: string;
    intent: string;
    writing: string;
    childIntents?: Array<{ id: string; content: string }>;
  }) => {
    const children = (s.childIntents || [])
      .map(c => `  - ${c.content}`)
      .join('\n');
    return `Section [${s.id}]: "${s.intent}"
Children:
${children || '  (none)'}
Writing excerpt:
${(s.writing || '').slice(0, 500)}${(s.writing || '').length > 500 ? '...' : ''}`;
  }).join('\n\n');

  const depsText = dependencies.map((d: {
    fromId: string;
    toId: string;
    type: string;
    label: string;
  }) =>
    `[${d.fromId}] --${d.label}--> [${d.toId}]`
  ).join('\n');

  const systemPrompt = `You check cross-section consistency in a collaborative document.

Given multiple sections with their writing and the dependency relationships between them,
identify where the writing in one section contradicts, conflicts with, or is inconsistent
with writing in a related section.

Focus on:
- Contradictory claims or facts
- Inconsistent terminology
- Missing cross-references that a dependency requires
- Logical flow breaks across dependent sections

Return JSON:
{
  "inconsistencies": [
    {
      "fromSectionId": "id",
      "toSectionId": "id",
      "relationship": "the dependency type",
      "issue": "Description of the inconsistency",
      "severity": "warning" | "conflict",
      "fromExcerpt": "relevant excerpt from source section",
      "toExcerpt": "relevant excerpt from target section"
    }
  ],
  "summary": "Overall consistency summary (1 sentence)",
  "overallConsistency": "consistent" | "minor-issues" | "inconsistent"
}

Rules:
- Be conservative: only flag real inconsistencies, not stylistic differences
- "conflict" = direct contradiction; "warning" = potential issue
- Keep excerpts short (under 50 words each)
- Return ONLY JSON, no markdown`;

  const userPrompt = `## Sections
${sectionsText}

## Dependencies
${depsText}

Check for inconsistencies across these related sections.`;

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
      temperature: 0.2,
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

  const aiResult = await response.json();
  const content = aiResult.choices?.[0]?.message?.content?.trim() || "{}";

  let parsed: Record<string, unknown>;
  try {
    const jsonStr = content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse AI response:", content);
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }

  const inconsistencies: Inconsistency[] = Array.isArray(parsed.inconsistencies)
    ? (parsed.inconsistencies as Array<Record<string, unknown>>).map((i) => ({
        fromSectionId: String(i.fromSectionId ?? ''),
        toSectionId: String(i.toSectionId ?? ''),
        relationship: String(i.relationship ?? ''),
        issue: String(i.issue ?? ''),
        severity: i.severity === 'conflict' ? 'conflict' as const : 'warning' as const,
        fromExcerpt: String(i.fromExcerpt ?? ''),
        toExcerpt: String(i.toExcerpt ?? ''),
      }))
    : [];

  const result: CrossConsistencyResponse = {
    inconsistencies,
    summary: String(parsed.summary ?? ''),
    overallConsistency:
      parsed.overallConsistency === 'inconsistent' ? 'inconsistent'
        : parsed.overallConsistency === 'minor-issues' ? 'minor-issues'
        : 'consistent',
  };

  return NextResponse.json({ result });
});
