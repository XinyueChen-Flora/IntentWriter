"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import type { WritingBlock, IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lightbulb, AlertCircle, RefreshCw } from "lucide-react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/core/fonts/inter.css";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { Button } from "@/components/ui/button";

export type AlignmentResult = {
  intentId: string;
  aligned: boolean;
  alignmentScore: number;
  sentences: Array<{
    text: string;
    status: "aligned" | "not-aligned" | "extra";
    mappedIntentId: string | null; // The actual intent ID this sentence maps to
    mappedIntentDescription: string;
    note: string;
  }>;
  intentStatus: {
    main: "covered" | "partial" | "missing";
    subIntents: Array<{
      index: number;
      status: "covered" | "partial" | "missing";
    }>;
  };
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

// Individual BlockNote editor for each root intent
function IntentEditor({
  intent,
  writingBlock,
  roomId,
  user,
  childIntents,
  onAlignmentChange,
  hoveredIntentId,
  onHoverIntent,
  writingBlocks,
  deleteWritingBlock,
  updateIntentBlock,
  onRegisterYjsExporter,
}: {
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  childIntents: IntentBlock[];
  onAlignmentChange?: (intentId: string, result: AlignmentResult | null) => void;
  hoveredIntentId?: string | null;
  onHoverIntent?: (intentId: string | null) => void;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
}) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);
  const [isCheckingAlignment, setIsCheckingAlignment] = useState(false);
  const [lastCheckedContent, setLastCheckedContent] = useState("");
  const [alignmentResult, setAlignmentResult] = useState<any>(null);

  const doc = useMemo(() => new Y.Doc(), [resetKey]);
  const [isSynced, setIsSynced] = useState(false);

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
        console.error("Failed to create YPartyKitProvider:", error);
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
        let sourceBlockGroup: Y.XmlElement<{[key: string]: string}> | null = null;
        let targetBlockGroup: Y.XmlElement<{[key: string]: string}> | null = null;

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
        if (sourceBlockGroup && targetBlockGroup && sourceBlockGroup.length > 0) {
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
            sourceBlockGroup!.forEach((element) => {
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

  // Apply background colors to text based on alignment results
  const applyAlignmentStyles = useCallback((result: any) => {
    if (!editor) return;

    try {
      // Get all blocks from editor
      const blocks = editor.document;

      // Build full text content to find sentence positions
      let currentPos = 0;
      const blockPositions: Array<{ block: any; start: number; end: number; text: string }> = [];

      blocks.forEach((block: any) => {
        if (block.type === 'paragraph' && block.content) {
          const text = block.content.map((c: any) => c.text || '').join('');
          if (text) {
            blockPositions.push({
              block: block,
              start: currentPos,
              end: currentPos + text.length,
              text: text,
            });
            currentPos += text.length + 1; // +1 for newline
          }
        }
      });

      // For each sentence in alignment result, find its position and apply color
      result.sentences.forEach((sentence: any) => {
        const sentenceText = sentence.text.trim();

        // Find which block(s) contain this sentence
        blockPositions.forEach((blockPos) => {
          const sentenceIndex = blockPos.text.indexOf(sentenceText);
          if (sentenceIndex !== -1) {
            // Found the sentence in this block
            const backgroundColor =
              sentence.status === 'aligned' ? '#d1fae5' : // green-100
              sentence.status === 'not-aligned' ? '#fef3c7' : // yellow-100
              '#dbeafe'; // blue-100

            const block = blockPos.block;
            if (block && block.content) {
              // Apply backgroundColor to the matching text range
              const updatedContent = block.content.map((inline: any, idx: number) => {
                const inlineText = inline.text || '';
                const inlineStart = block.content.slice(0, idx).reduce((sum: number, c: any) => sum + (c.text?.length || 0), 0);
                const inlineEnd = inlineStart + inlineText.length;

                // Check if this inline content overlaps with the sentence
                const sentenceStart = sentenceIndex;
                const sentenceEnd = sentenceIndex + sentenceText.length;

                if (inlineEnd > sentenceStart && inlineStart < sentenceEnd) {
                  // This inline content is part of the sentence
                  return {
                    ...inline,
                    styles: {
                      ...inline.styles,
                      backgroundColor: backgroundColor,
                    },
                  };
                }
                return inline;
              });

              // Use replaceBlocks to update the block
              const newBlock = {
                ...block,
                content: updatedContent,
              };

              editor.replaceBlocks([block.id], [newBlock]);
            }
          }
        });
      });
    } catch (error) {
      // Silent fail
    }
  }, [editor]);

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

        // Store alignment result for rendering
        setAlignmentResult(result);

        // Apply background colors to editor text
        applyAlignmentStyles(result);

        // Notify parent of alignment change
        if (onAlignmentChange) {
          onAlignmentChange(intent.id, {
            intentId: intent.id,
            aligned: result.aligned,
            alignmentScore: result.alignmentScore,
            sentences: result.sentences,
            intentStatus: result.intentStatus,
          });
        }

      }
    } catch (error) {
      // Silent fail for alignment check
    } finally {
      setIsCheckingAlignment(false);
    }
  }, [intent, user.id, roomId, lastCheckedContent, onAlignmentChange, applyAlignmentStyles, editor]);

  // Monitor editor changes for paragraph completion
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Get editor content as markdown
      try {
        const blocks = editor.document;
        const content = blocks.map((block: any) => {
          if (block.type === 'paragraph' && block.content) {
            return block.content.map((c: any) => c.text || '').join('') || '';
          }
          return '';
        }).join('\n\n').trim();

        // Detect paragraph completion: content ends with double newline or has substantial content
        if (content.length > 100 && content !== lastCheckedContent) {
          // Debounce: wait 3 seconds after typing stops
          const timeout = setTimeout(() => {
            checkAlignment(content);
          }, 3000);

          return () => clearTimeout(timeout);
        }
      } catch (error) {
        console.error('[Alignment] Error reading editor content:', error);
      }
    };

    // Listen to editor changes
    try {
      const unsubscribe = editor.onChange(handleUpdate);
      return unsubscribe;
    } catch (error) {
      console.error('[Alignment] Error setting up onChange listener:', error);
    }
  }, [editor, checkAlignment, lastCheckedContent]);



  // Error boundary for BlockNote
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMsg = event.message || "";

      // Check for position errors
      if (errorMsg.includes("Position") && errorMsg.includes("out of range")) {
        setHasError(true);
        setErrorMessage(`Document corrupted: ${errorMsg}`);
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
        setHasError(true);
        setErrorMessage(`Async error: ${reason}`);
        event.preventDefault();
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
    <div className="border-l-4 border-border hover:border-primary/50 bg-card pl-4 py-3 transition-colors">
      {/* Intent Title */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex-1 prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {intent.content}
          </ReactMarkdown>
        </div>
        {/* Show assignee if exists */}
        {intent.assignee && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md">
            <span className="text-xs text-muted-foreground">Assignee:</span>
            <span className="text-xs font-medium">
              {intent.assignee === user.id
                ? 'You'
                : intent.assigneeName || intent.assigneeEmail?.split('@')[0] || 'User'}
            </span>
          </div>
        )}
      </div>

      {/* Intent Tag (if exists) */}
      {intent.intentTag && (
        <div className="mb-3 flex items-start gap-1.5 text-xs">
          <Lightbulb className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="prose prose-xs text-amber-900 dark:text-amber-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {intent.intentTag}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Alignment Check Status */}
      {isCheckingAlignment && (
        <div className="mb-3 p-2 bg-muted/30 rounded-md border flex items-center gap-2 text-xs text-blue-600">
          <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Analyzing alignment...</span>
        </div>
      )}

      {/* BlockNote Editor */}
      <div className="blocknote-editor-wrapper">
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
      </div>

      {/* Sentence-Intent Mapping Bar */}
      {alignmentResult && alignmentResult.sentences && alignmentResult.sentences.length > 0 && (
        <div className="mt-3 p-3 bg-muted/30 rounded-md border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Sentence-Intent Mapping:</h4>
          <div className="space-y-1.5">
            {alignmentResult.sentences.map((sentence: any, idx: number) => {
              const isThisIntentHovered = hoveredIntentId && sentence.mappedIntentId === hoveredIntentId;
              const bgColor =
                sentence.status === 'aligned' ? 'bg-green-100 dark:bg-green-950/30 border-green-300' :
                sentence.status === 'not-aligned' ? 'bg-yellow-100 dark:bg-yellow-950/30 border-yellow-300' :
                'bg-blue-100 dark:bg-blue-950/30 border-blue-300';

              const hoverRing = isThisIntentHovered ? 'ring-2 ring-primary shadow-md' : '';

              return (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded border ${bgColor} ${hoverRing} transition-all cursor-pointer`}
                  onMouseEnter={() => {
                    if (onHoverIntent && sentence.mappedIntentId) {
                      onHoverIntent(sentence.mappedIntentId);
                    }
                  }}
                  onMouseLeave={() => {
                    if (onHoverIntent) {
                      onHoverIntent(null);
                    }
                  }}
                >
                  <span className="font-medium">{sentence.text}</span>
                  <span className="ml-2 opacity-60">
                    → {sentence.status === 'aligned' ? `✓ ${sentence.mappedIntentDescription}` : sentence.status === 'not-aligned' ? '⚠ Not aligned' : '💡 Extra content'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: last updated - only render on client to avoid hydration error */}
      <div className="mt-2 text-[10px] text-muted-foreground text-right">
        {mounted ? new Date(writingBlock.updatedAt).toLocaleTimeString() : '\u00A0'}
      </div>
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
}: WritingEditorProps) {
  // Ensure we have writing blocks for all root-level intents
  useEffect(() => {
    ensureWritingBlocksForIntents();
  }, [intentBlocks, ensureWritingBlocksForIntents]);

  // Get root-level intents only
  const rootIntents = intentBlocks.filter((intent) => !intent.parentId);

  // Create a map of intentId -> writingBlock
  const intentToWritingMap = new Map<string, WritingBlock>();
  writingBlocks.forEach((block) => {
    if (block.linkedIntentId) {
      intentToWritingMap.set(block.linkedIntentId, block);
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
                onAlignmentChange={onAlignmentChange}
                hoveredIntentId={hoveredIntentId}
                onHoverIntent={onHoverIntent}
                writingBlocks={writingBlocks}
                deleteWritingBlock={deleteWritingBlock}
                updateIntentBlock={updateIntentBlock}
                onRegisterYjsExporter={onRegisterYjsExporter}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
