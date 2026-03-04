"use client";

import { Plus, Minus, Edit2 } from "lucide-react";
import type { SimulatedIntent } from "../hooks/useDriftDetection";

type DiffIntentRowProps = {
  intent: SimulatedIntent;
  isRoot?: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
};

// Diff item component - looks similar to the outline intent blocks
export function DiffIntentRow({
  intent,
  isRoot = false,
  isSelected,
  onToggleSelect,
}: DiffIntentRowProps) {
  const isChanged = intent.status !== 'existing';

  // Styling based on status
  let borderClass = 'border-border';
  let bgClass = '';
  let prefixIcon = null;

  if (intent.status === 'new') {
    borderClass = 'border-emerald-300 dark:border-emerald-700';
    bgClass = 'bg-emerald-50/50 dark:bg-emerald-950/30';
    prefixIcon = <Plus className="h-3 w-3 text-emerald-500" />;
  } else if (intent.status === 'removed') {
    borderClass = 'border-red-300 dark:border-red-700';
    bgClass = 'bg-red-50/50 dark:bg-red-950/30';
    prefixIcon = <Minus className="h-3 w-3 text-red-500" />;
  } else if (intent.status === 'modified') {
    borderClass = 'border-amber-300 dark:border-amber-700';
    bgClass = 'bg-amber-50/50 dark:bg-amber-950/30';
    prefixIcon = <Edit2 className="h-3 w-3 text-amber-500" />;
  }

  if (isRoot) {
    return (
      <div className={`border rounded-lg p-2 ${borderClass} ${bgClass}`}>
        <div className="flex items-start gap-2">
          {prefixIcon && <div className="flex-shrink-0 mt-0.5">{prefixIcon}</div>}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-medium ${intent.status === 'removed' ? 'line-through text-red-600 dark:text-red-400' : ''}`}>
              {intent.content}
            </div>
            {intent.status === 'modified' && intent.originalContent && (
              <div className="text-xs text-muted-foreground line-through mt-0.5">
                was: {intent.originalContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Child intent row
  return (
    <div className={`border-l-2 pl-3 py-1 ml-2 ${borderClass} ${bgClass} rounded-r`}>
      <div className="flex items-start gap-2">
        {isChanged && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-0.5 h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
          />
        )}
        {prefixIcon && <div className="flex-shrink-0 mt-0.5">{prefixIcon}</div>}
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${intent.status === 'removed' ? 'line-through text-red-600 dark:text-red-400' : ''}`}>
            {intent.content}
          </div>
          {intent.status === 'modified' && intent.originalContent && (
            <div className="text-xs text-muted-foreground line-through">
              was: {intent.originalContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
