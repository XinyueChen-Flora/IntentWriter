"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Minus, Edit2, Loader2, ArrowRight, ArrowLeft, MessageSquare, Clock, Check, XIcon, Send } from "lucide-react";
import { getPathUI } from "@/platform/coordination/ui";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { useIntentPanelContext } from "../outline/IntentPanelContext";
import { WordDiff } from "./WordDiff";
import UserAvatar from "@/components/user/UserAvatar";
import type { SectionImpactData, WritingPreview } from "../outline/IntentPanelContext";

import type { NegotiateRules } from "./ProposalPanel";

type ProposalVote = {
  id: string;
  user_id: string;
  vote: string;
  comment: string | null;
  voted_at: string;
};

type ProposalData = {
  id: string;
  section_id: string;
  proposed_by: string;
  proposed_by_name: string;
  propose_type: string;
  created_at: string;
  reasoning: string;
  comment: string | null;
  negotiate_rules: NegotiateRules | null;
  source_changes: Array<{ id: string; content: string; status: string; reason?: string }>;
  section_impacts: Array<{
    sectionId: string;
    sectionIntent: string;
    impactLevel: string;
    reason: string;
    suggestedChanges?: Array<{
      action: 'add' | 'modify' | 'remove';
      intentId?: string;
      content: string;
      position: number;
      reason: string;
    }>;
  }>;
  writing_previews: Record<string, { mode?: string; currentPreview: string; changedPreview: string }>;
  proposal_votes?: ProposalVote[];
  status: string;
};

