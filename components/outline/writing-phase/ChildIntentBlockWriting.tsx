"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { IntentBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Pencil, MoreHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableBlockItem } from "../ui/SortableBlockItem";
import { useIntentPanelContext } from "../IntentPanelContext";
import { PrimitiveRenderer } from "@/components/capability/PrimitiveRenderer";
import { WordDiff } from "@/components/simulate/WordDiff";
import { NegotiateRunner } from "@/components/protocol/NegotiateRunner";
import { getCoordinationPath } from "@/platform/coordination/protocol";
import { setResult as setInteractionResult } from "@/platform/interaction-store";

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

  const getRootId = (b: IntentBlock): string => {
    if (!b.parentId) return b.id;
    const parent = ctx.blocks.find(p => p.id === b.parentId);
    return parent ? getRootId(parent) : b.id;
  };
  const rootId = getRootId(block);

  // ─── Read primitives for THIS block from the pipeline ───

  const outlinePrims = ctx.primitivesByLocation['outline-node'] || [];

  // Primitives scoped to THIS block (by nodeId)
  const blockPrimitives = useMemo(() => {
    return outlinePrims.filter(p => p.params.nodeId === block.id);
  }, [outlinePrims, block.id]);

  // Action groups are global (no nodeId) — available on every node
  const actionGroups = useMemo(() => {
    return outlinePrims.filter(p => p.type === 'action-group' && !p.params.nodeId);
  }, [outlinePrims]);

  // Derive visual state from block-scoped primitives
  const nodeIcon = blockPrimitives.find(p => p.type === 'node-icon');
  const nodeBadges = blockPrimitives.filter(p => p.type === 'node-badge');
  const coverageStatus = nodeIcon?.params.status as 'covered' | 'partial' | 'missing' | undefined;

  // Dependency highlight
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

  // ─── Visual state from block data + primitives ───
  // Block data (changeStatus) drives content rendering.
  // Primitives (node-icon, node-badge) drive status indicators.
  // Both are protocol-produced — changeStatus is set by mutations from functions,
  // primitives are produced by function UI bindings.

  const isProposed = block.changeStatus === 'proposed';
  const isRemoved = block.changeStatus === 'removed' || (isProposed && block.proposedAction === 'remove');
  const isModified = (block.changeStatus === 'proposed' || block.changeStatus === 'modified')
    && block.previousContent && block.previousContent !== block.content;
  const isAdded = isProposed && block.proposedAction === 'add';

  const borderClass = (() => {
    if (isProposed) return "border-dashed border-indigo-400 dark:border-indigo-500";
    if (isRemoved) return "border-red-500 dark:border-red-600";
    if (isHoveredFromWriting || isHoveredFromSummary) {
      if (coverageStatus === 'partial') return "border-amber-600";
      if (coverageStatus === 'missing') return "border-red-600";
      return "border-emerald-600";
    }
    if (ctx.selectedBlockId === block.id) return "border-primary";
    if (coverageStatus === 'partial') return "border-amber-600";
    if (coverageStatus === 'missing') return "border-red-600";
    return "border-border";
  })();

  const bgClass = (() => {
    if (isProposed) return "bg-indigo-50/30 dark:bg-indigo-950/20";
    if (isRemoved) return "bg-red-50/30 dark:bg-red-950/30";
    if (isHoveredFromWriting || isHoveredFromSummary) {
      if (coverageStatus === 'partial') return "bg-amber-50/50 dark:bg-amber-950/40";
      if (coverageStatus === 'missing') return "bg-red-50/50 dark:bg-red-950/40";
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
          {/* Coverage icon — derived from node-icon primitive */}
          {nodeIcon && !block.changeStatus && (() => {
            const STATUS_ICONS: Record<string, string> = { covered: '\u2713', partial: '\u25D1', missing: '\u25CB', 'ai-covered': '\u2728' };
            const STATUS_COLORS: Record<string, string> = { covered: 'text-emerald-500', partial: 'text-yellow-500', missing: 'text-red-400', 'ai-covered': 'text-blue-500' };
            const s = nodeIcon.params.status || 'missing';
            return (
              <span className={`flex-shrink-0 mt-0.5 text-sm ${STATUS_COLORS[s] || 'text-muted-foreground'}`}>
                {STATUS_ICONS[s] || '\u25CB'}
              </span>
            );
          })()}

          {hasChildren && (
            <button
              onClick={() => ctx.toggleCollapse(block.id)}
              className="flex-shrink-0 mt-0.5 hover:bg-secondary rounded p-0.5"
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Content — rendered based on block data (set by function mutations) */}
          <div className="flex-1 min-w-0">
            <div
              className={`prose prose-sm max-w-none rounded px-1 py-0.5 ${
                isRemoved ? 'line-through text-red-500 dark:text-red-400 opacity-70' : ''
              }`}
            >
              {isModified ? (
                <WordDiff oldText={block.previousContent!} newText={block.content} />
              ) : isAdded ? (
                <span className="text-indigo-600 dark:text-indigo-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {block.content || "*empty*"}
                  </ReactMarkdown>
                </span>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content || "*empty*"}
                </ReactMarkdown>
              )}
            </div>

            {/* Node badges — derived from node-badge primitives */}
            {nodeBadges.length > 0 && (
              <div className="mt-0.5 px-1 flex items-center gap-1.5 flex-wrap">
                {nodeBadges.map((badge, i) => {
                  const BADGE_STYLES: Record<string, string> = {
                    new: 'bg-emerald-100 text-emerald-700', modified: 'bg-blue-100 text-blue-700',
                    removed: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700',
                    info: 'bg-muted text-muted-foreground',
                  };
                  const style = BADGE_STYLES[badge.params.variant] || BADGE_STYLES.info;
                  return (
                    <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${style}`}>
                      {badge.params.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Change trace — from block data (set by function mutations) */}
            {block.changeStatus && block.changeBy && nodeBadges.length === 0 && (
              <ChangeTrace block={block} />
            )}
          </div>

          {/* Right side: action trigger */}
          <div className="flex items-center gap-1 flex-shrink-0 relative">
            {/* Action button */}
            {!isRemoved && (
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

            {/* Action menu — renders outline-node action-group primitives */}
            {showActions && (
              <div
                ref={actionsRef}
                className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-1 min-w-[180px]"
              >
                {actionGroups.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No actions available</div>
                ) : (
                  <PrimitiveRenderer
                    primitives={actionGroups}
                    onAction={(action) => {
                      setShowActions(false);
                      ctx.openProposalDraft(rootId, 'change', block.id);
                    }}
                  />
                )}
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

// ─── Change Trace (inline, expandable reasoning + discussion) ───

function ChangeTrace({ block }: { block: IntentBlock }) {
  const ctx = useIntentPanelContext();
  const [showReasoning, setShowReasoning] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const hasReasoning = !!block.changeReasoning;
  const isProposed = block.changeStatus === 'proposed';
  const isProposer = block.changeBy === ctx.currentUser.id;

  // For proposed blocks: look up the negotiate protocol
  const proposalId = block.proposalId || '';
  const notifications = isProposed ? ctx.getSectionNotifications(block.parentId || block.id) : [];
  const notification = notifications.find(n => n.proposalId === proposalId) || null;
  // Read proposeType from block (set by apply-proposal) > notification > default
  const pathId = block.proposeType || notification?.proposeType || 'discussion';
  const pathDef = isProposed && pathId !== 'decided' ? getCoordinationPath(pathId) : null;

  const STATUS_STYLES: Record<string, string> = {
    proposed: 'bg-indigo-100 text-indigo-700',
    modified: 'bg-blue-100 text-blue-700',
    added: 'bg-emerald-100 text-emerald-700',
    removed: 'bg-red-100 text-red-700',
  };

  // Find root section id for this block
  const getRootId = (b: IntentBlock): string => {
    if (!b.parentId) return b.id;
    const parent = ctx.blocks.find(p => p.id === b.parentId);
    return parent ? getRootId(parent) : b.id;
  };

  return (
    <div className="mt-0.5 px-1">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
        <span className={`px-1.5 py-0.5 rounded-full font-medium ${
          STATUS_STYLES[block.changeStatus || ''] || 'bg-muted text-muted-foreground'
        }`}>{block.changeStatus}</span>
        <span>by {block.changeByName}</span>
        {hasReasoning && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowReasoning(!showReasoning); }}
            className="text-primary/70 hover:text-primary underline"
          >
            {showReasoning ? 'hide reason' : 'why?'}
          </button>
        )}
        {pathDef && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDiscussion(!showDiscussion); }}
            className="text-amber-600 hover:text-amber-700 underline"
          >
            {showDiscussion ? 'hide' : isProposer ? 'manage' : 'discuss'}
          </button>
        )}
      </div>

      {/* Reasoning expansion */}
      {showReasoning && hasReasoning && (
        <div className="mt-1 px-1 py-1 text-xs text-muted-foreground bg-muted/30 rounded italic">
          {block.changeReasoning}
        </div>
      )}

      {/* Inline Discussion panel */}
      {showDiscussion && pathDef && (
        <div className="mt-1.5 border rounded-lg overflow-hidden border-amber-200">
          <div className="px-2 py-1 bg-amber-50/50 flex items-center justify-between">
            <span className="text-[10px] font-medium text-amber-700">{pathDef.name}</span>
            <button onClick={() => setShowDiscussion(false)} className="text-[10px] text-muted-foreground">×</button>
          </div>
          <div className="px-2 py-1.5 bg-card">
            <NegotiateRunner
              protocol={pathDef}
              stage={isProposer ? 'resolve' : 'deliberate'}
              userRole={isProposer ? 'proposer' : 'reviewer'}
              snapshot={ctx.documentSnapshot}
              sectionId={getRootId(block)}
              config={{
                ...(ctx.metaRule?.pathConfigs?.[pathId] || {}),
                proposalId,
                proposedBy: block.changeByName || '',
                notification,
                userId: ctx.currentUser.id,
                userName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email || '',
                pathId,
              }}
              onFunctionResult={() => {}}
              onAction={(action, prim) => {
                if ((action === 'set-reply' || action === 'set-reasoning') && prim) {
                  const key = action === 'set-reply' ? 'reply' : 'reasoning';
                  setInteractionResult(key, getRootId(block), { text: prim.params.value || '' });
                }
              }}
              mutationExecutor={{
                updateBlockRaw: (id, updates) => ctx.updateIntentBlockRaw(id, updates),
                updateBlock: (id, content) => ctx.updateBlock(id, content),
                addBlock: (opts) => ctx.addBlock(opts),
                deleteBlock: (id) => ctx.deleteBlock(id),
              }}
              onActionSubmit={() => {
                setShowDiscussion(false);
                ctx.refreshProposals();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
