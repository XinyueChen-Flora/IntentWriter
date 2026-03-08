"use client";

import type { IntentBlock, WritingBlock, OnlineUser, RoomMeta, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ImportMarkdownDialog from "./ImportMarkdownDialog";
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Import custom hooks
import { useIntentDragDrop } from '@/hooks/useIntentDragDrop';
import { useIntentHierarchy } from '@/hooks/useIntentHierarchy';
import { useDependencyLinks } from '@/hooks/useDependencyLinks';
import { useDriftDetection, type SentenceAnchor } from '@/hooks/useDriftDetection';
import type { IntentProposal, ProposalDraft, DraftItem } from './IntentPanelContext';

// Import extracted components
import { SortableBlockItem } from './ui/SortableBlockItem';
import { IntentBlockCard } from './IntentBlockCard';
import { IntentPanelProvider, type ActiveDiffSession, type WritingPreview, type SectionImpactData } from './IntentPanelContext';
import { StartOutlineGuide } from './onboarding';
import {
  SetupTabBar,
  OutlineInstructionBar,
  AssignInstructionBar,
  RelationshipsInstructionBar,
  type SetupTab,
} from './setup';
import {
  RelationshipCreatorPopup,
  RelationshipSidePanel,
} from './relationship';

type IntentPanelProps = {
  blocks: readonly IntentBlock[];
  addBlock: (options?: { afterBlockId?: string; beforeBlockId?: string; asChildOf?: string }) => IntentBlock;
  updateBlock: (blockId: string, content: string) => void;
  assignBlock: (blockId: string, userId: string, userName?: string, userEmail?: string) => void;
  unassignBlock: (blockId: string) => void;
  onlineUsers: readonly OnlineUser[];
  documentMembers: readonly DocumentMember[];
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  reorderBlocks: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  writingBlocks: readonly WritingBlock[];
  importMarkdown?: (markdown: string) => void;
  currentUser: User;
  roomId: string;
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlockRaw: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  markdownExporters?: Map<string, () => Promise<string>>;
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  ensureWritingBlocksForIntents: () => void;
  roomMeta?: RoomMeta;
  dependencies?: IntentDependency[];
  addDependency?: (dep: IntentDependency) => void;
  updateDependency?: (id: string, updates: Partial<IntentDependency>) => void;
  deleteDependency?: (id: string) => void;
  onStartWriting?: () => void;
  onBackToSetup?: () => void;
};

// ─── Propose New Section (writing phase) ─────────────────────────────────

function ProposeNewSection({ onPropose }: { onPropose: (proposal: IntentProposal) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onPropose({
      type: 'add',
      intentId: '__root__', // special marker: new top-level section
      content: trimmed,
    });
    setIsOpen(false);
    setDraft("");
  };

  if (isOpen) {
    return (
      <div className="mt-4 border border-emerald-400 dark:border-emerald-500 rounded-lg px-3 py-2 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm">
        <AutoResizeTextarea
          value={draft}
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setIsOpen(false); setDraft(""); }
          }}
          placeholder="New section title..."
          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-background border border-emerald-300 dark:border-emerald-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          minRows={1}
          autoFocus
        />
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-40 border border-blue-200 dark:border-blue-800 rounded-md transition-colors"
          >
            <ArrowRight className="h-3 w-3" />
            How does this affect other sections?
          </button>
          <button
            onClick={() => { setIsOpen(false); setDraft(""); }}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors pl-1"
    >
      <Plus className="h-4 w-4" />
      <span>Propose new section</span>
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────

export default function IntentPanel({
  blocks,
  addBlock,
  updateBlock,
  assignBlock,
  unassignBlock,
  onlineUsers,
  documentMembers,
  deleteBlock,
  indentBlock,
  outdentBlock,
  reorderBlocks,
  selectedBlockId,
  setSelectedBlockId,
  writingBlocks,
  importMarkdown,
  currentUser,
  roomId,
  deleteWritingBlock,
  updateIntentBlockRaw,
  onRegisterYjsExporter,
  markdownExporters,
  onRegisterMarkdownExporter,
  ensureWritingBlocksForIntents,
  roomMeta,
  dependencies,
  addDependency,
  updateDependency,
  deleteDependency,
  onStartWriting,
  onBackToSetup,
}: IntentPanelProps) {
  const isSetupPhase = !roomMeta || roomMeta.phase === 'setup';

  // Local UI state
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  // Hover state for intent-writing linking
  const [hoveredIntentForLink, setHoveredIntentForLink] = useState<string | null>(null);
  const [hoveredOrphanHint, setHoveredOrphanHint] = useState<string | null>(null);
  // Writing → Intent hover (when hovering highlighted sentence in writing)
  const [hoveredIntentFromWriting, setHoveredIntentFromWriting] = useState<string | null>(null);
  // Track orphans that have been handled (added to outline or dismissed via "Modify Writing")
  const [handledOrphanStarts, setHandledOrphanStarts] = useState<Set<string>>(new Set());

  // Setup phase tab navigation
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>('outline');

  const markOrphanHandled = useCallback((orphanStart: string) => {
    setHandledOrphanStarts(prev => new Set(prev).add(orphanStart));
  }, []);

  // Pending writing suggestion (Intent → Writing simulation)
  const [pendingWritingSuggestion, setPendingWritingSuggestion] = useState<{
    intentId: string;
    rootIntentId: string;
    intentContent: string;
    suggestedContent: string;
  } | null>(null);

  // Pending intent suggestion (Writing → Intent simulation)
  const [pendingIntentSuggestion, setPendingIntentSuggestion] = useState<{
    intentId: string;
    rootIntentId: string;
    currentContent: string;
    suggestedContent: string;
    relatedImpacts?: Array<{ id: string; content: string; impact: string }>;
    isLoadingImpact?: boolean;
  } | null>(null);

  // Track intents that have AI-generated content (shown with AI badge)
  const [aiCoveredIntents, setAiCoveredIntents] = useState<Set<string>>(new Set());
  // AI-generated sentence mappings - for hover linking after Accept
  const [aiGeneratedSentences, setAiGeneratedSentences] = useState<Map<string, { intentId: string; rootIntentId: string; anchor: SentenceAnchor }>>(new Map());

  const markIntentAsCovered = useCallback((intentId: string, rootIntentId: string, sentenceAnchor: SentenceAnchor) => {
    setAiCoveredIntents(prev => new Set(prev).add(intentId));
    // Add sentence mapping for hover linking
    setAiGeneratedSentences(prev => {
      const newMap = new Map(prev);
      newMap.set(intentId, { intentId, rootIntentId, anchor: sentenceAnchor });
      return newMap;
    });
  }, []);

  // Active diff session - for cross-section inline diff display
  const [activeDiffSession, setActiveDiffSession] = useState<ActiveDiffSession | null>(null);

  // Proposal draft — editing state before simulation
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft | null>(null);

  // Open a proposal draft for a section (clones children into editable items)
  const openProposalDraft = useCallback((rootIntentId: string, action: 'change' | 'comment', triggerIntentId?: string) => {
    if (action === 'change') {
      const rootBlock = blocks.find(b => b.id === rootIntentId);
      const children = blocks
        .filter(b => b.parentId === rootIntentId)
        .sort((a, b) => a.position - b.position);
      const draftItems: DraftItem[] = [
        // Root block as first editable item
        ...(rootBlock ? [{
          id: rootBlock.id,
          content: rootBlock.content,
          originalContent: rootBlock.content,
          isNew: false,
          isRemoved: false,
        }] : []),
        // Children
        ...children.map(child => ({
          id: child.id,
          content: child.content,
          originalContent: child.content,
          isNew: false,
          isRemoved: false,
        })),
      ];
      setProposalDraft({ rootIntentId, action, draftItems, triggerIntentId });
    } else {
      setProposalDraft({ rootIntentId, action, comment: '', triggerIntentId });
    }
    // Clear any existing diff session
    setActiveDiffSession(null);
  }, [blocks]);

  // Get impact data for a specific section
  const getSectionImpact = useCallback((sectionId: string) => {
    if (!activeDiffSession) return undefined;
    return activeDiffSession.sectionImpacts.get(sectionId);
  }, [activeDiffSession]);

  // Refs for SVG dependency lines
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Custom hooks
  const dragDrop = useIntentDragDrop({ blocks, reorderBlocks });
  const hierarchy = useIntentHierarchy({ blocks });
  const depLinks = useDependencyLinks({
    blocks,
    dependencies,
    addDependency,
    updateDependency,
    deleteDependency,
    isSetupPhase,
    containerRef,
    blockRefs,
    currentUserId: currentUser.id,
    collapsedBlocks,
    blockMap: hierarchy.blockMap,
  });

  // Ensure writing blocks exist for all root intents
  useEffect(() => {
    ensureWritingBlocksForIntents();
  }, [blocks, ensureWritingBlocksForIntents]);

  // Map linkedIntentId → WritingBlock
  const intentToWritingMap = useMemo(() => {
    const map = new Map<string, WritingBlock>();
    writingBlocks.forEach((wb) => {
      if (wb.linkedIntentId && !map.has(wb.linkedIntentId)) {
        map.set(wb.linkedIntentId, wb as WritingBlock);
      }
    });
    return map;
  }, [writingBlocks]);

  // Drift detection hook
  const drift = useDriftDetection({
    blocks,
    dependencies,
    markdownExporters: markdownExporters || new Map(),
    intentToWritingMap,
  });

  const handleAddBlock = () => {
    const newBlock = addBlock();
    setSelectedBlockId(newBlock.id);
    setEditingBlock(newBlock.id);
  };

  const toggleCollapse = useCallback((blockId: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  // Get writing content for a root intent
  const getWritingContent = useCallback(async (rootIntentId: string): Promise<string> => {
    const writingBlock = intentToWritingMap.get(rootIntentId);
    if (!writingBlock) return '';
    const exporter = markdownExporters?.get(writingBlock.id);
    if (!exporter) return '';
    try {
      return await exporter();
    } catch {
      return '';
    }
  }, [intentToWritingMap, markdownExporters]);

  const { rootBlocks, blockMap, mergedRenderList } = hierarchy;

  const onlineUserIds = useMemo(() => {
    return new Set(onlineUsers.map((u) => u.userId));
  }, [onlineUsers]);

  // userId → avatarUrl from live socket data (always has Google avatar)
  const userAvatarMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of onlineUsers) {
      if (u.avatarUrl) map.set(u.userId, u.avatarUrl);
    }
    return map;
  }, [onlineUsers]);

  const registerBlockRef = useCallback((blockId: string, el: HTMLDivElement | null) => {
    if (el) {
      blockRefs.current.set(blockId, el);
    }
  }, []);

  // Handle propose change from intent actions (enters simulate pipeline)
  // Fetch writing preview for a section (called after impact assessment)
  const fetchWritingPreview = useCallback(async (
    sectionId: string,
    sourceSectionId: string,
    proposedChanges: Array<{ id: string; content: string; status: string }>,
    impactMap: Map<string, SectionImpactData>,
    writingContents: Record<string, string>,
    currentSession: ActiveDiffSession,
  ) => {
    const isSource = sectionId === sourceSectionId;
    const sectionBlock = blocks.find(b => b.id === sectionId);
    if (!sectionBlock) return;

    const currentChildren = blocks
      .filter(b => b.parentId === sectionId)
      .sort((a, b) => a.position - b.position);

    // Build current outline
    const currentOutline = currentChildren.map(c => ({ id: c.id, content: c.content }));

    // Build changed outline
    let changedOutline: Array<{ id: string; content: string; status: 'existing' | 'new' | 'modified' | 'removed' }>;

    if (isSource) {
      // For source section, apply proposedChanges directly
      const changeMap = new Map(proposedChanges.map(c => [c.id, c]));
      changedOutline = currentChildren.map(c => {
        const change = changeMap.get(c.id);
        if (change) {
          return { id: c.id, content: change.content, status: change.status as any };
        }
        return { id: c.id, content: c.content, status: 'existing' as const };
      });
      // Add new items
      proposedChanges
        .filter(c => c.status === 'new')
        .forEach(c => changedOutline.push({ id: c.id, content: c.content, status: 'new' }));
    } else {
      // For impacted sections, use suggestedChanges from impact data
      const impact = impactMap.get(sectionId);
      if (!impact) return;
      const modifiedIds = new Set<string>();
      const removedIds = new Set<string>();
      (impact.suggestedChanges || []).forEach(sc => {
        if (sc.action === 'modify' && sc.intentId) modifiedIds.add(sc.intentId);
        if (sc.action === 'remove' && sc.intentId) removedIds.add(sc.intentId);
      });

      changedOutline = currentChildren.map(c => {
        if (removedIds.has(c.id)) return { id: c.id, content: c.content, status: 'removed' as const };
        const mod = impact.suggestedChanges?.find(sc => sc.intentId === c.id && sc.action === 'modify');
        if (mod) return { id: c.id, content: mod.content, status: 'modified' as const };
        return { id: c.id, content: c.content, status: 'existing' as const };
      });
      (impact.suggestedChanges || [])
        .filter(sc => sc.action === 'add')
        .forEach((sc, idx) => changedOutline.push({ id: `new-${idx}`, content: sc.content, status: 'new' }));
    }

    // Set loading state
    setActiveDiffSession(prev => {
      if (!prev) return prev;
      const previews = new Map(prev.writingPreviews);
      previews.set(sectionId, { isLoading: true, mode: undefined, currentPreview: '', changedPreview: '' });
      return { ...prev, writingPreviews: previews };
    });

    try {
      const response = await fetch('/api/preview-writing-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionIntent: sectionBlock.content,
          currentOutline,
          changedOutline,
          existingWriting: writingContents[sectionId] || '',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setActiveDiffSession(prev => {
          if (!prev) return prev;
          const previews = new Map(prev.writingPreviews);
          previews.set(sectionId, {
            mode: data.mode || 'prose',
            currentPreview: data.currentPreview || '',
            changedPreview: data.changedPreview || '',
            isLoading: false,
          });
          return { ...prev, writingPreviews: previews };
        });
      }
    } catch (error) {
      console.error('Failed to fetch writing preview:', error);
      setActiveDiffSession(prev => {
        if (!prev) return prev;
        const previews = new Map(prev.writingPreviews);
        previews.delete(sectionId);
        return { ...prev, writingPreviews: previews };
      });
    }
  }, [blocks]);

  // Manual trigger for minor impact sections
  const requestWritingPreview = useCallback((sectionId: string) => {
    const session = activeDiffSession;
    if (!session) return;

    const writingContentsPromise = (async () => {
      const contents: Record<string, string> = {};
      const writing = await getWritingContent(sectionId);
      if (writing) contents[sectionId] = writing;
      return contents;
    })();

    // Build proposedChanges from the draft
    const draft = proposalDraft;
    if (!draft?.draftItems) return;

    const proposedChanges = draft.draftItems
      .map(item => {
        if (item.isNew && item.content.trim()) return { id: `new-${item.id}`, content: item.content, status: 'new' };
        if (item.isRemoved) return { id: item.id, content: item.originalContent, status: 'removed' };
        if (item.content !== item.originalContent) return { id: item.id, content: item.content, status: 'modified' };
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    writingContentsPromise.then(writingContents => {
      fetchWritingPreview(sectionId, session.sourceSectionId, proposedChanges, session.sectionImpacts, writingContents, session);
    });
  }, [activeDiffSession, proposalDraft, getWritingContent, fetchWritingPreview]);

  const handleProposeChange = useCallback(async (proposalOrBatch: IntentProposal | IntentProposal[]) => {
    const proposals = Array.isArray(proposalOrBatch) ? proposalOrBatch : [proposalOrBatch];
    if (proposals.length === 0) return;

    // Find the root section from the first proposal
    const findRootId = (intentId: string): string => {
      const block = blocks.find(b => b.id === intentId);
      if (!block || !block.parentId) return intentId;
      return findRootId(block.parentId);
    };
    const rootId = findRootId(proposals[0].intentId);

    // Build proposed changes for the simulate API
    const proposedChanges: Array<{ id: string; content: string; status: 'new' | 'modified' | 'removed' }> = [];

    for (const proposal of proposals) {
      if (proposal.type === 'edit') {
        proposedChanges.push({ id: proposal.intentId, content: proposal.content, status: 'modified' });
      } else if (proposal.type === 'remove') {
        proposedChanges.push({ id: proposal.intentId, content: proposal.content, status: 'removed' });
      } else if (proposal.type === 'add') {
        proposedChanges.push({ id: `proposed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, content: proposal.content, status: 'new' });
      } else if (proposal.type === 'comment') {
        proposedChanges.push({ id: proposal.intentId, content: `[Comment] ${proposal.content}`, status: 'modified' });
      }
    }

    // Set up diff session with loading state
    setActiveDiffSession({
      sourceSectionId: rootId,
      isLoading: true,
      sectionImpacts: new Map(),
      writingPreviews: new Map(),
      proposal: proposals[0],
    });

    try {
      // Get writing content for all sections
      const writingContents: Record<string, string> = {};
      const rootBlocks = blocks.filter(b => !b.parentId);
      for (const rb of rootBlocks) {
        const writing = await getWritingContent(rb.id);
        if (writing) writingContents[rb.id] = writing;
      }

      // Include the source section's current outline for context
      const rootBlock = blocks.find(b => b.id === rootId);
      const sourceChildren = blocks
        .filter(b => b.parentId === rootId)
        .map((c, idx) => ({ id: c.id, content: c.content, position: idx }));

      // Call assess-impact API with full outline
      const response = await fetch('/api/assess-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: rootId,
          sectionIntent: rootBlock?.content || '',
          sectionChildren: sourceChildren,
          proposedChanges,
          // Send ALL other sections — AI determines relationships
          relatedSections: rootBlocks
            .filter(rb => rb.id !== rootId)
            .map(rb => {
              const rbChildren = blocks
                .filter(b => b.parentId === rb.id)
                .map((c, idx) => ({ id: c.id, content: c.content, position: idx }));
              return {
                id: rb.id,
                intentContent: rb.content,
                childIntents: rbChildren,
                writingContent: writingContents[rb.id] || '',
              };
            }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const impactMap = new Map<string, any>();
        (data.impacts || []).forEach((impact: any) => {
          impactMap.set(impact.sectionId, {
            sectionId: impact.sectionId,
            sectionIntent: impact.sectionIntent,
            impactLevel: impact.impactLevel,
            reason: impact.reason,
            childIntents: blocks
              .filter(b => b.parentId === impact.sectionId)
              .map((c, idx) => ({ id: c.id, content: c.content, position: idx })),
            suggestedChanges: impact.suggestedChanges || [],
          });
        });

        const session: ActiveDiffSession = {
          sourceSectionId: rootId,
          isLoading: false,
          sectionImpacts: impactMap,
          writingPreviews: new Map(),
          proposal: proposals[0],
        };
        setActiveDiffSession(session);

        // Auto-trigger writing previews for source + significant impact sections
        const autoPreviewIds = [rootId];
        impactMap.forEach((impact, sectionId) => {
          if (impact.impactLevel === 'significant') {
            autoPreviewIds.push(sectionId);
          }
        });

        for (const sectionId of autoPreviewIds) {
          fetchWritingPreview(sectionId, rootId, proposedChanges, impactMap, writingContents, session);
        }
      }
    } catch (error) {
      console.error('Failed to simulate proposal impact:', error);
      setActiveDiffSession(null);
    }
  }, [blocks, getWritingContent]);

  const contextValue = useMemo(() => ({
    blockMap,
    collapsedBlocks,
    editingBlock,
    hoveredBlock,
    selectedBlockId,
    dragOverId: dragDrop.dragOverId,
    activeId: dragDrop.activeId,
    isSetupPhase,
    activeSetupTab,
    setEditingBlock,
    setHoveredBlock,
    setSelectedBlockId,
    toggleCollapse,
    addBlock,
    updateBlock,
    deleteBlock,
    indentBlock,
    outdentBlock,
    assignBlock,
    unassignBlock,
    currentUser,
    documentMembers,
    onlineUserIds,
    userAvatarMap,
    dependencies,
    addDependency,
    selectedDepId: depLinks.selectedDepId,
    setSelectedDepId: depLinks.setSelectedDepId,
    hoveredDepId: depLinks.hoveredDepId,
    setHoveredDepId: depLinks.setHoveredDepId,
    depColorMap: depLinks.depColorMap,
    // Drag-to-connect
    isDraggingConnection: !!depLinks.dragState,
    handleConnectionDragStart: depLinks.handleDragStart,
    connectedBlockIds: depLinks.connectedBlockIds,
    intentToWritingMap,
    roomId,
    writingBlocks,
    deleteWritingBlock,
    updateIntentBlockRaw,
    onRegisterYjsExporter,
    onRegisterMarkdownExporter,
    blocks,
    registerBlockRef,
    // Drift detection
    driftCheckingIds: drift.checkingIds,
    triggerCheck: drift.triggerCheck,
    getDriftStatus: drift.getDriftStatus,
    getSentenceHighlights: drift.getSentenceHighlights,
    getConflictForDependency: drift.getConflictForDependency,
    // Hover state for intent-writing linking
    hoveredIntentForLink,
    setHoveredIntentForLink,
    hoveredOrphanHint,
    setHoveredOrphanHint,
    hoveredIntentFromWriting,
    setHoveredIntentFromWriting,
    // Handled orphans
    handledOrphanStarts,
    markOrphanHandled,
    // Simulated outline
    getSimulatedOutline: drift.getSimulatedOutline,
    hasSimulatedOutline: drift.hasSimulatedOutline,
    // Pending writing suggestion (Intent → Writing)
    pendingWritingSuggestion,
    setPendingWritingSuggestion,
    pendingIntentSuggestion,
    setPendingIntentSuggestion,
    aiCoveredIntents,
    aiGeneratedSentences,
    markIntentAsCovered,
    getWritingContent,
    // Active diff session
    activeDiffSession,
    setActiveDiffSession,
    getSectionImpact,
    onProposeChange: handleProposeChange,
    requestWritingPreview,
    // Proposal draft
    proposalDraft,
    setProposalDraft,
    openProposalDraft,
  }), [
    blockMap, collapsedBlocks, editingBlock, hoveredBlock, selectedBlockId,
    dragDrop.dragOverId, dragDrop.activeId, isSetupPhase, activeSetupTab,
    toggleCollapse,
    addBlock, updateBlock, deleteBlock, indentBlock, outdentBlock,
    assignBlock, unassignBlock, currentUser, documentMembers, onlineUserIds, userAvatarMap,
    dependencies, addDependency, depLinks.selectedDepId, depLinks.setSelectedDepId, depLinks.hoveredDepId, depLinks.setHoveredDepId, depLinks.depColorMap, depLinks.connectedBlockIds, depLinks.dragState, depLinks.handleDragStart, intentToWritingMap, roomId, writingBlocks, deleteWritingBlock,
    updateIntentBlockRaw, onRegisterYjsExporter, onRegisterMarkdownExporter, blocks, registerBlockRef,
    drift.checkingIds, drift.triggerCheck, drift.getDriftStatus, drift.getSentenceHighlights, drift.getConflictForDependency, drift.getSimulatedOutline, drift.hasSimulatedOutline,
    hoveredIntentForLink, setHoveredIntentForLink, hoveredOrphanHint, setHoveredOrphanHint, hoveredIntentFromWriting, setHoveredIntentFromWriting,
    handledOrphanStarts, markOrphanHandled,
    setEditingBlock, setHoveredBlock, setSelectedBlockId,
    pendingWritingSuggestion, pendingIntentSuggestion, getWritingContent,
    aiCoveredIntents, aiGeneratedSentences, markIntentAsCovered,
    activeDiffSession, getSectionImpact, handleProposeChange, requestWritingPreview,
    proposalDraft, openProposalDraft,
  ]);

  return (
    <IntentPanelProvider value={contextValue}>
    <DndContext
      sensors={dragDrop.sensors}
      collisionDetection={closestCenter}
      onDragStart={dragDrop.handleDragStart}
      onDragOver={dragDrop.handleDragOver}
      onDragEnd={dragDrop.handleDragEnd}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Toolbar */}
        {blocks.length > 0 && (
          <div className="flex-shrink-0 border-b">
            {isSetupPhase ? (
              /* Setup phase: Tab navigation */
              (() => {
                const assignedCount = blocks.filter(b => b.assignee).length;
                const unconfirmedCount = dependencies?.filter(d => !d.confirmed).length || 0;
                const relationshipCount = dependencies?.length || 0;

                return (
                  <div>
                    <SetupTabBar
                      activeTab={activeSetupTab}
                      onTabChange={setActiveSetupTab}
                      rootBlocksCount={rootBlocks.length}
                      assignedCount={assignedCount}
                      relationshipCount={relationshipCount}
                      unconfirmedCount={unconfirmedCount}
                      onStartWriting={onStartWriting}
                    />

                    {activeSetupTab === 'outline' && (
                      <OutlineInstructionBar
                        rootBlocksCount={rootBlocks.length}
                        onAddSection={handleAddBlock}
                        onNextStep={() => setActiveSetupTab('assign')}
                        ImportMarkdownDialog={importMarkdown ? ImportMarkdownDialog : undefined}
                        onImportMarkdown={importMarkdown}
                      />
                    )}

                    {activeSetupTab === 'assign' && (
                      <AssignInstructionBar
                        assignedCount={assignedCount}
                        totalCount={rootBlocks.length}
                        onNextStep={() => setActiveSetupTab('relationships')}
                      />
                    )}

                    {activeSetupTab === 'relationships' && (
                      <RelationshipsInstructionBar
                        rootBlocksCount={rootBlocks.length}
                        relationshipCount={relationshipCount}
                        unconfirmedCount={unconfirmedCount}
                        isDetecting={depLinks.isDetectingDeps}
                        onDetectWithAI={depLinks.handleDetectDependencies}
                      />
                    )}
                  </div>
                );
              })()
            ) : null}
          </div>
        )}

        {/* Main content area with optional side panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Outline content */}
          <div className={`flex-1 flex flex-col overflow-hidden transition-all ${
            isSetupPhase && dependencies && dependencies.filter(d => !d.confirmed).length > 0 ? 'pr-0' : ''
          }`}>
            {blocks.length === 0 ? (
              <StartOutlineGuide
                onAddFirstSection={handleAddBlock}
                onImportMarkdown={importMarkdown}
                ImportMarkdownDialog={importMarkdown ? ImportMarkdownDialog : undefined}
              />
            ) : (
              <SortableContext
                items={rootBlocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 min-h-0 relative bg-background" onClick={() => depLinks.setSelectedDepId(null)}>
              {/* SVG dependency lines overlay — uses content-relative coords so it scrolls with content */}
              {depLinks.depLines.length > 0 && (
                <svg
                  className="absolute top-0 left-0 w-full pointer-events-none z-10"
                  style={{ height: containerRef.current?.scrollHeight || '100%', overflow: 'visible' }}
                >
                  {(() => {
                    const explicit = depLinks.depLines.filter(l => !l.inherited);
                    const sel = depLinks.selectedDepId;
                    const hov = depLinks.hoveredDepId;

                    return (
                      <>
                        {explicit.map((line, idx) => {
                          // Use bezier curve for smoother appearance
                          // In writing phase, use much smaller gap to stay within outline area
                          const baseGap = isSetupPhase ? (25 + idx * 18) : (15 + idx * 10);
                          const maxGap = isSetupPhase ? 120 : 50; // Tighter in writing phase
                          const gap = Math.min(baseGap, maxGap);
                          const controlX = Math.max(line.x1, line.x2) + gap;

                          // Bezier curve path: start → control point → end
                          const path = `M ${line.x1} ${line.y1} C ${controlX} ${line.y1}, ${controlX} ${line.y2}, ${line.x2} ${line.y2}`;
                          const isBidi = line.dep.direction === 'bidirectional';

                          // Check for conflict on this dependency
                          const conflict = drift.getConflictForDependency(line.dep.fromIntentId, line.dep.toIntentId);
                          const hasConflict = !!conflict;

                          // Use red for conflicts, otherwise original color
                          const c = hasConflict ? '#ef4444' : line.color;

                          // Subtle by default, vivid on hover
                          // In writing phase, make lines more subtle
                          const isHighlighted = line.id === sel || line.id === hov;
                          const lineOpacity = isSetupPhase
                            ? (isHighlighted ? 0.9 : 0.4)
                            : (isHighlighted ? 0.7 : 0.25);
                          const lineWidth = isHighlighted ? 2 : 1.5;

                          // Small arrowhead at "to" end
                          const a = 8;
                          const toArrow = `${line.x2 + a},${line.y2 - a / 2} ${line.x2},${line.y2} ${line.x2 + a},${line.y2 + a / 2}`;

                          // Label position - in writing phase, position closer to curve
                          const labelX = controlX + 8;
                          const labelY = (line.y1 + line.y2) / 2;

                          return (
                            <g key={line.id}>
                              {/* Wide invisible hit area */}
                              <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={16}
                                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                onMouseEnter={() => depLinks.setHoveredDepId(line.id)}
                                onMouseLeave={() => depLinks.setHoveredDepId(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Toggle selection (delete via dedicated button)
                                  depLinks.setSelectedDepId(sel === line.id ? null : line.id);
                                }}
                              />
                              {/* Visible curve */}
                              <path
                                d={path}
                                fill="none"
                                stroke={c}
                                strokeWidth={lineWidth}
                                strokeDasharray={line.dashed ? '6 4' : undefined}
                                opacity={lineOpacity}
                              />
                              {/* Arrowhead at "to" end */}
                              <polygon points={toArrow} fill={c} opacity={lineOpacity} />
                              {/* Small dot at "from" end */}
                              <circle cx={line.x1} cy={line.y1} r={3} fill={c} opacity={lineOpacity} />
                              {/* Label with hover actions - in writing phase, only show on hover */}
                              {(isSetupPhase || isHighlighted) && (
                              <foreignObject
                                x={labelX - 6}
                                y={labelY - 14}
                                width={200}
                                height={28}
                                style={{ overflow: 'visible', pointerEvents: 'auto' }}
                                onMouseEnter={() => depLinks.setHoveredDepId(line.id)}
                                onMouseLeave={() => depLinks.setHoveredDepId(null)}
                              >
                                <div
                                  className={`inline-flex items-center h-7 rounded-full border shadow-sm transition-all ${
                                    isHighlighted
                                      ? 'bg-background border-primary'
                                      : 'bg-background/90 border-border'
                                  }`}
                                  style={{ opacity: isHighlighted ? 1 : 0.8 }}
                                >
                                  {/* Label */}
                                  <span className={`px-3 text-sm font-medium ${
                                    hasConflict ? 'text-destructive' : 'text-primary'
                                  }`}>
                                    {hasConflict ? '⚠ ' : ''}{line.dep.label}
                                  </span>

                                  {/* Action buttons - visible on hover in setup phase */}
                                  {isHighlighted && isSetupPhase && (
                                    <div className="flex items-center border-l border-border">
                                      {/* Edit button */}
                                      {updateDependency && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            depLinks.setSelectedDepId(null);
                                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                                            depLinks.openEditPopup(line.dep, rect.left, rect.bottom + 4);
                                          }}
                                          className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                                          title="Edit"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                      )}
                                      {/* Delete button */}
                                      {deleteDependency && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteDependency(line.dep.id);
                                          }}
                                          className="w-7 h-7 flex items-center justify-center rounded-r-full text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
                                          title="Delete"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </foreignObject>
                              )}
                              {/* Conflict tooltip on hover */}
                              {hasConflict && isHighlighted && (
                                <foreignObject
                                  x={labelX}
                                  y={labelY + 10}
                                  width={180}
                                  height={50}
                                  style={{ overflow: 'visible' }}
                                >
                                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded px-2 py-1 text-xs text-red-700 dark:text-red-300 shadow-sm">
                                    {conflict.issue}
                                  </div>
                                </foreignObject>
                              )}
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}

              {/* Drag preview line - shown while dragging to create a connection */}
              {depLinks.dragPreviewLine && (
                <svg
                  className="absolute top-0 left-0 w-full pointer-events-none z-20"
                  style={{ height: containerRef.current?.scrollHeight || '100%', overflow: 'visible' }}
                >
                  <line
                    x1={depLinks.dragPreviewLine.x1}
                    y1={depLinks.dragPreviewLine.y1}
                    x2={depLinks.dragPreviewLine.x2}
                    y2={depLinks.dragPreviewLine.y2}
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    strokeDasharray="8,4"
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                  {/* Circle at cursor end */}
                  <circle
                    cx={depLinks.dragPreviewLine.x2}
                    cy={depLinks.dragPreviewLine.y2}
                    r={6}
                    fill="hsl(var(--primary))"
                    opacity={0.7}
                  />
                  {/* Circle at source end */}
                  <circle
                    cx={depLinks.dragPreviewLine.x1}
                    cy={depLinks.dragPreviewLine.y1}
                    r={4}
                    fill="hsl(var(--primary))"
                  />
                </svg>
              )}

              {mergedRenderList.map((item, idx) => (
                <SortableBlockItem key={item.data.id} id={item.data.id}>
                  <IntentBlockCard
                    block={item.data}
                    isRoot={true}
                    depth={0}
                    rootIndex={idx}
                  />
                </SortableBlockItem>
              ))}

              {/* Add Section button at the bottom */}
              {isSetupPhase ? (
                <button
                  onClick={handleAddBlock}
                  className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors pl-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Section</span>
                </button>
              ) : (
                <ProposeNewSection onPropose={handleProposeChange} />
              )}
            </div>
          </SortableContext>
        )}
          </div>

          {/* Right: Relationship side panel - only show when there are AI-suggested unconfirmed deps */}
          {isSetupPhase && dependencies && dependencies.some(d => d.source === 'ai-suggested' && !d.confirmed) && (
            <RelationshipSidePanel
              dependencies={dependencies}
              blocks={blocks}
              hoveredDepId={depLinks.hoveredDepId}
              selectedDepId={depLinks.selectedDepId}
              onHoverDep={depLinks.setHoveredDepId}
              onConfirm={(id) => updateDependency?.(id, { confirmed: true, source: 'ai-confirmed' })}
              onDelete={(id) => deleteDependency?.(id)}
            />
          )}
        </div>

      </div>

      {/* Relationship creator popup */}
      {depLinks.depCreator && (() => {
        // Find the dependency being edited (if any)
        const editingDep = depLinks.depCreator.depId
          ? dependencies?.find(d => d.id === depLinks.depCreator!.depId)
          : undefined;

        return (
          <RelationshipCreatorPopup
            x={depLinks.depCreator.x}
            y={depLinks.depCreator.y}
            onCreate={depLinks.handleCreateDependency}
            onCancel={depLinks.handleCancelDependency}
            currentType={editingDep?.relationshipType}
            currentLabel={editingDep?.label}
            isEditing={depLinks.depCreator.isEditing}
          />
        );
      })()}

      {/* Drag Overlay */}
      <DragOverlay>
        {dragDrop.activeId ? (
          <div className="bg-background border border-primary rounded-lg p-3 shadow-lg opacity-80">
            {blocks.find(b => b.id === dragDrop.activeId)?.content || 'Dragging...'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </IntentPanelProvider>
  );
}
