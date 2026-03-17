// ─── Coordination Engine ───
//
// Runtime resolution logic for coordination paths.
// This is the platform layer — it reads path definitions from the registry
// and applies the resolution rules generically. No hardcoded path knowledge.
//
// Contributors define paths in coordination-protocol.ts; this engine runs them.
//
// Usage:
//   import { checkResolution } from '@/lib/coordination-engine';
//   const result = checkResolution('negotiate', { voteThreshold: 'majority' }, votes, 5);
//   // result: 'approved' | 'rejected' | null

import { getCoordinationPath } from './protocol';

export type VoteRecord = {
  userId: string;
  action: string;      // matches PathAction.id — e.g. 'approve', 'reject', 'response'
  comment?: string | null;
};

/**
 * Check whether a coordination process has reached resolution.
 *
 * Returns:
 * - 'approved'  — resolution condition met positively
 * - 'rejected'  — resolution condition met negatively
 * - null        — not yet resolved, still pending
 *
 * The logic is driven entirely by the path's ResolutionRule type.
 * Path contributors only need to declare the rule; the engine handles the rest.
 */
export function checkResolution(
  pathId: string,
  pathConfig: Record<string, unknown>,
  votes: VoteRecord[],
  eligibleCount: number
): 'approved' | 'rejected' | null {
  const path = getCoordinationPath(pathId);
  if (!path) return null;

  const rule = path.resolution;

  switch (rule.type) {
    // ─── Immediate: resolved on creation (e.g. notify/inform) ───
    case 'immediate':
      return 'approved';

    // ─── Single Approval: first approve/reject from any eligible user ───
    case 'single-approval': {
      const decision = votes.find(
        (v) => v.action === 'approve' || v.action === 'reject'
      );
      if (!decision) return null;
      return decision.action === 'approve' ? 'approved' : 'rejected';
    }

    // ─── Threshold: count approvals vs rejections against threshold ───
    case 'threshold': {
      const threshold = (pathConfig.voteThreshold as string) ?? 'majority';
      const approvals = votes.filter((v) => v.action === 'approve').length;
      const rejections = votes.filter((v) => v.action === 'reject').length;

      if (threshold === 'any') {
        if (approvals >= 1) return 'approved';
        if (rejections >= 1) return 'rejected';
      } else if (threshold === 'majority') {
        const needed = Math.ceil(eligibleCount / 2);
        if (approvals >= needed) return 'approved';
        if (rejections >= needed) return 'rejected';
      } else if (threshold === 'all') {
        if (approvals >= eligibleCount) return 'approved';
        if (rejections >= 1) return 'rejected'; // any reject blocks unanimous
      }

      return null;
    }

    // ─── Proposer Closes: no auto-resolution, proposer calls resolve manually ───
    case 'proposer-closes':
      return null;

    // ─── Timeout: handled externally (cron, deadline check) ───
    case 'timeout':
      return null;

    default:
      return null;
  }
}

/**
 * Get the outline effect for a path — determines whether approved changes
 * apply immediately or stay pending until manually applied.
 *
 * Returns:
 * - 'apply'   — changes apply to the outline immediately on resolution
 * - 'pending' — changes stay as proposals until the proposer applies them
 */
export function getOutlineEffect(
  pathId: string
): 'apply' | 'pending' {
  const path = getCoordinationPath(pathId);
  if (!path) return 'pending';

  // Immediate resolution (notify/inform) → apply directly
  if (path.resolution.type === 'immediate') return 'apply';

  // Everything else → pending until proposer applies
  return 'pending';
}
