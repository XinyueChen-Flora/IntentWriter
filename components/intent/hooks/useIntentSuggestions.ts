import { useState, useMemo, useCallback } from 'react';
import type { AlignmentResult } from '../../editor/WritingEditor';
import type { IntentBlock } from '@/lib/partykit';

interface UseIntentSuggestionsProps {
  alignmentResults?: Map<string, AlignmentResult>;
  blocks: readonly IntentBlock[];
  addBlock: (options?: { afterBlockId?: string; beforeBlockId?: string; asChildOf?: string }) => IntentBlock;
  updateBlock: (blockId: string, content: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
}

/**
 * Helper function to flatten intent tree
 */
function flattenIntentTree(nodes: any[]): any[] {
  const result: any[] = [];
  nodes.forEach(node => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      result.push(...flattenIntentTree(node.children));
    }
  });
  return result;
}

/**
 * Hook for managing AI-suggested intents
 */
export function useIntentSuggestions({
  alignmentResults,
  blocks,
  addBlock,
  updateBlock,
  setSelectedBlockId,
  setEditingBlock,
}: UseIntentSuggestionsProps) {
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());

  /**
   * Count extra content (suggested intents) across all alignment results
   */
  const extraContentCount = useMemo(() => {
    if (!alignmentResults) return 0;
    let count = 0;
    for (const result of alignmentResults.values()) {
      if (result.intentTree) {
        // Flatten tree and count suggested intents (extra content)
        const allIntents = flattenIntentTree(result.intentTree);
        count += allIntents.filter((intent: any) => intent.isSuggested || intent.status === 'extra').length;
      }
    }
    return count;
  }, [alignmentResults]);

  /**
   * Extract all suggested intents with their positions in the tree structure
   */
  const suggestedIntents = useMemo(() => {
    if (!alignmentResults) return [];
    const suggested: any[] = [];

    for (const result of alignmentResults.values()) {
      if (result.intentTree) {
        // Recursively extract suggested intents while preserving tree position
        const extractSuggested = (nodes: any[], parentPath: Array<string | number> = []): void => {
          nodes.forEach((node, index) => {
            if (node.isSuggested || node.status === 'extra') {
              suggested.push({
                ...node,
                treePath: [...parentPath, index], // Track position in tree
              });
            }
            if (node.children && node.children.length > 0) {
              extractSuggested(node.children, [...parentPath, index, 'children']);
            }
          });
        };

        extractSuggested(result.intentTree);
      }
    }

    console.log('[useIntentSuggestions] Suggested intents found:', suggested.length, suggested.map(s => s.content));
    return suggested;
  }, [alignmentResults]);

  /**
   * Accept a suggested intent: convert it to a real intent block
   */
  const handleAcceptSuggested = useCallback((suggestedIntent: any) => {
    console.log('[Accept Suggested] Full suggested intent:', suggestedIntent);
    console.log('[Accept Suggested] insertPosition:', suggestedIntent.insertPosition);

    // Mark as accepted to hide the suggestion
    const suggestionKey = suggestedIntent.content.trim();
    setAcceptedSuggestions(prev => new Set(prev).add(suggestionKey));

    // Use the structured insertPosition metadata if available
    if (suggestedIntent.insertPosition) {
      const { parentIntentId, beforeIntentId, afterIntentId } = suggestedIntent.insertPosition;

      console.log('[Accept Suggested] Position IDs:', { parentIntentId, beforeIntentId, afterIntentId });

      const insertionOptions: any = {};

      // Determine insertion position based on structured metadata
      if (beforeIntentId) {
        insertionOptions.beforeBlockId = beforeIntentId;
        console.log('[Accept Suggested] Using beforeBlockId:', beforeIntentId);
      } else if (afterIntentId) {
        insertionOptions.afterBlockId = afterIntentId;
        console.log('[Accept Suggested] Using afterBlockId:', afterIntentId);
      } else if (parentIntentId) {
        insertionOptions.asChildOf = parentIntentId;
        console.log('[Accept Suggested] Using asChildOf:', parentIntentId);
      }
      // If all are null, it means insert at root level (no options needed)

      console.log('[Accept Suggested] Final insertionOptions:', insertionOptions);
      console.log('[Accept Suggested] Available block IDs:', blocks.map(b => b.id));

      const newBlock = addBlock(insertionOptions);
      updateBlock(newBlock.id, suggestedIntent.content);
      setSelectedBlockId(newBlock.id);
      setEditingBlock(newBlock.id); // Start editing the new block
      return;
    }

    // Fallback: add at root level if no insertPosition metadata
    console.log('[Accept Suggested] No insertPosition, adding at root');
    const newBlock = addBlock();
    updateBlock(newBlock.id, suggestedIntent.content);
    setSelectedBlockId(newBlock.id);
    setEditingBlock(newBlock.id); // Start editing the new block
  }, [blocks, addBlock, updateBlock, setSelectedBlockId, setEditingBlock]);

  /**
   * Dismiss a suggestion (mark as accepted to hide it)
   */
  const handleDismissSuggestion = useCallback((suggestedIntent: any) => {
    const suggestionKey = suggestedIntent.content.trim();
    setAcceptedSuggestions(prev => new Set(prev).add(suggestionKey));
  }, []);

  return {
    acceptedSuggestions,
    extraContentCount,
    suggestedIntents,
    handleAcceptSuggested,
    handleDismissSuggestion,
  };
}
