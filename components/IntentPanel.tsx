"use client";

import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import type { AlignmentResult } from "./WritingEditor";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2, Lightbulb, UserPlus, X, ChevronLeft, ChevronRightIcon, Plus, GripVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ImportMarkdownDialog from "./ImportMarkdownDialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import UserAvatar from "./UserAvatar";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  hoveredIntentId?: string | null;
  onHoverIntent?: (intentId: string | null) => void;
};

// Sortable Block Item Wrapper
function SortableBlockItem({
  id,
  children,
  isDragging,
}: {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
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
            className="flex-shrink-0 mt-2 opacity-0 group-hover/sortable:opacity-100 hover:bg-secondary rounded p-1 cursor-grab active:cursor-grabbing transition-opacity"
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
  hoveredIntentId,
  onHoverIntent,
}: IntentPanelProps) {
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingIntent, setEditingIntent] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over) {
      setDragOverId(over.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeBlock = blocks.find(b => b.id === active.id);
      const overBlock = blocks.find(b => b.id === over.id);

      if (activeBlock && overBlock) {
        // Get the flat list of all blocks in display order
        const allBlocks = [...blocks].sort((a, b) => a.position - b.position);
        const activeIndex = allBlocks.findIndex(b => b.id === active.id);
        const overIndex = allBlocks.findIndex(b => b.id === over.id);

        // If dragging down, insert after. If dragging up, insert before.
        const position = activeIndex < overIndex ? 'after' : 'before';

        reorderBlocks(active.id as string, over.id as string, position);
      }
    }

    setActiveId(null);
    setDragOverId(null);
  };

  // Get coverage status for an intent
  const getCoverageStatus = (intentId: string): "covered" | "partial" | "missing" | null => {
    if (!alignmentResults) return null;
    const result = alignmentResults.get(intentId);
    if (!result) return null;
    return result.intentStatus.main;
  };

  const handleAddBlock = () => {
    const newBlock = addBlock();
    setSelectedBlockId(newBlock.id);
    setEditingBlock(newBlock.id);
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

  // Build hierarchy: group blocks by parent
  const rootBlocks = blocks.filter((b) => !b.parentId);
  const blockMap = new Map<string, IntentBlock[]>();
  blocks.forEach((block) => {
    if (block.parentId) {
      if (!blockMap.has(block.parentId)) {
        blockMap.set(block.parentId, []);
      }
      blockMap.get(block.parentId)!.push(block);
    }
  });

  const renderRootBlock = (block: IntentBlock): React.ReactElement => {
    const linkedWritingCount = block.linkedWritingIds?.length || 0;
    const children = blockMap.get(block.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedBlocks.has(block.id);
    const isEditing = editingBlock === block.id;
    const isEditingIntent = editingIntent === block.id;
    const isHovered = hoveredBlock === block.id;
    const isDraggedOver = dragOverId === block.id;

    // Get coverage status for background color
    const coverageStatus = getCoverageStatus(block.id);
    const coverageBg =
      coverageStatus === 'covered'
        ? 'bg-green-50 dark:bg-green-950/10'
        : coverageStatus === 'partial'
        ? 'bg-yellow-50 dark:bg-yellow-950/10'
        : coverageStatus === 'missing'
        ? 'bg-red-50 dark:bg-red-950/10'
        : 'bg-card';

    // Add highlight when this intent is hovered from writing panel
    const isIntentHovered = hoveredIntentId === block.id;
    const hoverRing = isIntentHovered ? 'ring-2 ring-primary shadow-lg' : '';

    // Determine drop indicator position
    let dropIndicator = null;
    if (isDraggedOver && activeId && activeId !== block.id) {
      const allBlocks = [...blocks].sort((a, b) => a.position - b.position);
      const activeIndex = allBlocks.findIndex(b => b.id === activeId);
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
        <div className={`border rounded-lg p-3 transition-all ${hoverRing} ${
          selectedBlockId === block.id ? "border-primary bg-primary/5" : `border-border ${coverageBg}`
        }`}>
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

              {/* Missing Coverage Warning */}
              {coverageStatus === 'missing' && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
                  <span className="font-medium">⚠ Not covered in writing</span>
                  <p className="mt-0.5 text-[10px] opacity-80">This intent has no corresponding writing content yet</p>
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

        {!isCollapsed && children.map((child) => renderChildBlock(child, 1))}
      </div>
    );
  };

  const renderChildBlock = (block: IntentBlock, depth: number): React.ReactElement => {
    const children = blockMap.get(block.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedBlocks.has(block.id);
    const isEditing = editingBlock === block.id;
    const isEditingIntent = editingIntent === block.id;
    const linkedWritingCount = block.linkedWritingIds?.length || 0;
    const isHovered = hoveredBlock === block.id;

    // Add highlight when this child intent is hovered from writing panel
    const isIntentHovered = hoveredIntentId === block.id;
    const hoverRing = isIntentHovered ? 'ring-2 ring-primary shadow-md' : '';

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
        <div className={`border-l-2 pl-2 py-1 rounded-r transition-all ${hoverRing} ${
          selectedBlockId === block.id
            ? "bg-primary/5 border-primary"
            : "bg-secondary/20 border-secondary"
        }`}>
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

        {!isCollapsed && children.map((child) => renderChildBlock(child, depth + 1))}
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b">
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

        {blocks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <p className="mb-4">No intent structure yet</p>
              <p className="text-sm">Use &ldquo;Import Structure&rdquo; or &ldquo;+ Add&rdquo; above to begin</p>
            </div>
          </div>
        ) : (
          <SortableContext
            items={blocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {rootBlocks.map((block) => (
                <SortableBlockItem key={block.id} id={block.id}>
                  {renderRootBlock(block)}
                </SortableBlockItem>
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </DndContext>
  );
}
