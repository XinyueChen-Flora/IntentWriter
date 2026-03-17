"use client";

import { useState, useEffect, useRef } from "react";
import type { IntentBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Trash2, ChevronLeft, Link2, Pencil, MessageSquare, MoreHorizontal, Check, Eye, Plus, Minus, Edit2 } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";
import type { SectionNotification } from "../IntentPanelContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { SortableBlockItem } from "../ui/SortableBlockItem";
import { AssignDropdown } from "../ui/AssignDropdown";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon } from "../ui/CoverageIcons";
import { IntentUpdatePreviewPanel } from "../ui/IntentUpdatePreview";
import { ChildIntentBlock } from "../setup/ChildIntentBlock";
import { ChildIntentBlockWriting } from "../writing-phase/ChildIntentBlockWriting";
import { WritingSectionPanel } from "../writing-phase/WritingSectionPanel";

// ─── Main component ─────────────────────────────────────────────────────

type RootIntentBlockProps = {
  block: IntentBlock;
  rootIndex: number;
};

export function RootIntentBlock({ block, rootIndex }: RootIntentBlockProps) {
  const ctx = useIntentPanelContext();

  // Writing-phase action menu
  const [showRootActions, setShowRootActions] = useState(false);
  const rootActionsRef = useRef<HTMLDivElement>(null);

  // Close root actions on outside click
  useEffect(() => {
    if (!showRootActions) return;
    const handleClick = (e: MouseEvent) => {
      if (rootActionsRef.current && !rootActionsRef.current.contains(e.target as Node)) {
        setShowRootActions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRootActions]);

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.isSetupPhase && ctx.editingBlock === block.id; // Only direct edit in setup
  const isHovered = ctx.hoveredBlock === block.id;
  const isLocked = !ctx.isSetupPhase;
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

  // Drift detection status (for root coverage icon only)
  const driftStatus = !ctx.isSetupPhase ? ctx.getDriftStatus?.(block.id) : undefined;

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

  const ChildComponent = isLocked ? ChildIntentBlockWriting : ChildIntentBlock;

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
              <ChildComponent block={child} depth={1} />
            </SortableBlockItem>
          ))}
        </div>
      </SortableContext>
    );
  };

  return (
    <div className={`mb-4 group relative rounded-xl transition-all ${
      ctx.activeDiffSession?.sourceSectionId === block.id
        ? 'bg-primary/[0.03] ring-1 ring-primary/15 p-2 -m-2'
        : ''
    }`}>
      {dropIndicator}
      <div className="flex flex-row items-stretch">
        {/* Left Panel: Intent card + children */}
        <div className={ctx.isSetupPhase ? "w-[65%] flex-shrink-0" : "w-[28%] flex-shrink-0"}>
          {/* Root block card */}
          <div
            ref={(el) => { ctx.registerBlockRef(block.id, el); }}
            data-block-id={block.id}
            onMouseEnter={() => ctx.setHoveredBlock(block.id)}
            onMouseLeave={() => ctx.setHoveredBlock(null)}
            className={`border rounded-xl p-4 transition-all shadow-sm ${
              isHoveredFromWriting
                ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                : ctx.selectedBlockId === block.id
                  ? "border-primary bg-primary/5 shadow-md"
                  : selectedDepColor
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:shadow-md hover:border-primary/30"
            }`}
          >
            {/* Header Row */}
            <div className="flex items-start gap-2">
              {/* Coverage status icon - shown after check */}
              {driftStatus && (() => {
                const rootCoverage = driftStatus.intentCoverage.find(c => c.intentId === block.id);
                if (!rootCoverage || block.changeStatus) return null;
                const isRootAiCovered = ctx.aiCoveredIntents?.has(block.id) || false;
                return (
                  <div className="flex-shrink-0 mt-1">
                    <CoverageIcon status={rootCoverage.status} aiCovered={isRootAiCovered} className="h-4 w-4" />
                  </div>
                );
              })()}

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
                  /* Setup phase: direct editing */
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
                  /* Normal display — locked in writing phase */
                  <div
                    className={proseClass}
                    onClick={() => !isLocked && ctx.setEditingBlock(block.id)}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {block.content || "*Click to edit...*"}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Show previous content if modified */}
                {block.changeStatus === 'modified' && block.previousContent && (
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    <span className="line-through">{block.previousContent}</span>
                  </div>
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

                {/* Setup phase: direct manipulation */}
                {!isLocked && (
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
                )}

                {/* Writing phase: action button */}
                {isLocked && (
                  <div className="relative">
                    <button
                      onClick={() => setShowRootActions(prev => !prev)}
                      className={`p-1.5 rounded-lg transition-all ${
                        showRootActions
                          ? 'bg-primary/10 text-primary'
                          : `text-muted-foreground hover:text-foreground hover:bg-muted ${isHovered ? 'opacity-100' : 'opacity-0'}`
                      }`}
                      title="Actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {showRootActions && (
                      <div
                        ref={rootActionsRef}
                        className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-1 min-w-[220px]"
                      >
                        <button
                          onClick={() => {
                            setShowRootActions(false);
                            ctx.openProposalDraft(block.id, 'change', block.id);
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
                            setShowRootActions(false);
                            ctx.openProposalDraft(block.id, 'comment', block.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors text-left"
                        >
                          <MessageSquare className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium">Leave a comment</div>
                            <div className="text-xs text-muted-foreground">Share a thought about this section</div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Incoming change notifications — shown on impacted sections */}
          {!ctx.isSetupPhase && (() => {
            const notifications = ctx.getSectionNotifications(block.id);
            const unacked = notifications.filter(n =>
              !n.acknowledged && n.notifyLevel !== 'skip'
              // Negotiate types are shown in ActionRequiredBar, not here
              && n.proposeType !== 'negotiate' && n.proposeType !== 'input' && n.proposeType !== 'discussion'
            );
            if (unacked.length === 0) return null;
            return (
              <div className="mt-2 space-y-2">
                {unacked.map(n => (
                  <NotificationCard
                    key={n.proposalId}
                    notification={n}
                    onAcknowledge={() => {
                      fetch('/api/proposals/vote', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ proposalId: n.proposalId, vote: 'acknowledge' }),
                      }).then(() => ctx.refreshProposals());
                    }}
                    onViewDetails={() => {
                      ctx.setViewingProposalId(n.proposalId);
                      ctx.setViewingProposalForSectionId(block.id);
                      ctx.setViewingProposalAffectedSectionId(block.id);
                    }}
                    onEscalate={() => {
                      fetch('/api/proposals/vote', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ proposalId: n.proposalId, vote: 'escalate' }),
                      }).then(() => ctx.refreshProposals());
                    }}
                  />
                ))}
              </div>
            );
          })()}

          {/* Render children */}
          {renderChildren()}

          {/* Add child button — setup phase only */}
          {ctx.isSetupPhase && !isCollapsed && (
            <button
              onClick={() => {
                const newBlock = ctx.addBlock({ asChildOf: block.id });
                ctx.setSelectedBlockId(newBlock.id);
                setTimeout(() => ctx.setEditingBlock(newBlock.id), 50);
              }}
              className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pl-4 py-1 opacity-0 group-hover:opacity-100"
            >
              <Plus className="h-3 w-3" />
              <span>Add sub-intent</span>
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
          <WritingSectionPanel block={block} children={children} />
        )}
      </div>
    </div>
  );
}

