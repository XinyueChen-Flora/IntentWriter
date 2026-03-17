import { registerFunction } from '../protocol';

registerFunction({
  id: 'assess-impact',
  name: 'Impact Assessment',
  description: 'Analyze how a proposed change affects other sections.',
  icon: 'Sparkles',
  trigger: 'proposal',

  requires: { dependencies: false },

  executor: 'prompt',
  prompt: {
    system: `You analyze how proposed outline changes to one section impact other related sections in a collaborative document.

Given the full document outline, writing, and dependencies, plus a focused section with proposed changes:

1. Identify which other sections are semantically related to the proposed changes
2. For each related section, assess the impact level and explain why

Impact levels:
- "none": no meaningful impact
- "minor": might want to review but no changes needed
- "significant": likely needs updates for consistency

For significant impacts, suggest specific changes (add/modify/remove intents).

Return JSON:
{
  "impacts": [
    {
      "sectionId": "affected section id",
      "sectionIntent": "affected section's main intent",
      "impactLevel": "none" | "minor" | "significant",
      "reason": "why this section is affected",
      "suggestedChanges": [
        {
          "action": "add" | "modify" | "remove",
          "intentId": "existing id for modify/remove",
          "content": "intent text",
          "position": 0,
          "reason": "why this change"
        }
      ]
    }
  ],
  "summary": "one sentence overall summary"
}`,
    user: `## Full Outline
{{nodes}}

## Writing
{{writing}}

## Dependencies
{{dependencies}}

## Focus (section being changed)
{{focus}}`,
    temperature: 0.3,
  },

  outputSchema: {
    impacts: "Array<{ sectionId, sectionIntent, impactLevel, reason, suggestedChanges? }>",
    summary: "string",
  },

  ui: [
    {
      type: 'result-list',
      forEach: 'impacts',
      filter: 'item.impactLevel !== "none"',
      params: {
        title: '{{item.sectionIntent}}',
        badge: '{{item.impactLevel}}',
        badgeVariant: 'warning',
        detail: '{{item.reason}}',
      },
    },
    {
      type: 'section-alert',
      forEach: 'impacts',
      filter: 'item.impactLevel === "significant"',
      params: {
        sectionId: '{{item.sectionId}}',
        title: 'Impact from proposed change',
        message: '{{item.reason}}',
        severity: 'warning',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
