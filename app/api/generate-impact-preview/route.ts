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

// Intent with full hierarchy info
type IntentInfo = {
  id: string;
  content: string;
  parentId: string | null;
  level: number;
};

// Writing block with linked intent
type WritingBlockInfo = {
  id: string;
  linkedIntentId: string | null;
  content: string;  // The actual paragraph content
};

type SectionChange = {
  intentId: string;
  intentContent: string;
  originalText?: string;
  previewText: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
};

// Each affected paragraph preview
type ParagraphPreview = {
  intentId: string;          // Root intent ID (level 0)
  intentContent: string;     // Root intent content
  currentContent: string;    // Current paragraph content
  previewContent: string;    // How it would change
  changeType: "modified" | "unchanged";
  reason?: string;           // Why this paragraph is affected
};

type OptionPreview = {
  label: string;
  intentChanges: SectionChange[];      // Changes to intent structure
  paragraphPreviews: ParagraphPreview[]; // Changes to paragraphs
};

export type ImpactPreviewResponse = {
  questionType: PreviewType;
  optionA: OptionPreview;
  optionB: OptionPreview;
  affectedIntentIds: string[];  // All intents that might be affected
  affectedRootIntentIds: string[];  // Root-level (level 0) intents affected
  needsTeamDiscussion: boolean;  // True if changes affect multiple root intents
  primaryIntentId: string;  // The main intent this question is about
  generatedAt: number;
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
      currentIntentId,      // The intent the writer is currently working on
      allIntents,           // Full intent hierarchy
      allWritingBlocks,     // All paragraphs with their linked intents
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
      currentIntentId,
      allIntents,
      allWritingBlocks,
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
  currentIntentId,
  allIntents,
  allWritingBlocks,
}: {
  questionType: PreviewType;
  question: string;
  selectedText?: string;
  currentIntentId?: string;
  allIntents?: IntentInfo[];
  allWritingBlocks?: WritingBlockInfo[];
}): Promise<ImpactPreviewResponse> {

  // Build the full document structure for context
  // Group intents by their root (level 0) parent
  const rootIntents = allIntents?.filter(i => i.level === 0) || [];

  // Build document structure showing intent → paragraph mapping
  const documentStructure = rootIntents.map(rootIntent => {
    const childIntents = allIntents?.filter(i => {
      // Find all children of this root intent
      let current = i;
      while (current.parentId) {
        if (current.parentId === rootIntent.id) return true;
        current = allIntents?.find(p => p.id === current.parentId) || current;
        if (!current.parentId && current.id !== rootIntent.id) break;
      }
      return i.parentId === rootIntent.id;
    }) || [];

    const writingBlock = allWritingBlocks?.find(wb => wb.linkedIntentId === rootIntent.id);

    return {
      rootIntent,
      childIntents,
      paragraphContent: writingBlock?.content || "(no content yet)",
      writingBlockId: writingBlock?.id,
    };
  });

  // Find current intent and its root
  const currentIntent = allIntents?.find(i => i.id === currentIntentId);
  let currentRootIntent = currentIntent;
  if (currentIntent && currentIntent.level > 0) {
    // Find the root parent
    let parent = allIntents?.find(i => i.id === currentIntent.parentId);
    while (parent && parent.level > 0) {
      parent = allIntents?.find(i => i.id === parent?.parentId);
    }
    currentRootIntent = parent || currentIntent;
  }

  const systemPrompt = `You are a team member in a collaborative writing group. Your team has discussed and agreed on an intent structure that guides your collaborative document. Now each member is writing their assigned sections.

## Your Role
You are helping a teammate think through a decision. They've written part of their section and are now uncertain about something. You need to show them:
1. If they KEEP the current approach: How would they continue? How would other teammates' sections stay coherent?
2. If they MAKE A CHANGE: How would their writing shift? How would teammates need to adjust to maintain coherence?

## The Document Structure
- Each **Level 0 intent** = a section/paragraph assigned to a team member
- **Level 1+ intents** = sub-points that guide what to cover in that section
- All sections must work together as a coherent document

## Your Task
A teammate is asking: "{question}"

Think through:
1. Which intent/section is this question about?
2. If they keep current approach → their writing continues in direction X, teammates write Y
3. If they make the change → their writing shifts to direction X', teammates need to adjust to Y'
4. Would this change ripple to other sections? (If yes → needs team discussion)

## CRITICAL: Write Like a Real Writer
When generating paragraphPreviews, WRITE AS IF YOU ARE THE ACTUAL WRITER:
- Use natural academic prose, not descriptions of what would be written
- Include specific examples, transitions, and argumentation
- Match the tone and style of existing content
- Write complete, publication-ready paragraphs

## Output Format (JSON)
{
  "primaryIntentId": "the intent ID this question is mainly about",
  "affectedIntentIds": ["all intent IDs affected - including sub-intents"],
  "affectedRootIntentIds": ["level-0 intent IDs affected - these are the sections"],
  "needsTeamDiscussion": true if change affects multiple sections,
  "reasoning": "Why this does/doesn't need team discussion",
  "optionA": {
    "label": "Keep Current (brief description)",
    "isCurrentState": true,
    "intentChanges": [],
    "paragraphPreviews": [
      {
        "intentId": "root intent ID (MUST match exactly)",
        "intentContent": "section's intent",
        "currentContent": "existing content OR empty string",
        "previewContent": "REQUIRED! If section has written content: copy that content here. If section is 'Not yet written': GENERATE 2-3 paragraphs showing what teammate WOULD write following the current intent structure.",
        "changeType": "unchanged",
        "reason": "Following original intent"
      }
    ]
  },
  "optionB": {
    "label": "Make Change (brief description)",
    "isCurrentState": false,
    "intentChanges": [
      {
        "intentId": "intent ID being modified",
        "intentContent": "CURRENT intent text (before change)",
        "previewText": "NEW intent text (after change)",
        "changeType": "modified"
      },
      {
        "intentId": "new-intent-id",
        "intentContent": "",
        "previewText": "Text for the new intent being added",
        "changeType": "added"
      },
      {
        "intentId": "intent-to-remove",
        "intentContent": "Intent text that would be removed",
        "previewText": "",
        "changeType": "removed"
      }
    ],
    "paragraphPreviews": [
      {
        "intentId": "root intent ID for affected section",
        "intentContent": "section's intent",
        "currentContent": "existing content OR empty",
        "previewContent": "WRITE THE ACTUAL PARAGRAPH showing how this section would be written with the new intent structure.",
        "changeType": "modified",
        "reason": "How this section's writing changes"
      }
    ]
  }
}

## CRITICAL RULES:

### For intentChanges (Option B):
- Show ACTUAL changes to intent structure, not descriptions
- changeType can be: "modified", "added", "removed"
- For "modified": intentContent = current text, previewText = new text
- For "added": intentContent = empty, previewText = new intent text
- For "removed": intentContent = text being removed, previewText = empty
- Include ALL affected intents (root and sub-intents)

### For paragraphPreviews (BOTH Options) - REQUIRED FOR ALL AFFECTED SECTIONS:
- **Option A paragraphPreviews** (REQUIRED - DO NOT SKIP):
  - Include a paragraphPreview for EVERY section in affectedRootIntentIds
  - If section has written content: copy that content into previewContent
  - If section is "Not yet written": GENERATE 2-3 paragraphs showing what teammate WOULD write following CURRENT intent
  - The intentId MUST match exactly the root intent ID from the document structure
- **Option B paragraphPreviews** (REQUIRED):
  - Include a paragraphPreview for EVERY section in affectedRootIntentIds
  - GENERATE the full paragraph showing how writing would change with MODIFIED intent
- Write as if you ARE the teammate - real prose, not descriptions

### Example:
If I ask "Should I add the scenario in my section?":
- Option A intentChanges: [] (no changes)
- Option A paragraphPreviews: MUST include previews for ALL affected sections - generate writing for empty sections
- Option B intentChanges:
  - {intentId: "section-1", intentContent: "describe problem", previewText: "describe problem using a real scenario", changeType: "modified"}
  - {intentId: "section-2", intentContent: "introduce scenario", previewText: "", changeType: "removed"} (if scenario moves to section 1)
- Option B paragraphPreviews: Full paragraphs for all affected sections

Only output valid JSON.`;

  // Build the user prompt with full document context - role-play framing
  let userPrompt = `## Situation
I'm a team member working on our collaborative document. We've agreed on the intent structure below.

## My Question
I've been writing my section and I'm uncertain: "${question}"

`;

  if (selectedText) {
    userPrompt += `## The Text I'm Uncertain About
"${selectedText}"

`;
  }

  if (currentRootIntent) {
    userPrompt += `## My Current Section
I'm responsible for: [${currentRootIntent.id}] "${currentRootIntent.content}"

`;
  }

  userPrompt += `## Our Team's Document Structure
Here's what our team agreed on and what each section currently looks like:

`;

  documentStructure.forEach((section, idx) => {
    const isCurrent = section.rootIntent.id === currentRootIntent?.id;
    const hasContent = section.paragraphContent && section.paragraphContent !== "(no content yet)";

    userPrompt += `### Section ${idx + 1}${isCurrent ? ' ← MY SECTION' : ''}\n`;
    userPrompt += `**Intent:** ${section.rootIntent.content}\n`;
    userPrompt += `**ID:** ${section.rootIntent.id}\n`;

    if (section.childIntents.length > 0) {
      userPrompt += `**Sub-points to cover:**\n`;
      section.childIntents.forEach(child => {
        userPrompt += `  • ${child.content}\n`;
      });
    }

    if (hasContent) {
      userPrompt += `**Currently written:**\n${section.paragraphContent}\n\n`;
    } else {
      userPrompt += `**Status:** Not yet written\n\n`;
    }
  });

  userPrompt += `## Help Me Think Through This
1. What intent is my question really about?
2. **If I keep current approach (Option A):** How would I continue writing? How do my teammates' sections stay coherent with mine?
3. **If I make the change (Option B):**
   - How would MY section's writing change? Write out how I would actually write it.
   - How would this affect my TEAMMATES' sections? Would they need to adjust?
4. Does this change ripple beyond my section? If it affects how teammates should write → needs team discussion.

## CRITICAL: Generate paragraphPreviews for BOTH Options
- **Option A paragraphPreviews**: For ALL affected sections, generate what the writing WOULD look like following the CURRENT intent. If a section already has content, use that content. If a section is empty ("Not yet written"), GENERATE what that teammate would write.
- **Option B paragraphPreviews**: For ALL affected sections, generate what the writing WOULD look like following the MODIFIED intent.
- Write as if you ARE the teammate writing that section - real prose, not descriptions.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // Calculate affected root intents if not provided
    const affectedRootIntentIds = result.affectedRootIntentIds ||
      (result.affectedIntentIds || []).filter((id: string) => {
        const intent = allIntents?.find(i => i.id === id);
        return intent && intent.level === 0;
      });

    // Determine if team discussion is needed (affects multiple root intents)
    const needsTeamDiscussion = result.needsTeamDiscussion ?? (affectedRootIntentIds.length > 1);

    return {
      questionType,
      optionA: result.optionA || { label: "Keep Current", intentChanges: [], paragraphPreviews: [] },
      optionB: result.optionB || { label: "Make Change", intentChanges: [], paragraphPreviews: [] },
      affectedIntentIds: result.affectedIntentIds || [],
      affectedRootIntentIds,
      needsTeamDiscussion,
      primaryIntentId: result.primaryIntentId || currentIntentId || "",
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error("[Generate Impact Preview] Error:", error);
    return {
      questionType,
      optionA: { label: "Keep Current", intentChanges: [], paragraphPreviews: [] },
      optionB: { label: "Make Change", intentChanges: [], paragraphPreviews: [] },
      affectedIntentIds: [],
      affectedRootIntentIds: [],
      needsTeamDiscussion: false,
      primaryIntentId: currentIntentId || "",
      generatedAt: Date.now(),
    };
  }
}
