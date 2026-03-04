"use client";

import { useState } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Trash2, ChevronLeft, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { SortableBlockItem } from "../ui/SortableBlockItem";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon } from "../ui/CoverageIcons";
import { ChangeStatusBadge } from "../ui/ChangeStatusBadge";
import { IntentUpdatePreviewPanel } from "../ui/IntentUpdatePreview";

type ChildIntentBlockProps = {
  block: IntentBlock;
  depth: number;
};

export function ChildIntentBlock({ block, depth }: ChildIntentBlockProps) {
  const ctx = useIntentPanelContext();
  const [isLoadingGapSuggestion, setIsLoadingGapSuggestion] = useState(false);

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.editingBlock === block.id;
  const isHovered = ctx.hoveredBlock === block.id;
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

  // For child blocks: get coverage status from parent's drift status
  const getChildCoverageStatus = () => {
    if (ctx.isSetupPhase) return null;
    const parentDriftStatus = ctx.getDriftStatus?.(rootId);
    if (!parentDriftStatus) return null;
    const coverage = parentDriftStatus.intentCoverage.find(c => c.intentId === block.id);
    return coverage || null;
  };
  const childCoverageStatus = getChildCoverageStatus();

  // Sizes
  const chevronSize = "h-3.5 w-3.5";
  const iconSize = "h-3 w-3";
  const textClass = "w-full px-1 py-0.5 text-sm bg-transparent border-0 focus:outline-none focus:bg-primary/5 rounded";
  const proseClass = "prose prose-sm max-w-none cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors";

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

  // Handle gap action (Update Intent or Update Writing)
  const handleGapAction = async (action: 'intent' | 'writing') => {
    if (!childCoverageStatus) return;

    setIsLoadingGapSuggestion(true);
    try {
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
          ctx.setPendingIntentSuggestion({
            intentId: block.id,
            rootIntentId: rootId,
            currentContent: block.content,
            suggestedContent: data.suggestion.intentUpdate,
            isLoadingImpact: false,
            relatedImpacts: [],
          });
        } else if (action === 'writing' && data.suggestion) {
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

  // Border and background classes
  const childBorderClass = (() => {
    if (block.changeStatus === 'removed') return "border-red-300 dark:border-red-700";
    if (isHoveredFromWriting) return "border-emerald-400";
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
    if (ctx.selectedBlockId === block.id) return "bg-primary/5";
    return "bg-primary/[0.02]";
  })();

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
              <ChildIntentBlock block={child} depth={depth + 1} />
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
        className={`border rounded-lg px-3 py-1.5 transition-all shadow-sm hover:shadow-md hover:border-primary/50 ${childBorderClass} ${
          selectedDepColor ? "bg-primary/20 border-primary" : childBgClass
        }`}
      >
        <div className="flex items-start gap-2">
          {/* Change status badge */}
          {block.changeStatus && (
            <div className="flex-shrink-0">
              <ChangeStatusBadge status={block.changeStatus} />
            </div>
          )}

          {/* Coverage status icon */}
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
                placeholder="Type here..."
                className={textClass}
                minRows={1}
                autoFocus
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

            {/* Coverage note with action buttons */}
            {block.changeStatus === 'modified' && block.previousContent ? (
              <div className="text-xs mt-0.5 text-muted-foreground">
                <span className="line-through">{block.previousContent}</span>
              </div>
            ) : (
              childCoverageStatus && childCoverageStatus.note && childCoverageStatus.status !== 'covered' && (
                <div className={`text-xs mt-0.5 flex items-center gap-2 flex-wrap ${
                  childCoverageStatus.status === 'partial'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <span>{childCoverageStatus.note}</span>
                  <span className="inline-flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGapAction('intent');
                      }}
                      disabled={isLoadingGapSuggestion}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      Update Intent
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGapAction('writing');
                      }}
                      disabled={isLoadingGapSuggestion}
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
                    >
                      Update Writing
                    </button>
                    {isLoadingGapSuggestion && (
                      <span className="text-xs text-muted-foreground italic ml-1">generating...</span>
                    )}
                  </span>
                </div>
              )
            )}

            {/* Intent Update Preview Panel */}
            {ctx.pendingIntentSuggestion?.intentId === block.id && (
              <IntentUpdatePreviewPanel
                currentIntent={ctx.pendingIntentSuggestion.currentContent}
                suggestedIntent={ctx.pendingIntentSuggestion.suggestedContent}
                relatedImpacts={ctx.pendingIntentSuggestion.relatedImpacts}
                isLoading={ctx.pendingIntentSuggestion.isLoadingImpact}
                onAccept={() => {
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

            {/* Change author info */}
            {block.changeStatus && block.changeByName && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {block.changeStatus === 'added' ? 'Added' :
                 block.changeStatus === 'modified' ? 'Modified' :
                 block.changeStatus === 'removed' ? 'Marked for removal' :
                 'Proposed'} by {block.changeByName}
              </div>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Link button */}
            {ctx.isSetupPhase && ctx.addDependency && (
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  ctx.handleConnectionDragStart(block.id, e);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
                  ctx.isDraggingConnection
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Drag to link with another section"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Other actions on hover */}
            <div className={`flex items-center gap-0.5 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              {block.level > 0 && (
                <button onClick={() => ctx.outdentBlock(block.id)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Outdent">
                  <ChevronLeft className={iconSize} />
                </button>
              )}
              <button onClick={() => ctx.indentBlock(block.id)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Indent">
                <ChevronRight className={iconSize} />
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this item?")) {
                    ctx.deleteBlock(block.id);
                  }
                }}
                className="p-1 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {renderChildren()}
    </div>
  );
}
