"use client";

import { createContext, useContext } from "react";
import type { IntentBlock, WritingBlock, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import type { MetaRuleConfig } from "@/lib/metarule-types";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";
import type { PrimitiveLocation } from "@/platform/primitives/registry";
import type { FunctionFocus } from "@/platform/functions/protocol";
import type { DocumentSnapshot } from "@/platform/data-model";
// Legacy types kept for TipTap bridge compatibility
import type { SentenceAnchor, SupportingSentence, OrphanSentence, DependencyIssue, AlignedIntent } from "@/lib/primitive-to-tiptap";

// Legacy types removed — all orchestration now goes through protocols
// (Sense → Gate → Negotiate)

// Draft item in the proposal panel (editable copy of a child intent)
export type DraftItem = {
  id: string;
  content: string;
  originalContent: string;
  isNew: boolean;       // newly added by user
  isRemoved: boolean;   // marked for deletion by user
  // Tracks if this item already had a change from a prior proposal
  priorChangeStatus?: 'added' | 'modified' | 'removed';
  priorChangeBy?: string;      // who made the prior change
  priorChangeAt?: number;      // when the prior change was made
};

// Proposal draft — the editing state before simulation
export type ProposalDraft = {
  rootIntentId: string;         // which section is being edited
  action: 'change' | 'comment';
  // For 'change': editable copy of the section's children
  draftItems?: DraftItem[];
  // For 'comment': the comment text
  comment?: string;
  // Which block triggered this (for highlighting in left outline)
  triggerIntentId?: string;
  // When initiated from writing side, skip source section writing preview
  sourceFromWriting?: boolean;
};

// Notification for a section that's been impacted by someone else's change
export type SectionNotification = {
  proposalId: string;
  proposeType: 'decided' | 'negotiate' | 'input' | 'discussion';
  proposedBy: string;
  proposedByName: string;
  proposedByAvatar?: string;
  sourceSectionId: string;
  sourceSectionName: string;
  impactLevel: 'minor' | 'significant';
  notifyLevel: 'skip' | 'heads-up' | 'notify';
  reason: string;                    // why this section is impacted
  personalNote?: string;
  suggestedChanges?: Array<{         // AI's suggested changes for THIS section
    action: 'add' | 'modify' | 'remove';
    intentId?: string;
    content: string;
    reason: string;
  }>;
  sourceChanges?: Array<{            // proposer's original changes (what they actually changed)
    id: string;
    content: string;
    status: string;
    originalContent?: string;
    reason?: string;
  }>;
  reasoning?: string;                // proposer's reasoning for the change
  createdAt: string;
  acknowledged: boolean;
};

export type SetupTab = 'outline' | 'assign' | 'relationships';

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
  isSetupPhase: boolean;
  activeSetupTab: SetupTab;
  // UI state setters
  setEditingBlock: (id: string | null) => void;
  setHoveredBlock: (id: string | null) => void;
  setSelectedBlockId: (id: string | null) => void;
  toggleCollapse: (id: string) => void;
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
  // Drag-to-connect
  isDraggingConnection: boolean;
  handleConnectionDragStart: (fromIntentId: string, e: React.MouseEvent) => void;
  // Connected block IDs (for visual indicators)
  connectedBlockIds: Set<string>;
  // Writing
  intentToWritingMap: Map<string, WritingBlock>;
  roomId: string;
  writingBlocks: readonly WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlockRaw: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  onRegisterParagraphAttributionExporter?: (blockId: string, exporter: () => import("@/platform/data-model").ParagraphAttribution[]) => void;
  // Pipeline (replaces drift detection)
  primitivesByLocation: Record<PrimitiveLocation, ResolvedPrimitive[]>;
  /** Primitives scoped to a specific section */
  getPrimitivesForSection: (sectionId: string) => Record<PrimitiveLocation, ResolvedPrimitive[]>;
  /** UI primitives from active sense protocols (buttons, summaries) */
  senseProtocolUI: ResolvedPrimitive[];
  /** Dispatch a primitive action (from outline menus, etc.) */
  onPrimitiveAction?: (action: string, primitive: ResolvedPrimitive) => void;
  runSenseProtocol: (protocolId: string, focus?: FunctionFocus) => Promise<void>;
  runFunction: (functionId: string, focus?: FunctionFocus) => Promise<void>;
  injectResult: (functionId: string, targetSectionId: string, result: import("@/platform/functions/protocol").FunctionResult) => void;
  getCrossSectionImpact: (sectionId: string) => import("@/platform/primitives/resolver").ResolvedPrimitive[] | null;
  clearResult: (key: string) => void;
  clearAllResults: (sectionId?: string) => void;
  isRunning: (functionId: string) => boolean;
  runningFunctions: string[];
  // TipTap bridge (derived from pipeline primitives)
  getSentenceHighlights?: (rootIntentId: string) => {
    supporting: SupportingSentence[];
    partial: SupportingSentence[];
    orphan: OrphanSentence[];
    conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
  };
  getAlignedIntents?: (rootIntentId: string) => AlignedIntent[];
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
  // Track intents that have AI-generated content (shown with AI badge)
  aiCoveredIntents: Set<string>;
  // AI-generated sentence mappings - for hover linking after Accept
  aiGeneratedSentences: Map<string, { intentId: string; rootIntentId: string; anchor: SentenceAnchor }>;
  // Mark intent as AI-covered AND add sentence mapping for hover linking
  markIntentAsCovered: (intentId: string, rootIntentId: string, sentenceAnchor: SentenceAnchor) => void;
  // Get writing content for a root intent (for API calls)
  getWritingContent?: (rootIntentId: string) => Promise<string>;
  // Proposal draft — editing state before simulation
  proposalDraft: ProposalDraft | null;
  setProposalDraft: (draft: ProposalDraft | null) => void;
  openProposalDraft: (rootIntentId: string, action: 'change' | 'comment', triggerIntentId?: string) => void;
  // Viewing a submitted proposal
  viewingProposalId: string | null;
  setViewingProposalId: (id: string | null) => void;
  viewingProposalForSectionId: string | null;
  setViewingProposalForSectionId: (id: string | null) => void;
  viewingProposalAffectedSectionId: string | null;
  setViewingProposalAffectedSectionId: (id: string | null) => void;
  // Section notifications — pending impacts from other people's changes
  getSectionNotifications: (sectionId: string) => SectionNotification[];
  refreshProposals: () => void;
  // Thread expansion — which proposal thread is expanded
  expandedThreadProposalId: string | null;
  setExpandedThreadProposalId: (id: string | null) => void;
  // Review — reviewer enters deliberate stage
  activeReview: { proposalId: string; pathId: string; sectionId: string; notification: SectionNotification } | null;
  startReview: (proposalId: string, pathId: string, sectionId: string, notification: SectionNotification) => void;
  clearReview: () => void;
  // MetaRule — team's governance pipeline configuration
  metaRule?: MetaRuleConfig;
  /** Document snapshot for function execution */
  documentSnapshot: DocumentSnapshot | null;
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
