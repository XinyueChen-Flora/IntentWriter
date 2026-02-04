"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import type { WritingBlock, IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, RefreshCw } from "lucide-react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/core/fonts/inter.css";
// @ts-ignore - side-effect CSS imports without module declarations
import "@blocknote/mantine/style.css";
import * as Y from "yjs";
import YPartyKitProvider from "y-partykit/provider";
import { Button } from "@/components/ui/button";
import { getUserColor } from "@/lib/getUserColor";

type RootIntentBlockNoteEditorProps = {
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
};


export default function RootIntentBlockNoteEditor({
  intent,
  writingBlock,
  roomId,
  user,
  writingBlocks,
  deleteWritingBlock,
  updateIntentBlock,
  onRegisterYjsExporter,
}: RootIntentBlockNoteEditorProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);

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
    setHasError(false);
    setErrorMessage("");
    setResetKey(prev => prev + 1);
  }, [provider]);

  if (hasError) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
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
    <div className="flex flex-col h-full">
      {/* BlockNote Editor Container */}
      <div className="relative min-h-[200px] flex-1">
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
      </div>

      {/* Footer: last updated - only render on client to avoid hydration error */}
      <div className="mt-2 text-[10px] text-muted-foreground text-right">
        {mounted ? new Date(writingBlock.updatedAt).toLocaleTimeString() : '\u00A0'}
      </div>
    </div>
  );
}
