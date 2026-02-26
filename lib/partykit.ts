"use client";

import { useState, useCallback } from "react";
import usePartySocket from "partysocket/react";

export type WritingBlock = {
  id: string;
  content: string;
  position: number;
  linkedIntentId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type IntentBlock = {
  id: string;
  content: string;
  position: number;
  linkedWritingIds: string[];
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
  level: number;
  intentTag?: string;
  intentCreatedBy?: string;
  intentCreatedByName?: string;
  intentCreatedByEmail?: string;
  intentCreatedAt?: number;
  isCollapsed?: boolean;
  assignee?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  mergeWritingFrom?: string;
  // Change tracking (for changes made during writing phase)
  changeStatus?: 'added' | 'proposed' | 'modified' | 'removed';
  changeBy?: string;
  changeByName?: string;
  changeAt?: number;
  previousContent?: string; // Store original content when modified
  // For proposed changes - track discussion state
  proposalStatus?: 'pending' | 'approved' | 'rejected';
};

export type RoomMeta = {
  phase: 'setup' | 'writing';
  baselineVersion: number;
  phaseTransitionAt?: number;
  phaseTransitionBy?: string;
};

export type IntentDependency = {
  id: string;
  fromIntentId: string;
  toIntentId: string;
  label: string;
  direction: 'directed' | 'bidirectional';
  source: 'manual' | 'ai-suggested' | 'ai-confirmed';
  confirmed: boolean;
  createdBy?: string;
  createdAt: number;
};

export type RoomState = {
  writingBlocks: WritingBlock[];
  intentBlocks: IntentBlock[];
  roomMeta: RoomMeta;
  dependencies: IntentDependency[];
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
    roomMeta: { phase: 'setup', baselineVersion: 0 },
    dependencies: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    party: "main",
    room: roomId,
    onOpen() {
      setIsConnected(true);

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
            newBlocks[index] = { ...newBlocks[index], ...data.updates };
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
            dependencies: prev.dependencies.filter(
              (d) => d.fromIntentId !== data.blockId && d.toIntentId !== data.blockId
            ),
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
            newBlocks[index] = { ...newBlocks[index], ...data.updates };
            return { ...prev, writingBlocks: newBlocks };
          });
          break;
        case "update_room_meta":
          setState((prev) => ({
            ...prev,
            roomMeta: { ...prev.roomMeta, ...data.updates },
          }));
          break;
        case "add_dependency":
          setState((prev) => ({
            ...prev,
            dependencies: [...prev.dependencies, data.dependency],
          }));
          break;
        case "update_dependency":
          setState((prev) => {
            const index = prev.dependencies.findIndex((d) => d.id === data.dependencyId);
            if (index === -1) return prev;
            const newDeps = [...prev.dependencies];
            newDeps[index] = { ...newDeps[index], ...data.updates };
            return { ...prev, dependencies: newDeps };
          });
          break;
        case "delete_dependency":
          setState((prev) => ({
            ...prev,
            dependencies: prev.dependencies.filter((d) => d.id !== data.dependencyId),
          }));
          break;
      }
    },
  });

  // Mutation functions
  const updateIntentBlock = useCallback(
    (blockId: string, updates: Partial<IntentBlock>) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "update_intent_block", blockId, updates }));
      setState((prev) => {
        const index = prev.intentBlocks.findIndex((b) => b.id === blockId);
        if (index === -1) return prev;
        const newBlocks = [...prev.intentBlocks];
        newBlocks[index] = { ...newBlocks[index], ...updates };
        return { ...prev, intentBlocks: newBlocks };
      });
    },
    [socket]
  );

  const addIntentBlock = useCallback(
    (block: IntentBlock) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "add_intent_block", block }));
      setState((prev) => ({ ...prev, intentBlocks: [...prev.intentBlocks, block] }));
    },
    [socket]
  );

  const deleteIntentBlock = useCallback(
    (blockId: string) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "delete_intent_block", blockId }));
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
      socket.send(JSON.stringify({ type: "add_writing_block", block }));
      setState((prev) => ({ ...prev, writingBlocks: [...prev.writingBlocks, block] }));
    },
    [socket]
  );

  const deleteWritingBlock = useCallback(
    (blockId: string) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "delete_writing_block", blockId }));
      setState((prev) => ({
        ...prev,
        writingBlocks: prev.writingBlocks.filter((b) => b.id !== blockId),
      }));
    },
    [socket]
  );

  // Room meta — NO optimistic update, wait for server broadcast
  const updateRoomMeta = useCallback(
    (updates: Partial<RoomMeta>) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "update_room_meta", updates }));
    },
    [socket]
  );

  const addDependency = useCallback(
    (dependency: IntentDependency) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "add_dependency", dependency }));
      setState((prev) => ({ ...prev, dependencies: [...prev.dependencies, dependency] }));
    },
    [socket]
  );

  const updateDependency = useCallback(
    (dependencyId: string, updates: Partial<IntentDependency>) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "update_dependency", dependencyId, updates }));
      setState((prev) => {
        const index = prev.dependencies.findIndex((d) => d.id === dependencyId);
        if (index === -1) return prev;
        const newDeps = [...prev.dependencies];
        newDeps[index] = { ...newDeps[index], ...updates };
        return { ...prev, dependencies: newDeps };
      });
    },
    [socket]
  );

  const deleteDependency = useCallback(
    (dependencyId: string) => {
      if (!socket) return;
      socket.send(JSON.stringify({ type: "delete_dependency", dependencyId }));
      setState((prev) => ({
        ...prev,
        dependencies: prev.dependencies.filter((d) => d.id !== dependencyId),
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
    deleteWritingBlock,
    updateRoomMeta,
    addDependency,
    updateDependency,
    deleteDependency,
  };
}
