// ─── Built-in Negotiate Protocols ───
//
// Three protocols spanning the range of team involvement:
// 1. Inform — immediate, notification only
// 2. Team Vote — structured voting with majority threshold
// 3. Discussion — open conversation, proposer closes
//
// All steps reference registered functions. No hardcoded UI.
// Actions use steps (which call functions), not effects.

import { registerCoordinationPath } from './protocol';

// ═══════════════════════════════════════════════════════
// 1. INFORM
// ═══════════════════════════════════════════════════════

registerCoordinationPath({
  id: 'decided',
  name: 'Inform',
  description: 'Notify affected people. Changes apply immediately.',
  icon: 'Bell',
  color: 'blue',

  functions: ['render-changes-summary', 'frame-proposal', 'apply-proposal'],

  propose: {
    who: 'proposer',
    steps: [
      // Step 1: Show what you changed
      { run: 'render-changes-summary' },
      // Step 2: Show who is affected
      { run: 'frame-proposal' },
      // Step 3: Reasoning input (text-input primitive rendered by useStepExecutor)
    ],
    actions: [
      { id: 'submit', label: 'Apply & Notify', gate: true },
      { id: 'cancel', label: 'Cancel', stop: true },
    ],
  },

  deliberate: {
    who: '{{config.notifyWho}}',
    steps: [
      { run: 'render-changes-summary' },
      { run: 'frame-proposal' },
    ],
    actions: [
      { id: 'acknowledge', label: 'Acknowledge',
        steps: [{ run: 'submit-vote', params: { vote: 'acknowledge' } }] },
    ],
  },

  resolve: {
    who: 'system',
    steps: [
      { run: 'apply-proposal' },
    ],
    actions: [
      { id: 'done', label: 'Done', stop: true },
    ],
  },

  config: {
    notifyWho: {
      default: 'impacted-owners',
      options: ['impacted-owners', 'all-members'],
      label: 'Who to notify',
    },
  },
});


// ═══════════════════════════════════════════════════════
// 2. TEAM VOTE
// ═══════════════════════════════════════════════════════

registerCoordinationPath({
  id: 'negotiate',
  name: 'Team Vote',
  description: 'The team votes on the proposed change.',
  icon: 'Vote',
  color: 'indigo',

  functions: ['render-changes-summary', 'frame-proposal', 'render-vote-progress',
              'render-vote-thread', 'submit-vote', 'apply-proposal', 'revert-proposal'],

  propose: {
    who: 'proposer',
    steps: [
      { run: 'render-changes-summary' },
      { run: 'frame-proposal' },
    ],
    actions: [
      { id: 'submit', label: 'Submit for Vote',
        steps: [{ run: 'apply-proposal' }] },
      { id: 'cancel', label: 'Cancel', stop: true },
    ],
  },

  deliberate: {
    who: '{{config.voters}}',
    steps: [
      { run: 'render-changes-summary' },
      { run: 'frame-proposal' },
      { run: 'render-vote-progress' },
      { run: 'render-vote-thread' },
    ],
    actions: [
      { id: 'approve', label: 'Approve',
        steps: [{ run: 'submit-vote', params: { vote: 'approve' } }] },
      { id: 'reject', label: 'Reject',
        steps: [{ run: 'submit-vote', params: { vote: 'reject' } }] },
    ],
  },

  resolve: {
    who: 'proposer',
    steps: [
      { run: 'render-vote-progress' },
      { run: 'render-vote-thread' },
    ],
    actions: [
      { id: 'close-approve', label: 'Apply Changes',
        who: ['proposer'],
        steps: [{ run: 'apply-proposal', params: { forceApply: 'true' } }] },
      { id: 'close-reject', label: 'Drop It',
        who: ['proposer'],
        steps: [{ run: 'revert-proposal' }] },
    ],
  },

  config: {
    voters: {
      default: 'impacted-owners',
      options: [
        { value: 'impacted-owners', label: 'Affected owners' },
        { value: 'all-members', label: 'Everyone' },
      ],
      label: 'Who votes',
    },
    resolutionFn: {
      default: 'check-majority',
      options: [
        { value: 'check-majority', label: 'Majority' },
        { value: 'check-unanimous', label: 'Unanimous' },
        { value: 'check-single-approval', label: 'Any one approves' },
      ],
      label: 'Resolution rule',
    },
  },
});


// ═══════════════════════════════════════════════════════
// 3. DISCUSSION
// ═══════════════════════════════════════════════════════

registerCoordinationPath({
  id: 'discussion',
  name: 'Discussion',
  description: 'Open conversation. Proposer wraps up when ready.',
  icon: 'MessagesSquare',
  color: 'amber',

  functions: ['render-changes-summary', 'frame-proposal', 'apply-proposal', 'revert-proposal',
              'render-vote-thread', 'submit-reply', 'submit-vote'],

  propose: {
    who: 'proposer',
    steps: [
      { run: 'render-changes-summary' },
      { run: 'frame-proposal' },
    ],
    actions: [
      { id: 'submit', label: 'Submit for Discussion',
        steps: [{ run: 'apply-proposal' }] },
      { id: 'cancel', label: 'Cancel', stop: true },
    ],
  },

  deliberate: {
    who: '{{config.participants}}',
    steps: [
      { run: 'render-changes-summary' },
      { run: 'frame-proposal' },
      { run: 'render-vote-thread' },
    ],
    actions: [
      { id: 'reply', label: 'Reply',
        steps: [{ run: 'submit-reply' }] },
      { id: 'acknowledge', label: 'Acknowledge',
        steps: [{ run: 'submit-vote', params: { vote: 'acknowledge' } }] },
    ],
  },

  resolve: {
    who: 'proposer',
    steps: [
      { run: 'render-vote-thread' },
    ],
    actions: [
      { id: 'close-approve', label: 'Apply Changes',
        who: ['proposer'],
        steps: [{ run: 'apply-proposal', params: { forceApply: 'true' } }] },
      { id: 'close-reject', label: 'Drop It',
        who: ['proposer'],
        steps: [{ run: 'revert-proposal' }] },
    ],
  },

  config: {
    participants: {
      default: 'impacted-owners',
      options: [
        { value: 'impacted-owners', label: 'Affected owners' },
        { value: 'all-members', label: 'Everyone' },
      ],
      label: 'Who participates',
    },
  },
});
