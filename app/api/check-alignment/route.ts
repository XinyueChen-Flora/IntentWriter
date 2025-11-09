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
      intentContent,
      intentTag,
      intentList,
      writingContent,
      documentId
    } = body;

    if (!writingContent || !intentList) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("[AI Alignment] Checking alignment:", {
      intentList: intentList?.length || 0,
      intentTag: intentTag?.substring(0, 50),
      writing: writingContent.substring(0, 50),
    });

    // Use OpenAI to check alignment
    const response = await checkAlignmentWithAI(
      intentList,
      intentTag,
      writingContent
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AI Alignment] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// OpenAI-powered alignment checker
async function checkAlignmentWithAI(
  intentList: Array<{ id: string; content: string; type: string; level: number }>,
  intentTag: string | undefined,
  writingContent: string
) {
  try {
    // Build hierarchical intent structure with indexed list
    let intentStructure = '';

    intentList.forEach((intent, idx) => {
      if (intent.type === 'main') {
        intentStructure += `[${idx}] **Main Intent**: ${intent.content}\n\n`;
        if (intentTag) {
          intentStructure += `   _Intent Note_: ${intentTag}\n\n`;
        }
      } else {
        const indent = "  ".repeat(intent.level);
        intentStructure += `${indent}[${idx}] ${intent.content}\n`;
      }
    });
    intentStructure += "\n";

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert writing coach who analyzes whether written content aligns with the author's stated intents and goals.

Your task:
1. Analyze the "Intent Structure" (main intent, sub-intents, and guidance notes)
2. Compare it with the "Written Content"
3. Evaluate alignment on a scale of 0-100
4. Provide constructive feedback

Output format (JSON):
{
  "aligned": boolean (true if score >= 70),
  "alignmentScore": number (0-100),
  "feedback": string (2-3 sentences summary),
  "sentences": [
    {
      "text": string (the sentence text),
      "status": "aligned" | "not-aligned" | "extra",
      "mappedIntentIndex": number (index of the intent from the list, e.g., 0 for main, 1 for first sub-intent),
      "note": string (brief explanation)
    }
  ],
  "intentStatus": {
    "main": "covered" | "partial" | "missing",
    "subIntents": [
      {
        "index": number (intent index from list),
        "status": "covered" | "partial" | "missing"
      }
    ]
  },
  "suggestions": {
    "newIntents": string[] (suggested new sub-intents for extra content),
    "missingCoverage": number[] (intent indices that need more coverage)
  }
}

IMPORTANT:
1. Each intent is numbered [0], [1], [2], etc. in the intent structure
2. For each sentence, return the "mappedIntentIndex" (the number in brackets) that it aligns with
3. If a sentence doesn't align with any intent, use -1 for mappedIntentIndex
4. Split writing into sentences (use period, question mark, exclamation). Analyze each sentence individually.`,
        },
        {
          role: "user",
          content: `# Intent Structure\n${intentStructure}\n# Written Content\n${writingContent}\n\nAnalyze the alignment and provide detailed feedback in JSON format.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // Convert mappedIntentIndex to actual intent IDs
    const sentences = (result.sentences || []).map((sentence: any) => {
      const intentIndex = sentence.mappedIntentIndex;
      const mappedIntentId = intentIndex >= 0 && intentIndex < intentList.length
        ? intentList[intentIndex].id
        : null;

      return {
        text: sentence.text,
        status: sentence.status,
        mappedIntentId: mappedIntentId,
        mappedIntentDescription: intentIndex >= 0 && intentIndex < intentList.length
          ? intentList[intentIndex].content.substring(0, 50)
          : "No match",
        note: sentence.note,
      };
    });

    return {
      aligned: result.aligned || false,
      alignmentScore: result.alignmentScore || 0,
      feedback: result.feedback || "Unable to analyze alignment",
      sentences: sentences,
      intentStatus: result.intentStatus || { main: "missing", subIntents: [] },
      suggestions: result.suggestions || { newIntents: [], missingCoverage: [] },
    };
  } catch (error) {
    console.error("[OpenAI] Alignment check failed:", error);

    // Fallback to simple analysis if OpenAI fails
    return {
      aligned: false,
      alignmentScore: 50,
      feedback: "AI analysis unavailable. Please review manually.",
      detailedAnalysis: {
        strengths: ["Content structure present"],
        gaps: ["Unable to perform detailed analysis"],
        suggestions: ["Check OpenAI API key and try again"],
      },
      coverageByIntent: {
        mainIntent: 50,
        subIntents: 50,
      },
    };
  }
}
