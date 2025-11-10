import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AACU_DIMENSIONS, type AACUDimension } from "@/lib/aacuFramework";
import type { RuleBlock } from "@/lib/partykit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { rubricText, userId, userName, userEmail } = await request.json();

    if (!rubricText || typeof rubricText !== "string") {
      return NextResponse.json(
        { error: "Invalid rubric text" },
        { status: 400 }
      );
    }

    console.log("[Analyze Rubric] Analyzing rubric with AI...");

    // Prepare the AAC&U framework description for the AI
    const frameworkDescription = Object.values(AACU_DIMENSIONS)
      .map(
        (dim) => `
**${dim.name}** (${dim.id}):
${dim.description}

Keywords: ${dim.keywords.join(", ")}
`
      )
      .join("\n");

    // Call OpenAI to analyze the rubric and generate rules
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in writing pedagogy and assessment. You analyze writing rubrics and map them to the AAC&U VALUE Rubrics - Written Communication framework.`
        },
        {
          role: "user",
          content: `You will analyze an instructor's writing rubric and classify it according to the AAC&U VALUE Rubrics framework.

**Your Task:**
1. Read the instructor's rubric carefully (DO NOT modify or rewrite it)
2. Identify which AAC&U dimension(s) this rubric addresses
3. Extract the ORIGINAL rubric text as separate rules/criteria
4. Add a brief rationale explaining why this maps to each AAC&U dimension

**AAC&U VALUE Rubrics Framework:**

${frameworkDescription}

**Instructor's Rubric:**

${rubricText}

**Instructions:**

Break the rubric into individual criteria/requirements. For each criterion, identify which AAC&U dimension it belongs to, and keep the ORIGINAL text.

Return JSON in this format:

{
  "rules": [
    {
      "dimension": "context-purpose" | "content-development" | "genre-conventions" | "sources-evidence" | "syntax-mechanics",
      "content": "ORIGINAL rubric text exactly as written",
      "rationale": "Brief explanation of why this criterion maps to this AAC&U dimension",
      "examples": []
    }
  ],
  "summary": "Brief overview of what AAC&U dimensions this rubric covers"
}

**CRITICAL REQUIREMENTS:**

1. **PRESERVE ORIGINAL TEXT**: Use the instructor's exact wording in "content" field
   - DO NOT rewrite, simplify, or expand the rubric
   - Keep all specific numbers, formats, and requirements as stated
   - If rubric says "5-page essay", keep it as "5-page essay"

2. **BREAK INTO GRANULAR RULES**: Split multi-part rubrics into separate entries
   - If rubric has bullet points, make each bullet a separate rule
   - If rubric has multiple criteria, split them up
   - Each rule should focus on ONE specific requirement

3. **TAG WITH DIMENSION**: Assign the most relevant AAC&U dimension
   - One rubric criterion can only have ONE primary dimension
   - Choose the best fit based on what the criterion primarily evaluates
   - It's OK if not all 5 dimensions are represented

4. **ADD CONTEXT IN RATIONALE**: Explain the dimension mapping
   - Why does this criterion belong to this dimension?
   - What aspect of writing is being evaluated?

**Example:**

Input Rubric:
"Paper must be 5-7 pages, double-spaced, with APA citations. Include a clear thesis statement in the introduction. Support your argument with at least 3 peer-reviewed sources."

Output:
{
  "rules": [
    {
      "dimension": "genre-conventions",
      "content": "Paper must be 5-7 pages, double-spaced",
      "rationale": "This criterion addresses formatting conventions expected in academic writing",
      "examples": []
    },
    {
      "dimension": "sources-evidence",
      "content": "Use APA citations",
      "rationale": "This criterion addresses proper citation format and crediting sources",
      "examples": []
    },
    {
      "dimension": "content-development",
      "content": "Include a clear thesis statement in the introduction",
      "rationale": "This criterion addresses how the writer develops and presents their central argument",
      "examples": []
    },
    {
      "dimension": "sources-evidence",
      "content": "Support your argument with at least 3 peer-reviewed sources",
      "rationale": "This criterion addresses the quality and quantity of sources used as evidence",
      "examples": []
    }
  ],
  "summary": "This rubric primarily focuses on Genre Conventions (formatting), Sources & Evidence (citations and source quality), and Content Development (thesis)"
}

Return valid JSON only.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || "{}";

    // Parse the AI response
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Analyze Rubric] Failed to parse AI response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI response", details: responseText },
        { status: 500 }
      );
    }

    // Convert AI response to RuleBlock format
    const rules: RuleBlock[] = aiResponse.rules.map((rule: any, index: number) => {
      return {
        id: `rule-${Date.now()}-${Math.random()}-${index}`,
        content: rule.content,
        rationale: rule.rationale,
        examples: rule.examples || [],
        editingTrace: [],
        createdBy: userId,
        createdByName: userName,
        createdByEmail: userEmail,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        position: index,
        dimension: rule.dimension as AACUDimension,
        sourceRubric: rubricText,
      };
    });

    console.log(`[Analyze Rubric] Generated ${rules.length} rules`);

    return NextResponse.json({
      success: true,
      rules,
      summary: aiResponse.summary,
    });
  } catch (error) {
    console.error("[Analyze Rubric] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze rubric",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
