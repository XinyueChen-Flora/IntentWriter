export type IssueType = 'orphan' | 'partial' | 'missing' | 'conflict';

/**
 * Create issue indicator widget with icon + small index number.
 * - partial: half-circle icon (orange) + superscript number
 * - missing: empty circle (red) + superscript number
 * - orphan: plus icon (blue) + superscript number
 * - conflict: warning icon (red) + superscript number
 */
export function createIssueIndicatorDot(
  index: number,  // 1-based index for this issue type
  issueType: IssueType,
  dataAttrs: Record<string, string>,
  isHovered?: boolean
): HTMLSpanElement {
  const widget = document.createElement('span');
  const hoverClass = isHovered ? 'scale-110' : '';
  widget.className = `issue-indicator-dot ml-0.5 inline-flex items-center cursor-pointer ${hoverClass}`;
  widget.contentEditable = 'false';

  // Generate data attributes string - properly escape for HTML attributes
  const escapeAttr = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');

  const dataAttrsStr = Object.entries(dataAttrs)
    .map(([k, v]) => `data-${k}="${escapeAttr(v)}"`)
    .join(' ');

  // Index badge colors based on issue type
  const indexColors = {
    partial: 'text-amber-700 dark:text-amber-400',
    missing: 'text-red-600 dark:text-red-400',
    orphan: 'text-blue-700 dark:text-blue-400',
    conflict: 'text-red-700 dark:text-red-400',
  };

  const title = issueType === 'partial' ? 'Partial coverage' :
                issueType === 'missing' ? 'Missing content' :
                issueType === 'orphan' ? 'New content (potential intent)' : 'Conflict';

  let iconSvg = '';

  if (issueType === 'partial') {
    // Half-circle icon (orange)
    iconSvg = `<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" class="stroke-amber-600" />
      <path d="M12 2a10 10 0 0 1 0 20" class="fill-amber-600" stroke="none" />
    </svg>`;
  } else if (issueType === 'missing') {
    // Empty circle icon (red)
    iconSvg = `<svg class="h-3.5 w-3.5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
    </svg>`;
  } else if (issueType === 'orphan') {
    // Plus icon (blue)
    iconSvg = `<svg class="h-3 w-3 text-blue-700 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>`;
  } else {
    // Conflict - warning triangle (red)
    iconSvg = `<svg class="h-3.5 w-3.5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>`;
  }

  // Icon + small superscript number
  const iconHtml = `
    <span
      class="issue-dot inline-flex items-start transition-colors hover:scale-110"
      data-issue-type="${issueType}"
      data-index="${index}"
      ${dataAttrsStr}
      title="${title} #${index}"
    >
      ${iconSvg}<sup class="text-[9px] font-semibold ${indexColors[issueType]} -ml-0.5">${index}</sup>
    </span>
  `;

  widget.innerHTML = iconHtml;
  return widget;
}
