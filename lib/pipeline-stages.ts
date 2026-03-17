// ─── Built-in Pipeline Stages ───
// Each stage is a plugin registered against the pipeline protocol.
// The MetaRuleBuilder renders all config UI from these declarations.
// To add a new stage: define it here and call registerStage().

import {
  registerStage,
  createStageInstance,
  type StageDefinition,
  type StageInstance,
  type Pipeline,
} from './pipeline-protocol';

// ─── 1. Drift Detection ───

export const DRIFT_DETECTION: StageDefinition = {
  id: 'drift-detection',
  name: 'Drift Detection',
  description: 'Compare writing against the outline to find drifts, missing content, and dependency issues.',
  icon: 'Eye',
  category: 'awareness',

  question: 'When should AI check your writing?',
  hint: 'Detection compares your writing against the outline to find drifts, missing content, and dependency issues.',

  fields: [
    {
      type: 'select',
      key: 'trigger',
      label: 'Trigger',
      layout: 'grid-2',
      options: [
        { value: 'manual', label: 'Writer decides', description: 'Each writer triggers detection when they want feedback', tag: 'More autonomy', icon: 'User' },
        { value: 'auto', label: 'Automatic', description: 'System runs detection periodically while writing', tag: 'More awareness', icon: 'Sparkles' },
      ],
    },
    {
      type: 'conditional',
      when: { field: 'trigger', value: 'auto' },
      fields: [
        {
          type: 'select',
          key: 'autoFrequency',
          label: 'How often?',
          layout: 'grid-2',
          options: [
            { value: 'per-paragraph', label: 'After each paragraph', description: 'Checks when you pause between paragraphs' },
            { value: 'per-minute', label: 'On a timer', description: 'Runs every few minutes' },
          ],
        },
        {
          type: 'conditional',
          when: { field: 'autoFrequency', value: 'per-minute' },
          fields: [
            { type: 'number', key: 'autoIntervalMinutes', label: 'Interval', min: 1, max: 30, unit: 'minutes', prefix: 'Every' },
          ],
        },
      ],
    },
    {
      type: 'select',
      key: 'displayMode',
      label: 'How should detection results appear?',
      description: 'Think about how much information helps vs. distracts.',
      layout: 'stack',
      options: [
        { value: 'inline', label: 'Show everything inline', description: 'All detection results appear next to the relevant text.', tag: 'Full transparency', icon: 'Eye' },
        { value: 'summary', label: 'Summary panel', description: 'A compact overview. Writers dig in when they want details.', tag: 'Less noise', icon: 'CircleDot' },
        { value: 'severe-only', label: 'Only significant issues', description: 'Minor drifts are hidden. Only important results shown.', tag: 'Minimal interruption', icon: 'ShieldCheck' },
      ],
    },
  ],

  defaultConfig: {
    trigger: 'manual',
    autoFrequency: 'per-paragraph',
    autoIntervalMinutes: 5,
    displayMode: 'inline',
  },

  flow: {
    summaryTemplate: '{{trigger}} trigger · {{displayMode}} display',
  },
};

// ─── 2. Impact Preview (automatic, minimal config) ───

export const IMPACT_PREVIEW: StageDefinition = {
  id: 'impact-preview',
  name: 'Impact Preview',
  description: 'AI analyzes how a proposed change affects other sections.',
  icon: 'Sparkles',
  category: 'analysis',

  question: 'How should impact analysis work?',
  hint: 'After a writer proposes a change, the system automatically analyzes how it affects other sections.',

  fields: [
    {
      type: 'toggle',
      key: 'showWritingPreview',
      label: 'Show writing preview',
      description: 'Generate a before/after preview of how each affected section\'s writing would change.',
      consequence: {
        on: 'Writers see exactly how their change would affect other sections\' text.',
        off: 'Only show which sections are affected and why, not the text-level diff.',
      },
    },
    {
      type: 'toggle',
      key: 'autoForSignificant',
      label: 'Auto-expand for significant impacts',
      description: 'Automatically show full impact details when significant changes are detected.',
      consequence: {
        on: 'Significant impacts are immediately visible — writers can\'t miss them.',
        off: 'All impact details start collapsed. Writers expand them manually.',
      },
    },
  ],

  defaultConfig: {
    showWritingPreview: true,
    autoForSignificant: true,
  },

  flow: {
    isAutomatic: true,
    summaryTemplate: '{{showWritingPreview}} writing preview',
  },
};

// ─── 3. Gate ───

