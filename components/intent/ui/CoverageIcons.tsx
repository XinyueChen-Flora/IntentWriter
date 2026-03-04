"use client";

import { CheckCircle2, XCircle } from "lucide-react";

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

// Unified coverage status icon component
export function CoverageIcon({ status, className }: { status: 'covered' | 'partial' | 'missing'; className?: string }) {
  if (status === 'covered') {
    return <CheckCircle2 className={`${className} text-emerald-500`} />;
  }
  if (status === 'partial') {
    return <HalfCircleIcon className={`${className} text-amber-500`} />;
  }
  // missing
  return <XCircle className={`${className} text-red-400`} />;
}
