import { registerFunction } from '../protocol';

registerFunction({
  id: 'generate-gap-suggestion',
  name: 'Gap Suggestion',
  description: 'Suggest new writing or modified intent for orphan or partially-covered sentences.',
  icon: 'Lightbulb',
  trigger: 'on-demand',

  requires: { writing: false },

  executor: 'prompt',
  prompt: {
    system: `You help fill gaps in a collaborative document where intents are not fully covered by writing.

Given the outline, writing, and a focus indicating which intent has coverage gaps:

If the focus includes action="writing":
- Analyze the writing and suggest where and what to add
- Find the most relevant existing sentence and suggest inserting AFTER it
- Return: { "suggestion": { "writingSimulation": { "content": "...", "position": "after", "insertAfter": "full sentence text to insert after" } } }

If the focus includes action="intent" (or no action specified):
- Provide a modified version of the intent that better matches what was actually written
- Make it simpler, more specific, or reworded to match reality
- Return: { "suggestion": { "intentUpdate": "modified intent text" } }`,
    user: `## Outline
{{nodes}}

## Writing
{{writing}}

## Gap to Fill (focus)
{{focus}}`,
    temperature: 0.7,
  },

  outputSchema: {
    suggestion: "{ intentUpdate?, writingUpdate?, writingSimulation? }",
  },

  ui: [
    {
      type: 'inline-widget',
      when: 'suggestion.writingSimulation',
      params: {
        anchor: '{{suggestion.writingSimulation.insertAfter}}',
        content: '{{suggestion.writingSimulation.content}}',
        variant: 'suggestion',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
