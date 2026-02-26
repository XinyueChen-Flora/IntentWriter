"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { WritingBlock, IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import { Sparkles, AlertTriangle } from "lucide-react";
import type { OrphanSentence, DependencyIssue, SentenceAnchor, SupportingSentence } from "@/components/intent/hooks/useDriftDetection";

// TipTap imports
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Yjs imports
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";

// Types
type SentenceHighlights = {
  supporting: SupportingSentence[];  // green - fully covered
  partial: SupportingSentence[];     // orange - partially covered
  orphan: OrphanSentence[];          // yellow - not in outline
  conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
};

type HighlightRange = {
  from: number;
  to: number;
  type: 'supporting' | 'orphan' | 'conflict' | 'partial';
  intentIds?: string[];
  orphanData?: OrphanSentence;
};

// Stable plugin key - must be defined outside the function
const highlightPluginKey = new PluginKey("highlight");

type TipTapEditorProps = {
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  onParagraphEnd?: (writingBlockId: string, contentHash: string) => void;
  onCheckAlignment?: () => void;
  isCheckingAlignment?: boolean;
  sentenceHighlights?: SentenceHighlights;
  hoveredIntentForLink?: string | null;
  hoveredOrphanHint?: string | null;
  // Called when user wants to make change to outline - triggers impact preview
  onMakeChangeToOutline?: (suggestedIntent: string, orphanStart: string) => void;
  // Called when user wants to keep writing as is (dismiss the suggestion)
  onDismissOrphan?: (orphanStart: string) => void;
  // Callback when hovering over text that maps to an intent
  onHoverIntentFromWriting?: (intentId: string | null) => void;
  // Orphans that have been handled (added to outline or dismissed) - should not show widget
  handledOrphanStarts?: Set<string>;
  // Mark an orphan as handled
  markOrphanHandled?: (orphanStart: string) => void;
  // Coverage status for each intent (to determine highlight color)
  intentCoverageMap?: Map<string, 'covered' | 'partial' | 'missing'>;
  // Ordered intent coverage - for inline missing intent display
  orderedIntentCoverage?: Array<{
    intentId: string;
    intentContent: string;
    position: number;
    status: 'covered' | 'partial' | 'missing';
    supportingSentences: Array<{ start: string; end: string }>;
    note?: string;
  }>;
  // Callback when user wants to add content for a missing intent
  onAddMissingContent?: (intentId: string, intentContent: string) => void;
  // Callback when user wants to modify the intent instead
  onModifyIntent?: (intentId: string) => void;
  // Pending writing suggestion (from "Update Writing" button on intent side)
  pendingWritingSuggestion?: {
    intentId: string;
    rootIntentId: string;
    intentContent: string;
    suggestedContent: string;
    simulation?: {
      insertAfter?: string;
      insertBefore?: string;
      replaceStart?: string;
      content: string;
      position: 'start' | 'end' | 'after' | 'before' | 'replace';
    };
  } | null;
  onClearWritingSuggestion?: () => void;
};

