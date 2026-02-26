"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// Types for request/response
type SentenceAnchor = {
  start: string;  // first ~10 words
  end: string;    // last ~10 words
};

type IntentCoverageResult = {
  intentId: string;
  status: 'covered' | 'partial' | 'missing';
  supportingSentences: SentenceAnchor[];
  note?: string;
};

type OrphanSentenceResult = {
  start: string;  // first ~10 words
  end: string;    // last ~10 words
  suggestion: 'delete' | 'add-intent';
  suggestedIntent?: string;
};

type DependencyIssueResult = {
  relationship: string;
  severity: 'warning' | 'conflict';
  issue: string;
  localSentences: SentenceAnchor[];
  remoteSectionId: string;
  remoteSectionIntent: string;
  remoteSentences: SentenceAnchor[];
};

// Simulated outline types
type SimulatedIntent = {
  id: string;
  content: string;
  parentId: string | null;
  position: number;
  status: 'existing' | 'new' | 'modified' | 'removed';
  originalContent?: string;  // for modified intents
  sourceOrphanStart?: string;  // link back to orphan sentence
};

type CrossSectionImpact = {
  sectionId: string;
  sectionIntent: string;
  impactType: 'needs-update' | 'potential-conflict';
  description: string;
};

type SimulatedOutline = {
  intents: SimulatedIntent[];
  crossSectionImpacts: CrossSectionImpact[];
  summary: string;
};

