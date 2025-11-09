import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

// Types matching our data structure
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
};

export type EditingTraceEntry = {
  version: number;
  content: string;
  timestamp: number;
};

export type RuleBlock = {
  id: string;
  content: string;
  examples: string[];
  editingTrace: EditingTraceEntry[];
  rationale: string;
  createdBy: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt: number;
  updatedAt: number;
  position: number;
};

export type RoomState = {
  writingBlocks: WritingBlock[];
  intentBlocks: IntentBlock[];
  ruleBlocks: RuleBlock[];
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
  // Track online users (metadata connections only)
  onlineUsers: Map<string, OnlineUser> = new Map();

  constructor(readonly room: Party.Room) {}

  // Enable CORS for production
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
    // Initialize room state if it doesn't exist
    const state = await this.room.storage.get<RoomState>("state");
    if (!state) {
      await this.room.storage.put<RoomState>("state", {
        writingBlocks: [],
        intentBlocks: [],
        ruleBlocks: [],
      });
    } else if (!state.ruleBlocks) {
      // Migration: add ruleBlocks to existing state
      state.ruleBlocks = [];
      await this.room.storage.put("state", state);
    }
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);

    // Check if this is a Yjs connection (for BlockNote editors)
    // Yjs connections have room ID pattern: roomId-writing-blockId
    const isYjsConnection = url.pathname.includes("-writing-");

    if (isYjsConnection) {
      // Handle Yjs connections for BlockNote
      return onConnect(conn, this.room, {
        persist: {
          mode: "snapshot"  // Stores latest document state between sessions
        },
      });
    }

    // This is a metadata connection (intent/writing blocks)
    // Send current state to the newly connected client
    const state = await this.room.storage.get<RoomState>("state");

    conn.send(
      JSON.stringify({
        type: "sync",
        state: state || {
          writingBlocks: [],
          intentBlocks: [],
          ruleBlocks: [],
        },
      })
    );

    // Note: User info will be sent via identify message from client
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    // Handle binary messages (Yjs)
    if (message instanceof ArrayBuffer) {
      this.room.broadcast(message, [sender.id]);
      return;
    }

    const data = JSON.parse(message);

    // Handle different message types
    switch (data.type) {
      case "identify": {
        // Client sends user info on connection
        const user: OnlineUser = {
          connectionId: sender.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          avatarUrl: data.avatarUrl,
          joinedAt: Date.now(),
        };

        this.onlineUsers.set(sender.id, user);

        // Broadcast updated user list to all clients
        const userList = Array.from(this.onlineUsers.values());
        this.room.broadcast(
          JSON.stringify({
            type: "online_users",
            users: userList,
          })
        );
        break;
      }

      case "update_intent_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        const index = state.intentBlocks.findIndex((b) => b.id === data.blockId);
        if (index !== -1) {
          state.intentBlocks[index] = {
            ...state.intentBlocks[index],
            ...data.updates,
            updatedAt: Date.now(),
          };
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

        state.intentBlocks = state.intentBlocks.filter(
          (b) => b.id !== data.blockId
        );
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "add_writing_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        state.writingBlocks.push(data.block);
        await this.room.storage.put("state", state);

        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "delete_writing_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        state.writingBlocks = state.writingBlocks.filter(
          (b) => b.id !== data.blockId
        );
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "add_rule_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        state.ruleBlocks = state.ruleBlocks || [];
        state.ruleBlocks.push(data.block);
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "update_rule_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        state.ruleBlocks = state.ruleBlocks || [];
        const index = state.ruleBlocks.findIndex((b) => b.id === data.blockId);
        if (index !== -1) {
          state.ruleBlocks[index] = {
            ...state.ruleBlocks[index],
            ...data.updates,
            updatedAt: Date.now(),
          };
        }

        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      case "delete_rule_block": {
        const state = await this.room.storage.get<RoomState>("state");
        if (!state) return;

        state.ruleBlocks = state.ruleBlocks || [];
        state.ruleBlocks = state.ruleBlocks.filter(
          (b) => b.id !== data.blockId
        );
        await this.room.storage.put("state", state);
        this.room.broadcast(message, [sender.id]);
        break;
      }

      default:
        // Broadcast any other messages to all clients
        this.room.broadcast(message, [sender.id]);
    }
  }

  async onClose(conn: Party.Connection) {
    // Remove user from online users
    this.onlineUsers.delete(conn.id);

    // Broadcast updated user list
    const userList = Array.from(this.onlineUsers.values());
    this.room.broadcast(
      JSON.stringify({
        type: "online_users",
        users: userList,
      })
    );
  }
}

WritingRoomServer satisfies Party.Worker;
