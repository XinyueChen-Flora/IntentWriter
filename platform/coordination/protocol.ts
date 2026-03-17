// ─── Coordination Path Protocol ───
//
// A coordination path defines HOW the team handles a proposed change.
// Each path is a plugin that declares:
//   1. What it is (metadata)
//   2. Who is involved and what roles they play
//   3. What actions each role can take
//   4. What the builder config looks like (schema)
//   5. How to determine when coordination is resolved
//
// Built-in paths: inform, input, discussion, vote, delegate
// Teams can create new paths by defining a CoordinationPathDefinition.

import type { ConfigField } from '@/lib/pipeline-protocol';

// ─── Roles ───

/** A role in the coordination process */
export type PathRole = {
  id: string;
  label: string;
  description: string;
  /** How to determine who fills this role */
  assignment:
    | 'proposer'            // the person who proposed the change
    | 'impacted-owners'     // owners of sections affected by the change
    | 'all-members'         // all team members
    | 'config-designated';  // designated in the builder config (e.g. "team lead")
};

// ─── Actions ───

/** An action a role can take during coordination */
export type PathAction = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** Which role(s) can use this action */
  availableTo: string[];   // role IDs
  /** Does this action count toward resolution? */
  effect:
    | 'approve'        // counts as approval
    | 'reject'         // counts as rejection
    | 'comment'        // no resolution effect, adds discussion
    | 'counter-propose' // proposes alternative (may restart process)
    | 'escalate'       // moves to a different coordination path
    | 'abstain'        // explicitly opts out of deciding
    | 'acknowledge';   // marks as seen, no vote weight
};

// ─── Resolution ───

/** How to determine when the coordination is complete */
export type ResolutionRule = {
  type:
    | 'immediate'        // resolved as soon as it's created (e.g. inform)
    | 'single-approval'  // one designated person approves
    | 'threshold'        // approval count meets threshold
    | 'proposer-closes'  // proposer decides when to close
    | 'timeout';         // resolves after deadline

  /** For 'threshold': what fraction of eligible voters must approve */
  thresholdOptions?: ('any' | 'majority' | 'all')[];
  /** Whether to allow configurable timeout */
  allowTimeout?: boolean;
  /** Default timeout behavior */
  defaultTimeoutAction?: 'approve' | 'reject' | 'escalate';
};

// ─── Path Definition ───

export type CoordinationPathDefinition = {
  /** Unique identifier for this path type */
  id: string;
  /** Display name */
  name: string;
  /** Short description for the builder */
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Color theme for UI (tailwind color name) */
  color: string;

  // ─── Participants ───
  /** Roles involved in this coordination process */
  roles: PathRole[];

  // ─── Actions ───
  /** Actions available during this coordination */
  actions: PathAction[];

  // ─── Resolution ───
  /** How this coordination resolves */
  resolution: ResolutionRule;

  // ─── Builder Config ───
  /** Config fields shown in the MetaRule builder (proposer-side + receiver-side) */
  configFields: ConfigField[];
  /** Default values for config fields */
  defaultConfig: Record<string, unknown>;

  // ─── UI Rendering Hints ───
  /** What the proposer sees when selecting this path */
  proposerSummary: string;
  /** Template for describing the receiver's experience. e.g. "{{designated}} will review and decide" */
  receiverSummary: string;
};

// ─── Registry ───

const _pathRegistry = new Map<string, CoordinationPathDefinition>();

export function registerCoordinationPath(definition: CoordinationPathDefinition): void {
  _pathRegistry.set(definition.id, definition);
}

export function getCoordinationPath(id: string): CoordinationPathDefinition | undefined {
  return _pathRegistry.get(id);
}

export function getAllCoordinationPaths(): CoordinationPathDefinition[] {
  return Array.from(_pathRegistry.values());
}

// ─── Runtime Helpers ───

/** Get the actions available to a specific role in a path */
export function getActionsForRole(pathId: string, roleId: string): PathAction[] {
  const path = getCoordinationPath(pathId);
  if (!path) return [];
  return path.actions.filter((a) => a.availableTo.includes(roleId));
}

/** Check if a resolution condition is met given current responses */
export function isResolved(
  pathId: string,
  config: Record<string, unknown>,
  responses: { action: string; userId: string }[],
  eligibleCount: number
): boolean {
  const path = getCoordinationPath(pathId);
  if (!path) return false;

  switch (path.resolution.type) {
    case 'immediate':
      return true;

    case 'single-approval':
      return responses.some((r) => r.action === 'approve');

    case 'threshold': {
      const threshold = (config.voteThreshold as string) ?? 'majority';
      const approvals = responses.filter((r) => r.action === 'approve').length;
      if (threshold === 'any') return approvals >= 1;
      if (threshold === 'majority') return approvals > eligibleCount / 2;
      if (threshold === 'all') return approvals >= eligibleCount;
      return false;
    }

    case 'proposer-closes':
      // Proposer must explicitly close it
      return responses.some((r) => r.action === 'approve');

    case 'timeout':
      // Handled externally by checking deadline
      return false;

    default:
      return false;
  }
}
