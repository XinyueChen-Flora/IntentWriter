// ─── Built-in Sense Protocols ───
//
// Two protocols demonstrating different points in the design space:
// 1. Drift Impact Preview — branching steps, connects to Gate
// 2. Argument Consistency — ambient trigger, simple linear

import { registerSenseProtocol } from './protocol';
import '../functions/builtin';

// ═══════════════════════════════════════════════════════
// 1. DRIFT IMPACT PREVIEW
// ═══════════════════════════════════════════════════════
// Has my writing drifted? If so:
//   Branch A: help me fix my writing (personal, no Gate)
//   Branch B: explore how changing the outline would affect others → Gate

registerSenseProtocol({
  id: 'drift-impact-preview',
  name: 'Drift Impact Preview',
  description: 'Detects drift, then lets you fix writing or explore outline change impact.',
  icon: 'Eye',

  functions: ['check-drift', 'generate-gap-suggestion', 'assess-impact', 'preview-writing-impact'],

  steps: [
    // Step 1: Detect drift
    { run: 'check-drift',
      params: { focus: '{{config.focusPrompt}}' } },

    // If drift detected, user chooses direction
    { actions: [
        { label: 'Change Writing', goto: 'change-writing' },
        { label: 'Change Outline', goto: 'change-outline' },
      ],
      when: 'check-drift.drift != "none"' },

    // ── Branch A: Change Writing (stays in personal space) ──
    { id: 'change-writing',
      run: 'generate-gap-suggestion',
      params: { action: 'writing' } },
    { actions: [
        { label: 'Dismiss', stop: true },
      ] },

    // ── Branch B: Change Outline (may escalate via Gate) ──
    // First: show what the outline change would look like
    { id: 'change-outline',
      run: 'generate-gap-suggestion',
      params: { action: 'intent' } },
    // Then: assess impact of this change on other sections
    { actions: [
        { label: 'Assess impact on others', continue: true },
        { label: 'Propose Change', gate: true },  // ← exits to Gate
        { label: 'Dismiss', stop: true },
      ] },
    { run: 'assess-impact',
      dispatch: { type: 'cross-section', collection: 'impacts', sectionField: 'sectionId' } },
    { actions: [
        { label: 'Preview writing impact', continue: true },
        { label: 'Propose Change', gate: true },  // ← exits to Gate
        { label: 'Dismiss', stop: true },
      ] },
    { run: 'preview-writing-impact' },
    { actions: [
        { label: 'Propose Change', gate: true },  // ← exits to Gate
      ] },
  ],

  triggerOptions: [
    { value: 'per-paragraph', label: 'After each paragraph' },
    { value: 'manual', label: 'Manual only' },
    { value: 'interval', label: 'Every few minutes', config: { intervalMinutes: 5 } },
  ],
  defaultTrigger: 'manual',

  configFields: [
    { key: 'focusPrompt', label: 'What should the checker focus on?',
      type: 'text', description: 'Injected into the AI prompt',
      default: '' },
    { key: 'intervalMinutes', label: 'Interval (minutes)',
      type: 'number', description: 'Used when trigger = every few minutes',
      default: 5, showWhenTrigger: ['interval'] },
  ],
  defaultConfig: { focusPrompt: '', intervalMinutes: 5 },

  ui: [
    { type: 'action-group',
      params: { actions: JSON.stringify([
        { label: 'Check Drift', action: 'sense:drift-impact-preview', variant: 'default' }
      ]) } },
    { type: 'summary-bar',
      when: 'check-drift.level',
      params: { level: '{{check-drift.level}}', counts: '{{check-drift.coverageCounts}}' } },
  ],
});


// ═══════════════════════════════════════════════════════
// 2. ARGUMENT CONSISTENCY CHECK
// ═══════════════════════════════════════════════════════
// Ambient: periodically checks argument consistency with dependent sections.
// No Gate — purely informational.

