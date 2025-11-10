"use client";

import { useRouter } from "next/navigation";
import { useRoom, type IntentBlock, type WritingBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import WritingEditor, { type AlignmentResult } from "./WritingEditor";
import IntentPanel from "../intent/IntentPanel";
import SharedRulesPanel from "../intent/SharedRulesPanel";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { parseMarkdownToIntentsAdvanced } from "@/lib/markdownParser";

type CollaborativeEditorProps = {
  roomId: string;
  user: User;
  documentTitle: string;
};

export default function CollaborativeEditor({
  roomId,
  user,
  documentTitle,
}: CollaborativeEditorProps) {
  const router = useRouter();
  const [selectedWritingBlockId, setSelectedWritingBlockId] = useState<string | null>(null);
  const [selectedIntentBlockId, setSelectedIntentBlockId] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [panelWidth, setPanelWidth] = useState(384); // 96 * 4 = 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);
  const [alignmentResults, setAlignmentResults] = useState<Map<string, AlignmentResult>>(new Map());
  const [hoveredIntentId, setHoveredIntentId] = useState<string | null>(null);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null); // Currently editing intent
  const [isRestoring, setIsRestoring] = useState(false);
  const [yjsExporters, setYjsExporters] = useState<Map<string, () => Uint8Array>>(new Map());
  const [shouldRemindBackup, setShouldRemindBackup] = useState(false);
  const [timeSinceLastBackup, setTimeSinceLastBackup] = useState<number>(0);

  const {
    state,
    isConnected,
    onlineUsers,
    updateIntentBlock: updateIntentBlockRaw,
    addIntentBlock: addIntentBlockRaw,
    deleteIntentBlock: deleteIntentBlockRaw,
    addWritingBlock: addWritingBlockRaw,
    updateWritingBlock: updateWritingBlockRaw,
    deleteWritingBlock: deleteWritingBlockRaw,
    addRuleBlock,
    updateRuleBlock,
    deleteRuleBlock,
  } = useRoom(roomId, user);

  const writingBlocks = state.writingBlocks;
  const intentBlocks = state.intentBlocks;
  const ruleBlocks = state.ruleBlocks;

  // Load alignment results from WritingBlocks when they change
  useEffect(() => {
    const newResults = new Map<string, AlignmentResult>();
    writingBlocks.forEach(wb => {
      if (wb.linkedIntentId && wb.alignmentResult) {
        newResults.set(wb.linkedIntentId, wb.alignmentResult);
      }
    });
    setAlignmentResults(newResults);
  }, [writingBlocks]);

  // Auto-restore from Supabase if PartyKit state is empty (dev mode restart)
  useEffect(() => {
    // Temporarily disabled to prevent "Position out of range" errors
    // The issue: Restoring writingBlock metadata without Yjs document content
    // causes BlockNote to fail when trying to render non-existent positions
    //
    // TODO: Implement full Yjs state backup/restore to enable this feature
    // For now: Keep PartyKit server running to avoid data loss
    return;

    const attemptRestore = async () => {
      // Only restore if connected and state is empty
      if (!isConnected) return;
      if (intentBlocks.length > 0 || writingBlocks.length > 0) return;

      console.log('[Restore] Attempting to restore from Supabase backup...');
      setIsRestoring(true);

      try {
        const response = await fetch('/api/restore-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: roomId }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[Restore] Found backup:', result);

          // Restore intent blocks
          if (result.backup.intentBlocks && result.backup.intentBlocks.length > 0) {
            result.backup.intentBlocks.forEach((block: any) => {
              addIntentBlockRaw(block);
            });
          }

          // Restore writing blocks
          if (result.backup.writingBlocks && result.backup.writingBlocks.length > 0) {
            result.backup.writingBlocks.forEach((block: any) => {
              addWritingBlockRaw(block);
            });
          }

          console.log('[Restore] Successfully restored from backup');
        } else {
          console.log('[Restore] No backup found or error:', await response.text());
        }
      } catch (error) {
        console.error('[Restore] Error:', error);
      } finally {
        setIsRestoring(false);
      }
    };

    // Wait a bit for initial sync, then attempt restore if needed
    const timer = setTimeout(attemptRestore, 2000);
    return () => clearTimeout(timer);
  }, [isConnected, intentBlocks.length, writingBlocks.length, roomId, addIntentBlockRaw, addWritingBlockRaw]);

  // Callback to register Yjs exporters from WritingEditor
  const handleRegisterYjsExporter = useCallback((blockId: string, exporter: () => Uint8Array) => {
    setYjsExporters((prev) => {
      const newMap = new Map(prev);
      newMap.set(blockId, exporter);
      return newMap;
    });
  }, []);

  // Manual backup to Supabase with full Yjs snapshots
  const backupToSupabase = useCallback(async () => {
    if (isBackingUp) return; // Prevent concurrent backups

    setIsBackingUp(true);
    try {
      console.log(`[Backup] Starting manual backup for document ${roomId}`);
      console.log(`[Backup] Found ${yjsExporters.size} Yjs documents to export`);

      // Collect all Yjs snapshots
      const yjsSnapshots: Record<string, number[]> = {};
      yjsExporters.forEach((exporter, blockId) => {
        try {
          const snapshot = exporter();
          yjsSnapshots[blockId] = Array.from(snapshot); // Convert Uint8Array to number[]
          console.log(`[Backup] Exported Yjs snapshot for block ${blockId}: ${snapshot.length} bytes`);
        } catch (error) {
          console.error(`[Backup] Failed to export Yjs snapshot for block ${blockId}:`, error);
        }
      });

      const response = await fetch('/api/backup-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: roomId,
          intentBlocks,
          writingBlocks,
          yjsSnapshots,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastBackup(new Date(result.backedUpAt));
        setShouldRemindBackup(false); // Reset reminder after successful backup
        console.log(`[Backup] Success:`, result);
        // Success is shown via the "Saved Xs ago" indicator, no need for alert
      } else {
        const errorText = await response.text();
        console.error('[Backup] Failed:', errorText);
        // Only alert on error, not success
        alert(`Backup failed: ${errorText}`);
      }
    } catch (error) {
      console.error('[Backup] Error:', error);
      alert(`Backup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [roomId, intentBlocks, writingBlocks, yjsExporters, isBackingUp]);

  // Setup auto-backup interval
  useEffect(() => {
    // Temporarily disabled until Supabase RLS is fixed
    return;

    if (!isConnected) return;

    // Initial backup after 5 seconds
    const initialTimeout = setTimeout(() => {
      backupToSupabase();
    }, 5000);

    // Then every 30 seconds
    const interval = setInterval(() => {
      backupToSupabase();
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isConnected, backupToSupabase]);

  // Check if user should be reminded to backup
  useEffect(() => {
    if (!isConnected) return;

    const checkBackupReminder = () => {
      const now = Date.now();
      const timeSince = lastBackup ? now - lastBackup.getTime() : now;
      const timeInSeconds = Math.floor(timeSince / 1000);

      setTimeSinceLastBackup(timeInSeconds);

      // Remind after 5 minutes (300 seconds) without backup
      const REMINDER_THRESHOLD = 300;
      if (timeInSeconds > REMINDER_THRESHOLD) {
        setShouldRemindBackup(true);
      }
    };

    // Check immediately
    checkBackupReminder();

    // Then check every 30 seconds
    const interval = setInterval(checkBackupReminder, 30000);

    return () => clearInterval(interval);
  }, [isConnected, lastBackup]);

  // Add writing block
  const addWritingBlock = useCallback(() => {
    // Calculate safe position
    let maxPosition = -1;
    if (writingBlocks.length > 0) {
      const positions = writingBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
      if (positions.length > 0) {
        maxPosition = Math.max(...positions);
      }
    }

    const newBlock: WritingBlock = {
      id: `writing-${Date.now()}-${Math.random()}`,
      content: "",
      position: maxPosition + 1,
      linkedIntentId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addWritingBlockRaw(newBlock);
    return newBlock;
  }, [writingBlocks, addWritingBlockRaw]);

  // Update writing block (not used in new BlockNote version, but kept for compatibility)
  const updateWritingBlock = useCallback(
    (blockId: string, content: string) => {
      // BlockNote handles its own content sync via Yjs
      // This is only for metadata updates if needed
    },
    []
  );

  // Delete writing block
  const deleteWritingBlock = useCallback(
    (blockId: string) => {
      deleteWritingBlockRaw(blockId);
    },
    [deleteWritingBlockRaw]
  );

  // Ensure writing blocks for root intents only
  const ensureWritingBlocksForIntents = useCallback(() => {
    const rootIntents = intentBlocks.filter((intent) => !intent.parentId);
    const existingLinkedIntents = new Set(
      writingBlocks
        .filter((wb) => wb.linkedIntentId)
        .map((wb) => wb.linkedIntentId)
    );

    // Calculate safe max position
    let maxPosition = -1;
    if (writingBlocks.length > 0) {
      const positions = writingBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
      if (positions.length > 0) {
        maxPosition = Math.max(...positions);
      }
    }

    rootIntents.forEach((intent) => {
      if (!existingLinkedIntents.has(intent.id)) {
        maxPosition++;
        const newWritingBlock: WritingBlock = {
          id: `writing-${Date.now()}-${Math.random()}`,
          content: "",
          position: maxPosition,
          linkedIntentId: intent.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addWritingBlockRaw(newWritingBlock);
      }
    });
  }, [intentBlocks, writingBlocks, addWritingBlockRaw]);

  // Add intent block
  const addIntentBlock = useCallback((options?: {
    afterBlockId?: string;
    beforeBlockId?: string;
    asChildOf?: string;
  }) => {
    let targetPosition: number;
    let parentId: string | null = null;
    let level = 0;

    if (options?.asChildOf) {
      // Add as child of specified block
      const parentBlock = intentBlocks.find(b => b.id === options.asChildOf);
      if (parentBlock) {
        parentId = parentBlock.id;
        level = parentBlock.level + 1;
        // Find the last child of this parent, or use parent position
        const siblings = intentBlocks.filter(b => b.parentId === parentId);
        if (siblings.length > 0) {
          const maxSiblingPosition = Math.max(...siblings.map(b => b.position));
          targetPosition = maxSiblingPosition + 1;
        } else {
          targetPosition = parentBlock.position + 0.5;
        }
      } else {
        targetPosition = intentBlocks.length;
      }
    } else if (options?.afterBlockId) {
      // Insert after specified block
      const afterBlock = intentBlocks.find(b => b.id === options.afterBlockId);
      if (afterBlock) {
        parentId = afterBlock.parentId;
        level = afterBlock.level;
        targetPosition = afterBlock.position + 0.5;
      } else {
        targetPosition = intentBlocks.length;
      }
    } else if (options?.beforeBlockId) {
      // Insert before specified block
      const beforeBlock = intentBlocks.find(b => b.id === options.beforeBlockId);
      if (beforeBlock) {
        parentId = beforeBlock.parentId;
        level = beforeBlock.level;
        targetPosition = beforeBlock.position - 0.5;
      } else {
        targetPosition = 0;
      }
    } else {
      // Default: add at the end
      let maxPosition = -1;
      if (intentBlocks.length > 0) {
        const positions = intentBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
        if (positions.length > 0) {
          maxPosition = Math.max(...positions);
        }
      }
      targetPosition = maxPosition + 1;
    }

    const newBlock: IntentBlock = {
      id: `intent-${Date.now()}-${Math.random()}`,
      content: "",
      position: targetPosition,
      linkedWritingIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId,
      level,
      intentTag: undefined,
      intentCreatedBy: undefined,
      intentCreatedAt: undefined,
      isCollapsed: false,
      assignee: undefined,
    };
    addIntentBlockRaw(newBlock);

    // Reorder positions to ensure they're sequential
    setTimeout(() => {
      const sortedBlocks = [...intentBlocks, newBlock].sort((a, b) => a.position - b.position);
      sortedBlocks.forEach((block, index) => {
        if (block.position !== index) {
          updateIntentBlockRaw(block.id, { position: index });
        }
      });
    }, 100);

    return newBlock;
  }, [intentBlocks, addIntentBlockRaw, updateIntentBlockRaw]);

  // Update intent block content
  const updateIntentBlock = useCallback(
    (blockId: string, content: string) => {
      updateIntentBlockRaw(blockId, {
        content,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Update intent tag
  const updateIntentTag = useCallback(
    (blockId: string, intentTag: string, userId: string) => {
      const existingBlock = intentBlocks.find((b) => b.id === blockId);
      if (!existingBlock) return;

      const now = Date.now();
      const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || undefined;
      const userEmail = user.email || undefined;

      updateIntentBlockRaw(blockId, {
        intentTag: intentTag || undefined,
        intentCreatedBy: existingBlock.intentCreatedBy || userId,
        intentCreatedByName: existingBlock.intentCreatedByName || userName,
        intentCreatedByEmail: existingBlock.intentCreatedByEmail || userEmail,
        intentCreatedAt: existingBlock.intentCreatedAt || now,
        updatedAt: now,
      });
    },
    [intentBlocks, user, updateIntentBlockRaw]
  );

  // Delete intent tag
  const deleteIntentTag = useCallback(
    (blockId: string) => {
      updateIntentBlockRaw(blockId, {
        intentTag: undefined,
        intentCreatedBy: undefined,
        intentCreatedByName: undefined,
        intentCreatedByEmail: undefined,
        intentCreatedAt: undefined,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Assign block to user
  const assignBlock = useCallback(
    (blockId: string, userId: string) => {
      const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || undefined;
      const userEmail = user.email || undefined;

      updateIntentBlockRaw(blockId, {
        assignee: userId,
        assigneeName: userName,
        assigneeEmail: userEmail,
        updatedAt: Date.now(),
      });
    },
    [user, updateIntentBlockRaw]
  );

  // Unassign block
  const unassignBlock = useCallback(
    (blockId: string) => {
      updateIntentBlockRaw(blockId, {
        assignee: undefined,
        assigneeName: undefined,
        assigneeEmail: undefined,
        updatedAt: Date.now(),
      });
    },
    [updateIntentBlockRaw]
  );

  // Delete intent block
  const deleteIntentBlock = useCallback(
    (blockId: string) => {
      deleteIntentBlockRaw(blockId);
    },
    [deleteIntentBlockRaw]
  );

  // Indent block (increase level, make it a child of previous block)
  const indentBlock = useCallback(
    (blockId: string) => {
      const blockIndex = intentBlocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return; // Can't indent first block

      const currentBlock = intentBlocks[blockIndex];
      const wasRoot = currentBlock.level === 0 && !currentBlock.parentId;

      // Find the previous sibling or uncle block at the same or higher level
      let newParentId: string | null = null;
      for (let i = blockIndex - 1; i >= 0; i--) {
        const prevBlock = intentBlocks[i];
        if (prevBlock.level === currentBlock.level) {
          // Found a sibling, make current block its child
          newParentId = prevBlock.id;
          break;
        } else if (prevBlock.level < currentBlock.level) {
          // Found a higher level block, stop
          break;
        }
      }

      if (newParentId) {
        // If this was a root block, it has a writing block that needs to be merged
        if (wasRoot) {
          const writingBlock = writingBlocks.find((wb) => wb.linkedIntentId === blockId);

          if (writingBlock) {
            // Find the root ancestor of the new parent
            let rootParentId = newParentId;
            let parentBlock = intentBlocks.find((b) => b.id === newParentId);

            while (parentBlock && parentBlock.parentId) {
              rootParentId = parentBlock.parentId;
              parentBlock = intentBlocks.find((b) => b.id === rootParentId);
            }

            // Mark the root parent to merge content from this writing block
            updateIntentBlockRaw(rootParentId, {
              mergeWritingFrom: writingBlock.id,
              updatedAt: Date.now(),
            });
          }
        }

        updateIntentBlockRaw(blockId, {
          level: currentBlock.level + 1,
          parentId: newParentId,
          updatedAt: Date.now(),
        });
      }
    },
    [intentBlocks, writingBlocks, updateIntentBlockRaw]
  );

  // Outdent block (decrease level, move up in hierarchy)
  const outdentBlock = useCallback(
    (blockId: string) => {
      const currentBlock = intentBlocks.find((b) => b.id === blockId);
      if (!currentBlock || currentBlock.level === 0) return; // Already at root level

      // Find the new parent (parent's parent)
      let newParentId: string | null = null;
      if (currentBlock.parentId) {
        const parentBlock = intentBlocks.find((b) => b.id === currentBlock.parentId);
        if (parentBlock) {
          newParentId = parentBlock.parentId;
        }
      }

      updateIntentBlockRaw(blockId, {
        level: currentBlock.level - 1,
        parentId: newParentId,
        updatedAt: Date.now(),
      });
    },
    [intentBlocks, updateIntentBlockRaw]
  );

  // Reorder blocks (for drag and drop)
  const reorderBlocks = useCallback(
    (draggedId: string, targetId: string, position: 'before' | 'after') => {
      const draggedBlock = intentBlocks.find((b) => b.id === draggedId);
      const targetBlock = intentBlocks.find((b) => b.id === targetId);

      if (!draggedBlock || !targetBlock) return;

      // Don't allow dragging a parent into its own child
      let current = targetBlock;
      while (current.parentId) {
        if (current.parentId === draggedId) return;
        current = intentBlocks.find((b) => b.id === current.parentId)!;
        if (!current) break;
      }

      // Calculate new position
      let newPosition: number;
      if (position === 'before') {
        newPosition = targetBlock.position - 0.5;
      } else {
        newPosition = targetBlock.position + 0.5;
      }

      // Update the dragged block's position and parent
      updateIntentBlockRaw(draggedId, {
        position: newPosition,
        parentId: targetBlock.parentId,
        level: targetBlock.level,
        updatedAt: Date.now(),
      });

      // Reorder all blocks to have sequential positions
      setTimeout(() => {
        const sortedBlocks = [...intentBlocks].sort((a, b) => a.position - b.position);
        sortedBlocks.forEach((block, index) => {
          if (block.position !== index) {
            updateIntentBlockRaw(block.id, { position: index });
          }
        });
      }, 100);
    },
    [intentBlocks, updateIntentBlockRaw]
  );

  // Handle alignment result changes
  const handleAlignmentChange = useCallback((intentId: string, result: AlignmentResult | null) => {
    setAlignmentResults((prev) => {
      const next = new Map(prev);
      if (result) {
        next.set(intentId, result);
      } else {
        next.delete(intentId);
      }
      return next;
    });

    // Also save to WritingBlock so all users can see the alignment status
    const writingBlock = writingBlocks.find(wb => wb.linkedIntentId === intentId);
    if (writingBlock && updateWritingBlockRaw) {
      updateWritingBlockRaw(writingBlock.id, { alignmentResult: result });
    }
  }, [writingBlocks, updateWritingBlockRaw]);

  // Handle hover on intent or sentence
  const handleHoverIntent = useCallback((intentId: string | null) => {
    setHoveredIntentId(intentId);
  }, []);

  // Handle panel resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(300, Math.min(800, newWidth))); // Min 300px, max 800px
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Generate consistent color for user based on userId
  const getUserColor = useCallback((userId: string) => {
    // Simple hash function for consistent colors
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
  }, []);

  // Import markdown intents
  const importMarkdownIntents = useCallback(
    (markdown: string) => {
      const parsedNodes = parseMarkdownToIntentsAdvanced(markdown);

      // Create a map to track node index -> actual ID
      const idMap = new Map<number, string>();

      // Calculate safe starting position
      let maxPosition = -1;
      if (intentBlocks.length > 0) {
        const positions = intentBlocks.map(b => b.position).filter(p => typeof p === 'number' && !isNaN(p));
        if (positions.length > 0) {
          maxPosition = Math.max(...positions);
        }
      }

      const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || undefined;
      const userEmail = user.email || undefined;

      // Add all blocks and build the ID map
      parsedNodes.forEach((node, nodeIndex) => {
        const newId = `intent-${Date.now()}-${Math.random()}-${nodeIndex}`;
        idMap.set(nodeIndex, newId);

        // Determine real parent ID
        let realParentId: string | null = null;
        if (node.parentId) {
          const parentMatch = node.parentId.match(/temp-(\d+)/);
          if (parentMatch) {
            const parentIndex = parseInt(parentMatch[1], 10);
            realParentId = idMap.get(parentIndex) || null;
          }
        }

        const newBlock: IntentBlock = {
          id: newId,
          content: node.content,
          position: maxPosition + 1 + nodeIndex,
          linkedWritingIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          parentId: realParentId,
          level: node.level,
          intentTag: node.intentTag,
          intentCreatedBy: node.intentTag ? user.id : undefined,
          intentCreatedByName: node.intentTag ? userName : undefined,
          intentCreatedByEmail: node.intentTag ? userEmail : undefined,
          intentCreatedAt: node.intentTag ? Date.now() : undefined,
          isCollapsed: false,
          assignee: undefined,
        };

        addIntentBlockRaw(newBlock);
      });
    },
    [intentBlocks, user, addIntentBlockRaw]
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              ← Back
            </Button>
            <h1 className="text-xl font-bold">{documentTitle}</h1>

            {/* Online Users Display */}
            {onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <div className="flex -space-x-2">
                  {onlineUsers.slice(0, 5).map((onlineUser) => {
                    const initials = onlineUser.userName.substring(0, 2).toUpperCase();
                    const isCurrentUser = onlineUser.userId === user.id;

                    return (
                      <div
                        key={onlineUser.connectionId}
                        className={`h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white border-2 border-background ${
                          isCurrentUser ? 'ring-2 ring-primary' : ''
                        }`}
                        style={!onlineUser.avatarUrl ? { backgroundColor: getUserColor(onlineUser.userId) } : undefined}
                        title={`${onlineUser.userName}${isCurrentUser ? ' (You)' : ''}`}
                      >
                        {onlineUser.avatarUrl ? (
                          <img
                            src={onlineUser.avatarUrl}
                            alt={onlineUser.userName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                    );
                  })}
                  {onlineUsers.length > 5 && (
                    <div
                      className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background"
                      title={`${onlineUsers.length - 5} more user${onlineUsers.length - 5 === 1 ? '' : 's'}`}
                    >
                      +{onlineUsers.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'} online
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              {shouldRemindBackup && !isBackingUp && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                  💾 Consider saving your work
                </p>
              )}
              <Button
                variant={shouldRemindBackup ? "default" : "default"}
                size="sm"
                onClick={backupToSupabase}
                disabled={isBackingUp || !isConnected}
                title="Manually save document to Supabase (includes all Yjs content)"
                className={shouldRemindBackup ? "ring-2 ring-amber-400 ring-offset-2" : ""}
              >
                {isBackingUp ? "Saving..." : "Save Backup"}
              </Button>
            </div>
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            />
            {isRestoring && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-xs text-muted-foreground">Restoring from backup...</p>
              </div>
            )}
            {isBackingUp ? (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs text-muted-foreground">Backing up...</p>
              </div>
            ) : lastBackup ? (
              <p className="text-xs text-muted-foreground">
                Saved {Math.floor((Date.now() - lastBackup.getTime()) / 1000)}s ago
              </p>
            ) : shouldRemindBackup ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No backup yet ({Math.floor(timeSinceLastBackup / 60)}m)
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden border-r flex flex-col">
          <WritingEditor
            roomId={roomId}
            writingBlocks={writingBlocks}
            intentBlocks={intentBlocks}
            ensureWritingBlocksForIntents={ensureWritingBlocksForIntents}
            user={user}
            onAlignmentChange={handleAlignmentChange}
            hoveredIntentId={hoveredIntentId}
            onHoverIntent={handleHoverIntent}
            deleteWritingBlock={deleteWritingBlock}
            updateIntentBlock={updateIntentBlockRaw}
            onRegisterYjsExporter={handleRegisterYjsExporter}
            onActiveWritingBlockChange={setActiveIntentId}
          />
        </div>

        {/* Resize Handle */}
        <div
          className={`w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors ${
            isResizing ? 'bg-primary' : ''
          }`}
          onMouseDown={handleMouseDown}
        />

        <div
          className="flex flex-row bg-muted/30 overflow-hidden"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Intent Panel - Left side (60% width) */}
          <div className="flex-[3] border-r overflow-hidden min-w-0">
            <IntentPanel
              blocks={intentBlocks}
              addBlock={addIntentBlock}
              updateBlock={updateIntentBlock}
              updateIntentTag={updateIntentTag}
              deleteIntentTag={deleteIntentTag}
              assignBlock={assignBlock}
              unassignBlock={unassignBlock}
              deleteBlock={deleteIntentBlock}
              indentBlock={indentBlock}
              outdentBlock={outdentBlock}
              reorderBlocks={reorderBlocks}
              selectedBlockId={selectedIntentBlockId}
              setSelectedBlockId={setSelectedIntentBlockId}
              writingBlocks={writingBlocks}
              importMarkdown={importMarkdownIntents}
              currentUser={user}
              alignmentResults={alignmentResults}
              hoveredIntentId={hoveredIntentId}
              onHoverIntent={handleHoverIntent}
              activeIntentId={activeIntentId}
            />
          </div>

          {/* Shared Rules Panel - Right side (40% width) */}
          <div className="flex-[2] overflow-hidden min-w-0">
            <SharedRulesPanel
              rules={ruleBlocks}
              addRule={addRuleBlock}
              updateRule={updateRuleBlock}
              deleteRule={deleteRuleBlock}
              currentUser={user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
