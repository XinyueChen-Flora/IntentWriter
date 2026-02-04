"use client";

import type { IntentBlock, WritingBlock, OnlineUser, RoomMeta, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ImportMarkdownDialog from "./ImportMarkdownDialog";
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Import custom hooks
import { useIntentDragDrop } from './hooks/useIntentDragDrop';
import { useIntentHierarchy } from './hooks/useIntentHierarchy';
import { useDependencyLinks } from './hooks/useDependencyLinks';

// Import extracted components
import { SortableBlockItem } from './ui/SortableBlockItem';
import { IntentBlockCard } from './IntentBlockCard';
import { IntentPanelProvider } from './IntentPanelContext';

type IntentPanelProps = {
  blocks: readonly IntentBlock[];
  addBlock: (options?: { afterBlockId?: string; beforeBlockId?: string; asChildOf?: string }) => IntentBlock;
  updateBlock: (blockId: string, content: string) => void;
  assignBlock: (blockId: string, userId: string, userName?: string, userEmail?: string) => void;
  unassignBlock: (blockId: string) => void;
  onlineUsers: readonly OnlineUser[];
  documentMembers: readonly DocumentMember[];
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  reorderBlocks: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  writingBlocks: readonly WritingBlock[];
  importMarkdown?: (markdown: string) => void;
  currentUser: User;
  roomId: string;
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlockRaw: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  ensureWritingBlocksForIntents: () => void;
  roomMeta?: RoomMeta;
  dependencies?: IntentDependency[];
  addDependency?: (dep: IntentDependency) => void;
  updateDependency?: (id: string, updates: Partial<IntentDependency>) => void;
  deleteDependency?: (id: string) => void;
  onStartWriting?: () => void;
  onBackToSetup?: () => void;
};

function DepCreatorPopup({
  x,
  y,
  onCreate,
  onCancel,
}: {
  x: number;
  y: number;
  onCreate: (label: string, direction: 'directed' | 'bidirectional') => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [direction, setDirection] = useState<'directed' | 'bidirectional'>('directed');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    onCreate(label, direction);
  };

  return (
    <div
      className="fixed z-50 bg-popover border rounded-lg shadow-lg p-3 w-[220px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold text-muted-foreground mb-2">Describe relationship</div>
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 15))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="e.g. must be consistent"
        className="w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary mb-2"
        maxLength={15}
      />
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setDirection('directed')}
          className={`flex-1 text-xs py-1 rounded border text-center transition-colors ${
            direction === 'directed' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
          }`}
        >
          A → B
        </button>
        <button
          onClick={() => setDirection('bidirectional')}
          className={`flex-1 text-xs py-1 rounded border text-center transition-colors ${
            direction === 'bidirectional' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
          }`}
        >
          A ↔ B
        </button>
      </div>
      <button
        onClick={handleSubmit}
        className="w-full text-xs py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Add Link
      </button>
    </div>
  );
}

