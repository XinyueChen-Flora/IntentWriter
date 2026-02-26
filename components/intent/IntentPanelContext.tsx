"use client";

import { createContext, useContext } from "react";
import type { IntentBlock, WritingBlock, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import type { DriftStatus, OrphanSentence, DependencyIssue, SentenceAnchor, SupportingSentence, SimulatedOutline } from "./hooks/useDriftDetection";

// Writing simulation info (where and what to insert)
export type WritingSimulation = {
  insertAfter?: string;
  insertBefore?: string;
  replaceStart?: string;
  content: string;
  position: 'start' | 'end' | 'after' | 'before' | 'replace';
};

// Pending writing suggestion (from "Update Writing" button)
export type PendingWritingSuggestion = {
  intentId: string;
  rootIntentId: string;
  intentContent: string;
  suggestedContent: string;
  simulation?: WritingSimulation;
};

// Pending intent suggestion (from "Update Intent" button)
export type PendingIntentSuggestion = {
  intentId: string;
  rootIntentId: string;
  currentContent: string;
  suggestedContent: string;
  // Impact on related sections
  relatedImpacts?: Array<{ id: string; content: string; impact: string }>;
  isLoadingImpact?: boolean;
};

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
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  // Drift detection
  driftCheckingIds?: Set<string>;
  triggerCheck?: (sectionId?: string) => Promise<void>;
  getDriftStatus?: (rootIntentId: string) => DriftStatus | undefined;
  getSentenceHighlights?: (rootIntentId: string) => {
    supporting: SupportingSentence[];  // green - fully covered
    partial: SupportingSentence[];     // orange - partially covered
    orphan: OrphanSentence[];          // yellow - not in outline
    conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
  };
  // Conflict status for dependency lines (sectionId -> remoteSectionId -> issue)
  getConflictForDependency?: (fromSectionId: string, toSectionId: string) => DependencyIssue | undefined;
  // Simulated outline based on writing
  getSimulatedOutline?: (rootIntentId: string) => SimulatedOutline | undefined;
  hasSimulatedOutline?: (rootIntentId: string) => boolean;
  // Hover state for intent-writing linking
  hoveredIntentForLink: string | null;  // intentId being hovered (for writing highlight)
  setHoveredIntentForLink: (id: string | null) => void;
  hoveredOrphanHint: string | null;  // orphan sentence hint being hovered
  setHoveredOrphanHint: (hint: string | null) => void;
  // Writing → Intent hover (when hovering sentence in writing, highlight intent)
  hoveredIntentFromWriting: string | null;
  setHoveredIntentFromWriting: (id: string | null) => void;
  // Handled orphans - orphans that have been processed (added to outline or dismissed via "Modify Writing")
  handledOrphanStarts: Set<string>;
  markOrphanHandled: (orphanStart: string) => void;
  // All blocks (for drop indicator)
  blocks: readonly IntentBlock[];
  // Block ref registration
  registerBlockRef: (blockId: string, el: HTMLDivElement | null) => void;
  // Pending writing suggestion (Intent → Writing simulation)
  pendingWritingSuggestion: PendingWritingSuggestion | null;
  setPendingWritingSuggestion: (suggestion: PendingWritingSuggestion | null) => void;
  // Pending intent suggestion (Writing → Intent simulation)
  pendingIntentSuggestion: PendingIntentSuggestion | null;
  setPendingIntentSuggestion: (suggestion: PendingIntentSuggestion | null) => void;
  // Get writing content for a root intent (for API calls)
  getWritingContent?: (rootIntentId: string) => Promise<string>;
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
