"use client";

import { useState, useMemo } from "react";
import { Plus, Minus, Edit2, X, Check, MessageSquare, Trash2, PenLine } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { SimulatedOutline, SimulatedIntent } from "@/hooks/useDriftDetection";
import type { SectionImpactData } from "./types";
import { DiffIntentRow } from "./DiffIntentRow";
import { WordDiff } from "./WordDiff";

type ModifyIntent = {
  intentId: string;
  intentContent: string;
  action: 'remove' | 'reword';
  suggestedReword?: string;
};

type InlineDiffViewProps = {
  isSource: boolean;
  simulatedOutline?: SimulatedOutline;
  currentChildren: IntentBlock[];
  rootBlock: IntentBlock;
  sectionImpact?: SectionImpactData;
  isLoading?: boolean;
  // For "Modify Outline" mode
  modifyIntent?: ModifyIntent;
  onConfirmRemove?: () => void;
  onProposeChange?: () => void;
  onDiscussChange?: () => void;
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
  modifyIntent,
  onConfirmRemove,
  onProposeChange,
  onDiscussChange,
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

  // Check if this is "Modify Outline" mode (source section with modifyIntent)
  const isModifyMode = isSource && modifyIntent;

  if (isLoading) {
    return (
      <div className="flex-1 min-w-0 mr-2 border rounded-lg bg-card p-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span>Analyzing impact on other sections...</span>
        </div>
      </div>
    );
  }

  const impactBadge = !isSource && sectionImpact && (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
      sectionImpact.impactLevel === 'significant'
        ? 'bg-primary/10 text-primary dark:bg-primary/20'
        : sectionImpact.impactLevel === 'minor'
          ? 'bg-muted text-muted-foreground'
          : 'bg-muted/50 text-muted-foreground/70'
    }`}>
      {sectionImpact.impactLevel === 'significant' ? 'Significant Impact' :
       sectionImpact.impactLevel === 'minor' ? 'Minor Impact' : 'No Impact'}
    </span>
  );

  // Width matches left outline panel (w-[28%]) for 1:1 comparison
  return (
    <div className="w-[28%] flex-shrink-0 mr-2 border rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">
            {isModifyMode ? 'Modify Outline Preview' : isSource ? 'Outline Diff' : 'Impact Preview'}
          </span>
          {changeCount > 0 && isSource && !isModifyMode && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {changeCount}
            </span>
          )}
          {impactBadge}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Reason for impact (for non-source sections) */}
      {!isSource && sectionImpact?.reason && (
        <div className="px-3 py-1.5 bg-muted/40 border-b text-xs text-muted-foreground italic">
          {sectionImpact.reason}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {/* Modify Outline Mode - mirror the left outline structure */}
        {isModifyMode ? (
          <div>
            {/* Root block card - matches left side style */}
            <div className="border rounded-xl p-3 bg-card shadow-sm">
              <div className="text-sm font-medium text-foreground">
                {rootBlock.content}
              </div>
            </div>

            {/* Children - matches ChildIntentBlock style */}
            <div className="mt-1.5 space-y-1.5">
              {currentChildren.map(child => {
                const isTargetIntent = child.id === modifyIntent.intentId;
                return (
                  <div
                    key={child.id}
                    className={`ml-4 border rounded-lg p-2.5 transition-all ${
                      isTargetIntent
                        ? 'border-muted-foreground/30 bg-muted/40'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isTargetIntent && (
                        <Trash2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${
                        isTargetIntent
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}>
                        {child.content}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isSource ? (
          /* Normal outline diff mode */
          mergedChildren.map(child => (
            <DiffIntentRow
              key={child.id}
              intent={child}
              isSelected={selectedIds.has(child.id)}
              onToggleSelect={() => toggleSelect(child.id)}
            />
          ))
        ) : (
          /* Impact on other sections - matches outline card style */
          impactMergedOutline.length > 0 ? (
            <div>
              {/* Root block card - matches left side style */}
              <div className="border rounded-xl p-3 bg-card shadow-sm">
                <div className="text-sm font-medium text-foreground">
                  {sectionImpact?.sectionIntent}
                </div>
              </div>

              {/* Children - matches ChildIntentBlock style */}
              <div className="mt-1.5 space-y-1.5">
                {impactMergedOutline.map(item => {
                  const borderClass =
                    item.status === 'new' ? 'border-primary/50' :
                    item.status === 'modified' ? 'border-primary/30' :
                    item.status === 'removed' ? 'border-muted-foreground/20' :
                    'border-border';
                  const bgClass =
                    item.status === 'new' ? 'bg-primary/[0.04] dark:bg-primary/[0.08]' :
                    item.status === 'modified' ? 'bg-primary/[0.03] dark:bg-primary/[0.05]' :
                    item.status === 'removed' ? 'bg-muted/40' :
                    'bg-card';

                  return (
                    <div
                      key={item.id}
                      className={`ml-4 border rounded-lg p-2.5 transition-all ${borderClass} ${bgClass}`}
                    >
                      <div className="flex items-start gap-2">
                        {item.status === 'new' && <Plus className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
                        {item.status === 'modified' && <Edit2 className="h-4 w-4 text-primary/70 flex-shrink-0 mt-0.5" />}
                        {item.status === 'removed' && <Trash2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          {item.status === 'modified' && item.originalContent ? (
                            <WordDiff oldText={item.originalContent} newText={item.content} className="text-sm" />
                          ) : (
                            <span className={`text-sm ${
                              item.status === 'removed' ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                              {item.content}
                            </span>
                          )}
                          {item.reason && (
                            <div className="text-xs text-muted-foreground italic mt-1">{item.reason}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4">
              <Check className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              No changes needed for this section
            </div>
          )
        )}
      </div>

      {/* Action buttons for Modify Outline mode */}
      {isModifyMode && (
        <div className="px-3 py-2 border-t bg-muted/30 space-y-1.5">
          {onProposeChange && (
            <button
              onClick={onProposeChange}
              className="w-full flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded transition-colors"
            >
              <PenLine className="h-3.5 w-3.5" />
              Propose a Change
            </button>
          )}
          {onDiscussChange && (
            <button
              onClick={onDiscussChange}
              className="w-full flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Discuss This Change
            </button>
          )}
        </div>
      )}

      {/* Action buttons for normal outline diff mode */}
      {isSource && !isModifyMode && changeCount > 0 && onApply && onStartDiscussion && (
        <div className="px-3 py-2 border-t bg-muted/30 space-y-1.5">
          <button
            onClick={() => onApply(selectedIds, mergedChildren)}
            disabled={selectedIds.size === 0}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 rounded transition-colors"
          >
            <Check className="h-3 w-3" />
            Apply & Notify
          </button>
          <button
            onClick={() => onStartDiscussion(selectedIds, mergedChildren)}
            disabled={selectedIds.size === 0}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 disabled:opacity-50 border border-border rounded transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            Discuss First
          </button>
        </div>
      )}
    </div>
  );
}
