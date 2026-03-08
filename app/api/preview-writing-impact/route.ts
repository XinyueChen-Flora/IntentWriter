"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

type PreviewWritingImpactRequest = {
  sectionIntent: string;
  // Current outline items
  currentOutline: Array<{ id: string; content: string }>;
  // Outline after proposed changes
  changedOutline: Array<{ id: string; content: string; status: 'existing' | 'new' | 'modified' | 'removed' }>;
  // Existing writing (empty string if none)
  existingWriting: string;
};

type PreviewWritingImpactResponse = {
  mode: 'prose' | 'scaffold';
  currentPreview: string;
  changedPreview: string;
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: PreviewWritingImpactRequest = await request.json();
  const { sectionIntent, currentOutline, changedOutline, existingWriting } = body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const hasExistingWriting = existingWriting.trim().length > 0;

  const currentOutlineText = currentOutline
    .map(item => `- ${item.content}`)
    .join('\n');

  const changedOutlineText = changedOutline
    .filter(item => item.status !== 'removed')
    .map(item => {
      const tag = item.status === 'new' ? ' [NEW]' : item.status === 'modified' ? ' [MODIFIED]' : '';
      return `- ${item.content}${tag}`;
    })
    .join('\n');

  const removedItems = changedOutline.filter(item => item.status === 'removed');
  const removedText = removedItems.length > 0
    ? '\nRemoved items:\n' + removedItems.map(item => `- ${item.content}`).join('\n')
    : '';

  async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return (data.choices?.[0]?.message?.content?.trim() || '').replace(/^["']|["']$/g, '');
  }

  let result: PreviewWritingImpactResponse;

  if (hasExistingWriting) {
    // ── Prose mode: minimally edit existing writing ──
    const currentPreview = existingWriting.slice(0, 1500);

    const changedPreview = await callOpenAI(
      `You are editing an existing paragraph to reflect outline changes for a collaborative document section.

CRITICAL: Make the MINIMUM changes necessary. Keep as much of the original text WORD-FOR-WORD as possible.
- For REMOVED outline items: delete only the specific sentences/phrases that cover that point.
- For NEW outline items: insert a sentence or phrase at a natural position.
- For MODIFIED outline items: adjust only the specific words/phrases that correspond to the change.
- Do NOT rephrase, restructure, or rewrite parts of the text that are unaffected by the changes.
- The result should be nearly identical to the original, with only targeted edits.

Return ONLY the edited paragraph text, no JSON, no quotes, no formatting.`,
      `Section topic: "${sectionIntent}"

Original text:
${currentPreview}

Outline changes:
${changedOutlineText}${removedText}

Edit the original text with minimal changes to reflect the outline changes.`
    );

    result = { mode: 'prose', currentPreview, changedPreview };
  } else {
    // ── Scaffold mode: generate writing guidance in a single call ──
    const numberedCurrent = currentOutline.map((item, i) => `${i + 1}. ${item.content}`).join('\n');

    const numberedChanged = changedOutline.map((item, i) => {
      const tag = item.status !== 'existing' ? ` [${item.status.toUpperCase()}]` : '';
      return `${i + 1}. ${item.content}${tag}`;
    }).join('\n');

    const raw = await callOpenAI(
      `You generate a writing scaffold — a partially-written paragraph that mixes real starter sentences with bracketed placeholder instructions.

The scaffold is what a first draft looks like before it's finished: some sentences are already written (the openers, transitions, topic sentences), while others are left as notes-to-self in brackets describing what content should go there.

Example outline:
1. Introduce collaborative writing in different settings
2. Explain that it requires coordinating people and responsibilities

Example scaffold:
"Collaborative writing is a common practice across many settings, from university classrooms to corporate teams. [Expand on the different environments where collaborative writing happens and why it's become so prevalent...] However, writing together is more than just sharing a document — it requires careful coordination of people, responsibilities, and expectations. [Discuss the specific coordination challenges: dividing labor, aligning on tone and structure, managing different work styles...]"

RULES:
- Write as ONE continuous paragraph
- For each outline point: write 1 real sentence (a starter/topic sentence that the student can keep), then add 1 bracketed instruction describing what to expand on
- The real sentences should be polished and usable — these are the "bones" the student builds on
- The bracketed instructions should be specific and actionable, like notes-to-self: [Expand on..., Discuss..., Give examples of..., Contrast X with Y...]
- Create natural flow between points with transitions
- Do NOT write the full content — the brackets mark where the student does their own thinking

You will be given TWO versions of the outline (current and changed). Generate BOTH scaffolds.
For the CHANGED version:
- REMOVED items: omit those sentences entirely
- NEW items: add a new starter sentence + bracketed instruction at a natural position
- MODIFIED items: adjust the starter sentence and instruction to match the new wording
- UNCHANGED items: keep the EXACT same text as in the current version, word-for-word

Return ONLY a JSON object: { "current": "...", "changed": "..." }`,
      `Section topic: "${sectionIntent}"

Current outline:
${numberedCurrent}

Changed outline:
${numberedChanged}

Generate both scaffolds.`
    );

    let parsed: { current?: string; changed?: string } = {};
    try {
      const jsonStr = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse scaffold response:', raw);
      // Fallback: use the raw text as both
      parsed = { current: raw, changed: raw };
    }

    result = {
      mode: 'scaffold',
      currentPreview: parsed.current || '',
      changedPreview: parsed.changed || '',
    };
  }

  return NextResponse.json(result);
});
