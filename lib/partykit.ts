"use client";

import { useState, useCallback } from "react";
import usePartySocket from "partysocket/react";
import type { AACUDimension } from "./aacuFramework";

// Define types for your storage
export type WritingBlock = {
  id: string;
  content: string;
  position: number;
  linkedIntentId: string | null;
  createdAt: number;
  updatedAt: number;
  alignmentResult?: any; // Stores the AI alignment analysis result
};

export type IntentBlock = {
  id: string;
  content: string;
  position: number;
  linkedWritingIds: string[];
  createdAt: number;
  updatedAt: number;
  // Hierarchical structure support
  parentId: string | null; // null = root level
  level: number; // 0 = root, 1 = child, 2 = grandchild, etc.
  intentTag?: string; // Content after [intent]: marker
  intentCreatedBy?: string; // User ID who created the intent
  intentCreatedByName?: string; // User name who created the intent
  intentCreatedByEmail?: string; // User email who created the intent
  intentCreatedAt?: number; // When the intent was created
  isCollapsed?: boolean; // UI state for collapsible hierarchy
  assignee?: string; // User ID assigned to this block
  assigneeName?: string; // Assignee user name
  assigneeEmail?: string; // Assignee user email
  mergeWritingFrom?: string; // Writing block ID to merge content from (used when indent happens)
};

export type EditingTraceEntry = {
  version: number; // 1, 2, 3...
  content: string; // The text at this version
  timestamp: number;
};

export type RuleBlock = {
  id: string;
  content: string; // Rule description (e.g., "Use 'shared understanding' as core concept")
  examples: string[]; // Writing examples demonstrating this rule
  editingTrace: EditingTraceEntry[]; // Editing history showing how the rule emerged
  rationale: string; // Why this rule is important
  createdBy: string; // User ID
  createdByName?: string;
  createdByEmail?: string;
  createdAt: number;
  updatedAt: number;
  position: number; // For ordering
  dimension?: AACUDimension; // AAC&U dimension category (optional)
  sourceRubric?: string; // Original rubric text that generated this rule (optional)
};

// Section preview for impact visualization
export type SectionPreview = {
  intentId: string;
  intentContent: string;
  originalText?: string;  // Current text (if exists)
  previewText: string;    // How it would look with this option
  changeType: "added" | "removed" | "modified" | "unchanged";
};

// Paragraph preview - shows how a paragraph would change
export type ParagraphPreview = {
  intentId: string;          // Root intent ID (level 0)
  intentContent: string;     // Root intent content
  currentContent: string;    // Current paragraph content
  previewContent: string;    // How it would change
  changeType: "modified" | "unchanged";
  reason?: string;           // Why this paragraph is affected
};

// Impact preview - stored with HelpRequest for team negotiation
export type ImpactPreview = {
  questionType: string;  // "choose-between" | "add-remove" | "how-much" | etc.

  // Option A preview - "Keep Current" (the existing approach)
  optionA: {
    label: string;
    isCurrentState?: boolean;  // true = this represents current state
    intentChanges: SectionPreview[];      // Changes to intent structure
    paragraphPreviews: ParagraphPreview[]; // Changes to paragraphs
  };

  // Option B preview - "Make Change" (the proposed modification)
  optionB: {
    label: string;
    isCurrentState?: boolean;  // false = this represents the proposed change
    intentChanges: SectionPreview[];
    paragraphPreviews: ParagraphPreview[];
  };

  primaryIntentId?: string;  // The main intent this question is about
  affectedIntentIds?: string[];  // All intents that might be affected
  affectedRootIntentIds?: string[];  // Only level-0 intents affected
  needsTeamDiscussion?: boolean;  // True if changes affect multiple root intents
  generatedAt: number;
};

// Help Request - for writer to articulate uncertainty/questions during writing
export type HelpRequest = {
  id: string;
  createdBy: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt: number;

  // The question/uncertainty
  question: string;
  questionType?: string;  // "choose-between" | "add-remove" | "how-much" | etc.
  tags?: string[];

  // Context - where this was raised
  writingBlockId: string;
  intentBlockId?: string; // Auto-linked via alignment
  selectedText?: string;
  selectionRange?: {
    from: number;
    to: number;
  };

  // AI judgment result
  aiJudgment?: {
    isTeamRelevant: boolean;
    affectedIntents?: string[]; // Intent IDs that may be affected
    reason: string;
  };

  // Impact preview - for visualization and team negotiation
  impactPreview?: ImpactPreview;

  // User's selected option (after viewing preview)
  selectedOption?: "A" | "B";

  // Team discussion data (when status = 'team')
  teamDiscussion?: {
    participationType: "vote" | "feedback" | "execute" | "tentative";
    initiatorThoughts: string;  // What the initiator thinks/wants to discuss
    selectedOption: "A" | "B" | null;  // Option chosen by initiator (for execute/tentative)
    requiredResponders: string[];  // User IDs who must respond
    optionalResponders: string[];  // User IDs who can optionally respond
    responses: Array<{
      userId: string;
      userName?: string;
      userEmail?: string;
      vote?: "A" | "B";  // For vote type
      comment?: string;  // For feedback/comment
      respondedAt: number;
    }>;
    resolvedAt?: number;
    resolvedOption?: "A" | "B";
  };

  // Status flow: pending -> ai_processing -> previewing -> personal/team -> resolved
  status: 'pending' | 'ai_processing' | 'previewing' | 'personal' | 'team' | 'resolved';
};

