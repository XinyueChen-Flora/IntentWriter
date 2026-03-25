import { registerFunction } from '../protocol';

registerFunction({
  id: 'preview-alternatives',
  name: 'Alternative Preview',
  description: 'Compare multiple proposed changes side-by-side to help choose the best option.',
  icon: 'Columns',
  trigger: 'on-demand',
  target: { type: 'section', description: 'Generates alternative versions of proposed changes for comparison' },
  category: 'proposing',
  triggerOptions: [{ value: 'manual', label: 'User initiates' }],
  defaultTrigger: 'manual',
  dependsOn: ['check-drift'],

  requires: { writing: true },

  executor: 'prompt',
  prompt: {
    system: `You generate alternative versions of proposed outline changes for a collaborative document.

Given the current outline, writing, and a proposed change, generate 2-3 alternative approaches that address the same underlying issue differently.

For each alternative:
1. A different way to restructure the intents
2. The trade-offs of this approach
3. A brief writing preview showing how the text would change

Return JSON:
{
  "alternatives": [
    {
      "id": "alt-1",
      "label": "Conservative: minimal change",
      "changes": [
        { "id": "intent-id or new-1", "content": "intent text", "status": "new" | "modified" | "removed" }
      ],
      "tradeoff": "Why pick this approach (1 sentence)",
      "writingPreview": "Brief preview of how writing would look"
    }
  ],
  "recommendation": "Which alternative best balances the constraints (1 sentence)"
}`,
    user: `## Outline
{{nodes}}

## Writing
{{writing}}

## Proposed Change (focus)
{{focus}}`,
    temperature: 0.5,
  },

  outputSchema: {
    alternatives: "Array<{ id, label, changes, tradeoff, writingPreview }>",
    recommendation: "string",
  },

  output: {
    type: 'AlternativesResult',
    fields: {
      alternatives: 'Array<Alternative>',
      recommendation: 'string',
    },
  },

  ui: [
    {
      type: 'result-list',
      forEach: 'alternatives',
      params: {
        title: '{{item.label}}',
        badge: '{{item.id}}',
        badgeVariant: 'info',
        detail: '{{item.tradeoff}}',
      },
    },
    {
      type: 'action-group',
      when: 'alternatives.length > 0',
      params: {
        actions: '[{"label":"Compare in detail","variant":"primary","action":"compare"},{"label":"Dismiss","variant":"secondary","action":"dismiss"}]',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
