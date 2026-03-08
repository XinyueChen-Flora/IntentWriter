"use client";

import { useState, useMemo } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";
import { Eye, FileText, ChevronDown, ChevronUp } from "lucide-react";
import TipTapEditor from "@/components/editor/TipTapEditor";
import { useIntentPanelContext } from "../IntentPanelContext";
import { CoverageIcon } from "../ui/CoverageIcons";
import { InlineDiffView } from "@/components/simulate/InlineDiffView";
import { ProposalPanel } from "@/components/simulate/ProposalPanel";
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

      {/* Inline Diff View - shows on OTHER impacted sections */}
      {(() => {
        const isSourceSection = ctx.activeDiffSession?.sourceSectionId === block.id;
        if (isSourceSection) return null;
        const sectionImpact = ctx.getSectionImpact?.(block.id);
        if (!sectionImpact) return null;

        return (
          <InlineDiffView
            isSource={false}
            currentChildren={children}
            rootBlock={block}
            sectionImpact={sectionImpact}
            isLoading={ctx.activeDiffSession?.isLoading}
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

        {/* Prose mode preview — replaces editor with split left/right view */}
        {(() => {
          const wp = ctx.activeDiffSession?.writingPreviews?.get(block.id);
          const isProseActive = wp?.mode === 'prose' && !wp.isLoading && (wp.currentPreview || wp.changedPreview);
          if (!isProseActive) return null;
          return (
            <div className="flex-1 overflow-y-auto">
              <SideBySideDiff
                oldText={wp!.currentPreview}
                newText={wp!.changedPreview}
                className="text-sm leading-relaxed text-foreground/90"
                padded
              />
            </div>
          );
        })()}

        {/* Normal editor — hidden when prose preview is active */}
        {!(() => {
          const wp = ctx.activeDiffSession?.writingPreviews?.get(block.id);
          return wp?.mode === 'prose' && !wp.isLoading && (wp.currentPreview || wp.changedPreview);
        })() && matchedWritingBlock ? (
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
    </div>
  );
}

// Writing preview — side-by-side with highlighted differences
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
    : (isSource ? 'Writing Preview' : 'Writing Impact Preview');

  return (
    <div className="border-b">
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3">
          <SideBySideDiff
            oldText={currentPreview}
            newText={changedPreview}
            className={`text-sm leading-relaxed ${mode === 'scaffold' ? 'text-foreground/70' : 'text-foreground/90'}`}
          />
        </div>
      )}
    </div>
  );
}