export const GATE: StageDefinition = {
  id: 'gate',
  name: 'Gate Check',
  description: 'Determine which changes can skip team coordination.',
  icon: 'GitBranch',
  category: 'gate',

  question: 'What can skip team coordination?',
  hint: 'After the system shows a change\'s impact, some changes might not need the whole team involved. Which ones?',

  fields: [
    {
      type: 'toggle',
      key: 'bypassWhenNoImpact',
      label: 'Changes with no cross-section impact',
      description: 'If a change only affects the writer\'s own section and nothing else, apply it directly.',
      consequence: {
        on: 'Writers can freely change their own section as long as it doesn\'t affect others.',
        off: 'Even self-contained changes go through team coordination.',
      },
    },
    {
      type: 'toggle',
      key: 'bypassWhenAllMinor',
      label: 'Changes where all impacts are minor',
      description: 'If the change affects other sections but AI assesses all impacts as minor, skip coordination.',
      consequence: {
        on: 'Minor cross-section impacts are auto-resolved. Only significant impacts trigger coordination.',
        off: 'Any cross-section impact, even minor, requires team coordination.',
      },
    },
    {
      type: 'toggle',
      key: 'ownerCanSelfResolve',
      label: 'Section owners can self-resolve',
      description: 'The person assigned to a section can apply changes to their own section without team approval.',
      consequence: {
        on: 'Owners have autonomy over their sections for non-cross-section changes.',
        off: 'Even section owners need team approval for changes.',
      },
    },
  ],

  defaultConfig: {
    bypassWhenNoImpact: true,
    bypassWhenAllMinor: false,
    ownerCanSelfResolve: true,
  },

  flow: {
    canBranch: true,
    summaryTemplate: 'bypass: {{bypassWhenNoImpact}} no-impact, {{bypassWhenAllMinor}} all-minor',
  },
};

// ─── 4. Routing ───

