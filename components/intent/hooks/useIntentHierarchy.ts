import { useMemo, useCallback } from 'react';
import type { IntentBlock } from '@/lib/partykit';

interface UseIntentHierarchyProps {
  blocks: readonly IntentBlock[];
}

export type RenderListItem = {
  type: 'block';
  data: IntentBlock;
};

/**
 * Hook for managing intent hierarchy structure and tree navigation
 */
export function useIntentHierarchy({
  blocks,
}: UseIntentHierarchyProps) {
  /**
   * Root blocks (blocks without a parent)
   */
  const rootBlocks = useMemo(
    () => blocks.filter((b) => !b.parentId).sort((a, b) => a.position - b.position),
    [blocks]
  );

  /**
   * Map of parent ID to children blocks
   */
  const blockMap = useMemo(() => {
    const map = new Map<string, IntentBlock[]>();
    blocks.forEach((block) => {
      if (block.parentId) {
        if (!map.has(block.parentId)) {
          map.set(block.parentId, []);
        }
        map.get(block.parentId)!.push(block);
      }
    });
    return map;
  }, [blocks]);

  /**
   * Get children for an intent from blockMap
   */
  const getIntentTreeChildren = useCallback((intentId: string): RenderListItem[] => {
    const children = blockMap.get(intentId) || [];
    return children
      .sort((a, b) => a.position - b.position)
      .map(child => ({ type: 'block' as const, data: child }));
  }, [blockMap]);

  /**
   * Simple render list of root blocks
   */
  const mergedRenderList: RenderListItem[] = useMemo(() => {
    return rootBlocks.map(block => ({ type: 'block' as const, data: block }));
  }, [rootBlocks]);

  return {
    rootBlocks,
    blockMap,
    mergedRenderList,
    getIntentTreeChildren,
  };
}
