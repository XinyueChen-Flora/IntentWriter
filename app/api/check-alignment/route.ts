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
    // Build hierarchical intent structure with indexed list and IDs
    let intentStructure = '';

    intentList.forEach((intent, idx) => {
      if (intent.type === 'main') {
        intentStructure += `[${idx}] (ID: ${intent.id}) **Main Intent**: ${intent.content}\n\n`;
        if (intentTag) {
          intentStructure += `   _Intent Note_: ${intentTag}\n\n`;
        }
      } else {
        const indent = "  ".repeat(intent.level);
        intentStructure += `${indent}[${idx}] (ID: ${intent.id}) ${intent.content}\n`;
      }
    });
    intentStructure += "\n";

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert writing coach who analyzes how written content aligns with the author's intent structure.

Your task:
Build an Intent Tree where EACH node represents an intent with its writing coverage.

CRITICAL REQUIREMENTS:

1. **Complete Coverage**:
   - Break writing into segments (sentence/paragraph/phrase level)
   - ALL segments must be assigned to an intent (existing or suggested)
   - Segments should NOT be over-fragmented - keep consecutive text about the same intent together
   - Track position order (0, 1, 2...) for each segment in the original writing

2. **Intent Tree Structure**:
   - Preserve the original intent hierarchy (parent-child relationships)
   - For each intent, find ALL writing segments that discuss it
   - **CRITICAL**: Use the exact intentId from the input structure (shown as "ID: xyz"). Do NOT create new IDs!

   - **CRITICAL for Suggested Intents** (extra content not in outline):
     * Create a SUGGESTED intent node with intentId=null and isSuggested=true
     * **MUST provide structured position metadata**:
       - insertPosition.parentIntentId: ID of the parent intent (null if root level)
       - insertPosition.beforeIntentId: ID of the intent that should come AFTER this suggestion (null if last)
       - insertPosition.afterIntentId: ID of the intent that should come BEFORE this suggestion (null if first)
       - insertPosition.level: Indentation level (0=root, 1=child, 2=grandchild, etc.)
     * Place suggested intent at the EXACT position in tree based on positionInWriting:
       - If extra content appears BEFORE any existing intent → insertPosition.beforeIntentId = first intent's ID
       - If extra content appears BETWEEN two intents → insertPosition.afterIntentId and beforeIntentId should bracket it
       - If extra content appears AFTER all intents → insertPosition.afterIntentId = last intent's ID
       - Determine correct parent based on semantic context and indentation level

3. **Status Determination** (CRITICAL - Use Tree Traversal Order):
   - **Tree Traversal Order**: Process intents in depth-first order (parent → children → next sibling)

   - **Special Rule for Parent/Root Intents**:
     * Parent intents are organizational/structural - they don't need direct writing content
     * A parent intent's status should be based on its children's coverage:
       - If ALL children are "covered" → parent is "covered"
       - If SOME children are covered/partial → parent is "partial"
       - If NO children have writing, apply skipped/not-started rules
     * Parent intents CAN have their own writingSegments, but it's not required

   - **"missing-skipped"**: An intent with NO writing segments (and no children coverage), AND at least one intent that comes AFTER it in tree traversal order HAS writing
     * Example: If Intent[0] has no writing and no covered children, Intent[1] has no writing, but Intent[3] has writing, then Intent[0] and Intent[1] are BOTH "missing-skipped"
     * Key: "Later" means later in tree traversal, NOT later in array index

   - **"missing-not-started"**: An intent with NO writing segments (and no children coverage), AND NO intents after it in tree traversal order have writing yet

   - "covered": fully written and well-aligned (OR all children are covered for parent intents)
   - "partial": some aspects written correctly, missing key parts (OR some children covered for parent intents)
   - "misaligned": author attempted but went off-track
   - "extra": suggested intent for writing not in outline

4. **Order Analysis**:
   - Compare intent structure order vs actual writing order (via positionInWriting)
   - If writing covers intents in different order than outlined, note this
   - Use positionInWriting to detect both order mismatches AND to correctly place suggested intents

Output JSON format:
{
  "overallScore": number (0-100),
  "feedback": "Overall assessment in 2-3 sentences",

  "intentTree": [
    {
      "intentIndex": number,
      "intentId": string | null,  // IMPORTANT: Use the exact ID from input (e.g., "abc-123-def"). Only null for suggested intents
      "content": "intent text",
      "level": number,  // 0=main, 1=sub, 2=sub-sub, etc.
      "isSuggested": boolean,  // true if this is AI-suggested (for extra content)

      "status": "covered" | "partial" | "misaligned" | "missing-skipped" | "missing-not-started" | "extra",

      // CRITICAL: For suggested intents, provide structured position metadata
      "insertPosition": {
        "parentIntentId": string | null,  // ID of parent intent (null if root level)
        "beforeIntentId": string | null,  // ID of intent that comes AFTER this (null if last)
        "afterIntentId": string | null,   // ID of intent that comes BEFORE this (null if first)
        "level": number                    // Indentation level (0=root, 1=child, etc.)
      } | null,  // Only for suggested intents (isSuggested=true)

      "writingSegments": [
        {
          "text": "writing text",
          "positionInWriting": number,  // order in original writing (0, 1, 2...)
          "note": "brief explanation"
        }
      ],

      "coveredAspects": ["aspect1", ...],
      "missingAspects": ["aspect2", ...],
      "suggestion": "specific actionable suggestion",

      "orderMismatch": {
        "expected": number,  // expected position based on intent structure
        "actual": number,    // actual position based on writing order
        "suggestion": "Consider moving this section..."
      } | null,

      "children": [
        /* same structure recursively */
      ]
    }
  ]
}

