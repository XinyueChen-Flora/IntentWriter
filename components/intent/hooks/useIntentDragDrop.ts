import { useState, useCallback } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { IntentBlock } from '@/lib/partykit';

interface UseIntentDragDropProps {
  blocks: readonly IntentBlock[];
  reorderBlocks: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

export function useIntentDragDrop({ blocks, reorderBlocks }: UseIntentDragDropProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { over } = event;
    if (over) {
      setDragOverId(over.id as string);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    console.log('[useIntentDragDrop] handleDragEnd:', { active: active.id, over: over?.id });

    if (over && active.id !== over.id) {
      // Find blocks in all blocks (not just root)
      const activeBlock = blocks.find(b => b.id === active.id);
      const overBlock = blocks.find(b => b.id === over.id);

      console.log('[useIntentDragDrop] Found blocks:', {
        activeBlock: activeBlock?.content,
        activeParent: activeBlock?.parentId,
        overBlock: overBlock?.content,
        overParent: overBlock?.parentId
      });

      if (activeBlock && overBlock) {
        // Only allow reordering within the same parent
        if (activeBlock.parentId !== overBlock.parentId) {
          console.log('[useIntentDragDrop] Cannot drag across different parents');
          setActiveId(null);
          setDragOverId(null);
          return;
        }

        // Get siblings (blocks with same parentId)
        const siblings = blocks
          .filter(b => b.parentId === activeBlock.parentId)
          .sort((a, b) => a.position - b.position);

        const activeIndex = siblings.findIndex(b => b.id === active.id);
        const overIndex = siblings.findIndex(b => b.id === over.id);

        // If dragging down, insert after. If dragging up, insert before.
        const position = activeIndex < overIndex ? 'after' : 'before';

        console.log('[useIntentDragDrop] Calling reorderBlocks:', {
          activeId: active.id,
          targetId: over.id,
          position,
          activeIndex,
          overIndex,
          parentId: activeBlock.parentId
        });

        reorderBlocks(active.id as string, over.id as string, position);
      }
    }

    setActiveId(null);
    setDragOverId(null);
  }, [blocks, reorderBlocks]);

  return {
    sensors,
    activeId,
    dragOverId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
