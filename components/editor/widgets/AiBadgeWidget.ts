/**
 * Creates a small AI badge widget to show at the end of AI-generated content
 */
export function createAiBadgeWidget(): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = 'inline-flex items-center gap-0.5 ml-1 px-1 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 text-[9px] font-medium text-slate-600 dark:text-slate-400 align-middle';
  badge.innerHTML = `
    <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
    </svg>
    <span>AI</span>
  `;
  return badge;
}
