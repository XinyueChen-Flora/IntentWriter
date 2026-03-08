"use client";

import { CheckCircle2, Circle, Sparkles } from "lucide-react";

// Custom half-circle icon for partial coverage
export function HalfCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" stroke="none" />
    </svg>
  );
}

// AI-assisted checkmark icon - sparkle with checkmark inside
// Larger and more prominent than regular icons
export function AiCoveredIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Sparkles className="h-4 w-4 text-slate-500" />
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    </span>
  );
}

// Unified coverage status icon component
// - covered: green checkmark ✓
// - partial: half-filled circle ◐ (orange)
// - missing: empty circle ○ (red)
// Note: AI-covered intents show as 'covered' with separate AI badge
export function CoverageIcon({
  status,
  aiCovered,
  className
}: {
  status: 'covered' | 'partial' | 'missing';
  aiCovered?: boolean;
  className?: string;
}) {
  // AI-covered intents show as green checkmark (aligned)
  // The AI badge is shown separately at the block's right side
  if (aiCovered || status === 'covered') {
    return <CheckCircle2 className={`${className} text-emerald-600`} />;
  }
  if (status === 'partial') {
    return <HalfCircleIcon className={`${className} text-amber-600`} />;
  }
  // missing - empty circle
  return <Circle className={`${className} text-red-600`} strokeWidth={2} />;
}

// Standalone AI badge for showing at block's right side
export function AiBadge({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/50 ${className}`}>
      <Sparkles className="h-3 w-3 text-slate-500" />
      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">AI</span>
    </span>
  );
}
