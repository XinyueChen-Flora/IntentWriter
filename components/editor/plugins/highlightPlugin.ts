import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { SentenceHighlights, PendingWritingSuggestion } from "../types";
import type { AlignedIntent } from "@/hooks/useDriftDetection";
import { findTextRangeInDoc } from "../utils/textRangeFinder";
import { createSimulatedWritingWidget, createIssueIndicatorDot, createInlineSimulatedWidget, createMissingIntentWidget, createAiBadgeWidget } from "../widgets";

// Stable plugin key - must be defined outside the function
export const highlightPluginKey = new PluginKey("highlight");

type HighlightFilter = 'aligned' | 'partial' | 'missing' | 'orphan' | null;

type HighlightPluginOptions = {
  sentenceHighlights: SentenceHighlights | undefined;
  alignedIntents: AlignedIntent[] | undefined;  // For inline indicators
  highlightFilter: HighlightFilter | undefined;  // Filter by status type
  hoveredIntentForLink: string | null | undefined;
  hoveredOrphanHint: string | null | undefined;  // For orphan three-way linking (sentence start)
  localHoveredIntent: string | null;
  pendingWritingSuggestion: PendingWritingSuggestion;
  onAcceptWritingSuggestion: () => void;
  onCancelWritingSuggestion: () => void;
  onHoverSimulatedIntent?: (intentId: string | null) => void;  // For three-way linking
  onSimulateMissing?: (intentId: string) => void;  // For simulate button in missing filter
  expandedMissingIntentId?: string | null;  // Which missing intent dot is expanded
  loadingIntentId?: string | null;  // Which intent is currently loading (simulating)
  currentIntentId: string;
  aiCoveredIntents?: Set<string>;  // Intents covered by AI (should not show missing indicator)
};

/**
 * Create highlight decoration plugin for the TipTap editor.
 * Handles:
 * - Orphan sentence indicators
 * - Missing/partial intent indicators
 * - Hover highlights when linking intents
 * - Simulated writing widget
 */
