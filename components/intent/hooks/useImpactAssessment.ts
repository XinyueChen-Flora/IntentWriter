import { useState, useCallback } from "react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";

export type SectionImpact = {
  sectionId: string;
  sectionIntent: string;
  impactLevel: 'none' | 'minor' | 'significant';
  reason: string;
  childIntents: Array<{ id: string; content: string; position: number }>;
  suggestedChanges?: Array<{
    action: 'add' | 'modify' | 'remove';
    intentId?: string;
    content: string;
    position: number;
    reason: string;
  }>;
};

export type PendingChange = {
  suggestedIntent: string;
  orphanStart: string;
  isLoadingImpact?: boolean;
  sectionImpacts?: SectionImpact[];
};

type UseImpactAssessmentParams = {
  block: IntentBlock;
  blocks: readonly IntentBlock[];
  blockMap: Map<string, IntentBlock[]>;
  dependencies?: IntentDependency[];
  getWritingContent?: (rootIntentId: string) => Promise<string>;
};

export function useImpactAssessment({
  block,
  blocks,
  blockMap,
  dependencies,
  getWritingContent,
}: UseImpactAssessmentParams) {
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [isLoadingGapSuggestion, setIsLoadingGapSuggestion] = useState(false);

  const children = (blockMap.get(block.id) || []).sort((a, b) => a.position - b.position);

  // Find related sections via dependencies
  const findRelatedSections = useCallback(async () => {
    const relatedSections: Array<{
      id: string;
      intentContent: string;
      childIntents: Array<{ id: string; content: string; position: number }>;
      writingContent: string;
      relationship: string;
    }> = [];

    if (!dependencies) return relatedSections;

    // Get all intent IDs in this section (root + all children)
    const sectionIntentIds = new Set<string>([block.id]);
    children.forEach(child => sectionIntentIds.add(child.id));

    // Find all dependencies involving any intent in this section
    const relevantDeps = dependencies.filter(
      d => sectionIntentIds.has(d.fromIntentId) || sectionIntentIds.has(d.toIntentId)
    );

    const addedRoots = new Set<string>();

    for (const dep of relevantDeps) {
      const relatedIntentId = sectionIntentIds.has(dep.fromIntentId) && !sectionIntentIds.has(dep.toIntentId)
        ? dep.toIntentId
        : sectionIntentIds.has(dep.toIntentId) && !sectionIntentIds.has(dep.fromIntentId)
          ? dep.fromIntentId
          : dep.toIntentId;

      const relatedBlock = blocks.find(b => b.id === relatedIntentId);
      if (!relatedBlock) continue;

      // Get root of related block
      let relatedRoot = relatedBlock;
      while (relatedRoot.parentId) {
        const parent = blocks.find(b => b.id === relatedRoot.parentId);
        if (parent) relatedRoot = parent;
        else break;
      }

      if (addedRoots.has(relatedRoot.id)) continue;
      addedRoots.add(relatedRoot.id);

      const relatedChildren = (blockMap.get(relatedRoot.id) || [])
        .sort((a, b) => a.position - b.position)
        .map((c, idx) => ({ id: c.id, content: c.content, position: idx }));

      const writingContent = getWritingContent
        ? await getWritingContent(relatedRoot.id)
        : '';

      relatedSections.push({
        id: relatedRoot.id,
        intentContent: relatedRoot.content,
        childIntents: relatedChildren,
        writingContent,
        relationship: dep.label || 'related',
      });
    }

    return relatedSections;
  }, [block.id, blocks, blockMap, children, dependencies, getWritingContent]);

  // Handle gap action (Update Intent or Update Writing)
  const handleGapAction = useCallback(async (
    action: 'intent' | 'writing',
    coverage: { status: 'covered' | 'partial' | 'missing'; note?: string },
    rootIntentId: string
  ) => {
    setIsLoadingGapSuggestion(true);
    try {
      let currentWriting = '';
      if (action === 'writing' && getWritingContent) {
        currentWriting = await getWritingContent(rootIntentId);
      }

      const response = await fetch('/api/generate-gap-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: block.id,
          intentContent: block.content,
          coverageStatus: coverage.status,
          coverageNote: coverage.note,
          rootIntentId,
          action,
          currentWriting,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.suggestion;
      }
      return null;
    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      return null;
    } finally {
      setIsLoadingGapSuggestion(false);
    }
  }, [block.id, block.content, getWritingContent]);

  // Handle "Add to Outline" - assess impact on related sections
  const handleAddToOutline = useCallback(async (suggestedIntent: string, orphanStart: string) => {
    setPendingChange({
      suggestedIntent,
      orphanStart,
      isLoadingImpact: true,
      sectionImpacts: [],
    });

    const relatedSections = await findRelatedSections();

    if (relatedSections.length === 0) {
      setPendingChange({
        suggestedIntent,
        orphanStart,
        isLoadingImpact: false,
        sectionImpacts: [],
      });
      return;
    }

    try {
      const response = await fetch('/api/assess-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: block.id,
          sectionIntent: block.content,
          proposedChanges: [{ id: 'new-1', content: suggestedIntent, status: 'new' }],
          relatedSections,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const sectionImpacts = data.impacts.map((impact: any) => {
          const original = relatedSections.find(s => s.id === impact.sectionId);
          return {
            sectionId: impact.sectionId,
            sectionIntent: impact.sectionIntent,
            impactLevel: impact.impactLevel,
            reason: impact.reason,
            childIntents: original?.childIntents || [],
            suggestedChanges: impact.suggestedChanges,
          };
        });

        setPendingChange({
          suggestedIntent,
          orphanStart,
          isLoadingImpact: false,
          sectionImpacts,
        });
      } else {
        setPendingChange({
          suggestedIntent,
          orphanStart,
          isLoadingImpact: false,
          sectionImpacts: [],
        });
      }
    } catch (error) {
      console.error('Failed to assess impact:', error);
      setPendingChange({
        suggestedIntent,
        orphanStart,
        isLoadingImpact: false,
        sectionImpacts: [],
      });
    }
  }, [block.id, block.content, findRelatedSections]);

  return {
    pendingChange,
    setPendingChange,
    isLoadingGapSuggestion,
    handleGapAction,
    handleAddToOutline,
    findRelatedSections,
  };
}