// Helper to find text range from anchor - properly handles ProseMirror document positions
function findTextRangeInDoc(doc: any, anchor: SentenceAnchor): { from: number; to: number } | null {
  const startLower = anchor.start.toLowerCase();
  const endLower = anchor.end?.toLowerCase() || '';

  let foundFrom: number | null = null;
  let foundTo: number | null = null;

  // Walk through the document to find text positions
  doc.descendants((node: any, pos: number) => {
    if (node.isText && foundFrom === null) {
      const text = node.text || '';
      const textLower = text.toLowerCase();
      const startIdx = textLower.indexOf(startLower);

      if (startIdx !== -1) {
        // Found the start - pos is the position before this text node
        foundFrom = pos + startIdx;

        // Find the end
        if (endLower) {
          const endIdx = textLower.indexOf(endLower, startIdx);
          if (endIdx !== -1) {
            foundTo = pos + endIdx + anchor.end!.length;
          } else {
            // End not in same text node - search in subsequent text
            foundTo = pos + startIdx + anchor.start.length;
          }
        } else {
          foundTo = pos + startIdx + anchor.start.length;
        }
      }
    }
    return foundFrom === null; // Stop searching once found
  });

  // If end wasn't found in the same node, search for it in the full document
  if (foundFrom !== null && foundTo !== null && endLower) {
    let searchPos = foundFrom;
    let textSoFar = '';

    doc.nodesBetween(foundFrom, doc.content.size, (node: any, pos: number) => {
      if (node.isText) {
        const text = node.text || '';
        const combinedText = textSoFar + text;
        const combinedLower = combinedText.toLowerCase();

        // Look for the end anchor in the accumulated text
        const endIdx = combinedLower.indexOf(endLower);
        if (endIdx !== -1) {
          // Calculate the actual document position
          const offsetInCombined = endIdx + anchor.end!.length;
          if (offsetInCombined <= textSoFar.length) {
            // End is in previous text - already handled
          } else {
            const offsetInCurrentNode = offsetInCombined - textSoFar.length;
            foundTo = pos + offsetInCurrentNode;
          }
          return false; // Stop searching
        }
        textSoFar = combinedText;
      }
      return true;
    });
  }

  if (foundFrom !== null && foundTo !== null) {
    return { from: foundFrom, to: foundTo };
  }

  return null;
}

// Simple fallback for when we don't have doc access
function findTextRange(fullText: string, anchor: SentenceAnchor): { from: number; to: number } | null {
  const startLower = anchor.start.toLowerCase();
  const textLower = fullText.toLowerCase();
  const startIdx = textLower.indexOf(startLower);
  if (startIdx === -1) return null;

  let endIdx = startIdx + anchor.start.length;
  if (anchor.end) {
    const endLower = anchor.end.toLowerCase();
    const endSearch = textLower.indexOf(endLower, startIdx);
    if (endSearch !== -1) {
      endIdx = endSearch + anchor.end.length;
    }
  }

  // Convert text offset to document position (add 1 for paragraph start)
  return { from: startIdx + 1, to: endIdx + 1 };
}

// Create inline widget for missing intent - lightweight style similar to orphan widget
function createMissingIntentWidget(
  intentId: string,
  intentContent: string,
  status: 'partial' | 'missing',
  note?: string,
  onAddContent?: (intentId: string, intentContent: string) => void
) {
  const widget = document.createElement('span');
  widget.className = 'missing-intent-widget inline-flex items-center gap-1.5 ml-1 align-baseline text-[10px]';
  widget.contentEditable = 'false';

  const statusLabel = status === 'missing' ? 'Missing' : 'Partial';

  // Truncate long content
  const truncatedContent = intentContent.length > 40
    ? intentContent.slice(0, 40) + '...'
    : intentContent;

  const contentEscaped = truncatedContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Use complete class names for Tailwind JIT compatibility
  const labelClasses = status === 'missing'
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  const contentClasses = status === 'missing'
    ? 'text-red-700 dark:text-red-300'
    : 'text-amber-700 dark:text-amber-300';

  widget.innerHTML = `
    <span class="${labelClasses} font-medium">${statusLabel}:</span>
    <span class="${contentClasses} italic">${contentEscaped}</span>
    <span class="inline-flex items-center gap-1 ml-0.5">
      <button
        class="add-content-btn text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors whitespace-nowrap"
        data-intent-id="${intentId}"
        data-intent-content="${contentEscaped}"
      >Change Writing</button>
      <span class="text-muted-foreground">·</span>
      <button
        class="modify-intent-btn text-[9px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        data-intent-id="${intentId}"
      >Modify Intention</button>
    </span>
  `;

  return widget;
}

