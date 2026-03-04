"use client";

import { useState, useMemo } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Trash2, ChevronLeft, Link2, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { SortableBlockItem } from "../ui/SortableBlockItem";
import { AssignDropdown } from "../ui/AssignDropdown";
import TipTapEditor from "../../writing/TipTapEditor";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon } from "../ui/CoverageIcons";
import { IntentUpdatePreviewPanel } from "../ui/IntentUpdatePreview";
import { InlineDiffView, type SectionImpactData } from "../diff";
import { ChildIntentBlock } from "./ChildIntentBlock";

type RootIntentBlockProps = {
  block: IntentBlock;
  rootIndex: number;
};

export function RootIntentBlock({ block, rootIndex }: RootIntentBlockProps) {
  const ctx = useIntentPanelContext();
  const [isLoadingGapSuggestion, setIsLoadingGapSuggestion] = useState(false);

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.editingBlock === block.id;
  const isHovered = ctx.hoveredBlock === block.id;
  const isHoveredFromWriting = ctx.hoveredIntentFromWriting === block.id;
  const matchedWritingBlock = ctx.intentToWritingMap.get(block.id);

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

  // Drift detection status
  const isRootChecking = ctx.driftCheckingIds?.has(block.id);
  const driftStatus = !ctx.isSetupPhase ? ctx.getDriftStatus?.(block.id) : undefined;
  const sentenceHighlights = !ctx.isSetupPhase ? ctx.getSentenceHighlights?.(block.id) : undefined;
  const simulatedOutline = !ctx.isSetupPhase ? ctx.getSimulatedOutline?.(block.id) : undefined;
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

  // Ordered intent coverage for inline display
  const orderedIntentCoverage = useMemo(() => {
    if (!driftStatus?.intentCoverage) return undefined;
    return driftStatus.intentCoverage
      .filter(c => c.intentId !== block.id)
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

  // Sizes and styles
  const chevronSize = "h-4 w-4";
  const textClass = "w-full px-1 py-0.5 text-sm font-medium bg-transparent border-0 focus:outline-none focus:bg-primary/5 rounded";
  const proseClass = "prose prose-sm max-w-none cursor-text hover:bg-primary/5 rounded px-1 py-0.5 font-medium transition-colors";

  // Drop indicator
  let dropIndicator = null;
  if (ctx.dragOverId === block.id && ctx.activeId && ctx.activeId !== block.id) {
    const allBlocks = [...ctx.blocks].sort((a, b) => a.position - b.position);
    const activeIndex = allBlocks.findIndex(b => b.id === ctx.activeId);
    const overIndex = allBlocks.findIndex(b => b.id === block.id);
    const showTop = activeIndex > overIndex;
    dropIndicator = (
      <div className={`absolute left-0 right-0 h-0.5 bg-primary z-10 ${showTop ? '-top-1' : '-bottom-1'}`} />
    );
  }

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

  // Handle gap action for root block
  const handleRootGapAction = async (action: 'intent' | 'writing', coverage: { status: 'covered' | 'partial' | 'missing'; note?: string }) => {
    setIsLoadingGapSuggestion(true);
    try {
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
          ctx.setPendingIntentSuggestion({
            intentId: block.id,
            rootIntentId: block.id,
            currentContent: block.content,
            suggestedContent: data.suggestion.intentUpdate,
            isLoadingImpact: false,
            relatedImpacts: [],
          });
        } else if (action === 'writing' && data.suggestion) {
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

  // Handle "Add to Outline" from orphan
  const handleAddToOutline = async (suggestedIntent: string, orphanStart: string) => {
    // Simplified - just add to outline directly
    const newBlock = ctx.addBlock({ asChildOf: block.id });
    ctx.updateBlock(newBlock.id, suggestedIntent);
    ctx.updateIntentBlockRaw(newBlock.id, {
      changeStatus: 'added',
      changeBy: ctx.currentUser.id,
      changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
      changeAt: Date.now(),
    });
    ctx.markOrphanHandled(orphanStart);
    setTimeout(() => ctx.triggerCheck?.(block.id), 500);
  };

  // Handle "View Outline Diff"
  const handleViewOutlineDiff = async () => {
    if (ctx.activeDiffSession?.sourceSectionId === block.id) {
      ctx.setActiveDiffSession(null);
      return;
    }

    ctx.setActiveDiffSession({
      sourceSectionId: block.id,
      isLoading: false,
      sectionImpacts: new Map(),
    });
  };

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
              <ChildIntentBlock block={child} depth={1} />
            </SortableBlockItem>
          ))}
        </div>
      </SortableContext>
    );
  };

  return (
    <div className="mb-4 group relative">
      {dropIndicator}
      <div className="flex flex-row items-stretch">
        {/* Left Panel: Intent card + children */}
        <div className={ctx.isSetupPhase ? "w-[65%] flex-shrink-0" : ctx.activeDiffSession ? "w-[18%] flex-shrink-0" : "w-[28%] flex-shrink-0"}>
          {/* Root block card */}
          <div
            ref={(el) => { ctx.registerBlockRef(block.id, el); }}
            data-block-id={block.id}
            onMouseEnter={() => ctx.setHoveredBlock(block.id)}
            onMouseLeave={() => ctx.setHoveredBlock(null)}
            className={`border rounded-xl p-4 transition-all shadow-sm ${
              isHoveredFromWriting
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-200"
                : ctx.selectedBlockId === block.id
                  ? "border-primary bg-primary/10 shadow-md"
                  : selectedDepColor
                    ? "border-primary bg-primary/20 shadow-md"
                    : "border-border bg-primary/[0.06] hover:shadow-md hover:border-primary/50"
            }`}
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
                    placeholder="Type here..."
                    className={textClass}
                    minRows={1}
                    autoFocus
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

                  if (block.changeStatus === 'modified' && block.previousContent) {
                    return (
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        <span className="line-through">{block.previousContent}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-1.5">
                      <div className="flex items-start gap-1.5">
                        <CoverageIcon status={rootCoverage.status} className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {rootCoverage.note && (
                          <span className={`text-sm ${
                            rootCoverage.status === 'covered' ? 'text-emerald-600 dark:text-emerald-400' :
                            rootCoverage.status === 'partial' ? 'text-amber-600 dark:text-amber-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {rootCoverage.note}
                          </span>
                        )}
                      </div>
                      {rootCoverage.status !== 'covered' && rootCoverage.note && (
                        <div className={`text-xs mt-1 flex items-center gap-2 flex-wrap ${
                          rootCoverage.status === 'partial' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          <span className="inline-flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRootGapAction('intent', rootCoverage); }}
                              disabled={isLoadingGapSuggestion}
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                              Update Intent
                            </button>
                            <span className="text-muted-foreground">·</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRootGapAction('writing', rootCoverage); }}
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
                      )}
                    </div>
                  );
                })()}

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
                      setTimeout(() => ctx.triggerCheck?.(block.id), 500);
                    }}
                    onCancel={() => ctx.setPendingIntentSuggestion(null)}
                  />
                )}
              </div>

              {/* Right side: Assign + Link + Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <AssignDropdown
                  block={block}
                  currentUser={ctx.currentUser}
                  documentMembers={ctx.documentMembers}
                  onlineUserIds={ctx.onlineUserIds}
                  userAvatarMap={ctx.userAvatarMap}
                  assignBlock={ctx.assignBlock}
                  unassignBlock={ctx.unassignBlock}
                />

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
                    <Link2 className="h-4 w-4" />
                  </button>
                )}

                <div className={`flex items-center gap-0.5 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                  {block.level > 0 && (
                    <button onClick={() => ctx.outdentBlock(block.id)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Outdent">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => ctx.indentBlock(block.id)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground" title="Indent">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this section and all its children?")) {
                        ctx.deleteBlock(block.id);
                      }
                    }}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Render children */}
          {renderChildren()}

          {/* View Outline Diff button */}
          {!ctx.isSetupPhase && hasSimulatedChanges && (
            <button
              onClick={handleViewOutlineDiff}
              className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                ctx.activeDiffSession?.sourceSectionId === block.id
                  ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/50"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {ctx.activeDiffSession?.sourceSectionId === block.id ? "Hide Outline Diff" : "View Outline Diff"}
            </button>
          )}
        </div>

        {/* Connector between outline and writing */}
        {!ctx.isSetupPhase && (
          <div className="w-16 flex-shrink-0 flex items-center justify-center">
            <div className="flex items-center">
              <div className="w-8 border-t-2 border-dashed border-muted-foreground/30" />
              <svg className="w-3 h-3 text-muted-foreground/30 -ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Writing panel — hidden in setup phase */}
        {!ctx.isSetupPhase && (
          <div className="flex-1 min-w-0 flex flex-row items-stretch">
            {/* Inline Diff View */}
            {(() => {
              const isSourceSection = ctx.activeDiffSession?.sourceSectionId === block.id;
              const sectionImpact = ctx.getSectionImpact?.(block.id);
              const showInlineDiff = isSourceSection || sectionImpact;

              if (!showInlineDiff) return null;

              return (
                <InlineDiffView
                  isSource={isSourceSection}
                  simulatedOutline={isSourceSection ? simulatedOutline : undefined}
                  currentChildren={children}
                  rootBlock={block}
                  sectionImpact={sectionImpact}
                  isLoading={ctx.activeDiffSession?.isLoading}
                  onClose={() => ctx.setActiveDiffSession(null)}
                />
              );
            })()}

            <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden">
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
                  onMakeChangeToOutline={handleAddToOutline}
                  onDismissOrphan={(orphanStart) => console.log('Dismissed orphan:', orphanStart)}
                  onHoverIntentFromWriting={ctx.setHoveredIntentFromWriting}
                  handledOrphanStarts={ctx.handledOrphanStarts}
                  markOrphanHandled={ctx.markOrphanHandled}
                  intentCoverageMap={intentCoverageMap}
                  orderedIntentCoverage={orderedIntentCoverage}
                  onAddMissingContent={async (intentId, intentContent) => {
                    const coverage = orderedIntentCoverage?.find(c => c.intentId === intentId);
                    if (!coverage || coverage.status === 'covered') return;

                    setIsLoadingGapSuggestion(true);
                    try {
                      const currentWriting = ctx.getWritingContent ? await ctx.getWritingContent(block.id) : '';
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
