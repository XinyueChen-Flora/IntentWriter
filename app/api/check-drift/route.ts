"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

// ============================================
// NEW UNIFIED TYPES
// ============================================

// Sentence anchor for locating text
type SentenceAnchor = {
  start: string;  // first ~10 words (verbatim)
  end: string;    // last ~10 words (verbatim)
};

// Unified intent entry - represents both existing and new intents
type AlignedIntent = {
  // Intent identification
  id: string;                          // existing ID or "new-1", "new-2", etc.
  content: string;                     // intent text
  parentId: string | null;             // parent intent ID
  position: number;                    // order among siblings

  // Intent status
  intentStatus: 'existing' | 'new' | 'modified' | 'removed';

  // Coverage status (how well writing covers this intent)
  coverageStatus: 'covered' | 'partial' | 'missing';

  // Sentences that support this intent (from current writing)
  sentences: SentenceAnchor[];

  // For partial/missing: suggested writing to complete coverage
  suggestedWriting?: string;

  // For partial: explanation of what's missing
  coverageNote?: string;

  // For missing: where to insert in the writing (sentence to insert AFTER)
  insertAfter?: SentenceAnchor;
};

// Dependency conflict between sections
type DependencyIssue = {
  relationship: string;
  severity: 'warning' | 'conflict';
  issue: string;
  localSentences: SentenceAnchor[];
  remoteSectionId: string;
  remoteSectionIntent: string;
  remoteSentences: SentenceAnchor[];
};

// Cross-section impact from changes
type CrossSectionImpact = {
  sectionId: string;
  sectionIntent: string;
  impactType: 'needs-update' | 'potential-conflict';
  description: string;
};

