"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, Edit2, Check } from "lucide-react";
import type { SectionImpactData } from "./types";

type SectionImpactCardProps = {
  impact: SectionImpactData;
  isExpanded: boolean;
  onToggle: () => void;
};

// Impact card for a related section
export function SectionImpactCard({
  impact,
  isExpanded,
  onToggle,
}: SectionImpactCardProps) {
  // Build merged outline showing current + suggested changes
  const mergedOutline = useMemo(() => {
    const items: Array<{
      id: string;
      content: string;
      position: number;
      status: 'existing' | 'new' | 'modified' | 'removed';
      originalContent?: string;
      reason?: string;
    }> = [];

    const modifiedIds = new Set<string>();
    const removedIds = new Set<string>();

    (impact.suggestedChanges || []).forEach(change => {
      if (change.action === 'modify' && change.intentId) {
        modifiedIds.add(change.intentId);
      } else if (change.action === 'remove' && change.intentId) {
        removedIds.add(change.intentId);
      }
    });

    impact.childIntents.forEach(child => {
      const change = impact.suggestedChanges?.find(
        c => c.intentId === child.id && (c.action === 'modify' || c.action === 'remove')
      );

      if (removedIds.has(child.id)) {
        items.push({
          id: child.id,
          content: child.content,
          position: child.position,
          status: 'removed',
          reason: change?.reason,
        });
      } else if (modifiedIds.has(child.id) && change) {
        items.push({
          id: child.id,
          content: change.content,
          position: child.position,
          status: 'modified',
          originalContent: child.content,
          reason: change.reason,
        });
      } else {
        items.push({
          id: child.id,
          content: child.content,
          position: child.position,
          status: 'existing',
        });
      }
    });

    (impact.suggestedChanges || [])
      .filter(c => c.action === 'add')
      .forEach((change, idx) => {
        items.push({
          id: `new-${idx}`,
          content: change.content,
          position: change.position,
          status: 'new',
          reason: change.reason,
        });
      });

    return items.sort((a, b) => a.position - b.position);
  }, [impact]);

  const hasChanges = impact.impactLevel !== 'none';

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
          isExpanded ? 'bg-muted/50' : 'hover:bg-muted/30'
        }`}
      >
        {hasChanges ? (
          isExpanded ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{impact.sectionIntent}</div>
          {hasChanges && (
            <div className="text-xs text-muted-foreground truncate">{impact.reason}</div>
          )}
        </div>
        {impact.impactLevel === 'minor' && (
          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            Minor
          </span>
        )}
        {impact.impactLevel === 'significant' && (
          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
            Significant
          </span>
        )}
        {impact.impactLevel === 'none' && (
          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
            No change
          </span>
        )}
      </button>

      {isExpanded && hasChanges && (
        <div className="px-3 py-2 border-t bg-muted/20 space-y-1">
          {mergedOutline.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No child intents</div>
          ) : (
            mergedOutline.map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-1.5 text-sm py-0.5 px-1.5 rounded ${
                  item.status === 'new' ? 'bg-emerald-50/50 dark:bg-emerald-950/30' :
                  item.status === 'modified' ? 'bg-amber-50/50 dark:bg-amber-950/30' :
                  item.status === 'removed' ? 'bg-red-50/50 dark:bg-red-950/30' : ''
                }`}
              >
                {item.status === 'new' && <Plus className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />}
                {item.status === 'modified' && <Edit2 className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />}
                {item.status === 'removed' && <Minus className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />}
                {item.status === 'existing' && <div className="w-3 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className={item.status === 'removed' ? 'line-through text-red-600 dark:text-red-400' : ''}>
                    {item.content}
                  </div>
                  {item.status === 'modified' && item.originalContent && (
                    <div className="text-xs text-muted-foreground line-through">
                      was: {item.originalContent}
                    </div>
                  )}
                  {item.reason && (
                    <div className="text-xs text-muted-foreground italic">{item.reason}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
