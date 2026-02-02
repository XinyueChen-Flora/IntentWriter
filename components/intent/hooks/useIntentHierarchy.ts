import { useMemo, useCallback } from 'react';
import type { IntentBlock } from '@/lib/partykit';
import type { AlignmentResult } from '../../editor/WritingEditor';

interface UseIntentHierarchyProps {
  blocks: readonly IntentBlock[];
  alignmentResults?: Map<string, AlignmentResult>;
  localSuggestedIntents?: Map<string, AlignmentResult>; // Local-only, not synced
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
  localSuggestedIntents,
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
   * Find an intent node in ANY intentTree by intentId
   * Searches through ALL alignment results, not just the first one
   */
  const findIntentNode = useCallback((intentId: string): any | null => {
    if (!alignmentResults) return null;

    // Search through ALL alignment results
    for (const alignmentResult of alignmentResults.values()) {
      if (!alignmentResult.intentTree) continue;

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

      const found = search(alignmentResult.intentTree);
      if (found) return found;
    }

    return null;
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
   * based on the intentTree structure from ALL alignment results
   */
  const buildMergedRenderList = useCallback((): RenderListItem[] => {
    const renderList: RenderListItem[] = [];

    // Use localSuggestedIntents for rendering suggestions (not synced)
    // Use alignmentResults for coverage status (synced)
    const suggestionsSource = localSuggestedIntents || new Map();

    if (suggestionsSource.size === 0) {
      // No local suggestions, just render blocks normally
      return rootBlocks.map(block => ({ type: 'block' as const, data: block }));
    }

    const blockById = new Map(blocks.map(b => [b.id, b]));
    const renderedBlockIds = new Set<string>();
    const addedSuggestions = new Set<string>(); // Prevent duplicate suggestions

    // Process ALL local suggested intents (only visible to the user who triggered check)
    suggestionsSource.forEach((alignmentResult, intentId) => {
      if (!alignmentResult.intentTree) return;

      // Process only ROOT level nodes (children will be handled by getIntentTreeChildren)
      alignmentResult.intentTree.forEach((node: any) => {
        if (node.isSuggested || node.status === 'extra') {
          // Only add if not explicitly accepted and not already added
          const suggestionKey = node.content.trim();
          if (!acceptedSuggestions.has(suggestionKey) && !addedSuggestions.has(suggestionKey)) {
            addedSuggestions.add(suggestionKey);
            // This is a suggested intent at root level
            renderList.push({
              type: 'suggested',
              data: { ...node, depth: 0, sourceIntentId: intentId }
            });
          }
        } else if (node.intentId) {
          // This is an existing intent - find the corresponding block
          const block = blockById.get(node.intentId);
          if (block && !block.parentId) {
            // Only process root blocks here (children handled by renderRootBlock)
            if (!renderedBlockIds.has(block.id)) {
              renderList.push({
                type: 'block',
                data: block
              });
              renderedBlockIds.add(block.id);
            }
          }
        }
      });
    });

    // CRITICAL: Add any root blocks that weren't in any intentTree (e.g., newly added blocks)
    rootBlocks.forEach(block => {
      if (!renderedBlockIds.has(block.id)) {
        renderList.push({
          type: 'block',
          data: block
        });
      }
    });

    console.log('[useIntentHierarchy] Built merged render list:', {
      totalItems: renderList.length,
      suggestedCount: renderList.filter(item => item.type === 'suggested').length,
      blockCount: renderList.filter(item => item.type === 'block').length,
      suggestions: renderList.filter(item => item.type === 'suggested').map(item => item.data.content.substring(0, 30)),
      usingLocalSuggestions: !!localSuggestedIntents && localSuggestedIntents.size > 0
    });

    return renderList;
  }, [localSuggestedIntents, blocks, rootBlocks, acceptedSuggestions]);

  const mergedRenderList = useMemo(() => buildMergedRenderList(), [buildMergedRenderList]);

  return {
    rootBlocks,
    blockMap,
    mergedRenderList,
    findIntentNode,
    getIntentTreeChildren,
  };
}
