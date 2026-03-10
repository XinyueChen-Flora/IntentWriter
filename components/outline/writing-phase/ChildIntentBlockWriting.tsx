"use client";

import { useState, useRef, useEffect } from "react";
import type { IntentBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Pencil, MessageSquare, MoreHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableBlockItem } from "../ui/SortableBlockItem";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon, AiBadge } from "../ui/CoverageIcons";
import { ChangeStatusBadge } from "../ui/ChangeStatusBadge";
import { WordDiff } from "@/components/simulate/WordDiff";
import UserAvatar from "@/components/user/UserAvatar";

type ChildIntentBlockWritingProps = {
  block: IntentBlock;
  depth: number;
};

export function ChildIntentBlockWriting({ block, depth }: ChildIntentBlockWritingProps) {
  const ctx = useIntentPanelContext();

  // Action menu
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close action menu on outside click
  useEffect(() => {
    if (!showActions) return;
    const handleClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActions]);

  // ─── Derived state ───

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isHoveredFromWriting = ctx.hoveredIntentFromWriting === block.id;
  const isHoveredFromSummary = ctx.hoveredIntentForLink === block.id;
  const isAiCovered = ctx.aiCoveredIntents?.has(block.id) || false;

  const getRootId = (b: IntentBlock): string => {
    if (!b.parentId) return b.id;
    const parent = ctx.blocks.find(p => p.id === b.parentId);
    return parent ? getRootId(parent) : b.id;
  };
  const rootId = getRootId(block);

  const childCoverageStatus = (() => {
    const parentDriftStatus = ctx.getDriftStatus?.(rootId);
    if (!parentDriftStatus) return null;
    return parentDriftStatus.intentCoverage.find(c => c.intentId === block.id) || null;
  })();

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

  // Highlight if this block is the trigger for an active proposal draft
  const isProposalTrigger = ctx.proposalDraft?.triggerIntentId === block.id;

  const borderClass = (() => {
    if (isProposalTrigger) return "border-blue-500 dark:border-blue-400";
    if (block.changeStatus === 'removed') return "border-red-500 dark:border-red-600";
    if (isHoveredFromWriting || isHoveredFromSummary) {
      if (childCoverageStatus?.status === 'partial') return "border-amber-600";
      if (childCoverageStatus?.status === 'missing') return "border-red-600";
      return "border-emerald-600";
    }
    if (ctx.selectedBlockId === block.id) return "border-primary";
    if (childCoverageStatus) {
      if (childCoverageStatus.status === 'partial') return "border-amber-600";
      if (childCoverageStatus.status === 'missing') return "border-red-600";
    }
    return "border-border";
  })();

  const bgClass = (() => {
    if (block.changeStatus === 'removed') return "bg-red-50/30 dark:bg-red-950/30";
    if (isHoveredFromWriting || isHoveredFromSummary) {
      if (childCoverageStatus?.status === 'partial') return "bg-amber-50/50 dark:bg-amber-950/40";
      if (childCoverageStatus?.status === 'missing') return "bg-red-50/50 dark:bg-red-950/40";
      return "bg-emerald-50/50 dark:bg-emerald-950/40";
    }
    if (ctx.selectedBlockId === block.id) return "bg-primary/5";
    return "bg-card";
  })();

  // ─── Render ───

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
              <ChildIntentBlockWriting block={child} depth={depth + 1} />
            </SortableBlockItem>
          ))}
        </div>
      </SortableContext>
    );
  };

  return (
    <div style={{ marginLeft: `${depth * 16}px` }} className="mt-1.5 group/child">
      <div
        ref={(el) => { ctx.registerBlockRef(block.id, el); }}
        data-block-id={block.id}
        onMouseEnter={() => {
          ctx.setHoveredBlock(block.id);
          ctx.setHoveredIntentForLink(block.id);
        }}
        onMouseLeave={() => {
          ctx.setHoveredBlock(null);
          ctx.setHoveredIntentForLink(null);
        }}
        className={`border rounded-lg px-3 py-1.5 transition-all shadow-sm hover:shadow-md hover:border-primary/50 ${borderClass} ${
          selectedDepColor ? "bg-primary/20 border-primary" : bgClass
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Coverage icon */}
          {childCoverageStatus && !block.changeStatus && (
            <div className="flex-shrink-0 mt-0.5">
              <CoverageIcon status={childCoverageStatus.status} aiCovered={isAiCovered} className="h-3.5 w-3.5" />
            </div>
          )}

          {hasChildren && (
            <button
              onClick={() => ctx.toggleCollapse(block.id)}
              className="flex-shrink-0 mt-0.5 hover:bg-secondary rounded p-0.5"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Content — always locked */}
          <div className="flex-1 min-w-0">
            <div
              className={`prose prose-sm max-w-none rounded px-1 py-0.5 ${
                block.changeStatus === 'removed' ? 'line-through text-red-500 dark:text-red-400 opacity-70' : ''
              }`}
            >
              {(block.changeStatus === 'proposed' || block.changeStatus === 'modified') && block.previousContent && block.previousContent !== block.content ? (
                <WordDiff oldText={block.previousContent} newText={block.content} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content || "*empty*"}
                </ReactMarkdown>
              )}
            </div>

            {/* Change trace — compact line below content */}
            {block.changeStatus && block.changeBy && (
              <div className="mt-0.5 px-1">
                {block.proposalId ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx.setViewingProposalId(block.proposalId!);
                      ctx.setViewingProposalForSectionId(rootId);
                      ctx.setViewingProposalAffectedSectionId(rootId);
                    }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <ChangeStatusBadge
                      status={block.changeStatus}
                      changeByAvatar={ctx.userAvatarMap.get(block.changeBy!)}
                      changeBy={block.changeByName}
                      changeAt={block.changeAt}
                    />
                  </button>
                ) : (
                  <ChangeStatusBadge
                    status={block.changeStatus}
                    changeByAvatar={ctx.userAvatarMap.get(block.changeBy!)}
                    changeBy={block.changeByName}
                    changeAt={block.changeAt}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right side: indicators + action trigger */}
          <div className="flex items-center gap-1 flex-shrink-0 relative">
            {isAiCovered && <AiBadge />}

            {/* Action button */}
            {block.changeStatus !== 'removed' && (
              <button
                onClick={() => setShowActions(prev => !prev)}
                className={`p-1 rounded-md transition-all ${
                  showActions
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground/0 hover:text-muted-foreground hover:bg-muted group-hover/child:text-muted-foreground/60'
                }`}
                title="Actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Action menu — 2 options */}
            {showActions && (
              <div
                ref={actionsRef}
                className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-1 min-w-[220px]"
              >
                <button
                  onClick={() => {
                    setShowActions(false);
                    ctx.openProposalDraft(rootId, 'change', block.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors text-left"
                >
                  <Pencil className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Propose a change</div>
                    <div className="text-xs text-muted-foreground">Edit this section&apos;s outline</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowActions(false);
                    ctx.openProposalDraft(rootId, 'comment', block.id);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors text-left"
                >
                  <MessageSquare className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Leave a comment</div>
                    <div className="text-xs text-muted-foreground">Share a thought about this item</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {renderChildren()}
    </div>
  );
}
