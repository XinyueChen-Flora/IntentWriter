"use client";

import { createContext, useContext } from "react";
import type { IntentBlock, WritingBlock, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import type { DriftStatus, OrphanSentence, DependencyIssue, SentenceAnchor, SupportingSentence, SimulatedOutline, AlignedIntent } from "@/hooks/useDriftDetection";

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

// Section impact data for cross-section diff display
export type SectionImpactData = {
  sectionId: string;
  sectionIntent: string;
  impactLevel: 'none' | 'minor' | 'significant';
  reason: string;
  childIntents: Array<{ id: string; content: string; position: number }>;
  suggestedChanges?: Array<{
    action: 'add' | 'modify' | 'remove';
    intentId?: string;
    content: string;
    position: number;
    reason: string;
  }>;
};

// Writing preview for a section (before/after outline changes)
export type WritingPreview = {
  isLoading: boolean;
  mode?: 'prose' | 'scaffold';
  currentPreview: string;
  changedPreview: string;
};

// Active diff session - when user is viewing outline diff
export type ActiveDiffSession = {
  sourceSectionId: string;  // The section that triggered the diff
  isLoading: boolean;
  // Impact data for other sections (keyed by sectionId)
  sectionImpacts: Map<string, SectionImpactData>;
  // Writing previews (keyed by sectionId) — auto for source+significant, manual for minor
  writingPreviews: Map<string, WritingPreview>;
  // AI-simulated outline changes for the source section (from comment flow)
  sourceChanges?: Array<{ id: string; content: string; status: 'new' | 'modified' | 'removed'; reason?: string }>;
  // When true, skip writing preview for source section (initiated from writing side)
  sourceFromWriting?: boolean;
  // For "Modify Outline" mode - intent being modified/removed
  modifyIntent?: {
    intentId: string;
    intentContent: string;
    action: 'remove' | 'reword';
    suggestedReword?: string;
  };
  // The original proposal that triggered this session (from writing-phase actions)
  proposal?: IntentProposal;
};

// Proposal from user action on intent
export type IntentProposal = {
  type: 'edit' | 'remove' | 'add' | 'comment';
  intentId: string;        // The intent being acted on
  content: string;         // New content (edit/add) or comment text
  previousContent?: string; // For edit: what it was before
  afterIntentId?: string;  // For add: insert after this intent
};

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
  reason: string;
  personalNote?: string;
  suggestedChanges?: Array<{
    action: 'add' | 'modify' | 'remove';
    intentId?: string;
    content: string;
    reason: string;
  }>;
  createdAt: string;
  acknowledged: boolean; // whether current user has responded
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
  // Track intents that have AI-generated content (shown with AI badge)
  aiCoveredIntents: Set<string>;
  // AI-generated sentence mappings - for hover linking after Accept
  aiGeneratedSentences: Map<string, { intentId: string; rootIntentId: string; anchor: SentenceAnchor }>;
  // Mark intent as AI-covered AND add sentence mapping for hover linking
  markIntentAsCovered: (intentId: string, rootIntentId: string, sentenceAnchor: SentenceAnchor) => void;
  // Get writing content for a root intent (for API calls)
  getWritingContent?: (rootIntentId: string) => Promise<string>;
  // Active diff session - for cross-section inline diff display
  activeDiffSession: ActiveDiffSession | null;
  setActiveDiffSession: (session: ActiveDiffSession | null) => void;
  // Get impact data for a specific section (returns undefined if no active diff or section not impacted)
  getSectionImpact?: (sectionId: string) => SectionImpactData | undefined;
  // Propose changes (enters simulate pipeline) — single or batch
  onProposeChange?: (proposal: IntentProposal | IntentProposal[]) => void;
  // Request writing preview for a section (manual trigger for minor impact)
  requestWritingPreview?: (sectionId: string) => void;
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
