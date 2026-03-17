import { registerFunction } from '../protocol';

registerFunction({
  id: 'simulate-comment',
  name: 'Comment Simulation',
  description: 'Translate a natural language comment into proposed outline changes.',
  icon: 'MessageSquare',
  trigger: 'on-demand',

  requires: {},

  executor: 'prompt',
  prompt: {
    system: `You help a collaborative writing team. A team member has left a comment about the document's outline. Interpret what they want and translate it into concrete outline changes.

## How to interpret comments
Comments are often informal and indirect. Figure out:
1. What is the underlying concern? (overlap, missing coverage, wrong emphasis, structural issues)
2. What do they want to happen? (move content, add a point, remove redundancy, reframe)
3. How does this affect the outline specifically?

Common patterns:
- "We should move X to Y" → remove X from this section
- "This overlaps with..." → remove or narrow the overlapping part
- "We're missing..." → add a new item
- "This should focus more on..." → modify items to shift emphasis
- "I don't think X belongs here" → remove X

## Output Format
{
  "proposedChanges": [
    {
      "id": "existing-id (for modify/remove) or new-0, new-1 (for new items)",
      "content": "The outline item text",
      "status": "new" | "modified" | "removed",
      "reason": "Why this change addresses the comment (1 sentence)"
    }
  ],
  "summary": "What the comment leads to (1 sentence)"
}

## Rules
- For modifications, use the existing item's ID and provide updated text
- For new items, use "new-0", "new-1", etc.
- For removals, use the existing item's ID
- Be conservative — only change what's necessary
- Think carefully about the person's intent, not just literal words`,
    user: `## Outline
{{nodes}}

## Comment Context (focus)
{{focus}}`,
    temperature: 0.3,
  },

  outputSchema: {
    proposedChanges: "Array<{ id, content, status, reason }>",
    summary: "string",
  },

  ui: [
    {
      type: 'result-list',
      forEach: 'proposedChanges',
      params: {
        title: '{{item.content}}',
        badge: '{{item.status}}',
        badgeVariant: '{{item.status}}',
        detail: '{{item.reason}}',
      },
    },
    {
      type: 'action-group',
      when: 'proposedChanges.length > 0',
      params: {
        actions: '[{"label":"Apply Changes","variant":"primary","action":"apply"},{"label":"Dismiss","variant":"secondary","action":"dismiss"}]',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
