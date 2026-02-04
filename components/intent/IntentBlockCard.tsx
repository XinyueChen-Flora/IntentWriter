"use client";

import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { ChevronDown, ChevronRight, Trash2, ChevronLeft, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { SortableBlockItem } from "./ui/SortableBlockItem";
import { AssignDropdown } from "./ui/AssignDropdown";
import RootIntentBlockNoteEditor from "../writing/RootIntentBlockNoteEditor";
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

export function IntentBlockCard({ block, isRoot, depth, rootIndex = 0 }: IntentBlockCardProps) {
  const ctx = useIntentPanelContext();

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.editingBlock === block.id;
  const isHovered = ctx.hoveredBlock === block.id;
  const isLinkSource = ctx.linkMode?.fromIntentId === block.id;

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
                isLinkSource
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-300"
                  : ctx.linkMode
                    ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/10 cursor-pointer hover:border-blue-400"
                    : ctx.selectedBlockId === block.id
                      ? "border-primary bg-primary/5"
                      : "border-primary/30 bg-card"
              }`}
              style={{
                ...(selectedDepColor ? { backgroundColor: `${selectedDepColor}18` } : {}),
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

                <div className="flex-1 min-w-0">
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
          </div>

          {/* Spacer + Writing panel — hidden in setup phase */}
          {!ctx.isSetupPhase && (
            <div className="flex-1 min-w-0 flex flex-row items-stretch">
              <div className="w-36 flex-shrink-0" />
              <div
                className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden"
                style={accentColor ? { borderLeftWidth: '3px', borderLeftColor: accentColor } : undefined}
              >
              {matchedWritingBlock ? (
                <RootIntentBlockNoteEditor
                  intent={block}
                  writingBlock={matchedWritingBlock}
                  roomId={ctx.roomId}
                  user={ctx.currentUser}
                  writingBlocks={ctx.writingBlocks as WritingBlock[]}
                  deleteWritingBlock={ctx.deleteWritingBlock}
                  updateIntentBlock={ctx.updateIntentBlockRaw}
                  onRegisterYjsExporter={ctx.onRegisterYjsExporter}
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
  return (
    <div
      ref={(el) => { ctx.registerBlockRef(block.id, el); }}
      style={{ marginLeft: `${depth * 16}px` }}
      className="mt-1 group/child"
      onMouseEnter={() => ctx.setHoveredBlock(block.id)}
      onMouseLeave={() => ctx.setHoveredBlock(null)}
      onClick={ctx.linkMode ? (e) => ctx.handleBlockClickForLink(block.id, e) : undefined}
    >
      <div
        className={`border-l-2 pl-3 py-1.5 rounded-r transition-all ${
          isLinkSource
            ? "bg-blue-50 border-blue-500 dark:bg-blue-950/30"
            : ctx.linkMode
              ? "bg-blue-50/50 border-blue-300 dark:bg-blue-950/10 cursor-pointer"
              : ctx.selectedBlockId === block.id
                ? "bg-primary/5 border-primary"
                : "border-border"
        }`}
        style={selectedDepColor ? { backgroundColor: `${selectedDepColor}18` } : undefined}
      >
        <div className="flex items-start gap-2">
          {hasChildren && (
            <button
              onClick={() => ctx.toggleCollapse(block.id)}
              className="flex-shrink-0 mt-0.5 hover:bg-secondary rounded p-0.5"
            >
              {isCollapsed ? <ChevronRight className={chevronSize} /> : <ChevronDown className={chevronSize} />}
            </button>
          )}

          <div className="flex-1 min-w-0">
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
