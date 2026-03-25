// ─── Expert Review Path (Example) ───
//
// Demonstrates registerCoordinationPath() for a custom path.
// This path routes proposals to a designated expert for review.

import {
  registerCoordinationPath,
  type CoordinationPathDefinition,
} from '../protocol';

export const EXPERT_REVIEW_PATH: CoordinationPathDefinition = {
  id: 'expert-review',
  name: 'Expert Review',
  description: 'Route to a designated expert. Expert decides with full context.',
  icon: 'GraduationCap',
  color: 'violet',

  functions: ['frame-proposal', 'assess-impact', 'preview-writing-impact', 'check-cross-consistency', 'preview-resolution-effect', 'check-single-approval', 'apply-proposal', 'revert-proposal'],

  propose: {
    who: 'proposer',
    steps: [
      { run: 'frame-proposal' },
      { run: 'assess-impact' },
    ],
  },

  deliberate: {
    who: '{{config.expertId}}',
    steps: [
      { run: 'preview-writing-impact' },
      { run: 'check-cross-consistency' },
    ],
    actions: [
      { id: 'approve', label: 'Approve', who: ['expert'] },
      { id: 'reject', label: 'Reject', who: ['expert'] },
      { id: 'request-revision', label: 'Request Revision', who: ['expert'],
        steps: [
          { run: 'render-draft' },
          { run: 'assess-impact' },
        ] },
      { id: 'comment', label: 'Comment', who: ['observer', 'proposer'] },
    ],
  },

  resolve: {
    who: 'system',
    steps: [
      { run: 'check-single-approval' },
      { run: 'preview-resolution-effect' },
    ],
    actions: [
      { id: 'apply', label: 'Apply Changes',
        steps: [{ run: 'apply-proposal' }] },
      { id: 'revert', label: 'Revert',
        steps: [{ run: 'revert-proposal' }] },
    ],
  },

  config: {
    expertId: {
      type: 'select',
      label: 'Designated expert',
      options: [], // Populated dynamically at runtime
    },
    allowObserverEscalation: {
      type: 'toggle' as string,
      label: 'Allow observers to escalate',
      default: true,
    },
  },
};

// Auto-register on import
registerCoordinationPath(EXPERT_REVIEW_PATH);