// Create inline widget for orphan content - lightweight style
function createOrphanWidget(orphan: OrphanSentence) {
  const widget = document.createElement('span');
  widget.className = 'orphan-widget inline-flex items-center gap-1.5 ml-1 align-baseline text-[10px]';
  widget.contentEditable = 'false';

  const intentText = orphan.suggestedIntent || 'Unmatched content';

  // Escape HTML for safe display
  const intentEscaped = intentText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  widget.innerHTML = `
    <span class="text-amber-600 dark:text-amber-400 font-medium">New Intent?</span>
    <span class="text-amber-700 dark:text-amber-300 italic">${intentEscaped}</span>
    <span class="inline-flex items-center gap-1 ml-0.5">
      <button
        class="make-change-btn text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors whitespace-nowrap"
        data-suggested-intent="${intentEscaped}"
        data-orphan-start="${orphan.start.replace(/"/g, '&quot;')}"
      >Add to Outline</button>
      <span class="text-muted-foreground">·</span>
      <button
        class="add-writing-btn text-[9px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        data-orphan-start="${orphan.start.replace(/"/g, '&quot;')}"
      >Modify Writing</button>
    </span>
  `;

  return widget;
}

// Create simulated writing widget
function createSimulatedWritingWidget(
  content: string,
  intentContent: string,
  onAccept: () => void,
  onCancel: () => void
) {
  const widget = document.createElement('div');
  widget.className = 'simulated-writing-widget my-3 mx-0';
  widget.contentEditable = 'false';

  const contentEscaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const intentEscaped = intentContent.slice(0, 40)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  widget.innerHTML = `
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        Simulated
      </span>
      <span class="text-[10px] text-muted-foreground italic">
        For: "${intentEscaped}${intentContent.length > 40 ? '...' : ''}"
      </span>
    </div>
    <div class="relative rounded-lg border-2 border-dashed border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
      <div class="text-sm leading-relaxed">${contentEscaped}</div>
    </div>
    <div class="flex justify-end gap-2 mt-2">
      <button class="simulated-cancel-btn px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Cancel
      </button>
      <button class="simulated-accept-btn px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors">
        Accept
      </button>
    </div>
  `;

  // Add event listeners
  const acceptBtn = widget.querySelector('.simulated-accept-btn');
  const cancelBtn = widget.querySelector('.simulated-cancel-btn');
  acceptBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAccept();
  });
  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  });

  return widget;
}

// Type for pending writing suggestion
type PendingWritingSuggestionType = {
  intentId: string;
  rootIntentId: string;
  intentContent: string;
  suggestedContent: string;
  simulation?: {
    insertAfter?: string;
    position: 'start' | 'end' | 'after' | 'before' | 'replace';
  };
} | null;

// Type for ordered intent coverage
type OrderedIntentCoverageItem = {
  intentId: string;
  intentContent: string;
  position: number;
  status: 'covered' | 'partial' | 'missing';
  supportingSentences: Array<{ start: string; end: string }>;
  note?: string;
};

