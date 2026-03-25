import { registerFunction } from '../protocol';

registerFunction({
  id: 'preview-resolution-effect',
  name: 'Resolution Effect Preview',
  description: 'Preview the post-resolution state of the document after a proposal is applied.',
  icon: 'Eye',
  trigger: 'post-resolve',
  target: { type: 'section', description: 'Shows what the document looks like after applying a proposal' },
  category: 'proposing',
  triggerOptions: [{ value: 'auto', label: 'Automatic before resolution' }],
  defaultTrigger: 'auto',
  dependsOn: ['preview-writing-impact'],

  requires: { writing: true },

  executor: 'prompt',
  prompt: {
    system: `You preview what a document section will look like AFTER a proposed change is fully resolved and applied.

Given the current outline, writing, and proposed changes:
1. Show the final outline state (with changes applied)
2. Show the final writing state (with necessary text adjustments)
3. Flag any remaining inconsistencies that would need manual attention

Return JSON:
{
  "resolvedOutline": [
    { "id": "...", "content": "intent text", "status": "unchanged" | "added" | "modified" }
  ],
  "resolvedWriting": "The full text after applying all changes",
  "remainingIssues": [
    { "type": "inconsistency" | "gap" | "overlap", "description": "..." }
  ],
  "summary": "One sentence describing the post-resolution state"
}`,
    user: `## Current Outline
{{nodes}}

## Current Writing
{{writing}}

## Proposed Changes (focus)
{{focus}}`,
    temperature: 0.2,
  },

  outputSchema: {
    resolvedOutline: "Array<{ id, content, status }>",
    resolvedWriting: "string",
    remainingIssues: "Array<{ type, description }>",
    summary: "string",
  },

  output: {
    type: 'ResolutionEffectResult',
    fields: {
      resolvedOutline: 'Array<ResolvedIntent>',
      resolvedWriting: 'string',
      remainingIssues: 'Array<Issue>',
      summary: 'string',
    },
  },

  ui: [
    {
      type: 'diff-view',
      params: {
        before: '{{summary}}',
        after: '{{resolvedWriting}}',
        mode: 'side-by-side',
      },
    },
    {
      type: 'result-list',
      forEach: 'remainingIssues',
      params: {
        title: '{{item.type}}',
        badge: 'needs attention',
        badgeVariant: 'warning',
        detail: '{{item.description}}',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