Example 1 - Skipped Intents:

Input Intent Structure:
[0] (ID: abc-123) Main: MeetMap intro
  [1] (ID: def-456) challenges in meeting
    [2] (ID: ghi-789) specific challenges for group meetings
  [3] (ID: jkl-012) current meeting system solution
  [4] (ID: mno-345) meetmap systems
  [5] (ID: pqr-678) human map v.s. AI map

Writing: "The system uses AI to map conversations... I explored two divisions of labor between human and AI..."

Output Intent Tree (showing skipped detection):
[
  {
    intentIndex: 0, intentId: "abc-123", content: "MeetMap intro", level: 0,
    status: "missing-skipped",  // SKIPPED! Later intents [3] and [5] have writing
    writingSegments: [],
    children: [
      {
        intentIndex: 1, intentId: "def-456", content: "challenges in meeting", level: 1,
        status: "missing-skipped",  // SKIPPED! Later intents have writing
        writingSegments: [],
        children: [
          {
            intentIndex: 2, intentId: "ghi-789", content: "specific challenges", level: 2,
            status: "missing-skipped",  // SKIPPED! Later intents have writing
            writingSegments: [],
            children: []
          }
        ]
      },
      {
        intentIndex: 3, intentId: "jkl-012", content: "current meeting system solution", level: 1,
        status: "partial",
        writingSegments: [{text: "The system uses AI to map conversations...", positionInWriting: 0}],
        children: []
      },
      {
        intentIndex: 4, intentId: "mno-345", content: "meetmap systems", level: 1,
        status: "missing-not-started",  // NO writing yet, but later intent [5] has writing - should this be skipped? YES!
        writingSegments: [],
        children: []
      },
      {
        intentIndex: 5, intentId: "pqr-678", content: "human map v.s. AI map", level: 1,
        status: "partial",
        writingSegments: [{text: "I explored two divisions...", positionInWriting: 1}],
        children: []
      }
    ]
  }
]

Example 2 - Extra Content with Structured Position:

Input Intent Structure:
[0] (ID: abc-123) Main: MeetMap intro
  [1] (ID: def-456) challenges in meeting
  [2] (ID: ghi-789) current meeting system solution

Writing: "Yet many real-time tasks are collaborative... [Extra - positionInWriting: 0]. MeetMap helps teams by addressing challenges... [Covers intent 0 - positionInWriting: 1]. Extra technical detail about the system architecture... [Extra - positionInWriting: 2]"

Output Intent Tree (showing structured positioning):
[
  {
    intentIndex: null, intentId: null, content: "Collaborative real-time tasks background", level: 0,
    isSuggested: true,
    status: "extra",
    insertPosition: {
      parentIntentId: null,        // Root level
      beforeIntentId: "abc-123",   // Should be inserted BEFORE "MeetMap intro"
      afterIntentId: null,          // Nothing before it
      level: 0                      // Root level
    },
    writingSegments: [{text: "Yet many real-time tasks are collaborative...", positionInWriting: 0}],
    suggestion: "Consider adding this as an introduction before MeetMap intro",
    children: []
  },
  {
    intentIndex: 0, intentId: "abc-123", content: "MeetMap intro", level: 0,
    status: "partial",
    writingSegments: [{text: "MeetMap helps teams by addressing challenges...", positionInWriting: 1}],
    children: [
      {
        intentIndex: 1, intentId: "def-456", content: "challenges in meeting", level: 1,
        status: "missing-skipped",
        writingSegments: [],
        children: []
      },
      {
        intentIndex: 2, intentId: "ghi-789", content: "current meeting system solution", level: 1,
        status: "partial",
        writingSegments: [],
        children: [
          {
            intentIndex: null, intentId: null, content: "System architecture details", level: 2,
            isSuggested: true,
            status: "extra",
            insertPosition: {
              parentIntentId: "ghi-789",   // Child of "current meeting system solution"
              beforeIntentId: null,         // Last child
              afterIntentId: null,          // No sibling before it (first child)
              level: 2                      // Grandchild level
            },
            writingSegments: [{text: "Extra technical detail about the system architecture...", positionInWriting: 2}],
            suggestion: "Consider adding 'System architecture details' as a sub-intent under 'current meeting system solution'",
            children: []
          }
        ]
      }
    ]
  }
]
`,
        },
        {
          role: "user",
          content: `# Intent Structure\n${intentStructure}\n# Written Content\n${writingContent}\n\nAnalyze the alignment and provide detailed feedback in JSON format.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    console.log("[AI Alignment] ========== FULL LLM OUTPUT ==========");
    console.log(JSON.stringify(result, null, 2));
    console.log("[AI Alignment] ========== END LLM OUTPUT ==========");

    // Process intentTree: intentId is already provided by AI (matches intentList)
    // For suggested intents, intentId will be null
    // No need to map intentIndex to intentId - AI already provides intentId!

    return {
      overallScore: result.overallScore || 0,
      feedback: result.feedback || "Unable to analyze alignment",
      intentTree: result.intentTree || [],
    };
  } catch (error) {
    console.error("[OpenAI] Alignment check failed:", error);

    // Fallback to simple analysis if OpenAI fails
    return {
      overallScore: 50,
      feedback: "AI analysis unavailable. Please review manually.",
      intentTree: [],
    };
  }
}
