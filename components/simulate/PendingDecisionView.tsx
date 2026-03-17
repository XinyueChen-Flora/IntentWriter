"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check, X as XIcon, Loader2, MessageSquare, Send,
} from "lucide-react";
import { getPathUI } from "@/platform/coordination/ui";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { useIntentPanelContext } from "../outline/IntentPanelContext";
import UserAvatar from "@/components/user/UserAvatar";

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
  negotiate_rules: { voteThreshold?: string; discussionResolution?: string } | null;
  source_changes: Array<{ id: string; content: string; status: string }>;
  writing_previews?: Record<string, { mode?: string; currentPreview: string; changedPreview: string }>;
  proposal_votes?: ProposalVote[];
  status: string;
};

type PendingDecisionViewProps = {
  sectionId: string;
  proposalId: string;
  onDismiss: () => void;
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PendingDecisionView({ sectionId, proposalId, onDismiss }: PendingDecisionViewProps) {
  const ctx = useIntentPanelContext();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);

  // Fetch proposal
  useEffect(() => {
    fetch(`/api/proposals?documentId=${ctx.roomId}`)
      .then(res => res.json())
      .then(data => {
        const found = (data.proposals || []).find((p: ProposalData) => p.id === proposalId);
        setProposal(found || null);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [ctx.roomId, proposalId]);

  const proposeType = proposal?.propose_type || 'negotiate';
  const isSelfProposal = proposal?.proposed_by === ctx.currentUser.id;
  const allVotes = proposal?.proposal_votes || [];
  const myVote = allVotes.find(v => v.user_id === ctx.currentUser.id);
  const isResolved = proposal?.status === 'approved' || proposal?.status === 'rejected';
  const isApproved = proposal?.status === 'approved';

  // Writing previews for this section
  const writingPreview = proposal?.writing_previews?.[sectionId];

  const submitVote = useCallback(async (vote: string, comment?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote, comment: comment || null }),
      });
      const data = await res.json();
      ctx.refreshProposals();
      setProposal(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          proposal_votes: [
            ...allVotes,
            { id: 'local', user_id: ctx.currentUser.id, vote, comment: comment || null, voted_at: new Date().toISOString() },
          ],
        };
        if (data.resolved) updated.status = data.resolved;
        return updated;
      });
      setReplyText('');
      setShowRejectReason(false);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [proposalId, allVotes, ctx]);

  const resolveProposal = useCallback(async (resolution: 'approved' | 'rejected') => {
    setIsResolving(true);
    try {
      await fetch('/api/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, resolution }),
      });
      ctx.refreshProposals();
      setProposal(prev => prev ? { ...prev, status: resolution } : prev);
      if (resolution === 'approved') applyChanges();
    } catch (error) {
      console.error('Failed to resolve:', error);
    } finally {
      setIsResolving(false);
    }
  }, [proposalId, ctx]);

  const applyChanges = useCallback(() => {
    if (!proposal) return;
    for (const change of proposal.source_changes) {
      if (change.status === 'modified') {
        const currentBlock = ctx.blocks.find(b => b.id === change.id);
        ctx.updateIntentBlockRaw(change.id, {
          changeStatus: 'modified',
          proposalStatus: 'approved',
          proposalId: proposal.id,
          proposedAction: undefined,
          previousContent: currentBlock?.previousContent || currentBlock?.content,
          content: change.content,
          changeBy: proposal.proposed_by,
          changeByName: proposal.proposed_by_name,
          changeAt: Date.now(),
        });
      } else if (change.status === 'removed') {
        ctx.updateIntentBlockRaw(change.id, {
          changeStatus: 'removed',
          proposalStatus: 'approved',
          proposalId: proposal.id,
          proposedAction: undefined,
          changeBy: proposal.proposed_by,
          changeByName: proposal.proposed_by_name,
          changeAt: Date.now(),
        });
      } else if (change.status === 'new') {
        // New blocks should already exist from the propose step
        // Just update their status
        const existingNew = ctx.blocks.find(b => b.proposalId === proposal.id && b.changeStatus === 'proposed' && b.proposedAction === 'add');
        if (existingNew) {
          ctx.updateIntentBlockRaw(existingNew.id, {
            changeStatus: 'added',
            proposalStatus: 'approved',
            proposedAction: undefined,
          });
        }
      }
    }
  }, [proposal, ctx]);

  const revertChanges = useCallback(() => {
    if (!proposal) return;
    // Revert proposed blocks back to their original state
    for (const change of proposal.source_changes) {
      const block = ctx.blocks.find(b => b.id === change.id);
      if (!block) continue;
      if (change.status === 'modified' && block.previousContent) {
        ctx.updateIntentBlockRaw(change.id, {
          content: block.previousContent,
          changeStatus: undefined,
          proposalStatus: undefined,
          proposalId: undefined,
          proposedAction: undefined,
          previousContent: undefined,
        });
      } else if (change.status === 'removed') {
        ctx.updateIntentBlockRaw(change.id, {
          changeStatus: undefined,
          proposalStatus: undefined,
          proposalId: undefined,
          proposedAction: undefined,
        });
      }
    }
    // Remove blocks that were proposed as new
    const newBlocks = ctx.blocks.filter(b => b.proposalId === proposal.id && b.proposedAction === 'add');
    for (const b of newBlocks) {
      ctx.deleteBlock(b.id);
    }
  }, [proposal, ctx]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
        Proposal not found
      </div>
    );
  }

  const pathUI = getPathUI(proposeType);
  const TypeIcon = pathUI?.Icon ?? MessageSquare;
  const typeLabel = pathUI?.receiverLabel ?? 'Action Required';
  const typeColor = pathUI ? `${pathUI.textColor} ${pathUI.darkTextColor}` : 'text-muted-foreground';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <TypeIcon className={`h-3.5 w-3.5 ${typeColor}`} />
          <span className={`text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
          <span className="text-xs text-muted-foreground">from</span>
          <UserAvatar
            avatarUrl={ctx.userAvatarMap.get(proposal.proposed_by)}
            name={proposal.proposed_by_name}
            className="h-4 w-4"
          />
          <span className="text-xs font-medium">{proposal.proposed_by_name}</span>
          <span className="text-[10px] text-muted-foreground">{relativeTime(proposal.created_at)}</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Proposer's question / reasoning */}
      {(proposal.comment || proposal.reasoning) && (
        <div className="px-4 py-2 border-b bg-blue-50/40 dark:bg-blue-900/10">
          {proposal.comment && (
            <div className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{proposal.comment}</div>
            </div>
          )}
          {proposal.reasoning && !proposal.comment && (
            <div className="text-xs text-muted-foreground leading-relaxed">{proposal.reasoning}</div>
          )}
        </div>
      )}

      {/* Two-version comparison */}
      <div className="flex-1 flex overflow-hidden">
        {/* Version A: Current (before) */}
        <div className="flex-1 flex flex-col border-r overflow-hidden">
          <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Current Version</span>
            {!isResolved && !isSelfProposal && !myVote && (
              <button
                onClick={() => submitVote('reject', 'Keep current version')}
                disabled={isSubmitting}
                className="text-[10px] font-medium px-2 py-0.5 rounded border hover:bg-muted transition-colors disabled:opacity-40"
              >
                Keep this
              </button>
            )}
            {isResolved && !isApproved && (
              <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Kept
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
              {writingPreview?.currentPreview || (
                <span className="text-muted-foreground italic">No writing yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Version B: Proposed (after) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 border-b bg-indigo-50/40 dark:bg-indigo-900/10 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Proposed Version</span>
            {!isResolved && !isSelfProposal && !myVote && proposeType !== 'discussion' && (
              <button
                onClick={() => submitVote('approve', 'Accept proposed version')}
                disabled={isSubmitting}
                className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-40"
              >
                Use this
              </button>
            )}
            {isResolved && isApproved && (
              <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Accepted
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
              {writingPreview?.changedPreview || (
                <span className="text-muted-foreground italic">No writing preview available</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: votes/discussion + actions */}
      <div className="border-t">
        {/* Existing votes/responses */}
        {allVotes.length > 0 && (
          <div className="px-4 py-2 border-b space-y-1.5 max-h-32 overflow-y-auto">
            {allVotes
              .sort((a, b) => new Date(a.voted_at).getTime() - new Date(b.voted_at).getTime())
              .map(v => {
                const member = ctx.documentMembers.find(m => m.userId === v.user_id);
                const name = member?.name || member?.email?.split('@')[0] || 'Someone';
                return (
                  <div key={v.id} className="flex items-start gap-2">
                    <UserAvatar avatarUrl={ctx.userAvatarMap.get(v.user_id)} name={name} className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{name}</span>
                      {v.vote === 'approve' && <Check className="inline h-3 w-3 text-emerald-500 ml-1" />}
                      {v.vote === 'reject' && <XIcon className="inline h-3 w-3 text-red-500 ml-1" />}
                      {v.comment && <span className="text-xs text-muted-foreground ml-1">— {v.comment}</span>}
                      <span className="text-[10px] text-muted-foreground ml-1">{relativeTime(v.voted_at)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Discussion: reply input */}
        {proposeType === 'discussion' && !isResolved && (
          <div className="px-4 py-2 flex gap-2">
            <AutoResizeTextarea
              value={replyText}
              onChange={setReplyText}
              placeholder="Share your thoughts..."
              className="flex-1 px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
              minRows={1}
            />
            <button
              onClick={() => submitVote('response', replyText)}
              disabled={isSubmitting || !replyText.trim()}
              className="px-2 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 flex-shrink-0"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Vote: reject reason input */}
        {proposeType === 'negotiate' && showRejectReason && !isResolved && (
          <div className="px-4 py-2 space-y-1.5">
            <AutoResizeTextarea
              value={replyText}
              onChange={setReplyText}
              placeholder="Why keep the current version?"
              className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-red-300"
              minRows={2}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button onClick={() => { setShowRejectReason(false); setReplyText(''); }} className="px-2 py-1 text-[10px] text-muted-foreground rounded border">
                Cancel
              </button>
              <button
                onClick={() => submitVote('reject', replyText)}
                disabled={isSubmitting || !replyText.trim()}
                className="flex-1 text-[10px] font-medium rounded-md bg-red-50 text-red-600 border border-red-200 px-2 py-1 disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {/* Proposer: resolve discussion */}
        {isSelfProposal && !isResolved && proposeType === 'discussion' && allVotes.length > 0 && (
          <div className="px-4 py-2 flex gap-2">
            <button
              onClick={() => resolveProposal('approved')}
              disabled={isResolving}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
            >
              {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Apply Proposed Version
            </button>
            <button
              onClick={() => { resolveProposal('rejected'); revertChanges(); onDismiss(); }}
              disabled={isResolving}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md text-muted-foreground border hover:bg-muted disabled:opacity-40"
            >
              <XIcon className="h-3 w-3" />
              Keep Current
            </button>
          </div>
        )}

        {/* Resolved: apply or revert */}
        {isResolved && isSelfProposal && (
          <div className="px-4 py-2 flex items-center gap-2">
            {isApproved ? (
              <button
                onClick={() => { applyChanges(); onDismiss(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <Check className="h-3 w-3" /> Apply to Outline
              </button>
            ) : (
              <button
                onClick={() => { revertChanges(); onDismiss(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md text-muted-foreground border hover:bg-muted"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
