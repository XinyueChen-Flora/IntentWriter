"use client";

import { createContext, useContext } from "react";
import type { IntentBlock, WritingBlock, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

export type IntentPanelContextValue = {
  // Hierarchy data
  blockMap: Map<string, IntentBlock[]>;
  // UI state
  collapsedBlocks: Set<string>;
  editingBlock: string | null;
  hoveredBlock: string | null;
  selectedBlockId: string | null;
  dragOverId: string | null;
  activeId: string | null;
  linkMode: { fromIntentId: string } | null;
  isSetupPhase: boolean;
  // UI state setters
  setEditingBlock: (id: string | null) => void;
  setHoveredBlock: (id: string | null) => void;
  setSelectedBlockId: (id: string | null) => void;
  toggleCollapse: (id: string) => void;
  setLinkMode: (mode: { fromIntentId: string } | null) => void;
  handleBlockClickForLink: (blockId: string, e: React.MouseEvent) => void;
  // Block operations
  addBlock: (options?: { afterBlockId?: string; beforeBlockId?: string; asChildOf?: string }) => IntentBlock;
  updateBlock: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  // Assignment
  assignBlock: (blockId: string, userId: string, userName?: string, userEmail?: string) => void;
  unassignBlock: (blockId: string) => void;
  currentUser: User;
  documentMembers: readonly DocumentMember[];
  onlineUserIds: Set<string>;
  userAvatarMap: Map<string, string>;
  // Dependencies
  dependencies?: IntentDependency[];
  addDependency?: (dep: IntentDependency) => void;
  selectedDepId: string | null;
  setSelectedDepId: (id: string | null) => void;
  hoveredDepId: string | null;
  setHoveredDepId: (id: string | null) => void;
  depColorMap: Map<string, string>;
  // Writing
  intentToWritingMap: Map<string, WritingBlock>;
  roomId: string;
  writingBlocks: readonly WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlockRaw: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  // All blocks (for drop indicator)
  blocks: readonly IntentBlock[];
  // Block ref registration
  registerBlockRef: (blockId: string, el: HTMLDivElement | null) => void;
};

const IntentPanelContext = createContext<IntentPanelContextValue | null>(null);

export const IntentPanelProvider = IntentPanelContext.Provider;

export function useIntentPanelContext(): IntentPanelContextValue {
  const ctx = useContext(IntentPanelContext);
  if (!ctx) {
    throw new Error("useIntentPanelContext must be used within IntentPanelProvider");
  }
  return ctx;
}
