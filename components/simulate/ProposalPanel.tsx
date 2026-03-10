"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, RotateCcw, ArrowRight, Pencil, Minus, Loader2, MessageSquare, Edit2, Send, Bell, Users, Vote, UserCheck, MessagesSquare } from "lucide-react";
import type { IntentBlock } from "@/lib/partykit";
import type { DraftItem } from "../outline/IntentPanelContext";
import { useIntentPanelContext } from "../outline/IntentPanelContext";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { WordDiff } from "./WordDiff";
import { ChangeStatusBadge } from "../outline/ui/ChangeStatusBadge";
import { InformPanel } from "./InformPanel";
import type { NotifyLevel, ImpactedSection } from "./InformPanel";

type ProposeType = 'decided' | 'negotiate' | 'input' | 'discussion';

// Vote threshold: how many approvals needed to pass
type VoteThreshold = 'all' | 'majority' | 'any';

// Discussion resolution: who can close the discussion
type DiscussionResolution = 'proposer' | 'anyone' | 'consensus';

// Rules attached to a negotiate-type proposal
export type NegotiateRules = {
  voteThreshold?: VoteThreshold;
  discussionResolution?: DiscussionResolution;
};

type ProposalPanelProps = {
  rootBlock: IntentBlock;
  currentChildren: IntentBlock[];
  onClose: () => void;
};

