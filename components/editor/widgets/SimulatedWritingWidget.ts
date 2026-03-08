/**
 * Create simulated writing widget - shows preview of AI-suggested content
 * with Accept/Cancel buttons.
 */
export function createSimulatedWritingWidget(
  content: string,
  intentContent: string,
  onAccept: () => void,
  onCancel: () => void
): HTMLDivElement {
  const widget = document.createElement('div');
  widget.className = 'simulated-writing-widget my-3 mx-0';
  widget.contentEditable = 'false';

  const contentEscaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const intentEscaped = intentContent.slice(0, 40)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  widget.innerHTML = `
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        Simulated
      </span>
      <span class="text-xs text-muted-foreground italic">
        For: "${intentEscaped}${intentContent.length > 40 ? '...' : ''}"
      </span>
    </div>
    <div class="relative rounded-lg border-2 border-dashed border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30 p-3">
      <div class="text-sm leading-relaxed">${contentEscaped}</div>
    </div>
    <div class="flex justify-end gap-2 mt-2">
      <button class="simulated-cancel-btn px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Cancel
      </button>
      <button class="simulated-accept-btn px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors">
        Accept
      </button>
    </div>
  `;

  // Add event listeners
  const acceptBtn = widget.querySelector('.simulated-accept-btn');
  const cancelBtn = widget.querySelector('.simulated-cancel-btn');
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

  return widget;
}
