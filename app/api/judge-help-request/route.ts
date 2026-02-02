import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      question,
      selectedText,
      currentIntentId,
      currentIntentContent,
      allIntents,
    } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Missing required field: question" },
        { status: 400 }
      );
    }

    // Use AI to judge if this is a team-relevant question
    const judgment = await judgeHelpRequest({
      question,
      selectedText,
      currentIntentId,
      currentIntentContent,
      allIntents,
    });

    return NextResponse.json(judgment);
  } catch (error) {
    console.error("[Judge Help Request] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function judgeHelpRequest({
  question,
  selectedText,
  currentIntentId,
  currentIntentContent,
  allIntents,
}: {
  question: string;
  selectedText?: string;
  currentIntentId?: string;
  currentIntentContent?: string;
  allIntents: Array<{ id: string; content: string; parentId: string | null; level: number }>;
}) {
  try {
    // Build intent structure for context
    const intentStructure = allIntents
      .map((intent) => {
        const indent = "  ".repeat(intent.level);
        const isCurrent = intent.id === currentIntentId ? " [CURRENT]" : "";
        return `${indent}- ${intent.content}${isCurrent}`;
      })
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in collaborative writing who helps determine whether a writer's question/uncertainty needs team input or can be resolved individually.

CONTEXT:
- A writer is working on a collaborative document with a team
- Each team member is assigned specific intents (sections) to write
- The team has established a shared "intent structure" (outline) as their Common Ground
- The writer has raised a question/uncertainty about their writing

YOUR TASK:
Analyze the writer's question and determine if it:
1. **Requires Team Input** (isTeamRelevant: true) - when the question:
   - Involves changing or adding to the shared intent structure
   - Affects content that other team members are responsible for
   - Questions the direction/scope that the whole team agreed upon
   - Needs decision from team about content strategy
   - Could cause inconsistency with other sections
   - Touches on shared terminology, style guidelines, or conventions

2. **Can Be Resolved Individually** (isTeamRelevant: false) - when the question:
   - Is about factual information the writer can look up
   - Is about writing style/phrasing within their own section
   - Is about technical implementation details specific to their section
   - Can be answered with general knowledge or AI assistance
   - Doesn't change the agreed-upon structure or scope
   - Is about how to phrase or word something
   - Is about adding/removing details within their own section
   - Is a "how much detail" or "how to write" question

Output JSON format:
{
  "isTeamRelevant": boolean,
  "affectedIntents": string[] | null,  // IDs of intents that may be affected (only if team relevant)
  "reason": "Brief explanation of the judgment (1-2 sentences)"
}

IMPORTANT: Most writing questions can be resolved individually. Only flag as team-relevant if it CLEARLY affects other team members' sections or the overall document structure.`,
        },
        {
          role: "user",
          content: `# Writer's Question
${question}

${selectedText ? `# Selected Text (context)\n"${selectedText}"\n` : ""}

# Current Intent
${currentIntentContent || "Not specified"}

# Full Intent Structure (Team's Common Ground)
${intentStructure}

Analyze whether this question requires team input or can be resolved individually.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    console.log("[Judge Help Request] AI result:", result);

    return {
      isTeamRelevant: result.isTeamRelevant ?? false,
      affectedIntents: result.affectedIntents || null,
      reason: result.reason || "Unable to determine",
    };
  } catch (error) {
    console.error("[OpenAI] Help request judgment failed:", error);

    // Default to personal if AI fails
    return {
      isTeamRelevant: false,
      reason: "AI judgment unavailable. Defaulting to personal question.",
    };
  }
}
