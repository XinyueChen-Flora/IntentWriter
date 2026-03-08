"use client";

import { Plus, Minus, Edit2 } from "lucide-react";
import type { SimulatedIntent } from "@/hooks/useDriftDetection";
import { WordDiff } from "./WordDiff";

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
    borderClass = 'border-primary/50';
    bgClass = 'bg-primary/[0.04] dark:bg-primary/[0.08]';
    prefixIcon = <Plus className="h-3 w-3 text-primary" />;
  } else if (intent.status === 'removed') {
    borderClass = 'border-muted-foreground/20';
    bgClass = 'bg-muted/40';
    prefixIcon = <Minus className="h-3 w-3 text-muted-foreground" />;
  } else if (intent.status === 'modified') {
    borderClass = 'border-primary/30';
    bgClass = 'bg-primary/[0.03] dark:bg-primary/[0.05]';
    prefixIcon = <Edit2 className="h-3 w-3 text-primary/70" />;
  }

  if (isRoot) {
    return (
      <div className={`border rounded-lg p-2 ${borderClass} ${bgClass}`}>
        <div className="flex items-start gap-2">
          {prefixIcon && <div className="flex-shrink-0 mt-0.5">{prefixIcon}</div>}
          <div className="flex-1 min-w-0">
            {intent.status === 'modified' && intent.originalContent ? (
              <WordDiff oldText={intent.originalContent} newText={intent.content} className="text-xs font-medium" />
            ) : (
              <div className={`text-xs font-medium ${intent.status === 'removed' ? 'line-through text-muted-foreground' : ''}`}>
                {intent.content}
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
          {intent.status === 'modified' && intent.originalContent ? (
            <WordDiff oldText={intent.originalContent} newText={intent.content} className="text-sm" />
          ) : (
            <div className={`text-sm ${intent.status === 'removed' ? 'line-through text-muted-foreground' : ''}`}>
              {intent.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
