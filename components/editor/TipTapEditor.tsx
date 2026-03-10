"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";

// TipTap imports
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";

// Yjs imports
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";

// Local imports
import type { TipTapEditorProps, HighlightRange, SentenceAnchor } from "./types";
import { findTextRange, findTextRangeInDoc } from "./utils/textRangeFinder";
import { createHighlightPlugin, highlightPluginKey } from "./plugins/highlightPlugin";
import { createIssueDetailPanel } from "./widgets";

/**
 * TipTap-based collaborative editor with drift detection visualizations.
 * Handles:
 * - Real-time collaboration via Yjs + PartyKit
 * - Orphan/missing content indicators
 * - Hover-based intent linking
 * - Simulated writing suggestions
 */
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
  alignedIntents,
  highlightFilter,
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
  onAcceptWritingSuggestion,
  loadingIntentId,
  aiCoveredIntents,
  aiGeneratedSentences,
  pureWritingMode,
}: TipTapEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [localHoveredIntent, setLocalHoveredIntent] = useState<string | null>(null);
  const [modifyingOrphanStart, setModifyingOrphanStart] = useState<string | null>(null);
  const [expandedMissingIntentId, setExpandedMissingIntentId] = useState<string | null>(null);

  // Precomputed highlight ranges for mouse detection
  const highlightRangesRef = useRef<HighlightRange[]>([]);

  // Create Yjs doc and provider - stable reference
  const { doc, provider } = useMemo(() => {
    const d = new Y.Doc();
    const p = new YPartyKitProvider(
      process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
      `${roomId}-writing-${writingBlock.id}`,
      d,
      { connect: true, party: "main" }
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

  // Refs for simulated writing callbacks
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const pendingWritingSuggestionRef = useRef(pendingWritingSuggestion);
  pendingWritingSuggestionRef.current = pendingWritingSuggestion;

  // Store alignedIntents in a ref for access in callbacks
  const alignedIntentsRef = useRef(alignedIntents);
  alignedIntentsRef.current = alignedIntents;

  const handleAcceptWritingSuggestion = useCallback(() => {
    const editor = editorRef.current;
    const suggestion = pendingWritingSuggestionRef.current;
    const currentAlignedIntents = alignedIntentsRef.current;
    if (!editor || !suggestion) return;

    const content = suggestion.suggestedContent;
    const intentId = suggestion.intentId;
    const doc = editor.state.doc;

    // Calculate insertion position using the same logic as highlightPlugin
    // for missing intents: look for previous covered intent's last sentence,
    // or next covered intent's first sentence
    let insertPos: number | null = null;

    if (currentAlignedIntents && currentAlignedIntents.length > 0) {
      const sortedIntents = [...currentAlignedIntents].sort((a, b) => a.position - b.position);
      const intentIndex = sortedIntents.findIndex(i => i.id === intentId);

      if (intentIndex >= 0) {
        // Look backward for the closest covered intent
        for (let j = intentIndex - 1; j >= 0; j--) {
          const prev = sortedIntents[j];
          if (prev.sentences && prev.sentences.length > 0) {
            const lastSentence = prev.sentences[prev.sentences.length - 1];
            // Use findTextRangeInDoc - same as highlightPlugin
            const range = findTextRangeInDoc(doc, lastSentence);
            if (range) {
              insertPos = range.to;
              break;
            }
          }
        }

        // If no previous covered intent, look forward
        if (insertPos === null) {
          for (let j = intentIndex + 1; j < sortedIntents.length; j++) {
            const next = sortedIntents[j];
            if (next.sentences && next.sentences.length > 0) {
              const firstSentence = next.sentences[0];
              // Use findTextRangeInDoc - same as highlightPlugin
              const range = findTextRangeInDoc(doc, firstSentence);
              if (range) {
                // Insert BEFORE the next covered intent's first sentence
                insertPos = range.from;
                break;
              }
            }
          }
        }
      }
    }

    // Clamp to valid range if found
    if (insertPos !== null) {
      insertPos = Math.min(Math.max(1, insertPos), doc.content.size - 1);
    }

    // Insert at calculated position or fallback to end
    if (insertPos !== null) {
      editor.chain().focus().insertContentAt(insertPos, `\n${content}\n`).run();
    } else {
      editor.chain().focus().insertContentAt(doc.content.size - 1, `\n\n${content}`).run();
    }

    // Extract sentence anchor from AI content for live mapping
    // Use first ~30 chars as start, last ~30 chars as end
    const trimmedContent = content.trim();
    const sentenceAnchor = {
      start: trimmedContent.slice(0, Math.min(30, trimmedContent.length)),
      end: trimmedContent.length > 30 ? trimmedContent.slice(-30) : '',
    };

    // Mark this intent as AI-covered with sentence mapping
    onAcceptWritingSuggestion?.(suggestion.intentId, sentenceAnchor);
    onClearWritingSuggestion?.();
  }, [onClearWritingSuggestion, onAcceptWritingSuggestion]);

  const handleCancelWritingSuggestion = useCallback(() => {
    onClearWritingSuggestion?.();
  }, [onClearWritingSuggestion]);

  // Initialize TipTap editor
  const editor = useEditor({
    immediatelyRender: false,
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
        class: "outline-none min-h-[150px] prose max-w-none p-4",
      },
    },
  }, [doc]);

  // Keep editorRef in sync
  useEffect(() => {
    (editorRef as React.MutableRefObject<typeof editor>).current = editor;
  }, [editor]);

  // Clear expanded state when entering filter mode (all missing intents will be shown expanded)
  useEffect(() => {
    if (highlightFilter === 'missing') {
      setExpandedMissingIntentId(null);
    }
  }, [highlightFilter]);

  // Merge AI-generated sentences into sentenceHighlights for hover linking
  // Return undefined in pure writing mode (no decorations)
  const mergedSentenceHighlights = useMemo(() => {
    if (pureWritingMode) return undefined;
    if (!sentenceHighlights) {
      // If no API highlights but we have AI sentences, create structure
      if (aiGeneratedSentences && aiGeneratedSentences.size > 0) {
        const aiSupporting: Array<{ anchor: SentenceAnchor; intentIds: string[] }> = [];
        aiGeneratedSentences.forEach((mapping) => {
          if (mapping.rootIntentId === intent.id) {
            aiSupporting.push({
              anchor: mapping.anchor,
              intentIds: [mapping.intentId],
            });
          }
        });
        return {
          supporting: aiSupporting,
          partial: [],
          orphan: [],
          conflict: [],
        };
      }
      return undefined;
    }

    // Merge AI sentences into existing highlights
    if (!aiGeneratedSentences || aiGeneratedSentences.size === 0) {
      return sentenceHighlights;
    }

    const aiSupporting: Array<{ anchor: SentenceAnchor; intentIds: string[] }> = [];
    aiGeneratedSentences.forEach((mapping) => {
      if (mapping.rootIntentId === intent.id) {
        aiSupporting.push({
          anchor: mapping.anchor,
          intentIds: [mapping.intentId],
        });
      }
    });

    return {
      ...sentenceHighlights,
      supporting: [...sentenceHighlights.supporting, ...aiSupporting],
    };
  }, [sentenceHighlights, aiGeneratedSentences, intent.id, pureWritingMode]);

  // Add and update highlight plugin
  useEffect(() => {
    if (!editor) return;

    // Wrapper to handle simulate missing from inline widget
    const handleSimulateMissing = (intentId: string) => {
      const intentData = alignedIntents?.find(i => i.id === intentId);
      if (intentData && onAddMissingContent) {
        onAddMissingContent(intentId, intentData.content);
      }
    };

    const newPlugin = createHighlightPlugin({
      sentenceHighlights: mergedSentenceHighlights,
      alignedIntents: pureWritingMode ? undefined : alignedIntents,
      highlightFilter: pureWritingMode ? null : highlightFilter,
      hoveredIntentForLink: pureWritingMode ? null : hoveredIntentForLink,
      hoveredOrphanHint: pureWritingMode ? null : hoveredOrphanHint,
      localHoveredIntent: pureWritingMode ? null : localHoveredIntent,
      pendingWritingSuggestion: pendingWritingSuggestion || null,
      onAcceptWritingSuggestion: handleAcceptWritingSuggestion,
      onCancelWritingSuggestion: handleCancelWritingSuggestion,
      onHoverSimulatedIntent: onHoverIntentFromWriting,
      onSimulateMissing: handleSimulateMissing,
      expandedMissingIntentId,
      loadingIntentId,
      currentIntentId: intent.id,
      aiCoveredIntents,
    });

    const existingPlugin = highlightPluginKey.get(editor.view.state);
    const plugins = editor.view.state.plugins.filter(p => p !== existingPlugin);

    editor.view.updateState(
      editor.view.state.reconfigure({
        plugins: [...plugins, newPlugin],
      })
    );
  }, [editor, mergedSentenceHighlights, alignedIntents, highlightFilter, hoveredIntentForLink, hoveredOrphanHint,
      localHoveredIntent, pendingWritingSuggestion, handleAcceptWritingSuggestion, handleCancelWritingSuggestion,
      onHoverIntentFromWriting, onAddMissingContent, expandedMissingIntentId, loadingIntentId, intent.id, aiCoveredIntents, pureWritingMode]);

  // Precompute highlight ranges when sentenceHighlights changes
  useEffect(() => {
    if (!editor || !sentenceHighlights) {
      highlightRangesRef.current = [];
      return;
    }

    const fullText = editor.getText();
    const ranges: HighlightRange[] = [];

    sentenceHighlights.supporting.forEach(({ anchor, intentIds }) => {
      const range = findTextRange(fullText, anchor);
      if (range) {
        ranges.push({ ...range, type: 'supporting', intentIds });
      }
    });

    sentenceHighlights.partial.forEach(({ anchor, intentIds }) => {
      const range = findTextRange(fullText, anchor);
      if (range) {
        ranges.push({ ...range, type: 'partial', intentIds });
      }
    });

    sentenceHighlights.orphan.forEach((orphan) => {
      const range = findTextRange(fullText, { start: orphan.start, end: orphan.end });
      if (range) {
        ranges.push({ ...range, type: 'orphan', orphanData: orphan });
      }
    });

    highlightRangesRef.current = ranges;
  }, [editor, sentenceHighlights]);

  // Handle clicks on issue indicator dots and action buttons
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Handle click on issue indicator dot
      const issueDot = target.closest('.issue-dot') as HTMLElement | null;
      if (issueDot) {
        event.preventDefault();
        event.stopPropagation();

        const issueType = issueDot.dataset.issueType as 'orphan' | 'partial' | 'missing';

        if (issueType === 'missing') {
          // Toggle expanded state for missing intent (decoration plugin will handle rendering)
          const intentId = issueDot.dataset.intentId || '';
          setExpandedMissingIntentId(prev => prev === intentId ? null : intentId);
        } else if (issueType === 'orphan') {
          // For orphan, we still use DOM manipulation (TODO: convert to state-based)
          const parentWidget = issueDot.closest('.issue-indicator-dot');
          const existingWidget = parentWidget?.nextElementSibling;
          if (existingWidget?.classList.contains('issue-detail-panel')) {
            existingWidget.remove();
            return;
          }
          const orphanStart = issueDot.dataset.orphanStart || '';
          const suggestedIntent = issueDot.dataset.suggestedIntent || '';
          const panel = createIssueDetailPanel([{
            type: 'orphan',
            content: suggestedIntent,
            orphanStart,
            suggestedIntent,
          }]);
          parentWidget?.insertAdjacentElement('afterend', panel);
        } else {
          // For other types (partial, etc.), use DOM manipulation
          const parentWidget = issueDot.closest('.issue-indicator-dot');
          const existingWidget = parentWidget?.nextElementSibling;
          if (existingWidget?.classList.contains('issue-detail-panel')) {
            existingWidget.remove();
            return;
          }
          const intentId = issueDot.dataset.intentId || '';
          const intentContent = issueDot.dataset.intentContent || '';
          const panel = createIssueDetailPanel([{
            type: issueType,
            content: intentContent,
            intentId,
          }]);
          parentWidget?.insertAdjacentElement('afterend', panel);
        }
        return;
      }

      // Handle close panel button
      const closePanelBtn = target.closest('.close-panel-btn') as HTMLElement | null;
      if (closePanelBtn) {
        event.preventDefault();
        event.stopPropagation();
        closePanelBtn.closest('.issue-detail-panel')?.remove();
        return;
      }

      // Handle "Make Change to Outline" button
      const makeChangeBtn = target.closest('.make-change-btn') as HTMLElement | null;
      if (makeChangeBtn && onMakeChangeToOutline) {
        event.preventDefault();
        event.stopPropagation();
        const suggestedIntent = makeChangeBtn.dataset.suggestedIntent;
        const orphanStart = makeChangeBtn.dataset.orphanStart;
        if (suggestedIntent && orphanStart) {
          onMakeChangeToOutline(suggestedIntent, orphanStart);
          makeChangeBtn.closest('.issue-detail-panel')?.remove();
        }
        return;
      }

      // Handle "Dismiss" button
      const addWritingBtn = target.closest('.add-writing-btn') as HTMLElement | null;
      if (addWritingBtn) {
        event.preventDefault();
        event.stopPropagation();
        const orphanStart = addWritingBtn.dataset.orphanStart;
        if (orphanStart) {
          setModifyingOrphanStart(orphanStart);
          markOrphanHandled?.(orphanStart);
          onDismissOrphan?.(orphanStart);
          addWritingBtn.closest('.issue-detail-panel')?.remove();
        }
        return;
      }

      // Handle "Change Writing" button
      const addContentBtn = target.closest('.add-content-btn') as HTMLElement | null;
      if (addContentBtn && onAddMissingContent) {
        event.preventDefault();
        event.stopPropagation();
        const intentId = addContentBtn.dataset.intentId;
        const intentContent = addContentBtn.dataset.intentContent;
        if (intentId && intentContent) {
          onAddMissingContent(intentId, intentContent);
          addContentBtn.closest('.issue-detail-panel')?.remove();
        }
        return;
      }

      // Handle "Modify Intent" button
      const modifyIntentBtn = target.closest('.modify-intent-btn') as HTMLElement | null;
      if (modifyIntentBtn && onModifyIntent) {
        event.preventDefault();
        event.stopPropagation();
        const intentId = modifyIntentBtn.dataset.intentId;
        if (intentId) {
          onModifyIntent(intentId);
          modifyIntentBtn.closest('.issue-detail-panel')?.remove();
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

      const ranges = highlightRangesRef.current;
      let foundIntent: string | null = null;

      for (const range of ranges) {
        if (pos.pos >= range.from && pos.pos <= range.to) {
          if (range.type === 'supporting' && range.intentIds && range.intentIds.length > 0) {
            foundIntent = range.intentIds[0];
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
                flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors
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
      <div className="mt-2 px-3 text-xs text-muted-foreground text-right">
        {mounted ? new Date(writingBlock.updatedAt).toLocaleTimeString() : "\u00A0"}
      </div>
    </div>
  );
}
