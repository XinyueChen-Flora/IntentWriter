// ─── Coordination Engine ───
//
// Runtime resolution logic for coordination paths.
// In the new protocol, resolution is handled by functions (check-majority, etc.)
// rather than hardcoded engine logic. This file provides lightweight helpers.

import { getCoordinationPath } from './protocol';

export type VoteRecord = {
  userId: string;
  action: string;      // e.g. 'approve', 'reject', 'reply'
  comment?: string | null;
};

/**
 * Check whether a coordination process has reached resolution.
 *
 * In the new protocol, resolution logic lives in functions (check-majority,
 * check-single-approval, etc.). This helper provides a simple heuristic
 * for callers that just need a quick status without running the full pipeline.
 *
 * Returns:
 * - 'approved'  — resolution condition met positively
 * - 'rejected'  — resolution condition met negatively
 * - null        — not yet resolved, still pending
 */
export function checkResolution(
  pathId: string,
  _pathConfig: Record<string, unknown>,
  votes: VoteRecord[],
  eligibleCount: number
): 'approved' | 'rejected' | null {
  const path = getCoordinationPath(pathId);
  if (!path) return null;

  // Inform path (resolve.who === 'system' and no deliberate actions with approve/reject)
  // resolves immediately
  if (path.resolve.who === 'system' && !path.deliberate.actions?.some(a => a.id === 'approve' || a.id === 'reject')) {
    return 'approved';
  }

  // Simple heuristic: check approve/reject votes against majority
  const approvals = votes.filter(v => v.action === 'approve').length;
  const rejections = votes.filter(v => v.action === 'reject').length;
  const needed = Math.ceil(eligibleCount / 2);

  if (approvals >= needed) return 'approved';
  if (rejections >= needed) return 'rejected';

  // For single-approval style paths, any vote resolves
  if (votes.length > 0 && eligibleCount <= 1) {
    const first = votes[0];
    if (first.action === 'approve') return 'approved';
    if (first.action === 'reject') return 'rejected';
  }

  return null;
}

/**
 * Get the outline effect for a path — determines whether approved changes
 * apply immediately or stay pending until manually applied.
 */
export function getOutlineEffect(
  pathId: string
): 'apply' | 'pending' {
  const path = getCoordinationPath(pathId);
  if (!path) return 'pending';
  // Inform paths (system resolves, no vote actions) apply immediately
  if (path.resolve.who === 'system' && !path.deliberate.actions?.some(a => a.id === 'approve' || a.id === 'reject')) {
    return 'apply';
  }
  return 'pending';
}

// ─── Proposal Change Application ───

export type DraftChange = {
  id: string;
  content: string;
  originalContent: string;
  isNew: boolean;
  isRemoved: boolean;
};

export type OutlineOperations = {
  addBlock: (options: { asChildOf: string }) => { id: string };
  updateBlock: (blockId: string, content: string) => void;
  updateBlockRaw: (blockId: string, updates: Record<string, unknown>) => void;
  deleteBlock: (blockId: string) => void;
  findBlock: (blockId: string) => { id: string; content: string; changeStatus?: string } | undefined;
  findBlockByContent: (parentId: string, content: string) => { id: string } | undefined;
};

/**
 * Apply proposal changes to the outline.
 * Reads the path's effect to determine behavior:
 * - 'apply' (immediate): directly update/create/delete blocks
 * - 'pending' (non-immediate): mark blocks as 'proposed', wait for deliberation
 */
export function applyProposalChanges(
  pathId: string,
  sectionId: string,
  changes: DraftChange[],
  proposalId: string,
  userId: string,
  userName: string,
  ops: OutlineOperations,
): void {
  const effect = getOutlineEffect(pathId);

  for (const change of changes) {
    // Skip unchanged items
    if (!change.isNew && !change.isRemoved && change.content === change.originalContent) {
      continue;
    }

    if (effect === 'apply') {
      // ── Immediate: apply directly ──
      if (change.isNew) {
        const existing = ops.findBlock(change.id);
        if (existing) {
          ops.updateBlock(change.id, change.content);
          ops.updateBlockRaw(change.id, { changeStatus: 'modified', changeBy: userId, changeByName: userName, changeAt: Date.now() });
        } else if (change.id.startsWith('new-')) {
          const newBlock = ops.addBlock({ asChildOf: sectionId });
          ops.updateBlock(newBlock.id, change.content);
          ops.updateBlockRaw(newBlock.id, { changeStatus: 'added', changeBy: userId, changeByName: userName, changeAt: Date.now() });
        } else {
          const match = ops.findBlockByContent(sectionId, change.originalContent);
          if (match) {
            ops.updateBlock(match.id, change.content);
            ops.updateBlockRaw(match.id, { changeStatus: 'modified', changeBy: userId, changeByName: userName, changeAt: Date.now() });
          } else {
            const newBlock = ops.addBlock({ asChildOf: sectionId });
            ops.updateBlock(newBlock.id, change.content);
            ops.updateBlockRaw(newBlock.id, { changeStatus: 'added', changeBy: userId, changeByName: userName, changeAt: Date.now() });
          }
        }
      } else if (change.isRemoved) {
        const block = ops.findBlock(change.id);
        if (block) {
          ops.deleteBlock(change.id);
        }
      } else {
        // Modified
        ops.updateBlock(change.id, change.content);
        ops.updateBlockRaw(change.id, {
          changeStatus: 'modified',
          changeBy: userId, changeByName: userName, changeAt: Date.now(),
          previousContent: change.originalContent,
        });
      }
    } else {
      // ── Pending: mark as proposed ──
      if (change.isNew) {
        const existing = ops.findBlock(change.id);
        if (!existing && change.id.startsWith('new-')) {
          const newBlock = ops.addBlock({ asChildOf: sectionId });
          ops.updateBlock(newBlock.id, change.content);
          ops.updateBlockRaw(newBlock.id, {
            changeStatus: 'proposed', changeBy: userId, changeByName: userName,
            changeAt: Date.now(), proposalId,
          });
        }
      } else {
        ops.updateBlockRaw(change.id, {
          changeStatus: 'proposed', changeBy: userId, changeByName: userName,
          changeAt: Date.now(), previousContent: change.originalContent, proposalId,
        });
      }
    }
  }
}
