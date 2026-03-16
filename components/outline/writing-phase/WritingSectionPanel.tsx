"use client";

import { useState, useMemo } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { Eye, FileText, ChevronDown, ChevronUp } from "lucide-react";
import TipTapEditor from "@/components/editor/TipTapEditor";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon } from "../ui/CoverageIcons";
import { InlineDiffView } from "@/components/simulate/InlineDiffView";
import { ProposalPanel } from "@/components/simulate/ProposalPanel";
import { ProposalViewer } from "@/components/simulate/ProposalViewer";
import { PendingDecisionView } from "@/components/simulate/PendingDecisionView";
import { SideBySideDiff } from "@/components/simulate/SideBySideDiff";
import { AlignmentSummary, type AlignmentItem, type AlignmentStatus } from "../alignment";

type WritingSectionPanelProps = {
  block: IntentBlock;
  children: IntentBlock[];
};

export function WritingSectionPanel({ block, children }: WritingSectionPanelProps) {
  const ctx = useIntentPanelContext();

  const [isLoadingGapSuggestion, setIsLoadingGapSuggestion] = useState(false);
  const [highlightFilter, setHighlightFilter] = useState<AlignmentStatus | null>(null);
  const [loadingAlignmentItemId, setLoadingAlignmentItemId] = useState<string | null>(null);
  const [summaryHidden, setSummaryHidden] = useState(false);

  // Check if there's an active pending proposal to show decision view
  const pendingProposalId = ctx.expandedThreadProposalId;
  // This section shows decision view if it's the source section of the expanded pending proposal
  const showPendingDecision = !!pendingProposalId && children.some(
    c => c.proposalId === pendingProposalId && c.changeStatus === 'proposed'
  );

  // Drift detection status
  const isRootChecking = ctx.driftCheckingIds?.has(block.id);
  const driftStatus = ctx.getDriftStatus?.(block.id);
  const sentenceHighlights = ctx.getSentenceHighlights?.(block.id);
  const matchedWritingBlock = ctx.intentToWritingMap.get(block.id);

  // Build intent coverage map for highlight colors
  const intentCoverageMap = useMemo(() => {
    if (!driftStatus?.intentCoverage) return undefined;
    const map = new Map<string, 'covered' | 'partial' | 'missing'>();
    driftStatus.intentCoverage.forEach(c => {
      map.set(c.intentId, c.status);
    });
    return map;
  }, [driftStatus?.intentCoverage]);

  // Ordered intent coverage for inline display
  const orderedIntentCoverage = useMemo(() => {
    if (!driftStatus?.intentCoverage) return undefined;
    return driftStatus.intentCoverage
      .filter(c => c.intentId !== block.id)
      .map((c) => {
        const intentBlock = children.find(b => b.id === c.intentId);
        const position = children.findIndex(ch => ch.id === c.intentId);
        return {
          intentId: c.intentId,
          intentContent: intentBlock?.content || 'Unknown intent',
          position,
          status: c.status,
          supportingSentences: c.supportingSentences || [],
          note: c.note,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [driftStatus?.intentCoverage, block.id, children]);

  // Compute alignment summary items
  const alignmentItems = useMemo((): AlignmentItem[] => {
    if (!driftStatus) return [];

    const items: AlignmentItem[] = [];

    // Add intent coverage items
    driftStatus.intentCoverage.forEach(coverage => {
      const intentBlock = coverage.intentId === block.id
        ? block
        : children.find(c => c.id === coverage.intentId);

      const isAiCovered = ctx.aiCoveredIntents?.has(coverage.intentId);
      const effectiveStatus = isAiCovered ? 'aligned' : (coverage.status === 'covered' ? 'aligned' : coverage.status);

      items.push({
        id: `intent-${coverage.intentId}`,
        status: effectiveStatus,
        intentId: coverage.intentId,
        intentContent: intentBlock?.content || 'Unknown',
        note: coverage.note,
        aiCovered: isAiCovered,
      });
    });

    // Add new intent items from aligned intents
    driftStatus.alignedIntents
      ?.filter(intent => intent.intentStatus === 'new')
      .forEach((newIntent, idx) => {
        items.push({
          id: `new-intent-${newIntent.id}`,
          status: 'orphan',
          intentId: newIntent.id,
          intentContent: newIntent.content,
          writingText: newIntent.content,
          note: `${newIntent.sentences?.length || 0} sentence${(newIntent.sentences?.length || 0) > 1 ? 's' : ''}`,
          orphanStart: newIntent.sentences?.[0]?.start,
        });
      });

    return items;
  }, [driftStatus, block, children, ctx.aiCoveredIntents]);

  // Handle "Add to Outline" from orphan
  const handleAddToOutline = async (suggestedIntent: string, orphanStart: string) => {
    const newBlock = ctx.addBlock({ asChildOf: block.id });
    ctx.updateBlock(newBlock.id, suggestedIntent);
    ctx.updateIntentBlockRaw(newBlock.id, {
      changeStatus: 'added',
      changeBy: ctx.currentUser.id,
      changeByName: ctx.currentUser.user_metadata?.name || ctx.currentUser.email,
      changeAt: Date.now(),
    });
    ctx.markOrphanHandled(orphanStart);
    setTimeout(() => ctx.triggerCheck?.(block.id), 500);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-row items-stretch">
      {/* Proposal Panel - stays visible during simulation */}
      {ctx.proposalDraft?.rootIntentId === block.id && (
        <ProposalPanel
          rootBlock={block}
          currentChildren={children}
          onClose={() => ctx.setProposalDraft(null)}
        />
      )}

      {/* Proposal Viewer - shows on the affected person's section */}
      {ctx.viewingProposalId && !ctx.proposalDraft &&
        ctx.viewingProposalForSectionId === block.id && (
        <ProposalViewer />
      )}

      {/* Inline Diff View - shows on impacted sections AND source section (comment flow) */}
      {(() => {
        const session = ctx.activeDiffSession;
        if (!session) return null;

        // Source section: outline changes are shown in ProposalPanel, skip here
        const isSourceSection = session.sourceSectionId === block.id;
        if (isSourceSection) return null;

        // Other sections: show cross-section impact
        const sectionImpact = ctx.getSectionImpact?.(block.id);
        if (!sectionImpact) return null;

        return (
          <InlineDiffView
            isSource={false}
            currentChildren={children}
            rootBlock={block}
            sectionImpact={sectionImpact}
            isLoading={session.isLoading}
            onClose={() => ctx.setActiveDiffSession(null)}
          />
        );
      })()}

      <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden flex flex-col">
        {/* Alignment Summary Panel - can be hidden */}
        {driftStatus && alignmentItems.length > 0 && !summaryHidden && (
          <AlignmentSummary
            items={alignmentItems}
            onItemClick={(item) => {
              if (item.intentId) {
                ctx.setHoveredIntentForLink(item.intentId);
              }
            }}
            onItemHover={(item) => {
              if (item?.intentId) {
                ctx.setHoveredIntentForLink(item.intentId);
                ctx.setHoveredOrphanHint(null);
              } else if (item?.orphanStart) {
                ctx.setHoveredIntentForLink(null);
                ctx.setHoveredOrphanHint(item.orphanStart);
              } else {
                ctx.setHoveredIntentForLink(null);
                ctx.setHoveredOrphanHint(null);
              }
            }}
            onExpandChange={setHighlightFilter}
            onClose={() => {
              setSummaryHidden(true);
              setHighlightFilter(null);
            }}
            loadingItemId={loadingAlignmentItemId}
            onUpdateWriting={async (item) => {
              if (!item.intentId || !item.intentContent) return;
              setLoadingAlignmentItemId(item.id);
              try {
                const currentWriting = ctx.getWritingContent ? await ctx.getWritingContent(block.id) : '';
                const response = await fetch('/api/generate-gap-suggestion', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    intentId: item.intentId,
                    intentContent: item.intentContent,
                    coverageStatus: 'missing',
                    coverageNote: item.note,
                    rootIntentId: block.id,
                    action: 'writing',
                    currentWriting,
                  }),
                });
                if (response.ok) {
                  const data = await response.json();
                  if (data.suggestion) {
                    ctx.setPendingWritingSuggestion({
                      intentId: item.intentId,
                      rootIntentId: block.id,
                      intentContent: item.intentContent,
                      suggestedContent: data.suggestion.writingUpdate || data.suggestion.writingSimulation?.content || '',
                      simulation: data.suggestion.writingSimulation,
                    });
                  }
                }
              } catch (error) {
                console.error('Failed to generate writing suggestion:', error);
              } finally {
                setLoadingAlignmentItemId(null);
              }
            }}
            onModifyOutline={async (item) => {
              if (!item.intentId || !item.intentContent) return;

              const existingSession = ctx.activeDiffSession;
              if (existingSession?.modifyIntent?.intentId === item.intentId &&
                  existingSession.sourceSectionId === block.id &&
                  !existingSession.isLoading) {
                ctx.setActiveDiffSession(null);
                return;
              }

              if (existingSession?.modifyIntent?.intentId === item.intentId && existingSession.isLoading) {
                return;
              }

              ctx.setActiveDiffSession({
                sourceSectionId: block.id,
                isLoading: true,
                sectionImpacts: new Map(),
                writingPreviews: new Map(),
                modifyIntent: {
                  intentId: item.intentId,
                  intentContent: item.intentContent,
                  action: 'remove',
                },
              });

              try {
                const allIntents = ctx.blocks.map(b => ({
                  id: b.id,
                  content: b.content,
                  parentId: b.parentId,
                }));

                const writingContents: Record<string, string> = {};
                const rootBlocks = ctx.blocks.filter(b => !b.parentId);
                for (const rootBlock of rootBlocks) {
                  if (ctx.getWritingContent) {
                    const writing = await ctx.getWritingContent(rootBlock.id);
                    if (writing) writingContents[rootBlock.id] = writing;
                  }
                }

                const response = await fetch('/api/assess-impact', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sectionId: block.id,
                    sectionIntent: block.content,
                    proposedChanges: [{
                      id: item.intentId,
                      content: item.intentContent,
                      status: 'removed',
                    }],
                    relatedSections: rootBlocks
                      .filter(rb => rb.id !== block.id)
                      .map(rb => {
                        const rbChildren = ctx.blocks
                          .filter(b => b.parentId === rb.id)
                          .map((c, idx) => ({ id: c.id, content: c.content, position: idx }));
                        return {
                          id: rb.id,
                          intentContent: rb.content,
                          childIntents: rbChildren,
                          writingContent: writingContents[rb.id] || '',
                          relationship: 'related',
                        };
                      }),
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  const impactMap = new Map<string, any>();
                  (data.impacts || []).forEach((impact: any) => {
                    if (impact.impactLevel !== 'none') {
                      impactMap.set(impact.sectionId, {
                        sectionId: impact.sectionId,
                        sectionIntent: impact.sectionIntent,
                        impactLevel: impact.impactLevel,
                        reason: impact.reason,
                        childIntents: ctx.blocks
                          .filter(b => b.parentId === impact.sectionId)
                          .map((c, idx) => ({ id: c.id, content: c.content, position: idx })),
                        suggestedChanges: impact.suggestedChanges || [],
                      });
                    }
                  });

                  ctx.setActiveDiffSession({
                    sourceSectionId: block.id,
                    isLoading: false,
                    sectionImpacts: impactMap,
                    writingPreviews: new Map(),
                    modifyIntent: {
                      intentId: item.intentId,
                      intentContent: item.intentContent,
                      action: 'remove',
                    },
                  });
                }
              } catch (error) {
                console.error('Failed to analyze impact:', error);
                ctx.setActiveDiffSession(null);
              }
            }}
            onProposeChange={(item) => {
              // Direct propose: build draft items with pre-applied modification
              const rootBlock = ctx.blocks.find(b => b.id === block.id);
              const children = ctx.blocks
                .filter(b => b.parentId === block.id)
                .sort((a, b) => a.position - b.position);

              const baseDraftItems = [
                ...(rootBlock ? [{
                  id: rootBlock.id,
                  content: rootBlock.content,
                  originalContent: rootBlock.content,
                  isNew: false,
                  isRemoved: false,
                }] : []),
                ...children.map(child => ({
                  id: child.id,
                  content: child.content,
                  originalContent: child.content,
                  isNew: false,
                  isRemoved: false,
                })),
              ];

              let draftItems = baseDraftItems;
              if (item.status === 'missing' && item.intentId) {
                // Missing in writing → propose removing from outline
                draftItems = baseDraftItems.map(d =>
                  d.id === item.intentId ? { ...d, isRemoved: true } : d
                );
              } else if (item.status === 'orphan') {
                // Orphan in writing → propose adding as new outline point
                draftItems = [
                  ...baseDraftItems,
                  {
                    id: `new-${Date.now()}`,
                    content: item.intentContent || item.writingText || '',
                    originalContent: '',
                    isNew: true,
                    isRemoved: false,
                  },
                ];
              }

              // Clear any existing diff session and set draft directly
              ctx.setActiveDiffSession(null);
              ctx.setProposalDraft({
                rootIntentId: block.id,
                action: 'change',
                draftItems,
                triggerIntentId: item.intentId || block.id,
                sourceFromWriting: true,
              });
            }}
            onAddComment={(item) => {
              // Discussion mode: open comment with pre-populated text
              let comment = '';
              if (item.status === 'missing') {
                comment = `"${item.intentContent}" doesn't seem to be addressed in the writing yet. Maybe we should reconsider whether it still belongs in this section, or rephrase it to better fit what we've written so far.`;
              } else if (item.status === 'partial') {
                comment = `"${item.intentContent}" is only partially covered right now. We might want to either narrow this outline point to match what's actually written, or expand the writing if full coverage matters here.`;
              } else if (item.status === 'orphan') {
                comment = `There's content about "${item.intentContent || item.writingText}" that goes beyond our current outline. Should we add this as a new point, or fold it into an existing one?`;
              }

              ctx.openProposalDraft(block.id, 'comment', item.intentId || block.id);
              ctx.setProposalDraft({
                rootIntentId: block.id,
                action: 'comment',
                comment,
                triggerIntentId: item.intentId || block.id,
                sourceFromWriting: true,
              });
            }}
          />
        )}

        {/* Writing Impact Preview - scaffold mode (no writing) sits above editor */}
        {(() => {
          const session = ctx.activeDiffSession;
          if (!session) return null;

          const writingPreview = session.writingPreviews?.get(block.id);
          const isSource = session.sourceSectionId === block.id;
          const sectionImpact = ctx.getSectionImpact?.(block.id);
          const isMinor = !isSource && sectionImpact?.impactLevel === 'minor';

          // Skip writing preview for source section when initiated from writing side
          if (isSource && session.sourceFromWriting) return null;

          // For minor impact without preview loaded: show trigger button
          if (isMinor && !writingPreview) {
            return (
              <button
                onClick={() => ctx.requestWritingPreview?.(block.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 border-b transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Preview writing impact</span>
              </button>
            );
          }

          // Loading state
          if (writingPreview?.isLoading) {
            return (
              <div className="px-3 py-2.5 border-b bg-muted/20 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                <span>Generating writing preview...</span>
              </div>
            );
          }

          // Scaffold mode (no writing) — show above editor as collapsible panel
          if (writingPreview?.mode === 'scaffold' && (writingPreview.currentPreview || writingPreview.changedPreview)) {
            return (
              <WritingPreviewPanel
                currentPreview={writingPreview.currentPreview}
                changedPreview={writingPreview.changedPreview}
                isSource={isSource}
                mode="scaffold"
              />
            );
          }

          // Prose mode is handled below — it replaces the editor area
          return null;
        })()}

        {/* Show summary button when hidden */}
        {driftStatus && summaryHidden && (
          <button
            onClick={() => setSummaryHidden(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border-b transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Show Alignment Summary</span>
          </button>
        )}

        {/* Pending decision view — replaces editor when reviewing a pending proposal */}
        {showPendingDecision && pendingProposalId && (
          <PendingDecisionView
            sectionId={block.id}
            proposalId={pendingProposalId}
            onDismiss={() => ctx.setExpandedThreadProposalId(null)}
          />
        )}

        {/* Normal editor — hidden during pending decision */}
        {!showPendingDecision && matchedWritingBlock ? (
          <TipTapEditor
            intent={block}
            writingBlock={matchedWritingBlock}
            roomId={ctx.roomId}
            user={ctx.currentUser}
            writingBlocks={ctx.writingBlocks as WritingBlock[]}
            deleteWritingBlock={ctx.deleteWritingBlock}
            updateIntentBlock={ctx.updateIntentBlockRaw}
            onRegisterYjsExporter={ctx.onRegisterYjsExporter}
            onRegisterMarkdownExporter={ctx.onRegisterMarkdownExporter}
            onCheckAlignment={() => ctx.triggerCheck?.(block.id)}
            isCheckingAlignment={isRootChecking}
            sentenceHighlights={sentenceHighlights}
            alignedIntents={driftStatus?.alignedIntents}
            highlightFilter={highlightFilter}
            hoveredIntentForLink={ctx.hoveredIntentForLink}
            hoveredOrphanHint={ctx.hoveredOrphanHint}
            onMakeChangeToOutline={handleAddToOutline}
            onDismissOrphan={(orphanStart) => console.log('Dismissed orphan:', orphanStart)}
            onHoverIntentFromWriting={ctx.setHoveredIntentFromWriting}
            handledOrphanStarts={ctx.handledOrphanStarts}
            markOrphanHandled={ctx.markOrphanHandled}
            intentCoverageMap={intentCoverageMap}
            orderedIntentCoverage={orderedIntentCoverage}
            onAddMissingContent={async (intentId, intentContent) => {
              const coverage = orderedIntentCoverage?.find(c => c.intentId === intentId);
              if (!coverage || coverage.status === 'covered') return;

              setIsLoadingGapSuggestion(true);
              setLoadingAlignmentItemId(`intent-${intentId}`);
              try {
                const currentWriting = ctx.getWritingContent ? await ctx.getWritingContent(block.id) : '';
                const response = await fetch('/api/generate-gap-suggestion', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    intentId,
                    intentContent,
                    coverageStatus: coverage.status,
                    coverageNote: coverage.note,
                    rootIntentId: block.id,
                    action: 'writing',
                    currentWriting,
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data.suggestion) {
                    ctx.setPendingWritingSuggestion({
                      intentId,
                      rootIntentId: block.id,
                      intentContent,
                      suggestedContent: data.suggestion.writingUpdate || data.suggestion.writingSimulation?.content || '',
                      simulation: data.suggestion.writingSimulation,
                    });
                  }
                }
              } catch (error) {
                console.error('Failed to generate suggestion:', error);
              } finally {
                setIsLoadingGapSuggestion(false);
                setLoadingAlignmentItemId(null);
              }
            }}
            pendingWritingSuggestion={ctx.pendingWritingSuggestion}
            onClearWritingSuggestion={() => ctx.setPendingWritingSuggestion(null)}
            loadingIntentId={loadingAlignmentItemId?.replace('intent-', '') || null}
            aiCoveredIntents={ctx.aiCoveredIntents}
            aiGeneratedSentences={ctx.aiGeneratedSentences}
            pureWritingMode={summaryHidden}
            onAcceptWritingSuggestion={(intentId, sentenceAnchor) => {
              ctx.markIntentAsCovered(intentId, block.id, sentenceAnchor);
            }}
            onModifyIntent={async (intentId) => {
              const coverage = orderedIntentCoverage?.find(c => c.intentId === intentId);
              if (!coverage || coverage.status === 'covered') return;

              setIsLoadingGapSuggestion(true);
              try {
                const response = await fetch('/api/generate-gap-suggestion', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    intentId,
                    intentContent: coverage.intentContent,
                    coverageStatus: coverage.status,
                    coverageNote: coverage.note,
                    rootIntentId: block.id,
                    action: 'intent',
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data.suggestion?.intentUpdate) {
                    ctx.setPendingIntentSuggestion({
                      intentId,
                      rootIntentId: block.id,
                      currentContent: coverage.intentContent,
                      suggestedContent: data.suggestion.intentUpdate,
                      isLoadingImpact: false,
                      relatedImpacts: [],
                    });
                  }
                }
              } catch (error) {
                console.error('Failed to generate suggestion:', error);
              } finally {
                setIsLoadingGapSuggestion(false);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
            Loading editor...
          </div>
        )}

      </div>

      {/* Prose mode: AI simulation panel beside the editor */}
      {(() => {
        const session = ctx.activeDiffSession;
        if (!session) return null;
        const isSource = session.sourceSectionId === block.id;
        if (isSource && session.sourceFromWriting) return null;
        const wp = session.writingPreviews?.get(block.id);
        if (wp?.mode !== 'prose' || wp.isLoading || (!wp.currentPreview && !wp.changedPreview)) return null;
        return (
          <ProseSimulationPanel
            currentText={wp.currentPreview}
            simulatedText={wp.changedPreview}
            isSource={isSource}
          />
        );
      })()}
    </div>
  );
}

// Prose mode: side panel showing AI-simulated writing changes
function ProseSimulationPanel({
  currentText,
  simulatedText,
  isSource,
}: {
  currentText: string;
  simulatedText: string;
  isSource: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = isSource ? 'Simulated Writing Change' : 'Simulated Writing Impact';

  return (
    <div className={`border rounded-lg overflow-hidden flex flex-col transition-all ${
      collapsed ? 'flex-shrink-0 w-10' : 'flex-1 min-w-0'
    } ${isSource ? 'bg-card border-primary/20' : 'bg-muted/20 border-border/50'}`}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-2 border-b text-xs font-medium transition-colors flex-shrink-0 ${
          isSource
            ? 'bg-primary/[0.04] text-foreground hover:bg-primary/[0.06]'
            : 'bg-muted/40 text-muted-foreground hover:bg-muted/50'
        }`}
      >
        {collapsed ? (
          <ChevronDown className="h-3 w-3 -rotate-90" />
        ) : (
          <ChevronUp className="h-3 w-3 rotate-90" />
        )}
        {!collapsed && (
          <>
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{label}</span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
              isSource ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              AI Simulation
            </span>
          </>
        )}
      </button>

      {/* Content — only the simulated version; current writing is in the editor */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className={`text-sm leading-relaxed ${isSource ? 'text-foreground/90' : 'text-foreground/60'}`}>
            <DiffHighlightedText oldText={currentText} newText={simulatedText} />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline diff text: shows the simulated "new" version with added parts highlighted
function DiffHighlightedText({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const segments = useMemo(() => {
    const oldTokens = oldText.match(/\S+|\s+/g) || [];
    const newTokens = newText.match(/\S+|\s+/g) || [];

    // LCS
    const m = oldTokens.length;
    const n = newTokens.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = oldTokens[i - 1] === newTokens[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const ops: Array<{ type: 'equal' | 'added' | 'removed'; token: string }> = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        ops.push({ type: 'equal', token: oldTokens[i - 1] });
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        ops.push({ type: 'removed', token: oldTokens[i - 1] });
        i--;
      } else {
        ops.push({ type: 'added', token: newTokens[j - 1] });
        j--;
      }
    }
    while (i > 0) { ops.push({ type: 'removed', token: oldTokens[i - 1] }); i--; }
    while (j > 0) { ops.push({ type: 'added', token: newTokens[j - 1] }); j--; }
    ops.reverse();

    // Merge consecutive same-type
    const merged: Array<{ type: 'equal' | 'added' | 'removed'; text: string }> = [];
    for (const op of ops) {
      const last = merged[merged.length - 1];
      if (last && last.type === op.type) last.text += op.token;
      else merged.push({ type: op.type, text: op.token });
    }
    return merged;
  }, [oldText, newText]);

  // Show equal + added (highlight added), skip removed
  return (
    <>
      {segments.filter(s => s.type !== 'removed').map((seg, i) =>
        seg.type === 'equal'
          ? <span key={i}>{seg.text}</span>
          : <span key={i} className="text-primary font-medium underline decoration-primary/40 decoration-2 underline-offset-2">{seg.text}</span>
      )}
    </>
  );
}

// Writing preview — collapsible side-by-side with AI simulation badge (scaffold mode)
function WritingPreviewPanel({
  currentPreview,
  changedPreview,
  isSource,
  mode,
}: {
  currentPreview: string;
  changedPreview: string;
  isSource: boolean;
  mode: 'prose' | 'scaffold';
}) {
  const [collapsed, setCollapsed] = useState(false);

  const label = mode === 'scaffold'
    ? (isSource ? 'Writing Scaffold Preview' : 'Writing Scaffold Impact')
    : (isSource ? 'Simulated Writing Change' : 'Simulated Writing Impact');

  return (
    <div className={`border-b ${isSource ? 'bg-primary/[0.02]' : 'bg-muted/20'}`}>
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors ${
          isSource
            ? 'text-foreground hover:bg-primary/[0.04]'
            : 'text-muted-foreground hover:bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span>{label}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isSource ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            AI Simulation
          </span>
        </div>
        {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3">
          <SideBySideDiff
            oldText={currentPreview}
            newText={changedPreview}
            className={`text-sm leading-relaxed ${isSource ? 'text-foreground/80' : 'text-foreground/60'}`}
          />
        </div>
      )}
    </div>
  );
}
