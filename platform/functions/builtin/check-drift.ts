import { registerFunction } from '../protocol';

registerFunction({
  id: 'check-drift',
  name: 'Drift Detection',
  description: 'Compare writing against the outline to find drifts, missing content, and dependency issues.',
  icon: 'Eye',
  trigger: 'detection',
  target: { type: 'section', description: 'Checks alignment between writing and intents for a section' },
  category: 'writing',
  triggerOptions: [
    { value: 'paragraph-end', label: 'After each paragraph' },
    { value: 'manual', label: 'Manual check button' },
    { value: 'pause', label: 'After writing pause', config: { debounce: 10000 } },
    { value: 'interval', label: 'Periodic check', config: { interval: 300000 } },
  ],
  defaultTrigger: 'paragraph-end',
  options: [
    {
      key: 'trigger', label: 'When to check', type: 'select',
      choices: [
        { value: 'paragraph-end', label: 'After each paragraph' },
        { value: 'manual', label: 'Manual only' },
        { value: 'pause', label: 'After pause (10s)' },
        { value: 'interval', label: 'Every 5 minutes' },
      ],
      default: 'paragraph-end',
    },
  ],

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
  "coverageNote": "SPECIFIC description of the gap. For partial: what EXACTLY is not yet covered (e.g., 'Missing discussion of X' or 'Needs examples of Y'). For missing: what content is needed (e.g., 'Write about Z'). Be concrete, not vague.",
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
    user: `## Full Document Outline
{{nodes}}

## Writing Content
{{writing}}

## Dependencies
{{dependencies}}

## Focus Section
{{focus}}

IMPORTANT: Only analyze the section identified in Focus. Compare ONLY that section's intents against ONLY that section's writing. Do NOT include intents or analysis from other sections. The alignedIntents array should ONLY contain intents that belong to the focused section.`,
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
    // ═══ OUTLINE VIEW: coverage icons on each intent node ═══
    {
      type: 'node-icon',
      forEach: 'alignedIntents',
      params: {
        nodeId: '{{item.id}}',
        status: '{{item.coverageStatus}}',
        tooltip: '{{item.coverageNote}}',
      },
    },

    // ═══ WRITING VIEW: sentence highlights for partial coverage ═══
    {
      type: 'sentence-highlight',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus === "partial" && item.sentences && item.sentences.length > 0',
      params: {
        startAnchor: '{{item.sentences}}',
        color: 'yellow',
        tooltip: '{{item.coverageNote}}',
      },
    },
    // ═══ WRITING VIEW: sentence highlights for covered ═══
    {
      type: 'sentence-highlight',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus === "covered" && item.sentences && item.sentences.length > 0',
      params: {
        startAnchor: '{{item.sentences}}',
        color: 'green',
        tooltip: '{{item.content}}',
      },
    },
    // ═══ WRITING VIEW: issue dots for missing intents ═══
    {
      type: 'issue-dot',
      forEach: 'alignedIntents',
      filter: 'item.intentStatus === "existing" && item.coverageStatus === "missing"',
      params: {
        type: 'missing',
        detail: '{{item.content}}',
        anchor: '{{item.insertAfter}}',
      },
    },
    // ═══ WRITING VIEW: issue dots for orphan content ═══
    {
      type: 'issue-dot',
      forEach: 'alignedIntents',
      filter: 'item.intentStatus === "new" && item.sentences && item.sentences.length > 0',
      params: {
        type: 'orphan',
        detail: '{{item.content}}',
        anchor: '{{item.sentences}}',
      },
    },

    // ═══ PANEL: Summary ═══
    {
      type: 'banner',
      when: 'level !== "aligned"',
      params: {
        title: 'Drift Summary',
        message: '{{summary}}',
        severity: '{{level === "drifted" ? "warning" : "info"}}',
      },
    },

    // ═══ PANEL: Partial/Missing intents — with Change Outline / Change Writing actions ═══
    {
      type: 'result-list',
      forEach: 'alignedIntents',
      filter: 'item.intentStatus === "existing" && item.coverageStatus === "partial"',
      params: {
        title: '{{item.content}}',
        badge: 'partial',
        badgeVariant: 'warning',
        detail: '{{item.coverageNote}}',
        actions: JSON.stringify([
          { label: 'Change Writing', action: 'sense:drift-impact-preview:writing', variant: 'default' },
          { label: 'Change Outline', action: 'sense:drift-impact-preview:intent', variant: 'default' },
        ]),
      },
    },
    {
      type: 'result-list',
      forEach: 'alignedIntents',
      filter: 'item.intentStatus === "existing" && item.coverageStatus === "missing"',
      params: {
        title: '{{item.content}}',
        badge: 'missing',
        badgeVariant: 'warning',
        detail: '{{item.coverageNote}}',
        actions: JSON.stringify([
          { label: 'Change Writing', action: 'sense:drift-impact-preview:writing', variant: 'default' },
          { label: 'Change Outline', action: 'sense:drift-impact-preview:intent', variant: 'default' },
        ]),
      },
    },

    // ═══ PANEL: Orphan content (new intents) — with Add to Outline action ═══
    {
      type: 'result-list',
      forEach: 'alignedIntents',
      filter: 'item.intentStatus === "new"',
      params: {
        title: '{{item.content}}',
        badge: 'orphan',
        badgeVariant: 'new',
        detail: 'Writing content not in the outline',
        actions: JSON.stringify([
          { label: 'Add to Outline', action: 'add-to-outline', variant: 'primary' },
          { label: 'Dismiss', action: 'dismiss', variant: 'default' },
        ]),
      },
    },

  ],

  configFields: [],
  defaultConfig: { trigger: 'manual', displayMode: 'inline' },
});