// Main response type - unified format
type CheckDriftResponse = {
  intentId: string;                    // root intent ID
  level: 'aligned' | 'partial' | 'drifted';

  // Unified array: all intents with their sentences
  // - Existing intents with their coverage status and supporting sentences
  // - New intents for orphan content
  alignedIntents: AlignedIntent[];

  // Dependency issues with other sections
  dependencyIssues: DependencyIssue[];

  // Cross-section impacts from changes
  crossSectionImpacts: CrossSectionImpact[];

  // Summary of the alignment check
  summary: string;
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
    const alignedIntents: AlignedIntent[] = [
      {
        id: section.intentId,
        content: section.intentContent,
        parentId: null,
        position: 0,
        intentStatus: 'existing',
        coverageStatus: 'missing',
        sentences: [],
        suggestedWriting: `Write content to address: ${section.intentContent}`,
        coverageNote: 'No content written yet',
      },
      ...(section.childIntents || []).map((child: { id: string; content: string; parentId?: string; position?: number }, idx: number) => ({
        id: child.id,
        content: child.content,
        parentId: child.parentId || section.intentId,
        position: child.position ?? idx,
        intentStatus: 'existing' as const,
        coverageStatus: 'missing' as const,
        sentences: [],
        suggestedWriting: `Write content to address: ${child.content}`,
        coverageNote: 'No content written yet',
      })),
    ];

    const emptyResult: CheckDriftResponse = {
      intentId: section.intentId,
      level: 'partial',
      alignedIntents,
      dependencyIssues: [],
      crossSectionImpacts: [],
      summary: 'No content written yet. Start writing to fulfill the intents.',
    };
    return NextResponse.json({ result: emptyResult });
  }

  // Build prompt
  const mainIntent = `[${section.intentId}] ${section.intentContent}`;
  const childIntentsStr = (section.childIntents || [])
    .map((c: { id: string; content: string; parentId?: string; position?: number }, idx: number) =>
      `  - [${c.id}] (position: ${c.position ?? idx}, parent: ${c.parentId || section.intentId}) ${c.content}`)
    .join('\n');

  const relatedSectionsStr = (relatedSections || [])
    .map((r: { intentId: string; intentContent: string; writingMarkdown: string; relationship: string }) =>
      `Section [${r.intentId}] "${r.intentContent}" (relationship: ${r.relationship}):\n${r.writingMarkdown || '(no content yet)'}`
    )
    .join('\n\n');

  const systemPrompt = `You analyze alignment between writing and outline, producing a UNIFIED array representing the IDEAL STATE of the outline after incorporating the writing.

## Goal
Create "alignedIntents" - a COMPLETE array showing how the outline SHOULD look:
1. All existing intents with their coverage status
2. NEW intents proposed for orphan content (sentences not fitting any existing intent)

The array represents the "perfect alignment state" - sorted by reading order (position).
EVERY sentence must belong to exactly one intent.

## Sentence Anchor Format
{ "start": "first ~10 words verbatim", "end": "last ~10 words verbatim" }

## Process

### Step 1: Map sentences to existing intents
For each sentence, determine which existing intent it supports.
Be generous - any connection to an intent's topic = supporting.

### Step 2: Identify orphan sentences and CREATE new intents
Sentences not supporting ANY existing intent are orphans.
For each orphan or group of related orphans, CREATE a new intent:
- Generate a concise intent description (what the orphan sentences are about)
- Assign a position based on where the sentences appear in the writing
- The new intent should fit naturally into the outline order

### Step 3: Build alignedIntents array (SORTED BY POSITION)
The array should be sorted so reading top-to-bottom matches the document flow.

Each entry:
{
  "id": "existing-id or new-1, new-2...",
  "content": "intent text (for new: generate a concise description)",
  "parentId": "parent-id or root-intent-id for child intents",
  "position": number (CRITICAL: reflects reading order, 0-indexed),

  "intentStatus": "existing" | "new",
  "coverageStatus": "covered" | "partial" | "missing",

  "sentences": [{ "start": "...", "end": "..." }],

  "suggestedWriting": "for partial/missing only",
  "coverageNote": "for partial: what's missing (under 15 words)",
  "insertAfter": { "start": "...", "end": "..." }  // for missing: sentence after which to insert
}

### Rules:
- "covered": sentences.length > 0
- "partial": sentences.length > 0, include suggestedWriting
- "missing": sentences = [], include suggestedWriting AND insertAfter
- "new" intent: intentStatus="new", coverageStatus="covered", sentences = the orphan sentences, position = where it fits in reading order

### Position Assignment for NEW intents:
- Look at where the orphan sentences appear in the writing
- Assign position so the new intent fits between existing intents based on sentence order
- Example: If orphan appears between sentences of intent[2] and intent[3], new intent position could be 2.5 (will be normalized)

## Overall Level
- "aligned": all existing covered, no new intents needed
- "partial": some missing/partial OR has new intents (orphans)
- "drifted": has conflicts

## VALIDATION
1. Every sentence belongs to exactly one intent
2. Every "covered"/"partial" intent has sentences.length > 0
3. Array is sorted by position
4. Every sentence anchor is verbatim from writing

## Output Format
{
  "intentId": "root-intent-id",
  "level": "aligned" | "partial" | "drifted",
  "alignedIntents": [...],  // SORTED by position
  "dependencyIssues": [...],
  "crossSectionImpacts": [...],
  "summary": "Overall analysis summary"
}

Return ONLY JSON, no markdown.`;

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

  // Sanitize aligned intent
  const sanitizeAlignedIntent = (i: any, idx: number): AlignedIntent => ({
    id: i.id || `unknown-${idx}`,
    content: i.content || '',
    parentId: i.parentId === undefined ? section.intentId : i.parentId,
    position: typeof i.position === 'number' ? i.position : idx,
    intentStatus: ['existing', 'new', 'modified', 'removed'].includes(i.intentStatus)
      ? i.intentStatus
      : 'existing',
    coverageStatus: ['covered', 'partial', 'missing'].includes(i.coverageStatus)
      ? i.coverageStatus
      : 'missing',
    sentences: sanitizeAnchors(i.sentences),
    suggestedWriting: i.suggestedWriting || undefined,
    coverageNote: i.coverageNote || i.note || undefined,
    insertAfter: i.insertAfter ? sanitizeAnchor(i.insertAfter) : undefined,
  });

  // Sanitize dependency issues
  const sanitizeDependencyIssues = (arr: unknown): DependencyIssue[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((d: any) => ({
      relationship: d.relationship || '',
      severity: ['warning', 'conflict'].includes(d.severity) ? d.severity : 'warning',
      issue: d.issue || '',
      localSentences: sanitizeAnchors(d.localSentences),
      remoteSectionId: d.remoteSectionId || '',
      remoteSectionIntent: d.remoteSectionIntent || '',
      remoteSentences: sanitizeAnchors(d.remoteSentences),
    }));
  };

  // Sanitize cross-section impacts
  const sanitizeCrossSectionImpacts = (arr: unknown): CrossSectionImpact[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((c: any) => ({
      sectionId: c.sectionId || '',
      sectionIntent: c.sectionIntent || '',
      impactType: ['needs-update', 'potential-conflict'].includes(c.impactType)
        ? c.impactType
        : 'needs-update',
      description: c.description || '',
    }));
  };

  // Build the result
  const alignedIntents: AlignedIntent[] = Array.isArray(parsed.alignedIntents)
    ? parsed.alignedIntents.map(sanitizeAlignedIntent)
    : [];

  const result: CheckDriftResponse = {
    intentId: section.intentId,
    level: ['aligned', 'partial', 'drifted'].includes(parsed.level) ? parsed.level : 'partial',
    alignedIntents,
    dependencyIssues: sanitizeDependencyIssues(parsed.dependencyIssues),
    crossSectionImpacts: sanitizeCrossSectionImpacts(parsed.crossSectionImpacts),
    summary: parsed.summary || '',
  };

  // Debug: log the result structure
  console.log('[check-drift] Result:', JSON.stringify(result, null, 2));

  return NextResponse.json({ result });
});