type ReviewStep = 'source' | 'impact';

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ProposalViewer() {
  const ctx = useIntentPanelContext();
  const proposalId = ctx.viewingProposalId;
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<ReviewStep>('source');
  const [voteComment, setVoteComment] = useState('');
  const [isVoting, setIsVoting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const affectedSectionId = ctx.viewingProposalAffectedSectionId;

  // Load proposal and set up activeDiffSession
  useEffect(() => {
    if (!proposalId) {
      setProposal(null);
      return;
    }

    setStep('source');
    setIsLoading(true);

    fetch(`/api/proposals?documentId=${ctx.roomId}`)
      .then(res => res.json())
      .then(data => {
        const found = (data.proposals || []).find((p: ProposalData) => p.id === proposalId);
        setProposal(found || null);

        if (found) {
          const impactMap = new Map<string, SectionImpactData>();
          (found.section_impacts || []).forEach((impact: ProposalData['section_impacts'][0]) => {
            impactMap.set(impact.sectionId, {
              sectionId: impact.sectionId,
              sectionIntent: impact.sectionIntent,
              impactLevel: impact.impactLevel as 'none' | 'minor' | 'significant',
              reason: impact.reason,
              childIntents: ctx.blocks
                .filter(b => b.parentId === impact.sectionId)
                .map((c, idx) => ({ id: c.id, content: c.content, position: idx })),
              suggestedChanges: (impact.suggestedChanges || []).map(c => ({
                action: c.action,
                content: c.content,
                position: c.position,
                reason: c.reason,
                intentId: c.intentId,
              })),
            });
          });

          const previewMap = new Map<string, WritingPreview>();
          Object.entries(found.writing_previews || {}).forEach(([sectionId, wpRaw]) => {
            const wp = wpRaw as { mode?: string; currentPreview: string; changedPreview: string };
            previewMap.set(sectionId, {
              isLoading: false,
              mode: (wp.mode as 'prose' | 'scaffold') || 'scaffold',
              currentPreview: wp.currentPreview,
              changedPreview: wp.changedPreview,
            });
          });

          const sourceChanges = (found.source_changes || []).map((c: ProposalData['source_changes'][0]) => ({
            id: c.id,
            content: c.content,
            status: c.status as 'new' | 'modified' | 'removed',
            reason: c.reason,
          }));

          ctx.setActiveDiffSession({
            sourceSectionId: found.section_id,
            isLoading: false,
            sectionImpacts: impactMap,
            writingPreviews: previewMap,
            sourceChanges,
          });

          // Auto-navigate to source section
          ctx.setViewingProposalForSectionId(found.section_id);
          setTimeout(() => {
            const el = document.querySelector(`[data-block-id="${found.section_id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.querySelector(`[data-block-id="${sectionId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const submitVote = useCallback(async (vote: string, comment?: string) => {
    if (!proposalId) return;
    setIsVoting(true);
    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote, comment: comment || null }),
      });
      const data = await res.json();
      ctx.refreshProposals();
      // Update local proposal state with the new vote + resolution
      setProposal(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          proposal_votes: [
            ...(prev.proposal_votes || []),
            { id: 'local', user_id: ctx.currentUser.id, vote, comment: comment || null, voted_at: new Date().toISOString() },
          ],
        };
        if (data.resolved) {
          updated.status = data.resolved;
        }
        return updated;
      });
      setVoteComment('');
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setIsVoting(false);
    }
  }, [proposalId, ctx]);

  const onClose = useCallback(() => {
    ctx.setViewingProposalId(null);
    ctx.setViewingProposalForSectionId(null);
    ctx.setViewingProposalAffectedSectionId(null);
    ctx.setActiveDiffSession(null);
  }, [ctx]);

  // Manual resolve (discussion type — proposer wraps up)
  const resolveProposal = useCallback(async (resolution: 'approved' | 'rejected') => {
    if (!proposalId) return;
    setIsResolving(true);
    try {
      await fetch('/api/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, resolution }),
      });
      ctx.refreshProposals();
      setProposal(prev => prev ? { ...prev, status: resolution } : prev);
    } catch (error) {
      console.error('Failed to resolve proposal:', error);
    } finally {
      setIsResolving(false);
    }
  }, [proposalId, ctx]);

  // Apply approved changes to outline (same logic as decided flow in ProposalPanel)
  const applyApprovedChanges = useCallback(() => {
    if (!proposal || proposal.status !== 'approved') return;
    setIsApplying(true);

    const sourceSection = ctx.blocks.find(b => b.id === proposal.section_id);
    if (!sourceSection) return;

    for (const change of proposal.source_changes) {
      if (change.status === 'modified') {
        const currentBlock = ctx.blocks.find(b => b.id === change.id);
        ctx.updateIntentBlockRaw(change.id, {
          changeStatus: 'modified',
          proposalStatus: 'pending',
          proposalId: proposal.id,
          previousContent: currentBlock?.content,
          content: change.content,
          changeBy: proposal.proposed_by,
          changeByName: proposal.proposed_by_name,
          changeAt: Date.now(),
        });
      } else if (change.status === 'removed') {
        ctx.updateIntentBlockRaw(change.id, {
          changeStatus: 'removed',
          proposalStatus: 'pending',
          proposalId: proposal.id,
          changeBy: proposal.proposed_by,
          changeByName: proposal.proposed_by_name,
          changeAt: Date.now(),
        });
      } else if (change.status === 'new') {
        const newBlock = ctx.addBlock({ asChildOf: proposal.section_id });
        ctx.updateIntentBlockRaw(newBlock.id, {
          content: change.content,
          changeStatus: 'added',
          proposalStatus: 'pending',
          proposalId: proposal.id,
          changeBy: proposal.proposed_by,
          changeByName: proposal.proposed_by_name,
          changeAt: Date.now(),
        });
      }
    }

    setIsApplying(false);
    onClose();
  }, [proposal, ctx, onClose]);

  if (!proposalId) return null;

  // Derived: negotiate type & current user's vote
  const proposeType = proposal?.propose_type || 'decided';
  const isNegotiate = proposeType === 'negotiate' || proposeType === 'input' || proposeType === 'discussion';
  const isSelfProposal = proposal?.proposed_by === ctx.currentUser.id;
  const myVote = proposal?.proposal_votes?.find(v => v.user_id === ctx.currentUser.id);
  const allVotes = proposal?.proposal_votes || [];
  const rules = proposal?.negotiate_rules ?? null;

  // Vote tally for vote mode
  const approveCount = allVotes.filter(v => v.vote === 'approve').length;
  const rejectCount = allVotes.filter(v => v.vote === 'reject').length;
  const totalVoters = allVotes.length;
  const isResolved = proposal?.status === 'approved' || proposal?.status === 'rejected';
  const isApproved = proposal?.status === 'approved';

  const goToImpact = () => {
    const affectedId = affectedSectionId;
    if (!affectedId) return;
    setStep('impact');
    // Just scroll — don't move the panel (avoids unmount/remount)
    setTimeout(() => scrollToSection(affectedId), 100);
  };

  const goToSource = () => {
    if (!proposal) return;
    setStep('source');
    // Just scroll — don't move the panel (avoids unmount/remount)
    setTimeout(() => scrollToSection(proposal.section_id), 100);
  };

  const sourceSection = ctx.blocks.find(b => b.id === proposal?.section_id);
  const affectedSection = ctx.blocks.find(b => b.id === affectedSectionId);
  const hasAffectedSection = !!proposal && !!affectedSectionId && affectedSectionId !== proposal.section_id;

  // Impact data for the affected section
  const myImpact = proposal?.section_impacts?.find(si => si.sectionId === affectedSectionId);
  const myChildren = ctx.blocks
    .filter(b => b.parentId === affectedSectionId)
    .sort((a, b) => a.position - b.position);

  // Get the full outline before change for the source section (current children)
  const sourceChildren = ctx.blocks
    .filter(b => b.parentId === proposal?.section_id)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="w-[28%] flex-shrink-0 mr-2 border rounded-lg bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b">
        {isNegotiate ? (
          /* Negotiate types: simple header with type badge */
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              {(() => {
                const ui = getPathUI(proposeType);
                if (!ui) return null;
                const { Icon, textColor, darkTextColor, receiverLabel } = ui;
                return (
                  <>
                    <Icon className={`h-3 w-3 ${textColor}`} />
                    <span className={`text-[10px] font-semibold ${textColor} ${darkTextColor}`}>
                      {receiverLabel}
                    </span>
                  </>
                );
              })()}
            </div>
            <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : hasAffectedSection ? (
          /* Decided with affected section: tabs */
          <div className="flex">
            <button
              onClick={goToSource}
              className={`flex-1 px-3 py-1.5 text-[10px] font-medium text-center transition-colors border-b-2 ${
                step === 'source'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Their changes
            </button>
            <button
              onClick={goToImpact}
              className={`flex-1 px-3 py-1.5 text-[10px] font-medium text-center transition-colors border-b-2 ${
                step === 'impact'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Your impact
            </button>
            <button onClick={onClose} className="px-2 py-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
            <span className="text-[10px] font-medium text-muted-foreground">Changes</span>
            <button onClick={onClose} className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : !proposal ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            Proposal not found
          </div>
        ) : (step === 'source' || isNegotiate) ? (
          /* ═══════════════════════════════════════════════════════
             STEP 1: SOURCE — What they changed + why
             ═══════════════════════════════════════════════════════ */
          <div>
            {/* Who + when */}
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
              <UserAvatar
                avatarUrl={ctx.userAvatarMap.get(proposal.proposed_by)}
                name={proposal.proposed_by_name}
                className="h-5 w-5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">{proposal.proposed_by_name}</span>
                <span className="text-xs text-muted-foreground">
                  {isNegotiate ? ' proposes changes to ' : ' changed '}
                </span>
                <span className="text-xs font-semibold">{sourceSection?.content || 'their section'}</span>
              </div>
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                <Clock className="h-2.5 w-2.5" />
                {relativeTime(proposal.created_at)}
              </div>
            </div>

            {/* Outline before → after */}
            <div className="px-3 py-2 border-t">
              <div className="space-y-0.5">
                {proposal.source_changes.map((change, idx) => {
                  // Find the original block content for modified items
                  const originalBlock = sourceChildren.find(c => c.id === change.id);
                  return (
                    <div
                      key={change.id || idx}
                      className={`flex items-start gap-1.5 text-xs py-1 px-2 rounded ${
                        change.status === 'new' ? 'bg-emerald-50/70 dark:bg-emerald-900/15' :
                        change.status === 'modified' ? 'bg-amber-50/70 dark:bg-amber-900/15' :
                        change.status === 'removed' ? 'bg-red-50/70 dark:bg-red-900/15' : ''
                      }`}
                    >
                      {change.status === 'new' && <Plus className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />}
                      {change.status === 'modified' && <Edit2 className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />}
                      {change.status === 'removed' && <Minus className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0 leading-relaxed">
                        {change.status === 'removed' ? (
                          <span className="line-through text-red-500/70">{change.content}</span>
                        ) : change.status === 'modified' && originalBlock ? (
                          <WordDiff oldText={originalBlock.previousContent || originalBlock.content} newText={change.content} />
                        ) : (
                          <span>{change.content}</span>
                        )}
                        {change.reason && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 italic">{change.reason}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Their comment — highlighted */}
            {proposal.comment && (
              <div className="px-3 py-2 border-t">
                <div className="flex items-start gap-2 bg-blue-50/60 dark:bg-blue-900/15 rounded-md px-2.5 py-2">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-0.5">
                      {proposal.proposed_by_name}&apos;s note
                    </div>
                    <div className="text-xs leading-relaxed">
                      {proposal.comment}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reasoning — why they made this change */}
            {proposal.reasoning && (
              <div className="px-3 py-2 border-t">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Reasoning
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {proposal.reasoning}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════
             STEP 2: IMPACT — How it affects your section
             ═══════════════════════════════════════════════════════ */
          <div>
            {/* Context line */}
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                myImpact?.impactLevel === 'significant' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <div className="text-xs flex-1 min-w-0">
                <span className="text-muted-foreground">Changes to </span>
                <span className="font-semibold">{sourceSection?.content}</span>
                <span className="text-muted-foreground"> affect </span>
                <span className="font-semibold">{affectedSection?.content || 'your section'}</span>
              </div>
            </div>

            {/* Impact explanation */}
            {myImpact && (
              <div className="px-3 pb-2">
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {myImpact.reason}
                </div>
              </div>
            )}

            {/* Your outline items that need to change */}
            {myImpact?.suggestedChanges && myImpact.suggestedChanges.length > 0 && (
              <div className="px-3 py-2 border-t">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Suggested changes to your outline
                </div>
                <div className="space-y-1">
                  {myImpact.suggestedChanges.map((sc, idx) => {
                    const existing = sc.intentId ? myChildren.find(c => c.id === sc.intentId) : null;
                    return (
                      <div
                        key={idx}
                        className={`rounded-md px-2.5 py-2 ${
                          sc.action === 'add' ? 'bg-emerald-50/70 dark:bg-emerald-900/15' :
                          sc.action === 'remove' ? 'bg-red-50/70 dark:bg-red-900/15' :
                          'bg-amber-50/70 dark:bg-amber-900/15'
                        }`}
                      >
                        {/* Action badge */}
                        <div className="flex items-center gap-1 mb-1">
                          {sc.action === 'add' && <><Plus className="h-3 w-3 text-emerald-600" /><span className="text-[10px] font-semibold text-emerald-600">ADD</span></>}
                          {sc.action === 'modify' && <><Edit2 className="h-3 w-3 text-amber-600" /><span className="text-[10px] font-semibold text-amber-600">MODIFY</span></>}
                          {sc.action === 'remove' && <><Minus className="h-3 w-3 text-red-500" /><span className="text-[10px] font-semibold text-red-500">REMOVE</span></>}
                        </div>

                        {/* Content */}
                        <div className="text-xs leading-relaxed">
                          {sc.action === 'modify' && existing ? (
                            <WordDiff oldText={existing.content} newText={sc.content} />
                          ) : sc.action === 'remove' ? (
                            <span className="line-through text-red-500/70">{existing?.content || sc.content}</span>
                          ) : (
                            <span>{sc.content}</span>
                          )}
                        </div>

                        {/* Why this specific item is affected */}
                        {sc.reason && (
                          <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                            {sc.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: navigation + actions */}
      {proposal && (
        <div className="border-t">
          {/* Vote status bar — show for negotiate types */}
          {isNegotiate && allVotes.length > 0 && (
            <VoteStatusBar
              proposeType={proposeType}
              votes={allVotes}
              rules={rules}
              userAvatarMap={ctx.userAvatarMap}
              documentMembers={ctx.documentMembers}
              isResolved={isResolved}
              resolution={proposal?.status}
            />
          )}

          {/* Resolution banner — shown when proposal is resolved */}
          {isNegotiate && isResolved && (
            <div className={`px-3 py-2 ${isApproved ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {isApproved ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Approved</span>
                  </>
                ) : (
                  <>
                    <XIcon className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Rejected</span>
                  </>
                )}
              </div>
              {/* Apply button for approved negotiate proposals */}
              {isApproved && isSelfProposal && (
                <button
                  onClick={applyApprovedChanges}
                  disabled={isApplying}
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Apply Changes to Outline
                </button>
              )}
            </div>
          )}

          {/* Action area — for negotiate types, non-self, not yet voted, not resolved */}
          {isNegotiate && !isSelfProposal && !myVote && !isResolved && (
            <ResponseActions
              proposeType={proposeType}
              rules={rules}
              voteComment={voteComment}
              onVoteCommentChange={setVoteComment}
              onSubmitVote={submitVote}
              isVoting={isVoting}
            />
          )}

          {/* Discussion: proposer can resolve manually */}
          {proposeType === 'discussion' && isSelfProposal && !isResolved && allVotes.length > 0 && (
            <div className="px-3 py-2 border-b">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Wrap up discussion
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => resolveProposal('approved')}
                  disabled={isResolving}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                >
                  {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Apply Changes
                </button>
                <button
                  onClick={() => resolveProposal('rejected')}
                  disabled={isResolving}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-muted-foreground border hover:bg-muted disabled:opacity-40"
                >
                  <XIcon className="h-3 w-3" />
                  Drop It
                </button>
              </div>
            </div>
          )}

          {/* Already voted confirmation (not resolved yet) */}
          {isNegotiate && !isSelfProposal && myVote && !isResolved && (
            <div className="px-3 py-2 bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-muted-foreground">
                  You {myVote.vote === 'approve' ? 'approved' : myVote.vote === 'reject' ? 'rejected' : myVote.vote === 'response' ? 'responded' : myVote.vote}
                  {myVote.comment && <span className="italic"> — &ldquo;{myVote.comment}&rdquo;</span>}
                </span>
              </div>
            </div>
          )}

          {/* Navigation — only for decided type (negotiate types don't have impact step) */}
          {!isNegotiate && hasAffectedSection && (
            <div className="bg-muted/30 px-3 py-2">
              {step === 'source' ? (
                <button
                  onClick={goToImpact}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  See how this will influence your part
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  onClick={goToSource}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to their changes
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vote status bar (shows current voting progress) ───

function VoteStatusBar({
  proposeType,
  votes,
  rules,
  userAvatarMap,
  documentMembers,
  isResolved,
  resolution,
}: {
  proposeType: string;
  votes: ProposalVote[];
  rules: NegotiateRules | null;
  userAvatarMap: Map<string, string>;
  documentMembers: readonly { userId: string; name?: string; email?: string }[];
  isResolved?: boolean;
  resolution?: string;
}) {
  const approves = votes.filter(v => v.vote === 'approve');
  const rejects = votes.filter(v => v.vote === 'reject');
  const responses = votes.filter(v => v.vote === 'response');

  const getName = (userId: string) => {
    const m = documentMembers.find(m => m.userId === userId);
    return m?.name || m?.email?.split('@')[0] || 'Someone';
  };

  const pathUI = getPathUI(proposeType);
  if (!pathUI) return null;
  const { Icon, textColor, darkTextColor, bgColor, darkBgColor } = pathUI;

  // Vote mode: show approve/reject tally
  if (proposeType === 'negotiate') {
    const threshold = rules?.voteThreshold || 'majority';
    const thresholdLabel = threshold === 'all' ? 'Unanimous' : threshold === 'majority' ? 'Majority' : 'Any';
    return (
      <div className={`px-3 py-1.5 ${bgColor}/50 ${darkBgColor?.replace('/30', '/10')} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Icon className={`h-3 w-3 ${textColor}`} />
            <span className={`font-medium ${textColor} ${darkTextColor}`}>{thresholdLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {approves.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{approves.length} approve</span>
            )}
            {rejects.length > 0 && (
              <span className="text-red-500 font-medium">{rejects.length} reject</span>
            )}
            {votes.length === 0 && (
              <span className="text-muted-foreground">No votes yet</span>
            )}
          </div>
        </div>
        {votes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {votes.map(v => (
              <div key={v.id} className="flex items-center gap-0.5" title={`${getName(v.user_id)}: ${v.vote}${v.comment ? ` — "${v.comment}"` : ''}`}>
                <UserAvatar avatarUrl={userAvatarMap.get(v.user_id)} name={getName(v.user_id)} className="h-4 w-4" />
                {v.vote === 'approve' && <Check className="h-2.5 w-2.5 text-emerald-500" />}
                {v.vote === 'reject' && <XIcon className="h-2.5 w-2.5 text-red-500" />}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Input mode: show single response
  if (proposeType === 'input') {
    const decision = responses.length > 0 ? responses[0] : null;
    return (
      <div className={`px-3 py-1.5 ${bgColor}/50 ${darkBgColor?.replace('/30', '/10')} border-b`}>
        <div className="flex items-center gap-1.5 text-[10px]">
          <Icon className={`h-3 w-3 ${textColor}`} />
          {decision ? (
            <span className={`${textColor} ${darkTextColor} font-medium`}>
              {getName(decision.user_id)} responded
              {decision.comment && <span className="font-normal text-foreground/70"> — &ldquo;{decision.comment}&rdquo;</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Waiting for their decision</span>
          )}
        </div>
      </div>
    );
  }

  // Discussion / other: show response count + thread
  return (
    <div className={`px-3 py-1.5 ${bgColor}/50 ${darkBgColor?.replace('/30', '/10')} border-b`}>
      <div className="flex items-center gap-1.5 text-[10px] mb-1">
        <Icon className={`h-3 w-3 ${textColor}`} />
        <span className={`font-medium ${textColor} ${darkTextColor}`}>{responses.length} response{responses.length !== 1 ? 's' : ''}</span>
      </div>
      {responses.length > 0 && (
        <div className="space-y-1 ml-4">
          {responses.map(v => (
            <div key={v.id} className="flex items-start gap-1.5 text-[10px]">
              <UserAvatar avatarUrl={userAvatarMap.get(v.user_id)} name={getName(v.user_id)} className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">{getName(v.user_id)}</span>
                {v.comment && <span className="text-foreground/70"> — {v.comment}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Response actions (receiver votes/responds) ───

function ResponseActions({
  proposeType,
  rules,
  voteComment,
  onVoteCommentChange,
  onSubmitVote,
  isVoting,
}: {
  proposeType: string;
  rules: NegotiateRules | null;
  voteComment: string;
  onVoteCommentChange: (v: string) => void;
  onSubmitVote: (vote: string, comment?: string) => Promise<void>;
  isVoting: boolean;
}) {
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const pathUI = getPathUI(proposeType);

  if (proposeType === 'negotiate') {
    // Vote mode: Approve / Reject with optional comment
    return (
      <div className="px-3 py-2 border-b space-y-2">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {pathUI?.receiverLabel ?? 'Your vote'}
        </div>
        {!showCommentFor ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => onSubmitVote('approve')}
              disabled={isVoting}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => setShowCommentFor('reject')}
              disabled={isVoting}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md transition-colors bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              <XIcon className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">Why do you reject?</div>
            <AutoResizeTextarea
              value={voteComment}
              onChange={onVoteCommentChange}
              placeholder="I think this doesn't work because..."
              className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-red-300"
              minRows={2}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => { setShowCommentFor(null); onVoteCommentChange(''); }}
                className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded border"
              >
                Cancel
              </button>
              <button
                onClick={() => onSubmitVote('reject', voteComment)}
                disabled={isVoting || !voteComment.trim()}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              >
                {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Submit Rejection
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (proposeType === 'input') {
    // Your Call mode: Accept / Modify / Decline
    return (
      <div className="px-3 py-2 border-b space-y-2">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {pathUI?.receiverLabel ?? 'Your decision'}
        </div>
        {!showCommentFor ? (
          <div className="space-y-1">
            <button
              onClick={() => onSubmitVote('approve', 'Accepted as proposed')}
              disabled={isVoting}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
            >
              <Check className="h-3.5 w-3.5" />
              Accept as proposed
            </button>
            <button
              onClick={() => setShowCommentFor('modify')}
              disabled={isVoting}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Accept with changes
            </button>
            <button
              onClick={() => setShowCommentFor('decline')}
              disabled={isVoting}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium rounded-md transition-colors text-muted-foreground border hover:bg-muted"
            >
              <XIcon className="h-3.5 w-3.5" />
              Decline
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className={`text-xs font-medium ${showCommentFor === 'modify' ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {showCommentFor === 'modify' ? 'What would you change?' : 'Why decline?'}
            </div>
            <AutoResizeTextarea
              value={voteComment}
              onChange={onVoteCommentChange}
              placeholder={showCommentFor === 'modify' ? "I'd prefer to..." : "This doesn't fit because..."}
              className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
              minRows={2}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => { setShowCommentFor(null); onVoteCommentChange(''); }}
                className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded border"
              >
                Cancel
              </button>
              <button
                onClick={() => onSubmitVote(
                  showCommentFor === 'modify' ? 'response' : 'reject',
                  voteComment
                )}
                disabled={isVoting || !voteComment.trim()}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (proposeType === 'discussion') {
    // Discussion mode: comment thread
    return (
      <div className="px-3 py-2 border-b space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Add to discussion
        </div>
        <AutoResizeTextarea
          value={voteComment}
          onChange={onVoteCommentChange}
          placeholder="I think..."
          className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
          minRows={2}
        />
        <button
          onClick={() => onSubmitVote('response', voteComment)}
          disabled={isVoting || !voteComment.trim()}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
        >
          {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Reply
        </button>
      </div>
    );
  }

  return null;
}
