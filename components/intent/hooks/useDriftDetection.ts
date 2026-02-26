"use client";

import { useState, useCallback, useMemo } from "react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";

// Sentence anchor for precise text matching
export type SentenceAnchor = {
  start: string;  // first ~10 words
  end: string;    // last ~10 words
};

// Types matching API response
export type IntentCoverageItem = {
  intentId: string;
  status: 'covered' | 'partial' | 'missing';
  supportingSentences: SentenceAnchor[];
  note?: string;
};

export type OrphanSentence = {
  start: string;  // first ~10 words
  end: string;    // last ~10 words
  suggestion: 'delete' | 'add-intent';
  suggestedIntent?: string;
};

export type DependencyIssue = {
  relationship: string;
  severity: 'warning' | 'conflict';
  issue: string;
  localSentences: SentenceAnchor[];
  remoteSectionId: string;
  remoteSectionIntent: string;
  remoteSentences: SentenceAnchor[];
};

// Simulated outline types
export type SimulatedIntent = {
  id: string;
  content: string;
  parentId: string | null;
  position: number;
  status: 'existing' | 'new' | 'modified' | 'removed';
  originalContent?: string;
  sourceOrphanStart?: string;
};

export type CrossSectionImpact = {
  sectionId: string;
  sectionIntent: string;
  impactType: 'needs-update' | 'potential-conflict';
  description: string;
};

export type SimulatedOutline = {
  intents: SimulatedIntent[];
  crossSectionImpacts: CrossSectionImpact[];
  summary: string;
};

export type DriftStatus = {
  intentId: string;
  level: 'aligned' | 'partial' | 'drifted';
  intentCoverage: IntentCoverageItem[];
  orphanSentences: OrphanSentence[];
  dependencyIssues: DependencyIssue[];
  summary: string;
  checkedAt: number;
  // Simulated outline based on writing
  simulatedOutline?: SimulatedOutline;
};

export type UseDriftDetectionProps = {
  blocks: readonly IntentBlock[];
  dependencies?: IntentDependency[];
  markdownExporters: Map<string, () => Promise<string>>;
  intentToWritingMap: Map<string, { id: string }>;
};

// Supporting sentence with intent mapping
export type SupportingSentence = {
  anchor: SentenceAnchor;
  intentIds: string[];
};

export type UseDriftDetectionResult = {
  driftMap: Map<string, DriftStatus>;
  checkingIds: Set<string>;
  isChecking: boolean;
  triggerCheck: (sectionId?: string) => Promise<void>;
  getDriftStatus: (rootIntentId: string) => DriftStatus | undefined;
  // For writing side highlighting
  getSentenceHighlights: (rootIntentId: string) => {
    supporting: SupportingSentence[];  // green - fully covered
    partial: SupportingSentence[];     // orange - partially covered
    orphan: OrphanSentence[];          // yellow - not in outline
    conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
  };
  // For dependency line coloring
  getConflictForDependency: (fromSectionId: string, toSectionId: string) => DependencyIssue | undefined;
  // For simulated outline
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

      // Build child intents
      const childIntents = getDescendants(rootIntentId).map(c => ({
        id: c.id,
        content: c.content,
      }));

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
        const status: DriftStatus = {
          ...data.result,
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

  // Get sentence highlights for writing side
  // IMPORTANT: Derives orphans from simulatedOutline to ensure consistency with Outline Diff
  const getSentenceHighlights = useCallback((rootIntentId: string) => {
    const status = driftMap.get(rootIntentId);

    const supporting: SupportingSentence[] = [];  // green - fully covered
    const partial: SupportingSentence[] = [];     // orange - partially covered
    const orphan: OrphanSentence[] = [];          // yellow - not in outline (derived from simulatedOutline)
    const conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }> = [];

    if (!status) {
      return { supporting, partial, orphan, conflict };
    }

    // Build supporting sentences with intent mapping, separated by coverage status
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

    // DERIVE orphans from simulatedOutline to ensure consistency with Outline Diff
    // Each "new" intent in simulatedOutline should have a corresponding orphan
    if (status.simulatedOutline) {
      const newIntents = status.simulatedOutline.intents.filter(i => i.status === 'new');

      newIntents.forEach(newIntent => {
        // Find matching orphan from API response using sourceOrphanStart
        const matchingOrphan = status.orphanSentences.find(
          o => o.start === newIntent.sourceOrphanStart
        );

        if (matchingOrphan) {
          // Use the API-provided orphan (has correct start/end anchors)
          orphan.push(matchingOrphan);
        } else if (newIntent.sourceOrphanStart) {
          // Fallback: create orphan from the new intent's sourceOrphanStart
          orphan.push({
            start: newIntent.sourceOrphanStart,
            end: '',
            suggestion: 'add-intent',
            suggestedIntent: newIntent.content,
          });
        }
      });
    } else {
      // No simulatedOutline, use orphanSentences directly
      orphan.push(...status.orphanSentences);
    }

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
    // Check both directions since the dependency might be stored either way
    const fromStatus = driftMap.get(fromSectionId);
    const toStatus = driftMap.get(toSectionId);

    // Check if fromSection has a conflict with toSection
    if (fromStatus) {
      const issue = fromStatus.dependencyIssues.find(i => i.remoteSectionId === toSectionId);
      if (issue) return issue;
    }

    // Check if toSection has a conflict with fromSection
    if (toStatus) {
      const issue = toStatus.dependencyIssues.find(i => i.remoteSectionId === fromSectionId);
      if (issue) return issue;
    }

    return undefined;
  }, [driftMap]);

  // Get simulated outline for a section
  const getSimulatedOutline = useCallback((rootIntentId: string): SimulatedOutline | undefined => {
    const status = driftMap.get(rootIntentId);
    return status?.simulatedOutline;
  }, [driftMap]);

  // Check if a section has a simulated outline (with changes)
  const hasSimulatedOutline = useCallback((rootIntentId: string): boolean => {
    const outline = getSimulatedOutline(rootIntentId);
    if (!outline) return false;
    // Only show if there are actual changes (new, modified, or removed intents)
    return outline.intents.some(i => i.status !== 'existing');
  }, [getSimulatedOutline]);

  const isChecking = checkingIds.size > 0;

  return {
    driftMap,
    checkingIds,
    isChecking,
    triggerCheck,
    getDriftStatus,
    getSentenceHighlights,
    getConflictForDependency,
    getSimulatedOutline,
    hasSimulatedOutline,
  };
}
