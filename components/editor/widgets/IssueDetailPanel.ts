export type IssueDetail = {
  type: 'orphan' | 'partial' | 'missing';
  content: string;
  intentId?: string;
  orphanStart?: string;
  suggestedIntent?: string;
};

/**
 * Create expanded issue detail panel - shown when dot is clicked.
 * Shows issue list with action buttons.
 */
export function createIssueDetailPanel(issues: IssueDetail[]): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'issue-detail-panel mt-2 mb-2 p-3 rounded-lg border bg-muted/50 text-sm';
  panel.contentEditable = 'false';

  const issueListHtml = issues.map((issue, idx) => {
    const typeLabel = issue.type === 'orphan' ? 'Orphan' : issue.type === 'partial' ? 'Partial' : 'Missing';
    const colorClass = issue.type === 'orphan' ? 'text-amber-600 dark:text-amber-400' :
                       issue.type === 'partial' ? 'text-yellow-600 dark:text-yellow-400' :
                       'text-blue-600 dark:text-blue-400';

    const contentEscaped = (issue.content || '').slice(0, 60)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const suggestedEscaped = (issue.suggestedIntent || '').slice(0, 60)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const dataAttrs = issue.type === 'orphan'
      ? `data-orphan-start="${(issue.orphanStart || '').replace(/"/g, '&quot;')}" data-suggested-intent="${suggestedEscaped}"`
      : `data-intent-id="${issue.intentId || ''}"`;

    return `
      <div class="py-1.5 ${idx > 0 ? 'border-t' : ''}">
        <div class="flex items-start gap-2">
          <span class="${colorClass} font-medium text-xs">${typeLabel}:</span>
          <span class="text-muted-foreground text-xs flex-1">${contentEscaped}${issue.content.length > 60 ? '...' : ''}</span>
        </div>
        <div class="mt-1.5 flex gap-2">
          ${issue.type === 'orphan' ? `
            <button class="make-change-btn text-xs text-blue-600 dark:text-blue-400 hover:underline" ${dataAttrs}>Add to Outline</button>
            <span class="text-muted-foreground">·</span>
            <button class="add-writing-btn text-xs text-muted-foreground hover:text-foreground" data-orphan-start="${(issue.orphanStart || '').replace(/"/g, '&quot;')}">Dismiss</button>
          ` : `
            <button class="add-content-btn text-xs text-blue-600 dark:text-blue-400 hover:underline" ${dataAttrs}>Change Writing</button>
            <span class="text-muted-foreground">·</span>
            <button class="modify-intent-btn text-xs text-muted-foreground hover:text-foreground" ${dataAttrs}>Modify Intent</button>
          `}
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-medium text-muted-foreground">${issues.length} issue${issues.length > 1 ? 's' : ''}</span>
      <button class="close-panel-btn p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="space-y-0">${issueListHtml}</div>
  `;

  return panel;
}