// Create highlight decoration plugin
function createHighlightPlugin(
  sentenceHighlights: SentenceHighlights | undefined,
  hoveredIntentForLink: string | null | undefined,
  hoveredOrphanHint: string | null | undefined,
  localHoveredIntent: string | null,
  modifyingOrphanStart: string | null,
  handledOrphanStarts: Set<string> | undefined,
  intentCoverageMap: Map<string, 'covered' | 'partial' | 'missing'> | undefined,
  pendingWritingSuggestion: PendingWritingSuggestionType,
  onAcceptWritingSuggestion: () => void,
  onCancelWritingSuggestion: () => void,
  currentIntentId: string, // The intent this editor belongs to
  orderedIntentCoverage: OrderedIntentCoverageItem[] | undefined,
  onAddMissingContent: ((intentId: string, intentContent: string) => void) | undefined
) {
  return new Plugin({
    key: highlightPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        const doc = state.doc;

        // Handle pending writing suggestion - show widget at appropriate position
        // Only show in the editor that matches the rootIntentId
        if (pendingWritingSuggestion && pendingWritingSuggestion.rootIntentId === currentIntentId) {
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
              doc.descendants((node, pos) => {
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

        // Handle missing/partial intent widgets - show inline at correct position
        if (orderedIntentCoverage && orderedIntentCoverage.length > 0) {
          // Sort by position to process in order
          const sorted = [...orderedIntentCoverage].sort((a, b) => a.position - b.position);

          // For each missing/partial intent, calculate insertion position
          for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i];

            // Only process missing and partial intents
            if (current.status === 'covered') continue;

            let insertPos: number | null = null;

            // Find the previous intent that has content in writing
            // We look backwards to find the last covered intent before this one
            for (let j = i - 1; j >= 0; j--) {
              const prev = sorted[j];
              if (prev.supportingSentences && prev.supportingSentences.length > 0) {
                // Find the last sentence of this previous covered intent
                const lastSentence = prev.supportingSentences[prev.supportingSentences.length - 1];
                const range = findTextRangeInDoc(doc, { start: lastSentence.start, end: lastSentence.end });
                if (range) {
                  // Insert directly after the sentence (not after the paragraph)
                  insertPos = range.to;
                  break;
                }
              }
            }

            // If no previous content found, check if current has any supporting sentences
            // (for partial coverage - insert before the first supporting sentence)
            if (insertPos === null && current.status === 'partial' &&
                current.supportingSentences && current.supportingSentences.length > 0) {
              const firstSentence = current.supportingSentences[0];
              const range = findTextRangeInDoc(doc, { start: firstSentence.start, end: firstSentence.end });
              if (range) {
                // Insert directly before the sentence
                insertPos = range.from;
              }
            }

            // Default: if nothing found, position based on relative order in document
            if (insertPos === null) {
              // If this is the first intent, insert at start
              if (i === 0) {
                insertPos = 1;
              } else {
                // Otherwise, look for any content and position at end
                insertPos = Math.max(1, doc.content.size - 1);
              }
            }

            // Clamp to valid range
            insertPos = Math.min(Math.max(1, insertPos), doc.content.size - 1);

            // Create and add the widget
            const widgetStatus = current.status as 'partial' | 'missing';
            decorations.push(
              Decoration.widget(insertPos, () => createMissingIntentWidget(
                current.intentId,
                current.intentContent,
                widgetStatus,
                current.note,
                onAddMissingContent
              ), {
                side: 0, // Insert before
              })
            );
          }
        }

        if (!sentenceHighlights) return DecorationSet.create(doc, decorations);

        // Always show orphan content with underline + widget (not dependent on hover)
        sentenceHighlights.orphan.forEach((orphan) => {
          // Skip orphans that have been handled (added to outline or dismissed)
          if (handledOrphanStarts?.has(orphan.start)) {
            return;
          }

          if (orphan.suggestion === 'add-intent' && orphan.suggestedIntent) {
            const range = findTextRangeInDoc(doc, { start: orphan.start, end: orphan.end });
            if (range) {
              // Check if this orphan is being modified
              const isBeingModified = modifyingOrphanStart === orphan.start;

              if (isBeingModified) {
                // Show "being modified" highlight (light blue/purple) - no widget
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "bg-blue-100 dark:bg-blue-900/40 rounded px-0.5 transition-colors",
                  })
                );
              } else {
                // Normal orphan: underline + widget
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "underline decoration-amber-400 decoration-wavy decoration-1 underline-offset-2",
                  })
                );
                // Widget at the end with "add intent" button
                decorations.push(
                  Decoration.widget(range.to, () => createOrphanWidget(orphan), {
                    side: 1,
                  })
                );
              }
            }
          }
        });

        // Hovered intent from left panel - show supporting sentences
        // Green for covered, amber for partial
        if (hoveredIntentForLink) {
          // Check covered (green)
          sentenceHighlights.supporting.forEach(({ anchor, intentIds }) => {
            if (intentIds.includes(hoveredIntentForLink)) {
              const range = findTextRangeInDoc(doc, anchor);
              if (range) {
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "bg-emerald-200 dark:bg-emerald-700 rounded px-0.5 transition-colors",
                  })
                );
              }
            }
          });
          // Check partial (amber)
          sentenceHighlights.partial.forEach(({ anchor, intentIds }) => {
            if (intentIds.includes(hoveredIntentForLink)) {
              const range = findTextRangeInDoc(doc, anchor);
              if (range) {
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "bg-amber-200 dark:bg-amber-700 rounded px-0.5 transition-colors",
                  })
                );
              }
            }
          });
        }

        // Hovered orphan from left panel - highlight amber
        if (hoveredOrphanHint) {
          const orphan = sentenceHighlights.orphan.find(o => o.start === hoveredOrphanHint);
          if (orphan) {
            const range = findTextRangeInDoc(doc, { start: orphan.start, end: orphan.end });
            if (range) {
              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: "bg-amber-200 dark:bg-amber-700 rounded px-0.5 transition-colors",
                })
              );
            }
          }
        }

        // Hovered from writing side (local hover) - highlight supporting sentences
        // Green for covered, amber for partial
        if (localHoveredIntent && !hoveredIntentForLink) {
          // Check covered (green)
          sentenceHighlights.supporting.forEach(({ anchor, intentIds }) => {
            if (intentIds.includes(localHoveredIntent)) {
              const range = findTextRangeInDoc(doc, anchor);
              if (range) {
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "bg-emerald-100 dark:bg-emerald-800/50 rounded px-0.5 transition-colors",
                  })
                );
              }
            }
          });
          // Check partial (amber)
          sentenceHighlights.partial.forEach(({ anchor, intentIds }) => {
            if (intentIds.includes(localHoveredIntent)) {
              const range = findTextRangeInDoc(doc, anchor);
              if (range) {
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "bg-amber-100 dark:bg-amber-800/50 rounded px-0.5 transition-colors",
                  })
                );
              }
            }
          });
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}