registerSenseProtocol({
  id: 'argument-consistency',
  name: 'Argument Consistency',
  description: 'Checks whether your arguments are consistent with dependent sections.',
  icon: 'GitBranch',

  functions: ['check-cross-consistency'],

  steps: [
    { run: 'check-cross-consistency' },
  ],

  triggerOptions: [
    { value: 'interval', label: 'Every few minutes', config: { intervalMinutes: 3 } },
    { value: 'manual', label: 'Manual only' },
  ],
  defaultTrigger: 'interval',

  configFields: [
    { key: 'intervalMinutes', label: 'Interval (minutes)',
      type: 'number', description: 'Used when trigger = every few minutes',
      default: 3, showWhenTrigger: ['interval'] },
  ],
  defaultConfig: { intervalMinutes: 3 },

  ui: [
    { type: 'action-group',
      params: { actions: JSON.stringify([
        { label: 'Check Consistency', action: 'sense:argument-consistency', variant: 'default' }
      ]) } },
  ],
});

// ═══════════════════════════════════════════════════════
// 3. SECTION WORD GUARD
// ═══════════════════════════════════════════════════════

registerSenseProtocol({
  id: 'section-word-guard',
  name: 'Section Word Limit',
  description: 'Counts words per section and warns when a section exceeds the configured limit.',
  icon: 'Ruler',

  functions: ['section-word-limit'],

  steps: [
    { run: 'section-word-limit' },
  ],

  triggerOptions: [
    { value: 'manual', label: 'Manual only' },
    { value: 'interval', label: 'Every few minutes', config: { intervalMinutes: 10 } },
  ],
  defaultTrigger: 'manual',

  configFields: [
    { key: 'limit', label: 'Word limit per section',
      type: 'number', description: 'Sections above this count are flagged',
      default: 500 },
    { key: 'intervalMinutes', label: 'Interval (minutes)',
      type: 'number', description: 'Used when trigger = every few minutes',
      default: 10, showWhenTrigger: ['interval'] },
  ],
  defaultConfig: { limit: 500, intervalMinutes: 10 },

  ui: [
    { type: 'action-group',
      params: { actions: JSON.stringify([
        { label: 'Check Section Word Count', action: 'sense:section-word-guard', variant: 'default' }
      ]) } },
  ],
});


// ═══════════════════════════════════════════════════════
// 3. PROPOSE OUTLINE CHANGE
// ═══════════════════════════════════════════════════════
// Direct entry from outline: edit intent → assess impact → preview → Gate.
// No drift check needed — user already knows what they want to change.

registerSenseProtocol({
  id: 'propose-outline-change',
  name: 'Propose Outline Change',
  description: 'Edit an intent, assess its impact on other sections, and propose the change to the team.',
  icon: 'FileEdit',

  functions: ['render-draft', 'assess-impact', 'preview-writing-impact'],

  steps: [
    // Step 1: Show editable draft of current intents
    { run: 'render-draft' },
    { actions: [
        { label: 'Assess impact on others', continue: true },
        { label: 'Propose Change', gate: true },
        { label: 'Cancel', stop: true },
      ] },

    // Step 2: Assess impact
    { run: 'assess-impact' },
    { actions: [
        { label: 'Preview writing impact', continue: true },
        { label: 'Propose Change', gate: true },
        { label: 'Cancel', stop: true },
      ] },

    // Step 3: Preview writing impact
    { run: 'preview-writing-impact' },
    { actions: [
        { label: 'Propose Change', gate: true },
      ] },
  ],

  triggerOptions: [
    { value: 'manual', label: 'On demand' },
  ],
  defaultTrigger: 'manual',

  // Action button rendered on each outline intent node
  ui: [
    { type: 'action-group',
      location: 'outline-node',
      params: { actions: JSON.stringify([
        { label: 'Propose Change', action: 'sense:propose-outline-change:intent', variant: 'default', icon: 'Pencil' }
      ]) } },
  ],
});


export { getAllSenseProtocols, getSenseProtocol } from './protocol';
