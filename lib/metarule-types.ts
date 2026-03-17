// ─── MetaRule Type Definitions ───
// Defines the team-configurable governance pipeline for collaborative writing.
// The pipeline: Detection → Propose → Impact Preview → Gate → Coordination → Response → Resolution → Apply

// ─── Shared Types (reused from existing system) ───

export type CoordinationPath = 'decided' | 'input' | 'discussion' | 'negotiate';
export type VoteThreshold = 'any' | 'majority' | 'all';
export type NotifyLevel = 'skip' | 'heads-up' | 'notify';
export type ImpactLevel = 'none' | 'minor' | 'significant';

// ─── Pipeline Stage Configs ───

/** Step 1: Detection — what to monitor and how to display results */
export type DetectionCheckConfig = {
  type: 'drift' | 'dependency' | string; // extensible
  trigger: 'auto' | 'manual';
  autoFrequency?: 'per-paragraph' | 'per-minute';
  autoIntervalMinutes?: number;
  displayMode: 'severe-only' | 'inline' | 'summary';
};

export type DetectionConfig = {
  checks: DetectionCheckConfig[];
};

/** Step 3 (after auto impact preview): Gate — bypass conditions based on impact results */
export type GateConfig = {
  /** No cross-section impact → bypass coordination, apply directly */
  bypassWhenNoImpact: boolean;
  /** All impacts are minor → bypass coordination */
  bypassWhenAllMinor: boolean;
  /** Section owner can always self-resolve changes to their own section */
  ownerCanSelfResolve: boolean;
};

/** Step 4: Routing — map impact conditions to coordination paths */
export type RoutingRule = {
  condition: {
    impactLevel?: ImpactLevel;
    scope?: 'same-section' | 'cross-section';
  };
  path: CoordinationPath;
};

/** Step 4-6: Coordination path definitions
 *  Each path defines both proposer-side (how to frame) and receiver-side (what actions are available).
 */
export type DecidedPathConfig = {
  // Proposer side
  defaultNotifyLevel: NotifyLevel;
  // Receiver side
  receiverCanEscalate?: boolean;
  escalateTo?: 'discussion' | 'negotiate';
};

export type InputPathConfig = {
  // Proposer side
  routeTo: 'impacted-owners' | 'all-members';
  // Receiver side
  receiverActions?: 'approve-only' | 'approve-reject' | 'approve-suggest';
  noResponsePolicy?: 'wait' | 'auto-approve' | 'escalate';
  deadlineHours?: number;
};

export type DiscussionPathConfig = {
  // Proposer side
  participants: 'impacted-owners' | 'all-members';
  closedBy: 'proposer' | 'anyone' | 'consensus';
  // Receiver side
  receiverCanCounterPropose?: boolean;
  receiverCanEscalate?: boolean;
  noResponsePolicy?: 'wait' | 'auto-close' | 'auto-reject';
  deadlineHours?: number;
};

export type NegotiatePathConfig = {
  // Proposer side
  voteThreshold: VoteThreshold;
  voters: 'impacted-owners' | 'all-members';
  // Receiver side
  receiverCanCounterPropose?: boolean;
  noResponsePolicy?: 'wait' | 'count-as-approve' | 'count-as-abstain';
  deadlineHours?: number;
};

export type CoordinationConfig = {
  decided: DecidedPathConfig;
  input: InputPathConfig;
  discussion: DiscussionPathConfig;
  negotiate: NegotiatePathConfig;
};

/** Step 7: Apply — what happens after resolution */
export type ApplyConfig = {
  autoApplyOnApproval: boolean;
  autoGenerateWritingPreview: boolean;
};

// ─── Complete MetaRule Configuration ───

export type MetaRuleConfig = {
  version: 1;

  /** Step 1: Detection settings */
  detection: DetectionConfig;

  /** Step 3: Gate bypass conditions (evaluated after impact preview) */
  gate: GateConfig;

  /** Step 4: Routing rules — condition → coordination path */
  routing: RoutingRule[];

  /** Step 4-6: Per-path coordination settings */
  coordination: CoordinationConfig;

  /** Step 7: Apply settings */
  apply: ApplyConfig;

  /** Allow writers to override MetaRule defaults at proposal time */
  allowOverride: boolean;

  /** Metadata */
  updatedAt?: number;
  updatedBy?: string;
};

// ─── Default Configuration ───
// Matches current system behavior: manual choices, no auto-bypass, no auto-apply

export const DEFAULT_METARULE_CONFIG: MetaRuleConfig = {
  version: 1,

  detection: {
    checks: [
      {
        type: 'drift',
        trigger: 'manual',
        displayMode: 'inline',
      },
    ],
  },

  gate: {
    bypassWhenNoImpact: true,
    bypassWhenAllMinor: false,
    ownerCanSelfResolve: true,
  },

  routing: [
    { condition: { impactLevel: 'none' }, path: 'decided' },
    { condition: { impactLevel: 'minor' }, path: 'decided' },
    { condition: { impactLevel: 'significant' }, path: 'negotiate' },
  ],

  coordination: {
    decided: {
      defaultNotifyLevel: 'heads-up',
    },
    input: {
      routeTo: 'impacted-owners',
    },
    discussion: {
      participants: 'impacted-owners',
      closedBy: 'proposer',
    },
    negotiate: {
      voteThreshold: 'majority',
      voters: 'impacted-owners',
    },
  },

  apply: {
    autoApplyOnApproval: false,
    autoGenerateWritingPreview: true,
  },

  allowOverride: true,
};

// ─── Helper: resolve routing ───

export function resolveCoordinationPath(
  config: MetaRuleConfig,
  maxImpactLevel: ImpactLevel,
  scope: 'same-section' | 'cross-section'
): CoordinationPath {
  // Find first matching routing rule
  for (const rule of config.routing) {
    const levelMatch =
      !rule.condition.impactLevel || rule.condition.impactLevel === maxImpactLevel;
    const scopeMatch = !rule.condition.scope || rule.condition.scope === scope;
    if (levelMatch && scopeMatch) {
      return rule.path;
    }
  }
  // Fallback
  return 'decided';
}

export function shouldBypassGate(
  config: MetaRuleConfig,
  maxImpactLevel: ImpactLevel,
  hasCrossSectionImpact: boolean,
  isOwner: boolean
): boolean {
  if (config.gate.bypassWhenNoImpact && !hasCrossSectionImpact) {
    return true;
  }
  if (config.gate.bypassWhenAllMinor && maxImpactLevel !== 'significant') {
    return true;
  }
  if (config.gate.ownerCanSelfResolve && isOwner && !hasCrossSectionImpact) {
    return true;
  }
  return false;
}
