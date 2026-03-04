"use client";

import { useState, useMemo } from "react";
import { Plus, Minus, Edit2, X, Check, MessageSquare } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { SimulatedOutline, SimulatedIntent } from "../hooks/useDriftDetection";
import type { SectionImpactData } from "./types";
import { DiffIntentRow } from "./DiffIntentRow";

type InlineDiffViewProps = {
  isSource: boolean;
  simulatedOutline?: SimulatedOutline;
  currentChildren: IntentBlock[];
  rootBlock: IntentBlock;
  sectionImpact?: SectionImpactData;
  isLoading?: boolean;
  onApply?: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onStartDiscussion?: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onClose: () => void;
};

// Inline diff view - shows diff between outline and writing
export function InlineDiffView({
  isSource,
  simulatedOutline,
  currentChildren,
  rootBlock,
  sectionImpact,
  isLoading,
  onApply,
  onStartDiscussion,
  onClose,
}: InlineDiffViewProps) {
  const mergedChildren = useMemo(() => {
    if (!isSource || !simulatedOutline) return [];

    const simulatedChildMap = new Map<string, SimulatedIntent>();
    simulatedOutline.intents
      .filter(i => i.parentId === rootBlock.id)
      .forEach(i => simulatedChildMap.set(i.id, i));

    const result: SimulatedIntent[] = [];
    const addedIds = new Set<string>();

    currentChildren.forEach((child, idx) => {
      const simulated = simulatedChildMap.get(child.id);
      if (simulated) {
        result.push(simulated);
        addedIds.add(child.id);
      } else {
        result.push({
          id: child.id,
          content: child.content,
          parentId: rootBlock.id,
          position: idx,
          status: 'removed',
        });
        addedIds.add(child.id);
      }
    });

    simulatedOutline.intents
      .filter(i => i.parentId === rootBlock.id && !addedIds.has(i.id))
      .forEach(i => result.push(i));

    return result.sort((a, b) => a.position - b.position);
  }, [isSource, simulatedOutline, currentChildren, rootBlock.id]);

  const impactMergedOutline = useMemo(() => {
    if (isSource || !sectionImpact) return [];

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

    (sectionImpact.suggestedChanges || []).forEach(change => {
      if (change.action === 'modify' && change.intentId) modifiedIds.add(change.intentId);
      if (change.action === 'remove' && change.intentId) removedIds.add(change.intentId);
    });

    sectionImpact.childIntents.forEach(child => {
      const change = sectionImpact.suggestedChanges?.find(
        c => c.intentId === child.id && (c.action === 'modify' || c.action === 'remove')
      );

      if (removedIds.has(child.id)) {
        items.push({ id: child.id, content: child.content, position: child.position, status: 'removed', reason: change?.reason });
      } else if (modifiedIds.has(child.id) && change) {
        items.push({ id: child.id, content: change.content, position: child.position, status: 'modified', originalContent: child.content, reason: change.reason });
      } else {
        items.push({ id: child.id, content: child.content, position: child.position, status: 'existing' });
      }
    });

    (sectionImpact.suggestedChanges || [])
      .filter(c => c.action === 'add')
      .forEach((change, idx) => {
        items.push({ id: `new-${idx}`, content: change.content, position: change.position, status: 'new', reason: change.reason });
      });

    return items.sort((a, b) => a.position - b.position);
  }, [isSource, sectionImpact]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    mergedChildren.forEach(i => {
      if (i.status !== 'existing') set.add(i.id);
    });
    return set;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeCount = isSource
    ? mergedChildren.filter(i => i.status !== 'existing').length
    : impactMergedOutline.filter(i => i.status !== 'existing').length;

  if (isLoading) {
    return (
      <div className="w-[18%] flex-shrink-0 ml-12 mr-2 border rounded-lg bg-card p-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span>Assessing impact...</span>
        </div>
      </div>
    );
  }

  const impactBadge = !isSource && sectionImpact && (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
      sectionImpact.impactLevel === 'significant'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
        : sectionImpact.impactLevel === 'minor'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
    }`}>
      {sectionImpact.impactLevel === 'significant' ? 'Significant' :
       sectionImpact.impactLevel === 'minor' ? 'Minor' : 'No change'}
    </span>
  );

  return (
    <div className="w-[18%] flex-shrink-0 ml-12 mr-2 border rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">
            {isSource ? 'Outline Diff' : 'Suggested Changes'}
          </span>
          {changeCount > 0 && isSource && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {changeCount}
            </span>
          )}
          {impactBadge}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!isSource && sectionImpact?.reason && (
        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-xs text-blue-700 dark:text-blue-300">
          {sectionImpact.reason}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-60">
        {isSource ? (
          mergedChildren.map(child => (
            <DiffIntentRow
              key={child.id}
              intent={child}
              isSelected={selectedIds.has(child.id)}
              onToggleSelect={() => toggleSelect(child.id)}
            />
          ))
        ) : (
          impactMergedOutline.length > 0 ? (
            impactMergedOutline.map(item => (
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
                    <div className="text-xs text-muted-foreground line-through">was: {item.originalContent}</div>
                  )}
                  {item.reason && (
                    <div className="text-xs text-muted-foreground italic">{item.reason}</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">No changes needed</div>
          )
        )}
      </div>

      {isSource && changeCount > 0 && onApply && onStartDiscussion && (
        <div className="px-3 py-2 border-t bg-muted/30 space-y-1.5">
          <button
            onClick={() => onApply(selectedIds, mergedChildren)}
            disabled={selectedIds.size === 0}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
          >
            <Check className="h-3 w-3" />
            Apply & Notify
          </button>
          <button
            onClick={() => onStartDiscussion(selectedIds, mergedChildren)}
            disabled={selectedIds.size === 0}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 disabled:opacity-50 border border-amber-200 dark:border-amber-700 rounded transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            Discuss First
          </button>
        </div>
      )}
    </div>
  );
}
