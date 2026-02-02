"use client";

import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import type { AlignmentResult } from "../editor/WritingEditor";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2, Lightbulb, UserPlus, X, ChevronLeft, Plus, GripVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ImportMarkdownDialog from "../editor/ImportMarkdownDialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import UserAvatar from "../user/UserAvatar";
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import custom hooks
import { useIntentDragDrop } from './hooks/useIntentDragDrop';
import { useIntentCoverage } from './hooks/useIntentCoverage';
import { useIntentSuggestions } from './hooks/useIntentSuggestions';
import { useIntentHierarchy } from './hooks/useIntentHierarchy';

type IntentPanelProps = {
  blocks: readonly IntentBlock[];
  addBlock: (options?: { afterBlockId?: string; beforeBlockId?: string; asChildOf?: string }) => IntentBlock;
  updateBlock: (blockId: string, content: string) => void;
  updateIntentTag: (blockId: string, intentTag: string, userId: string) => void;
  deleteIntentTag: (blockId: string) => void;
  assignBlock: (blockId: string, userId: string) => void;
  unassignBlock: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  reorderBlocks: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  writingBlocks: readonly WritingBlock[];
  importMarkdown?: (markdown: string) => void;
  currentUser: User;
  alignmentResults?: Map<string, AlignmentResult>;
  localSuggestedIntents?: Map<string, AlignmentResult>; // Local-only suggested intents (not synced)
  hoveredIntentId?: string | null;
  onHoverIntent?: (intentId: string | null) => void;
  activeIntentId?: string | null; // Currently editing intent
};

// Sortable Block Item Wrapper
function SortableBlockItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="group/sortable">
        <div className="flex items-start gap-1">
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-2 opacity-30 group-hover/sortable:opacity-100 hover:bg-secondary rounded p-1 cursor-grab active:cursor-grabbing transition-opacity"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Auto-resizing textarea component
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  minRows = 1,
  onBlur,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      rows={minRows}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  );
}

