import { registerFunction } from '../protocol';

registerFunction({
  id: 'analyze-removal-impact',
  name: 'Removal Impact Analysis',
  description: 'Analyze how removing an intent affects related sections via dependencies.',
  icon: 'Trash2',
  trigger: 'proposal',
  target: { type: 'node', description: 'Analyzes impact of removing a specific intent' },
  category: 'proposing',
  triggerOptions: [{ value: 'auto', label: 'Automatic on removal' }],
  defaultTrigger: 'auto',

  requires: { writing: false, dependencies: true },

  executor: 'prompt',
  prompt: {
    system: `You analyze how removing an intent from one section impacts related sections in a collaborative document.

Given the document outline, dependencies, and a focus indicating which intent is being removed:

1. Check which other sections have dependencies on the intent being removed
2. For each related section, assess the impact level

Impact levels:
- "none": no meaningful impact
- "minor": minor inconsistency, easy to fix
- "significant": real logical break, section needs updates

Be conservative - only mark "significant" for real logical breaks.

Return JSON:
{
  "intentId": "id of the intent being removed",
  "rootIntentId": "id of its parent section",
  "impacts": [
    {
      "sectionId": "affected section id",
      "sectionTitle": "affected section title",
      "impactLevel": "none" | "minor" | "significant",
      "reason": "why this section is affected"
    }
  ],
  "message": "one sentence summary"
}`,
    user: `## Outline
{{nodes}}

## Dependencies
{{dependencies}}

## Intent Being Removed (focus)
{{focus}}`,
    temperature: 0.2,
    model: 'gpt-4o-mini',
  },

  outputSchema: {
    intentId: "string",
    rootIntentId: "string",
    impacts: "Array<{ sectionId, sectionTitle, impactLevel, reason }>",
    message: "string",
  },

  ui: [
    {
      type: 'result-list',
      forEach: 'impacts',
      filter: 'item.impactLevel !== "none"',
      params: {
        title: '{{item.sectionTitle}}',
        badge: '{{item.impactLevel}}',
        badgeVariant: 'warning',
        detail: '{{item.reason}}',
      },
    },
    {
      type: 'banner',
      when: 'impacts.length > 0',
      params: {
        title: 'Removal Impact',
        message: '{{message}}',
        severity: 'warning',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