export default function IntentPanel({
  blocks,
  addBlock,
  updateBlock,
  assignBlock,
  unassignBlock,
  onlineUsers,
  documentMembers,
  deleteBlock,
  indentBlock,
  outdentBlock,
  reorderBlocks,
  selectedBlockId,
  setSelectedBlockId,
  writingBlocks,
  importMarkdown,
  currentUser,
  roomId,
  deleteWritingBlock,
  updateIntentBlockRaw,
  onRegisterYjsExporter,
  ensureWritingBlocksForIntents,
  roomMeta,
  dependencies,
  addDependency,
  updateDependency,
  deleteDependency,
  onStartWriting,
  onBackToSetup,
}: IntentPanelProps) {
  const isSetupPhase = !roomMeta || roomMeta.phase === 'setup';

  // Local UI state
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  // Refs for SVG dependency lines
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Custom hooks
  const dragDrop = useIntentDragDrop({ blocks, reorderBlocks });
  const hierarchy = useIntentHierarchy({ blocks });
  const depLinks = useDependencyLinks({
    blocks,
    dependencies,
    addDependency,
    updateDependency,
    isSetupPhase,
    containerRef,
    blockRefs,
    currentUserId: currentUser.id,
    collapsedBlocks,
    blockMap: hierarchy.blockMap,
  });

  // Ensure writing blocks exist for all root intents
  useEffect(() => {
    ensureWritingBlocksForIntents();
  }, [blocks, ensureWritingBlocksForIntents]);

  // Map linkedIntentId → WritingBlock
  const intentToWritingMap = useMemo(() => {
    const map = new Map<string, WritingBlock>();
    writingBlocks.forEach((wb) => {
      if (wb.linkedIntentId && !map.has(wb.linkedIntentId)) {
        map.set(wb.linkedIntentId, wb as WritingBlock);
      }
    });
    return map;
  }, [writingBlocks]);

  const handleAddBlock = () => {
    const newBlock = addBlock();
    setSelectedBlockId(newBlock.id);
    setEditingBlock(newBlock.id);
  };

  const toggleCollapse = useCallback((blockId: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const { rootBlocks, blockMap, mergedRenderList } = hierarchy;

  const onlineUserIds = useMemo(() => {
    return new Set(onlineUsers.map((u) => u.userId));
  }, [onlineUsers]);

  // userId → avatarUrl from live socket data (always has Google avatar)
  const userAvatarMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of onlineUsers) {
      if (u.avatarUrl) map.set(u.userId, u.avatarUrl);
    }
    return map;
  }, [onlineUsers]);

  const registerBlockRef = useCallback((blockId: string, el: HTMLDivElement | null) => {
    if (el) {
      blockRefs.current.set(blockId, el);
    }
  }, []);

  const contextValue = useMemo(() => ({
    blockMap,
    collapsedBlocks,
    editingBlock,
    hoveredBlock,
    selectedBlockId,
    dragOverId: dragDrop.dragOverId,
    activeId: dragDrop.activeId,
    linkMode: depLinks.linkMode,
    isSetupPhase,
    setEditingBlock,
    setHoveredBlock,
    setSelectedBlockId,
    toggleCollapse,
    setLinkMode: depLinks.setLinkMode,
    handleBlockClickForLink: depLinks.handleBlockClickForLink,
    addBlock,
    updateBlock,
    deleteBlock,
    indentBlock,
    outdentBlock,
    assignBlock,
    unassignBlock,
    currentUser,
    documentMembers,
    onlineUserIds,
    userAvatarMap,
    dependencies,
    addDependency,
    selectedDepId: depLinks.selectedDepId,
    setSelectedDepId: depLinks.setSelectedDepId,
    hoveredDepId: depLinks.hoveredDepId,
    setHoveredDepId: depLinks.setHoveredDepId,
    depColorMap: depLinks.depColorMap,
    intentToWritingMap,
    roomId,
    writingBlocks,
    deleteWritingBlock,
    updateIntentBlockRaw,
    onRegisterYjsExporter,
    blocks,
    registerBlockRef,
  }), [
    blockMap, collapsedBlocks, editingBlock, hoveredBlock, selectedBlockId,
    dragDrop.dragOverId, dragDrop.activeId, depLinks.linkMode, isSetupPhase,
    toggleCollapse, depLinks.setLinkMode, depLinks.handleBlockClickForLink,
    addBlock, updateBlock, deleteBlock, indentBlock, outdentBlock,
    assignBlock, unassignBlock, currentUser, documentMembers, onlineUserIds, userAvatarMap,
    dependencies, addDependency, depLinks.selectedDepId, depLinks.setSelectedDepId, depLinks.hoveredDepId, depLinks.setHoveredDepId, depLinks.depColorMap, intentToWritingMap, roomId, writingBlocks, deleteWritingBlock,
    updateIntentBlockRaw, onRegisterYjsExporter, blocks, registerBlockRef,
    setEditingBlock, setHoveredBlock, setSelectedBlockId,
  ]);

  return (
    <IntentPanelProvider value={contextValue}>
    <DndContext
      sensors={dragDrop.sensors}
      collisionDetection={closestCenter}
      onDragStart={dragDrop.handleDragStart}
      onDragOver={dragDrop.handleDragOver}
      onDragEnd={dragDrop.handleDragEnd}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Column sub-header */}
        <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex flex-row gap-4 px-4 py-2 items-center">
            <div className={`${isSetupPhase ? 'w-full' : 'w-[30%] flex-shrink-0'} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isSetupPhase ? 'Outline Setup' : 'Intent'}
                </span>
                {depLinks.linkMode && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full animate-pulse">
                    Click another intent to link
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {isSetupPhase && addDependency && (
                  <Button
                    onClick={depLinks.handleDetectDependencies}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={depLinks.isDetectingDeps || blocks.length < 2}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {depLinks.isDetectingDeps ? 'Detecting...' : 'AI Detect Dependencies'}
                  </Button>
                )}
                {importMarkdown && (
                  <ImportMarkdownDialog onImport={importMarkdown} />
                )}
                <Button onClick={handleAddBlock} size="sm" variant="outline" className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            {!isSetupPhase && (
              <>
                <div className="w-20 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Writing</span>
                  {onBackToSetup && (
                    <Button
                      onClick={() => {
                        if (confirm('Go back to outline setup? Writing editors will be hidden but your content is preserved.')) {
                          onBackToSetup();
                        }
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Back to Setup
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <p className="mb-4">No intent structure yet</p>
              <p className="text-sm">Use &ldquo;Import Structure&rdquo; or &ldquo;+ Add&rdquo; above to begin</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={rootBlocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 min-h-0 relative" onClick={() => depLinks.setSelectedDepId(null)}>
              {/* SVG dependency lines overlay — uses content-relative coords so it scrolls with content */}
              {depLinks.depLines.length > 0 && (
                <svg
                  className="absolute top-0 left-0 w-full pointer-events-none z-10"
                  style={{ height: containerRef.current?.scrollHeight || '100%', overflow: 'visible' }}
                >
                  {(() => {
                    const explicit = depLinks.depLines.filter(l => !l.inherited);
                    const sel = depLinks.selectedDepId;
                    const hov = depLinks.hoveredDepId;

                    return (
                      <>
                        {explicit.map((line, idx) => {
                          // Orthogonal polyline: right → vertical → left
                          const gap = 20 + idx * 16; // stagger vertical segments
                          const midX = Math.max(line.x1, line.x2) + gap;
                          const midY = (line.y1 + line.y2) / 2;
                          const path = `M ${line.x1} ${line.y1} H ${midX} V ${line.y2} H ${line.x2}`;
                          const isBidi = line.dep.direction === 'bidirectional';
                          const c = line.color;

                          // Subtle by default, vivid on hover/click
                          const active = sel || hov;
                          const isHighlighted = line.id === sel || line.id === hov;
                          const lineOpacity = active
                            ? (isHighlighted ? 1.0 : 0.08)
                            : (line.dashed ? 0.18 : 0.25);

                          // Arrowhead at "to" end — left-pointing ◀
                          const a = 10; // arrow size
                          const toArrow = `${line.x2 + a},${line.y2 - a / 2} ${line.x2},${line.y2} ${line.x2 + a},${line.y2 + a / 2}`;
                          // Arrowhead at "from" end — left-pointing ◀ (bidirectional)
                          const fromArrow = `${line.x1 + a},${line.y1 - a / 2} ${line.x1},${line.y1} ${line.x1 + a},${line.y1 + a / 2}`;

                          return (
                            <g key={line.id}>
                              {/* Wide invisible hit area */}
                              <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={14}
                                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                onMouseEnter={() => depLinks.setHoveredDepId(line.id)}
                                onMouseLeave={() => depLinks.setHoveredDepId(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Select-first, action-second
                                  if (sel === line.id) {
                                    // 2nd click on same line → perform action
                                    if (line.dashed && updateDependency) {
                                      updateDependency(line.dep.id, { confirmed: true, source: 'ai-confirmed' });
                                    } else if (deleteDependency) {
                                      if (confirm('Remove this dependency?')) {
                                        deleteDependency(line.dep.id);
                                      }
                                    }
                                    depLinks.setSelectedDepId(null);
                                  } else {
                                    // 1st click → select
                                    depLinks.setSelectedDepId(line.id);
                                  }
                                }}
                              />
                              {/* Visible polyline */}
                              <path
                                d={path}
                                fill="none"
                                stroke={c}
                                strokeWidth={2}
                                strokeDasharray={line.dashed ? '6 4' : undefined}
                                opacity={lineOpacity}
                                strokeLinejoin="round"
                              />
                              {/* Arrowhead at "to" end */}
                              <polygon points={toArrow} fill={c} opacity={lineOpacity} />
                              {/* Arrowhead at "from" end (bidirectional only) */}
                              {isBidi && <polygon points={fromArrow} fill={c} opacity={lineOpacity} />}
                              {/* Dot at "from" end (directed only) */}
                              {!isBidi && <circle cx={line.x1} cy={line.y1} r={4} fill={c} opacity={lineOpacity} />}
                              {/* Label on the vertical segment */}
                              <text
                                x={midX + 4}
                                y={midY}
                                fontSize={10}
                                fill={c}
                                fontWeight="500"
                                textAnchor="start"
                                dominantBaseline="middle"
                                opacity={lineOpacity * 0.9}
                              >
                                {line.dep.label}
                                {line.dashed ? ' ✓?' : ''}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}

              {mergedRenderList.map((item, idx) => (
                <SortableBlockItem key={item.data.id} id={item.data.id}>
                  <IntentBlockCard
                    block={item.data}
                    isRoot={true}
                    depth={0}
                    rootIndex={idx}
                  />
                </SortableBlockItem>
              ))}
            </div>
          </SortableContext>
        )}

        {/* Footer: Agree & Start Writing button — setup phase only */}
        {isSetupPhase && onStartWriting && blocks.length > 0 && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-4 py-3">
            <Button
              onClick={() => {
                if (confirm('Start writing phase? This will create a baseline snapshot of your intent structure. You can still edit intents during writing.')) {
                  onStartWriting();
                }
              }}
              className="w-full"
              size="lg"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Agree &amp; Start Writing
            </Button>
            {dependencies && dependencies.filter(d => !d.confirmed).length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">
                {dependencies.filter(d => !d.confirmed).length} unconfirmed dependency suggestion(s) — click dashed lines to confirm
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dependency creator popup */}
      {depLinks.depCreator && (
        <DepCreatorPopup
          x={depLinks.depCreator.x}
          y={depLinks.depCreator.y}
          onCreate={depLinks.handleCreateDependency}
          onCancel={() => depLinks.handleCreateDependency('related', 'directed')}
        />
      )}

      {/* Drag Overlay */}
      <DragOverlay>
        {dragDrop.activeId ? (
          <div className="bg-background border border-primary rounded-lg p-3 shadow-lg opacity-80">
            {blocks.find(b => b.id === dragDrop.activeId)?.content || 'Dragging...'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </IntentPanelProvider>
  );
}
