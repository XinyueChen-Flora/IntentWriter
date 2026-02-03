"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import type { WritingBlock, IntentBlock, HelpRequest, ImpactPreview } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lightbulb, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/core/fonts/inter.css";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { Button } from "@/components/ui/button";
import InlineHelpPanel from "./InlineHelpPanel";

export type AlignmentResult = {
  overallScore: number;
  feedback: string;
  intentTree: Array<IntentTreeNode>;
};

type IntentTreeNode = {
  intentIndex: number | null;
  intentId: string | null;
  content: string;
  level: number;
  isSuggested: boolean;
  status: "covered" | "partial" | "misaligned" | "missing-skipped" | "missing-not-started" | "extra";
  writingSegments: Array<{
    text: string;
    positionInWriting: number;
    note: string;
  }>;
  coveredAspects: string[];
  missingAspects: string[];
  suggestion: string;
  orderMismatch?: {
    expected: number;
    actual: number;
    suggestion: string;
  } | null;
  children: Array<IntentTreeNode>;
};

type WritingEditorProps = {
  roomId: string;
  writingBlocks: WritingBlock[];
  intentBlocks: IntentBlock[];
  ensureWritingBlocksForIntents: () => void;
  user: User;
  onAlignmentChange?: (intentId: string, result: AlignmentResult | null) => void;
  hoveredIntentId?: string | null;
  onHoverIntent?: (intentId: string | null) => void;
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onActiveWritingBlockChange?: (intentId: string | null) => void;
  addHelpRequest?: (request: HelpRequest) => void;
  // Preview mode callbacks
  onPreviewActive?: (preview: ImpactPreview | null, helpRequest: HelpRequest | null) => void;
  activePreview?: ImpactPreview | null;
  activeHelpRequest?: HelpRequest | null;
  previewSelectedOption?: "A" | "B" | null;
};

