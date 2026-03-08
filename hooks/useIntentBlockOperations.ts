import { useCallback } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import { importMarkdownAsIntents } from "@/lib/importIntents";

interface UseIntentBlockOperationsParams {
  intentBlocks: readonly IntentBlock[];
  writingBlocks: readonly WritingBlock[];
  user: User;
  updateIntentBlockRaw: (blockId: string, updates: Partial<IntentBlock>) => void;
  addIntentBlockRaw: (block: IntentBlock) => void;
  deleteIntentBlockRaw: (blockId: string) => void;
  addWritingBlockRaw: (block: WritingBlock) => void;
  deleteWritingBlockRaw: (blockId: string) => void;
}

export function useIntentBlockOperations({
  intentBlocks,
  writingBlocks,
  user,
  updateIntentBlockRaw,
  addIntentBlockRaw,
  deleteIntentBlockRaw,
  addWritingBlockRaw,
  deleteWritingBlockRaw,
}: UseIntentBlockOperationsParams) {
  // Delete writing block
  const deleteWritingBlock = useCallback(
    (blockId: string) => {
      deleteWritingBlockRaw(blockId);
    },
    [deleteWritingBlockRaw]
  );

  // Ensure writing blocks for root intents only
  const ensureWritingBlocksForIntents = useCallback(() => {
    const rootIntents = intentBlocks.filter((intent) => !intent.parentId);
    const existingLinkedIntents = new Set(
      writingBlocks
        .filter((wb) => wb.linkedIntentId)
        .map((wb) => wb.linkedIntentId)
    );

    // Calculate safe max position
    let maxPosition = -1;
    if (writingBlocks.length > 0) {
      const positions = writingBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
      if (positions.length > 0) {
        maxPosition = Math.max(...positions);
      }
    }

    rootIntents.forEach((intent) => {
      if (!existingLinkedIntents.has(intent.id)) {
        maxPosition++;
        const newWritingBlock: WritingBlock = {
          id: `writing-${Date.now()}-${Math.random()}`,
          content: "",
          position: maxPosition,
          linkedIntentId: intent.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addWritingBlockRaw(newWritingBlock);
      }
    });
  }, [intentBlocks, writingBlocks, addWritingBlockRaw]);

  // Add intent block
  const addIntentBlock = useCallback((options?: {
    afterBlockId?: string;
    beforeBlockId?: string;
    asChildOf?: string;
  }) => {
    let targetPosition: number;
    let parentId: string | null = null;
    let level = 0;

    if (options?.asChildOf) {
      const parentBlock = intentBlocks.find(b => b.id === options.asChildOf);
      if (parentBlock) {
        parentId = parentBlock.id;
        level = parentBlock.level + 1;
        const siblings = intentBlocks.filter(b => b.parentId === parentId);
        if (siblings.length > 0) {
          const maxSiblingPosition = Math.max(...siblings.map(b => b.position));
          targetPosition = maxSiblingPosition + 1;
        } else {
          targetPosition = parentBlock.position + 0.5;
        }
      } else {
        targetPosition = intentBlocks.length;
      }
    } else if (options?.afterBlockId) {
      const afterBlock = intentBlocks.find(b => b.id === options.afterBlockId);
      if (afterBlock) {
        parentId = afterBlock.parentId;
        level = afterBlock.level;
        targetPosition = afterBlock.position + 0.5;
      } else {
        targetPosition = intentBlocks.length;
      }
    } else if (options?.beforeBlockId) {
      const beforeBlock = intentBlocks.find(b => b.id === options.beforeBlockId);
      if (beforeBlock) {
        parentId = beforeBlock.parentId;
        level = beforeBlock.level;
        targetPosition = beforeBlock.position - 0.5;
      } else {
        targetPosition = 0;
      }
    } else {
      let maxPosition = -1;
      if (intentBlocks.length > 0) {
        const positions = intentBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
        if (positions.length > 0) {
          maxPosition = Math.max(...positions);
        }
      }
      targetPosition = maxPosition + 1;
    }

    const newBlock: IntentBlock = {
      id: `intent-${Date.now()}-${Math.random()}`,
      content: "",
      position: targetPosition,
      linkedWritingIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId,
      level,
      intentTag: undefined,
      intentCreatedBy: undefined,
      intentCreatedAt: undefined,
      isCollapsed: false,
      assignee: undefined,
    };
    addIntentBlockRaw(newBlock);

    // Reorder positions to ensure they're sequential
    setTimeout(() => {
      const sortedBlocks = [...intentBlocks, newBlock].sort((a, b) => a.position - b.position);
      sortedBlocks.forEach((block, index) => {
        if (block.position !== index) {
          updateIntentBlockRaw(block.id, { position: index });
        }
      });
    }, 100);

    return newBlock;
  }, [intentBlocks, addIntentBlockRaw, updateIntentBlockRaw]);

  // Update intent block content
  const updateIntentBlock = useCallback(
    (blockId: string, content: string) => {
      updateIntentBlockRaw(blockId, {
        content,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Assign block to user
  const assignBlock = useCallback(
    (blockId: string, userId: string, userName?: string, userEmail?: string) => {
      updateIntentBlockRaw(blockId, {
        assignee: userId,
        assigneeName: userName,
        assigneeEmail: userEmail,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Unassign block
  const unassignBlock = useCallback(
    (blockId: string) => {
      updateIntentBlockRaw(blockId, {
        assignee: undefined,
        assigneeName: undefined,
        assigneeEmail: undefined,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Delete intent block
  const deleteIntentBlock = useCallback(
    (blockId: string) => {
      deleteIntentBlockRaw(blockId);
    },
    [deleteIntentBlockRaw]
  );

  // Indent block (increase level, make it a child of previous block)
  const indentBlock = useCallback(
    (blockId: string) => {
      const blockIndex = intentBlocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return;

      const currentBlock = intentBlocks[blockIndex];
      const wasRoot = currentBlock.level === 0 && !currentBlock.parentId;

      let newParentId: string | null = null;
      for (let i = blockIndex - 1; i >= 0; i--) {
        const prevBlock = intentBlocks[i];
        if (prevBlock.level === currentBlock.level) {
          newParentId = prevBlock.id;
          break;
        } else if (prevBlock.level < currentBlock.level) {
          break;
        }
      }

      if (newParentId) {
        if (wasRoot) {
          const writingBlock = writingBlocks.find((wb) => wb.linkedIntentId === blockId);

          if (writingBlock) {
            let rootParentId = newParentId;
            let parentBlock = intentBlocks.find((b) => b.id === newParentId);

            while (parentBlock && parentBlock.parentId) {
              rootParentId = parentBlock.parentId;
              parentBlock = intentBlocks.find((b) => b.id === rootParentId);
            }

            updateIntentBlockRaw(rootParentId, {
              mergeWritingFrom: writingBlock.id,
              updatedAt: Date.now(),
            });
          }
        }

        updateIntentBlockRaw(blockId, {
          level: currentBlock.level + 1,
          parentId: newParentId,
          updatedAt: Date.now(),
        });
      }
    },
    [intentBlocks, writingBlocks, updateIntentBlockRaw]
  );

  // Outdent block (decrease level, move up in hierarchy)
  const outdentBlock = useCallback(
    (blockId: string) => {
      const currentBlock = intentBlocks.find((b) => b.id === blockId);
      if (!currentBlock || currentBlock.level === 0) return;

      let newParentId: string | null = null;
      if (currentBlock.parentId) {
        const parentBlock = intentBlocks.find((b) => b.id === currentBlock.parentId);
        if (parentBlock) {
          newParentId = parentBlock.parentId;
        }
      }

      updateIntentBlockRaw(blockId, {
        level: currentBlock.level - 1,
        parentId: newParentId,
        updatedAt: Date.now(),
      });
    },
    [intentBlocks, updateIntentBlockRaw]
  );

  // Reorder blocks (for drag and drop)
  const reorderBlocks = useCallback(
    (draggedId: string, targetId: string, position: 'before' | 'after') => {
      const draggedBlock = intentBlocks.find((b) => b.id === draggedId);
      const targetBlock = intentBlocks.find((b) => b.id === targetId);

      if (!draggedBlock || !targetBlock) return;

      // Don't allow dragging a parent into its own child
      let current = targetBlock;
      while (current?.parentId) {
        if (current.parentId === draggedId) return;
        current = intentBlocks.find((b) => b.id === current.parentId)!;
        if (!current) break;
      }

      const parentId = targetBlock.parentId;
      const siblings = intentBlocks
        .filter((b) => b.parentId === parentId)
        .sort((a, b) => a.position - b.position);

      if (siblings.length === 0) return;

      const draggedInSiblings = siblings.some(b => b.id === draggedId);

      const withoutDragged = draggedInSiblings
        ? siblings.filter((b) => b.id !== draggedId)
        : siblings;

      const targetIndex = withoutDragged.findIndex((b) => b.id === targetId);
      if (targetIndex === -1) return;

      let newOrder: IntentBlock[];
      if (position === 'before') {
        newOrder = [
          ...withoutDragged.slice(0, targetIndex),
          draggedBlock,
          ...withoutDragged.slice(targetIndex)
        ];
      } else {
        newOrder = [
          ...withoutDragged.slice(0, targetIndex + 1),
          draggedBlock,
          ...withoutDragged.slice(targetIndex + 1)
        ];
      }

      newOrder.forEach((block, index) => {
        const updates: Partial<IntentBlock> = {
          position: index,
          updatedAt: Date.now(),
        };

        if (block.id === draggedId) {
          updates.parentId = targetBlock.parentId;
          updates.level = targetBlock.level;
        }

        updateIntentBlockRaw(block.id, updates);
      });
    },
    [intentBlocks, updateIntentBlockRaw]
  );

  // Import markdown intents
  const importMarkdownIntents = useCallback(
    (markdown: string) => {
      importMarkdownAsIntents(markdown, intentBlocks, user, addIntentBlockRaw);
    },
    [intentBlocks, user, addIntentBlockRaw]
  );

  return {
    addIntentBlock,
    updateIntentBlock,
    assignBlock,
    unassignBlock,
    deleteIntentBlock,
    indentBlock,
    outdentBlock,
    reorderBlocks,
    deleteWritingBlock,
    ensureWritingBlocksForIntents,
    importMarkdownIntents,
  };
}
