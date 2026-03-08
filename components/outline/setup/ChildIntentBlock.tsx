"use client";

import type { IntentBlock } from "@/lib/partykit";
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

type ChildIntentBlockProps = {
  block: IntentBlock;
  depth: number;
};

/**
 * ChildIntentBlock — Setup phase only.
 * Freely editable: click to edit, Enter to add, Tab to indent, delete directly.
 */
export function ChildIntentBlock({ block, depth }: ChildIntentBlockProps) {
  const ctx = useIntentPanelContext();

  const children = (ctx.blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);
  const hasChildren = children.length > 0;
  const isCollapsed = ctx.collapsedBlocks.has(block.id);
  const isEditing = ctx.editingBlock === block.id;
  const isHovered = ctx.hoveredBlock === block.id;

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
        className={`border rounded-lg px-3 py-1.5 transition-all shadow-sm hover:shadow-md hover:border-primary/50 ${
          ctx.selectedBlockId === block.id ? "border-primary" : "border-border"
        } bg-card`}
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
                placeholder="Type here..."
                className={textClass}
                minRows={1}
                autoFocus
              />
            ) : (
              <div
                className={proseClass}
                onClick={() => ctx.setEditingBlock(block.id)}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content || "*Click to edit...*"}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {ctx.addDependency && (
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