// ─── Heads-up notification card (lightweight, dismissible) ───

function NotificationCard({
  notification: n,
  onAcknowledge,
  onViewDetails,
  onEscalate,
}: {
  notification: SectionNotification;
  onAcknowledge: () => void;
  onViewDetails: () => void;
  onEscalate: () => void;
}) {
  const isStrong = n.notifyLevel === 'notify';
  // Note: negotiate types are filtered out by the caller — this component only handles 'decided'

  return (
    <div className={`rounded-lg border ${
      isStrong
        ? n.impactLevel === 'significant'
          ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800'
          : 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-800'
        : 'bg-muted/20 border-border'
    }`}>
      {/* 1. Who changed where → affects your part */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <UserAvatar
          avatarUrl={n.proposedByAvatar}
          name={n.proposedByName}
          className="h-5 w-5 flex-shrink-0"
        />
        <div className="text-xs flex-1 min-w-0">
          <span className="font-semibold">{n.proposedByName}</span>
          <span className="text-muted-foreground"> changed </span>
          <span className="font-semibold">{n.sourceSectionName}</span>
          <span className="text-muted-foreground">, affecting your section</span>
        </div>
      </div>

      {/* 2. What's affected + how */}
      {n.suggestedChanges && n.suggestedChanges.length > 0 ? (
        <div className="px-3 pb-1.5">
          <div className="space-y-1 ml-7">
            {n.suggestedChanges.map((sc, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-1.5 text-xs rounded px-2 py-1 ${
                  sc.action === 'add' ? 'bg-emerald-50/80 dark:bg-emerald-900/15' :
                  sc.action === 'remove' ? 'bg-red-50/80 dark:bg-red-900/15' :
                  'bg-amber-50/80 dark:bg-amber-900/15'
                }`}
              >
                {sc.action === 'add' && <Plus className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />}
                {sc.action === 'modify' && <Edit2 className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />}
                {sc.action === 'remove' && <Minus className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <span className={sc.action === 'remove' ? 'line-through text-red-500/70' : ''}>
                    {sc.content}
                  </span>
                  {sc.reason && (
                    <span className="text-muted-foreground ml-1">— {sc.reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 pb-1.5 ml-7 text-xs text-muted-foreground">
          {n.reason}
        </div>
      )}

      {/* 3. Why — reasoning / personal note */}
      <div className="px-3 pb-2 ml-7">
        {n.personalNote ? (
          <div className="text-xs text-foreground/70 italic leading-relaxed">
            &ldquo;{n.personalNote}&rdquo;
          </div>
        ) : n.suggestedChanges && n.suggestedChanges.length > 0 ? (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {n.reason}
          </div>
        ) : null}
      </div>

      {/* 4. Actions — Review + OK/Got it + optional Discuss */}
      <div className="flex items-center gap-2 px-3 pb-2.5 ml-7">
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          className={`flex items-center gap-1 text-[10px] font-medium transition-colors px-2.5 py-1 rounded-md border ${
            isStrong
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'text-primary border-primary/30 hover:bg-primary/5'
          }`}
        >
          <Eye className="h-3 w-3" />
          Review
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAcknowledge(); }}
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted border"
        >
          <Check className="h-3 w-3" />
          {isStrong ? 'OK' : 'Got it'}
        </button>
        {isStrong && (
          <button
            onClick={(e) => { e.stopPropagation(); onEscalate(); }}
            className="flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-md hover:bg-amber-50 border border-amber-200 dark:border-amber-800"
          >
            Discuss
          </button>
        )}
      </div>
    </div>
  );
}
