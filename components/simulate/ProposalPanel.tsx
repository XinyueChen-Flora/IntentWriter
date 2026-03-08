"use client";

import { useState } from "react";
import { X, Plus, Trash2, RotateCcw, ArrowRight, Pencil, Minus, Loader2 } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { DraftItem } from "../outline/IntentPanelContext";
import { useIntentPanelContext } from "../outline/IntentPanelContext";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { WordDiff } from "./WordDiff";

type ProposalPanelProps = {
  rootBlock: IntentBlock;
  currentChildren: IntentBlock[];
  onClose: () => void;
};

export function ProposalPanel({ rootBlock, currentChildren, onClose }: ProposalPanelProps) {
  const ctx = useIntentPanelContext();
  const draft = ctx.proposalDraft;
  if (!draft) return null;

  const isChangeMode = draft.action === 'change';
  const isCommentMode = draft.action === 'comment';

  // ─── Change mode: editable draft items ───

  const updateDraftItem = (id: string, content: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.map(item =>
        item.id === id ? { ...item, content } : item
      ),
    });
  };

  const toggleRemoveItem = (id: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.map(item =>
        item.id === id ? { ...item, isRemoved: !item.isRemoved } : item
      ),
    });
  };

  const addNewItem = () => {
    if (!draft.draftItems) return;
    const newItem: DraftItem = {
      id: `new-${Date.now()}`,
      content: '',
      originalContent: '',
      isNew: true,
      isRemoved: false,
    };
    ctx.setProposalDraft({
      ...draft,
      draftItems: [...draft.draftItems, newItem],
    });
  };

  const removeNewItem = (id: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.filter(item => item.id !== id),
    });
  };

  const updateComment = (text: string) => {
    ctx.setProposalDraft({ ...draft, comment: text });
  };

  // ─── Diff detection ───

  const hasChanges = (() => {
    if (isCommentMode) return (draft.comment?.trim() || '').length > 0;
    if (!draft.draftItems) return false;
    return draft.draftItems.some(item =>
      item.isNew ? item.content.trim() !== '' :
      item.isRemoved ? true :
      item.content !== item.originalContent
    );
  })();

  const changeCount = (() => {
    if (!draft.draftItems) return 0;
    return draft.draftItems.filter(item =>
      item.isNew ? item.content.trim() !== '' :
      item.isRemoved ? true :
      item.content !== item.originalContent
    ).length;
  })();

  // ─── Submit to simulate pipeline ───

  const handleCheckImpact = () => {
    if (!hasChanges) return;

    if (isCommentMode) {
      ctx.onProposeChange?.({
        type: 'comment',
        intentId: draft.triggerIntentId || rootBlock.id,
        content: draft.comment || '',
      });
      return;
    }

    // Build all changes as a batch
    if (draft.draftItems) {
      const proposals = draft.draftItems
        .map(item => {
          if (item.isNew && item.content.trim()) {
            return { type: 'add' as const, intentId: rootBlock.id, content: item.content.trim() };
          }
          if (item.isRemoved) {
            return { type: 'remove' as const, intentId: item.id, content: item.originalContent };
          }
          if (item.content !== item.originalContent) {
            return { type: 'edit' as const, intentId: item.id, content: item.content, previousContent: item.originalContent };
          }
          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (proposals.length > 0) {
        ctx.onProposeChange?.(proposals);
      }
    }
  };

  // ─── Impact loading state ───

  const isLoading = ctx.activeDiffSession?.sourceSectionId === rootBlock.id && ctx.activeDiffSession.isLoading;

  // ─── Render ───

  // Separate root item (first) from children
  const rootDraftItem = draft.draftItems?.find(item => item.id === rootBlock.id);
  const childDraftItems = draft.draftItems?.filter(item => item.id !== rootBlock.id) || [];

  return (
    <div className="w-[28%] flex-shrink-0 mr-2 border rounded-lg bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">
            {isChangeMode ? 'Draft Changes' : 'Comment'}
          </span>
          {isChangeMode && changeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {changeCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isChangeMode && draft.draftItems ? (
          <div>
            {/* Root block — editable */}
            {rootDraftItem && (
              <DraftItemRow
                item={rootDraftItem}
                isRoot
                onUpdate={(content) => updateDraftItem(rootDraftItem.id, content)}
                onToggleRemove={() => toggleRemoveItem(rootDraftItem.id)}
                onRemoveNew={() => {}}
              />
            )}

            {/* Child draft items */}
            <div className="space-y-1 mt-1">
              {childDraftItems.map(item => (
                <DraftItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(content) => updateDraftItem(item.id, content)}
                  onToggleRemove={() => toggleRemoveItem(item.id)}
                  onRemoveNew={() => removeNewItem(item.id)}
                />
              ))}
            </div>

            {/* Add new item button */}
            <button
              onClick={addNewItem}
              className="mt-1.5 ml-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              <Plus className="h-3 w-3" />
              <span>Add item</span>
            </button>
          </div>
        ) : isCommentMode ? (
          <div>
            {/* Which item this comment is about */}
            {draft.triggerIntentId && (() => {
              const targetBlock = ctx.blocks.find(b => b.id === draft.triggerIntentId);
              if (!targetBlock) return null;
              return (
                <div className="mb-1.5 px-2 py-1 bg-muted/50 rounded text-xs text-muted-foreground">
                  About: <span className="font-medium text-foreground">{targetBlock.content}</span>
                </div>
              );
            })()}
            <AutoResizeTextarea
              value={draft.comment || ''}
              onChange={updateComment}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Share your thoughts..."
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
              minRows={3}
              autoFocus
            />
          </div>
        ) : null}
      </div>

      {/* Footer: check impact button */}
      <div className="px-2 py-1.5 border-t bg-muted/30">
        <button
          onClick={handleCheckImpact}
          disabled={!hasChanges || isLoading}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowRight className="h-3 w-3" />
          )}
          {isLoading ? 'Analyzing...' : 'How does this affect other sections?'}
        </button>
      </div>
    </div>
  );
}

