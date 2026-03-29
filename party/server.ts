import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

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
  // Proposal state (set by apply-proposal mutations)
  changeStatus?: string;       // 'proposed' | 'modified' | 'added' | 'removed'
  changeBy?: string;
  changeByName?: string;
  changeAt?: number;
  changeReasoning?: string;
  previousContent?: string;
  proposalId?: string;
  proposedAction?: string;     // 'add' | 'modify' | 'remove'
  proposeType?: string;        // 'decided' | 'discussion' | 'negotiate'
};

export type RoomMeta = {
  phase: 'setup' | 'writing';
  baselineVersion: number;
  phaseTransitionAt?: number;
  phaseTransitionBy?: string;
  metaRule?: any; // MetaRuleConfig from lib/metarule-types.ts
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

type OnlineUser = {
  connectionId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
  joinedAt: number;
};

export default class WritingRoomServer implements Party.Server {
  onlineUsers: Map<string, OnlineUser> = new Map();

  constructor(readonly room: Party.Room) {}

  static async onFetch(request: Party.Request, lobby: Party.FetchLobby) {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  async onStart() {
    const state = await this.room.storage.get<RoomState>("state");
    if (!state) {
      await this.room.storage.put<RoomState>("state", {
        writingBlocks: [],
        intentBlocks: [],
        roomMeta: { phase: 'setup', baselineVersion: 0 },
        dependencies: [],
      });
    } else {
      // Migration: add missing fields to existing state
      let needsUpdate = false;
      if (!state.roomMeta) {
        state.roomMeta = { phase: 'setup', baselineVersion: 0 };
        needsUpdate = true;
      }
      if (!state.dependencies) {
        state.dependencies = [];
        needsUpdate = true;
      }
      // Migrate old type-based deps to label-based
      for (const dep of state.dependencies) {
        if ((dep as any).type && !dep.label) {
          dep.label = (dep as any).type;
          dep.direction = 'directed';
          delete (dep as any).type;
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        await this.room.storage.put("state", state);
      }
    }
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Use room.id (guaranteed to be the room name) instead of parsing URL
    const isYjsConnection = this.room.id.includes("-writing-");

    if (isYjsConnection) {
      // Yjs doc is persisted to PartyKit storage (y-partykit handles this).
      // Additionally, content is backed up via periodic snapshots to Supabase.
      return onConnect(conn, this.room);
    }

    const state = await this.room.storage.get<RoomState>("state");
    conn.send(
      JSON.stringify({
        type: "sync",
        state: state || {
          writingBlocks: [],
          intentBlocks: [],
          roomMeta: { phase: 'setup', baselineVersion: 0 },
          dependencies: [],
        },
      })
    );
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Binary messages = Yjs updates: relay to other clients
    if (message instanceof ArrayBuffer) {
      this.room.broadcast(message, [sender.id]);
      return;
    }

    // Writing rooms only need binary relay (above); skip JSON handling
    if (this.room.id.includes("-writing-")) {
      return;
    }

    const data = JSON.parse(message);

    switch (data.type) {
      case "identify": {
        const user: OnlineUser = {
          connectionId: sender.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          avatarUrl: data.avatarUrl,
          joinedAt: Date.now(),
        };
        this.onlineUsers.set(sender.id, user);
        const userList = Array.from(this.onlineUsers.values());
        this.room.broadcast(JSON.stringify({ type: "online_users", users: userList }));
        break;
      }

      case "restore_outline": {
        // Restore outline from Supabase backup (only if current state is empty)
        const currentState = await this.room.storage.get<RoomState>("state");
        if (currentState && currentState.intentBlocks.length === 0 && data.blocks?.length > 0) {
          currentState.intentBlocks = data.blocks;
          await this.room.storage.put("state", currentState);
          this.room.broadcast(JSON.stringify({ type: "sync", state: currentState }));
        }
        break;
      }

      case "update_intent_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        const index = state.intentBlocks.findIndex((b) => b.id === data.blockId);
        if (index !== -1) {
          state.intentBlocks[index] = { ...state.intentBlocks[index], ...data.updates, updatedAt: Date.now() };
        }
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "add_intent_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.intentBlocks.push(data.block);
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "delete_intent_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.intentBlocks = state.intentBlocks.filter((b) => b.id !== data.blockId);
        state.dependencies = (state.dependencies || []).filter(
          (d) => d.fromIntentId !== data.blockId && d.toIntentId !== data.blockId
        );
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "add_writing_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        // Dedup: skip if a writing block with this ID already exists
        if (!state.writingBlocks.some(wb => wb.id === data.block.id)) {
          state.writingBlocks.push(data.block);
          await this.room.storage.put("state", state);
        }
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "delete_writing_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.writingBlocks = state.writingBlocks.filter((b) => b.id !== data.blockId);
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "update_writing_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        const index = state.writingBlocks.findIndex((b) => b.id === data.blockId);
        if (index !== -1) {
          state.writingBlocks[index] = { ...state.writingBlocks[index], ...data.updates, updatedAt: Date.now() };
        }
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "update_room_meta": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.roomMeta = { ...(state.roomMeta || { phase: 'setup', baselineVersion: 0 }), ...data.updates };
        await this.room.storage.put("state", state);
        // Broadcast to ALL clients including sender (server is truth for phase transitions)
        this.room.broadcast(message);
        break;
      }

      case "add_dependency": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.dependencies = state.dependencies || [];
        state.dependencies.push(data.dependency);
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "update_dependency": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.dependencies = state.dependencies || [];
        const index = state.dependencies.findIndex((d) => d.id === data.dependencyId);
        if (index !== -1) {
          state.dependencies[index] = { ...state.dependencies[index], ...data.updates };
        }
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "delete_dependency": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;
        state.dependencies = (state.dependencies || []).filter((d) => d.id !== data.dependencyId);
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      default:
        this.room.broadcast(message, [sender.id]);
    }
  }

  async onClose(conn: Party.Connection) {
    this.onlineUsers.delete(conn.id);
    const userList = Array.from(this.onlineUsers.values());
    this.room.broadcast(JSON.stringify({ type: "online_users", users: userList }));
  }
}

WritingRoomServer satisfies Party.Worker;
