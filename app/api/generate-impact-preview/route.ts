import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type PreviewType =
  | "choose-between"
  | "add-remove"
  | "how-much"
  | "align-with"
  | "terminology"
  | "placement";

type SectionPreview = {
  intentId: string;
  intentContent: string;
  previewText: string;
  changeType: "modified" | "unchanged";
};

type OptionPreview = {
  label: string;
  yourSection: string;
  affectedSections: SectionPreview[];
};

export type ImpactPreview = {
  type: PreviewType;
  originalText: string;
  optionA?: OptionPreview;
  optionB?: OptionPreview;
  withContent?: OptionPreview;
  withoutContent?: OptionPreview;
  briefVersion?: OptionPreview;
  detailedVersion?: OptionPreview;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      questionType,
      question,
      selectedText,
      intentContent,
      allIntents,
    } = body;

    if (!questionType || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const preview = await generateImpactPreview({
      questionType,
      question,
      selectedText,
      intentContent,
      allIntents,
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("[Generate Impact Preview] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function generateImpactPreview({
  questionType,
  question,
  selectedText,
  intentContent,
  allIntents,
}: {
  questionType: PreviewType;
  question: string;
  selectedText?: string;
  intentContent?: string;
  allIntents?: Array<{ id: string; content: string; level: number }>;
}): Promise<ImpactPreview> {

  // Build intent list for context (excluding current intent)
  const otherIntents = allIntents
    ?.filter(i => i.content !== intentContent)
    .slice(0, 4) // Limit to 4 other sections for preview
    .map(i => ({ id: i.id, content: i.content })) || [];

  const intentListStr = otherIntents
    .map(i => `- [${i.id}] ${i.content}`)
    .join("\n");

  switch (questionType) {
    case "choose-between":
      return await generateChooseBetweenPreview(question, selectedText, intentContent, otherIntents, intentListStr);

    case "add-remove":
      return await generateAddRemovePreview(question, selectedText, intentContent, otherIntents, intentListStr);

    case "how-much":
      return await generateHowMuchPreview(question, selectedText, intentContent, otherIntents, intentListStr);

    default:
      return {
        type: questionType,
        originalText: selectedText || "",
      };
  }
}

async function generateChooseBetweenPreview(
  question: string,
  selectedText?: string,
  intentContent?: string,
  otherIntents?: Array<{ id: string; content: string }>,
  intentListStr?: string
): Promise<ImpactPreview> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You help writers preview how their choices affect a collaborative document.

Given two options the writer is choosing between, show:
1. How their section would read with each option
2. How OTHER team members' sections might be written to align with each choice

Be concise - show SHORT representative text snippets (1-2 sentences max per section).
Focus on showing the DIFFERENCE in how related sections would be written.

Output JSON:
{
  "optionA": {
    "label": "2-4 word label",
    "yourSection": "1-2 sentence preview of your section with option A",
    "affectedSections": [
      {
        "intentId": "id from the list",
        "intentContent": "the intent content",
        "previewText": "1-2 sentence preview of how this section might be written",
        "changeType": "modified" or "unchanged"
      }
    ]
  },
  "optionB": {
    "label": "2-4 word label",
    "yourSection": "1-2 sentence preview of your section with option B",
    "affectedSections": [same structure]
  }
}

Only include sections that would actually be affected. Mark as "modified" if the text would differ between options, "unchanged" if it stays the same.`
        },
        {
          role: "user",
          content: `Question: ${question}

${selectedText ? `Selected text: "${selectedText}"` : ""}
${intentContent ? `Writer's current section: ${intentContent}` : ""}

Other sections in document:
${intentListStr || "None"}

Generate side-by-side preview.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      type: "choose-between",
      originalText: selectedText || "",
      optionA: result.optionA,
      optionB: result.optionB,
    };
  } catch (error) {
    console.error("[Choose Between Preview] Error:", error);
    return {
      type: "choose-between",
      originalText: selectedText || "",
    };
  }
}

async function generateAddRemovePreview(
  question: string,
  selectedText?: string,
  intentContent?: string,
  otherIntents?: Array<{ id: string; content: string }>,
  intentListStr?: string
): Promise<ImpactPreview> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You help writers preview how adding/removing content affects a collaborative document.

Show side-by-side:
1. How the writer's section reads WITH vs WITHOUT the content
2. How OTHER sections might be written differently in each case

Be concise - show SHORT text snippets (1-2 sentences max per section).

Output JSON:
{
  "withContent": {
    "label": "Keep/Add",
    "yourSection": "1-2 sentence preview with content included",
    "affectedSections": [
      {
        "intentId": "id",
        "intentContent": "the intent",
        "previewText": "how this section might reference/align with the content",
        "changeType": "modified" or "unchanged"
      }
    ]
  },
  "withoutContent": {
    "label": "Remove/Skip",
    "yourSection": "1-2 sentence preview without the content",
    "affectedSections": [same structure]
  }
}

Only include sections that would be affected.`
        },
        {
          role: "user",
          content: `Question: ${question}

${selectedText ? `Context: "${selectedText}"` : ""}
${intentContent ? `Writer's section: ${intentContent}` : ""}

Other sections:
${intentListStr || "None"}

Generate with/without preview.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      type: "add-remove",
      originalText: selectedText || "",
      withContent: result.withContent,
      withoutContent: result.withoutContent,
    };
  } catch (error) {
    console.error("[Add Remove Preview] Error:", error);
    return {
      type: "add-remove",
      originalText: selectedText || "",
    };
  }
}

async function generateHowMuchPreview(
  question: string,
  selectedText?: string,
  intentContent?: string,
  otherIntents?: Array<{ id: string; content: string }>,
  intentListStr?: string
): Promise<ImpactPreview> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You help writers preview how detail level affects a collaborative document.

Show side-by-side:
1. Brief vs detailed version of the writer's section
2. How OTHER sections might adjust their detail level to match

Be concise - show SHORT text snippets (1-2 sentences max per section).

Output JSON:
{
  "briefVersion": {
    "label": "Brief",
    "yourSection": "1-2 sentence concise version",
    "affectedSections": [
      {
        "intentId": "id",
        "intentContent": "the intent",
        "previewText": "brief version of this related section",
        "changeType": "modified" or "unchanged"
      }
    ]
  },
  "detailedVersion": {
    "label": "Detailed",
    "yourSection": "2-3 sentence expanded version",
    "affectedSections": [same structure with more detail]
  }
}

Only include sections that would adjust their detail level.`
        },
        {
          role: "user",
          content: `Question: ${question}

${selectedText ? `Current text: "${selectedText}"` : ""}
${intentContent ? `Writer's section: ${intentContent}` : ""}

Other sections:
${intentListStr || "None"}

Generate brief/detailed preview.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      type: "how-much",
      originalText: selectedText || "",
      briefVersion: result.briefVersion,
      detailedVersion: result.detailedVersion,
    };
  } catch (error) {
    console.error("[How Much Preview] Error:", error);
    return {
      type: "how-much",
      originalText: selectedText || "",
    };
  }
}
