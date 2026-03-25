// ─── Primitive to TipTap Bridge ───
//
// Converts writing-editor primitives from the pipeline into the format
// that TipTap's highlight plugin expects. This is the bridge between
// the protocol-driven pipeline and the editor's internal rendering.
//
// Pipeline produces: ResolvedPrimitive[] with location='writing-editor'
//   - sentence-highlight: { startAnchor, color, tooltip }
//   - issue-dot: { anchor, type, index, detail }
//   - inline-widget: { content, variant, intentRef }
//   - ai-marker: { startAnchor }
//
// TipTap expects:
//   - sentenceHighlights: { supporting, partial, orphan, conflict }
//   - alignedIntents: AlignedIntent[] (for hover linking)
//   - intentCoverageMap: Map<intentId, status>

import type { ResolvedPrimitive } from "@/platform/primitives/resolver";

// ─── Types that TipTap expects ───

export type SentenceAnchor = {
  start: string;
  end: string;
};

export type SupportingSentence = {
  anchor: SentenceAnchor;
  intentIds: string[];
};

export type OrphanSentence = {
  start: string;
  end: string;
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

export type AlignedIntent = {
  id: string;
  content: string;
  parentId: string | null;
  position: number;
  intentStatus: 'existing' | 'new' | 'modified' | 'removed';
  coverageStatus: 'covered' | 'partial' | 'missing';
  sentences: SentenceAnchor[];
  suggestedWriting?: string;
  coverageNote?: string;
  insertAfter?: SentenceAnchor;
};

export type TipTapHighlights = {
  supporting: SupportingSentence[];
  partial: SupportingSentence[];
  orphan: OrphanSentence[];
  conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
};

// ─── Converter: Pipeline primitives → TipTap format ───

/**
 * Convert writing-editor primitives to TipTap's sentence highlight format.
 * Reads the sourceItem from each primitive (which contains the original data
 * from function output) to reconstruct the highlight structure.
 */
export function primitivesToTipTapHighlights(
  primitives: ResolvedPrimitive[]
): TipTapHighlights {
  const supporting: SupportingSentence[] = [];
  const partial: SupportingSentence[] = [];
  const orphan: OrphanSentence[] = [];
  const conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }> = [];

  for (const prim of primitives) {
    if (prim.type === 'sentence-highlight') {
      const color = prim.params.color;
      const sourceItem = prim.sourceItem as Record<string, unknown> | undefined;

      if (sourceItem) {
        const sentences = sourceItem.sentences as SentenceAnchor[] | undefined;
        const intentId = sourceItem.id as string | undefined;
        const coverageStatus = sourceItem.coverageStatus as string | undefined;
        const intentStatus = sourceItem.intentStatus as string | undefined;

        if (sentences && intentId) {
          for (const anchor of sentences) {
            if (coverageStatus === 'covered' || (color === 'green')) {
              const existing = supporting.find(s =>
                s.anchor.start === anchor.start && s.anchor.end === anchor.end
              );
              if (existing) {
                existing.intentIds.push(intentId);
              } else {
                supporting.push({ anchor, intentIds: [intentId] });
              }
            } else if (coverageStatus === 'partial' || color === 'yellow') {
              const existing = partial.find(s =>
                s.anchor.start === anchor.start && s.anchor.end === anchor.end
              );
              if (existing) {
                existing.intentIds.push(intentId);
              } else {
                partial.push({ anchor, intentIds: [intentId] });
              }
            }
          }
        }
      }
    } else if (prim.type === 'issue-dot') {
      const issueType = prim.params.type;
      if (issueType === 'orphan') {
        const sourceItem = prim.sourceItem as Record<string, unknown> | undefined;
        if (sourceItem) {
          const sentences = sourceItem.sentences as SentenceAnchor[] | undefined;
          const content = sourceItem.content as string | undefined;
          if (sentences?.length) {
            orphan.push({
              start: sentences[0].start,
              end: sentences[0].end,
              suggestion: 'add-intent',
              suggestedIntent: content,
            });
          }
        }
      }
    }
  }

  return { supporting, partial, orphan, conflict };
}

/**
 * Extract AlignedIntent[] from check-drift function result stored in primitives.
 * The sourceItem on node-icon primitives contains the original aligned intent data.
 */
export function primitivesToAlignedIntents(
  outlinePrimitives: ResolvedPrimitive[]
): AlignedIntent[] {
  const intents: AlignedIntent[] = [];
  const seen = new Set<string>();

  for (const prim of outlinePrimitives) {
    if (prim.type === 'node-icon' && prim.sourceItem) {
      const item = prim.sourceItem as Record<string, unknown>;
      const id = item.id as string;
      if (id && !seen.has(id)) {
        seen.add(id);
        intents.push({
          id,
          content: (item.content as string) ?? '',
          parentId: (item.parentId as string | null) ?? null,
          position: (item.position as number) ?? 0,
          intentStatus: (item.intentStatus as AlignedIntent['intentStatus']) ?? 'existing',
          coverageStatus: (item.coverageStatus as AlignedIntent['coverageStatus']) ?? 'covered',
          sentences: (item.sentences as SentenceAnchor[]) ?? [],
          suggestedWriting: item.suggestedWriting as string | undefined,
          coverageNote: item.coverageNote as string | undefined,
        });
      }
    }
  }

  return intents;
}

/**
 * Build intent coverage map from outline-node primitives.
 */
export function primitivesToCoverageMap(
  outlinePrimitives: ResolvedPrimitive[]
): Map<string, 'covered' | 'partial' | 'missing'> {
  const map = new Map<string, 'covered' | 'partial' | 'missing'>();

  for (const prim of outlinePrimitives) {
    if (prim.type === 'node-icon' && prim.params.nodeId && prim.params.status) {
      const status = prim.params.status as 'covered' | 'partial' | 'missing';
      if (status === 'covered' || status === 'partial' || status === 'missing') {
        map.set(prim.params.nodeId, status);
      }
    }
  }

  return map;
}