type CheckDriftResponse = {
  intentId: string;
  level: 'aligned' | 'partial' | 'drifted';
  intentCoverage: IntentCoverageResult[];
  orphanSentences: OrphanSentenceResult[];
  dependencyIssues: DependencyIssueResult[];
  summary: string;
  // New: simulated outline when there's orphan content
  simulatedOutline?: SimulatedOutline;
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body = await request.json();
  const { section, relatedSections } = body;

  if (!section || !section.intentId) {
    return NextResponse.json(
      { error: "Missing section data" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  // Short-circuit: if writing is empty, return all intents as missing
  if (!section.writingMarkdown?.trim()) {
    const emptyResult: CheckDriftResponse = {
      intentId: section.intentId,
      level: 'partial',
      intentCoverage: [
        {
          intentId: section.intentId,
          status: 'missing',
          supportingSentences: [],
          note: 'No content written yet',
        },
        ...(section.childIntents || []).map((child: { id: string; content: string }) => ({
          intentId: child.id,
          status: 'missing' as const,
          supportingSentences: [],
          note: 'No content written yet',
        })),
      ],
      orphanSentences: [],
      dependencyIssues: [],
      summary: 'No content written yet. Start writing to fulfill the intents.',
    };
    return NextResponse.json({ result: emptyResult });
  }

  // Build prompt
  const mainIntent = `[${section.intentId}] ${section.intentContent}`;
  const childIntentsStr = (section.childIntents || [])
    .map((c: { id: string; content: string }, idx: number) => `  - [${c.id}] (position: ${idx}) ${c.content}`)
    .join('\n');

  const relatedSectionsStr = (relatedSections || [])
    .map((r: { intentId: string; intentContent: string; writingMarkdown: string; relationship: string }) =>
      `Section [${r.intentId}] "${r.intentContent}" (relationship: ${r.relationship}):\n${r.writingMarkdown || '(no content yet)'}`
    )
    .join('\n\n');

  const systemPrompt = `You analyze whether writing fulfills stated intents, check for conflicts, and generate a simulated outline based on the writing.

## Input
- Main intent and its child intents (the outline)
- The writing content for this section
- Related sections with their writing (if any)

## Sentence Anchor Format
To help the UI locate text, return sentence anchors as objects with:
- "start": the first ~10 words of the sentence (enough to uniquely identify it)
- "end": the last ~10 words of the sentence

Example: { "start": "The main benefit of this approach is", "end": "efficiency and reduced maintenance costs." }

## Task 1: Intent Coverage
For each intent (main + children), determine coverage status:
- "covered": fully addressed in writing
- "partial": mentioned but incomplete
- "missing": not addressed at all

For each intent, return:
- "intentId": the intent ID from the input
- "status": the coverage status
- "supportingSentences": array of sentence anchors that support this intent
- "note": for partial/missing, explain WHY it's not fully covered (under 15 words)

## Task 2: Orphan Content
Find sentences in the writing that don't support ANY existing intent. These are "orphan" sentences.
For each orphan, return:
- "start": first ~10 words of the sentence
- "end": last ~10 words of the sentence
- "suggestion": "delete" (if irrelevant) or "add-intent" (if valuable content not in outline)
- "suggestedIntent": if "add-intent", propose a concise intent text

## Task 3: Dependency Conflicts (only if relatedSections provided)
Check for contradictions/inconsistencies between this section and related sections.

## Task 4: Simulated Outline
Generate what the outline SHOULD look like based on the actual writing content.
This helps users see "if we align the outline to the writing, it would look like this".

CRITICAL: Position and hierarchy rules:
1. **Follow writing order**: New intents should be positioned based on WHERE they appear in the writing, NOT at the end. If the orphan sentence appears between content for intent A and intent C, the new intent should be positioned between A and C.
2. **Determine correct hierarchy**:
   - If the orphan content ELABORATES on an existing intent (provides details, examples, sub-points), make it a CHILD of that intent (set parentId to that intent's ID)
   - If the orphan content is a PEER topic at the same level, make it a sibling (same parentId as other children)
   - Look at the semantic relationship, not just proximity
3. **Preserve existing structure**: Keep existing intents in their original positions unless they need to be removed

For the simulated outline, return ALL intents (existing + new):
- Keep existing intents that are covered (status: "existing")
- Mark existing intents as "removed" if the writing clearly doesn't need them
- Add new intents for orphan content that should be in the outline
- Position new intents based on where they appear in the writing

Return an array of intents with:
- "id": use existing ID for existing intents, or "new-1", "new-2" etc for new ones
- "content": the intent text
- "parentId": the parent intent ID. For sub-intents of a child, use that child's ID. For siblings of existing children, use the main intent ID.
- "position": order within siblings (0, 1, 2...). Insert new intents at the correct position based on writing order.
- "status": "existing" | "new" | "modified" | "removed"
- "originalContent": only for modified intents, show what it was before
- "sourceOrphanStart": REQUIRED for new intents - the first ~10 words of the orphan sentence that led to this intent. This MUST match an orphan from Task 2.

CRITICAL: Every "new" intent MUST have a corresponding orphan sentence in Task 2, and they MUST be linked via sourceOrphanStart.

## Task 5: Cross-Section Impact (only if there are new/modified intents AND relatedSections)
For each new or modified intent, check if it might affect related sections.
Return:
- "sectionId": the affected section's ID
- "sectionIntent": that section's main intent text
- "impactType": "needs-update" or "potential-conflict"
- "description": brief explanation of the impact

## Task 6: Overall Level
- "aligned": all intents covered, no orphans, no conflicts
- "partial": some intents missing/partial OR has orphans, but no major conflicts
- "drifted": has conflicts OR writing contradicts intents

## Output Format
Return a JSON object:
{
  "intentId": "...",
  "level": "aligned" | "partial" | "drifted",
  "intentCoverage": [...],
  "orphanSentences": [...],
  "dependencyIssues": [...],
  "simulatedOutline": {
    "intents": [...],
    "crossSectionImpacts": [...],
    "summary": "Brief summary of what changed in the simulated outline"
  },
  "summary": "Brief summary of the analysis"
}

Return ONLY the JSON object, no markdown fences or other text.`;

  const userPrompt = `## Main Intent
${mainIntent}

## Child Intents
${childIntentsStr || '(none)'}

## Writing Content
${section.writingMarkdown}

${relatedSectionsStr ? `## Related Sections\n${relatedSectionsStr}` : ''}`;

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
      max_tokens: 4000,
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

  let parsed: any;
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

  // Helper to sanitize sentence anchors
  const sanitizeAnchor = (a: { start?: string; end?: string } | string): SentenceAnchor => {
    if (typeof a === 'string') {
      return { start: a, end: '' };
    }
    return { start: a.start || '', end: a.end || '' };
  };

  const sanitizeAnchors = (arr: unknown): SentenceAnchor[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitizeAnchor);
  };

  // Sanitize simulated outline
  const sanitizeSimulatedOutline = (outline: any): SimulatedOutline | undefined => {
    if (!outline || !outline.intents) return undefined;

    return {
      intents: Array.isArray(outline.intents) ? outline.intents.map((i: any, idx: number) => ({
        id: i.id || `new-${idx}`,
        content: i.content || '',
        parentId: i.parentId === undefined ? section.intentId : i.parentId,
        position: typeof i.position === 'number' ? i.position : idx,
        status: ['existing', 'new', 'modified', 'removed'].includes(i.status) ? i.status : 'existing',
        originalContent: i.originalContent,
        sourceOrphanStart: i.sourceOrphanStart,
      })) : [],
      crossSectionImpacts: Array.isArray(outline.crossSectionImpacts) ? outline.crossSectionImpacts.map((c: any) => ({
        sectionId: c.sectionId || '',
        sectionIntent: c.sectionIntent || '',
        impactType: ['needs-update', 'potential-conflict'].includes(c.impactType) ? c.impactType : 'needs-update',
        description: c.description || '',
      })) : [],
      summary: outline.summary || '',
    };
  };

  // Validate and sanitize
  const result: CheckDriftResponse = {
    intentId: section.intentId,
    level: ['aligned', 'partial', 'drifted'].includes(parsed.level) ? parsed.level : 'partial',
    intentCoverage: Array.isArray(parsed.intentCoverage) ? parsed.intentCoverage.map((c: any) => ({
      intentId: c.intentId || '',
      status: ['covered', 'partial', 'missing'].includes(c.status) ? c.status : 'missing',
      supportingSentences: sanitizeAnchors(c.supportingSentences),
      note: c.note,
    })) : [],
    orphanSentences: Array.isArray(parsed.orphanSentences) ? parsed.orphanSentences.map((o: any) => ({
      start: o.start || o.sentenceHint || '',
      end: o.end || '',
      suggestion: ['delete', 'add-intent'].includes(o.suggestion || '') ? o.suggestion as 'delete' | 'add-intent' : 'delete',
      suggestedIntent: o.suggestedIntent,
    })) : [],
    dependencyIssues: Array.isArray(parsed.dependencyIssues) ? parsed.dependencyIssues.map((d: any) => ({
      relationship: d.relationship || '',
      severity: ['warning', 'conflict'].includes(d.severity) ? d.severity : 'warning',
      issue: d.issue || '',
      localSentences: sanitizeAnchors(d.localSentences),
      remoteSectionId: d.remoteSectionId || '',
      remoteSectionIntent: d.remoteSectionIntent || '',
      remoteSentences: sanitizeAnchors(d.remoteSentences),
    })) : [],
    summary: parsed.summary || '',
    simulatedOutline: sanitizeSimulatedOutline(parsed.simulatedOutline),
  };

  return NextResponse.json({ result });
});