export function ProposalPanel({ rootBlock, currentChildren, onClose }: ProposalPanelProps) {
  const ctx = useIntentPanelContext();
  const draft = ctx.proposalDraft;
  // Propose step state
  const [proposeType, setProposeType] = useState<ProposeType | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProposed, setIsProposed] = useState(false);
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set());
  // Per-person notification level for Inform mode
  const [notifyLevels, setNotifyLevels] = useState<Map<string, NotifyLevel>>(new Map());
  const [personalNotes, setPersonalNotes] = useState<Map<string, string>>(new Map());
  // Negotiate rules
  const [negotiateRules, setNegotiateRules] = useState<NegotiateRules>({
    voteThreshold: 'majority',
    discussionResolution: 'proposer',
  });
  // Snapshot of draft items at the time of last simulation, for stale detection
  const [simulatedSnapshot, setSimulatedSnapshot] = useState<string | null>(null);
  const showProposeStep = proposeType !== null;

  // Build impacted sections list (excluding current user's own sections)
  const impactedSections: ImpactedSection[] = useMemo(() => {
    const session = ctx.activeDiffSession;
    if (!session) return [];

    const sections: ImpactedSection[] = [];
    // Build a name lookup from documentMembers
    const memberNames = new Map<string, string>();
    ctx.documentMembers.forEach(m => {
      memberNames.set(m.userId, m.name || m.email?.split('@')[0] || 'Unknown');
    });

    session.sectionImpacts.forEach((impact, sectionId) => {
      if (impact.impactLevel === 'none') return;
      const sectionBlock = ctx.blocks.find(b => b.id === sectionId);
      if (!sectionBlock?.assignee) return;
      // Skip current user's own sections
      if (sectionBlock.assignee === ctx.currentUser.id) return;

      sections.push({
        sectionId,
        sectionName: sectionBlock.content,
        impactLevel: impact.impactLevel as 'minor' | 'significant',
        reason: impact.reason,
        ownerUserId: sectionBlock.assignee,
        ownerName: memberNames.get(sectionBlock.assignee) || 'Unknown',
      });
    });

    return sections;
  }, [ctx.activeDiffSession, ctx.blocks, ctx.documentMembers, ctx.currentUser.id]);

  const toggleNotify = (userId: string) => {
    setExcludedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (!draft) return null;

  const isChangeMode = draft.action === 'change';
  const isCommentMode = draft.action === 'comment';

  // ─── Change mode: editable draft items ───

  // Serialize draft items to a string for snapshot comparison
  const serializeDraft = (items: DraftItem[] | undefined) => {
    if (!items) return '';
    return items.map(i => `${i.id}:${i.content}:${i.isRemoved}`).join('|');
  };

  const currentDraftKey = serializeDraft(draft.draftItems);

  // Does the current draft match what was last simulated?
  const draftMatchesSimulation = simulatedSnapshot !== null && currentDraftKey === simulatedSnapshot;

  const updateDraftItem = (id: string, content: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.map(item =>
        item.id === id ? { ...item, content } : item
      ),
    });
  };

  const toggleRemoveItem = (id: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.map(item =>
        item.id === id ? { ...item, isRemoved: !item.isRemoved } : item
      ),
    });
  };

  const addNewItem = () => {
    if (!draft.draftItems) return;
    const newItem: DraftItem = {
      id: `new-${Date.now()}`,
      content: '',
      originalContent: '',
      isNew: true,
      isRemoved: false,
    };
    ctx.setProposalDraft({
      ...draft,
      draftItems: [...draft.draftItems, newItem],
    });
  };

  const removeNewItem = (id: string) => {
    if (!draft.draftItems) return;
    ctx.setProposalDraft({
      ...draft,
      draftItems: draft.draftItems.filter(item => item.id !== id),
    });
  };

  const updateComment = (text: string) => {
    ctx.setProposalDraft({ ...draft, comment: text });
  };

  // ─── Diff detection ───

  const hasChanges = (() => {
    if (isCommentMode) return (draft.comment?.trim() || '').length > 0;
    if (!draft.draftItems) return false;
    return draft.draftItems.some(item =>
      item.isNew ? item.content.trim() !== '' :
      item.isRemoved ? true :
      item.content !== item.originalContent
    );
  })();

  const changeCount = (() => {
    if (!draft.draftItems) return 0;
    return draft.draftItems.filter(item =>
      item.isNew ? item.content.trim() !== '' :
      item.isRemoved ? true :
      item.content !== item.originalContent
    ).length;
  })();

  // ─── Submit to simulate pipeline ───

  const handleCheckImpact = () => {
    if (!hasChanges) return;

    // Save snapshot so we can detect if draft changes after simulation
    setSimulatedSnapshot(currentDraftKey);

    if (isCommentMode) {
      ctx.onProposeChange?.({
        type: 'comment',
        intentId: draft.triggerIntentId || rootBlock.id,
        content: draft.comment || '',
      });
      return;
    }

    // Build all changes as a batch
    if (draft.draftItems) {
      const proposals = draft.draftItems
        .map(item => {
          if (item.isNew && item.content.trim()) {
            return { type: 'add' as const, intentId: rootBlock.id, content: item.content.trim() };
          }
          if (item.isRemoved) {
            return { type: 'remove' as const, intentId: item.id, content: item.originalContent };
          }
          if (item.content !== item.originalContent) {
            return { type: 'edit' as const, intentId: item.id, content: item.content, previousContent: item.originalContent };
          }
          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (proposals.length > 0) {
        ctx.onProposeChange?.(proposals);
      }
    }
  };

  // ─── Submit proposal to team ───

  const handlePropose = async () => {
    if (!reasoning.trim()) return;
    setIsSubmitting(true);

    const session = ctx.activeDiffSession;

    // Build source changes from either comment flow or change flow
    let sourceChanges: Array<{ id: string; content: string; status: string; reason?: string }> = [];
    if (session?.sourceChanges) {
      sourceChanges = session.sourceChanges;
    } else if (draft.draftItems) {
      sourceChanges = draft.draftItems
        .map(item => {
          if (item.isNew && item.content.trim()) return { id: item.id, content: item.content, status: 'new' };
          if (item.isRemoved) return { id: item.id, content: item.originalContent, status: 'removed' };
          if (item.content !== item.originalContent) return { id: item.id, content: item.content, status: 'modified' };
          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
    }

    // Serialize section impacts
    const sectionImpacts: Array<Record<string, unknown>> = [];
    session?.sectionImpacts.forEach((impact, sectionId) => {
      sectionImpacts.push({
        sectionId,
        sectionIntent: impact.sectionIntent,
        impactLevel: impact.impactLevel,
        reason: impact.reason,
        suggestedChanges: impact.suggestedChanges,
      });
    });

    // Serialize writing previews
    const writingPreviews: Record<string, { mode?: string; currentPreview: string; changedPreview: string }> = {};
    session?.writingPreviews.forEach((wp, sectionId) => {
      if (!wp.isLoading && (wp.currentPreview || wp.changedPreview)) {
        writingPreviews[sectionId] = {
          mode: wp.mode,
          currentPreview: wp.currentPreview,
          changedPreview: wp.changedPreview,
        };
      }
    });

    try {
      const notifyLevelsObj = Object.fromEntries(notifyLevels);
      const personalNotesObj = Object.fromEntries(personalNotes);

      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: ctx.roomId,
          sectionId: rootBlock.id,
          reasoning: reasoning.trim(),
          proposeType: proposeType || 'decided',
          comment: draft.comment || null,
          sourceChanges,
          sectionImpacts,
          writingPreviews,
          notifyUserIds: impactedSections
            .filter(s => (notifyLevels.get(s.sectionId) || 'skip') !== 'skip')
            .map(s => s.ownerUserId)
            .filter((id, idx, arr) => arr.indexOf(id) === idx), // dedupe
          notifyLevels: notifyLevelsObj,
          personalNotes: personalNotesObj,
          negotiateRules: (proposeType === 'negotiate' || proposeType === 'input' || proposeType === 'discussion')
            ? negotiateRules : null,
          question: null,
        }),
      });

      if (res.ok) {
        const { proposal } = await res.json();
        const proposalId = proposal?.id;

        // Apply proposed changes to real intent blocks via PartyKit
        // Only apply immediately for 'decided' — negotiate types wait for vote resolution
        const shouldApplyNow = proposeType === 'decided' || !proposeType;
        for (const change of shouldApplyNow ? sourceChanges : []) {
          if (change.status === 'modified') {
            ctx.updateIntentBlockRaw(change.id, {
              changeStatus: 'modified',
              proposalStatus: 'pending',
              proposalId,
              previousContent: currentChildren.find(c => c.id === change.id)?.content,
              content: change.content,
              changeBy: ctx.currentUser?.id,
              changeByName: ctx.currentUser?.user_metadata?.display_name || ctx.currentUser?.email?.split('@')[0],
              changeAt: Date.now(),
            });
          } else if (change.status === 'removed') {
            ctx.updateIntentBlockRaw(change.id, {
              changeStatus: 'removed',
              proposalStatus: 'pending',
              proposalId,
              changeBy: ctx.currentUser?.id,
              changeByName: ctx.currentUser?.user_metadata?.display_name || ctx.currentUser?.email?.split('@')[0],
              changeAt: Date.now(),
            });
          } else if (change.status === 'new') {
            // Add new intent block as proposed
            const newBlock = ctx.addBlock({ asChildOf: rootBlock.id });
            ctx.updateIntentBlockRaw(newBlock.id, {
              content: change.content,
              changeStatus: 'added',
              proposalStatus: 'pending',
              proposalId,
              changeBy: ctx.currentUser?.id,
              changeByName: ctx.currentUser?.user_metadata?.display_name || ctx.currentUser?.email?.split('@')[0],
              changeAt: Date.now(),
            });
          }
        }

        // Clear simulation state and refresh proposals for notifications
        ctx.setActiveDiffSession(null);
        ctx.setProposalDraft(null);
        ctx.refreshProposals();
      } else {
        console.error('Failed to submit proposal');
      }
    } catch (error) {
      console.error('Failed to submit proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Impact loading state ───

  const isLoading = ctx.activeDiffSession?.sourceSectionId === rootBlock.id && ctx.activeDiffSession.isLoading;

  // Has simulation completed? (empty impacts = no one affected, still a valid result)
  const hasSimulationResults = ctx.activeDiffSession?.sourceSectionId === rootBlock.id
    && !ctx.activeDiffSession.isLoading;

  // Simulation is "done" only if results exist AND draft hasn't changed since
  const simulationDone = hasSimulationResults && draftMatchesSimulation;

  // Draft was edited after simulation — results are stale but preserved
  const simulationStale = hasSimulationResults && !draftMatchesSimulation;

  // ─── Render ───

  // Separate root item (first) from children
  const rootDraftItem = draft.draftItems?.find(item => item.id === rootBlock.id);
  const childDraftItems = draft.draftItems?.filter(item => item.id !== rootBlock.id) || [];

  // Source changes from comment simulation
  const sourceChanges = ctx.activeDiffSession?.sourceChanges;
  const hasSourceChanges = isCommentMode && sourceChanges && sourceChanges.length > 0;

  // Build merged outline for source changes display
  const sourceMergedOutline = useMemo(() => {
    if (!hasSourceChanges) return [];
    const items: Array<{
      id: string;
      content: string;
      status: 'existing' | 'new' | 'modified' | 'removed';
      originalContent?: string;
      reason?: string;
    }> = [];

    const modifiedIds = new Set<string>();
    const removedIds = new Set<string>();
    sourceChanges!.forEach(c => {
      if (c.status === 'modified') modifiedIds.add(c.id);
      if (c.status === 'removed') removedIds.add(c.id);
    });

    currentChildren.forEach(child => {
      const change = sourceChanges!.find(c => c.id === child.id);
      if (removedIds.has(child.id)) {
        items.push({ id: child.id, content: child.content, status: 'removed', reason: change?.reason });
      } else if (modifiedIds.has(child.id) && change) {
        items.push({ id: child.id, content: change.content, status: 'modified', originalContent: child.content, reason: change.reason });
      } else {
        items.push({ id: child.id, content: child.content, status: 'existing' });
      }
    });

    sourceChanges!
      .filter(c => c.status === 'new')
      .forEach((c) => {
        items.push({ id: c.id, content: c.content, status: 'new', reason: c.reason });
      });

    return items;
  }, [hasSourceChanges, sourceChanges, currentChildren]);

  // Comment submitted state
  const isCommentSubmitted = isCommentMode && ctx.activeDiffSession?.sourceSectionId === rootBlock.id && !ctx.activeDiffSession.isLoading && hasSourceChanges;

  return (
    <div className="w-[28%] flex-shrink-0 mr-2 border rounded-lg bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">
            {isProposed ? 'Shared with Team'
              : isChangeMode ? 'Draft Changes' : 'Discussion'}
          </span>
          {isChangeMode && changeCount > 0 && !showProposeStep && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {changeCount}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ─── Change mode: always show draft items ─── */}
        {isChangeMode && draft.draftItems ? (
          <div className="p-1.5">
            {/* Root block — editable */}
            {rootDraftItem && (
              <DraftItemRow
                item={rootDraftItem}
                isRoot
                onUpdate={(content) => updateDraftItem(rootDraftItem.id, content)}
                onToggleRemove={() => toggleRemoveItem(rootDraftItem.id)}
                onRemoveNew={() => {}}
              />
            )}

            {/* Child draft items */}
            <div className="space-y-1 mt-1">
              {childDraftItems.map(item => (
                <DraftItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(content) => updateDraftItem(item.id, content)}
                  onToggleRemove={() => toggleRemoveItem(item.id)}
                  onRemoveNew={() => removeNewItem(item.id)}
                />
              ))}
            </div>

            {/* Add new item button */}
            {!showProposeStep && (
              <button
                onClick={addNewItem}
                className="mt-1.5 ml-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
              >
                <Plus className="h-3 w-3" />
                <span>Add item</span>
              </button>
            )}

            {/* ─── What's next? — inline below draft items ─── */}
            {simulationDone && !isProposed && !showProposeStep && (
              <div className="mt-3 pt-2.5 border-t mx-0.5">
                <div className="text-xs font-medium text-foreground mb-2 px-0.5">What&apos;s next?</div>

                {/* Share with Team options */}
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 px-0.5">
                  Share with team
                </div>
                <div className="space-y-1 mb-2.5">
                  <button
                    onClick={() => {
                      // Smart defaults per section: significant → notify, minor → heads-up
                      const levels = new Map<string, NotifyLevel>();
                      const notes = new Map<string, string>();
                      impactedSections.forEach(s => {
                        if (s.impactLevel === 'significant') {
                          levels.set(s.sectionId, 'notify');
                          if (s.reason) notes.set(s.sectionId, s.reason);
                        } else {
                          levels.set(s.sectionId, 'heads-up');
                        }
                      });
                      setNotifyLevels(levels);
                      setPersonalNotes(notes);
                      setProposeType('decided');
                    }}
                    className="w-full flex items-start gap-2 px-2 py-1.5 text-left text-xs rounded-md transition-colors border hover:bg-muted hover:border-primary/30"
                  >
                    <Bell className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Inform</span>
                      <span className="text-muted-foreground"> — I&apos;ve decided, letting the team know</span>
                    </div>
                  </button>
                  <NegotiateSubOptions onSelect={setProposeType} />
                </div>

                {/* Self-resolve option */}
                <div className="border-t pt-2">
                  <button
                    onClick={() => {
                      ctx.setActiveDiffSession(null);
                      onClose();
                    }}
                    className="w-full flex items-start gap-2 px-2 py-1.5 text-left text-xs rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">I&apos;ll adjust my writing</span>
                      <span> — No outline change needed, I&apos;ll align my writing instead</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ─── Inform flow ─── */}
            {showProposeStep && proposeType === 'decided' && !isProposed && (
              <InformPanel
                sections={impactedSections}
                reasoning={reasoning}
                onReasoningChange={setReasoning}
                notifyLevels={notifyLevels}
                onNotifyLevelChange={(sectionId, level) => setNotifyLevels(prev => new Map(prev).set(sectionId, level))}
                personalNotes={personalNotes}
                onPersonalNoteChange={(sectionId, note) => setPersonalNotes(prev => new Map(prev).set(sectionId, note))}
                onSubmit={handlePropose}
              />
            )}

            {/* ─── Negotiate flow (vote / input / discussion): inline form ─── */}
            {showProposeStep && (proposeType === 'negotiate' || proposeType === 'input' || proposeType === 'discussion') && !isProposed && (
              <NegotiateForm
                proposeType={proposeType}
                reasoning={reasoning}
                onReasoningChange={setReasoning}
                impactedSections={impactedSections}
                excludedUserIds={excludedUserIds}
                onToggleNotify={toggleNotify}
                onSubmit={handlePropose}
                rules={negotiateRules}
                onRulesChange={setNegotiateRules}
              />
            )}

            {/* ─── Shared confirmation ─── */}
            {isProposed && (
              <div className="mt-3 pt-2.5 border-t mx-0.5">
                <div className="p-2.5 rounded-lg bg-primary/[0.04] border border-primary/10">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Your message</div>
                  <div className="text-sm leading-relaxed">{reasoning}</div>
                </div>
              </div>
            )}
          </div>
        ) : isCommentMode ? (
          <div>
            {/* Comment bubble */}
            <div className="px-3 py-2.5 border-b">
              {/* Target intent context */}
              {draft.triggerIntentId && (() => {
                const targetBlock = ctx.blocks.find(b => b.id === draft.triggerIntentId);
                if (!targetBlock) return null;
                return (
                  <div className="text-xs text-muted-foreground mb-2">
                    Re: <span className="font-medium text-foreground/70">{targetBlock.content}</span>
                  </div>
                );
              })()}

              {/* Comment input / display */}
              {isCommentSubmitted ? (
                <div className="flex gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-foreground leading-relaxed">
                    {draft.comment}
                  </div>
                </div>
              ) : (
                <AutoResizeTextarea
                  value={draft.comment || ''}
                  onChange={updateComment}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') onClose();
                  }}
                  placeholder="What are you thinking about changing?"
                  className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
                  minRows={2}
                  autoFocus
                />
              )}
            </div>

            {/* AI-simulated outline changes (after analysis) */}
            {isLoading && (
              <div className="px-3 py-3 flex items-center gap-2 text-xs text-muted-foreground border-b">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Analyzing what this means for the outline...</span>
              </div>
            )}

            {isCommentSubmitted && sourceMergedOutline.length > 0 && (
              <div className="px-3 py-2 border-b">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Suggested Outline Changes
                </div>
                <div className="space-y-1">
                  {sourceMergedOutline.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-1.5 text-sm py-1 px-2 rounded ${
                        item.status === 'new' ? 'bg-primary/[0.04]' :
                        item.status === 'modified' ? 'bg-primary/[0.03]' :
                        item.status === 'removed' ? 'bg-muted/40' : ''
                      }`}
                    >
                      {item.status === 'new' && <Plus className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />}
                      {item.status === 'modified' && <Edit2 className="h-3 w-3 text-primary/70 flex-shrink-0 mt-0.5" />}
                      {item.status === 'removed' && <Minus className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />}
                      {item.status === 'existing' && <div className="w-3 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className={item.status === 'removed' ? 'line-through text-muted-foreground' : ''}>
                          {item.status === 'modified' && item.originalContent ? (
                            <WordDiff oldText={item.originalContent} newText={item.content} />
                          ) : item.content}
                        </div>
                        {item.reason && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">{item.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {isProposed ? (
        <div className="px-3 py-2 border-t bg-emerald-50 dark:bg-emerald-900/20 text-center">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Shared with team
          </span>
        </div>
      ) : showProposeStep ? (
        <div className="px-2 py-1.5 border-t bg-muted/30 flex gap-1.5">
          <button
            onClick={() => setProposeType(null)}
            className="px-2 py-1.5 text-xs font-medium rounded-md transition-colors border hover:bg-muted"
          >
            Back
          </button>
          <button
            onClick={handlePropose}
            disabled={!reasoning.trim() || isSubmitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {isSubmitting ? 'Submitting...' : proposeType === 'decided' ? 'Share'
              : proposeType === 'negotiate' ? 'Request Vote'
              : proposeType === 'input' ? 'Ask for Input'
              : proposeType === 'discussion' ? 'Start Discussion'
              : 'Submit'}
          </button>
        </div>
      ) : !isCommentSubmitted && !simulationDone ? (
        <div className="px-2 py-1.5 border-t bg-muted/30">
          {simulationStale && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 px-0.5">
              Draft changed since last check — re-check to update preview
            </div>
          )}
          <button
            onClick={handleCheckImpact}
            disabled={!hasChanges || isLoading}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            {isLoading ? 'Analyzing...' : simulationStale ? 'Re-check impact' : 'How does this affect our shared outline?'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Negotiate sub-options (expandable from "Negotiate" row) ───

function NegotiateSubOptions({ onSelect }: { onSelect: (type: ProposeType) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-start gap-2 px-2 py-1.5 text-left text-xs rounded-md transition-colors border hover:bg-muted hover:border-primary/30"
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Ask for input</span>
          <span className="text-muted-foreground"> — Decision isn&apos;t final, need the team</span>
        </div>
      </button>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="px-2 py-1.5 bg-muted/30 border-b">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          How should others respond?
        </div>
      </div>
      <div className="p-1 space-y-0.5">
        <button
          onClick={() => onSelect('negotiate')}
          className="w-full flex items-start gap-2 px-2 py-2 text-left text-xs rounded-md transition-colors hover:bg-muted"
        >
          <Vote className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Vote on this</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">I&apos;d like team approval before proceeding</div>
          </div>
        </button>
        <button
          onClick={() => onSelect('input')}
          className="w-full flex items-start gap-2 px-2 py-2 text-left text-xs rounded-md transition-colors hover:bg-muted"
        >
          <UserCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">You make the call</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">This affects your part — you decide what to do</div>
          </div>
        </button>
        <button
          onClick={() => onSelect('discussion')}
          className="w-full flex items-start gap-2 px-2 py-2 text-left text-xs rounded-md transition-colors hover:bg-muted"
        >
          <MessagesSquare className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Let&apos;s discuss</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Not sure yet — want to talk it through first</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Negotiate form (shared across vote / input / discussion) ───

function NegotiateForm({
  proposeType,
  reasoning,
  onReasoningChange,
  impactedSections,
  excludedUserIds,
  onToggleNotify,
  onSubmit,
  rules,
  onRulesChange,
}: {
  proposeType: 'negotiate' | 'input' | 'discussion';
  reasoning: string;
  onReasoningChange: (v: string) => void;
  impactedSections: ImpactedSection[];
  excludedUserIds: Set<string>;
  onToggleNotify: (userId: string) => void;
  onSubmit: () => void;
  rules: NegotiateRules;
  onRulesChange: (rules: NegotiateRules) => void;
}) {
  const placeholder = proposeType === 'negotiate'
    ? "I'm proposing this change. Here's why I think it works..."
    : proposeType === 'input'
      ? "This affects your section. Here's what I'm thinking..."
      : "I'm not sure about this yet. What do you all think about...";

  const modeLabel = proposeType === 'negotiate'
    ? 'Vote'
    : proposeType === 'input'
      ? 'Your Call'
      : 'Discussion';

  const modeColor = proposeType === 'negotiate'
    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
    : proposeType === 'input'
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';

  const activeCount = impactedSections.filter(s => !excludedUserIds.has(s.ownerUserId)).length;

  return (
    <div className="mt-3 pt-2.5 border-t mx-0.5 space-y-3">
      {/* Mode badge */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${modeColor}`}>
          {modeLabel}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {proposeType === 'negotiate' && 'Others will approve or reject'}
          {proposeType === 'input' && 'Affected owners decide'}
          {proposeType === 'discussion' && 'Open conversation, decide together'}
        </span>
      </div>

      {/* ─── Rules ─── */}
      {proposeType === 'negotiate' && (
        <div className="rounded-md border bg-muted/20 p-2">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Passes when
          </div>
          <div className="space-y-1">
            {([
              { value: 'all' as const, label: 'Everyone approves', desc: 'Unanimous' },
              { value: 'majority' as const, label: 'Majority approves', desc: activeCount > 0 ? `${Math.ceil(activeCount / 2)}+ of ${activeCount}` : '' },
              { value: 'any' as const, label: 'At least one approves', desc: 'Any single vote' },
            ]).map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                  rules.voteThreshold === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-muted/50'
                }`}
              >
                <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  rules.voteThreshold === opt.value ? 'border-indigo-500' : 'border-muted-foreground/30'
                }`}>
                  {rules.voteThreshold === opt.value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{opt.label}</span>
                  {opt.desc && <span className="text-muted-foreground ml-1">({opt.desc})</span>}
                </div>
                <input
                  type="radio"
                  name="voteThreshold"
                  value={opt.value}
                  checked={rules.voteThreshold === opt.value}
                  onChange={() => onRulesChange({ ...rules, voteThreshold: opt.value })}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {proposeType === 'discussion' && (
        <div className="rounded-md border bg-muted/20 p-2">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Who wraps up
          </div>
          <div className="space-y-1">
            {([
              { value: 'proposer' as const, label: 'I decide after hearing everyone', desc: 'You close the discussion' },
              { value: 'anyone' as const, label: 'Anyone involved can resolve', desc: 'First to act' },
              { value: 'consensus' as const, label: 'We all agree first', desc: 'Everyone confirms' },
            ]).map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                  rules.discussionResolution === opt.value ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-muted/50'
                }`}
              >
                <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  rules.discussionResolution === opt.value ? 'border-amber-500' : 'border-muted-foreground/30'
                }`}>
                  {rules.discussionResolution === opt.value && (
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{opt.label}</span>
                  {opt.desc && <span className="text-muted-foreground ml-1">({opt.desc})</span>}
                </div>
                <input
                  type="radio"
                  name="discussionResolution"
                  value={opt.value}
                  checked={rules.discussionResolution === opt.value}
                  onChange={() => onRulesChange({ ...rules, discussionResolution: opt.value })}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <AutoResizeTextarea
        value={reasoning}
        onChange={onReasoningChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reasoning.trim()) {
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
        minRows={3}
        autoFocus
      />

      {impactedSections.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {proposeType === 'input' ? 'Who decides' : 'Who to involve'}
          </div>
          <div className="space-y-1">
            {impactedSections.map(s => (
              <button
                key={s.sectionId}
                onClick={() => onToggleNotify(s.ownerUserId)}
                className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-left ${
                  excludedUserIds.has(s.ownerUserId)
                    ? 'bg-muted/20 opacity-50'
                    : s.impactLevel === 'significant'
                      ? 'bg-amber-50 dark:bg-amber-900/20'
                      : 'bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                  excludedUserIds.has(s.ownerUserId) ? 'border-muted-foreground/30' : 'border-primary bg-primary'
                }`}>
                  {!excludedUserIds.has(s.ownerUserId) && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                  s.impactLevel === 'significant' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{s.sectionName}</span>
                  <span className="text-muted-foreground"> — {s.ownerName}</span>
                </div>
                <span className={`text-[10px] ${
                  s.impactLevel === 'significant' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {s.impactLevel}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual draft item row ───

function DraftItemRow({
  item,
  isRoot,
  onUpdate,
  onToggleRemove,
  onRemoveNew,
}: {
  item: DraftItem;
  isRoot?: boolean;
  onUpdate: (content: string) => void;
  onToggleRemove: () => void;
  onRemoveNew: () => void;
}) {
  const [isEditing, setIsEditing] = useState(item.isNew && !item.priorChangeStatus);

  const isModified = !item.isNew && !item.isRemoved && item.content !== item.originalContent;
  const hasPriorChange = !!item.priorChangeStatus;

  const stateStyle = item.isRemoved
    ? 'border-l-2 border-l-muted-foreground/20 border-y-border border-r-border bg-muted/40 opacity-70'
    : item.isNew
      ? 'border-l-2 border-l-primary/50 border-y-border border-r-border bg-primary/[0.03] dark:bg-primary/[0.06]'
      : isModified
        ? 'border-l-2 border-l-primary/30 border-y-border border-r-border bg-primary/[0.03] dark:bg-primary/[0.05]'
        : 'border-border';

  return (
    <div className={`${isRoot ? '' : 'ml-3'} border rounded-lg px-2 py-1.5 transition-all group/item ${stateStyle}`}>
      {/* Prior change indicator — matches outline badge style */}
      {hasPriorChange && item.priorChangeStatus && (
        <div className="mb-0.5">
          <ChangeStatusBadge
            status={item.priorChangeStatus}
            changeBy={item.priorChangeBy}
            changeAt={item.priorChangeAt}
          />
        </div>
      )}

      <div className="flex items-start gap-1.5">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {item.isRemoved ? (
            <div className={`text-sm line-through text-muted-foreground ${isRoot ? 'font-medium' : ''}`}>
              {item.originalContent}
            </div>
          ) : isEditing || (item.isNew && !hasPriorChange) ? (
            <AutoResizeTextarea
              value={item.content}
              onChange={onUpdate}
              onBlur={() => { if (!item.isNew) setIsEditing(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsEditing(false);
              }}
              placeholder={item.isNew ? 'New item...' : item.originalContent}
              className={`w-full px-0.5 py-0 text-sm bg-transparent border-none focus:outline-none focus:ring-0 resize-none ${isRoot ? 'font-medium' : ''}`}
              minRows={1}
              autoFocus
            />
          ) : (
            <div
              className={`text-sm cursor-text rounded px-0.5 hover:bg-muted/50 transition-colors ${isRoot ? 'font-medium' : ''}`}
              onClick={() => setIsEditing(true)}
            >
              {isModified ? (
                <WordDiff oldText={item.originalContent} newText={item.content} />
              ) : (
                item.content
              )}
            </div>
          )}
        </div>

        {/* Right side: status indicator + action */}
        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
          {item.isNew && !hasPriorChange && (
            <Plus className="h-3 w-3 text-primary/70" />
          )}
          {item.isRemoved && !hasPriorChange && (
            <Minus className="h-3 w-3 text-muted-foreground/60" />
          )}
          {isModified && (
            <Pencil className="h-2.5 w-2.5 text-primary/60" />
          )}

          {/* Action button */}
          {item.isNew && !hasPriorChange ? (
            <button
              onClick={onRemoveNew}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          ) : item.isRemoved && !hasPriorChange ? (
            <button
              onClick={onToggleRemove}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Undo removal"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          ) : !isRoot && !hasPriorChange ? (
            <button
              onClick={onToggleRemove}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground/0 group-hover/item:text-muted-foreground/40 hover:!text-foreground transition-colors"
              title="Mark for removal"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
