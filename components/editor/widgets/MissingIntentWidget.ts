/**
 * Create inline missing intent widget for filter mode.
 * Shows "Missing Intent: [content]" with simulate button, all inline.
 */
export function createMissingIntentWidget(
  intentId: string,
  intentContent: string,
  onSimulate?: (intentId: string, widget: HTMLSpanElement) => void,
  isHovered?: boolean,
  isLoading?: boolean,
  index?: number  // Index number for this missing intent
): HTMLSpanElement {
  const widget = document.createElement('span');
  const hoverClass = isHovered ? 'ring-1 ring-red-500 rounded' : '';
  widget.className = `missing-intent-widget inline ${hoverClass}`;
  widget.contentEditable = 'false';
  widget.setAttribute('data-intent-id', intentId);

  // Truncate content for display
  const displayContent = intentContent.length > 40
    ? intentContent.slice(0, 40) + '...'
    : intentContent;

  const escapedContent = displayContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Index badge (if provided)
  const indexBadge = index !== undefined
    ? `<span class="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-[9px] font-semibold bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400">${index}</span>`
    : '';

  // PenLine icon (same as AlignmentSummary)
  const penLineIcon = `<svg class="icon-pen h-3 w-3 ${isLoading ? 'hidden' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

  // Spinner icon - visible if loading
  const spinnerIcon = `<span class="icon-spinner h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin ${isLoading ? '' : 'hidden'}"></span>`;

  const buttonText = isLoading ? 'Simulating...' : 'Simulate Writing';
  const buttonDisabled = isLoading ? 'disabled' : '';

  widget.innerHTML = `<span class="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-red-50/50 dark:bg-red-950/40 border border-dashed border-red-500 dark:border-red-600">${indexBadge}<span class="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap">Missing:</span><span class="text-xs text-red-700 dark:text-red-400 italic">${escapedContent}</span><button class="simulate-btn inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/50 transition-colors disabled:opacity-50" data-intent-id="${intentId}" title="Simulate Writing" ${buttonDisabled}>${penLineIcon}${spinnerIcon}<span class="btn-text">${buttonText}</span></button></span>`;

  // Add click handler for simulate button (only if not already loading)
  if (!isLoading) {
    const simulateBtn = widget.querySelector('.simulate-btn') as HTMLButtonElement;
    simulateBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Show loading state
      const iconPen = widget.querySelector('.icon-pen');
      const iconSpinner = widget.querySelector('.icon-spinner');
      const btnText = widget.querySelector('.btn-text');

      if (iconPen) iconPen.classList.add('hidden');
      if (iconSpinner) iconSpinner.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Simulating...';
      simulateBtn.disabled = true;

      onSimulate?.(intentId, widget);
    });
  }

  return widget;
}
