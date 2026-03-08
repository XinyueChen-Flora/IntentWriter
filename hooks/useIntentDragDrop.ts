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

    if (over && active.id !== over.id) {
      // Find blocks in all blocks (not just root)
      const activeBlock = blocks.find(b => b.id === active.id);
      const overBlock = blocks.find(b => b.id === over.id);

      if (activeBlock && overBlock) {
        // Only allow reordering within the same parent
        if (activeBlock.parentId !== overBlock.parentId) {
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