export function createHighlightPlugin(options: HighlightPluginOptions) {
  const {
    sentenceHighlights,
    alignedIntents,
    highlightFilter,
    hoveredIntentForLink,
    hoveredOrphanHint,
    localHoveredIntent,
    pendingWritingSuggestion,
    onAcceptWritingSuggestion,
    onCancelWritingSuggestion,
    onHoverSimulatedIntent,
    onSimulateMissing,
    expandedMissingIntentId,
    loadingIntentId,
    currentIntentId,
    aiCoveredIntents,
  } = options;

  return new Plugin({
    key: highlightPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        const doc = state.doc;

        // Handle pending writing suggestion - show widget at appropriate position
        // Only show in the editor that matches the rootIntentId
        // Skip if this is for a missing intent - inline handler will show it after the indicator
        const isMissingIntentSuggestion = pendingWritingSuggestion && alignedIntents?.some(
          i => i.id === pendingWritingSuggestion.intentId &&
               i.intentStatus === 'existing' &&
               i.coverageStatus === 'missing'
        );
        if (pendingWritingSuggestion && pendingWritingSuggestion.rootIntentId === currentIntentId && !isMissingIntentSuggestion) {
          const simulation = pendingWritingSuggestion.simulation;
          let insertPos: number | null = null;

          if (simulation?.position === 'start') {
            // Insert at start (after first node)
            insertPos = 1;
          } else if (simulation?.position === 'after' && simulation.insertAfter) {
            // Find the sentence containing insertAfter text and position after it
            const searchText = simulation.insertAfter.toLowerCase();
            const range = findTextRangeInDoc(doc, { start: searchText, end: '' });
            if (range) {
              // Insert directly after the sentence/text
              insertPos = range.to;
            } else {
              // Fallback: search in text blocks
              doc.descendants((node: any, pos: number) => {
                if (node.isText && insertPos === null) {
                  const text = (node.text || '').toLowerCase();
                  const idx = text.indexOf(searchText.slice(0, 20));
                  if (idx !== -1) {
                    // Position after this text match
                    insertPos = pos + idx + searchText.length;
                  }
                }
                return insertPos === null;
              });
            }
          }

          // Default to end if no position found
          if (insertPos === null) {
            insertPos = doc.content.size - 1;
          }

          // Clamp position to valid range
          insertPos = Math.min(Math.max(1, insertPos), doc.content.size - 1);

          decorations.push(
            Decoration.widget(insertPos, () => createSimulatedWritingWidget(
              pendingWritingSuggestion.suggestedContent,
              pendingWritingSuggestion.intentContent,
              onAcceptWritingSuggestion,
              onCancelWritingSuggestion
            ), {
              side: 1,
            })
          );
        }

        if (!sentenceHighlights) {
          return DecorationSet.create(doc, decorations);
        }

        // Aligned/Supporting sentences - different colors for root vs child intents
        // Only show if no filter or filter is 'aligned'
        if (!highlightFilter || highlightFilter === 'aligned') {
          sentenceHighlights.supporting.forEach(({ anchor, intentIds }) => {
          const range = findTextRangeInDoc(doc, anchor);
          if (range) {
            // Check if this sentence only belongs to root intent (lighter) or child intents (normal green)
            const isRootOnly = intentIds.length === 1 && intentIds[0] === currentIntentId;
            const hasChildIntent = intentIds.some(id => id !== currentIntentId);
            // Check if any of the intents are AI-covered
            const isAiGenerated = intentIds.some(id => aiCoveredIntents?.has(id));

            // Root-only sentences: very subtle gray tint
            // Child intent sentences: normal green (subtle)
            const bgClass = hasChildIntent
              ? "bg-emerald-50/50 dark:bg-emerald-900/30 rounded-sm transition-colors"
              : "bg-gray-50/50 dark:bg-gray-800/40 rounded-sm transition-colors";

            decorations.push(
              Decoration.inline(range.from, range.to, {
                class: bgClass,
              })
            );

            // Add AI badge at the end of AI-generated sentences
            if (isAiGenerated) {
              decorations.push(
                Decoration.widget(range.to, () => createAiBadgeWidget(), {
                  side: 1,
                })
              );
            }

            // Hover underline if this intent is being hovered
            if (hoveredIntentForLink && intentIds.includes(hoveredIntentForLink)) {
              const underlineClass = hasChildIntent
                ? "underline decoration-emerald-600 decoration-2 underline-offset-2 transition-colors"
                : "underline decoration-gray-500 decoration-1 underline-offset-2 transition-colors";
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: underlineClass,
                })
              );
            }

            // Local hover from writing side
            if (localHoveredIntent && !hoveredIntentForLink && intentIds.includes(localHoveredIntent)) {
              const localUnderlineClass = hasChildIntent
                ? "underline decoration-emerald-500 decoration-1 underline-offset-2 transition-colors"
                : "underline decoration-gray-400 decoration-1 underline-offset-2 transition-colors";
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: localUnderlineClass,
                })
              );
            }
          }
          });
        }

        // Partial sentences - subtle amber background
        // Only show if no filter or filter is 'partial'
        if (!highlightFilter || highlightFilter === 'partial') {
          sentenceHighlights.partial.forEach(({ anchor, intentIds }) => {
          const range = findTextRangeInDoc(doc, anchor);
          if (range) {
            decorations.push(
              Decoration.inline(range.from, range.to, {
                class: "bg-amber-50/50 dark:bg-amber-900/30 rounded-sm transition-colors",
              })
            );

            // Hover underline
            if (hoveredIntentForLink && intentIds.includes(hoveredIntentForLink)) {
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: "underline decoration-amber-600 decoration-2 underline-offset-2 transition-colors",
                })
              );
            }

            if (localHoveredIntent && !hoveredIntentForLink && intentIds.includes(localHoveredIntent)) {
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: "underline decoration-amber-500 decoration-1 underline-offset-2 transition-colors",
                })
              );
            }
          }
          });
        }

        // New intents (orphan sentences) - blue background + ONE indicator per new intent
        // Only show if no filter or filter is 'orphan'
        if ((!highlightFilter || highlightFilter === 'orphan') && alignedIntents && alignedIntents.length > 0) {
          // Get all new intents (these represent orphan content that should become new intents)
          const newIntents = alignedIntents.filter(i => i.intentStatus === 'new');

          let orphanIndex = 0;
          for (const newIntent of newIntents) {
            if (!newIntent.sentences || newIntent.sentences.length === 0) continue;

            orphanIndex++;

            // Check if this new intent is being hovered
            const isHovered = !!(hoveredOrphanHint && newIntent.sentences.some(
              s => s.start.toLowerCase().startsWith(hoveredOrphanHint.toLowerCase())
            ));

            // Highlight ALL sentences belonging to this new intent
            let lastSentenceRange: { from: number; to: number } | null = null;

            for (const sentence of newIntent.sentences) {
              const range = findTextRangeInDoc(doc, { start: sentence.start, end: sentence.end });
              if (range) {
                // Blue background + underline
                const baseClass = isHovered
                  ? "bg-blue-50/70 dark:bg-blue-800/50 underline decoration-blue-600 decoration-2 underline-offset-2 rounded-sm transition-colors ring-2 ring-blue-500"
                  : "bg-blue-50/40 dark:bg-blue-900/30 underline decoration-blue-500 decoration-2 underline-offset-2 rounded-sm transition-colors";

                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: baseClass,
                  })
                );

                // Track the last sentence range
                if (!lastSentenceRange || range.to > lastSentenceRange.to) {
                  lastSentenceRange = range;
                }
              }
            }

            // Add ONE indicator at the end of the LAST sentence for this new intent
            if (lastSentenceRange) {
              const currentOrphanIndex = orphanIndex;
              decorations.push(
                Decoration.widget(lastSentenceRange.to, () => createIssueIndicatorDot(currentOrphanIndex, 'orphan', {
                  'suggested-intent': newIntent.content || '',
                  'new-intent-id': newIntent.id,
                }, isHovered), {
                  side: 1,
                })
              );
            }
          }
        }

        // Missing intents - show indicator at the appropriate position
        // Only show if no filter or filter is 'missing'
        if ((!highlightFilter || highlightFilter === 'missing') && alignedIntents && alignedIntents.length > 0) {
          // Sort by position (outline order)
          const sortedIntents = [...alignedIntents].sort((a, b) => a.position - b.position);

          // Pre-compute sentence positions for all intents that have sentences
          // This helps us position missing intents based on their outline position
          const sentencePositions: Array<{ intentPosition: number; docPos: number; isStart: boolean }> = [];
          sortedIntents.forEach(intent => {
            if (intent.sentences && intent.sentences.length > 0) {
              // Find first sentence position
              const firstRange = findTextRangeInDoc(doc, intent.sentences[0]);
              if (firstRange) {
                sentencePositions.push({ intentPosition: intent.position, docPos: firstRange.from, isStart: true });
              }
              // Find last sentence position
              const lastRange = findTextRangeInDoc(doc, intent.sentences[intent.sentences.length - 1]);
              if (lastRange) {
                sentencePositions.push({ intentPosition: intent.position, docPos: lastRange.to, isStart: false });
              }
            }
          });
          // Sort by document position
          sentencePositions.sort((a, b) => a.docPos - b.docPos);

          let missingIndex = 0;
          for (let i = 0; i < sortedIntents.length; i++) {
            const intent = sortedIntents[i];

            // Only process missing intents (existing intents with no sentences)
            // Skip AI-covered intents - they should show as aligned, not missing
            if (intent.intentStatus !== 'existing' || intent.coverageStatus !== 'missing') {
              continue;
            }
            if (aiCoveredIntents?.has(intent.id)) {
              continue;
            }

            missingIndex++;

            let insertPos: number | null = null;

            // Simple logic based on position:
            // 1. Find the closest covered intent BEFORE this one (by position) → insert AFTER its last sentence
            // 2. If none, find the closest covered intent AFTER this one → insert BEFORE its first sentence
            // 3. If none, insert at document start

            // Look backward for the closest covered intent
            for (let j = i - 1; j >= 0; j--) {
              const prev = sortedIntents[j];
              if (prev.sentences && prev.sentences.length > 0) {
                const lastSentence = prev.sentences[prev.sentences.length - 1];
                const range = findTextRangeInDoc(doc, lastSentence);
                if (range) {
                  insertPos = range.to;
                  break;
                }
              }
            }

            // If no previous covered intent, look forward for the next one
            if (insertPos === null) {
              for (let j = i + 1; j < sortedIntents.length; j++) {
                const next = sortedIntents[j];
                if (next.sentences && next.sentences.length > 0) {
                  const firstSentence = next.sentences[0];
                  const range = findTextRangeInDoc(doc, firstSentence);
                  if (range) {
                    // Insert BEFORE the next covered intent's first sentence
                    insertPos = range.from;
                    break;
                  }
                }
              }
            }

            // Fallback: document start
            if (insertPos === null) {
              insertPos = 1;
            }

            // Clamp to valid range
            insertPos = Math.min(Math.max(1, insertPos), doc.content.size - 1);

            // Check if there's a pending writing suggestion for this intent
            const hasPendingSuggestion = pendingWritingSuggestion &&
              pendingWritingSuggestion.intentId === intent.id &&
              pendingWritingSuggestion.rootIntentId === currentIntentId;

            // Check if this missing intent is being hovered from summary panel
            const isMissingHovered = hoveredIntentForLink === intent.id;

            // If there's a pending suggestion, ONLY show the simulated widget (not the missing indicator)
            if (hasPendingSuggestion) {
              decorations.push(
                Decoration.widget(insertPos, () => createInlineSimulatedWidget(
                  pendingWritingSuggestion.suggestedContent,
                  pendingWritingSuggestion.intentContent,
                  pendingWritingSuggestion.intentId,
                  onAcceptWritingSuggestion,
                  onCancelWritingSuggestion,
                  onHoverSimulatedIntent
                ), {
                  side: 1,
                })
              );
            } else {
              // No pending suggestion - show missing indicator
              // Show expanded widget if: filter mode OR this specific intent is expanded
              const isExpanded = highlightFilter === 'missing' || expandedMissingIntentId === intent.id;
              const isThisLoading = loadingIntentId === intent.id;

              if (isExpanded) {
                // Show expanded widget with intent content and simulate button
                const currentMissingIndexForWidget = missingIndex;
                decorations.push(
                  Decoration.widget(insertPos, () => createMissingIntentWidget(
                    intent.id,
                    intent.content,
                    onSimulateMissing,
                    isMissingHovered,
                    isThisLoading,
                    currentMissingIndexForWidget
                  ), {
                    side: 1,
                  })
                );
              } else {
                // Non-filter mode: show compact dot indicator with index
                const currentMissingIndex = missingIndex;
                decorations.push(
                  Decoration.widget(insertPos, () => createIssueIndicatorDot(currentMissingIndex, 'missing', {
                    'intent-id': intent.id,
                    'intent-content': intent.content.slice(0, 60),
                  }, isMissingHovered), {
                    side: 1,
                  })
                );
              }
            }
          }
        }

        // Partial intents - show half-circle indicator at the end of their last sentence
        // Only show if no filter or filter is 'partial'
        if ((!highlightFilter || highlightFilter === 'partial') && alignedIntents && alignedIntents.length > 0) {
          let partialIndex = 0;
          for (const intent of alignedIntents) {
            // Only process partial intents
            if (intent.intentStatus !== 'existing' || intent.coverageStatus !== 'partial') {
              continue;
            }

            partialIndex++;

            // Find the last sentence position
            if (intent.sentences && intent.sentences.length > 0) {
              const lastSentence = intent.sentences[intent.sentences.length - 1];
              const range = findTextRangeInDoc(doc, lastSentence);
              if (range) {
                const isPartialHovered = hoveredIntentForLink === intent.id;
                const currentPartialIndex = partialIndex;

                // Add partial indicator at the end of the last sentence
                decorations.push(
                  Decoration.widget(range.to, () => createIssueIndicatorDot(currentPartialIndex, 'partial', {
                    'intent-id': intent.id,
                    'intent-content': intent.content.slice(0, 60),
                    'coverage-note': intent.coverageNote || '',
                  }, isPartialHovered), {
                    side: 1,
                  })
                );
              }
            }
          }
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}
