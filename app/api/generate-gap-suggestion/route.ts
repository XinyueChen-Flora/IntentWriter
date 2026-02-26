"use server";

import { NextResponse } from "next/server";
import { requireAuth, isErrorResponse, withErrorHandler } from "@/lib/api/middleware";

type GapSuggestionRequest = {
  intentId: string;
  intentContent: string;
  coverageStatus: 'partial' | 'missing';
  coverageNote?: string;
  rootIntentId: string;
  action?: 'intent' | 'writing';
  currentWriting?: string; // The current writing content for context
};

type WritingSimulation = {
  insertAfter?: string; // Insert after paragraph starting with this text
  insertBefore?: string; // Insert before paragraph starting with this text
  replaceStart?: string; // Replace paragraph starting with this text
  content: string; // The new/replacement content
  position: 'start' | 'end' | 'after' | 'before' | 'replace'; // Where to insert
};

type GapSuggestionResponse = {
  suggestion: {
    intentUpdate?: string;
    writingUpdate?: string;
    writingSimulation?: WritingSimulation; // Structured info for inline display
  };
};

export const POST = withErrorHandler(async (request: Request) => {
  const authResult = await requireAuth();
  if (isErrorResponse(authResult)) return authResult;

  const body: GapSuggestionRequest = await request.json();
  const { intentContent, coverageStatus, coverageNote, action, currentWriting } = body;

  if (!intentContent) {
    return NextResponse.json(
      { error: "Missing intent content" },
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

  // Different prompts based on action
  const isWritingAction = action === 'writing';

  const systemPrompt = isWritingAction
    ? `You help users add content to fulfill their writing intentions.

Given an intent that is ${coverageStatus === 'partial' ? 'partially covered' : 'not covered'} in the current writing, analyze the writing and suggest where and what to add.

CRITICAL RULES FOR INSERTION POSITION:
1. **Analyze sentence-by-sentence**: Read each sentence and understand its topic
2. **Find the most relevant sentence**: Identify which sentence discusses a related topic
3. **Insert AFTER that sentence**: New content should be inserted immediately after the most relevant sentence
4. **Consider logical flow**: The new content should flow naturally from the previous sentence

Return a JSON object:
{
  "content": "1-2 new sentences to add (focused on the missing intent, flows from the previous sentence)",
  "position": "start" | "end" | "after",
  "insertAfter": "The COMPLETE sentence to insert after (copy the FULL sentence exactly from the writing, only if position is 'after')",
  "reasoning": "Explain: 'Insert after [sentence topic] because [reason]'"
}

IMPORTANT:
- Use position "after" and provide the FULL sentence text (not just first few words)
- The insertAfter must be an EXACT copy of a complete sentence from the writing
- New content should be 1-2 sentences that flow naturally
- Only use position "end" if the intent truly belongs at the very end
- Only use position "start" if the intent should come before everything

Return ONLY the JSON object, no markdown fences or other text.`
    : `You help users resolve gaps between their writing intentions and actual content.

Given an intent that is ${coverageStatus === 'partial' ? 'partially covered' : 'not covered'} in the writing, provide a modified version of the intent that better matches what was actually written (simpler, more specific, or reworded).

Return a JSON object:
{
  "intentUpdate": "modified intent text..."
}

Return ONLY the JSON object, no markdown fences or other text.`;

  const userPrompt = isWritingAction
    ? `Intent to fulfill: "${intentContent}"

Coverage status: ${coverageStatus}
${coverageNote ? `Coverage note: ${coverageNote}` : ''}

Current writing:
"""
${currentWriting || '(empty)'}
"""

Generate content to add and determine the best position to insert it.`
    : `Intent: "${intentContent}"

Coverage status: ${coverageStatus}
${coverageNote ? `Note: ${coverageNote}` : ''}

Generate a modified intent that better matches what was written.`;

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
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", errorText);
    return NextResponse.json(
      { error: "AI generation failed" },
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
    parsed = {};
  }

  const result: GapSuggestionResponse = { suggestion: {} };

  if (isWritingAction) {
    // For writing action, return structured simulation info
    result.suggestion.writingSimulation = {
      content: parsed.content || `[Add content about: ${intentContent}]`,
      position: parsed.position || 'end',
      insertAfter: parsed.insertAfter,
      insertBefore: parsed.insertBefore,
      replaceStart: parsed.replaceStart,
    };
    result.suggestion.writingUpdate = parsed.content; // Also include raw content
  } else {
    // For intent action, return the modified intent
    result.suggestion.intentUpdate = parsed.intentUpdate || intentContent;
  }

  return NextResponse.json(result);
});
