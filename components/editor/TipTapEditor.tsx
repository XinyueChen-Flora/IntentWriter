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
import type { ParagraphAttribution } from "@/platform/data-model";
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
  onRegisterParagraphAttributionExporter,
  onParagraphEnd,
  // Pipeline-driven primitives
  editorPrimitives,
  hoveredIntentId,
  // Legacy props (kept for backward compat)
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

  // ─── Paragraph attribution tracking ───
  // Tracks which user last edited each paragraph. Stored as a map of
  // paragraph textPrefix → attribution. Updated on each editor transaction.
  const paragraphAttributionsRef = useRef<Map<string, ParagraphAttribution>>(new Map());
  const prevParagraphTextsRef = useRef<string[]>([]);

  // Precomputed highlight ranges for mouse detection
  const highlightRangesRef = useRef<HighlightRange[]>([]);

  // Create Yjs doc - stable reference (never destroyed during component lifecycle)
  const doc = useMemo(() => new Y.Doc(), [roomId, writingBlock.id]);

  // Create provider - stable reference, connect: false (managed by effect)
  const provider = useMemo(
    () =>
      new YPartyKitProvider(
        process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
        `${roomId}-writing-${writingBlock.id}`,
        doc,
        { connect: false, party: "main" }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId, writingBlock.id, doc]
  );

  // Manage connection lifecycle in effect (Strict Mode safe)
  useEffect(() => {
    provider.connect();

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
      // Only disconnect, don't destroy — Strict Mode will re-run this effect
      // and call provider.connect() again. Actual cleanup happens when
      // deps change (new roomId/writingBlock) which creates new useMemo instances.
      provider.disconnect();
    };
  }, [provider]);

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

  // ─── Paragraph attribution: track which paragraphs the current user modifies ───
  useEffect(() => {
    if (!editor) return;

    // Extract paragraph texts from the editor
    function getParagraphTexts(): string[] {
      const texts: string[] = [];
      editor!.state.doc.forEach((node) => {
        if (node.isBlock) {
          texts.push(node.textContent);
        }
      });
      return texts;
    }

    // Initialize previous paragraph texts on first load
    if (prevParagraphTextsRef.current.length === 0 && editor.state.doc.content.size > 2) {
      prevParagraphTextsRef.current = getParagraphTexts();
    }

    const handleTransaction = () => {
      const currentTexts = getParagraphTexts();
      const prevTexts = prevParagraphTextsRef.current;

      // Find paragraphs that changed
      const maxLen = Math.max(currentTexts.length, prevTexts.length);
      for (let i = 0; i < maxLen; i++) {
        const curr = currentTexts[i];
        const prev = prevTexts[i];

        if (curr !== prev && curr !== undefined) {
          const prefix = curr.slice(0, 50);
          if (!prefix.trim()) continue; // skip empty paragraphs

          paragraphAttributionsRef.current.set(prefix, {
            index: i,
            textPrefix: prefix,
            lastEditBy: {
              userId: user.id,
              userName: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
              at: Date.now(),
            },
          });
        }
      }

      // Clean up attributions for deleted paragraphs
      const currentPrefixes = new Set(
        currentTexts.filter(t => t.trim()).map(t => t.slice(0, 50))
      );
      for (const key of paragraphAttributionsRef.current.keys()) {
        if (!currentPrefixes.has(key)) {
          paragraphAttributionsRef.current.delete(key);
        }
      }

      prevParagraphTextsRef.current = currentTexts;
    };

    editor.on('update', handleTransaction);
    return () => {
      editor.off('update', handleTransaction);
    };
  }, [editor, user]);

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

    // Use pipeline-driven primitives if available, otherwise empty
    const editorPrims = (pureWritingMode ? [] : editorPrimitives) || [];

    const newPlugin = createHighlightPlugin({
      editorPrimitives: editorPrims,
      hoveredIntentId: hoveredIntentForLink || hoveredIntentId,
    });

    const existingPlugin = highlightPluginKey.get(editor.view.state);
    const plugins = editor.view.state.plugins.filter(p => p !== existingPlugin);

    editor.view.updateState(
      editor.view.state.reconfigure({
        plugins: [...plugins, newPlugin],
      })
    );
  }, [editor, editorPrimitives, hoveredIntentForLink, hoveredIntentId, pureWritingMode]);

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
      return editor.getHTML();
    };

    onRegisterMarkdownExporter(writingBlock.id, exportMarkdown);
  }, [onRegisterMarkdownExporter, writingBlock.id, editor]);

  // Register paragraph attribution exporter
  useEffect(() => {
    if (!onRegisterParagraphAttributionExporter) return;

    const exportAttributions = (): ParagraphAttribution[] => {
      return Array.from(paragraphAttributionsRef.current.values())
        .sort((a, b) => a.index - b.index);
    };

    onRegisterParagraphAttributionExporter(writingBlock.id, exportAttributions);
  }, [onRegisterParagraphAttributionExporter, writingBlock.id]);

  // Register Yjs exporter
  useEffect(() => {
    if (!onRegisterYjsExporter || !doc) return;

    const exportContent = () => Y.encodeStateAsUpdate(doc);
    onRegisterYjsExporter(writingBlock.id, exportContent);
  }, [onRegisterYjsExporter, writingBlock.id, doc]);

  // ─── Content recovery ───
  // Yjs only handles real-time sync (no server-side persistence).
  // If Yjs doc is empty after sync (no other clients online), load from DB snapshot.
  const hasRecoveredRef = useRef(false);
  useEffect(() => {
    if (!isSynced || !editor || hasRecoveredRef.current) return;
    hasRecoveredRef.current = true;

    const currentText = editor.getText().trim();
    if (currentText) return; // Yjs has content (another client is online), no recovery needed

    // Fetch latest snapshot from DB
    const sectionId = intent.id;
    fetch(`/api/writing-snapshots?documentId=${roomId}&sectionId=${sectionId}&limit=1`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.snapshots?.[0]?.content_markdown) return;
        // Double-check editor is still empty (another client may have synced by now)
        if (editor.getText().trim()) return;
        editor.commands.setContent(data.snapshots[0].content_markdown);
      })
      .catch(() => {/* no snapshot available, start blank */});
  }, [isSynced, editor, intent.id, roomId]);

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
        {/* Check button removed — now comes from sense protocol UI via PrimitiveRenderer */}

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