export const ROUTING: StageDefinition = {
  id: 'routing',
  name: 'Coordination Routing',
  description: 'Map impact levels to coordination processes.',
  icon: 'ArrowRight',
  category: 'coordination',

  question: 'When coordination is needed, what process should the team follow?',
  hint: 'Different impact levels can use different coordination processes. A minor wording tweak probably doesn\'t need a vote, but restructuring an argument might.',

  fields: [
    {
      type: 'router',
      key: 'routes',
      label: 'Route by impact level',
      description: 'Assign a coordination process for each impact level.',
      conditions: [
        { value: 'minor', label: 'minor impact', badgeVariant: 'secondary' },
        { value: 'significant', label: 'significant impact', badgeVariant: 'destructive' },
      ],
      paths: [
        { value: 'decided', label: 'Just inform', description: 'Notify affected people, no approval needed', icon: 'Bell' },
        { value: 'input', label: 'Ask for input', description: 'Get feedback from affected section owners', icon: 'MessageSquare' },
        { value: 'discussion', label: 'Open discussion', description: 'Discuss as a group, then proposer decides', icon: 'Users' },
        { value: 'negotiate', label: 'Team vote', description: 'The team votes, threshold determines outcome', icon: 'Vote' },
      ],
    },
    // ─── Path-specific settings ───
    // Each path defines BOTH the proposer side (who to involve, how to frame)
    // and the receiver side (what actions are available, deadlines, escalation).

    // — Inform (decided) —
    {
      type: 'path-settings',
      pathKey: 'routes',
      pathValue: 'decided',
      label: 'Inform',
      icon: 'Bell',
      fields: [
        // Proposer side
        {
          type: 'segment',
          key: 'decided.notifyLevel',
          label: 'Notification level',
          options: [
            { value: 'skip', label: 'Silent' },
            { value: 'heads-up', label: 'Heads-up' },
            { value: 'notify', label: 'Notify' },
          ],
        },
        // Receiver side
        {
          type: 'toggle',
          key: 'decided.receiverCanEscalate',
          label: 'Receiver can escalate',
          description: 'If a receiver disagrees with an inform-only change, can they escalate it to a higher coordination path?',
          consequence: {
            on: 'Receivers can push an informed change into discussion or vote if they disagree.',
            off: 'Informed changes are final. Receivers can only acknowledge.',
          },
        },
        {
          type: 'conditional',
          when: { field: 'decided.receiverCanEscalate', value: true },
          fields: [
            {
              type: 'segment',
              key: 'decided.escalateTo',
              label: 'Escalate to',
              options: [
                { value: 'discussion', label: 'Discussion' },
                { value: 'negotiate', label: 'Vote' },
              ],
            },
          ],
        },
      ],
    },

    // — Input —
    {
      type: 'path-settings',
      pathKey: 'routes',
      pathValue: 'input',
      label: 'Input',
      icon: 'MessageSquare',
      fields: [
        // Proposer side
        {
          type: 'segment',
          key: 'input.routeTo',
          label: 'Ask who',
          options: [
            { value: 'impacted-owners', label: 'Affected owners' },
            { value: 'all-members', label: 'Everyone' },
          ],
        },
        // Receiver side
        {
          type: 'segment',
          key: 'input.receiverActions',
          label: 'Receiver can',
          options: [
            { value: 'approve-only', label: 'Approve or comment' },
            { value: 'approve-reject', label: 'Approve, reject, or comment' },
            { value: 'approve-suggest', label: 'Approve, suggest changes, or reject' },
          ],
        },
        {
          type: 'segment',
          key: 'input.noResponsePolicy',
          label: 'If no response',
          options: [
            { value: 'wait', label: 'Wait indefinitely' },
            { value: 'auto-approve', label: 'Auto-approve after deadline' },
            { value: 'escalate', label: 'Escalate after deadline' },
          ],
        },
        {
          type: 'conditional',
          when: { field: 'input.noResponsePolicy', not: 'wait' },
          fields: [
            { type: 'number', key: 'input.deadlineHours', label: 'Deadline', min: 1, max: 168, unit: 'hours', prefix: 'After' },
          ],
        },
      ],
    },

    // — Discussion —
    {
      type: 'path-settings',
      pathKey: 'routes',
      pathValue: 'discussion',
      label: 'Discussion',
      icon: 'Users',
      fields: [
        // Proposer side
        {
          type: 'segment',
          key: 'discussion.participants',
          label: 'Who participates',
          options: [
            { value: 'impacted-owners', label: 'Affected owners' },
            { value: 'all-members', label: 'Everyone' },
          ],
        },
        {
          type: 'segment',
          key: 'discussion.closedBy',
          label: 'Who can close',
          options: [
            { value: 'proposer', label: 'Proposer' },
            { value: 'anyone', label: 'Anyone' },
            { value: 'consensus', label: 'Consensus' },
          ],
        },
        // Receiver side
        {
          type: 'toggle',
          key: 'discussion.receiverCanCounterPropose',
          label: 'Receiver can counter-propose',
          description: 'Participants can propose an alternative change instead of just commenting.',
          consequence: {
            on: 'Discussion may produce alternative proposals. The closer picks which to adopt.',
            off: 'Participants can only comment. The original proposal is the only option.',
          },
        },
        {
          type: 'toggle',
          key: 'discussion.receiverCanEscalate',
          label: 'Receiver can escalate to vote',
          description: 'If discussion stalls, any participant can push it to a formal vote.',
          consequence: {
            on: 'Deadlocked discussions can be resolved by voting.',
            off: 'Discussion must be resolved by the designated closer.',
          },
        },
        {
          type: 'segment',
          key: 'discussion.noResponsePolicy',
          label: 'If no one responds',
          options: [
            { value: 'wait', label: 'Wait indefinitely' },
            { value: 'auto-close', label: 'Auto-close (approve)' },
            { value: 'auto-reject', label: 'Auto-close (reject)' },
          ],
        },
        {
          type: 'conditional',
          when: { field: 'discussion.noResponsePolicy', not: 'wait' },
          fields: [
            { type: 'number', key: 'discussion.deadlineHours', label: 'Deadline', min: 1, max: 168, unit: 'hours', prefix: 'After' },
          ],
        },
      ],
    },

    // — Vote (negotiate) —
    {
      type: 'path-settings',
      pathKey: 'routes',
      pathValue: 'negotiate',
      label: 'Vote',
      icon: 'Vote',
      fields: [
        // Proposer side
        {
          type: 'segment',
          key: 'negotiate.voteThreshold',
          label: 'Approval threshold',
          options: [
            { value: 'any', label: 'Any one' },
            { value: 'majority', label: 'Majority' },
            { value: 'all', label: 'Unanimous' },
          ],
        },
        {
          type: 'segment',
          key: 'negotiate.voters',
          label: 'Who votes',
          options: [
            { value: 'impacted-owners', label: 'Affected owners' },
            { value: 'all-members', label: 'Everyone' },
          ],
        },
        // Receiver side
        {
          type: 'toggle',
          key: 'negotiate.receiverCanCounterPropose',
          label: 'Voter can counter-propose',
          description: 'When rejecting, a voter can attach an alternative proposal.',
          consequence: {
            on: 'Rejected votes may include alternatives. If threshold fails, the best alternative can be re-voted.',
            off: 'Voters can only approve or reject. A failed vote requires the proposer to submit a new one.',
          },
        },
        {
          type: 'segment',
          key: 'negotiate.noResponsePolicy',
          label: 'If someone doesn\'t vote',
          options: [
            { value: 'wait', label: 'Wait indefinitely' },
            { value: 'count-as-approve', label: 'Count as approve' },
            { value: 'count-as-abstain', label: 'Count as abstain' },
          ],
        },
        {
          type: 'conditional',
          when: { field: 'negotiate.noResponsePolicy', not: 'wait' },
          fields: [
            { type: 'number', key: 'negotiate.deadlineHours', label: 'Deadline', min: 1, max: 168, unit: 'hours', prefix: 'After' },
          ],
        },
      ],
    },
  ],

  defaultConfig: {
    'routes': { minor: 'decided', significant: 'negotiate' },
    // Inform
    'decided.notifyLevel': 'heads-up',
    'decided.receiverCanEscalate': true,
    'decided.escalateTo': 'discussion',
    // Input
    'input.routeTo': 'impacted-owners',
    'input.receiverActions': 'approve-suggest',
    'input.noResponsePolicy': 'auto-approve',
    'input.deadlineHours': 48,
    // Discussion
    'discussion.participants': 'impacted-owners',
    'discussion.closedBy': 'proposer',
    'discussion.receiverCanCounterPropose': true,
    'discussion.receiverCanEscalate': true,
    'discussion.noResponsePolicy': 'wait',
    'discussion.deadlineHours': 72,
    // Vote
    'negotiate.voteThreshold': 'majority',
    'negotiate.voters': 'impacted-owners',
    'negotiate.receiverCanCounterPropose': false,
    'negotiate.noResponsePolicy': 'count-as-abstain',
    'negotiate.deadlineHours': 48,
  },

  flow: {
    canBranch: true,
  },
};