// Generate a consistent color for a user based on their ID
function getUserColor(userId: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#AAB7B8"
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Writing Preview Overlay - shows side-by-side comparison of how writing would differ
function WritingPreviewOverlay({
  activePreview,
  selectedOption,
  intentId,
  currentContent,
}: {
  activePreview: ImpactPreview;
  selectedOption?: "A" | "B" | null;
  intentId: string;
  currentContent: string;
}) {
  // Get paragraph previews for both options
  const previewA = activePreview.optionA.paragraphPreviews?.find(
    (p) => p.intentId === intentId
  );
  const previewB = activePreview.optionB.paragraphPreviews?.find(
    (p) => p.intentId === intentId
  );

  // Check if we have actual written content
  const hasWrittenContent = currentContent && currentContent.trim().length > 0;

  // Left side (Keep Current):
  // - If written: show actual content
  // - If not written: show AI-generated preview of what WOULD be written with current intent
  const leftContent = hasWrittenContent
    ? currentContent
    : (previewA?.previewContent || "(Generating what would be written with current intent...)");

  const leftReason = hasWrittenContent
    ? "Your current writing"
    : (previewA?.reason || "What teammate would write following current intent");

  const leftIsGenerated = !hasWrittenContent && previewA?.previewContent;

  // Right side (Make Change): Show what it would become with modified intent
  const rightContent = previewB?.previewContent || "(Generating preview...)";
  const rightReason = previewB?.reason || "How writing would change with new intent";

  // If no previews at all, show loading indicator
  if (!previewA && !previewB) {
    return (
      <div className="min-h-[200px] bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 border-dashed rounded-lg flex items-center justify-center">
        <div className="text-center text-orange-600 text-sm">
          <span className="font-medium">Preview Mode</span>
          <br />
          <span className="text-xs">Generating writing preview...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[200px] bg-white dark:bg-gray-900 border-2 border-orange-400 rounded-lg overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 border-b border-orange-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-orange-800 dark:text-orange-200">
              📝 Writing Preview - How would this section change?
            </span>
          </div>
          <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-200/50 px-2 py-0.5 rounded">
            TEMPORARY PREVIEW
          </span>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 h-[calc(100%-44px)] overflow-hidden">
        {/* Option A - Left: CURRENT content */}
        <div className={`border-r border-gray-300 dark:border-gray-600 overflow-auto transition-all ${
          selectedOption === "A" ? "ring-2 ring-inset ring-blue-400" : ""
        }`}>
          <div className={`px-3 py-1.5 border-b sticky top-0 z-10 ${
            selectedOption === "A"
              ? "bg-blue-100 dark:bg-blue-900/30"
              : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-semibold ${
                selectedOption === "A" ? "text-blue-700" : "text-gray-600"
              }`}>
                {activePreview.optionA.label}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                {hasWrittenContent ? "CURRENT" : "WOULD WRITE"}
              </span>
            </div>
            {leftReason && (
              <div className="text-[9px] text-gray-500 mt-0.5 italic">{leftReason}</div>
            )}
          </div>
          <div className={`p-3 text-sm whitespace-pre-wrap leading-relaxed ${
            hasWrittenContent
              ? "text-gray-700 dark:text-gray-300"
              : "text-gray-500 dark:text-gray-400 italic"
          }`}>
            {leftContent}
          </div>
        </div>

        {/* Option B - Right: With MODIFIED intent */}
        <div className={`overflow-auto transition-all ${
          selectedOption === "B" ? "ring-2 ring-inset ring-purple-400" : ""
        }`}>
          <div className={`px-3 py-1.5 border-b sticky top-0 z-10 ${
            selectedOption === "B"
              ? "bg-purple-100 dark:bg-purple-900/30"
              : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-semibold ${
                selectedOption === "B" ? "text-purple-700" : "text-gray-600"
              }`}>
                {activePreview.optionB.label}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded">
                {hasWrittenContent ? "WOULD CHANGE TO" : "WOULD WRITE"}
              </span>
            </div>
            {rightReason && (
              <div className="text-[9px] text-gray-500 mt-0.5 italic">{rightReason}</div>
            )}
          </div>
          <div className={`p-3 text-sm whitespace-pre-wrap leading-relaxed ${
            selectedOption === "B"
              ? "text-purple-900 dark:text-purple-100 bg-purple-50/30 dark:bg-purple-900/10"
              : "text-gray-700 dark:text-gray-300"
          }`}>
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual BlockNote editor for each root intent
function IntentEditor({
  intent,
  writingBlock,
  roomId,
  user,
  childIntents,
  allIntents,
  onAlignmentChange,
  onHoverIntent,
  writingBlocks,
  deleteWritingBlock,
  updateIntentBlock,
  onRegisterYjsExporter,
  onActiveWritingBlockChange,
  addHelpRequest,
  onPreviewActive,
  activePreview,
  previewSelectedOption,
}: {
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  childIntents: IntentBlock[];
  allIntents: IntentBlock[];
  onAlignmentChange?: (intentId: string, result: AlignmentResult | null) => void;
  onHoverIntent?: (intentId: string | null) => void;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onActiveWritingBlockChange?: (intentId: string | null) => void;
  addHelpRequest?: (request: HelpRequest) => void;
  onPreviewActive?: (preview: ImpactPreview | null, helpRequest: HelpRequest | null) => void;
  activePreview?: ImpactPreview | null;
  previewSelectedOption?: "A" | "B" | null;
}) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [isCheckingAlignment, setIsCheckingAlignment] = useState(false);
  const [lastCheckedContent, setLastCheckedContent] = useState("");
  // ✗ REMOVED: Local alignmentResult state - use writingBlock.alignmentResult directly!
  const [showAlignment, setShowAlignment] = useState(false);
  const [previousContent, setPreviousContent] = useState("");
  const [paragraphCount, setParagraphCount] = useState(0);
  const [hoverTooltip, setHoverTooltip] = useState<{
    x: number;
    y: number;
    annotation: any;
  } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringTooltipRef = useRef(false);

  // Help request state
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionPosition, setSelectionPosition] = useState<{ top: number; left: number } | null>(null);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showHelpButton, setShowHelpButton] = useState(false);

  // Use writingBlock.alignmentResult directly as the source of truth
  const alignmentResult = writingBlock.alignmentResult;

  const doc = useMemo(() => new Y.Doc(), [resetKey]);
  const [isSynced, setIsSynced] = useState(false);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Monitor text selection for help request
  useEffect(() => {
    const handleSelectionChange = () => {
      // Don't process selection changes when help panel is open
      if (showHelpPanel) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // No selection or cursor only
        setShowHelpButton(false);
        setSelectedText("");
        setSelectionPosition(null);
        return;
      }

      // Check if selection is within this editor
      const range = selection.getRangeAt(0);
      const container = editorWrapperRef.current;
      if (!container || !container.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 0) {
        setSelectedText(text);
        const rect = range.getBoundingClientRect();
        setSelectionPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        });
        setShowHelpButton(true);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [showHelpPanel]);

  // Helper: Flatten intentTree to get all intents with their segments
  const flattenIntentTree = useCallback((nodes: IntentTreeNode[]): IntentTreeNode[] => {
    const result: IntentTreeNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result.push(...flattenIntentTree(node.children));
      }
    });
    return result;
  }, []);

  // Auto-enable showAlignment when alignment data is loaded
  useEffect(() => {
    if (writingBlock.alignmentResult) {
      setShowAlignment(true);
    }
  }, [writingBlock.alignmentResult]);

  const provider = useMemo(
    () => {
      try {
        const p = new YPartyKitProvider(
          process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
          `${roomId}-writing-${writingBlock.id}`,
          doc,
          {
            connect: true,
          }
        );

        // Wait for initial sync
        p.on('synced', () => {
          setIsSynced(true);
        });

        return p;
      } catch (error) {
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : "Provider creation failed");
        return null;
      }
    },
    [roomId, writingBlock.id, doc, resetKey]
  );

  // Cleanup provider on unmount
  useEffect(() => {
    if (!provider) return;
    return () => {
      try {
        provider.disconnect();
        provider.destroy();
      } catch (error) {
        // Silent cleanup
      }
    };
  }, [provider]);

  // Refs for overlay-based highlighting
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState<string>("");

  // Get user display name (prefer user_metadata.name, fallback to email, then id)
  const userName = useMemo(() => {
    return (
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      user.id.slice(0, 8)
    );
  }, [user]);

  const userColor = useMemo(() => getUserColor(user.id), [user.id]);

  const editor = useCreateBlockNote({
    collaboration: provider ? {
      provider,
      fragment: doc.getXmlFragment("document-store"),
      user: {
        name: userName,
        color: userColor,
      },
    } : undefined,
  });

  // Register Yjs content exporter callback
  useEffect(() => {
    if (!onRegisterYjsExporter || !doc || !isSynced) return;

    // Export function that gets the current Yjs state
    const exportContent = () => {
      if (!editor) return new Uint8Array();
      return Y.encodeStateAsUpdate(doc);
    };

    // Register this exporter
    onRegisterYjsExporter(writingBlock.id, exportContent);
  }, [onRegisterYjsExporter, writingBlock.id, doc, editor, isSynced]);

  // Track editor content for the alignment overlay
  useEffect(() => {
    if (!editor) return;

    const updateContent = () => {
      try {
        const blocks = editor.document;
        const content = blocks.map((block: any) => {
          if (block.type === 'paragraph' && block.content) {
            return block.content.map((c: any) => c.text || '').join('') || '';
          }
          return '';
        }).join('\n\n').trim();

        setEditorContent(content);
      } catch {
        // Silent fail for content reading
      }
    };

    // Initial content
    updateContent();

    // Listen to changes
    const unsubscribe = editor.onChange(updateContent);
    return unsubscribe;
  }, [editor]);

  // Build segments from Intent Tree
  const alignmentSegments = useMemo(() => {
    if (!alignmentResult?.intentTree || !editorContent) {
      return [];
    }

    try {
      // Flatten the tree to get all intents
      const allIntents = flattenIntentTree(alignmentResult.intentTree);

      // Collect all writing segments with their intent's status
      const allSegments: Array<{
        text: string;
        positionInWriting: number;
        status: string;
        intentId: string | null;
        intentContent: string;
        isSuggested: boolean;
        note: string;
        intentIndex: number | null;
      }> = [];

      allIntents.forEach(intent => {
        if (!intent.writingSegments || !Array.isArray(intent.writingSegments)) {
          return; // Skip if no segments
        }

        intent.writingSegments.forEach(segment => {
          if (!segment || !segment.text) {
            return; // Skip invalid segments
          }

          allSegments.push({
            text: segment.text,
            positionInWriting: segment.positionInWriting || 0,
            status: intent.status || 'covered', // Inherit status from intent - UNIFIED!
            intentId: intent.intentId || null,
            intentContent: intent.content || '',
            isSuggested: intent.isSuggested || false,
            note: segment.note || '',
            intentIndex: intent.intentIndex
          });
        });
      });

      // Sort by position in writing
      allSegments.sort((a, b) => a.positionInWriting - b.positionInWriting);

      // Build final segments array
      const finalSegments: Array<{
        text: string;
        annotation: any | null;
        type: 'text' | 'missing-placeholder'
      }> = [];

      // Add writing segments with proper status mapping
      allSegments.forEach((segment) => {
        // Map Intent Tree statuses to overlay display statuses
        let displayStatus: string;
        if (segment.status === 'covered' || segment.status === 'partial') {
          displayStatus = 'aligned';
        } else if (segment.status === 'misaligned') {
          displayStatus = 'not-aligned';
        } else if (segment.status === 'extra') {
          displayStatus = 'extra';
        } else {
          displayStatus = 'aligned'; // Default fallback
        }

        finalSegments.push({
          text: segment.text,
          annotation: {
            status: displayStatus,
            intentId: segment.intentId,
            intentPath: segment.intentContent,
            note: segment.note,
            isSuggested: segment.isSuggested,
            mappedIntentId: segment.intentId // For hover detection
          },
          type: 'text'
        });
      });

      // Insert missing-skipped intents as placeholders
      const skippedIntents = allIntents.filter(intent => intent.status === 'missing-skipped');

      skippedIntents.forEach(skippedIntent => {
        // Insert skipped intent placeholder between segments based on intentIndex
        const insertionPoint = finalSegments.findIndex(seg => {
          const segmentIntentIndex = allSegments.find(s => s.text === seg.text)?.intentIndex || 0;
          return (skippedIntent.intentIndex || 0) < segmentIntentIndex;
        });

        const placeholder = {
          text: skippedIntent.content || '',
          annotation: {
            status: 'missing',
            intentId: skippedIntent.intentId,
            suggestion: skippedIntent.suggestion || ''
          },
          type: 'missing-placeholder' as const
        };

        if (insertionPoint === -1) {
          // Skipped intent is after all writing, add at end
          finalSegments.push(placeholder);
        } else {
          // Insert before the found segment
          finalSegments.splice(insertionPoint, 0, placeholder);
        }
      });

      return finalSegments;
    } catch {
      return [];
    }
  }, [alignmentResult, editorContent, flattenIntentTree]);

  // Render overlay (memoized to prevent unnecessary re-renders from tooltip state)
  const renderAlignmentOverlay = useMemo(() => {
    if (!showAlignment || alignmentSegments.length === 0) {
      return null;
    }

    try {
      return (
      <div
        className="absolute inset-0 bg-white dark:bg-gray-900 z-10 overflow-auto rounded-md border border-primary/50 shadow-sm pointer-events-auto"
        style={{
          padding: '12px 54px 12px 54px', // Match BlockNote's padding
        }}
      >
        <div
          className="whitespace-pre-wrap"
          style={{
            fontFamily: 'Inter, sans-serif', // Match BlockNote's font
            fontSize: '15px',
            lineHeight: '1.5',
            color: 'inherit',
          }}
        >
          {alignmentSegments.map((segment, idx) => {
            // Missing intent placeholder
            if (segment.type === 'missing-placeholder') {
              return (
                <div
                  key={idx}
                  className="my-3 p-2 rounded border-l-4"
                  style={{
                    backgroundColor: '#fee2e2',
                    borderColor: '#ef4444',
                  }}
                >
                  <div className="text-xs font-medium text-red-700">
                    ⚠️ Missing: {segment.text}
                  </div>
                  {segment.annotation?.suggestion && (
                    <div className="text-[10px] text-red-600 mt-1">
                      {segment.annotation.suggestion}
                    </div>
                  )}
                </div>
              );
            }

            // Regular text with annotation
            if (segment.annotation) {
              const bgColor =
                segment.annotation.status === 'aligned' ? '#dcfce7' : // green
                segment.annotation.status === 'not-aligned' ? '#fed7aa' : // orange (misaligned)
                '#dbeafe'; // blue (extra)

              return (
                <span
                  key={idx}
                  style={{
                    backgroundColor: bgColor,
                    borderRadius: '2px',
                    padding: '2px 0',
                    cursor: 'pointer'
                  }}
                  data-intent-id={segment.annotation.mappedIntentId}
                  data-alignment-note={segment.annotation.note}
                  data-alignment-status={segment.annotation.status}
                  onMouseEnter={(e) => {
                    // Clear any pending hide timeout
                    if (tooltipTimeoutRef.current) {
                      clearTimeout(tooltipTimeoutRef.current);
                      tooltipTimeoutRef.current = null;
                    }

                    if (onHoverIntent && segment.annotation.mappedIntentId) {
                      onHoverIntent(segment.annotation.mappedIntentId);
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverTooltip({
                      x: rect.left,
                      y: rect.bottom + 5,
                      annotation: segment.annotation
                    });
                  }}
                  onMouseLeave={() => {
                    // Delay hiding tooltip to allow user to hover over it
                    tooltipTimeoutRef.current = setTimeout(() => {
                      if (!isHoveringTooltipRef.current) {
                        if (onHoverIntent) {
                          onHoverIntent(null);
                        }
                        setHoverTooltip(null);
                      }
                    }, 200);
                  }}
                >
                  {segment.text}
                </span>
              );
            } else {
              return <span key={idx}>{segment.text}</span>;
            }
          })}
        </div>
      </div>
      );
    } catch {
      return null;
    }
  }, [showAlignment, alignmentSegments, onHoverIntent]);

  // Handle merging content from another writing block when intent is indented
  useEffect(() => {
    if (!intent.mergeWritingFrom || !editor || !doc || !isSynced) return;

    const mergeContent = async () => {
      try {
        // Find the source writing block
        const sourceWritingBlock = writingBlocks.find((wb) => wb.id === intent.mergeWritingFrom);

        if (!sourceWritingBlock) {
          updateIntentBlock(intent.id, { mergeWritingFrom: undefined });
          return;
        }

        // Connect to the source Yjs document
        const sourceDoc = new Y.Doc();
        const sourceProvider = new YPartyKitProvider(
          process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
          `${roomId}-writing-${sourceWritingBlock.id}`,
          sourceDoc,
          { connect: true }
        );

        // Wait for source to sync
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 3000);
          sourceProvider.on('synced', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        // Get the source and target fragments
        const sourceFragment = sourceDoc.getXmlFragment("document-store");
        const targetFragment = doc.getXmlFragment("document-store");

        // Find the blockGroup elements (BlockNote's container)
        let sourceBlockGroup: any = null;
        let targetBlockGroup: any = null;

        sourceFragment.forEach((element) => {
          if (element instanceof Y.XmlElement && element.nodeName === 'blockGroup') {
            sourceBlockGroup = element;
          }
        });

        targetFragment.forEach((element) => {
          if (element instanceof Y.XmlElement && element.nodeName === 'blockGroup') {
            targetBlockGroup = element;
          }
        });

        // Only merge if both blockGroups exist and source has content
        if (sourceBlockGroup && targetBlockGroup && sourceBlockGroup.toArray().length > 0) {
          // Perform merge in a Yjs transaction
          doc.transact(() => {
            // Add a separator paragraph to target blockGroup
            const separatorContainer = new Y.XmlElement('blockContainer');
            separatorContainer.setAttribute('id', `separator-${Date.now()}`);

            const separatorParagraph = new Y.XmlElement('paragraph');
            separatorParagraph.setAttribute('id', `para-${Date.now()}`);
            separatorParagraph.setAttribute('backgroundColor', 'default');
            separatorParagraph.setAttribute('textColor', 'default');
            separatorParagraph.setAttribute('textAlignment', 'left');

            const separatorText = new Y.XmlText();
            separatorText.insert(0, '---');
            separatorParagraph.insert(0, [separatorText]);
            separatorContainer.insert(0, [separatorParagraph]);

            targetBlockGroup!.push([separatorContainer]);

            // Clone all blockContainers from source to target
            const containersToCopy: any[] = [];
            sourceBlockGroup!.forEach((element: any) => {
              containersToCopy.push(element.clone());
            });

            targetBlockGroup!.push(containersToCopy);
          }, 'merge-writing-blocks');

          // Wait for transaction to propagate
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Clean up source provider
        sourceProvider.disconnect();
        sourceProvider.destroy();

        // Delete the source writing block
        deleteWritingBlock(sourceWritingBlock.id);

        // Clear the merge flag
        updateIntentBlock(intent.id, { mergeWritingFrom: undefined });

      } catch (error) {
        // Clear the flag even on error to prevent infinite loops
        updateIntentBlock(intent.id, { mergeWritingFrom: undefined });
      }
    };

    // Delay execution slightly to ensure editor is fully ready
    const timer = setTimeout(mergeContent, 500);
    return () => clearTimeout(timer);
  }, [intent.mergeWritingFrom, editor, doc, isSynced, roomId, writingBlocks, deleteWritingBlock, updateIntentBlock, intent.id]);


  // Check alignment when user completes a paragraph
  const checkAlignment = useCallback(async (content: string) => {
    // Only check if assigned to current user
    if (intent.assignee !== user.id) return;

    // Avoid duplicate checks
    if (content === lastCheckedContent || content.length < 50) return;

    setIsCheckingAlignment(true);
    setLastCheckedContent(content);

    try {

      // Build intent list with IDs for precise mapping
      const intentList = [
        {
          id: intent.id,
          content: intent.content,
          type: 'main',
          level: 0,
        },
        ...childIntents.map((child) => ({
          id: child.id, // Use real child intent ID
          content: child.content,
          type: 'sub',
          level: child.level,
        }))
      ];

      const response = await fetch('/api/check-alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentContent: intent.content,
          intentTag: intent.intentTag,
          intentList: intentList, // Pass full intent list with IDs
          writingContent: content,
          documentId: roomId,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Notify parent - this will update writingBlock.alignmentResult via PartyKit
        if (onAlignmentChange) {
          onAlignmentChange(intent.id, {
            overallScore: result.overallScore,
            feedback: result.feedback,
            intentTree: result.intentTree || [],
          });
        }

      }
    } catch (error) {
      // Silent fail for alignment check
    } finally {
      setIsCheckingAlignment(false);
    }
  }, [intent, user.id, roomId, lastCheckedContent, onAlignmentChange, childIntents]);

  // Monitor editor changes for paragraph completion
  useEffect(() => {
    if (!editor) return;

    let debounceTimeout: NodeJS.Timeout | null = null;

    const handleUpdate = () => {
      // Clear previous timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Get editor content
      try {
        const blocks = editor.document;
        const content = blocks.map((block: any) => {
          if (block.type === 'paragraph' && block.content) {
            return block.content.map((c: any) => c.text || '').join('') || '';
          }
          return '';
        }).join('\n\n').trim();

        // Count non-empty paragraphs
        const currentParagraphCount = blocks.filter((block: any) => {
          if (block.type !== 'paragraph' || !block.content) return false;
          const text = block.content.map((c: any) => c.text || '').join('').trim();
          return text.length > 0;
        }).length;

        const shouldTriggerCheck = (() => {
          // Skip if already checked this exact content
          if (content === lastCheckedContent) return false;

          // Skip if content too short
          if (content.length < 50) return false;

          // Condition 1: New paragraph added (paragraph count increased)
          if (currentParagraphCount > paragraphCount) return true;

          // Condition 2: First time writing (has content but never checked)
          if (previousContent.length === 0 && content.length >= 100) return true;

          // Condition 3: Substantial modification to existing content
          if (previousContent.length > 0) {
            const maxLen = Math.max(content.length, previousContent.length);
            const minLen = Math.min(content.length, previousContent.length);

            let differences = Math.abs(content.length - previousContent.length);
            for (let i = 0; i < minLen; i++) {
              if (content[i] !== previousContent[i]) {
                differences++;
              }
            }

            const modificationPercentage = (differences / maxLen) * 100;
            if (modificationPercentage > 20) return true;
          }

          return false;
        })();

        // Update tracking state
        setPreviousContent(content);
        setParagraphCount(currentParagraphCount);

        // Trigger check if conditions met
        if (shouldTriggerCheck) {
          // Debounce: wait 2 seconds after typing stops
          debounceTimeout = setTimeout(() => {
            checkAlignment(content);
          }, 2000);
        }
      } catch {
        // Silent fail for editor content reading
      }
    };

    // Listen to editor changes
    const unsubscribe = editor.onChange(handleUpdate);
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      unsubscribe();
    };
  }, [editor, checkAlignment, lastCheckedContent, paragraphCount, previousContent]);

  // Handle preview generated from InlineHelpPanel (team-relevant questions)
  const handlePreviewGenerated = useCallback((preview: ImpactPreview, helpRequest: HelpRequest) => {
    // Store the help request
    if (addHelpRequest) {
      addHelpRequest(helpRequest);
    }
    // Notify parent to show preview in editor and intent panel
    if (onPreviewActive) {
      onPreviewActive(preview, helpRequest);
    }
  }, [addHelpRequest, onPreviewActive]);

  // Handle closing the help panel
  const handleHelpPanelClose = useCallback(() => {
    setShowHelpPanel(false);
    setShowHelpButton(false);
    setSelectedText("");
    setSelectionPosition(null);
  }, []);

  // Manual alignment check handler
  const handleManualCheck = useCallback(async () => {
    if (!editor) return;

    try {
      const blocks = editor.document;
      const content = blocks.map((block: any) => {
        if (block.type === 'paragraph' && block.content) {
          return block.content.map((c: any) => c.text || '').join('') || '';
        }
        return '';
      }).join('\n\n').trim();

      if (content.length > 0) {
        await checkAlignment(content);
        setShowAlignment(true);
      }
    } catch {
      // Silent fail for manual check
    }
  }, [editor, checkAlignment]);

  // Error boundary for BlockNote
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMsg = event.message || "";

      // Check for position errors - these are usually transient during sync
      if (errorMsg.includes("Position") && errorMsg.includes("out of range")) {
        event.preventDefault();
        return;
      }

      // Check for other BlockNote/Yjs errors
      if (errorMsg.toLowerCase().includes("blocknote") || errorMsg.toLowerCase().includes("yjs")) {
        setHasError(true);
        setErrorMessage(errorMsg);
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason || "";
      if (typeof reason === "string" && reason.includes("Position")) {
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [writingBlock.id]);

  // Client-only timestamp to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleReset = useCallback(() => {
    // Disconnect current provider
    if (provider) {
      try {
        provider.disconnect();
        provider.destroy();
      } catch (error) {
        // Silent cleanup
      }
    }

    // Reset local state - this will create a new Yjs document
    // The new document will automatically sync to PartyKit
    setHasError(false);
    setErrorMessage("");
    setResetKey(prev => prev + 1);
  }, [provider, writingBlock.id]);

  if (hasError) {
    return (
      <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 pl-4 py-3">
        <div className="mb-2">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {intent.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-md">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Editor Error
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              {errorMessage || "The editor encountered an error and needs to be reset."}
            </p>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="mt-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset Editor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-l-4 border-border hover:border-primary/50 bg-card pl-4 py-3 transition-colors flex flex-row gap-4">
      {/* Left Panel: Title, Assignee, Intent Tag, Alignment Controls */}
      <div className="w-48 flex-shrink-0 flex flex-col gap-2">
        {/* Intent Title */}
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {intent.content}
          </ReactMarkdown>
        </div>

        {/* Assignee badge */}
        {intent.assignee && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md w-fit">
            <span className="text-xs text-muted-foreground">Assignee:</span>
            <span className="text-xs font-medium">
              {intent.assignee === user.id
                ? 'You'
                : intent.assigneeName || intent.assigneeEmail?.split('@')[0] || 'User'}
            </span>
          </div>
        )}

        {/* Intent Tag (if exists) */}
        {intent.intentTag && (
          <div className="flex items-start gap-1.5 text-xs">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="prose prose-xs text-amber-900 dark:text-amber-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {intent.intentTag}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Alignment Controls */}
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors">
            <input
              type="checkbox"
              checked={showAlignment}
              onChange={(e) => {
                const isChecked = e.target.checked;
                setShowAlignment(isChecked);
              }}
              className="w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-muted-foreground">Show alignment</span>
          </label>
          <Button
            onClick={handleManualCheck}
            disabled={isCheckingAlignment}
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs w-fit"
          >
            {isCheckingAlignment ? 'Checking...' : 'Check now'}
          </Button>
        </div>

        {/* Alignment Check Status */}
        {isCheckingAlignment && (
          <div className="p-2 bg-muted/30 rounded-md border flex items-center gap-2 text-xs text-blue-600">
            <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Analyzing...</span>
          </div>
        )}
      </div>

      {/* Right Panel: Editor + Last Updated */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* BlockNote Editor Container - with relative positioning for overlay */}
        <div className="relative min-h-[200px] flex-1">
          {/* Writing Preview Overlay - rendered ABOVE the editor when active */}
          {activePreview && activePreview.affectedRootIntentIds?.includes(intent.id) && (
            <WritingPreviewOverlay
              activePreview={activePreview}
              selectedOption={previewSelectedOption}
              intentId={intent.id}
              currentContent={editorContent}
            />
          )}

          {/* BlockNote Editor - hidden when preview is active */}
          <div
            ref={editorWrapperRef}
            className={`blocknote-editor-wrapper ${
              activePreview && activePreview.affectedRootIntentIds?.includes(intent.id)
                ? "invisible"
                : ""
            }`}
            onFocus={() => {
              if (onActiveWritingBlockChange) {
                onActiveWritingBlockChange(intent.id);
              }
            }}
            onBlur={() => {
              if (onActiveWritingBlockChange) {
                onActiveWritingBlockChange(null);
              }
            }}
          >
            {!provider ? (
              <div className="p-4 text-sm text-muted-foreground">
                Failed to initialize editor. Please refresh the page.
              </div>
            ) : !isSynced ? (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span>Loading content...</span>
              </div>
            ) : (
              <BlockNoteView editor={editor} theme="light" formattingToolbar={true} />
            )}

            {/* Alignment Overlay - rendered on top when showAlignment is true */}
            {renderAlignmentOverlay}
          </div>
        </div>

        {/* Footer: last updated - only render on client to avoid hydration error */}
        <div className="mt-2 text-[10px] text-muted-foreground text-right">
          {mounted ? new Date(writingBlock.updatedAt).toLocaleTimeString() : '\u00A0'}
        </div>
      </div>

      {/* Floating Help Button - appears when text is selected */}
      {showHelpButton && selectionPosition && !showHelpPanel && (
        <div
          className="fixed z-40 animate-in fade-in-0 zoom-in-95"
          style={{
            top: selectionPosition.top + 5,
            left: selectionPosition.left,
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 shadow-md border bg-white hover:bg-blue-50"
            onClick={() => setShowHelpPanel(true)}
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1 text-blue-500" />
            <span className="text-xs">Ask for Help</span>
          </Button>
        </div>
      )}

      {/* Inline Help Panel */}
      {showHelpPanel && selectionPosition && (
        <InlineHelpPanel
          selectedText={selectedText}
          selectionPosition={selectionPosition}
          writingBlockId={writingBlock.id}
          currentWritingContent={editorContent}
          intentBlockId={intent.id}
          intentContent={intent.content}
          allIntents={allIntents}
          allWritingBlocks={writingBlocks}
          userId={user.id}
          userName={user.user_metadata?.name || user.email?.split('@')[0]}
          userEmail={user.email || undefined}
          onPreviewGenerated={handlePreviewGenerated}
          onClose={handleHelpPanelClose}
        />
      )}

      {/* Hover Tooltip for AI Notes with Action Buttons */}
      {hoverTooltip && (
        <div
          className="fixed z-50 max-w-md p-3 rounded-lg shadow-lg border"
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
            backgroundColor: hoverTooltip.annotation.status === 'aligned' ? '#dcfce7' :
                           hoverTooltip.annotation.status === 'not-aligned' ? '#fed7aa' :
                           '#dbeafe',
            borderColor: hoverTooltip.annotation.status === 'aligned' ? '#86efac' :
                        hoverTooltip.annotation.status === 'not-aligned' ? '#fb923c' :
                        '#93c5fd',
          }}
          onMouseEnter={() => {
            // User is hovering over tooltip, cancel any hide timeout
            if (tooltipTimeoutRef.current) {
              clearTimeout(tooltipTimeoutRef.current);
              tooltipTimeoutRef.current = null;
            }
            isHoveringTooltipRef.current = true;
          }}
          onMouseLeave={() => {
            // User left tooltip, hide it
            isHoveringTooltipRef.current = false;
            if (onHoverIntent) {
              onHoverIntent(null);
            }
            setHoverTooltip(null);
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {hoverTooltip.annotation.status === 'aligned' ? '✓' :
               hoverTooltip.annotation.status === 'not-aligned' ? '⚠' :
               'ℹ'}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium mb-1">
                {hoverTooltip.annotation.status === 'aligned' ? 'Aligned' :
                 hoverTooltip.annotation.status === 'not-aligned' ? 'Misaligned' :
                 'Extra'}
              </div>
              <div className="text-xs text-gray-700 mb-2">
                {hoverTooltip.annotation.note}
              </div>

              {/* Action buttons based on status */}
              <div className="flex gap-1.5 mt-2">
                {hoverTooltip.annotation.status === 'extra' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        // TODO: Add this content to intent structure
                      }}
                    >
                      Add to Intent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        // TODO: Suggest removing this content
                      }}
                    >
                      Remove
                    </Button>
                  </>
                )}

                {hoverTooltip.annotation.status === 'not-aligned' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        // TODO: Update writing to align
                      }}
                    >
                      Update Writing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        // TODO: Update intent to match
                      }}
                    >
                      Update Intent
                    </Button>
                  </>
                )}

                {hoverTooltip.annotation.status === 'aligned' && hoverTooltip.annotation.mappedIntentPath && (
                  <div className="text-[10px] text-gray-600">
                    Mapped to: {hoverTooltip.annotation.mappedIntentPath}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WritingEditor({
  roomId,
  writingBlocks,
  intentBlocks,
  ensureWritingBlocksForIntents,
  user,
  onAlignmentChange,
  hoveredIntentId,
  onHoverIntent,
  deleteWritingBlock,
  updateIntentBlock,
  onRegisterYjsExporter,
  onActiveWritingBlockChange,
  addHelpRequest,
  onPreviewActive,
  activePreview,
  activeHelpRequest,
  previewSelectedOption,
}: WritingEditorProps) {
  // Ensure we have writing blocks for all root-level intents
  useEffect(() => {
    ensureWritingBlocksForIntents();
  }, [intentBlocks, ensureWritingBlocksForIntents]);

  // Get root-level intents only
  const rootIntents = intentBlocks.filter((intent) => !intent.parentId);

  // Create a map of intentId -> writingBlock
  // IMPORTANT: If there are duplicate blocks (same linkedIntentId), prioritize ones WITH alignmentResult
  const intentToWritingMap = new Map<string, WritingBlock>();
  writingBlocks.forEach((block) => {
    if (block.linkedIntentId) {
      const existing = intentToWritingMap.get(block.linkedIntentId);
      // Only update if: no existing block, OR this block has alignment data and existing doesn't
      if (!existing || (block.alignmentResult && !existing.alignmentResult)) {
        intentToWritingMap.set(block.linkedIntentId, block);
      }
    }
  });

  // Helper function to get all child intents for a root intent
  const getChildIntents = (rootIntentId: string): IntentBlock[] => {
    const children: IntentBlock[] = [];

    const collectChildren = (parentId: string) => {
      intentBlocks
        .filter((intent) => intent.parentId === parentId)
        .forEach((child) => {
          children.push(child); // Push the full IntentBlock object
          collectChildren(child.id); // Recursively collect nested children
        });
    };

    collectChildren(rootIntentId);
    return children;
  };

  return (
    <>
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          {rootIntents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No intent structure yet</p>
              <p className="text-sm mt-2">Create intent blocks to start writing</p>
            </div>
          ) : (
            rootIntents.map((intent) => {
              const writingBlock = intentToWritingMap.get(intent.id);
              if (!writingBlock) return null;

              const childIntents = getChildIntents(intent.id);

              return (
                <IntentEditor
                  key={intent.id}
                  intent={intent}
                  writingBlock={writingBlock}
                  roomId={roomId}
                  user={user}
                  childIntents={childIntents}
                  allIntents={intentBlocks}
                  onAlignmentChange={onAlignmentChange}
                  onHoverIntent={onHoverIntent}
                  writingBlocks={writingBlocks}
                  deleteWritingBlock={deleteWritingBlock}
                  updateIntentBlock={updateIntentBlock}
                  onRegisterYjsExporter={onRegisterYjsExporter}
                  onActiveWritingBlockChange={onActiveWritingBlockChange}
                  addHelpRequest={addHelpRequest}
                  onPreviewActive={onPreviewActive}
                  activePreview={activePreview}
                  previewSelectedOption={previewSelectedOption}
                />
              );
            })
          )}
        </div>
      </div>

    </>
  );
}
