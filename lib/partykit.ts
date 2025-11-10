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

export type RoomState = {
  writingBlocks: WritingBlock[];
  intentBlocks: IntentBlock[];
  ruleBlocks: RuleBlock[];
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
  });
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    party: "main",
    room: roomId,
    onOpen() {
      console.log(`[PartyKit Client] Connected to room: ${roomId}`);
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
      console.log(`[PartyKit Client] Disconnected from room: ${roomId}`);
      setIsConnected(false);
    },
    onMessage(event: MessageEvent) {
      // Skip binary messages (Yjs uses binary protocol)
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        return;
      }

      const data = JSON.parse(event.data as string);

      console.log(`[PartyKit Client] Received message:`, data.type, data.type === 'sync' ? {
        intentBlocks: data.state?.intentBlocks?.length || 0,
        writingBlocks: data.state?.writingBlocks?.length || 0,
        ruleBlocks: data.state?.ruleBlocks?.length || 0,
      } : '');

      switch (data.type) {
        case "sync":
          console.log(`[PartyKit Client] Setting state from sync:`, data.state);
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
  };
}