// ─── Individual draft item row ───

function DraftItemRow({
  item,
  isRoot,
  onUpdate,
  onToggleRemove,
  onRemoveNew,
}: {
  item: DraftItem;
  isRoot?: boolean;
  onUpdate: (content: string) => void;
  onToggleRemove: () => void;
  onRemoveNew: () => void;
}) {
  const [isEditing, setIsEditing] = useState(item.isNew);

  const isModified = !item.isNew && !item.isRemoved && item.content !== item.originalContent;

  // Cohesive palette: primary for new, amber for edits, dimmed for removal
  const stateStyle = item.isNew
    ? 'border-l-2 border-l-primary/50 border-y-border border-r-border bg-primary/[0.03] dark:bg-primary/[0.06]'
    : item.isRemoved
      ? 'border-l-2 border-l-muted-foreground/20 border-y-border border-r-border bg-muted/40 opacity-70'
      : isModified
        ? 'border-l-2 border-l-primary/30 border-y-border border-r-border bg-primary/[0.03] dark:bg-primary/[0.05]'
        : 'border-border';

  return (
    <div className={`${isRoot ? '' : 'ml-3'} border rounded-lg px-2 py-1.5 transition-all group/item ${stateStyle}`}>
      <div className="flex items-start gap-1.5">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {item.isRemoved ? (
            <div className={`text-sm line-through text-muted-foreground ${isRoot ? 'font-medium' : ''}`}>
              {item.originalContent}
            </div>
          ) : isEditing || item.isNew ? (
            <AutoResizeTextarea
              value={item.content}
              onChange={onUpdate}
              onBlur={() => { if (!item.isNew) setIsEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditing(false);
              }}
              placeholder={item.isNew ? 'New item...' : item.originalContent}
              className={`w-full px-0.5 py-0 text-sm bg-transparent border-none focus:outline-none focus:ring-0 resize-none ${isRoot ? 'font-medium' : ''}`}
              minRows={1}
              autoFocus
            />
          ) : (
            <div
              className={`text-sm cursor-text rounded px-0.5 hover:bg-muted/50 transition-colors ${isRoot ? 'font-medium' : ''}`}
              onClick={() => setIsEditing(true)}
            >
              {isModified ? (
                <WordDiff oldText={item.originalContent} newText={item.content} />
              ) : (
                item.content
              )}
            </div>
          )}
        </div>

        {/* Right side: status indicator + action */}
        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
          {item.isNew && (
            <Plus className="h-3 w-3 text-primary/70" />
          )}
          {item.isRemoved && (
            <Minus className="h-3 w-3 text-muted-foreground/60" />
          )}
          {isModified && (
            <Pencil className="h-2.5 w-2.5 text-primary/60" />
          )}

          {/* Action button */}
          {item.isNew ? (
            <button
              onClick={onRemoveNew}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          ) : item.isRemoved ? (
            <button
              onClick={onToggleRemove}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Undo removal"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          ) : !isRoot ? (
            <button
              onClick={onToggleRemove}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground/0 group-hover/item:text-muted-foreground/40 hover:!text-foreground transition-colors"
              title="Mark for removal"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
