import { registerFunction } from '../protocol';

registerFunction({
  id: 'check-drift',
  name: 'Drift Detection',
  description: 'Compare writing against the outline to find drifts, missing content, and dependency issues.',
  icon: 'Eye',
  trigger: 'detection',

  requires: { writing: true, dependencies: false },

  executor: 'prompt',
  prompt: {
    system: `You analyze alignment between writing and outline, producing a UNIFIED array representing the IDEAL STATE of the outline after incorporating the writing.

## Goal
Create "alignedIntents" - a COMPLETE array showing how the outline SHOULD look:
1. All existing intents with their coverage status
2. NEW intents proposed for orphan content (sentences not fitting any existing intent)

The array represents the "perfect alignment state" - sorted by reading order (position).
EVERY sentence must belong to exactly one intent.

## Sentence Anchor Format
{ "start": "first ~10 words verbatim", "end": "last ~10 words verbatim" }

## Process

### Step 1: Map sentences to existing intents
For each sentence, determine which existing intent it supports.
Be generous - any connection to an intent's topic = supporting.

### Step 2: Identify orphan sentences and CREATE new intents
Sentences not supporting ANY existing intent are orphans.
For each orphan or group of related orphans, CREATE a new intent:
- Generate a concise intent description
- Assign a position based on where the sentences appear in the writing

### Step 3: Build alignedIntents array (SORTED BY POSITION)

Each entry:
{
  "id": "existing-id or new-1, new-2...",
  "content": "intent text (for new: generate a concise description)",
  "parentId": "parent-id or root-intent-id",
  "position": number,
  "intentStatus": "existing" | "new",
  "coverageStatus": "covered" | "partial" | "missing",
  "sentences": [{ "start": "...", "end": "..." }],
  "suggestedWriting": "for partial/missing only",
  "coverageNote": "for partial: what's missing (under 15 words)",
  "insertAfter": { "start": "...", "end": "..." }
}

## Overall Level
- "aligned": all existing covered, no new intents needed
- "partial": some missing/partial OR has new intents (orphans)
- "drifted": has conflicts

## Output Format
{
  "level": "aligned" | "partial" | "drifted",
  "alignedIntents": [...],
  "dependencyIssues": [],
  "crossSectionImpacts": [],
  "summary": "Overall analysis summary"
}`,
    user: `## Outline
{{nodes}}

## Writing
{{writing}}

## Dependencies
{{dependencies}}`,
    temperature: 0.2,
  },

  outputSchema: {
    level: "'aligned' | 'partial' | 'drifted'",
    alignedIntents: "Array<{ id, content, intentStatus, coverageStatus, sentences, coverageNote }>",
    dependencyIssues: "Array<{ relationship, severity, issue, localSentences, remoteSectionId }>",
    crossSectionImpacts: "Array<{ sectionId, sectionIntent, impactType, description }>",
    summary: "string",
  },

  ui: [
    {
      type: 'node-icon',
      forEach: 'alignedIntents',
      params: {
        nodeId: '{{item.id}}',
        status: '{{item.coverageStatus}}',
        tooltip: '{{item.coverageNote}}',
      },
    },
    {
      type: 'node-badge',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus !== "covered"',
      params: {
        nodeId: '{{item.id}}',
        label: '{{item.coverageStatus}}',
        variant: 'warning',
      },
    },
    {
      type: 'sentence-highlight',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus === "partial" && item.sentences.length > 0',
      params: {
        startAnchor: '{{item.sentences}}',
        color: 'yellow',
        tooltip: '{{item.coverageNote}}',
      },
    },
    {
      type: 'banner',
      when: 'level === "drifted"',
      params: {
        title: 'Drift detected',
        message: '{{summary}}',
        severity: 'warning',
      },
    },
    {
      type: 'result-list',
      forEach: 'crossSectionImpacts',
      params: {
        title: '{{item.sectionIntent}}',
        badge: '{{item.impactType}}',
        badgeVariant: 'warning',
        detail: '{{item.description}}',
      },
    },
  ],

  configFields: [
    {
      type: 'select', key: 'trigger', label: 'Trigger', layout: 'grid-2',
      options: [
        { value: 'manual', label: 'Writer decides', icon: 'User' },
        { value: 'auto', label: 'Automatic', icon: 'Sparkles' },
      ],
    },
  ],
  defaultConfig: { trigger: 'manual', displayMode: 'inline' },
});
