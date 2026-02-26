"use client";

import { useState, useMemo } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Trash2, ChevronLeft, Link2, CheckCircle2, XCircle, Plus, Minus, Edit2, X, Check, Eye, MessageSquare } from "lucide-react";
import type { SimulatedOutline, SimulatedIntent } from "./hooks/useDriftDetection";

// Custom half-circle icon for partial coverage
function HalfCircleIcon({ className }: { className?: string }) {
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
function CoverageIcon({ status, className }: { status: 'covered' | 'partial' | 'missing'; className?: string }) {
  if (status === 'covered') {
    return <CheckCircle2 className={`${className} text-emerald-500`} />;
  }
  if (status === 'partial') {
    return <HalfCircleIcon className={`${className} text-amber-500`} />;
  }
  // missing
  return <XCircle className={`${className} text-red-400`} />;
}
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { SortableBlockItem } from "./ui/SortableBlockItem";
import { AssignDropdown } from "./ui/AssignDropdown";
import TipTapEditor from "../writing/TipTapEditor";
import { useIntentPanelContext } from "./IntentPanelContext";

// Soft accent colors to visually pair each intent row with its writing block
const ROW_ACCENTS = [
  '#93c5fd', // blue-300
  '#86efac', // green-300
  '#fdba74', // orange-300
  '#c4b5fd', // violet-300
  '#f9a8d4', // pink-300
  '#67e8f9', // cyan-300
  '#fcd34d', // amber-300
  '#fca5a5', // red-300
];

type IntentBlockCardProps = {
  block: IntentBlock;
  isRoot: boolean;
  depth: number;
  rootIndex?: number;
};

// Intent Update Preview Panel - shown when user clicks "Update Intent"
function IntentUpdatePreviewPanel({
  currentIntent,
  suggestedIntent,
  relatedImpacts,
  isLoading,
  onAccept,
  onCancel,
}: {
  currentIntent: string;
  suggestedIntent: string;
  relatedImpacts?: Array<{ id: string; content: string; impact: string }>;
  isLoading?: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
          Simulated Intent Change
        </span>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      {/* Current → New */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <Minus className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-600 dark:text-red-400 line-through">{currentIntent}</span>
        </div>
        <div className="flex items-start gap-2">
          <Plus className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-emerald-700 dark:text-emerald-300">{suggestedIntent}</span>
        </div>
      </div>

      {/* Loading state for impact assessment */}
      {isLoading && (
        <div className="flex items-center justify-center py-2 gap-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span>Assessing impact...</span>
        </div>
      )}

      {/* Impact on related sections */}
      {!isLoading && relatedImpacts && relatedImpacts.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-medium text-muted-foreground mb-1">POTENTIAL IMPACT</div>
          <div className="space-y-1">
            {relatedImpacts.map((impact, idx) => (
              <div key={idx} className="p-1.5 rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[10px]">
                <div className="font-medium text-amber-800 dark:text-amber-200 truncate">{impact.content}</div>
                <div className="text-amber-600 dark:text-amber-400">{impact.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
        >
          Apply Change
        </button>
      </div>
    </div>
  );
}

// Diff item component - looks similar to the outline intent blocks
function DiffIntentRow({
  intent,
  isRoot = false,
  isSelected,
  onToggleSelect,
}: {
  intent: SimulatedIntent;
  isRoot?: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
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
              <div className="text-[10px] text-muted-foreground line-through mt-0.5">
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
          <div className={`text-[11px] ${intent.status === 'removed' ? 'line-through text-red-600 dark:text-red-400' : ''}`}>
            {intent.content}
          </div>
          {intent.status === 'modified' && intent.originalContent && (
            <div className="text-[10px] text-muted-foreground line-through">
              was: {intent.originalContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Diff panel showing outline-style preview with checkboxes
function OutlineDiffPanel({
  simulatedOutline,
  currentChildren,
  rootBlock,
  currentUser,
  onChangeAndPropose,
  onStartDiscussion,
  onClose,
}: {
  simulatedOutline: SimulatedOutline;
  currentChildren: IntentBlock[];
  rootBlock: IntentBlock;
  currentUser: { id: string; email?: string | null; user_metadata?: { name?: string } };
  onChangeAndPropose: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onStartDiscussion: (selectedIds: Set<string>, mergedIntents: SimulatedIntent[]) => void;
  onClose: () => void;
}) {
  // Merge simulated intents with current children to detect removed ones
  const mergedChildren = useMemo(() => {
    const simulatedChildMap = new Map<string, SimulatedIntent>();
    simulatedOutline.intents
      .filter(i => i.parentId === rootBlock.id)
      .forEach(i => simulatedChildMap.set(i.id, i));

    const result: SimulatedIntent[] = [];
    const addedIds = new Set<string>();

    // First, add all current children (mark as removed if not in simulated)
    currentChildren.forEach((child, idx) => {
      const simulated = simulatedChildMap.get(child.id);
      if (simulated) {
        result.push(simulated);
        addedIds.add(child.id);
      } else {
        // This child is not in simulated outline - it should be removed
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

    // Then, add new intents from simulated that don't exist in current
    simulatedOutline.intents
      .filter(i => i.parentId === rootBlock.id && !addedIds.has(i.id))
      .forEach(i => result.push(i));

    // Sort by position
    return result.sort((a, b) => a.position - b.position);
  }, [simulatedOutline, currentChildren, rootBlock.id]);

  // Track selected changes
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

  // Get root intent (may be modified)
  const rootSimulated = simulatedOutline.intents.find(i => i.id === rootBlock.id) || {
    id: rootBlock.id,
    content: rootBlock.content,
    parentId: null,
    position: 0,
    status: 'existing' as const,
  };

  // Use merged children for display
  const displayChildren = mergedChildren;

  // Count changes from merged children (includes detected removals) and root
  const rootChangeCount = rootSimulated.status !== 'existing' ? 1 : 0;
  const changeCount = rootChangeCount + mergedChildren.filter(i => i.status !== 'existing').length;
  const selectedCount = selectedIds.size;

  return (
    <div className="w-72 flex-shrink-0 mx-2 border rounded-lg bg-card overflow-hidden flex flex-col max-h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Outline Diff</span>
          {changeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {changeCount} change{changeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview label */}
      <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-[10px] text-blue-700 dark:text-blue-300">
        Preview: Proposed outline based on writing
      </div>

      {/* Cross-section impacts (if any) */}
      {simulatedOutline.crossSectionImpacts && simulatedOutline.crossSectionImpacts.length > 0 && (
        <div className="px-3 py-2 border-b bg-amber-50/50 dark:bg-amber-950/20">
          <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">
            POTENTIAL IMPACT ON OTHER SECTIONS
          </div>
          <div className="space-y-1">
            {simulatedOutline.crossSectionImpacts.map((impact, idx) => (
              <div key={idx} className="text-[10px] text-amber-600 dark:text-amber-400">
                <span className="font-medium">{impact.sectionIntent.slice(0, 30)}...</span>
                {impact.description && <span className="text-muted-foreground"> - {impact.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff content - outline style */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Root intent */}
        <DiffIntentRow
          intent={rootSimulated}
          isRoot
          isSelected={selectedIds.has(rootSimulated.id)}
          onToggleSelect={() => toggleSelect(rootSimulated.id)}
        />

        {/* Child intents */}
        {displayChildren.map(child => (
          <DiffIntentRow
            key={child.id}
            intent={child}
            isSelected={selectedIds.has(child.id)}
            onToggleSelect={() => toggleSelect(child.id)}
          />
        ))}
      </div>

      {/* Footer - Two action buttons */}
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
              <div className="text-[10px] text-blue-200 font-normal">Others can see and modify</div>
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
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Requires input from others</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export function IntentBlockCard({ block, isRoot, depth, rootIndex = 0 }: IntentBlockCardProps) {
  const ctx = useIntentPanelContext();
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  // State for pending outline change (when user clicks "Make Change to Outline")
  const [pendingChange, setPendingChange] = useState<{
    suggestedIntent: string;
    orphanStart: string;
    relatedSections?: Array<{ id: string; content: string; impact: string }>;
    isLoadingImpact?: boolean;
  } | null>(null);
  // State for gap processing loading indicator
  const [isLoadingGapSuggestion, setIsLoadingGapSuggestion] = useState(false);

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.editingBlock === block.id;
  const isHovered = ctx.hoveredBlock === block.id;
  const isLinkSource = ctx.linkMode?.fromIntentId === block.id;
  const isHoveredFromWriting = ctx.hoveredIntentFromWriting === block.id;

  // Compute tint color when this block is an endpoint of the selected or hovered dependency
  const selectedDepColor = (() => {
    const activeDepId = ctx.selectedDepId || ctx.hoveredDepId;
    if (!activeDepId || !ctx.dependencies) return null;
    const dep = ctx.dependencies.find(d => d.id === activeDepId);
    if (!dep) return null;
    if (dep.fromIntentId === block.id || dep.toIntentId === block.id) {
      return ctx.depColorMap.get(dep.id) || null;
    }
    return null;
  })();

  // Find root ancestor for this block
  const getRootId = (b: IntentBlock): string => {
    if (!b.parentId) return b.id;
    const parent = ctx.blocks.find(p => p.id === b.parentId);
    return parent ? getRootId(parent) : b.id;
  };
  const rootId = getRootId(block);

  // Drift detection status
  const isRootChecking = ctx.driftCheckingIds?.has(rootId);
  const driftStatus = isRoot && !ctx.isSetupPhase ? ctx.getDriftStatus?.(block.id) : undefined;
  const sentenceHighlights = isRoot && !ctx.isSetupPhase ? ctx.getSentenceHighlights?.(block.id) : undefined;
  const simulatedOutline = isRoot && !ctx.isSetupPhase ? ctx.getSimulatedOutline?.(block.id) : undefined;
  const hasSimulatedChanges = simulatedOutline?.intents.some(i => i.status !== 'existing') ?? false;

  // Build intent coverage map for highlight colors
  const intentCoverageMap = useMemo(() => {
    if (!driftStatus?.intentCoverage) return undefined;
    const map = new Map<string, 'covered' | 'partial' | 'missing'>();
    driftStatus.intentCoverage.forEach(c => {
      map.set(c.intentId, c.status);
    });
    return map;
  }, [driftStatus?.intentCoverage]);

  // Build ordered intent coverage for inline display in Writing side
  // IMPORTANT: Only include CHILD intents, not root intent
  // Root intent's partial/missing is handled by the overall "Update Writing" button
  // Child intents get inline widgets at their correct positions
  const orderedIntentCoverage = useMemo(() => {
    if (!driftStatus?.intentCoverage) return undefined;

    // Filter out root intent - only include children
    return driftStatus.intentCoverage
      .filter(c => c.intentId !== block.id) // Exclude root
      .map((c) => {
        const intentBlock = children.find(b => b.id === c.intentId);
        const position = children.findIndex(ch => ch.id === c.intentId);

        return {
          intentId: c.intentId,
          intentContent: intentBlock?.content || 'Unknown intent',
          position,
          status: c.status,
          supportingSentences: c.supportingSentences || [],
          note: c.note,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [driftStatus?.intentCoverage, block.id, children]);

  // Root coverage status (compute from intentCoverage)
  const rootCoverageStatus = (() => {
    if (!driftStatus || !driftStatus.intentCoverage.length) return null;
    const allCovered = driftStatus.intentCoverage.every(c => c.status === 'covered');
    const anyMissing = driftStatus.intentCoverage.some(c => c.status === 'missing');
    if (allCovered) return 'covered';
    if (anyMissing) return 'missing';
    return 'partial';
  })();

  // For child blocks: get coverage status from parent's drift status
  const getChildCoverageStatus = () => {
    if (isRoot || ctx.isSetupPhase) return null;
    const parentDriftStatus = ctx.getDriftStatus?.(rootId);
    if (!parentDriftStatus) return null;
    const coverage = parentDriftStatus.intentCoverage.find(c => c.intentId === block.id);
    return coverage || null;
  };
  const childCoverageStatus = getChildCoverageStatus();

  // Accent color for pairing intent ↔ writing in writing phase
  const accentColor = isRoot && !ctx.isSetupPhase ? ROW_ACCENTS[rootIndex % ROW_ACCENTS.length] : null;

  // Sizes based on root vs child
  const chevronSize = isRoot ? "h-4 w-4" : "h-3 w-3";
  const iconSize = isRoot ? "h-3.5 w-3.5" : "h-3 w-3";
  const textClass = isRoot
    ? "w-full p-1.5 text-sm font-semibold border rounded focus:outline-none focus:ring-1 focus:ring-primary"
    : "w-full p-1 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-primary";
  const proseClass = isRoot
    ? "prose prose-sm max-w-none cursor-pointer hover:bg-secondary/30 rounded px-1.5 py-0.5 -ml-1.5 font-semibold"
    : "prose prose-xs max-w-none cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5 -ml-1 text-[13px]";
  const placeholder = isRoot ? "Enter section content..." : "Enter content...";

  // Drop indicator (root only)
  let dropIndicator = null;
  if (isRoot && ctx.dragOverId === block.id && ctx.activeId && ctx.activeId !== block.id) {
    const allBlocks = [...ctx.blocks].sort((a, b) => a.position - b.position);
    const activeIndex = allBlocks.findIndex(b => b.id === ctx.activeId);
    const overIndex = allBlocks.findIndex(b => b.id === block.id);
    const showTop = activeIndex > overIndex;

    dropIndicator = (
      <div className={`absolute left-0 right-0 h-0.5 bg-primary z-10 ${showTop ? '-top-1' : '-bottom-1'}`} />
    );
  }

  const renderChildren = () => {
    if (isCollapsed || children.length === 0) return null;

    return (
      <SortableContext
        items={children.map(b => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {children.map((child) => (
            <SortableBlockItem key={child.id} id={child.id}>
              <IntentBlockCard
                block={child}
                isRoot={false}
                depth={isRoot ? 1 : depth + 1}
              />
            </SortableBlockItem>
          ))}
        </div>
      </SortableContext>
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ctx.setEditingBlock(null);
      const newBlock = ctx.addBlock({ afterBlockId: block.id });
      ctx.setSelectedBlockId(newBlock.id);
      setTimeout(() => ctx.setEditingBlock(newBlock.id), 50);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        ctx.outdentBlock(block.id);
      } else {
        ctx.indentBlock(block.id);
      }
    }
  };

  // Handle gap action for root block (Update Intent or Update Writing)
  const handleRootGapAction = async (action: 'intent' | 'writing', coverage: { status: 'covered' | 'partial' | 'missing'; note?: string }) => {
    setIsLoadingGapSuggestion(true);
    try {
      // Get current writing content for context (only needed for writing action)
      let currentWriting = '';
      if (action === 'writing' && ctx.getWritingContent) {
        currentWriting = await ctx.getWritingContent(block.id);
      }

      const response = await fetch('/api/generate-gap-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: block.id,
          intentContent: block.content,
          coverageStatus: coverage.status,
          coverageNote: coverage.note,
          rootIntentId: block.id,
          action,
          currentWriting,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (action === 'intent' && data.suggestion?.intentUpdate) {
          // Set pending intent suggestion for preview (don't apply directly)
          ctx.setPendingIntentSuggestion({
            intentId: block.id,
            rootIntentId: block.id,
            currentContent: block.content,
            suggestedContent: data.suggestion.intentUpdate,
            isLoadingImpact: false,
            relatedImpacts: [],
          });
        } else if (action === 'writing' && data.suggestion) {
          // Set pending writing suggestion with simulation info
          ctx.setPendingWritingSuggestion({
            intentId: block.id,
            rootIntentId: block.id,
            intentContent: block.content,
            suggestedContent: data.suggestion.writingUpdate || data.suggestion.writingSimulation?.content || '',
            simulation: data.suggestion.writingSimulation,
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
    } finally {
      setIsLoadingGapSuggestion(false);
    }
  };

  // Handle "Add to Outline" - assess impact on related sections
  const handleAddToOutline = async (suggestedIntent: string, orphanStart: string) => {
    // Set pending change with loading state
    setPendingChange({
      suggestedIntent,
      orphanStart,
      isLoadingImpact: true,
      relatedSections: [],
    });

    // Find related sections via dependencies
    const relatedSections: Array<{
      id: string;
      intentContent: string;
      writingContent: string;
      relationship: string;
    }> = [];

    if (ctx.dependencies && isRoot) {
      // Find all dependencies involving this block
      const relevantDeps = ctx.dependencies.filter(
        d => d.fromIntentId === block.id || d.toIntentId === block.id
      );

      for (const dep of relevantDeps) {
        const relatedIntentId = dep.fromIntentId === block.id ? dep.toIntentId : dep.fromIntentId;
        // Find the root of the related intent
        const relatedBlock = ctx.blocks.find(b => b.id === relatedIntentId);
        if (!relatedBlock) continue;

        // Get root of related block
        let relatedRoot = relatedBlock;
        while (relatedRoot.parentId) {
          const parent = ctx.blocks.find(b => b.id === relatedRoot.parentId);
          if (parent) relatedRoot = parent;
          else break;
        }

        // Get writing content for related section
        const writingContent = ctx.getWritingContent
          ? await ctx.getWritingContent(relatedRoot.id)
          : '';

        relatedSections.push({
          id: relatedRoot.id,
          intentContent: relatedRoot.content,
          writingContent,
          relationship: dep.label || 'related',
        });
      }
    }

    // If no related sections, show panel immediately
    if (relatedSections.length === 0) {
      setPendingChange({
        suggestedIntent,
        orphanStart,
        isLoadingImpact: false,
        relatedSections: [],
      });
      return;
    }

    // Call API to assess impact
    try {
      const response = await fetch('/api/assess-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: block.id,
          sectionIntent: block.content,
          proposedIntent: suggestedIntent,
          relatedSections,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Convert impacts to crossSectionImpacts format
        const impactSections = data.impacts
          .filter((i: { impact: string }) => i.impact !== 'none')
          .map((i: { sectionId: string; sectionIntent: string; description: string }) => ({
            id: i.sectionId,
            content: i.sectionIntent,
            impact: i.description,
          }));

        setPendingChange({
          suggestedIntent,
          orphanStart,
          isLoadingImpact: false,
          relatedSections: impactSections,
        });
      } else {
        // On error, show panel without impact data
        setPendingChange({
          suggestedIntent,
          orphanStart,
          isLoadingImpact: false,
          relatedSections: [],
        });
      }
    } catch (error) {
      console.error('Failed to assess impact:', error);
      setPendingChange({
        suggestedIntent,
        orphanStart,
        isLoadingImpact: false,
        relatedSections: [],
      });
    }
  };

  // ── Root block layout ──
  if (isRoot) {
    const matchedWritingBlock = ctx.intentToWritingMap.get(block.id);

    return (
      <div className="mb-3 group relative">
        {dropIndicator}
        <div className="flex flex-row items-stretch">
          {/* Left Panel: Intent card + children */}
          <div
            ref={(el) => { ctx.registerBlockRef(block.id, el); }}
            className={ctx.isSetupPhase ? "w-[60%]" : "w-[30%] flex-shrink-0"}
            onMouseEnter={() => ctx.setHoveredBlock(block.id)}
            onMouseLeave={() => ctx.setHoveredBlock(null)}
            onClick={ctx.linkMode ? (e) => ctx.handleBlockClickForLink(block.id, e) : undefined}
          >
            <div
              className={`border rounded-lg p-3 transition-all ${
                isHoveredFromWriting
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-200"
                  : isLinkSource
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-300"
                    : ctx.linkMode
                      ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/10 cursor-pointer hover:border-blue-400"
                      : ctx.selectedBlockId === block.id
                        ? "border-primary bg-primary/5"
                        : "border-primary/30 bg-card"
              }`}
              style={{
                ...(selectedDepColor && !isHoveredFromWriting ? { backgroundColor: `${selectedDepColor}18` } : {}),
                ...(accentColor ? { borderLeftWidth: '3px', borderLeftColor: accentColor } : {}),
              }}
            >
              {/* Header Row */}
              <div className="flex items-start gap-2">
                {hasChildren && (
                  <button
                    onClick={() => ctx.toggleCollapse(block.id)}
                    className="flex-shrink-0 mt-1 hover:bg-secondary rounded p-0.5"
                  >
                    {isCollapsed ? <ChevronRight className={chevronSize} /> : <ChevronDown className={chevronSize} />}
                  </button>
                )}

                <div
                  className="flex-1 min-w-0"
                  onMouseEnter={() => ctx.setHoveredIntentForLink(block.id)}
                  onMouseLeave={() => ctx.setHoveredIntentForLink(null)}
                >
                  {isEditing ? (
                    <AutoResizeTextarea
                      value={block.content}
                      onChange={(val) => ctx.updateBlock(block.id, val)}
                      onBlur={() => ctx.setEditingBlock(null)}
                      onKeyDown={onKeyDown}
                      placeholder={placeholder}
                      className={textClass}
                      minRows={1}
                    />
                  ) : (
                    <div className={proseClass} onClick={() => ctx.setEditingBlock(block.id)}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {block.content || "*Click to edit...*"}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Coverage status for root intent */}
                  {driftStatus && (() => {
                    const rootCoverage = driftStatus.intentCoverage.find(c => c.intentId === block.id);
                    if (!rootCoverage) return null;

                    // If this block was modified, show previous content instead of coverage note
                    if (block.changeStatus === 'modified' && block.previousContent) {
                      return (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          <span className="line-through">{block.previousContent}</span>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-1.5">
                        <div className="flex items-start gap-1.5">
                          <CoverageIcon status={rootCoverage.status} className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          {rootCoverage.note && (
                            <span className={`text-[11px] ${
                              rootCoverage.status === 'covered' ? 'text-emerald-600 dark:text-emerald-400' :
                              rootCoverage.status === 'partial' ? 'text-amber-600 dark:text-amber-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {rootCoverage.note}
                            </span>
                          )}
                        </div>
                        {/* Inline action buttons for partial/missing root intents */}
                        {rootCoverage.status !== 'covered' && rootCoverage.note && (
                          <div className={`text-[10px] mt-1 flex items-center gap-2 flex-wrap ${
                            rootCoverage.status === 'partial'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            <span className="inline-flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRootGapAction('intent', rootCoverage);
                                }}
                                disabled={isLoadingGapSuggestion}
                                className="text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                              >
                                Update Intent
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRootGapAction('writing', rootCoverage);
                                }}
                                disabled={isLoadingGapSuggestion}
                                className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                              >
                                Update Writing
                              </button>
                              {isLoadingGapSuggestion && (
                                <span className="text-[9px] text-muted-foreground italic ml-1">generating...</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Intent Update Preview Panel - shown when pending intent suggestion for this root block */}
                  {ctx.pendingIntentSuggestion?.intentId === block.id && (
                    <IntentUpdatePreviewPanel
                      currentIntent={ctx.pendingIntentSuggestion.currentContent}
                      suggestedIntent={ctx.pendingIntentSuggestion.suggestedContent}
                      relatedImpacts={ctx.pendingIntentSuggestion.relatedImpacts}
                      isLoading={ctx.pendingIntentSuggestion.isLoadingImpact}
                      onAccept={() => {
                        // Apply the intent change
                        ctx.updateIntentBlockRaw(block.id, {
                          previousContent: block.content,
                          changeStatus: 'modified',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                        });
                        ctx.updateBlock(block.id, ctx.pendingIntentSuggestion!.suggestedContent);
                        ctx.setPendingIntentSuggestion(null);
                        setTimeout(() => ctx.triggerCheck?.(block.id), 500);
                      }}
                      onCancel={() => ctx.setPendingIntentSuggestion(null)}
                    />
                  )}
                </div>

                {/* Inline assignee pill */}
                <div className="flex-shrink-0">
                  <AssignDropdown
                    block={block}
                    currentUser={ctx.currentUser}
                    documentMembers={ctx.documentMembers}
                    onlineUserIds={ctx.onlineUserIds}
                    userAvatarMap={ctx.userAvatarMap}
                    assignBlock={ctx.assignBlock}
                    unassignBlock={ctx.unassignBlock}
                  />
                </div>

                {/* Right side: Link + Indent/Outdent + Delete — opacity transition */}
                <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                  {ctx.isSetupPhase && ctx.addDependency && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        ctx.setLinkMode(isLinkSource ? null : { fromIntentId: block.id });
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLinkSource ? 'bg-blue-100 text-blue-600' : 'hover:bg-secondary'
                      }`}
                      title={isLinkSource ? 'Cancel linking' : 'Link to another intent'}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {block.level > 0 && (
                    <button onClick={() => ctx.outdentBlock(block.id)} className="p-1 hover:bg-secondary rounded" title="Outdent (move left)">
                      <ChevronLeft className={iconSize} />
                    </button>
                  )}
                  <button onClick={() => ctx.indentBlock(block.id)} className="p-1 hover:bg-secondary rounded" title="Indent (move right)">
                    <ChevronRight className={iconSize} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this section and all its children?")) {
                        ctx.deleteBlock(block.id);
                      }
                    }}
                    className="p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>

              </div>
            </div>

            {/* Render children */}
            {renderChildren()}

            {/* View Outline Diff button - shown when there are simulated changes */}
            {!ctx.isSetupPhase && hasSimulatedChanges && (
              <button
                onClick={() => setShowDiffPreview(!showDiffPreview)}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  showDiffPreview
                    ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/50"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {showDiffPreview ? "Hide Outline Diff" : "View Outline Diff"}
              </button>
            )}
          </div>

          {/* Spacer/Diff Preview + Writing panel — hidden in setup phase */}
          {!ctx.isSetupPhase && (
            <div className="flex-1 min-w-0 flex flex-row items-stretch">
              {/* Outline Diff Panel (when user clicks "Add to Outline" or "View Outline Diff") */}
              {pendingChange ? (
                // Use existing simulatedOutline if available (has correct positions from AI),
                // otherwise create one with just the new intent
                <OutlineDiffPanel
                  simulatedOutline={(() => {
                    // Check if we have a simulatedOutline with this orphan's intent
                    if (simulatedOutline) {
                      const matchingIntent = simulatedOutline.intents.find(
                        i => i.sourceOrphanStart === pendingChange.orphanStart && i.status === 'new'
                      );
                      if (matchingIntent) {
                        // Use the full simulatedOutline - it has correct positions
                        return {
                          ...simulatedOutline,
                          crossSectionImpacts: [
                            ...(simulatedOutline.crossSectionImpacts || []),
                            ...(pendingChange.relatedSections?.map(s => ({
                              sectionId: s.id,
                              sectionIntent: s.content,
                              impactType: 'needs-update' as const,
                              description: s.impact,
                            })) || []),
                          ],
                        };
                      }
                    }
                    // Fallback: create a simple outline with new intent at end
                    return {
                      intents: [
                        { id: block.id, content: block.content, parentId: null, position: 0, status: 'existing' as const },
                        ...children.map((c, idx) => ({
                          id: c.id,
                          content: c.content,
                          parentId: block.id,
                          position: idx,
                          status: 'existing' as const,
                        })),
                        {
                          id: `new-${Date.now()}`,
                          content: pendingChange.suggestedIntent,
                          parentId: block.id,
                          position: children.length,
                          status: 'new' as const,
                          sourceOrphanStart: pendingChange.orphanStart,
                        },
                      ],
                      crossSectionImpacts: pendingChange.relatedSections?.map(s => ({
                        sectionId: s.id,
                        sectionIntent: s.content,
                        impactType: 'needs-update' as const,
                        description: s.impact,
                      })) || [],
                      summary: 'Add new intent based on writing content',
                    };
                  })()}
                  currentChildren={children}
                  rootBlock={block}
                  currentUser={ctx.currentUser}
                  onClose={() => setPendingChange(null)}
                  onChangeAndPropose={(selectedIds, mergedIntents) => {
                    // Apply selected changes with correct positions
                    const sortedIntents = mergedIntents
                      .filter(i => selectedIds.has(i.id) && i.status !== 'existing')
                      .sort((a, b) => a.position - b.position);

                    sortedIntents.forEach((intent, idx) => {
                      if (intent.status === 'new' && intent.content) {
                        // Find the block to insert after based on position
                        const sortedChildren = [...children].sort((a, b) => a.position - b.position);
                        const insertAfterBlock = sortedChildren[intent.position - 1];

                        const newBlock = insertAfterBlock
                          ? ctx.addBlock({ afterBlockId: insertAfterBlock.id })
                          : ctx.addBlock({ asChildOf: block.id });
                        ctx.updateBlock(newBlock.id, intent.content);
                        ctx.updateIntentBlockRaw(newBlock.id, {
                          changeStatus: 'added',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                        });
                        if (intent.sourceOrphanStart) {
                          ctx.markOrphanHandled(intent.sourceOrphanStart);
                        }
                      }
                    });
                    setPendingChange(null);
                    setTimeout(() => ctx.triggerCheck?.(block.id), 500);
                  }}
                  onStartDiscussion={(selectedIds, mergedIntents) => {
                    // Apply selected changes as proposed with correct positions
                    const sortedIntents = mergedIntents
                      .filter(i => selectedIds.has(i.id) && i.status !== 'existing')
                      .sort((a, b) => a.position - b.position);

                    sortedIntents.forEach((intent, idx) => {
                      if (intent.status === 'new' && intent.content) {
                        const sortedChildren = [...children].sort((a, b) => a.position - b.position);
                        const insertAfterBlock = sortedChildren[intent.position - 1];

                        const newBlock = insertAfterBlock
                          ? ctx.addBlock({ afterBlockId: insertAfterBlock.id })
                          : ctx.addBlock({ asChildOf: block.id });
                        ctx.updateBlock(newBlock.id, intent.content);
                        ctx.updateIntentBlockRaw(newBlock.id, {
                          changeStatus: 'proposed',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                          proposalStatus: 'pending',
                        });
                        if (intent.sourceOrphanStart) {
                          ctx.markOrphanHandled(intent.sourceOrphanStart);
                        }
                      }
                    });
                    setPendingChange(null);
                  }}
                />
              ) : showDiffPreview && simulatedOutline ? (
                <OutlineDiffPanel
                  simulatedOutline={simulatedOutline}
                  currentChildren={children}
                  rootBlock={block}
                  currentUser={ctx.currentUser}
                  onClose={() => setShowDiffPreview(false)}
                  onChangeAndPropose={(selectedIds, mergedIntents) => {
                    // Apply selected changes with correct positions
                    const sortedIntents = mergedIntents
                      .filter(i => selectedIds.has(i.id) && i.status !== 'existing')
                      .sort((a, b) => a.position - b.position);

                    const sortedChildren = [...children].sort((a, b) => a.position - b.position);

                    sortedIntents.forEach(intent => {
                      if (intent.status === 'new' && intent.content) {
                        // Insert at correct position
                        const insertAfterBlock = sortedChildren[intent.position - 1];
                        const newBlock = insertAfterBlock
                          ? ctx.addBlock({ afterBlockId: insertAfterBlock.id })
                          : ctx.addBlock({ asChildOf: block.id });
                        ctx.updateBlock(newBlock.id, intent.content);
                        ctx.updateIntentBlockRaw(newBlock.id, {
                          changeStatus: 'added',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                        });
                        if (intent.sourceOrphanStart) {
                          ctx.markOrphanHandled(intent.sourceOrphanStart);
                        }
                      } else if (intent.status === 'modified') {
                        ctx.updateBlock(intent.id, intent.content);
                        ctx.updateIntentBlockRaw(intent.id, {
                          changeStatus: 'modified',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                        });
                      } else if (intent.status === 'removed') {
                        ctx.updateIntentBlockRaw(intent.id, {
                          changeStatus: 'removed',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                        });
                      }
                    });
                    setShowDiffPreview(false);
                    setTimeout(() => ctx.triggerCheck?.(block.id), 500);
                  }}
                  onStartDiscussion={(selectedIds, mergedIntents) => {
                    // Apply selected changes as proposed with correct positions
                    const sortedIntents = mergedIntents
                      .filter(i => selectedIds.has(i.id) && i.status !== 'existing')
                      .sort((a, b) => a.position - b.position);

                    const sortedChildren = [...children].sort((a, b) => a.position - b.position);

                    sortedIntents.forEach(intent => {
                      if (intent.status === 'new' && intent.content) {
                        const insertAfterBlock = sortedChildren[intent.position - 1];
                        const newBlock = insertAfterBlock
                          ? ctx.addBlock({ afterBlockId: insertAfterBlock.id })
                          : ctx.addBlock({ asChildOf: block.id });
                        ctx.updateBlock(newBlock.id, intent.content);
                        ctx.updateIntentBlockRaw(newBlock.id, {
                          changeStatus: 'proposed',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                          proposalStatus: 'pending',
                        });
                        if (intent.sourceOrphanStart) {
                          ctx.markOrphanHandled(intent.sourceOrphanStart);
                        }
                      } else if (intent.status === 'modified') {
                        ctx.updateBlock(intent.id, intent.content);
                        ctx.updateIntentBlockRaw(intent.id, {
                          changeStatus: 'proposed',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                          proposalStatus: 'pending',
                        });
                      } else if (intent.status === 'removed') {
                        ctx.updateIntentBlockRaw(intent.id, {
                          changeStatus: 'removed',
                          changeBy: ctx.currentUser.id,
                          changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                          changeAt: Date.now(),
                          proposalStatus: 'pending',
                        });
                      }
                      });
                    setShowDiffPreview(false);
                  }}
                />
              ) : (
                <div className="w-36 flex-shrink-0" />
              )}
              <div
                className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden"
                style={accentColor ? { borderLeftWidth: '3px', borderLeftColor: accentColor } : undefined}
              >
              {matchedWritingBlock ? (
                <TipTapEditor
                  intent={block}
                  writingBlock={matchedWritingBlock}
                  roomId={ctx.roomId}
                  user={ctx.currentUser}
                  writingBlocks={ctx.writingBlocks as WritingBlock[]}
                  deleteWritingBlock={ctx.deleteWritingBlock}
                  updateIntentBlock={ctx.updateIntentBlockRaw}
                  onRegisterYjsExporter={ctx.onRegisterYjsExporter}
                  onRegisterMarkdownExporter={ctx.onRegisterMarkdownExporter}
                  onCheckAlignment={() => ctx.triggerCheck?.(block.id)}
                  isCheckingAlignment={isRootChecking}
                  sentenceHighlights={sentenceHighlights}
                  hoveredIntentForLink={ctx.hoveredIntentForLink}
                  hoveredOrphanHint={ctx.hoveredOrphanHint}
                  onMakeChangeToOutline={(suggestedIntent, orphanStart) => {
                    handleAddToOutline(suggestedIntent, orphanStart);
                  }}
                  onDismissOrphan={(orphanStart) => {
                    console.log('Dismissed orphan:', orphanStart);
                  }}
                  onHoverIntentFromWriting={ctx.setHoveredIntentFromWriting}
                  handledOrphanStarts={ctx.handledOrphanStarts}
                  markOrphanHandled={ctx.markOrphanHandled}
                  intentCoverageMap={intentCoverageMap}
                  orderedIntentCoverage={orderedIntentCoverage}
                  onAddMissingContent={async (intentId, intentContent) => {
                    // Generate writing suggestion for the missing intent
                    const coverage = orderedIntentCoverage?.find(c => c.intentId === intentId);
                    if (!coverage || coverage.status === 'covered') return;

                    setIsLoadingGapSuggestion(true);
                    try {
                      const currentWriting = ctx.getWritingContent
                        ? await ctx.getWritingContent(block.id)
                        : '';

                      const response = await fetch('/api/generate-gap-suggestion', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          intentId,
                          intentContent,
                          coverageStatus: coverage.status,
                          coverageNote: coverage.note,
                          rootIntentId: block.id,
                          action: 'writing',
                          currentWriting,
                        }),
                      });

                      if (response.ok) {
                        const data = await response.json();
                        if (data.suggestion) {
                          ctx.setPendingWritingSuggestion({
                            intentId,
                            rootIntentId: block.id,
                            intentContent,
                            suggestedContent: data.suggestion.writingUpdate || data.suggestion.writingSimulation?.content || '',
                            simulation: data.suggestion.writingSimulation,
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Failed to generate suggestion:', error);
                    } finally {
                      setIsLoadingGapSuggestion(false);
                    }
                  }}
                  pendingWritingSuggestion={ctx.pendingWritingSuggestion}
                  onClearWritingSuggestion={() => ctx.setPendingWritingSuggestion(null)}
                  onModifyIntent={async (intentId) => {
                    // Generate intent modification suggestion
                    const coverage = orderedIntentCoverage?.find(c => c.intentId === intentId);
                    if (!coverage || coverage.status === 'covered') return;

                    setIsLoadingGapSuggestion(true);
                    try {
                      const response = await fetch('/api/generate-gap-suggestion', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          intentId,
                          intentContent: coverage.intentContent,
                          coverageStatus: coverage.status,
                          coverageNote: coverage.note,
                          rootIntentId: block.id,
                          action: 'intent',
                        }),
                      });

                      if (response.ok) {
                        const data = await response.json();
                        if (data.suggestion?.intentUpdate) {
                          ctx.setPendingIntentSuggestion({
                            intentId,
                            rootIntentId: block.id,
                            currentContent: coverage.intentContent,
                            suggestedContent: data.suggestion.intentUpdate,
                            isLoadingImpact: false,
                            relatedImpacts: [],
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Failed to generate suggestion:', error);
                    } finally {
                      setIsLoadingGapSuggestion(false);
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
                  Loading editor...
                </div>
              )}
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  // ── Child block layout ──
  // Determine border color based on coverage status
  const childBorderClass = (() => {
    if (block.changeStatus === 'removed') return "border-red-300 dark:border-red-700";
    if (isHoveredFromWriting) return "border-emerald-500";
    if (isLinkSource) return "border-blue-500";
    if (ctx.linkMode) return "border-blue-300";
    if (ctx.selectedBlockId === block.id) return "border-primary";
    if (childCoverageStatus) {
      if (childCoverageStatus.status === 'covered') return "border-emerald-400";
      if (childCoverageStatus.status === 'partial') return "border-amber-400";
      if (childCoverageStatus.status === 'missing') return "border-red-400";
    }
    return "border-border";
  })();

  const childBgClass = (() => {
    if (block.changeStatus === 'removed') return "bg-red-50/50 dark:bg-red-950/20";
    if (isHoveredFromWriting) return "bg-emerald-50 dark:bg-emerald-950/30";
    if (isLinkSource) return "bg-blue-50 dark:bg-blue-950/30";
    if (ctx.linkMode) return "bg-blue-50/50 dark:bg-blue-950/10 cursor-pointer";
    if (ctx.selectedBlockId === block.id) return "bg-primary/5";
    return "";
  })();

  // Handle gap action (Update Intent or Update Writing)
  const handleGapAction = async (action: 'intent' | 'writing') => {
    if (!childCoverageStatus) return;

    setIsLoadingGapSuggestion(true);
    try {
      // Get current writing content for context (only needed for writing action)
      let currentWriting = '';
      if (action === 'writing' && ctx.getWritingContent) {
        currentWriting = await ctx.getWritingContent(rootId);
      }

      const response = await fetch('/api/generate-gap-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: block.id,
          intentContent: block.content,
          coverageStatus: childCoverageStatus.status,
          coverageNote: childCoverageStatus.note,
          rootIntentId: rootId,
          action,
          currentWriting,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (action === 'intent' && data.suggestion?.intentUpdate) {
          // Set pending intent suggestion for preview (don't apply directly)
          ctx.setPendingIntentSuggestion({
            intentId: block.id,
            rootIntentId: rootId,
            currentContent: block.content,
            suggestedContent: data.suggestion.intentUpdate,
            isLoadingImpact: false,
            relatedImpacts: [],
          });
        } else if (action === 'writing' && data.suggestion) {
          // Set pending writing suggestion with simulation info
          ctx.setPendingWritingSuggestion({
            intentId: block.id,
            rootIntentId: rootId,
            intentContent: block.content,
            suggestedContent: data.suggestion.writingUpdate || data.suggestion.writingSimulation?.content || '',
            simulation: data.suggestion.writingSimulation,
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
    } finally {
      setIsLoadingGapSuggestion(false);
    }
  };

  return (
    <div
      ref={(el) => { ctx.registerBlockRef(block.id, el); }}
      style={{ marginLeft: `${depth * 16}px` }}
      className="mt-1 group/child"
      onMouseEnter={() => {
        ctx.setHoveredBlock(block.id);
        ctx.setHoveredIntentForLink(block.id);
      }}
      onMouseLeave={() => {
        ctx.setHoveredBlock(null);
        ctx.setHoveredIntentForLink(null);
      }}
      onClick={ctx.linkMode ? (e) => ctx.handleBlockClickForLink(block.id, e) : undefined}
    >
      <div
        className={`border-l-2 pl-3 py-1.5 rounded-r transition-all ${childBorderClass} ${childBgClass}`}
        style={selectedDepColor ? { backgroundColor: `${selectedDepColor}18` } : undefined}
      >
        <div className="flex items-start gap-2">
          {/* Change status badge (for changes made during writing phase) */}
          {block.changeStatus && (
            <div className="flex-shrink-0">
              {block.changeStatus === 'added' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded">
                  <Plus className="h-2.5 w-2.5" />
                  NEW
                </span>
              )}
              {block.changeStatus === 'modified' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded">
                  <Edit2 className="h-2.5 w-2.5" />
                  MODIFIED
                </span>
              )}
              {block.changeStatus === 'proposed' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">
                  <Edit2 className="h-2.5 w-2.5" />
                  PROPOSED
                </span>
              )}
              {block.changeStatus === 'removed' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded">
                  <Minus className="h-2.5 w-2.5" />
                  REMOVED
                </span>
              )}
            </div>
          )}

          {/* Coverage status icon (when in writing phase) */}
          {childCoverageStatus && !block.changeStatus && (
            <div className="flex-shrink-0 mt-0.5">
              <CoverageIcon status={childCoverageStatus.status} className="h-3.5 w-3.5" />
            </div>
          )}

          {hasChildren && (
            <button
              onClick={() => ctx.toggleCollapse(block.id)}
              className="flex-shrink-0 mt-0.5 hover:bg-secondary rounded p-0.5"
            >
              {isCollapsed ? <ChevronRight className={chevronSize} /> : <ChevronDown className={chevronSize} />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            {isEditing && block.changeStatus !== 'removed' ? (
              <AutoResizeTextarea
                value={block.content}
                onChange={(val) => ctx.updateBlock(block.id, val)}
                onBlur={() => ctx.setEditingBlock(null)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={textClass}
                minRows={1}
              />
            ) : (
              <div
                className={`${proseClass} ${block.changeStatus === 'removed' ? 'line-through text-red-500 dark:text-red-400 opacity-70' : ''}`}
                onClick={() => block.changeStatus !== 'removed' && ctx.setEditingBlock(block.id)}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content || "*Click to edit...*"}
                </ReactMarkdown>
              </div>
            )}

            {/* Show previous content if modified, otherwise show coverage note with action buttons */}
            {block.changeStatus === 'modified' && block.previousContent ? (
              <div className="text-[10px] mt-0.5 text-muted-foreground">
                <span className="line-through">{block.previousContent}</span>
              </div>
            ) : (
              childCoverageStatus && childCoverageStatus.note && childCoverageStatus.status !== 'covered' && (
                <div className={`text-[10px] mt-0.5 flex items-center gap-2 flex-wrap ${
                  childCoverageStatus.status === 'partial'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <span>{childCoverageStatus.note}</span>
                  <span className="inline-flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Generate and apply intent update
                        handleGapAction('intent');
                      }}
                      disabled={isLoadingGapSuggestion}
                      className="text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      Update Intent
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Generate and show writing suggestion
                        handleGapAction('writing');
                      }}
                      disabled={isLoadingGapSuggestion}
                      className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                    >
                      Update Writing
                    </button>
                    {isLoadingGapSuggestion && (
                      <span className="text-[9px] text-muted-foreground italic ml-1">generating...</span>
                    )}
                  </span>
                </div>
              )
            )}

            {/* Intent Update Preview Panel - shown when pending intent suggestion for this block */}
            {ctx.pendingIntentSuggestion?.intentId === block.id && (
              <IntentUpdatePreviewPanel
                currentIntent={ctx.pendingIntentSuggestion.currentContent}
                suggestedIntent={ctx.pendingIntentSuggestion.suggestedContent}
                relatedImpacts={ctx.pendingIntentSuggestion.relatedImpacts}
                isLoading={ctx.pendingIntentSuggestion.isLoadingImpact}
                onAccept={() => {
                  // Apply the intent change
                  ctx.updateIntentBlockRaw(block.id, {
                    previousContent: block.content,
                    changeStatus: 'modified',
                    changeBy: ctx.currentUser.id,
                    changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
                    changeAt: Date.now(),
                  });
                  ctx.updateBlock(block.id, ctx.pendingIntentSuggestion!.suggestedContent);
                  ctx.setPendingIntentSuggestion(null);
                  setTimeout(() => ctx.triggerCheck?.(rootId), 500);
                }}
                onCancel={() => ctx.setPendingIntentSuggestion(null)}
              />
            )}

            {/* Show who made the change */}
            {block.changeStatus && block.changeByName && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {block.changeStatus === 'added' ? 'Added' :
                 block.changeStatus === 'modified' ? 'Modified' :
                 block.changeStatus === 'removed' ? 'Marked for removal' :
                 'Proposed'} by {block.changeByName}
              </div>
            )}

            {/* Assignee for child block — only when assigned */}
            {block.assignee && (
              <div className="mt-1">
                <AssignDropdown
                  block={block}
                  currentUser={ctx.currentUser}
                  documentMembers={ctx.documentMembers}
                  onlineUserIds={ctx.onlineUserIds}
                  userAvatarMap={ctx.userAvatarMap}
                  assignBlock={ctx.assignBlock}
                  unassignBlock={ctx.unassignBlock}
                  compact
                />
              </div>
            )}
          </div>

          {/* Action icons — opacity transition instead of conditional mount */}
          <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            {ctx.isSetupPhase && ctx.addDependency && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  ctx.setLinkMode(isLinkSource ? null : { fromIntentId: block.id });
                }}
                className={`p-0.5 rounded transition-colors ${
                  isLinkSource ? 'bg-blue-100 text-blue-600' : 'hover:bg-secondary'
                }`}
                title={isLinkSource ? 'Cancel linking' : 'Link to another intent'}
              >
                <Link2 className={iconSize} />
              </button>
            )}
            {block.level > 0 && (
              <button onClick={() => ctx.outdentBlock(block.id)} className="flex-shrink-0 p-0.5 hover:bg-secondary rounded" title="Outdent">
                <ChevronLeft className={iconSize} />
              </button>
            )}
            <button onClick={() => ctx.indentBlock(block.id)} className="flex-shrink-0 p-0.5 hover:bg-secondary rounded" title="Indent">
              <ChevronRight className={iconSize} />
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this item?")) {
                  ctx.deleteBlock(block.id);
                }
              }}
              className="flex-shrink-0 p-0.5 hover:bg-destructive/10 rounded"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>

        </div>
      </div>

      {/* Render children */}
      {renderChildren()}
    </div>
  );
}