export default function TipTapEditor({
  intent,
  writingBlock,
  roomId,
  user,
  writingBlocks,
  deleteWritingBlock,
  updateIntentBlock,
  onRegisterYjsExporter,
  onRegisterMarkdownExporter,
  onParagraphEnd,
  onCheckAlignment,
  isCheckingAlignment,
  sentenceHighlights,
  hoveredIntentForLink,
  hoveredOrphanHint,
  onMakeChangeToOutline,
  onDismissOrphan,
  onHoverIntentFromWriting,
  handledOrphanStarts,
  markOrphanHandled,
  intentCoverageMap,
  orderedIntentCoverage,
  onAddMissingContent,
  onModifyIntent,
  pendingWritingSuggestion,
  onClearWritingSuggestion,
}: TipTapEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [localHoveredIntent, setLocalHoveredIntent] = useState<string | null>(null);
  // Track which orphan is being modified (user clicked "Modify Writing")
  const [modifyingOrphanStart, setModifyingOrphanStart] = useState<string | null>(null);

  // Precomputed highlight ranges for mouse detection
  const highlightRangesRef = useRef<HighlightRange[]>([]);

  // Create Yjs doc and provider - stable reference
  // Room name must include "-writing-" for PartyKit server to recognize as Yjs connection
  const { doc, provider } = useMemo(() => {
    const d = new Y.Doc();
    const p = new YPartyKitProvider(
      process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
      `${roomId}-writing-${writingBlock.id}`,
      d,
      { connect: true }
    );
    return { doc: d, provider: p };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, writingBlock.id]);

  // Track sync state with timeout fallback
  useEffect(() => {
    const handleSync = () => setIsSynced(true);

    if (provider.synced) {
      setIsSynced(true);
    } else {
      provider.on("synced", handleSync);
    }

    // Fallback: if sync doesn't happen within 3s, render editor anyway
    const timeout = setTimeout(() => {
      setIsSynced(true);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      provider.off("synced", handleSync);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
    };
  }, [provider, doc]);

  // Refs for simulated writing callbacks (to avoid dependency issues)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const pendingWritingSuggestionRef = useRef(pendingWritingSuggestion);
  pendingWritingSuggestionRef.current = pendingWritingSuggestion;

  const handleAcceptWritingSuggestion = useCallback(() => {
    const editor = editorRef.current;
    const suggestion = pendingWritingSuggestionRef.current;
    if (!editor || !suggestion) return;

    const simulation = suggestion.simulation;
    const content = suggestion.suggestedContent;

    // Insert at appropriate position
    if (simulation?.position === 'start') {
      editor.chain().focus().setTextSelection(1).insertContent(`${content}\n\n`).run();
    } else if (simulation?.position === 'after' && simulation.insertAfter) {
      // Find position and insert
      const doc = editor.state.doc;
      const searchText = simulation.insertAfter.toLowerCase().slice(0, 30);
      let insertPos: number | null = null;

      doc.descendants((node, pos) => {
        if (node.isTextblock && insertPos === null) {
          const text = node.textContent?.toLowerCase() || '';
          if (text.includes(searchText)) {
            insertPos = pos + node.nodeSize;
          }
        }
        return insertPos === null;
      });

      if (insertPos !== null) {
        editor.chain().focus().insertContentAt(insertPos, `\n${content}`).run();
      } else {
        // Fallback to end
        editor.chain().focus().insertContentAt(doc.content.size - 1, `\n\n${content}`).run();
      }
    } else {
      // Default: insert at end
      editor.chain().focus().insertContentAt(editor.state.doc.content.size - 1, `\n\n${content}`).run();
    }
    onClearWritingSuggestion?.();
  }, [onClearWritingSuggestion]);

  const handleCancelWritingSuggestion = useCallback(() => {
    onClearWritingSuggestion?.();
  }, [onClearWritingSuggestion]);

  // Create highlight plugin that updates with props
  const highlightPlugin = useMemo(
    () => createHighlightPlugin(
      sentenceHighlights, hoveredIntentForLink, hoveredOrphanHint, localHoveredIntent,
      modifyingOrphanStart, handledOrphanStarts, intentCoverageMap,
      pendingWritingSuggestion || null, handleAcceptWritingSuggestion, handleCancelWritingSuggestion,
      intent.id, orderedIntentCoverage, onAddMissingContent
    ),
    [sentenceHighlights, hoveredIntentForLink, hoveredOrphanHint, localHoveredIntent,
     modifyingOrphanStart, handledOrphanStarts, intentCoverageMap,
     pendingWritingSuggestion, handleAcceptWritingSuggestion, handleCancelWritingSuggestion,
     intent.id, orderedIntentCoverage, onAddMissingContent]
  );

  // Initialize TipTap editor
  const editor = useEditor({
    immediatelyRender: false, // Required for SSR/Next.js
    extensions: [
      StarterKit.configure({
        // @ts-expect-error - Yjs handles history, disable built-in
        history: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Collaboration.configure({
        document: doc,
      }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none min-h-[150px] prose prose-sm max-w-none p-3",
      },
    },
  }, [doc]); // Recreate when doc changes

  // Keep editorRef in sync
  useEffect(() => {
    (editorRef as React.MutableRefObject<typeof editor>).current = editor;
  }, [editor]);

  // Track if highlight plugin has been added
  const pluginAddedRef = useRef(false);

  // Add and update highlight plugin
  useEffect(() => {
    if (!editor) return;

    const newPlugin = createHighlightPlugin(
      sentenceHighlights, hoveredIntentForLink, hoveredOrphanHint, localHoveredIntent,
      modifyingOrphanStart, handledOrphanStarts, intentCoverageMap,
      pendingWritingSuggestion || null, handleAcceptWritingSuggestion, handleCancelWritingSuggestion,
      intent.id, orderedIntentCoverage, onAddMissingContent
    );

    // Get current plugins, filter out any existing highlight plugin
    const existingPlugin = highlightPluginKey.get(editor.view.state);
    const plugins = editor.view.state.plugins.filter(p => p !== existingPlugin);

    editor.view.updateState(
      editor.view.state.reconfigure({
        plugins: [...plugins, newPlugin],
      })
    );

    pluginAddedRef.current = true;
  }, [editor, sentenceHighlights, hoveredIntentForLink, hoveredOrphanHint, localHoveredIntent,
      modifyingOrphanStart, handledOrphanStarts, intentCoverageMap,
      pendingWritingSuggestion, handleAcceptWritingSuggestion, handleCancelWritingSuggestion,
      intent.id, orderedIntentCoverage, onAddMissingContent]);

  // Precompute highlight ranges when sentenceHighlights changes
  useEffect(() => {
    if (!editor || !sentenceHighlights) {
      highlightRangesRef.current = [];
      return;
    }

    const fullText = editor.getText();
    const ranges: HighlightRange[] = [];

    // Supporting sentences (green - fully covered)
    sentenceHighlights.supporting.forEach(({ anchor, intentIds }) => {
      const range = findTextRange(fullText, anchor);
      if (range) {
        ranges.push({ ...range, type: 'supporting', intentIds });
      }
    });

    // Partial sentences (orange - partially covered)
    sentenceHighlights.partial.forEach(({ anchor, intentIds }) => {
      const range = findTextRange(fullText, anchor);
      if (range) {
        ranges.push({ ...range, type: 'partial', intentIds });
      }
    });

    // Orphan sentences (yellow - not in outline)
    sentenceHighlights.orphan.forEach((orphan) => {
      const range = findTextRange(fullText, { start: orphan.start, end: orphan.end });
      if (range) {
        ranges.push({ ...range, type: 'orphan', orphanData: orphan });
      }
    });

    highlightRangesRef.current = ranges;
  }, [editor, sentenceHighlights]);

  // Handle clicks on orphan widget buttons
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Handle "Make Change to Outline" button
      const makeChangeBtn = target.closest('.make-change-btn') as HTMLElement | null;
      if (makeChangeBtn && onMakeChangeToOutline) {
        event.preventDefault();
        event.stopPropagation();
        const suggestedIntent = makeChangeBtn.dataset.suggestedIntent;
        const orphanStart = makeChangeBtn.dataset.orphanStart;
        if (suggestedIntent && orphanStart) {
          onMakeChangeToOutline(suggestedIntent, orphanStart);
        }
        return;
      }

      // Handle "Modify Writing" button - highlight sentence for modification
      const addWritingBtn = target.closest('.add-writing-btn') as HTMLElement | null;
      if (addWritingBtn) {
        event.preventDefault();
        event.stopPropagation();
        const orphanStart = addWritingBtn.dataset.orphanStart;
        if (orphanStart) {
          // Set this orphan as "being modified" - shows highlight temporarily
          setModifyingOrphanStart(orphanStart);
          // Mark this orphan as permanently handled so it won't reappear
          markOrphanHandled?.(orphanStart);
          // Also notify parent if needed
          onDismissOrphan?.(orphanStart);
        }
        return;
      }

      // Handle "Change Writing" button for missing intents
      const addContentBtn = target.closest('.add-content-btn') as HTMLElement | null;
      if (addContentBtn && onAddMissingContent) {
        event.preventDefault();
        event.stopPropagation();
        const intentId = addContentBtn.dataset.intentId;
        const intentContent = addContentBtn.dataset.intentContent;
        if (intentId && intentContent) {
          onAddMissingContent(intentId, intentContent);
        }
        return;
      }

      // Handle "Modify Intention" button for missing intents
      const modifyIntentBtn = target.closest('.modify-intent-btn') as HTMLElement | null;
      if (modifyIntentBtn && onModifyIntent) {
        event.preventDefault();
        event.stopPropagation();
        const intentId = modifyIntentBtn.dataset.intentId;
        if (intentId) {
          onModifyIntent(intentId);
        }
        return;
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleClick);

    return () => {
      editorElement.removeEventListener('click', handleClick);
    };
  }, [editor, onMakeChangeToOutline, onDismissOrphan, markOrphanHandled, onAddMissingContent, onModifyIntent]);

  // Mouse move handler to detect which intent is being hovered
  useEffect(() => {
    if (!editor || !sentenceHighlights) return;

    const handleMouseMove = (event: MouseEvent) => {
      const view = editor.view;
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });

      if (!pos) {
        if (localHoveredIntent !== null) {
          setLocalHoveredIntent(null);
          onHoverIntentFromWriting?.(null);
        }
        return;
      }

      // Check if position is within any highlight range
      const ranges = highlightRangesRef.current;
      let foundIntent: string | null = null;

      for (const range of ranges) {
        if (pos.pos >= range.from && pos.pos <= range.to) {
          if (range.type === 'supporting' && range.intentIds && range.intentIds.length > 0) {
            foundIntent = range.intentIds[0]; // Take first intent if multiple
            break;
          }
        }
      }

      if (foundIntent !== localHoveredIntent) {
        setLocalHoveredIntent(foundIntent);
        onHoverIntentFromWriting?.(foundIntent);
      }
    };

    const handleMouseLeave = () => {
      if (localHoveredIntent !== null) {
        setLocalHoveredIntent(null);
        onHoverIntentFromWriting?.(null);
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("mousemove", handleMouseMove);
    editorElement.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      editorElement.removeEventListener("mousemove", handleMouseMove);
      editorElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor, sentenceHighlights, localHoveredIntent, onHoverIntentFromWriting]);

  // Mount state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear "modifying orphan" highlight when user starts editing
  useEffect(() => {
    if (!editor || !modifyingOrphanStart) return;

    const handleUpdate = () => {
      // Any edit clears the "being modified" highlight
      setModifyingOrphanStart(null);
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, modifyingOrphanStart]);

  // Register markdown exporter
  useEffect(() => {
    if (!onRegisterMarkdownExporter || !editor) return;

    const exportMarkdown = async (): Promise<string> => {
      // Simple text export - TipTap content to plain text
      return editor.getText();
    };

    onRegisterMarkdownExporter(writingBlock.id, exportMarkdown);
  }, [onRegisterMarkdownExporter, writingBlock.id, editor]);

  // Register Yjs exporter
  useEffect(() => {
    if (!onRegisterYjsExporter || !doc) return;

    const exportContent = () => Y.encodeStateAsUpdate(doc);
    onRegisterYjsExporter(writingBlock.id, exportContent);
  }, [onRegisterYjsExporter, writingBlock.id, doc]);

  // Handle Enter key for paragraph end callback
  useEffect(() => {
    if (!editor || !onParagraphEnd) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        setTimeout(() => {
          const content = editor.getText();
          const hash = simpleHash(content);
          onParagraphEnd(writingBlock.id, hash);
        }, 100);
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, onParagraphEnd, writingBlock.id]);

  // Simple hash function
  const simpleHash = useCallback((str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }, []);

  if (!isSynced) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="relative min-h-[200px] flex-1">
        {/* Check alignment button */}
        {onCheckAlignment && (
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={onCheckAlignment}
              disabled={isCheckingAlignment}
              className={`
                flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                ${isCheckingAlignment
                  ? "bg-blue-100 text-blue-600 cursor-wait"
                  : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                }
              `}
              title="Check alignment with outline"
            >
              {isCheckingAlignment ? (
                <>
                  <span className="h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  <span>Check</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TipTap Editor */}
        <div data-writing-block={writingBlock.id}>
          <EditorContent editor={editor} />
        </div>

      </div>

      {/* Conflict warnings */}
      {sentenceHighlights && sentenceHighlights.conflict.length > 0 && (
        <div className="border-t mt-2 pt-2 px-3 space-y-2">
          {sentenceHighlights.conflict.map((conflict, idx) => (
            <div
              key={`conflict-${idx}`}
              className={`text-xs rounded p-2 ${
                conflict.issue.severity === "conflict"
                  ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                  : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                    conflict.issue.severity === "conflict" ? "text-red-500" : "text-amber-500"
                  }`}
                />
                <div className="flex-1">
                  <div
                    className={`font-medium ${
                      conflict.issue.severity === "conflict"
                        ? "text-red-800 dark:text-red-200"
                        : "text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    Conflicts with &ldquo;{conflict.issue.remoteSectionIntent.slice(0, 30)}...&rdquo;
                  </div>
                  <div
                    className={`mt-1 ${
                      conflict.issue.severity === "conflict"
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {conflict.issue.issue}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 px-3 text-[10px] text-muted-foreground text-right">
        {mounted ? new Date(writingBlock.updatedAt).toLocaleTimeString() : "\u00A0"}
      </div>
    </div>
  );
}
