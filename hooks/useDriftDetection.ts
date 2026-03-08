"use client";

import { useState, useCallback, useMemo } from "react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";

// ============================================
// UNIFIED TYPES (matching API)
// ============================================

// Sentence anchor for precise text matching
export type SentenceAnchor = {
  start: string;  // first ~10 words
  end: string;    // last ~10 words
};

// Unified intent entry - includes both existing and new intents
export type AlignedIntent = {
  id: string;
  content: string;
  parentId: string | null;
  position: number;

  intentStatus: 'existing' | 'new' | 'modified' | 'removed';
  coverageStatus: 'covered' | 'partial' | 'missing';

  sentences: SentenceAnchor[];        // sentences supporting this intent
  suggestedWriting?: string;          // for partial/missing: what to write
  coverageNote?: string;              // for partial: what's missing
  insertAfter?: SentenceAnchor;       // for missing: sentence to insert AFTER
};

// Dependency issue between sections
export type DependencyIssue = {
  relationship: string;
  severity: 'warning' | 'conflict';
  issue: string;
  localSentences: SentenceAnchor[];
  remoteSectionId: string;
  remoteSectionIntent: string;
  remoteSentences: SentenceAnchor[];
};

// Cross-section impact from changes
export type CrossSectionImpact = {
  sectionId: string;
  sectionIntent: string;
  impactType: 'needs-update' | 'potential-conflict';
  description: string;
};

// Main drift status - includes both new and old formats for compatibility
export type DriftStatus = {
  intentId: string;
  level: 'aligned' | 'partial' | 'drifted';

  // NEW: Unified array - all intents with their sentences
  alignedIntents: AlignedIntent[];

  // Issues
  dependencyIssues: DependencyIssue[];
  crossSectionImpacts: CrossSectionImpact[];

  summary: string;
  checkedAt: number;

  // BACKWARD COMPATIBILITY: Derived from alignedIntents
  intentCoverage: IntentCoverageItem[];
  orphanSentences: OrphanSentence[];
};

export type UseDriftDetectionProps = {
  blocks: readonly IntentBlock[];
  dependencies?: IntentDependency[];
  markdownExporters: Map<string, () => Promise<string>>;
  intentToWritingMap: Map<string, { id: string }>;
};

// Sentence highlight for writing side (new unified format)
export type SentenceHighlight = {
  anchor: SentenceAnchor;
  intentId: string;
  type: 'covered' | 'partial' | 'orphan';
};

// ============================================
// BACKWARD COMPATIBILITY TYPES
// ============================================

// Old format: supporting sentence with intent mapping
export type SupportingSentence = {
  anchor: SentenceAnchor;
  intentIds: string[];
};

// Old format: orphan sentence
export type OrphanSentence = {
  start: string;
  end: string;
  suggestion: 'delete' | 'add-intent';
  suggestedIntent?: string;
};

// Old format: intent coverage item
export type IntentCoverageItem = {
  intentId: string;
  status: 'covered' | 'partial' | 'missing';
  supportingSentences: SentenceAnchor[];
  note?: string;
};

// Old format: simulated intent
export type SimulatedIntent = {
  id: string;
  content: string;
  parentId: string | null;
  position: number;
  status: 'existing' | 'new' | 'modified' | 'removed';
  originalContent?: string;
  sourceOrphanStart?: string;
};

// Old format: simulated outline
export type SimulatedOutline = {
  intents: SimulatedIntent[];
  crossSectionImpacts: CrossSectionImpact[];
  summary: string;
};

