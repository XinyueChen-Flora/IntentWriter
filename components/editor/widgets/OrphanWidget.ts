import type { OrphanSentence } from "../types";
import { createIssueIndicatorDot } from "./IssueIndicatorDot";

/**
 * Create inline widget for orphan content - uses subtle dot indicator.
 */
export function createOrphanWidget(orphan: OrphanSentence): HTMLSpanElement {
  const intentText = orphan.suggestedIntent || 'Unmatched content';
  const intentEscaped = intentText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return createIssueIndicatorDot(1, 'orphan', {
    'orphan-start': orphan.start,
    'suggested-intent': intentEscaped,
  });
}
