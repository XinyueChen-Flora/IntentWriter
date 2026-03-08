/**
 * Create inline simulated writing widget - typewriter-style text
 * that flows naturally after the missing intent indicator.
 * Shows which intent it's simulating for.
 */
export function createInlineSimulatedWidget(
  content: string,
  intentContent: string,
  intentId: string,
  onAccept: () => void,
  onCancel: () => void,
  onHover?: (intentId: string | null) => void
): HTMLSpanElement {
  const widget = document.createElement('span');
  widget.className = 'inline-simulated-widget';
  widget.contentEditable = 'false';
  widget.setAttribute('data-simulated-intent-id', intentId);

  // Show full content inline (typewriter style)
  const contentEscaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ');

  // Truncate intent for display
  const intentShort = intentContent.length > 30
    ? intentContent.slice(0, 30) + '...'
    : intentContent;
  const intentEscaped = intentShort
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  widget.innerHTML = `<span class="simulated-content inline-flex items-baseline gap-1 px-1 py-0.5 rounded bg-red-50/50 dark:bg-red-950/40 border border-dashed border-red-500 dark:border-red-600"><span class="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap">for "${intentEscaped}":</span><span class="text-sm text-red-700 dark:text-red-400 italic">${contentEscaped}</span></span><span class="inline-flex items-center gap-0.5 ml-1"><button class="simulated-accept-btn px-1.5 py-0.5 text-[10px] font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors">Accept</button><button class="simulated-cancel-btn px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">✕</button></span>`;

  // Add event listeners
  const acceptBtn = widget.querySelector('.simulated-accept-btn');
  const cancelBtn = widget.querySelector('.simulated-cancel-btn');
  const contentSpan = widget.querySelector('.simulated-content');

  acceptBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAccept();
  });
  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  });

  // Hover for three-way linking
  contentSpan?.addEventListener('mouseenter', () => {
    onHover?.(intentId);
  });
  contentSpan?.addEventListener('mouseleave', () => {
    onHover?.(null);
  });

  return widget;
}
