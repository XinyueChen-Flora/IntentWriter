import { useMemo, useCallback } from 'react';
import type { IntentBlock } from '@/lib/partykit';
import type { AlignmentResult } from '../../editor/WritingEditor';

interface UseIntentHierarchyProps {
  blocks: readonly IntentBlock[];
  alignmentResults?: Map<string, AlignmentResult>;
  acceptedSuggestions: Set<string>;
}

export type RenderListItem = {
  type: 'block' | 'suggested';
  data: any;
};

/**
 * Hook for managing intent hierarchy structure and tree navigation
 */
export function useIntentHierarchy({
  blocks,
  alignmentResults,
  acceptedSuggestions,
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
   * Find an intent node in the intentTree by intentId
   */
  const findIntentNode = useCallback((intentId: string): any | null => {
    if (!alignmentResults) return null;

    const firstAlignmentResult = Array.from(alignmentResults.values())[0];
    if (!firstAlignmentResult || !firstAlignmentResult.intentTree) return null;

    const search = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.intentId === intentId) return node;
        if (node.children && node.children.length > 0) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    return search(firstAlignmentResult.intentTree);
  }, [alignmentResults]);

  /**
   * Get children from intentTree (includes both real blocks and suggested)
   */
  const getIntentTreeChildren = useCallback((intentId: string): RenderListItem[] => {
    const intentNode = findIntentNode(intentId);
    if (!intentNode || !intentNode.children) return [];

    const result: RenderListItem[] = [];
    const blockById = new Map(blocks.map(b => [b.id, b]));

    intentNode.children.forEach((child: any) => {
      if (child.isSuggested || child.status === 'extra') {
        // Only filter if explicitly accepted
        const suggestionKey = child.content.trim();
        if (!acceptedSuggestions.has(suggestionKey)) {
          result.push({ type: 'suggested', data: child });
        }
      } else if (child.intentId) {
        const block = blockById.get(child.intentId);
        if (block) {
          result.push({ type: 'block', data: block });
        }
      }
    });

    return result;
  }, [findIntentNode, blocks, acceptedSuggestions]);

  /**
   * Build a merged rendering list that interleaves real blocks with suggested intents
   * based on the intentTree structure
   */
  const buildMergedRenderList = useCallback((): RenderListItem[] => {
    const renderList: RenderListItem[] = [];

    // Get the first alignment result's intentTree (assuming single root analysis)
    const firstAlignmentResult = alignmentResults ? Array.from(alignmentResults.values())[0] : null;
    if (!firstAlignmentResult || !firstAlignmentResult.intentTree) {
      // No alignment data, just render blocks normally
      return rootBlocks.map(block => ({ type: 'block' as const, data: block }));
    }

    const intentTree = firstAlignmentResult.intentTree;
    const blockById = new Map(blocks.map(b => [b.id, b]));
    const renderedBlockIds = new Set<string>();

    // Recursively build render list from intentTree
    const processNode = (node: any, depth: number = 0): void => {
      if (node.isSuggested || node.status === 'extra') {
        // Only filter if explicitly accepted
        const suggestionKey = node.content.trim();
        if (!acceptedSuggestions.has(suggestionKey)) {
          // This is a suggested intent that hasn't been accepted yet
          renderList.push({
            type: 'suggested',
            data: { ...node, depth }
          });
        }
      } else if (node.intentId) {
        // This is an existing intent - find the corresponding block
        const block = blockById.get(node.intentId);
        if (block && !block.parentId) {
          // Only process root blocks here (children handled by renderRootBlock)
          renderList.push({
            type: 'block',
            data: block
          });
          renderedBlockIds.add(block.id);
        }
      }
    };

    // Process only root level nodes (children will be handled recursively by render functions)
    intentTree.forEach((node: any) => processNode(node, 0));

    // CRITICAL: Add any root blocks that weren't in the intentTree (e.g., newly added blocks)
    rootBlocks.forEach(block => {
      if (!renderedBlockIds.has(block.id)) {
        renderList.push({
          type: 'block',
          data: block
        });
      }
    });

    return renderList;
  }, [alignmentResults, blocks, rootBlocks, acceptedSuggestions]);

  const mergedRenderList = useMemo(() => buildMergedRenderList(), [buildMergedRenderList]);

  return {
    rootBlocks,
    blockMap,
    mergedRenderList,
    findIntentNode,
    getIntentTreeChildren,
  };
}
