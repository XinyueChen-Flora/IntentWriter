import { useState, useCallback, useRef, useEffect } from 'react';
import type { AlignmentResult } from '../../editor/WritingEditor';

interface UseIntentCoverageProps {
  alignmentResults?: Map<string, AlignmentResult>;
}

export type CoverageStatus = "covered" | "partial" | "misaligned" | "missing-not-started" | "missing-skipped" | null;

export interface CoverageTooltip {
  x: number;
  y: number;
  coverage: any;
}

/**
 * Hook for managing intent coverage status and tooltips
 */
export function useIntentCoverage({ alignmentResults }: UseIntentCoverageProps) {
  const [coverageTooltip, setCoverageTooltip] = useState<CoverageTooltip | null>(null);
  const coverageTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringCoverageTooltipRef = useRef(false);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (coverageTooltipTimeoutRef.current) {
        clearTimeout(coverageTooltipTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Flatten intent tree to get all intents
   */
  const flattenIntentTree = useCallback((nodes: any[]): any[] => {
    const result: any[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result.push(...flattenIntentTree(node.children));
      }
    });
    return result;
  }, []);

  /**
   * Get coverage status for an intent from Intent Tree
   */
  const getCoverageStatus = useCallback((intentId: string): CoverageStatus => {
    if (!alignmentResults) return null;

    // Search through all alignment results for this intent
    for (const [, result] of alignmentResults.entries()) {
      if (!result.intentTree) continue;

      // Flatten tree to find intent
      const allIntents = flattenIntentTree(result.intentTree);
      const intent = allIntents.find((node: any) => node.intentId === intentId);

      if (intent) {
        return intent.status;
      }
    }

    return null;
  }, [alignmentResults, flattenIntentTree]);

  /**
   * Get full coverage details for an intent from Intent Tree
   */
  const getCoverageDetails = useCallback((intentId: string): any => {
    if (!alignmentResults) return null;

    for (const [, result] of alignmentResults.entries()) {
      if (!result.intentTree) continue;

      // Flatten tree to find intent
      const allIntents = flattenIntentTree(result.intentTree);
      const intent = allIntents.find(node => node.intentId === intentId);

      if (intent) {
        return intent; // Return the full intent node with all details
      }
    }

    return null;
  }, [alignmentResults, flattenIntentTree]);

  return {
    getCoverageStatus,
    getCoverageDetails,
    coverageTooltip,
    setCoverageTooltip,
    coverageTooltipTimeoutRef,
    isHoveringCoverageTooltipRef,
  };
}
