import { registerFunction } from '../protocol';

registerFunction({
  id: 'detect-dependencies',
  name: 'Dependency Detection',
  description: 'AI-suggested relationships between outline sections.',
  icon: 'GitBranch',
  trigger: 'detection',

  requires: {},

  executor: 'prompt',
  prompt: {
    system: `You analyze a collaborative writing outline and find relationships between sections.

RELATIONSHIP TYPES with DIRECTION (from → to):
- "depends-on": FROM requires information/concepts that are defined in TO.
- "builds-upon": FROM extends or elaborates on ideas introduced in TO.
- "supports": FROM provides evidence or backing for claims in TO.
- "must-be-consistent": FROM and TO must not contradict each other. Direction doesn't matter.
- "contrasts-with": FROM presents a different perspective than TO. Direction doesn't matter.

RULES:
- Do NOT flag parent-child pairs already in the tree.
- Focus on CROSS-BRANCH relationships between different sections.
- Be selective: 3–6 suggestions for a typical outline.

Return JSON:
{
  "dependencies": [
    {
      "fromIntentId": "id of the FROM section",
      "toIntentId": "id of the TO section",
      "relationshipType": "depends-on" | "must-be-consistent" | "builds-upon" | "contrasts-with" | "supports",
      "label": "Depends on" | "Must be consistent" | "Builds upon" | "Contrasts with" | "Supports",
      "reason": "One sentence explanation",
      "direction": "bidirectional"
    }
  ]
}`,
    user: `## Outline
{{nodes}}`,
    temperature: 0.3,
  },

  outputSchema: {
    dependencies: "Array<{ fromIntentId, toIntentId, relationshipType, label, reason, direction }>",
  },

  ui: [],
  configFields: [],
  defaultConfig: {},
});
