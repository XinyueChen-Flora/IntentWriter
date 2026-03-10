"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

type SimulateCommentRequest = {
  comment: string;
  targetIntentId: string;
  sectionIntent: string;
  sectionChildren: Array<{ id: string; content: string; position: number }>;
};

type SimulatedChange = {
  id: string;
  content: string;
  status: 'new' | 'modified' | 'removed';
  reason: string;
};

type SimulateCommentResponse = {
  proposedChanges: SimulatedChange[];
  summary: string;
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: SimulateCommentRequest = await request.json();
  const { comment, targetIntentId, sectionIntent, sectionChildren } = body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
  }

  const childrenText = sectionChildren.length > 0
    ? sectionChildren
        .sort((a, b) => a.position - b.position)
        .map(c => `  [${c.id}] ${c.content}`)
        .join('\n')
    : '  (no children)';

  const targetChild = sectionChildren.find(c => c.id === targetIntentId);
  const targetContext = targetChild
    ? `The comment is specifically about this outline item: "${targetChild.content}"`
    : `The comment is about the section as a whole.`;

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
          content: `You are helping a collaborative writing team. A team member has left a comment about their document's outline. Your job is to interpret what they want and translate it into concrete outline changes.

## How to interpret comments
Comments from collaborators are often informal and indirect. You need to figure out:
1. **What is the person's underlying concern?** (e.g., overlap between sections, missing coverage, wrong emphasis, structural issues)
2. **What do they want to happen?** (e.g., move content, add a point, remove redundancy, reframe an item)
3. **How does this affect THIS section specifically?** (e.g., if they want to move something to another section, that means removing it here)

Common patterns:
- "We should move X to Y" → remove X from this section
- "This overlaps with..." → remove or narrow the overlapping part
- "We're missing..." → add a new item
- "This should focus more on..." → modify items to shift emphasis
- "I don't think X belongs here" → remove X
- "How about not mentioning X here but in Y instead" → remove X from this section

## Output Format
Return a JSON object:
{
  "proposedChanges": [
    {
      "id": "existing-id (for modify/remove) or new-{index} (for new items)",
      "content": "The outline item text",
      "status": "new" | "modified" | "removed",
      "reason": "Why this change addresses the comment (1 sentence)"
    }
  ],
  "summary": "What the comment leads to (1 sentence)"
}

## Rules
- For modifications, use the existing item's ID and provide the updated text
- For new items, use "new-0", "new-1", etc. as IDs
- For removals, use the existing item's ID
- Be conservative — only change what's necessary
- Keep the existing outline structure intact where possible
- Think carefully about the person's intent, not just the literal words
- Return ONLY the JSON object, no markdown fences.`,
        },
        {
          role: "user",
          content: `## Section
Main intent: "${sectionIntent}"
Current outline:
${childrenText}

${targetContext}

## Comment
"${comment}"

What outline changes would address this comment?`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", errorText);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content?.trim() || "{}";
  const jsonStr = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "");

  try {
    const parsed = JSON.parse(jsonStr);
    const proposedChanges: SimulatedChange[] = (parsed.proposedChanges || []).map((c: any) => ({
      id: c.id || `new-${Math.random().toString(36).slice(2, 6)}`,
      content: c.content || '',
      status: ['new', 'modified', 'removed'].includes(c.status) ? c.status : 'new',
      reason: c.reason || '',
    }));

    return NextResponse.json({
      proposedChanges,
      summary: parsed.summary || '',
    } satisfies SimulateCommentResponse);
  } catch (e) {
    console.error("Failed to parse simulate-comment response:", raw);
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }
});
