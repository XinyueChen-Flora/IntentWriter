import { registerFunction } from '../protocol';

registerFunction({
  id: 'generate-gap-suggestion',
  name: 'Gap Suggestion',
  description: 'For writing mode: shows scaffolded writing. For intent mode: shows proposed outline with AI-suggested change.',
  icon: 'Lightbulb',
  trigger: 'on-demand',
  target: { type: 'node', description: 'Suggests changes for coverage gaps' },
  category: 'on-demand',
  dependsOn: ['check-drift'],

  requires: { writing: true },

  executor: 'prompt',
  prompt: {
    system: `You help fill gaps between an outline and its writing.

Check the focus.extra.action field to determine the mode:

## Mode: "writing" (Change Writing)
Show what the writing SHOULD look like if all intents were covered.
Return:
{
  "mode": "writing",
  "currentWriting": "copy the current writing verbatim",
  "scaffoldedWriting": "rewrite with gaps filled using brief placeholder text like [Discuss X here] for missing parts",
  "gapSummary": "what specific content is missing"
}

## Mode: "intent" (Change Outline)
The user wants to adjust the outline to better match the actual writing.
Analyze the coverage status of each intent and suggest appropriate changes:
- "partial" coverage → suggest modifying the intent to better reflect what was actually written
- "missing" coverage (intent exists but nothing written) → suggest removing it, or simplifying it
- orphan content (writing exists but no matching intent) → suggest adding a new intent for it

Return ONLY the intents that belong to the FOCUSED SECTION (the section identified by focus.sectionId).
The proposedOutline should contain the section's root intent and its direct children.
Each item MUST have: id, content, status, and isNew/isRemoved flags for the draft editor.

Return:
{
  "mode": "intent",
  "proposedOutline": [
    { "id": "existing-id", "content": "unchanged text", "status": "unchanged", "isNew": false, "isRemoved": false, "originalContent": "same as content" },
    { "id": "partial-id", "content": "AI revised text to match writing", "status": "changed", "isNew": false, "isRemoved": false, "originalContent": "what it was before", "reason": "why" },
    { "id": "new-uuid", "content": "new intent for orphan content", "status": "added", "isNew": true, "isRemoved": false, "originalContent": "" },
    { "id": "missing-id", "content": "original text", "status": "removed", "isNew": false, "isRemoved": true, "originalContent": "original text" },
    ...
  ],
  "reason": "one-line summary of the changes"
}

IMPORTANT for intent mode:
- Focus on the intent identified by focus.intentId or focus.extra.intentContent, but also fix nearby issues
- Items with isNew=true are new additions; items with isRemoved=true are suggested deletions
- The draft editor allows the user to further edit before proposing`,
    user: `## Outline
{{nodes}}

## Writing
{{writing}}

## Focus (which intent to fix)
{{focus}}`,
    temperature: 0.5,
  },

  outputSchema: {
    mode: '"writing" | "intent"',
    currentWriting: 'string (writing mode)',
    scaffoldedWriting: 'string (writing mode)',
    gapSummary: 'string (writing mode)',
    proposedOutline: 'Array<{id, content, status, originalContent?, reason?}> (intent mode)',
    reason: 'string (intent mode)',
  },

  ui: [
    // ─── Writing mode: diff renders in writing panel (right side) ───
    {
      type: 'diff-view',
      location: 'right-panel',
      when: 'mode === "writing"',
      params: {
        before: '{{currentWriting}}',
        after: '{{scaffoldedWriting}}',
      },
    },
    {
      type: 'banner',
      location: 'right-panel',
      when: 'mode === "writing" && gapSummary',
      params: {
        title: 'Gaps to fill',
        message: '{{gapSummary}}',
        severity: 'info',
      },
    },

    // ─── Intent mode: editable draft of proposed outline changes ───
    {
      type: 'draft-editor',
      when: 'mode === "intent"',
      params: {
        items: '{{proposedOutline}}',
        action: 'update-draft',
        addLabel: 'Add intent',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
