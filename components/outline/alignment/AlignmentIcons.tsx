"use client";

import { Check, Circle, Plus } from "lucide-react";

export type AlignmentStatus = 'aligned' | 'partial' | 'missing' | 'orphan';

type AlignmentIconProps = {
  status: AlignmentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/**
 * Unified alignment status icons used on both Intent and Writing sides.
 */
export function AlignmentIcon({ status, size = 'md', className = '' }: AlignmentIconProps) {
  const sizeClass = sizeMap[size];

  switch (status) {
    case 'aligned':
      return (
        <div className={`flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-0.5 ${className}`}>
          <Check className={`${sizeClass} text-emerald-600 dark:text-emerald-400`} strokeWidth={3} />
        </div>
      );

    case 'partial':
      // Half-filled circle
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <svg className={sizeClass} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" className="stroke-amber-600" strokeWidth="2" />
            <path
              d="M12 2 A10 10 0 0 1 12 22"
              className="fill-amber-600"
            />
          </svg>
        </div>
      );

    case 'missing':
      // Empty circle
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <Circle className={`${sizeClass} text-red-600`} strokeWidth={2} />
        </div>
      );

    case 'orphan':
      // Plus sign
      return (
        <div className={`flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 p-0.5 ${className}`}>
          <Plus className={`${sizeClass} text-blue-600 dark:text-blue-400`} strokeWidth={3} />
        </div>
      );

    default:
      return null;
  }
}

/**
 * Get the color class for alignment status (for lines, borders, etc.)
 */
export function getAlignmentColor(status: AlignmentStatus): string {
  switch (status) {
    case 'aligned':
      return 'text-emerald-600 border-emerald-600 bg-emerald-600';
    case 'partial':
      return 'text-amber-600 border-amber-600 bg-amber-600';
    case 'missing':
      return 'text-red-600 border-red-600 bg-red-600';
    case 'orphan':
      return 'text-blue-600 border-blue-600 bg-blue-600';
    default:
      return 'text-muted-foreground border-muted-foreground bg-muted-foreground';
  }
}

/**
 * Get line color for connecting lines in Writing view
 */
export function getAlignmentLineColor(status: AlignmentStatus): string {
  switch (status) {
    case 'aligned':
      return '#059669'; // emerald-600
    case 'partial':
      return '#d97706'; // amber-600
    case 'missing':
      return '#dc2626'; // red-600
    case 'orphan':
      return '#2563eb'; // blue-600
    default:
      return '#4b5563'; // gray-600
  }
}
