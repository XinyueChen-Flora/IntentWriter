"use client";

import type { IntentBlock, WritingBlock, OnlineUser, RoomMeta, IntentDependency } from "@/lib/partykit";
import type { DocumentMember } from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
import { usePipelineRuntime, metaRuleToPipelineConfig } from '@/hooks/usePipelineRuntime';
import { EMPTY_PIPELINE_CONFIG } from '@/lib/metarule-types';
import { primitivesToTipTapHighlights, primitivesToAlignedIntents, type SentenceAnchor } from '@/lib/primitive-to-tiptap';
import type { DocumentSnapshot } from '@/platform/data-model';
import type { ProposalDraft, DraftItem } from './IntentPanelContext';
import { getAllSenseProtocols } from '@/platform/sense/protocol';
import { resolveBindings, type ResolvedPrimitive } from '@/platform/primitives/resolver';

// Import extracted components
import { SortableBlockItem } from './ui/SortableBlockItem';
import { IntentBlockCard } from './IntentBlockCard';
import { IntentPanelProvider } from './IntentPanelContext';
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
import { ActionRequiredBar } from './ui/ActionRequiredBar';

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
  onRegisterParagraphAttributionExporter?: (blockId: string, exporter: () => import("@/platform/data-model").ParagraphAttribution[]) => void;
  ensureWritingBlocksForIntents: () => void;
  roomMeta?: RoomMeta;
  dependencies?: IntentDependency[];
  addDependency?: (dep: IntentDependency) => void;
  updateDependency?: (id: string, updates: Partial<IntentDependency>) => void;
  deleteDependency?: (id: string) => void;
  onStartWriting?: () => void;
  onBackToSetup?: () => void;
};

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
  onRegisterParagraphAttributionExporter,
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


  // Proposal draft — editing state before simulation
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft | null>(null);

  // Viewing a submitted proposal
  const [viewingProposalId, setViewingProposalId] = useState<string | null>(null);
  const [viewingProposalForSectionId, setViewingProposalForSectionId] = useState<string | null>(null);
  const [viewingProposalAffectedSectionId, setViewingProposalAffectedSectionId] = useState<string | null>(null);
  const [expandedThreadProposalId, setExpandedThreadProposalId] = useState<string | null>(null);

  // Active review — reviewer enters deliberate stage
  const [activeReview, setActiveReview] = useState<{
    proposalId: string; pathId: string; sectionId: string;
    notification: import('./IntentPanelContext').SectionNotification;
  } | null>(null);
  const startReview = useCallback((proposalId: string, pathId: string, sectionId: string, notification: import('./IntentPanelContext').SectionNotification) => {
    setActiveReview({ proposalId, pathId, sectionId, notification });
  }, []);
  const clearReview = useCallback(() => setActiveReview(null), []);

  // ─── Proposals & section notifications ───
  type ProposalRecord = {
    id: string;
    section_id: string;
    proposed_by: string;
    proposed_by_name: string;
    propose_type: 'decided' | 'negotiate' | 'input' | 'discussion';
    status: string;
    created_at: string;
    notify_user_ids: string[];
    notify_levels: Record<string, string>;
    personal_notes: Record<string, string>;
    section_impacts: Array<{
      sectionId: string;
      impactLevel: string;
      reason: string;
      suggestedChanges?: Array<{
        action: 'add' | 'modify' | 'remove';
        intentId?: string;
        content: string;
        reason: string;
      }>;
    }>;
    source_changes: any[];
    reasoning: string;
    proposal_votes: Array<{ user_id: string; vote: string }>;
  };
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);

  const refreshProposals = useCallback(() => {
    if (!roomId) return;
    fetch(`/api/proposals?documentId=${roomId}`)
      .then(res => res.json())
      .then(data => setProposals(data.proposals || []))
      .catch(console.error);
  }, [roomId]);

  // Fetch proposals on mount, when phase changes, and poll every 10s
  useEffect(() => {
    if (!isSetupPhase) refreshProposals();
  }, [isSetupPhase, refreshProposals]);

  useEffect(() => {
    if (isSetupPhase) return;
    const interval = setInterval(refreshProposals, 10000);
    return () => clearInterval(interval);
  }, [isSetupPhase, refreshProposals]);

  // Auto-open ProposalViewer for 'notify' level notifications on entry
  const autoOpenedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isSetupPhase || viewingProposalId || proposals.length === 0) return;
    // Find the first unacked 'notify' level notification
    for (const p of proposals) {
      if (p.status !== 'pending' || p.proposed_by === currentUser.id) continue;
      if (autoOpenedRef.current.has(p.id)) continue;
      const levels = p.notify_levels || {};
      // Check if any of my assigned sections have 'notify' level
      const myNotifySections = blocks.filter(b =>
        b.assignee === currentUser.id &&
        levels[b.id] === 'notify'
      );
      if (myNotifySections.length === 0) continue;
      // Check if user hasn't already responded
      const userVote = p.proposal_votes.find(v => v.user_id === currentUser.id);
      if (userVote) continue;
      // Auto-open this proposal on the first affected section
      autoOpenedRef.current.add(p.id);
      setViewingProposalId(p.id);
      setViewingProposalForSectionId(myNotifySections[0].id);
      setViewingProposalAffectedSectionId(myNotifySections[0].id);
      break;
    }
  }, [proposals, isSetupPhase, viewingProposalId, currentUser.id, blocks]);

  // Derive per-section notifications for the current user
  const getSectionNotifications = useCallback((sectionId: string): import('./IntentPanelContext').SectionNotification[] => {
    return proposals
      .filter(p => p.status === 'pending')
      .flatMap(p => {
        // Don't show notification for your own proposals
        if (p.proposed_by === currentUser.id) return [];

        // Check if this section is directly impacted
        const impact = (p.section_impacts || []).find(
          si => si.sectionId === sectionId && si.impactLevel !== 'none'
        );

        const isNegotiateType = p.propose_type === 'negotiate' || p.propose_type === 'input' || p.propose_type === 'discussion';
        const isMySection = blocks.some(b => b.id === sectionId && b.assignee === currentUser.id);
        const isSourceSection = p.section_id === sectionId;

        // Read path-specific participation config from MetaRule
        const pathConfig = roomMeta?.metaRule?.pathConfigs?.[p.propose_type] || {};
        const participantsConfig = (pathConfig.voters || pathConfig.participants || pathConfig.notifyWho || 'impacted-owners') as string;
        const isAllMembers = participantsConfig === 'all-members';

        // Determine notify level
        const storedLevels = p.notify_levels || {};
        let notifyLevel: 'skip' | 'heads-up' | 'notify' =
          (storedLevels[sectionId] as 'skip' | 'heads-up' | 'notify') || 'skip';

        if (notifyLevel === 'skip' && impact && isMySection) {
          const metaDefault = roomMeta?.metaRule?.defaultNotifyLevel ?? 'heads-up';
          notifyLevel = impact.impactLevel === 'significant' ? 'notify' : metaDefault;
        }

        if (notifyLevel === 'skip' && isNegotiateType) {
          if (isSourceSection) {
            notifyLevel = 'notify';
          } else if (isAllMembers) {
            // all-members: everyone gets notified
            notifyLevel = impact ? 'notify' : 'heads-up';
          } else {
            // impacted-owners: only people with impacted sections
            if (impact && isMySection) {
              notifyLevel = 'notify';
            } else if (isMySection) {
              notifyLevel = 'heads-up';
            }
          }
        }

        // Inform (decided): only show to impacted section owners (or all if configured)
        if (notifyLevel === 'skip' && !isNegotiateType) {
          if (isAllMembers) {
            notifyLevel = impact ? 'notify' : 'heads-up';
          } else if (impact && isMySection) {
            notifyLevel = roomMeta?.metaRule?.defaultNotifyLevel ?? 'heads-up';
          }
        }

        if (notifyLevel === 'skip') return [];

        // Check if user already responded
        const userVote = p.proposal_votes.find(v => v.user_id === currentUser.id);
        const sourceSectionBlock = blocks.find(b => b.id === p.section_id);

        // Find personal note for this section (stored in writing_previews or as part of notify data)
        // Personal notes are stored alongside notify_levels in the proposal
        const personalNotes = p.personal_notes || {};

        return [{
          proposalId: p.id,
          proposeType: p.propose_type,
          proposedBy: p.proposed_by,
          proposedByName: p.proposed_by_name,
          proposedByAvatar: documentMembers.find(m => m.userId === p.proposed_by)?.avatarUrl || undefined,
          sourceSectionId: p.section_id,
          sourceSectionName: sourceSectionBlock?.content || 'Unknown section',
          impactLevel: impact ? impact.impactLevel as 'minor' | 'significant' : 'minor',
          notifyLevel,
          reason: impact ? impact.reason : 'General team update',
          personalNote: personalNotes[sectionId] || undefined,
          suggestedChanges: impact?.suggestedChanges,
          // Proposer's original changes and reasoning
          sourceChanges: p.source_changes || [],
          reasoning: p.reasoning || '',
          createdAt: p.created_at,
          acknowledged: !!userVote,
        }];
      });
  }, [proposals, currentUser.id, blocks, documentMembers]);

  // Open a proposal draft for a section (clones children into editable items)
  // Respects existing change statuses: removed items start as isRemoved, added items as isNew,
  // modified items show previous content as originalContent so the diff is visible
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
          originalContent: rootBlock.content, // Always use CURRENT content as baseline
          isNew: false,
          isRemoved: false,
        }] : []),
        // Children — use current state as baseline
        ...children.filter(c => c.changeStatus !== 'removed').map(child => ({
          id: child.id,
          content: child.content,
          originalContent: child.content, // Current content is the baseline
          isNew: false,
          isRemoved: false,
        })),
      ];
      setProposalDraft({ rootIntentId, action, draftItems, triggerIntentId });
    } else {
      setProposalDraft({ rootIntentId, action, comment: '', triggerIntentId });
    }
  }, [blocks]);

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

  // ── Pipeline Runtime (replaces drift detection) ──
  // Cache writing content from markdown exporters for snapshot
  const [writingContentCache, setWritingContentCache] = useState<Map<string, string>>(new Map());
  const exportersRef = useRef(markdownExporters);
  exportersRef.current = markdownExporters;
  const writingBlocksRef = useRef(writingBlocks);
  writingBlocksRef.current = writingBlocks;

  // Refresh writing cache periodically — uses refs to avoid effect restarts
  useEffect(() => {
    async function refreshCache() {
      const exporters = exportersRef.current;
      if (!exporters || exporters.size === 0) return;

      const newCache = new Map<string, string>();
      for (const [wbId, exporter] of exporters) {
        try {
          const content = await exporter();
          if (content) {
            const wb = writingBlocksRef.current.find(w => w.id === wbId);
            if (wb?.linkedIntentId) {
              newCache.set(wb.linkedIntentId, content);
            }
          }
        } catch { /* skip */ }
      }
      setWritingContentCache(newCache);
    }

    // Initial refresh after a short delay (wait for editors to register exporters)
    const initialTimer = setTimeout(refreshCache, 1000);
    // Then refresh every 5 seconds
    const timer = setInterval(refreshCache, 5000);
    return () => { clearTimeout(initialTimer); clearInterval(timer); };
  }, []); // empty deps — uses refs

  const pipelineSnapshot = useMemo((): DocumentSnapshot | null => {
    if (!roomId || !currentUser) return null;
    const now = Date.now();
    const userId = currentUser.id;
    const attr = { userId, userName: currentUser.email || '', at: now };

    // Build writing array from cached content (live from TipTap) or fallback to block content
    const writing = writingBlocks
      .filter(wb => wb.linkedIntentId)
      .map(wb => {
        const cachedContent = writingContentCache.get(wb.linkedIntentId!);
        const text = cachedContent || wb.content || '';
        return {
          sectionId: wb.linkedIntentId!,
          html: '',
          text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          paragraphs: [],
        };
      });

    return {
      documentId: roomId,
      currentUserId: userId,
      phase: isSetupPhase ? 'setup' : 'writing',
      nodes: blocks.map(b => ({
        id: b.id,
        content: b.content || '',
        position: b.position ?? 0,
        parentId: b.parentId || null,
        level: b.parentId ? 1 : 0,
        createdBy: attr,
        // Proposal state (needed by apply-proposal/revert-proposal)
        changeStatus: b.changeStatus,
        proposedAction: b.proposedAction,
        previousContent: b.previousContent,
        proposalId: b.proposalId,
        proposeType: (b as any).proposeType,
        changeBy: b.changeBy,
        changeByName: b.changeByName,
      })),
      writing,
      dependencies: (dependencies || []).map(d => ({
        id: d.id,
        fromId: d.fromIntentId,
        toId: d.toIntentId,
        type: d.relationshipType || 'supports',
        label: d.label || '',
        direction: 'directed' as const,
        source: 'manual' as const,
        confirmed: true,
        createdBy: attr,
      })),
      assignments: [],
      members: [
        { userId, name: currentUser.email || '', displayName: currentUser.user_metadata?.name || currentUser.email || '', role: 'owner' as const, joinedAt: now },
        ...documentMembers
          .filter(m => m.userId !== userId)
          .map(m => ({ userId: m.userId, name: m.email || '', displayName: m.displayName || m.email || '', role: 'member' as const, joinedAt: now })),
      ],
    };
  }, [roomId, currentUser, blocks, writingBlocks, writingContentCache, dependencies, isSetupPhase]);

  const pipelineConfig = useMemo(() => {
    if (roomMeta?.metaRule) {
      return metaRuleToPipelineConfig(roomMeta.metaRule);
    }
    return EMPTY_PIPELINE_CONFIG;
  }, [roomMeta?.metaRule]);

  const pipeline = usePipelineRuntime({
    snapshot: pipelineSnapshot,
    pipelineConfig,
    sectionId: undefined,
  });

  // Resolve sense protocol UI declarations
  const senseProtocolUI = useMemo(() => {
    const allResults: Record<string, unknown> = {};
    // Gather all function results into a flat namespace
    const results = pipeline.getAllResults();
    for (const [fnId, result] of results) {
      allResults[fnId] = result.data;
      // Also spread top-level fields for template access
      if (result.data && typeof result.data === 'object') {
        for (const [key, value] of Object.entries(result.data as Record<string, unknown>)) {
          allResults[key] = value;
        }
      }
    }

    const prims: ResolvedPrimitive[] = [];
    const enabledSense = pipelineConfig.senseProtocols ?? {};
    for (const protocol of getAllSenseProtocols()) {
      const entry = enabledSense[protocol.id];
      if (!entry || !entry.enabled) continue;
      if (protocol.ui && protocol.ui.length > 0) {
        const resolved = resolveBindings(protocol.ui, allResults);
        prims.push(...resolved);
      }
    }
    return prims;
  }, [pipeline.getAllResults(), pipelineConfig.senseProtocols]);

  // Derive TipTap bridge helpers from pipeline primitives
  const getSentenceHighlights = useCallback((rootIntentId: string) => {
    const editorPrims = pipeline.primitivesByLocation['writing-editor']
      .filter(p => p.params.sectionId === rootIntentId || !p.params.sectionId);
    return primitivesToTipTapHighlights(editorPrims);
  }, [pipeline.primitivesByLocation]);

  const getAlignedIntents = useCallback((rootIntentId: string) => {
    const nodePrims = pipeline.primitivesByLocation['outline-node']
      .filter(p => p.params.sectionId === rootIntentId || !p.params.sectionId);
    return primitivesToAlignedIntents(nodePrims);
  }, [pipeline.primitivesByLocation]);

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
    onRegisterParagraphAttributionExporter,
    blocks,
    registerBlockRef,
    // Pipeline (replaces drift detection) — merge protocol UI into primitivesByLocation
    primitivesByLocation: (() => {
      // Merge sense protocol UI primitives (like "Propose Change" button on outline) into the pipeline's location map
      if (senseProtocolUI.length === 0) return pipeline.primitivesByLocation;
      const merged = { ...pipeline.primitivesByLocation };
      for (const prim of senseProtocolUI) {
        if (prim.location === 'outline-node') {
          merged['outline-node'] = [...(merged['outline-node'] || []), prim];
        }
      }
      return merged;
    })(),
    getPrimitivesForSection: pipeline.getPrimitivesForSection,
    senseProtocolUI,
    // Shared primitive action dispatch — WritingSectionPanel sets this per section
    onPrimitiveAction: undefined,
    runSenseProtocol: pipeline.runSenseProtocol,
    injectResult: pipeline.injectResult,
    getCrossSectionImpact: pipeline.getCrossSectionImpact,
    clearResult: pipeline.clearResult,
    clearAllResults: pipeline.clearAllResults,
    runFunction: pipeline.runFunction,
    isRunning: pipeline.isRunning,
    runningFunctions: pipeline.runningFunctions,
    getSentenceHighlights,
    getAlignedIntents,
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
    aiCoveredIntents,
    aiGeneratedSentences,
    markIntentAsCovered,
    getWritingContent,
    // Proposal draft
    proposalDraft,
    setProposalDraft,
    openProposalDraft,
    viewingProposalId,
    setViewingProposalId,
    viewingProposalForSectionId,
    setViewingProposalForSectionId,
    viewingProposalAffectedSectionId,
    setViewingProposalAffectedSectionId,
    getSectionNotifications,
    refreshProposals,
    expandedThreadProposalId,
    setExpandedThreadProposalId,
    activeReview,
    startReview,
    clearReview,
    metaRule: roomMeta?.metaRule,
    documentSnapshot: pipelineSnapshot,
  }), [
    blockMap, collapsedBlocks, editingBlock, hoveredBlock, selectedBlockId,
    dragDrop.dragOverId, dragDrop.activeId, isSetupPhase, activeSetupTab,
    toggleCollapse,
    addBlock, updateBlock, deleteBlock, indentBlock, outdentBlock,
    assignBlock, unassignBlock, currentUser, documentMembers, onlineUserIds, userAvatarMap,
    dependencies, addDependency, depLinks.selectedDepId, depLinks.setSelectedDepId, depLinks.hoveredDepId, depLinks.setHoveredDepId, depLinks.depColorMap, depLinks.connectedBlockIds, depLinks.dragState, depLinks.handleDragStart, intentToWritingMap, roomId, writingBlocks, deleteWritingBlock,
    updateIntentBlockRaw, onRegisterYjsExporter, onRegisterMarkdownExporter, onRegisterParagraphAttributionExporter, blocks, registerBlockRef,
    pipeline.primitivesByLocation, pipeline.runSenseProtocol, pipeline.runFunction, pipeline.isRunning, pipeline.runningFunctions, senseProtocolUI, getSentenceHighlights, getAlignedIntents,
    hoveredIntentForLink, setHoveredIntentForLink, hoveredOrphanHint, setHoveredOrphanHint, hoveredIntentFromWriting, setHoveredIntentFromWriting,
    handledOrphanStarts, markOrphanHandled,
    setEditingBlock, setHoveredBlock, setSelectedBlockId,
    getWritingContent,
    aiCoveredIntents, aiGeneratedSentences, markIntentAsCovered,
    proposalDraft, openProposalDraft,
    viewingProposalId, viewingProposalForSectionId, viewingProposalAffectedSectionId,
    getSectionNotifications, refreshProposals,
    expandedThreadProposalId, roomMeta?.metaRule, pipelineSnapshot,
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

        {/* Action required bar — floating notifications for vote/input/discussion */}
        {!isSetupPhase && <ActionRequiredBar />}

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
                items={blocks.map(b => b.id)}
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
                          // Conflict detection now via pipeline primitives (not available per-dependency yet)
                          const hasConflict = false;

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
                              {/* Conflict tooltip — placeholder for future pipeline-based conflict detection */}
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
                <button
                  onClick={handleAddBlock}
                  className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors pl-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Section</span>
                </button>
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
