"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Minus, Edit2, Loader2, MessageSquare, Clock,
  Check, X as XIcon, Vote, UserCheck, MessagesSquare, Send,
  ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { useIntentPanelContext } from "../outline/IntentPanelContext";
import { WordDiff } from "./WordDiff";
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
  source_changes: Array<{ id: string; content: string; status: string; reason?: string }>;
  section_impacts: Array<{
    sectionId: string;
    impactLevel: string;
    reason: string;
    suggestedChanges?: Array<{
      action: 'add' | 'modify' | 'remove';
      content: string;
      reason: string;
    }>;
  }>;
  writing_previews?: Record<string, { mode?: string; currentPreview: string; changedPreview: string }>;
  proposal_votes?: ProposalVote[];
  status: string;
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

type ProposalThreadProps = {
  sectionId: string; // the root section this thread is attached to
};

export function ProposalThread({ sectionId }: ProposalThreadProps) {
  const ctx = useIntentPanelContext();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch negotiate-type proposals for this section
  useEffect(() => {
    if (!ctx.roomId) return;
    setIsLoading(true);
    fetch(`/api/proposals?documentId=${ctx.roomId}`)
      .then(res => res.json())
      .then(data => {
        const relevant = (data.proposals || []).filter((p: ProposalData) => {
          const isNegotiate = p.propose_type === 'negotiate' || p.propose_type === 'input' || p.propose_type === 'discussion';
          if (!isNegotiate) return false;
          if (p.section_id === sectionId) return true;
          if (p.section_impacts?.some((si: { sectionId: string }) => si.sectionId === sectionId)) return true;
          return false;
        });
        setProposals(relevant);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [ctx.roomId, sectionId]);

  if (isLoading || proposals.length === 0) return null;

  const toggleExpand = (id: string) => {
    // Toggle via context — null means collapse, id means expand
    ctx.setExpandedThreadProposalId(ctx.expandedThreadProposalId === id ? null : id);
  };

  return (
    <div className="border-t">
      {proposals.map(proposal => (
        <ThreadItem
          key={proposal.id}
          proposal={proposal}
          sectionId={sectionId}
          isExpanded={ctx.expandedThreadProposalId === proposal.id}
          onToggle={() => toggleExpand(proposal.id)}
          onUpdate={(updated) => {
            setProposals(prev => prev.map(p => p.id === updated.id ? updated : p));
          }}
        />
      ))}
    </div>
  );
}

// ─── Individual thread item ───

function ThreadItem({
  proposal,
  sectionId,
  isExpanded,
  onToggle,
  onUpdate,
}: {
  proposal: ProposalData;
  sectionId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (p: ProposalData) => void;
}) {
  const ctx = useIntentPanelContext();
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);

  const proposeType = proposal.propose_type;
  const isSource = proposal.section_id === sectionId;
  const isSelfProposal = proposal.proposed_by === ctx.currentUser.id;
  const allVotes = proposal.proposal_votes || [];
  const myVote = allVotes.find(v => v.user_id === ctx.currentUser.id);
  const isResolved = proposal.status === 'approved' || proposal.status === 'rejected';
  const isApproved = proposal.status === 'approved';

  const sourceChildren = ctx.blocks
    .filter(b => b.parentId === proposal.section_id)
    .sort((a, b) => a.position - b.position);

  const sourceSection = ctx.blocks.find(b => b.id === proposal.section_id);

  const submitVote = useCallback(async (vote: string, comment?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, vote, comment: comment || null }),
      });
      const data = await res.json();
      ctx.refreshProposals();
      const updated = {
        ...proposal,
        proposal_votes: [
          ...allVotes,
          { id: 'local-' + Date.now(), user_id: ctx.currentUser.id, vote, comment: comment || null, voted_at: new Date().toISOString() },
        ],
        status: data.resolved || proposal.status,
      };
      onUpdate(updated);
      setReplyText('');
      setShowRejectReason(false);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [proposal, allVotes, ctx, onUpdate]);

  const resolveProposal = useCallback(async (resolution: 'approved' | 'rejected') => {
    setIsResolving(true);
    try {
      await fetch('/api/proposals/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, resolution }),
      });
      ctx.refreshProposals();
      onUpdate({ ...proposal, status: resolution });
    } catch (error) {
      console.error('Failed to resolve:', error);
    } finally {
      setIsResolving(false);
    }
  }, [proposal, ctx, onUpdate]);

  const applyChanges = useCallback(() => {
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
  }, [proposal, ctx]);

  // Type badge color
  const typeColor = proposeType === 'negotiate'
    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
    : proposeType === 'input'
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';

  const TypeIcon = proposeType === 'negotiate' ? Vote
    : proposeType === 'input' ? UserCheck : MessagesSquare;

  const typeLabel = proposeType === 'negotiate' ? 'Vote'
    : proposeType === 'input' ? 'Input' : 'Discussion';

  return (
    <div className={`border-b last:border-b-0 ${isResolved ? 'opacity-60' : ''}`}>
      {/* Header — always visible, clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <UserAvatar
          avatarUrl={ctx.userAvatarMap.get(proposal.proposed_by)}
          name={proposal.proposed_by_name}
          className="h-4 w-4 flex-shrink-0"
        />
        <span className="text-xs font-medium truncate">{proposal.proposed_by_name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${typeColor}`}>
          {typeLabel}
        </span>

        {/* Status */}
        {isResolved && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
            isApproved ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20'
              : 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
          }`}>
            {isApproved ? 'Approved' : 'Rejected'}
          </span>
        )}

        {/* Vote count for negotiate */}
        {proposeType === 'negotiate' && !isResolved && allVotes.length > 0 && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {allVotes.filter(v => v.vote === 'approve').length}✓ {allVotes.filter(v => v.vote === 'reject').length}✗
          </span>
        )}

        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
          {relativeTime(proposal.created_at)}
        </span>
        {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {/* Diff — show proposed changes */}
          {isSource && proposal.source_changes.length > 0 && (
            <div className="space-y-0.5 mb-2">
              {proposal.source_changes.map((change, idx) => {
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Not source section: show impact summary */}
          {!isSource && (
            <div className="text-xs text-muted-foreground mb-2 px-2">
              Changes to <span className="font-medium text-foreground">{sourceSection?.content || 'another section'}</span> may affect this section.
            </div>
          )}

          {/* Comment from proposer */}
          {proposal.comment && (
            <div className="flex items-start gap-2 mb-2 px-2 py-1.5 bg-blue-50/60 dark:bg-blue-900/15 rounded-md">
              <MessageSquare className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{proposal.comment}</div>
            </div>
          )}

          {/* Reasoning */}
          {proposal.reasoning && (
            <div className="text-[10px] text-muted-foreground mb-2 px-2 leading-relaxed">
              {proposal.reasoning}
            </div>
          )}

          {/* Writing preview — before/after */}
          <WritingPreviewSection sectionId={sectionId} proposal={proposal} />

          {/* ─── Timeline: votes & comments ─── */}
          {allVotes.length > 0 && (
            <div className="border-t pt-2 mt-1 space-y-1.5">
              {allVotes
                .sort((a, b) => new Date(a.voted_at).getTime() - new Date(b.voted_at).getTime())
                .map(v => {
                  const member = ctx.documentMembers.find(m => m.userId === v.user_id);
                  const name = member?.name || member?.email?.split('@')[0] || 'Someone';
                  return (
                    <div key={v.id} className="flex items-start gap-2 px-2">
                      <UserAvatar
                        avatarUrl={ctx.userAvatarMap.get(v.user_id)}
                        name={name}
                        className="h-4 w-4 flex-shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{name}</span>
                          {v.vote === 'approve' && <Check className="h-3 w-3 text-emerald-500" />}
                          {v.vote === 'reject' && <XIcon className="h-3 w-3 text-red-500" />}
                          {v.vote === 'response' && <MessageSquare className="h-3 w-3 text-amber-500" />}
                          <span className="text-[10px] text-muted-foreground">{relativeTime(v.voted_at)}</span>
                        </div>
                        {v.comment && (
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{v.comment}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* ─── Actions ─── */}
          {!isResolved && !isSelfProposal && !myVote && (
            <div className="border-t pt-2 mt-2">
              {proposeType === 'negotiate' && !showRejectReason && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => submitVote('approve')}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => setShowRejectReason(true)}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                  >
                    <XIcon className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
              {proposeType === 'negotiate' && showRejectReason && (
                <div className="space-y-1.5">
                  <AutoResizeTextarea
                    value={replyText}
                    onChange={setReplyText}
                    placeholder="Why do you reject?"
                    className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-red-300"
                    minRows={2}
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => { setShowRejectReason(false); setReplyText(''); }} className="px-2 py-1 text-[10px] text-muted-foreground rounded border">Cancel</button>
                    <button
                      onClick={() => submitVote('reject', replyText)}
                      disabled={isSubmitting || !replyText.trim()}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-red-50 text-red-600 border border-red-200 disabled:opacity-40"
                    >
                      <Send className="h-3 w-3" /> Reject
                    </button>
                  </div>
                </div>
              )}
              {proposeType === 'input' && (
                <div className="space-y-1">
                  <button
                    onClick={() => submitVote('approve', 'Accepted as proposed')}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/20 dark:text-emerald-400"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    onClick={() => submitVote('reject', replyText || 'Declined')}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md text-muted-foreground border hover:bg-muted disabled:opacity-40"
                  >
                    <XIcon className="h-3 w-3" /> Decline
                  </button>
                </div>
              )}
              {proposeType === 'discussion' && (
                <div className="space-y-1.5">
                  <AutoResizeTextarea
                    value={replyText}
                    onChange={setReplyText}
                    placeholder="Share your thoughts..."
                    className="w-full px-2 py-1.5 text-xs bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
                    minRows={2}
                  />
                  <button
                    onClick={() => submitVote('response', replyText)}
                    disabled={isSubmitting || !replyText.trim()}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 dark:bg-amber-900/20 dark:text-amber-400"
                  >
                    <Send className="h-3 w-3" /> Reply
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Already voted */}
          {!isResolved && myVote && (
            <div className="border-t pt-2 mt-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-emerald-500" />
              You {myVote.vote === 'approve' ? 'approved' : myVote.vote === 'reject' ? 'rejected' : 'responded'}
            </div>
          )}

          {/* Proposer: resolve discussion / apply approved */}
          {isSelfProposal && !isResolved && proposeType === 'discussion' && allVotes.length > 0 && (
            <div className="border-t pt-2 mt-2 flex gap-1.5">
              <button
                onClick={() => { resolveProposal('approved'); applyChanges(); }}
                disabled={isResolving}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
              >
                {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Apply
              </button>
              <button
                onClick={() => resolveProposal('rejected')}
                disabled={isResolving}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-muted-foreground border hover:bg-muted disabled:opacity-40"
              >
                Drop
              </button>
            </div>
          )}

          {/* Proposer: apply approved changes */}
          {isSelfProposal && isApproved && (
            <div className="border-t pt-2 mt-2">
              <button
                onClick={applyChanges}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <Check className="h-3 w-3" /> Apply Changes to Outline
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Writing preview: shows before/after writing impact ───

function WritingPreviewSection({ sectionId, proposal }: { sectionId: string; proposal: ProposalData }) {
  const [showPreview, setShowPreview] = useState(false);

  // Get writing preview for this section from the proposal
  const preview = proposal.writing_previews?.[sectionId];
  if (!preview || (!preview.currentPreview && !preview.changedPreview)) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setShowPreview(prev => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="h-3 w-3" />
        <span>Writing impact</span>
        {showPreview ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>
      {showPreview && (
        <div className="mt-1 space-y-2 px-2">
          {preview.currentPreview && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Before</div>
              <div className="text-xs leading-relaxed text-muted-foreground bg-muted/30 rounded px-2 py-1.5 max-h-32 overflow-y-auto">
                {preview.currentPreview}
              </div>
            </div>
          )}
          {preview.changedPreview && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-0.5">After</div>
              <div className="text-xs leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 rounded px-2 py-1.5 max-h-32 overflow-y-auto">
                {preview.changedPreview}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