export type RoomState = {
  writingBlocks: WritingBlock[];
  intentBlocks: IntentBlock[];
  ruleBlocks: RuleBlock[];
  helpRequests: HelpRequest[];
};

export type OnlineUser = {
  connectionId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
  joinedAt: number;
};

// Hook to use PartyKit room
export function useRoom(roomId: string, user?: { id: string; user_metadata?: any; email?: string | null }) {
  const [state, setState] = useState<RoomState>({
    writingBlocks: [],
    intentBlocks: [],
    ruleBlocks: [],
    helpRequests: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    party: "main",
    room: roomId,
    onOpen() {
      setIsConnected(true);

      // Send user identification to server
      if (user) {
        const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
        const avatarUrl = user.user_metadata?.avatar_url;
        socket.send(
          JSON.stringify({
            type: "identify",
            userId: user.id,
            userName,
            userEmail: user.email,
            avatarUrl,
          })
        );
      }
    },
    onClose() {
      setIsConnected(false);
    },
    onMessage(event: MessageEvent) {
      // Skip binary messages (Yjs uses binary protocol)
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        return;
      }

      const data = JSON.parse(event.data as string);

      switch (data.type) {
        case "sync":
          setState(data.state);
          break;
        case "online_users":
          setOnlineUsers(data.users || []);
          break;
        case "update_intent_block":
          setState((prev) => {
            const index = prev.intentBlocks.findIndex((b) => b.id === data.blockId);
            if (index === -1) return prev;
            const newBlocks = [...prev.intentBlocks];
            newBlocks[index] = {
              ...newBlocks[index],
              ...data.updates,
            };
            return { ...prev, intentBlocks: newBlocks };
          });
          break;
        case "add_intent_block":
          setState((prev) => ({
            ...prev,
            intentBlocks: [...prev.intentBlocks, data.block],
          }));
          break;
        case "delete_intent_block":
          setState((prev) => ({
            ...prev,
            intentBlocks: prev.intentBlocks.filter((b) => b.id !== data.blockId),
          }));
          break;
        case "add_writing_block":
          setState((prev) => ({
            ...prev,
            writingBlocks: [...prev.writingBlocks, data.block],
          }));
          break;
        case "delete_writing_block":
          setState((prev) => ({
            ...prev,
            writingBlocks: prev.writingBlocks.filter((b) => b.id !== data.blockId),
          }));
          break;
        case "update_writing_block":
          setState((prev) => {
            const index = prev.writingBlocks.findIndex((b) => b.id === data.blockId);
            if (index === -1) return prev;
            const newBlocks = [...prev.writingBlocks];
            newBlocks[index] = {
              ...newBlocks[index],
              ...data.updates,
            };
            return { ...prev, writingBlocks: newBlocks };
          });
          break;
        case "add_rule_block":
          setState((prev) => ({
            ...prev,
            ruleBlocks: [...prev.ruleBlocks, data.block],
          }));
          break;
        case "update_rule_block":
          setState((prev) => {
            const index = prev.ruleBlocks.findIndex((b) => b.id === data.blockId);
            if (index === -1) return prev;
            const newBlocks = [...prev.ruleBlocks];
            newBlocks[index] = {
              ...newBlocks[index],
              ...data.updates,
            };
            return { ...prev, ruleBlocks: newBlocks };
          });
          break;
        case "delete_rule_block":
          setState((prev) => ({
            ...prev,
            ruleBlocks: prev.ruleBlocks.filter((b) => b.id !== data.blockId),
          }));
          break;
        case "add_help_request":
          setState((prev) => ({
            ...prev,
            helpRequests: [...prev.helpRequests, data.request],
          }));
          break;
        case "update_help_request":
          setState((prev) => {
            const index = prev.helpRequests.findIndex((r) => r.id === data.requestId);
            if (index === -1) return prev;
            const newRequests = [...prev.helpRequests];
            newRequests[index] = {
              ...newRequests[index],
              ...data.updates,
            };
            return { ...prev, helpRequests: newRequests };
          });
          break;
        case "delete_help_request":
          setState((prev) => ({
            ...prev,
            helpRequests: prev.helpRequests.filter((r) => r.id !== data.requestId),
          }));
          break;
      }
    },
  });

  // Mutation functions
  const updateIntentBlock = useCallback(
    (blockId: string, updates: Partial<IntentBlock>) => {
      if (!socket) return;

      socket.send(
        JSON.stringify({
          type: "update_intent_block",
          blockId,
          updates,
        })
      );

      // Optimistic update
      setState((prev) => {
        const index = prev.intentBlocks.findIndex((b) => b.id === blockId);
        if (index === -1) return prev;
        const newBlocks = [...prev.intentBlocks];
        newBlocks[index] = {
          ...newBlocks[index],
          ...updates,
        };
        return { ...prev, intentBlocks: newBlocks };
      });
    },
    [socket]
  );

  const addIntentBlock = useCallback(
    (block: IntentBlock) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "add_intent_block",
          block,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        intentBlocks: [...prev.intentBlocks, block],
      }));
    },
    [socket]
  );

  const deleteIntentBlock = useCallback(
    (blockId: string) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "delete_intent_block",
          blockId,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        intentBlocks: prev.intentBlocks.filter((b) => b.id !== blockId),
      }));
    },
    [socket]
  );

  const addWritingBlock = useCallback(
    (block: WritingBlock) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "add_writing_block",
          block,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        writingBlocks: [...prev.writingBlocks, block],
      }));
    },
    [socket]
  );

  const deleteWritingBlock = useCallback(
    (blockId: string) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "delete_writing_block",
          blockId,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        writingBlocks: prev.writingBlocks.filter((b) => b.id !== blockId),
      }));
    },
    [socket]
  );

  const updateWritingBlock = useCallback(
    (blockId: string, updates: Partial<WritingBlock>) => {
      if (!socket) return;

      socket.send(
        JSON.stringify({
          type: "update_writing_block",
          blockId,
          updates,
        })
      );

      // Optimistic update
      setState((prev) => {
        const index = prev.writingBlocks.findIndex((b) => b.id === blockId);
        if (index === -1) return prev;
        const newBlocks = [...prev.writingBlocks];
        newBlocks[index] = {
          ...newBlocks[index],
          ...updates,
        };
        return { ...prev, writingBlocks: newBlocks };
      });
    },
    [socket]
  );

  const addRuleBlock = useCallback(
    (block: RuleBlock) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "add_rule_block",
          block,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        ruleBlocks: [...prev.ruleBlocks, block],
      }));
    },
    [socket]
  );

  const updateRuleBlock = useCallback(
    (blockId: string, updates: Partial<RuleBlock>) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "update_rule_block",
          blockId,
          updates,
        })
      );
      // Optimistic update
      setState((prev) => {
        const index = prev.ruleBlocks.findIndex((b) => b.id === blockId);
        if (index === -1) return prev;
        const newBlocks = [...prev.ruleBlocks];
        newBlocks[index] = {
          ...newBlocks[index],
          ...updates,
        };
        return { ...prev, ruleBlocks: newBlocks };
      });
    },
    [socket]
  );

  const deleteRuleBlock = useCallback(
    (blockId: string) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "delete_rule_block",
          blockId,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        ruleBlocks: prev.ruleBlocks.filter((b) => b.id !== blockId),
      }));
    },
    [socket]
  );

  const addHelpRequest = useCallback(
    (request: HelpRequest) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "add_help_request",
          request,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        helpRequests: [...prev.helpRequests, request],
      }));
    },
    [socket]
  );

  const updateHelpRequest = useCallback(
    (requestId: string, updates: Partial<HelpRequest>) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "update_help_request",
          requestId,
          updates,
        })
      );
      // Optimistic update
      setState((prev) => {
        const index = prev.helpRequests.findIndex((r) => r.id === requestId);
        if (index === -1) return prev;
        const newRequests = [...prev.helpRequests];
        newRequests[index] = {
          ...newRequests[index],
          ...updates,
        };
        return { ...prev, helpRequests: newRequests };
      });
    },
    [socket]
  );

  const deleteHelpRequest = useCallback(
    (requestId: string) => {
      if (!socket) return;
      socket.send(
        JSON.stringify({
          type: "delete_help_request",
          requestId,
        })
      );
      // Optimistic update
      setState((prev) => ({
        ...prev,
        helpRequests: prev.helpRequests.filter((r) => r.id !== requestId),
      }));
    },
    [socket]
  );

  return {
    state,
    isConnected,
    onlineUsers,
    updateIntentBlock,
    addIntentBlock,
    deleteIntentBlock,
    addWritingBlock,
    updateWritingBlock,
    deleteWritingBlock,
    addRuleBlock,
    updateRuleBlock,
    deleteRuleBlock,
    addHelpRequest,
    updateHelpRequest,
    deleteHelpRequest,
  };
}