export default function IntentPanel({
  blocks,
  addBlock,
  updateBlock,
  updateIntentTag,
  deleteIntentTag,
  assignBlock,
  unassignBlock,
  deleteBlock,
  indentBlock,
  outdentBlock,
  reorderBlocks,
  selectedBlockId,
  setSelectedBlockId,
  writingBlocks,
  importMarkdown,
  currentUser,
  alignmentResults,
  localSuggestedIntents,
  hoveredIntentId,
  onHoverIntent,
  activeIntentId,
}: IntentPanelProps) {
  // Local UI state
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingIntent, setEditingIntent] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  // Use custom hooks
  const dragDrop = useIntentDragDrop({ blocks, reorderBlocks });
  const coverage = useIntentCoverage({ alignmentResults });
  const suggestions = useIntentSuggestions({
    alignmentResults,
    blocks,
    addBlock,
    updateBlock,
    setSelectedBlockId,
    setEditingBlock,
  });
  const hierarchy = useIntentHierarchy({
    blocks,
    alignmentResults,
    localSuggestedIntents,
    acceptedSuggestions: suggestions.acceptedSuggestions,
  });

  // Simple add block handler
  const handleAddBlock = () => {
    const newBlock = addBlock();
    setSelectedBlockId(newBlock.id);
    setEditingBlock(newBlock.id);
  };

  // Component for rendering a suggested intent block
  const SuggestedIntentBlock = ({ suggestedIntent }: { suggestedIntent: any }) => {
    const [showDetails, setShowDetails] = useState(false);

    // Get human-readable position description
    const getPositionDescription = () => {
      if (!suggestedIntent.insertPosition) return null;

      const { beforeIntentId, afterIntentId, parentIntentId, level } = suggestedIntent.insertPosition;

      // Find the referenced blocks
      const beforeBlock = beforeIntentId ? blocks.find(b => b.id === beforeIntentId) : null;
      const afterBlock = afterIntentId ? blocks.find(b => b.id === afterIntentId) : null;
      const parentBlock = parentIntentId ? blocks.find(b => b.id === parentIntentId) : null;

      if (beforeBlock) {
        return `before "${beforeBlock.content.substring(0, 20)}..."`;
      } else if (afterBlock) {
        return `after "${afterBlock.content.substring(0, 20)}..."`;
      } else if (parentBlock) {
        return `child of "${parentBlock.content.substring(0, 20)}..."`;
      } else if (level === 0) {
        return "at root level";
      }
      return null;
    };

    const positionDesc = getPositionDescription();

    return (
      <div className="mb-2 group relative">
        <div
          className="border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-950/10 rounded-lg p-2 transition-all"
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5 text-base">💡</div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                {suggestedIntent.content}
              </div>

              {positionDesc && (
                <div className="text-[10px] text-blue-600 dark:text-blue-400 mb-1">
                  📍 Insert {positionDesc}
                </div>
              )}

              {/* Expandable details */}
              {showDetails && (
                <>
                  {/* Writing segments that led to this suggestion */}
                  {suggestedIntent.writingSegments && suggestedIntent.writingSegments.length > 0 && (
                    <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 italic">
                      &ldquo;{suggestedIntent.writingSegments[0].text.substring(0, 60)}...&rdquo;
                    </div>
                  )}

                  {/* Suggestion text */}
                  {suggestedIntent.suggestion && (
                    <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                      {suggestedIntent.suggestion}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="mt-1 text-[9px] text-blue-500 hover:underline"
              >
                {showDetails ? '▼ Less' : '▶ More'}
              </button>
            </div>

            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                onClick={() => suggestions.handleAcceptSuggested(suggestedIntent)}
                className="px-2 py-0.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Add this to intent structure"
              >
                Accept
              </button>
              <button
                onClick={() => suggestions.handleDismissSuggestion(suggestedIntent)}
                className="px-2 py-0.5 text-[11px] bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
                title="Dismiss suggestion"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const toggleCollapse = (blockId: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  // Use hierarchy hook for structure data
  const { rootBlocks, blockMap, mergedRenderList, getIntentTreeChildren } = hierarchy;

  const renderRootBlock = (block: IntentBlock): React.ReactElement => {
    const linkedWritingCount = block.linkedWritingIds?.length || 0;

    // Get children from intentTree (includes both real blocks and suggested intents)
    const intentTreeChildren = getIntentTreeChildren(block.id);

    // Get regular children from blockMap, sorted by position
    const regularChildren = (blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);

    // Merge: include all intentTreeChildren + any regularChildren not in intentTree
    const renderedChildIds = new Set(
      intentTreeChildren
        .filter(item => item.type === 'block')
        .map(item => item.data.id)
    );
    const childrenToRender = [
      ...intentTreeChildren,
      ...regularChildren
        .filter(child => !renderedChildIds.has(child.id))
        .map(child => ({ type: 'block' as const, data: child }))
    ];

    const hasChildren = childrenToRender.length > 0;
    const isCollapsed = collapsedBlocks.has(block.id);
    const isEditing = editingBlock === block.id;
    const isEditingIntent = editingIntent === block.id;
    const isHovered = hoveredBlock === block.id;
    const isDraggedOver = dragDrop.dragOverId === block.id;

    // Get coverage status for background color (matching writing panel colors)
    const coverageStatus = coverage.getCoverageStatus(block.id);
    const coverageBgStyle = coverageStatus === 'covered'
      ? { backgroundColor: '#dcfce7' } // green - same as writing aligned
      : coverageStatus === 'partial'
      ? { backgroundColor: '#fef9c3' } // yellow
      : coverageStatus === 'misaligned'
      ? { backgroundColor: '#fed7aa' } // orange - same as writing misaligned
      : coverageStatus === 'missing-skipped'
      ? { backgroundColor: '#fee2e2' } // red - only for skipped, not "not-started"
      : {}; // missing-not-started = no color (default)

    // Add highlight when this intent is hovered from writing panel
    const isIntentHovered = hoveredIntentId === block.id;
    const hoverRing = isIntentHovered ? 'ring-2 ring-purple-500 shadow-lg bg-purple-50 dark:bg-purple-950/20' : '';

    // Add highlight when this intent is actively being edited in writing panel
    const isActivelyEditing = activeIntentId === block.id;
    const activeEditingStyle = isActivelyEditing ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50 dark:bg-blue-950/20' : '';

    // Determine drop indicator position
    let dropIndicator = null;
    if (isDraggedOver && dragDrop.activeId && dragDrop.activeId !== block.id) {
      const allBlocks = [...blocks].sort((a, b) => a.position - b.position);
      const activeIndex = allBlocks.findIndex(b => b.id === dragDrop.activeId);
      const overIndex = allBlocks.findIndex(b => b.id === block.id);
      const showTop = activeIndex > overIndex;

      dropIndicator = (
        <div className={`absolute left-0 right-0 h-0.5 bg-primary z-10 ${showTop ? '-top-1' : '-bottom-1'}`} />
      );
    }

    return (
      <div
        key={block.id}
        className="mb-2 group relative"
        onMouseEnter={() => {
          setHoveredBlock(block.id);
          if (onHoverIntent) {
            onHoverIntent(block.id);
          }
        }}
        onMouseLeave={() => {
          setHoveredBlock(null);
          if (onHoverIntent) {
            onHoverIntent(null);
          }
        }}
      >
        {dropIndicator}
        <div
          className={`border rounded-lg p-3 transition-all ${activeEditingStyle || hoverRing} ${
            selectedBlockId === block.id ? "border-primary bg-primary/5" : "border-border"
          }`}
          style={selectedBlockId === block.id ? {} : coverageBgStyle}
        >
          {/* Header Row: Chevron + Content + Assignee + Delete */}
          <div className="flex items-start gap-2">
            {hasChildren && (
              <button
                onClick={() => toggleCollapse(block.id)}
                className="flex-shrink-0 mt-1 hover:bg-secondary rounded p-0.5"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Checkbox Icon */}
            <div
              className="flex-shrink-0 mt-1 text-lg cursor-pointer hover:scale-125 transition-transform"
              title={
                coverageStatus === 'covered' ? 'Covered' :
                coverageStatus === 'partial' ? 'Partial' :
                coverageStatus === 'misaligned' ? 'Misaligned' :
                coverageStatus === 'missing-not-started' ? 'Not started' :
                coverageStatus === 'missing-skipped' ? 'Skipped' :
                'No data'
              }
              onMouseEnter={(e) => {
                // Clear any pending hide timeout
                if (coverage.coverageTooltipTimeoutRef.current) {
                  clearTimeout(coverage.coverageTooltipTimeoutRef.current);
                  coverage.coverageTooltipTimeoutRef.current = null;
                }

                const details = coverage.getCoverageDetails(block.id);
                if (details) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  coverage.setCoverageTooltip({
                    x: rect.right + 10,
                    y: rect.top,
                    coverage: details
                  });
                }
              }}
              onMouseLeave={() => {
                // Delay hiding tooltip to allow user to hover over it
                coverage.coverageTooltipTimeoutRef.current = setTimeout(() => {
                  if (!coverage.isHoveringCoverageTooltipRef.current) {
                    coverage.setCoverageTooltip(null);
                  }
                }, 200);
              }}
            >
              {coverageStatus === 'covered' ? '☑' :
               coverageStatus === 'partial' ? '◐' :
               coverageStatus === 'misaligned' ? '⚠' :
               coverageStatus === 'missing-not-started' ? '□' :
               coverageStatus === 'missing-skipped' ? '⊘' :
               '○'}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <AutoResizeTextarea
                  value={block.content}
                  onChange={(val) => updateBlock(block.id, val)}
                  onBlur={() => setEditingBlock(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setEditingBlock(null);
                      const newBlock = addBlock({ afterBlockId: block.id });
                      setSelectedBlockId(newBlock.id);
                      setTimeout(() => setEditingBlock(newBlock.id), 50);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        outdentBlock(block.id);
                      } else {
                        indentBlock(block.id);
                      }
                    }
                  }}
                  placeholder="Enter section content..."
                  className="w-full p-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  minRows={1}
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none cursor-pointer hover:bg-secondary/30 rounded px-1.5 py-0.5 -ml-1.5"
                  onClick={() => setEditingBlock(block.id)}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {block.content || "*Click to edit...*"}
                  </ReactMarkdown>
                </div>
              )}

              {/* Intent Row */}
              {block.intentTag && !isEditingIntent && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs group/intent">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="prose prose-xs text-amber-900 dark:text-amber-100 cursor-pointer hover:text-amber-700"
                      onClick={() => setEditingIntent(block.id)}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {block.intentTag}
                      </ReactMarkdown>
                    </div>
                    {block.intentCreatedBy && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <span>by</span>
                        {block.intentCreatedBy === currentUser.id ? (
                          <span className="font-medium">You</span>
                        ) : (
                          <>
                            <UserAvatar
                              name={block.intentCreatedByName}
                              email={block.intentCreatedByEmail}
                              avatarUrl={null}
                              className="h-3.5 w-3.5"
                            />
                            <span className="font-medium text-[9px]">
                              {block.intentCreatedByName || block.intentCreatedByEmail?.split('@')[0] || 'User'}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(block.intentCreatedAt || 0).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteIntentTag(block.id)}
                    className="opacity-0 group-hover/intent:opacity-100 p-0.5 hover:bg-destructive/10 rounded"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              )}

              {isEditingIntent && (
                <div className="mt-1.5 flex items-start gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-1" />
                  <AutoResizeTextarea
                    value={block.intentTag || ""}
                    onChange={(val) => updateIntentTag(block.id, val, currentUser.id)}
                    onBlur={() => setEditingIntent(null)}
                    placeholder="Describe the intent..."
                    className="flex-1 p-1 text-xs border-0 bg-amber-50 dark:bg-amber-950/20 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                    minRows={1}
                  />
                </div>
              )}
            </div>

            {/* Right side: Indent/Outdent + Assignee + Delete */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isHovered && block.level > 0 && (
                <button
                  onClick={() => outdentBlock(block.id)}
                  className="p-1 hover:bg-secondary rounded"
                  title="Outdent (move left)"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              {isHovered && (
                <button
                  onClick={() => indentBlock(block.id)}
                  className="p-1 hover:bg-secondary rounded"
                  title="Indent (move right)"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}

              {block.assignee ? (
                <div className="relative group/assignee">
                  <button
                    onClick={() => unassignBlock(block.id)}
                    className="cursor-pointer"
                    title={`Assigned to: ${block.assigneeName || block.assigneeEmail || 'User'}`}
                  >
                    <UserAvatar
                      name={block.assigneeName}
                      email={block.assigneeEmail}
                      avatarUrl={null}
                      className="h-6 w-6"
                    />
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover/assignee:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-10">
                    Click to unassign
                  </div>
                </div>
              ) : (
                isHovered && (
                  <button
                    onClick={() => assignBlock(block.id, currentUser.id)}
                    className="p-1 hover:bg-secondary rounded"
                    title="Assign to me"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )
              )}

              {isHovered && (
                <button
                  onClick={() => {
                    if (confirm("Delete this section and all its children?")) {
                      deleteBlock(block.id);
                    }
                  }}
                  className="p-1 hover:bg-destructive/10 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              )}
            </div>
          </div>

          {/* Footer: + intent button (hover), linked count */}
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <div>
              {!block.intentTag && !isEditingIntent && isHovered && (
                <button
                  onClick={() => setEditingIntent(block.id)}
                  className="text-amber-600 hover:text-amber-700 hover:underline"
                >
                  + add intent
                </button>
              )}
            </div>
            {linkedWritingCount > 0 && (
              <div>{linkedWritingCount} writing block{linkedWritingCount > 1 ? 's' : ''} linked</div>
            )}
          </div>
        </div>

        {/* Insert below button - shown on hover */}
        {isHovered && (
          <div className="mt-1 flex items-center gap-2 opacity-60 hover:opacity-100">
            <button
              onClick={() => {
                const newBlock = addBlock({ afterBlockId: block.id });
                setSelectedBlockId(newBlock.id);
                setEditingBlock(newBlock.id);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Insert below</span>
            </button>
            {hasChildren && (
              <button
                onClick={() => {
                  const newBlock = addBlock({ asChildOf: block.id });
                  setSelectedBlockId(newBlock.id);
                  setEditingBlock(newBlock.id);
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Add child</span>
              </button>
            )}
          </div>
        )}

        {/* Render children - includes both real blocks and suggested intents */}
        {!isCollapsed && (() => {
          // Get only real block children for SortableContext
          const realBlockChildren = childrenToRender
            .filter(item => item.type === 'block')
            .map(item => item.data);

          return (
            <SortableContext
              items={realBlockChildren.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {childrenToRender.map((item, index) => {
                  if (item.type === 'suggested') {
                    return (
                      <div key={`suggested-${index}`} style={{ marginLeft: '20px' }} className="mt-1">
                        <SuggestedIntentBlock suggestedIntent={item.data} />
                      </div>
                    );
                  } else {
                    return (
                      <SortableBlockItem key={item.data.id} id={item.data.id}>
                        {renderChildBlock(item.data, 1)}
                      </SortableBlockItem>
                    );
                  }
                })}
              </div>
            </SortableContext>
          );
        })()}
      </div>
    );
  };

  const renderChildBlock = (block: IntentBlock, depth: number): React.ReactElement => {
    // Get children from intentTree (includes both real blocks and suggested intents)
    const intentTreeChildren = getIntentTreeChildren(block.id);

    // Get regular children from blockMap, sorted by position
    const regularChildren = (blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);

    // Merge: include all intentTreeChildren + any regularChildren not in intentTree
    const renderedChildIds = new Set(
      intentTreeChildren
        .filter(item => item.type === 'block')
        .map(item => item.data.id)
    );
    const childrenToRender = [
      ...intentTreeChildren,
      ...regularChildren
        .filter(child => !renderedChildIds.has(child.id))
        .map(child => ({ type: 'block' as const, data: child }))
    ];

    const hasChildren = childrenToRender.length > 0;
    const isCollapsed = collapsedBlocks.has(block.id);
    const isEditing = editingBlock === block.id;
    const isEditingIntent = editingIntent === block.id;
    const linkedWritingCount = block.linkedWritingIds?.length || 0;
    const isHovered = hoveredBlock === block.id;

    // Get coverage status for child blocks (matching writing panel colors)
    const coverageStatus = coverage.getCoverageStatus(block.id);
    const coverageBgStyle = coverageStatus === 'covered'
      ? { backgroundColor: '#dcfce7' } // green - same as writing aligned
      : coverageStatus === 'partial'
      ? { backgroundColor: '#fef9c3' } // yellow
      : coverageStatus === 'misaligned'
      ? { backgroundColor: '#fed7aa' } // orange - same as writing misaligned
      : coverageStatus === 'missing-skipped'
      ? { backgroundColor: '#fee2e2' } // red - only for skipped, not "not-started"
      : {}; // missing-not-started = no color (default)

    // Add highlight when this child intent is hovered from writing panel
    const isIntentHovered = hoveredIntentId === block.id;
    const hoverRing = isIntentHovered ? 'ring-2 ring-purple-500 shadow-md bg-purple-50 dark:bg-purple-950/20' : '';

    // Add highlight when this child intent is actively being edited in writing panel
    const isActivelyEditing = activeIntentId === block.id;
    const activeEditingStyle = isActivelyEditing ? 'ring-2 ring-blue-500 shadow-md bg-blue-50 dark:bg-blue-950/20' : '';

    return (
      <div
        key={block.id}
        style={{ marginLeft: `${depth * 20}px` }}
        className="mt-1 group/child"
        onMouseEnter={() => {
          setHoveredBlock(block.id);
          if (onHoverIntent) {
            onHoverIntent(block.id);
          }
        }}
        onMouseLeave={() => {
          setHoveredBlock(null);
          if (onHoverIntent) {
            onHoverIntent(null);
          }
        }}
      >
        <div
          className={`border-l-2 pl-2 py-1 rounded-r transition-all ${activeEditingStyle || hoverRing} ${
            selectedBlockId === block.id
              ? "bg-primary/5 border-primary"
              : "border-secondary"
          }`}
          style={selectedBlockId === block.id ? {} : coverageBgStyle}
        >
          <div className="flex items-start gap-2">
            {hasChildren && (
              <button
                onClick={() => toggleCollapse(block.id)}
                className="flex-shrink-0 mt-0.5 hover:bg-secondary rounded p-0.5"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}

            {/* Checkbox Icon for child blocks */}
            <div
              className="flex-shrink-0 mt-0.5 text-sm cursor-pointer hover:scale-125 transition-transform"
              title={
                coverageStatus === 'covered' ? 'Covered' :
                coverageStatus === 'partial' ? 'Partial' :
                coverageStatus === 'misaligned' ? 'Misaligned' :
                coverageStatus === 'missing-not-started' ? 'Not started' :
                coverageStatus === 'missing-skipped' ? 'Skipped' :
                'No data'
              }
              onMouseEnter={(e) => {
                // Clear any pending hide timeout
                if (coverage.coverageTooltipTimeoutRef.current) {
                  clearTimeout(coverage.coverageTooltipTimeoutRef.current);
                  coverage.coverageTooltipTimeoutRef.current = null;
                }

                const details = coverage.getCoverageDetails(block.id);
                if (details) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  coverage.setCoverageTooltip({
                    x: rect.right + 10,
                    y: rect.top,
                    coverage: details
                  });
                }
              }}
              onMouseLeave={() => {
                // Delay hiding tooltip to allow user to hover over it
                coverage.coverageTooltipTimeoutRef.current = setTimeout(() => {
                  if (!coverage.isHoveringCoverageTooltipRef.current) {
                    coverage.setCoverageTooltip(null);
                  }
                }, 200);
              }}
            >
              {coverageStatus === 'covered' ? '☑' :
               coverageStatus === 'partial' ? '◐' :
               coverageStatus === 'misaligned' ? '⚠' :
               coverageStatus === 'missing-not-started' ? '□' :
               coverageStatus === 'missing-skipped' ? '⊘' :
               '○'}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <AutoResizeTextarea
                  value={block.content}
                  onChange={(val) => updateBlock(block.id, val)}
                  onBlur={() => setEditingBlock(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setEditingBlock(null);
                      const newBlock = addBlock({ afterBlockId: block.id });
                      setSelectedBlockId(newBlock.id);
                      setTimeout(() => setEditingBlock(newBlock.id), 50);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        outdentBlock(block.id);
                      } else {
                        indentBlock(block.id);
                      }
                    }
                  }}
                  placeholder="Enter content..."
                  className="w-full p-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  minRows={1}
                />
              ) : (
                <div
                  className="prose prose-xs max-w-none cursor-pointer hover:bg-secondary/50 rounded px-1 py-0.5 -ml-1"
                  onClick={() => setEditingBlock(block.id)}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {block.content || "*Click to edit...*"}
                  </ReactMarkdown>
                </div>
              )}

              {/* Intent for child block */}
              {block.intentTag && !isEditingIntent && (
                <div className="mt-1 flex items-start gap-1 text-xs group/intent">
                  <Lightbulb className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="prose prose-xs text-amber-900 dark:text-amber-100 cursor-pointer"
                      onClick={() => setEditingIntent(block.id)}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {block.intentTag}
                      </ReactMarkdown>
                    </div>
                    {block.intentCreatedBy && (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span>by</span>
                        {block.intentCreatedBy === currentUser.id ? (
                          <span className="font-medium">You</span>
                        ) : (
                          <>
                            <UserAvatar
                              name={block.intentCreatedByName}
                              email={block.intentCreatedByEmail}
                              avatarUrl={null}
                              className="h-3 w-3"
                            />
                            <span className="font-medium text-[8px]">
                              {block.intentCreatedByName || block.intentCreatedByEmail?.split('@')[0] || 'User'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteIntentTag(block.id)}
                    className="opacity-0 group-hover/intent:opacity-100 p-0.5 hover:bg-destructive/10 rounded"
                  >
                    <X className="h-2.5 w-2.5 text-destructive" />
                  </button>
                </div>
              )}

              {isEditingIntent && (
                <div className="mt-1 flex items-start gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                  <AutoResizeTextarea
                    value={block.intentTag || ""}
                    onChange={(val) => updateIntentTag(block.id, val, currentUser.id)}
                    onBlur={() => setEditingIntent(null)}
                    placeholder="Describe intent..."
                    className="flex-1 p-1 text-[11px] border-0 bg-amber-50 dark:bg-amber-950/20 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                    minRows={1}
                  />
                </div>
              )}

              {!block.intentTag && !isEditingIntent && isHovered && (
                <button
                  onClick={() => setEditingIntent(block.id)}
                  className="mt-0.5 text-[10px] text-amber-600 hover:underline"
                >
                  + intent
                </button>
              )}

              {linkedWritingCount > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {linkedWritingCount} linked
                </div>
              )}
            </div>

            {isHovered && block.level > 0 && (
              <button
                onClick={() => outdentBlock(block.id)}
                className="flex-shrink-0 p-0.5 hover:bg-secondary rounded"
                title="Outdent"
              >
                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {isHovered && (
              <button
                onClick={() => indentBlock(block.id)}
                className="flex-shrink-0 p-0.5 hover:bg-secondary rounded"
                title="Indent"
              >
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {isHovered && (
              <button
                onClick={() => {
                  if (confirm("Delete this item?")) {
                    deleteBlock(block.id);
                  }
                }}
                className="flex-shrink-0 p-0.5 hover:bg-destructive/10 rounded"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        </div>

        {/* Insert below button for child blocks */}
        {isHovered && (
          <div
            style={{ marginLeft: `${depth * 20}px` }}
            className="mt-0.5 flex items-center gap-2 opacity-60 hover:opacity-100"
          >
            <button
              onClick={() => {
                const newBlock = addBlock({ afterBlockId: block.id });
                setSelectedBlockId(newBlock.id);
                setEditingBlock(newBlock.id);
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
              <span>Insert below</span>
            </button>
            {hasChildren && (
              <button
                onClick={() => {
                  const newBlock = addBlock({ asChildOf: block.id });
                  setSelectedBlockId(newBlock.id);
                  setEditingBlock(newBlock.id);
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Add child</span>
              </button>
            )}
          </div>
        )}

        {/* Render children - includes both real blocks and suggested intents */}
        {!isCollapsed && (() => {
          // Get only real block children for SortableContext
          const realBlockChildren = childrenToRender
            .filter(item => item.type === 'block')
            .map(item => item.data);

          return (
            <SortableContext
              items={realBlockChildren.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {childrenToRender.map((item, index) => {
                  if (item.type === 'suggested') {
                    return (
                      <div key={`suggested-${index}`} style={{ marginLeft: `${(depth + 1) * 20}px` }} className="mt-1">
                        <SuggestedIntentBlock suggestedIntent={item.data} />
                      </div>
                    );
                  } else {
                    return (
                      <SortableBlockItem key={item.data.id} id={item.data.id}>
                        {renderChildBlock(item.data, depth + 1)}
                      </SortableBlockItem>
                    );
                  }
                })}
              </div>
            </SortableContext>
          );
        })()}
      </div>
    );
  };

  return (
    <>
      <DndContext
        sensors={dragDrop.sensors}
        collisionDetection={closestCenter}
        onDragStart={dragDrop.handleDragStart}
        onDragOver={dragDrop.handleDragOver}
        onDragEnd={dragDrop.handleDragEnd}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b">
            <div className="px-4 pt-4 pb-3">
              <div className="flex justify-between items-center gap-2">
                <h2 className="text-lg font-semibold">Intent Structure</h2>
                <div className="flex gap-2">
                  {importMarkdown && (
                    <ImportMarkdownDialog onImport={importMarkdown} />
                  )}
                  <Button onClick={handleAddBlock} size="sm">
                    + Add
                  </Button>
                </div>
              </div>
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
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {mergedRenderList.map((item, index) => {
                  if (item.type === 'suggested') {
                    return (
                      <div key={`suggested-root-${index}`} className="mb-2">
                        <SuggestedIntentBlock suggestedIntent={item.data} />
                      </div>
                    );
                  } else {
                    return (
                      <SortableBlockItem key={item.data.id} id={item.data.id}>
                        {renderRootBlock(item.data)}
                      </SortableBlockItem>
                    );
                  }
                })}
              </div>
            </SortableContext>
          )}
        </div>

        {/* Drag Overlay - shows the item being dragged */}
        <DragOverlay>
          {dragDrop.activeId ? (
            <div className="bg-background border border-primary rounded-lg p-3 shadow-lg opacity-80">
              {blocks.find(b => b.id === dragDrop.activeId)?.content || 'Dragging...'}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Coverage Details Tooltip */}
      {coverage.coverageTooltip && (
        <div
          className="fixed z-50 max-w-sm p-3 rounded-lg shadow-lg border bg-white dark:bg-gray-800"
          style={{
            left: `${coverage.coverageTooltip.x}px`,
            top: `${coverage.coverageTooltip.y}px`,
            borderColor: coverage.coverageTooltip.coverage.status === 'covered' ? '#86efac' :
                        coverage.coverageTooltip.coverage.status === 'partial' ? '#fde047' :
                        coverage.coverageTooltip.coverage.status === 'misaligned' ? '#fb923c' :
                        '#fca5a5',
          }}
          onMouseEnter={() => {
            // User is hovering over tooltip, cancel any hide timeout
            if (coverage.coverageTooltipTimeoutRef.current) {
              clearTimeout(coverage.coverageTooltipTimeoutRef.current);
              coverage.coverageTooltipTimeoutRef.current = null;
            }
            coverage.isHoveringCoverageTooltipRef.current = true;
          }}
          onMouseLeave={() => {
            // User left tooltip, hide it
            coverage.isHoveringCoverageTooltipRef.current = false;
            coverage.setCoverageTooltip(null);
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xs font-medium mb-1">
                {coverage.coverageTooltip.coverage.status === 'covered' ? '✓ Covered' :
                 coverage.coverageTooltip.coverage.status === 'partial' ? '◐ Partial' :
                 coverage.coverageTooltip.coverage.status === 'misaligned' ? '⚠ Misaligned' :
                 coverage.coverageTooltip.coverage.status === 'missing-not-started' ? '□ Not Started' :
                 '⊘ Skipped'}
              </div>

              <div className="text-xs text-gray-700 dark:text-gray-300">
                <p className="font-medium">{coverage.coverageTooltip.coverage.content}</p>
              </div>

              {/* Covered Aspects */}
              {coverage.coverageTooltip.coverage.coveredAspects && coverage.coverageTooltip.coverage.coveredAspects.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-medium text-green-700 dark:text-green-400">Covered:</div>
                  <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {coverage.coverageTooltip.coverage.coveredAspects.map((aspect: string, idx: number) => (
                      <li key={idx}>{aspect}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Aspects */}
              {coverage.coverageTooltip.coverage.missingAspects && coverage.coverageTooltip.coverage.missingAspects.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-medium text-red-700 dark:text-red-400">Missing:</div>
                  <ul className="text-[10px] text-gray-600 dark:text-gray-400 list-disc list-inside">
                    {coverage.coverageTooltip.coverage.missingAspects.map((aspect: string, idx: number) => (
                      <li key={idx}>{aspect}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestion */}
              {coverage.coverageTooltip.coverage.suggestion && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-[10px] text-blue-800 dark:text-blue-200">
                  <span className="font-medium">💡 Suggestion: </span>
                  {coverage.coverageTooltip.coverage.suggestion}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