export type UseDriftDetectionResult = {
  driftMap: Map<string, DriftStatus>;
  checkingIds: Set<string>;
  isChecking: boolean;
  triggerCheck: (sectionId?: string) => Promise<void>;
  getDriftStatus: (rootIntentId: string) => DriftStatus | undefined;

  // NEW: Get all aligned intents
  getAlignedIntents: (rootIntentId: string) => AlignedIntent[];

  // For writing side highlighting (old format for compatibility)
  getSentenceHighlights: (rootIntentId: string) => {
    supporting: SupportingSentence[];
    partial: SupportingSentence[];
    orphan: OrphanSentence[];
    conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
  };

  // For dependency line coloring
  getConflictForDependency: (fromSectionId: string, toSectionId: string) => DependencyIssue | undefined;

  // Check if there are changes
  hasChanges: (rootIntentId: string) => boolean;

  // Get simulated outline (derived from alignedIntents)
  getSimulatedOutline: (rootIntentId: string) => SimulatedOutline | undefined;
  hasSimulatedOutline: (rootIntentId: string) => boolean;
};

export function useDriftDetection({
  blocks,
  dependencies,
  markdownExporters,
  intentToWritingMap,
}: UseDriftDetectionProps): UseDriftDetectionResult {
  const [driftMap, setDriftMap] = useState<Map<string, DriftStatus>>(new Map());
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  // Get root blocks
  const rootBlocks = useMemo(() => {
    return blocks.filter(b => !b.parentId);
  }, [blocks]);

  // Build child map
  const childMap = useMemo(() => {
    const map = new Map<string, IntentBlock[]>();
    blocks.forEach(b => {
      if (b.parentId) {
        const siblings = map.get(b.parentId) || [];
        siblings.push(b);
        map.set(b.parentId, siblings);
      }
    });
    return map;
  }, [blocks]);

  // Get all descendants of a block
  const getDescendants = useCallback((blockId: string): IntentBlock[] => {
    const children = childMap.get(blockId) || [];
    const descendants: IntentBlock[] = [...children];
    children.forEach(child => {
      descendants.push(...getDescendants(child.id));
    });
    return descendants;
  }, [childMap]);

  // Find root ancestor of a block
  const getRootId = useCallback((blockId: string): string => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !block.parentId) return blockId;
    return getRootId(block.parentId);
  }, [blocks]);

  // Check a single section
  const checkSection = useCallback(async (rootIntentId: string) => {
    const rootBlock = blocks.find(b => b.id === rootIntentId);
    if (!rootBlock) return;

    // Get writing content
    const writingBlock = intentToWritingMap.get(rootIntentId);
    if (!writingBlock) return;

    const exporter = markdownExporters.get(writingBlock.id);
    if (!exporter) return;

    setCheckingIds(prev => new Set(prev).add(rootIntentId));

    try {
      const writingMarkdown = await exporter();

      // Build child intents with proper outline ordering (depth-first)
      // This ensures the position reflects the actual reading order in the outline
      const buildOrderedIntents = (parentId: string, startIndex: number): Array<{
        id: string;
        content: string;
        parentId: string | null;
        position: number;
      }> => {
        const children = (childMap.get(parentId) || []).sort((a, b) => a.position - b.position);
        const result: Array<{ id: string; content: string; parentId: string | null; position: number }> = [];
        let currentIndex = startIndex;

        for (const child of children) {
          result.push({
            id: child.id,
            content: child.content,
            parentId: child.parentId,
            position: currentIndex++,
          });
          // Recursively add descendants
          const descendants = buildOrderedIntents(child.id, currentIndex);
          result.push(...descendants);
          currentIndex += descendants.length;
        }
        return result;
      };

      const childIntents = buildOrderedIntents(rootIntentId, 0);

      // Find related sections via dependencies
      const relatedSections: Array<{
        intentId: string;
        intentContent: string;
        writingMarkdown: string;
        relationship: string;
      }> = [];

      if (dependencies) {
        for (const dep of dependencies) {
          if (!dep.confirmed) continue;

          let relatedRootId: string | null = null;
          let relationship = dep.label || 'related';

          // Check if this section is involved in the dependency
          const fromRoot = getRootId(dep.fromIntentId);
          const toRoot = getRootId(dep.toIntentId);

          if (fromRoot === rootIntentId && toRoot !== rootIntentId) {
            relatedRootId = toRoot;
          } else if (toRoot === rootIntentId && fromRoot !== rootIntentId) {
            relatedRootId = fromRoot;
          }

          if (relatedRootId) {
            const relatedBlock = blocks.find(b => b.id === relatedRootId);
            const relatedWritingBlock = intentToWritingMap.get(relatedRootId);

            if (relatedBlock && relatedWritingBlock) {
              const relatedExporter = markdownExporters.get(relatedWritingBlock.id);
              if (relatedExporter) {
                try {
                  const relatedMarkdown = await relatedExporter();
                  relatedSections.push({
                    intentId: relatedRootId,
                    intentContent: relatedBlock.content,
                    writingMarkdown: relatedMarkdown,
                    relationship,
                  });
                } catch {
                  // Skip if can't export
                }
              }
            }
          }
        }
      }

      // Call API
      const response = await fetch('/api/check-drift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: {
            intentId: rootIntentId,
            intentContent: rootBlock.content,
            childIntents,
            writingMarkdown,
          },
          relatedSections,
        }),
      });

      if (!response.ok) {
        console.error('Check drift API failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.result) {
        const alignedIntents: AlignedIntent[] = data.result.alignedIntents || [];

        // Derive old-format intentCoverage from alignedIntents
        const intentCoverage: IntentCoverageItem[] = alignedIntents
          .filter(i => i.intentStatus === 'existing')
          .map(i => ({
            intentId: i.id,
            status: i.coverageStatus,
            supportingSentences: i.sentences,
            note: i.coverageNote,
          }));

        // Derive old-format orphanSentences from new intents
        const orphanSentences: OrphanSentence[] = alignedIntents
          .filter(i => i.intentStatus === 'new')
          .flatMap(i => i.sentences.map(s => ({
            start: s.start,
            end: s.end,
            suggestion: 'add-intent' as const,
            suggestedIntent: i.content,
          })));

        const status: DriftStatus = {
          ...data.result,
          alignedIntents,
          intentCoverage,
          orphanSentences,
          checkedAt: Date.now(),
        };
        setDriftMap(prev => new Map(prev).set(rootIntentId, status));
      }
    } catch (error) {
      console.error('Error checking drift:', error);
    } finally {
      setCheckingIds(prev => {
        const next = new Set(prev);
        next.delete(rootIntentId);
        return next;
      });
    }
  }, [blocks, dependencies, markdownExporters, intentToWritingMap, getDescendants, getRootId]);

  // Trigger check for one or all sections
  const triggerCheck = useCallback(async (sectionId?: string) => {
    if (sectionId) {
      await checkSection(sectionId);
    } else {
      // Check all root sections
      await Promise.all(rootBlocks.map(b => checkSection(b.id)));
    }
  }, [checkSection, rootBlocks]);

  // Get drift status for a section
  const getDriftStatus = useCallback((rootIntentId: string): DriftStatus | undefined => {
    return driftMap.get(rootIntentId);
  }, [driftMap]);

  // Get all aligned intents for a section
  const getAlignedIntents = useCallback((rootIntentId: string): AlignedIntent[] => {
    const status = driftMap.get(rootIntentId);
    return status?.alignedIntents || [];
  }, [driftMap]);

  // Get sentence highlights for writing side (returns old format for compatibility)
  const getSentenceHighlights = useCallback((rootIntentId: string): {
    supporting: SupportingSentence[];
    partial: SupportingSentence[];
    orphan: OrphanSentence[];
    conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
  } => {
    const status = driftMap.get(rootIntentId);

    const supporting: SupportingSentence[] = [];
    const partial: SupportingSentence[] = [];
    const orphan: OrphanSentence[] = [];
    const conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }> = [];

    if (!status) {
      return { supporting, partial, orphan, conflict };
    }

    // Build from intentCoverage (derived from alignedIntents)
    const coveredAnchors = new Map<string, { anchor: SentenceAnchor; intentIds: string[] }>();
    const partialAnchors = new Map<string, { anchor: SentenceAnchor; intentIds: string[] }>();

    status.intentCoverage.forEach(coverage => {
      const targetMap = coverage.status === 'covered' ? coveredAnchors :
                        coverage.status === 'partial' ? partialAnchors : null;

      if (targetMap) {
        coverage.supportingSentences.forEach(anchor => {
          const key = `${anchor.start}|||${anchor.end}`;
          const existing = targetMap.get(key);
          if (existing) {
            existing.intentIds.push(coverage.intentId);
          } else {
            targetMap.set(key, { anchor, intentIds: [coverage.intentId] });
          }
        });
      }
    });

    coveredAnchors.forEach(({ anchor, intentIds }) => {
      supporting.push({ anchor, intentIds });
    });

    partialAnchors.forEach(({ anchor, intentIds }) => {
      partial.push({ anchor, intentIds });
    });

    // Use orphanSentences (derived from alignedIntents new intents)
    orphan.push(...status.orphanSentences);

    // Conflict sentences
    status.dependencyIssues.forEach(issue => {
      issue.localSentences.forEach(anchor => {
        conflict.push({ anchor, issue });
      });
    });

    return { supporting, partial, orphan, conflict };
  }, [driftMap]);

  // Get conflict for a specific dependency (by section IDs)
  const getConflictForDependency = useCallback((fromSectionId: string, toSectionId: string): DependencyIssue | undefined => {
    const fromStatus = driftMap.get(fromSectionId);
    const toStatus = driftMap.get(toSectionId);

    if (fromStatus) {
      const issue = fromStatus.dependencyIssues.find(i => i.remoteSectionId === toSectionId);
      if (issue) return issue;
    }

    if (toStatus) {
      const issue = toStatus.dependencyIssues.find(i => i.remoteSectionId === fromSectionId);
      if (issue) return issue;
    }

    return undefined;
  }, [driftMap]);

  // Check if there are changes (new intents or missing coverage)
  const hasChanges = useCallback((rootIntentId: string): boolean => {
    const status = driftMap.get(rootIntentId);
    if (!status) return false;

    return status.alignedIntents.some(intent =>
      intent.intentStatus === 'new' ||
      intent.intentStatus === 'modified' ||
      intent.intentStatus === 'removed' ||
      intent.coverageStatus === 'missing' ||
      intent.coverageStatus === 'partial'
    );
  }, [driftMap]);

  // BACKWARD COMPATIBILITY: Derive SimulatedOutline from alignedIntents
  const getSimulatedOutline = useCallback((rootIntentId: string): SimulatedOutline | undefined => {
    const status = driftMap.get(rootIntentId);
    if (!status) return undefined;

    // Convert alignedIntents to SimulatedIntent format
    const intents: SimulatedIntent[] = status.alignedIntents.map(intent => ({
      id: intent.id,
      content: intent.content,
      parentId: intent.parentId,
      position: intent.position,
      status: intent.intentStatus,
      originalContent: undefined,
      sourceOrphanStart: intent.intentStatus === 'new' && intent.sentences[0]
        ? intent.sentences[0].start
        : undefined,
    }));

    return {
      intents,
      crossSectionImpacts: status.crossSectionImpacts,
      summary: status.summary,
    };
  }, [driftMap]);

  const hasSimulatedOutline = useCallback((rootIntentId: string): boolean => {
    const status = driftMap.get(rootIntentId);
    if (!status) return false;
    return status.alignedIntents.some(i => i.intentStatus !== 'existing');
  }, [driftMap]);

  const isChecking = checkingIds.size > 0;

  return {
    driftMap,
    checkingIds,
    isChecking,
    triggerCheck,
    getDriftStatus,
    getAlignedIntents,
    getSentenceHighlights,
    getConflictForDependency,
    hasChanges,
    getSimulatedOutline,
    hasSimulatedOutline,
  };
}
