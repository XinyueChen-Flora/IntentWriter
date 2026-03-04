"use client";

import { useState, useMemo } from "react";
import { X, Check, MessageSquare } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { SimulatedOutline, SimulatedIntent } from "../hooks/useDriftDetection";
import type { SectionImpactData } from "./types";
import { DiffIntentRow } from "./DiffIntentRow";
import { SectionImpactCard } from "./SectionImpactCard";

type OutlineDiffPanelProps = {
  simulatedOutline: SimulatedOutline;
  currentChildren: IntentBlock[];
  rootBlock: IntentBlock;
  onChangeAndPropose: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onStartDiscussion: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onClose: () => void;
  sectionImpacts?: SectionImpactData[];
  isLoadingImpact?: boolean;
};

// Diff panel showing outline-style preview with checkboxes
export function OutlineDiffPanel({
  simulatedOutline,
  currentChildren,
  rootBlock,
  onChangeAndPropose,
  onStartDiscussion,
  onClose,
  sectionImpacts,
  isLoadingImpact,
}: OutlineDiffPanelProps) {
  const mergedChildren = useMemo(() => {
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
  }, [simulatedOutline, currentChildren, rootBlock.id]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    mergedChildren.forEach(i => {
      if (i.status !== 'existing') {
        set.add(i.id);
      }
    });
    return set;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [expandedImpacts, setExpandedImpacts] = useState<Set<string>>(() => {
    const set = new Set<string>();
    sectionImpacts?.forEach(impact => {
      if (impact.impactLevel === 'significant') {
        set.add(impact.sectionId);
      }
    });
    return set;
  });

  const toggleImpactExpanded = (sectionId: string) => {
    setExpandedImpacts(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const rootSimulated = simulatedOutline.intents.find(i => i.id === rootBlock.id) || {
    id: rootBlock.id,
    content: rootBlock.content,
    parentId: null,
    position: 0,
    status: 'existing' as const,
  };

  const displayChildren = mergedChildren;
  const rootChangeCount = rootSimulated.status !== 'existing' ? 1 : 0;
  const changeCount = rootChangeCount + mergedChildren.filter(i => i.status !== 'existing').length;
  const selectedCount = selectedIds.size;

  return (
    <div className="w-[28rem] flex-shrink-0 mx-2 border rounded-lg bg-card overflow-hidden flex flex-col max-h-full shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Outline Diff</span>
          {changeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {changeCount} change{changeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-xs text-blue-700 dark:text-blue-300">
        Preview: Proposed outline based on writing
      </div>

      {isLoadingImpact && (
        <div className="px-3 py-3 border-b bg-muted/30 flex items-center justify-center gap-2">
          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Assessing impact on related sections...</span>
        </div>
      )}

      {!isLoadingImpact && sectionImpacts && sectionImpacts.length > 0 && (
        <div className="px-3 py-2 border-b bg-muted/20">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Impact on Related Sections
          </div>
          <div className="space-y-1.5">
            {sectionImpacts.map(impact => (
              <SectionImpactCard
                key={impact.sectionId}
                impact={impact}
                isExpanded={expandedImpacts.has(impact.sectionId)}
                onToggle={() => toggleImpactExpanded(impact.sectionId)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoadingImpact && !sectionImpacts?.length && simulatedOutline.crossSectionImpacts && simulatedOutline.crossSectionImpacts.length > 0 && (
        <div className="px-3 py-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
            POTENTIAL IMPACT ON OTHER SECTIONS
          </div>
          <div className="space-y-1">
            {simulatedOutline.crossSectionImpacts.map((impact, idx) => (
              <div key={idx} className="text-xs text-amber-600 dark:text-amber-400">
                <span className="font-medium">{impact.sectionIntent.slice(0, 30)}...</span>
                {impact.description && <span className="text-muted-foreground"> - {impact.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <DiffIntentRow
          intent={rootSimulated}
          isRoot
          isSelected={selectedIds.has(rootSimulated.id)}
          onToggleSelect={() => toggleSelect(rootSimulated.id)}
        />
        {displayChildren.map(child => (
          <DiffIntentRow
            key={child.id}
            intent={child}
            isSelected={selectedIds.has(child.id)}
            onToggleSelect={() => toggleSelect(child.id)}
          />
        ))}
      </div>

      {changeCount > 0 && (
        <div className="px-3 py-2 border-t bg-muted/30 flex-shrink-0 space-y-2">
          <button
            onClick={() => onChangeAndPropose(selectedIds, mergedChildren)}
            disabled={selectedCount === 0}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            <div className="flex-1 text-left">
              <div>Change Outline & Propose</div>
              <div className="text-xs text-blue-200 font-normal">Others can see and modify</div>
            </div>
          </button>
          <button
            onClick={() => onStartDiscussion(selectedIds, mergedChildren)}
            disabled={selectedCount === 0}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/50 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 dark:border-amber-700 rounded transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <div className="flex-1 text-left">
              <div>Start Discussion</div>
              <div className="text-xs text-amber-600 dark:text-amber-400 font-normal">Requires input from others</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
