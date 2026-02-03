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
import type { ImpactPreview, HelpRequest } from "@/lib/partykit";

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
  const [selectedIntentBlockId, setSelectedIntentBlockId] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  // Right panel width: default to 50% of screen (Writing 1/2, Intent 1/4, Rules 1/4)
  const [panelWidth, setPanelWidth] = useState(720); // SSR-safe default
  const [isResizing, setIsResizing] = useState(false);
  const [alignmentResults, setAlignmentResults] = useState<Map<string, AlignmentResult>>(new Map());
  const [hoveredIntentId, setHoveredIntentId] = useState<string | null>(null);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null); // Currently editing intent
  const [yjsExporters, setYjsExporters] = useState<Map<string, () => Uint8Array>>(new Map());
  const [shouldRemindBackup, setShouldRemindBackup] = useState(false);
  const [timeSinceLastBackup, setTimeSinceLastBackup] = useState<number>(0);

  // Local-only suggested intents (not synced to other users)
  // Map<intentId, AlignmentResult with FULL intentTree including suggestions>
  const [localSuggestedIntents, setLocalSuggestedIntents] = useState<Map<string, AlignmentResult>>(new Map());

  // Preview state - for impact preview visualization
  const [activePreview, setActivePreview] = useState<ImpactPreview | null>(null);
  const [activeHelpRequest, setActiveHelpRequest] = useState<HelpRequest | null>(null);
  const [previewSelectedOption, setPreviewSelectedOption] = useState<"A" | "B" | null>(null);

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
    addHelpRequest,
    updateHelpRequest,
  } = useRoom(roomId, user);

  const writingBlocks = state.writingBlocks;
  const intentBlocks = state.intentBlocks;
  const ruleBlocks = state.ruleBlocks;

  // Set initial panel width to 50% of screen on client side
  useEffect(() => {
    setPanelWidth(Math.floor(window.innerWidth / 2));
  }, []);

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
    if (isBackingUp) return;

    setIsBackingUp(true);
    try {
      // Collect all Yjs snapshots
      const yjsSnapshots: Record<string, number[]> = {};
      yjsExporters.forEach((exporter, blockId) => {
        try {
          const snapshot = exporter();
          yjsSnapshots[blockId] = Array.from(snapshot);
        } catch {
          // Silent fail for individual snapshot exports
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
        setShouldRemindBackup(false);
      } else {
        const errorText = await response.text();
        alert(`Backup failed: ${errorText}`);
      }
    } catch (error) {
      alert(`Backup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [roomId, intentBlocks, writingBlocks, yjsExporters, isBackingUp]);


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
      while (current?.parentId) {
        if (current.parentId === draggedId) return;
        current = intentBlocks.find((b) => b.id === current.parentId)!;
        if (!current) break;
      }

      // Get all siblings (blocks with same parentId as target)
      const parentId = targetBlock.parentId;
      const siblings = intentBlocks
        .filter((b) => b.parentId === parentId)
        .sort((a, b) => a.position - b.position);

      if (siblings.length === 0) return;

      // Check if dragged block is already in siblings
      const draggedInSiblings = siblings.some(b => b.id === draggedId);

      // Create new order by removing dragged block (if present) and inserting at new position
      const withoutDragged = draggedInSiblings
        ? siblings.filter((b) => b.id !== draggedId)
        : siblings;

      const targetIndex = withoutDragged.findIndex((b) => b.id === targetId);
      if (targetIndex === -1) return;

      let newOrder: IntentBlock[];
      if (position === 'before') {
        newOrder = [
          ...withoutDragged.slice(0, targetIndex),
          draggedBlock,
          ...withoutDragged.slice(targetIndex)
        ];
      } else {
        newOrder = [
          ...withoutDragged.slice(0, targetIndex + 1),
          draggedBlock,
          ...withoutDragged.slice(targetIndex + 1)
        ];
      }

      // Update all blocks in newOrder with sequential positions
      newOrder.forEach((block, index) => {
        const updates: Partial<IntentBlock> = {
          position: index,
          updatedAt: Date.now(),
        };

        // For the dragged block, also update parent and level
        if (block.id === draggedId) {
          updates.parentId = targetBlock.parentId;
          updates.level = targetBlock.level;
        }

        updateIntentBlockRaw(block.id, updates);
      });
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

      // Save FULL result (with suggested intents) to local-only state for Intent Panel
      if (result) {
        setLocalSuggestedIntents(prev => {
          const updated = new Map(prev);
          updated.set(intentId, result);
          return updated;
        });
      }
    }
  }, [writingBlocks, updateWritingBlockRaw]);

  // Handle hover on intent or sentence
  const handleHoverIntent = useCallback((intentId: string | null) => {
    setHoveredIntentId(intentId);
  }, []);

  // Handle preview activation from WritingEditor
  const handlePreviewActive = useCallback((preview: ImpactPreview | null, helpRequest: HelpRequest | null) => {
    setActivePreview(preview);
    setActiveHelpRequest(helpRequest);
    setPreviewSelectedOption(null);
  }, []);

  // Handle preview option selection
  const handlePreviewOptionSelect = useCallback((option: "A" | "B") => {
    setPreviewSelectedOption(option);
    // Update the help request with selected option
    if (activeHelpRequest) {
      updateHelpRequest(activeHelpRequest.id, { selectedOption: option });
    }
  }, [activeHelpRequest, updateHelpRequest]);

  // Handle "Ask Team" - share help request with team
  const handleAskTeam = useCallback(() => {
    if (activeHelpRequest) {
      updateHelpRequest(activeHelpRequest.id, { status: 'team' });
    }
  }, [activeHelpRequest, updateHelpRequest]);

  // Handle preview option change (A/B toggle)
  const handlePreviewOptionChange = useCallback((option: "A" | "B") => {
    setPreviewSelectedOption(option);
    if (activeHelpRequest) {
      updateHelpRequest(activeHelpRequest.id, { selectedOption: option });
    }
  }, [activeHelpRequest, updateHelpRequest]);

  // Clear preview
  const handleClearPreview = useCallback(() => {
    setActivePreview(null);
    setActiveHelpRequest(null);
    setPreviewSelectedOption(null);
  }, []);

  // Apply the selected preview option - update intent blocks with the changes
  const handleApplyPreview = useCallback((option: "A" | "B") => {
    if (!activePreview) return;

    const changes = option === "A"
      ? activePreview.optionA.intentChanges
      : activePreview.optionB.intentChanges;

    // Apply each change to the corresponding intent block
    changes?.forEach(change => {
      if (change.changeType === "modified" && change.previewText) {
        const intentBlock = intentBlocks.find(b => b.id === change.intentId);
        if (intentBlock) {
          updateIntentBlockRaw(change.intentId, {
            content: change.previewText,
            updatedAt: Date.now(),
          });
        }
      } else if (change.changeType === "added" && change.previewText) {
        // Add a new intent block
        const newBlock: IntentBlock = {
          id: `intent-${Date.now()}-${Math.random()}`,
          content: change.previewText,
          position: intentBlocks.length,
          linkedWritingIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          parentId: null,
          level: 0,
        };
        addIntentBlockRaw(newBlock);
      } else if (change.changeType === "removed") {
        deleteIntentBlockRaw(change.intentId);
      }
    });

    // Mark the help request as resolved
    if (activeHelpRequest) {
      updateHelpRequest(activeHelpRequest.id, {
        status: 'resolved',
        selectedOption: option,
      });
    }

    // Clear the preview
    handleClearPreview();
  }, [activePreview, activeHelpRequest, intentBlocks, updateIntentBlockRaw, addIntentBlockRaw, deleteIntentBlockRaw, updateHelpRequest, handleClearPreview]);

  // Handle starting a team discussion
  const handleStartTeamDiscussion = useCallback((discussion: {
    participationType: "vote" | "feedback" | "execute" | "tentative";
    myThoughts: string;
    selectedOption: "A" | "B" | null;
    requiredResponders: string[];
    optionalResponders: string[];
  }) => {
    if (!activeHelpRequest || !activePreview) return;

    // Update the help request with team discussion data
    updateHelpRequest(activeHelpRequest.id, {
      status: 'team',
      selectedOption: discussion.selectedOption || undefined,
      impactPreview: activePreview,
      teamDiscussion: {
        participationType: discussion.participationType,
        initiatorThoughts: discussion.myThoughts,
        selectedOption: discussion.selectedOption,
        requiredResponders: discussion.requiredResponders,
        optionalResponders: discussion.optionalResponders,
        responses: [],
      },
    });

    // Clear the local preview state (the discussion is now stored in the HelpRequest)
    handleClearPreview();
  }, [activeHelpRequest, activePreview, updateHelpRequest, handleClearPreview]);

  // Handle responding to a team discussion
  const handleRespondToDiscussion = useCallback((requestId: string, response: {
    vote?: "A" | "B";
    comment?: string;
  }) => {
    const helpRequest = state.helpRequests.find(hr => hr.id === requestId);
    if (!helpRequest || !helpRequest.teamDiscussion) return;

    // Prevent duplicate responses from the same user
    const alreadyResponded = helpRequest.teamDiscussion.responses?.some(r => r.userId === user.id);
    if (alreadyResponded) return;

    const newResponse = {
      userId: user.id,
      userName: user.user_metadata?.name || user.email?.split('@')[0],
      userEmail: user.email,
      vote: response.vote,
      comment: response.comment,
      respondedAt: Date.now(),
    };

    const updatedResponses = [
      ...(helpRequest.teamDiscussion.responses || []),
      newResponse,
    ];

    updateHelpRequest(requestId, {
      teamDiscussion: {
        ...helpRequest.teamDiscussion,
        responses: updatedResponses,
      },
    });
  }, [state.helpRequests, user, updateHelpRequest]);

  // Handle resolving a team discussion (initiator only)
  const handleResolveDiscussion = useCallback((requestId: string, option: "A" | "B") => {
    const helpRequest = state.helpRequests.find(hr => hr.id === requestId);
    if (!helpRequest || !helpRequest.teamDiscussion) return;
    if (helpRequest.createdBy !== user.id) return; // Only initiator can resolve

    // Apply the intent changes if there are any
    const preview = helpRequest.impactPreview;
    if (preview) {
      const changes = option === "A"
        ? preview.optionA.intentChanges
        : preview.optionB.intentChanges;

      changes?.forEach(change => {
        if (change.changeType === "modified" && change.previewText) {
          const intentBlock = intentBlocks.find(b => b.id === change.intentId);
          if (intentBlock) {
            updateIntentBlockRaw(change.intentId, {
              content: change.previewText,
              updatedAt: Date.now(),
            });
          }
        } else if (change.changeType === "added" && change.previewText) {
          const newBlock: IntentBlock = {
            id: `intent-${Date.now()}-${Math.random()}`,
            content: change.previewText,
            position: intentBlocks.length,
            linkedWritingIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            parentId: null,
            level: 0,
          };
          addIntentBlockRaw(newBlock);
        } else if (change.changeType === "removed") {
          deleteIntentBlockRaw(change.intentId);
        }
      });
    }

    // Update the help request as resolved
    updateHelpRequest(requestId, {
      status: 'resolved',
      selectedOption: option,
      teamDiscussion: {
        ...helpRequest.teamDiscussion,
        resolvedAt: Date.now(),
        resolvedOption: option,
      },
    });
  }, [state.helpRequests, user.id, intentBlocks, updateIntentBlockRaw, addIntentBlockRaw, deleteIntentBlockRaw, updateHelpRequest]);

  // Handle canceling a team discussion (initiator only)
  const handleCancelDiscussion = useCallback((requestId: string) => {
    const helpRequest = state.helpRequests.find(hr => hr.id === requestId);
    if (!helpRequest) return;
    if (helpRequest.createdBy !== user.id) return; // Only initiator can cancel

    // Reset back to previewing state (or delete the request)
    updateHelpRequest(requestId, {
      status: 'resolved', // Mark as resolved but without applying
      teamDiscussion: null as any, // Clear team discussion data (use null so it survives JSON serialization)
    });
  }, [state.helpRequests, user.id, updateHelpRequest]);

  // Handle viewing a discussion's preview (opens it in Intent/Writing panels)
  const handleViewDiscussionPreview = useCallback((helpRequest: HelpRequest) => {
    if (!helpRequest.impactPreview) return;

    // Set the active preview and help request to show in Intent/Writing panels
    setActivePreview(helpRequest.impactPreview);
    setActiveHelpRequest(helpRequest);
    setPreviewSelectedOption(helpRequest.selectedOption || null);
  }, []);

  // Handle panel resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Min 400px, max 75% of screen width
      const maxWidth = Math.floor(window.innerWidth * 0.75);
      setPanelWidth(Math.max(400, Math.min(maxWidth, newWidth)));
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
            addHelpRequest={addHelpRequest}
            onPreviewActive={handlePreviewActive}
            activePreview={activePreview}
            activeHelpRequest={activeHelpRequest}
            previewSelectedOption={previewSelectedOption}
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
          {/* Intent Panel - 50% of right panel (1/4 of screen) */}
          <div className="flex-1 border-r overflow-hidden min-w-0">
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
              localSuggestedIntents={localSuggestedIntents}
              hoveredIntentId={hoveredIntentId}
              onHoverIntent={handleHoverIntent}
              activeIntentId={activeIntentId}
              activePreview={activePreview}
              activeHelpRequest={activeHelpRequest}
              previewSelectedOption={previewSelectedOption}
              onPreviewOptionChange={handlePreviewOptionChange}
              onClearPreview={handleClearPreview}
              onApplyPreview={handleApplyPreview}
              onStartTeamDiscussion={handleStartTeamDiscussion}
              helpRequests={state.helpRequests}
              onRespondToDiscussion={handleRespondToDiscussion}
              onResolveDiscussion={handleResolveDiscussion}
              onCancelDiscussion={handleCancelDiscussion}
              onViewDiscussionPreview={handleViewDiscussionPreview}
            />
          </div>

          {/* Shared Rules Panel - 50% of right panel (1/4 of screen) */}
          <div className="flex-1 overflow-hidden min-w-0">
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