// ─── 5. Apply ───

export const APPLY: StageDefinition = {
  id: 'apply',
  name: 'Resolution & Apply',
  description: 'What happens after the team reaches a decision.',
  icon: 'CheckCircle2',
  category: 'action',

  question: 'What happens after coordination resolves?',
  hint: 'Once the team has responded, how should the change be applied?',

  fields: [
    {
      type: 'toggle',
      key: 'autoApplyOnApproval',
      label: 'Auto-apply on approval',
      description: 'Automatically apply the change to the outline when it\'s approved.',
      consequence: {
        on: 'Approved changes take effect immediately without manual steps.',
        off: 'The proposer must manually apply the change after it\'s approved.',
      },
    },
    {
      type: 'toggle',
      key: 'autoGenerateWritingPreview',
      label: 'Generate writing preview',
      description: 'After outline changes, show a preview of how the writing should be updated.',
      consequence: {
        on: 'Writers see suggested writing updates based on the new outline.',
        off: 'Writers update their writing on their own after outline changes.',
      },
    },
  ],

  defaultConfig: {
    autoApplyOnApproval: false,
    autoGenerateWritingPreview: true,
  },

  flow: {
    summaryTemplate: '{{autoApplyOnApproval}} auto-apply',
  },
};

// ─── Fixed stages (not configurable, but appear in the flow) ───

export const WRITER_PROPOSES: StageDefinition = {
  id: 'writer-proposes',
  name: 'Writer Proposes Change',
  description: 'The writer identifies an issue and proposes a change to the outline.',
  icon: 'Zap',
  category: 'action',

  question: '',
  hint: '',
  fields: [],
  defaultConfig: {},

  flow: {
    isDecisionPoint: true,
  },
};

export const TEAM_RESPONDS: StageDefinition = {
  id: 'team-responds',
  name: 'Team Responds',
  description: 'Team members respond to the proposal according to the coordination path.',
  icon: 'Users',
  category: 'coordination',

  question: '',
  hint: '',
  fields: [],
  defaultConfig: {},

  flow: {
    isDecisionPoint: true,
  },
};

// ─── Register all built-in stages ───

export function registerBuiltinStages(): void {
  registerStage(DRIFT_DETECTION);
  registerStage(IMPACT_PREVIEW);
  registerStage(GATE);
  registerStage(ROUTING);
  registerStage(APPLY);
  registerStage(WRITER_PROPOSES);
  registerStage(TEAM_RESPONDS);
}

// ─── Default Pipeline ───

export function createDefaultPipeline(): Pipeline {
  return {
    version: 1,
    stages: [
      createStageInstance(DRIFT_DETECTION),
      createStageInstance(WRITER_PROPOSES),
      createStageInstance(IMPACT_PREVIEW),
      createStageInstance(GATE),
      createStageInstance(ROUTING),
      createStageInstance(TEAM_RESPONDS),
      createStageInstance(APPLY),
    ],
    allowOverride: true,
  };
}

// Auto-register on import
registerBuiltinStages();
