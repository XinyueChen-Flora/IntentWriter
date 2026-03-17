import { registerFunction } from '../protocol';

registerFunction({
  id: 'preview-writing-impact',
  name: 'Writing Preview',
  description: 'Generate before/after prose preview for a proposed change.',
  icon: 'FileText',
  trigger: 'proposal',

  requires: { writing: true },

  executor: 'prompt',
  prompt: {
    system: `You preview how proposed outline changes would affect the writing in a collaborative document.

Given the current outline, writing, and proposed changes (in focus), generate a before/after comparison.

If writing exists:
- Make MINIMUM changes necessary
- Keep as much original text WORD-FOR-WORD as possible
- For REMOVED intents: delete specific sentences that only served that intent
- For NEW intents: insert a sentence at the appropriate position
- For MODIFIED intents: adjust only specific words/phrases

If no writing exists:
- Generate a brief scaffold showing what would be written

Return JSON:
{
  "mode": "prose" | "scaffold",
  "currentPreview": "the current text (or scaffold)",
  "changedPreview": "the text after applying changes"
}`,
    user: `## Outline
{{nodes}}

## Current Writing
{{writing}}

## Proposed Changes (focus)
{{focus}}`,
    temperature: 0.2,
  },

  outputSchema: {
    mode: "'prose' | 'scaffold'",
    currentPreview: "string",
    changedPreview: "string",
  },

  ui: [
    {
      type: 'diff-view',
      params: {
        before: '{{currentPreview}}',
        after: '{{changedPreview}}',
        mode: 'side-by-side',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
