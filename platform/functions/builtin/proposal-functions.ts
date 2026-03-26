// ─── Proposal & Resolution Functions ───
//
// These functions replace hardcoded show-data/resolution logic.
// They read from DocumentSnapshot (proposal data, votes, etc.)
// and render through display bindings like any other function.

import { registerFunction } from '../protocol';
import { getResult } from '../../interaction-store';
import { getOutlineEffect } from '../../coordination/engine';

// Helper: extract proposal with full fields (Proposal type may not have votes/reasoning yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getProposal(input: any): any {
  return input.snapshot?.proposals?.[0];
}

// ─── Render Draft ───

registerFunction({
  id: 'render-draft',
  name: 'Render Proposal Draft',
  description: 'Displays the proposed changes to BNA units.',
  icon: 'FileEdit',
  executor: 'local',
  fn: (input: any) => {
    // If there's an active proposal, show its changes
    const proposal = getProposal(input);
    if (proposal?.changes?.length > 0) {
      return {
        data: { draftItems: proposal.changes },
        ui: [],
      };
    }

    // Otherwise, show current section's intents as editable draft
    const sectionId = input.focus?.sectionId;
    const nodes = input.snapshot?.nodes || [];
    const sectionNodes = sectionId
      ? nodes.filter((n: any) => n.id === sectionId || n.parentId === sectionId)
      : nodes;

    const draftItems = sectionNodes.map((n: any) => ({
      id: n.id,
      content: n.content || '',
      originalContent: n.content || '',
      isNew: false,
      isRemoved: false,
    }));

    return {
      data: { draftItems },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { draftItems: 'Array' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'draft-editor', params: {
      items: '{{draftItems}}',
      action: 'update-draft',
      addLabel: 'Add intent',
    }},
  ],
});


// ─── Render Changes Summary ───

registerFunction({
  id: 'render-changes-summary',
  name: 'Render Changes Summary',
  description: 'Displays proposed changes as a summary list.',
  icon: 'List',
  executor: 'local',
  fn: (input) => {
    const sectionId = input.focus?.sectionId || 'document';
    const notification = input.config?.notification as Record<string, unknown> | null;

    // Read proposed changes — multiple sources depending on context:
    // Proposer: interaction store (user edits, AI suggestion)
    // Reviewer: notification data from DB (passed via config.notification)
    const draftResult = getResult('render-draft', sectionId);
    const gapResult = getResult('generate-gap-suggestion', sectionId);
    const proposal = getProposal(input);

    let changes: Array<{ id: string; content: string; status: string; originalContent?: string; reason?: string; isNew?: boolean; isRemoved?: boolean }> = [];
    let proposedBy = '';
    let sourceSectionName = '';

    if (draftResult?.output?.draftItems) {
      // Proposer: user edits in draft-editor
      const items = draftResult.output.draftItems as any[];
      changes = items.filter((d: any) =>
        d.isNew || d.isRemoved || (d.content !== d.originalContent)
      ).map((d: any) => ({
        ...d,
        status: d.isNew ? 'added' : d.isRemoved ? 'removed' : 'changed',
      }));
    } else if (gapResult?.output?.proposedOutline) {
      // Proposer: AI suggestion
      const outline = gapResult.output.proposedOutline as any[];
      changes = outline.filter((item: any) =>
        item.status === 'changed' || item.status === 'added' || item.status === 'removed'
      );
    } else if (notification) {
      // Reviewer: read proposer's original changes from DB
      const sc = (notification.sourceChanges as any[]) || [];
      if (sc.length > 0) {
        changes = sc.filter((c: any) =>
          c.isNew || c.isRemoved || c.status === 'changed' || c.status === 'added' || c.status === 'removed' ||
          (c.content && c.originalContent && c.content !== c.originalContent)
        ).map((c: any) => ({
          id: c.id || '',
          content: c.content,
          status: c.isNew ? 'added' : c.isRemoved ? 'removed' : (c.status || 'changed'),
          originalContent: c.originalContent,
          reason: c.reason,
        }));
      }
      proposedBy = (notification.proposedByName as string) || '';
      sourceSectionName = (notification.sourceSectionName as string) || '';
    } else if (input.config?.draftItems) {
      const items = input.config.draftItems as any[];
      changes = items.filter((d: any) =>
        d.isNew || d.isRemoved || (d.content !== d.originalContent)
      ).map((d: any) => ({
        ...d,
        status: d.isNew ? 'added' : d.isRemoved ? 'removed' : 'changed',
      }));
    } else if (proposal?.changes) {
      changes = proposal.changes;
    }

    const reason = (notification?.reason as string)
      || (gapResult?.output?.reason as string) || '';

    const isReviewer = !!notification;

    // Build display-ready changes with diff descriptions
    const displayChanges = changes.map((c: any) => {
      const status = c.isNew ? 'added' : c.isRemoved ? 'removed' : (c.status || 'changed');
      let description = '';
      if (status === 'added') {
        description = `Added: "${c.content}"`;
      } else if (status === 'removed') {
        description = `Removed: "${c.originalContent || c.content}"`;
      } else {
        // Modified — show before → after
        const before = (c.originalContent || '').slice(0, 60);
        const after = (c.content || '').slice(0, 60);
        description = before !== after
          ? `"${before}${before.length >= 60 ? '...' : ''}" → "${after}${after.length >= 60 ? '...' : ''}"`
          : c.content;
      }
      return { ...c, status, description, displayReason: c.reason || '' };
    });

    return {
      data: { changes, displayChanges, reason, proposedBy, sourceSectionName, hasChanges: changes.length > 0, isReviewer },
      ui: displayChanges.length > 0 ? [
        { type: 'banner', params: {
          title: isReviewer ? `${proposedBy} changed ${sourceSectionName}` : 'Your Changes',
          message: `${displayChanges.length} change(s)`,
          severity: isReviewer ? 'warning' : 'info',
        }},
        { type: 'result-list', forEach: 'displayChanges',
          params: {
            title: '{{item.description}}',
            badge: '{{item.status}}',
            badgeVariant: '{{item.status === "added" ? "new" : item.status === "removed" ? "removed" : "modified"}}',
            detail: '{{item.displayReason}}',
          }},
      ] : [
        { type: 'banner', params: {
          title: isReviewer ? `${proposedBy} made changes` : 'No Changes',
          message: reason || 'No outline changes detected.',
          severity: 'info',
        }},
      ],
    };
  },
  requires: {},
  outputSchema: { changes: 'Array', reason: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Render Vote Progress ───

registerFunction({
  id: 'render-vote-progress',
  name: 'Render Vote Progress',
  description: 'Fetches and displays voting progress toward threshold.',
  icon: 'BarChart',
  executor: 'local',
  fn: async (input) => {
    const proposalId = (input.config?.proposalId as string) || '';
    const documentId = input.snapshot?.documentId as string || '';

    let votes: Array<{ vote: string }> = [];
    if (documentId) {
      try {
        const res = await fetch(`/api/proposals?documentId=${documentId}`);
        if (res.ok) {
          const data = await res.json();
          const proposal = (data.proposals || []).find((p: any) => p.id === proposalId);
          if (proposal?.proposal_votes) {
            votes = proposal.proposal_votes;
          }
        }
      } catch { /* ignore */ }
    }

    const approvals = votes.filter(v => v.vote === 'approve').length;
    const rejections = votes.filter(v => v.vote === 'reject').length;
    const totalVotes = votes.length;
    const threshold = Math.max(1, Math.ceil(totalVotes / 2) || 1);

    return {
      data: { approvals, rejections, totalVotes, threshold },
      ui: [
        { type: 'progress-bar', params: {
          current: String(approvals),
          total: String(threshold),
          label: `${approvals} approved, ${rejections} rejected (${totalVotes} total)`,
          variant: approvals >= threshold ? 'success' : rejections >= threshold ? 'warning' : 'default',
        }},
      ],
    };
  },
  requires: {},
  outputSchema: { approvals: 'number', rejections: 'number', totalVotes: 'number' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Render Vote Thread ───

registerFunction({
  id: 'render-vote-thread',
  name: 'Render Vote Thread',
  description: 'Fetches and displays the list of votes, comments, and replies from DB.',
  icon: 'MessageSquare',
  executor: 'local',
  fn: async (input) => {
    const proposalId = (input.config?.proposalId as string) || '';
    const documentId = input.snapshot?.documentId as string || '';

    // Fetch votes/comments from DB
    let votes: Array<{ user_id: string; vote: string; comment?: string; voted_at?: string }> = [];
    if (documentId) {
      try {
        const res = await fetch(`/api/proposals?documentId=${documentId}`);
        if (res.ok) {
          const data = await res.json();
          const proposal = (data.proposals || []).find((p: any) => p.id === proposalId);
          if (proposal?.proposal_votes) {
            votes = proposal.proposal_votes;
          }
        }
      } catch { /* ignore fetch errors */ }
    }

    // Look up user names from snapshot members
    const members = (input.snapshot?.members || []) as Array<{ userId: string; name?: string; displayName?: string }>;
    const lookupUser = (userId: string) => {
      const member = members.find(m => m.userId === userId);
      return member?.displayName || member?.name?.split('@')[0] || userId?.slice(0, 8) || 'Anonymous';
    };

    // Map to display-friendly format
    const thread = votes.map((v: any) => ({
      author: lookupUser(v.user_id),
      action: v.vote === 'response' ? 'replied' : v.vote || 'responded',
      text: v.comment || '',
      timestamp: v.voted_at || '',
    }));

    const hasThread = thread.length > 0;

    return {
      data: { thread, hasThread, voteCount: thread.length },
      ui: hasThread ? [
        { type: 'banner', params: {
          title: 'Discussion',
          message: `${thread.length} response(s)`,
          severity: 'info',
        }},
        { type: 'comment-thread', forEach: 'thread', params: {
          author: '{{item.author}}',
          action: '{{item.action}}',
          text: '{{item.text}}',
          timestamp: '{{item.timestamp}}',
        }},
      ] : [
        { type: 'banner', params: {
          title: 'Discussion',
          message: 'No responses yet.',
          severity: 'info',
        }},
      ],
    };
  },
  requires: {},
  outputSchema: { thread: 'Array', hasThread: 'boolean' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Check Majority ───

registerFunction({
  id: 'check-majority',
  name: 'Check Majority',
  description: 'Checks if the majority voting threshold has been reached.',
  icon: 'CheckCircle',
  executor: 'local',
  fn: async (input) => {
    const proposalId = (input.config?.proposalId as string) || '';
    const documentId = input.snapshot?.documentId as string || '';

    let votes: Array<{ vote: string }> = [];
    if (documentId) {
      try {
        const res = await fetch(`/api/proposals?documentId=${documentId}`);
        if (res.ok) {
          const data = await res.json();
          const proposal = (data.proposals || []).find((p: any) => p.id === proposalId);
          if (proposal?.proposal_votes) {
            votes = proposal.proposal_votes;
          }
        }
      } catch { /* ignore */ }
    }

    const approvals = votes.filter(v => v.vote === 'approve').length;
    const rejections = votes.filter(v => v.vote === 'reject').length;
    const total = votes.length || 1;
    const majority = Math.ceil(total / 2);
    const resolved = approvals >= majority || rejections >= majority;
    const outcome = approvals >= majority ? 'approved' : rejections >= majority ? 'rejected' : 'pending';

    return {
      data: { resolved, outcome, approvals, rejections, total, majority },
      ui: [
        { type: 'banner', params: {
          title: resolved ? (outcome === 'approved' ? 'Approved' : 'Rejected') : 'Voting in Progress',
          message: `${approvals} approved, ${rejections} rejected (need ${majority} for majority)`,
          severity: resolved ? (outcome === 'approved' ? 'success' : 'warning') : 'info',
        }},
      ],
    };
  },
  requires: {},
  outputSchema: { resolved: 'boolean', outcome: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Check Unanimous ───

registerFunction({
  id: 'check-unanimous',
  name: 'Check Unanimous',
  description: 'Checks if all voters have approved.',
  icon: 'CheckCircle',
  executor: 'local',
  fn: async (input) => {
    const proposalId = (input.config?.proposalId as string) || '';
    const documentId = input.snapshot?.documentId as string || '';
    let votes: Array<{ vote: string }> = [];
    if (documentId) {
      try {
        const res = await fetch(`/api/proposals?documentId=${documentId}`);
        if (res.ok) {
          const data = await res.json();
          const proposal = (data.proposals || []).find((p: any) => p.id === proposalId);
          if (proposal?.proposal_votes) votes = proposal.proposal_votes;
        }
      } catch { /* ignore */ }
    }
    const total = votes.length || 1;
    const approvals = votes.filter(v => v.vote === 'approve').length;
    const hasRejection = votes.some(v => v.vote === 'reject');
    const resolved = approvals >= total || hasRejection;
    const outcome = hasRejection ? 'rejected' : approvals >= total ? 'approved' : 'pending';
    return {
      data: { resolved, outcome, approvals, total },
      ui: [{ type: 'banner', params: {
        title: resolved ? (outcome === 'approved' ? 'Unanimously Approved' : 'Rejected') : 'Awaiting Votes',
        message: `${approvals}/${total} approved`,
        severity: resolved ? (outcome === 'approved' ? 'success' : 'warning') : 'info',
      }}],
    };
  },
  requires: {},
  outputSchema: { resolved: 'boolean', outcome: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Check Single Approval ───

registerFunction({
  id: 'check-single-approval',
  name: 'Check Single Approval',
  description: 'Resolves when any one person approves or rejects.',
  icon: 'UserCheck',
  executor: 'local',
  fn: async (input) => {
    const proposalId = (input.config?.proposalId as string) || '';
    const documentId = input.snapshot?.documentId as string || '';
    let votes: Array<{ vote: string }> = [];
    if (documentId) {
      try {
        const res = await fetch(`/api/proposals?documentId=${documentId}`);
        if (res.ok) {
          const data = await res.json();
          const proposal = (data.proposals || []).find((p: any) => p.id === proposalId);
          if (proposal?.proposal_votes) votes = proposal.proposal_votes;
        }
      } catch { /* ignore */ }
    }
    const firstVote = votes[0];
    const resolved = votes.length > 0;
    const outcome = firstVote?.vote === 'approve' ? 'approved' : firstVote?.vote === 'reject' ? 'rejected' : 'pending';
    return {
      data: { resolved, outcome },
      ui: [{ type: 'banner', params: {
        title: resolved ? (outcome === 'approved' ? 'Approved' : 'Rejected') : 'Awaiting First Vote',
        message: resolved ? `First vote: ${outcome}` : 'No votes yet',
        severity: resolved ? (outcome === 'approved' ? 'success' : 'warning') : 'info',
      }}],
    };
  },
  requires: {},
  outputSchema: { resolved: 'boolean', outcome: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'banner', when: 'resolved', params: {
      title: '{{outcome}}', message: 'Decision made.', severity: '{{outcome === "approved" ? "success" : "warning"}}',
    }},
  ],
});


// ─── Apply Proposal ───

registerFunction({
  id: 'apply-proposal',
  name: 'Apply Proposal',
  description: 'Applies the proposed changes to the BNA via mutations.',
  icon: 'Check',
  executor: 'local',
  fn: async (input) => {
    const sectionId = input.focus?.sectionId || 'document';
    const documentId = input.snapshot?.documentId;
    const pathId = (input.config?.pathId as string) || 'decided';
    // Read reasoning from interaction store (stored by set-reasoning action)
    const reasoningResult = getResult('reasoning', sectionId);
    const reasoning = (reasoningResult?.output?.text as string)
      || (input.config?.reasoning as string) || '';

    // Read changes from interaction store (user edits > AI suggestion)
    const draftResult = getResult('render-draft', sectionId);
    const gapResult = getResult('generate-gap-suggestion', sectionId);
    const impactResult = getResult('assess-impact', sectionId);

    let allItems: any[] = [];
    if (draftResult?.output?.draftItems) {
      allItems = draftResult.output.draftItems as any[];
    } else if (gapResult?.output?.proposedOutline) {
      allItems = gapResult.output.proposedOutline as any[];
    }

    let changes = allItems.filter((d: any) =>
      d.isNew || d.isRemoved || d.status === 'changed' || d.status === 'added' || d.status === 'removed' ||
      (d.content && d.originalContent && d.content !== d.originalContent)
    );

    // forceApply (resolve "Apply Changes"): if interaction store is empty,
    // read proposed blocks directly from snapshot
    const extra = (input.focus?.extra as Record<string, unknown>) || {};
    const forceApply = extra.forceApply === 'true';

    if (changes.length === 0 && forceApply) {
      const snapshotNodes = (input.snapshot?.nodes || []) as Array<{
        id: string; content: string; parentId?: string;
        changeStatus?: string; proposedAction?: string; previousContent?: string;
      }>;
      const proposedNodes = snapshotNodes.filter(n =>
        n.parentId === sectionId && n.changeStatus === 'proposed'
      );
      for (const node of proposedNodes) {
        changes.push({
          id: node.id, content: node.content,
          status: node.proposedAction === 'add' ? 'added' : node.proposedAction === 'remove' ? 'removed' : 'changed',
          originalContent: node.previousContent || node.content,
          isNew: node.proposedAction === 'add',
          isRemoved: node.proposedAction === 'remove',
        });
      }
    }

    if (changes.length === 0) {
      return {
        data: { action: 'none', changes: [] },
        ui: [{ type: 'banner', params: { title: 'No Changes', message: 'Nothing to apply.', severity: 'info' } }],
      };
    }

    // Create proposal in DB (skip for forceApply — proposal already exists)
    const impacts = ((impactResult?.output?.impacts as any[]) || [])
      .filter((i: any) => i.impactLevel !== 'none');
    let realProposalId = '';
    try {
      if (documentId && !forceApply) {
        const res = await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId, sectionId, proposeType: pathId,
            reasoning: reasoning || 'Outline change applied',
            sourceChanges: changes,
            sectionImpacts: impacts,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          realProposalId = data?.proposal?.id || '';
        }
      }
    } catch (err) {
      console.error('[apply-proposal] Failed to create proposal:', err);
    }

    // Determine outline effect
    const effect = forceApply ? 'apply' : getOutlineEffect(pathId);

    // Build mutations for the runtime to execute
    const mutations: import('../protocol').BlockMutation[] = [];
    const userId = (input.config?.userId as string) || '';
    const userName = (input.config?.userName as string) || '';
    const now = Date.now();
    const proposalId = realProposalId || `proposal-${now}`;

    const changeBase = {
      changeBy: userId, changeByName: userName, changeAt: now,
      changeReasoning: reasoning && reasoning !== 'Outline change applied' ? reasoning : undefined,
      ...(effect === 'pending' ? { proposalId, proposeType: pathId } : {}),
    };

    for (const change of changes) {
      if (effect === 'apply') {
        // Inform: apply immediately
        if (change.isNew || change.status === 'added') {
          mutations.push({
            type: 'add-block', parentId: sectionId, content: change.content,
            updates: { ...changeBase, changeStatus: 'added' },
          });
        } else if (change.isRemoved || change.status === 'removed') {
          mutations.push({
            type: 'update-block', blockId: change.id,
            updates: { ...changeBase, changeStatus: 'removed' },
          });
        } else {
          mutations.push({
            type: 'update-block', blockId: change.id,
            updates: { ...changeBase, changeStatus: 'modified', previousContent: change.originalContent },
          });
          mutations.push({ type: 'update-content', blockId: change.id, content: change.content });
        }
      } else {
        // Discussion / Team Vote: mark as proposed (don't apply yet)
        if (change.isNew || change.status === 'added') {
          mutations.push({
            type: 'add-block', parentId: sectionId, content: change.content,
            updates: { ...changeBase, changeStatus: 'proposed', proposedAction: 'add' },
          });
        } else if (change.isRemoved || change.status === 'removed') {
          mutations.push({
            type: 'update-block', blockId: change.id,
            updates: { ...changeBase, changeStatus: 'proposed', proposedAction: 'remove', previousContent: change.originalContent || change.content },
          });
        } else {
          mutations.push({
            type: 'update-block', blockId: change.id,
            updates: { ...changeBase, changeStatus: 'proposed', proposedAction: 'modify', previousContent: change.originalContent },
          });
          mutations.push({ type: 'update-content', blockId: change.id, content: change.content });
        }
      }
    }

    // Build confirmation UI
    const nodes = (input.snapshot?.nodes || []) as Array<{ id: string; content: string }>;
    const lookupName = (id: string) => {
      const node = nodes.find(n => n.id === id);
      return node?.content?.slice(0, 40) || id;
    };

    // Notification summary: who will be notified
    const notifiedSections = impacts
      .map(i => ({
        name: lookupName(i.sectionId as string),
        level: i.impactLevel as string,
      }));

    const confirmUi: import('../protocol').UIBinding[] = [
      { type: 'banner', params: {
        title: effect === 'apply' ? 'Changes Applied' : 'Proposal Submitted',
        message: effect === 'apply'
          ? `${changes.length} change(s) applied to the outline.`
          : `${changes.length} change(s) proposed. Waiting for team response.`,
        severity: 'success',
      }},
    ];

    // Who gets notified
    if (notifiedSections.length > 0) {
      confirmUi.push({ type: 'banner', params: {
        title: 'Notifications Sent',
        message: `${notifiedSections.length} section owner(s) will be notified.`,
        severity: 'info',
      }});
      confirmUi.push({ type: 'result-list', forEach: 'notifiedSections', params: {
        title: '{{item.name}}',
        badge: '{{item.level}}',
        badgeVariant: '{{item.level === "significant" ? "warning" : "info"}}',
      }});
    } else {
      confirmUi.push({ type: 'banner', params: {
        title: 'No Notifications',
        message: 'No other sections affected.',
        severity: 'info',
      }});
    }

    return {
      data: { action: 'apply', sectionId, changes, notifiedSections, reasoning, hasChanges: true },
      mutations,
      ui: confirmUi,
    };
  },
  requires: {},
  outputSchema: { action: 'string', changes: 'Array' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Revert Proposal ───

registerFunction({
  id: 'revert-proposal',
  name: 'Revert Proposal',
  description: 'Reverts the proposed changes — restores blocks to pre-proposal state.',
  icon: 'Undo',
  executor: 'local',
  fn: (input) => {
    const sectionId = input.focus?.sectionId || 'document';

    // Read proposed blocks from snapshot (most reliable — works after page refresh)
    const nodes = (input.snapshot?.nodes || []) as Array<{
      id: string; content: string; parentId?: string;
      changeStatus?: string; proposedAction?: string; previousContent?: string;
    }>;
    const changes = nodes.filter(n =>
      n.parentId === sectionId && n.changeStatus === 'proposed'
    );

    // Build revert mutations
    const mutations: import('../protocol').BlockMutation[] = [];
    const clearFields = {
      changeStatus: undefined, changeBy: undefined, changeByName: undefined,
      changeAt: undefined, previousContent: undefined, proposalId: undefined,
      proposedAction: undefined, changeReasoning: undefined,
    };

    for (const change of changes) {
      if (change.proposedAction === 'add') {
        // Blocks added by proposal: delete them
        mutations.push({ type: 'delete-block', blockId: change.id });
      } else if (change.proposedAction === 'remove') {
        // Blocks marked for removal: clear proposed status (restore)
        mutations.push({ type: 'update-block', blockId: change.id, updates: clearFields });
      } else {
        // Modified blocks: restore original content
        if (change.previousContent) {
          mutations.push({ type: 'update-content', blockId: change.id, content: change.previousContent });
        }
        mutations.push({ type: 'update-block', blockId: change.id, updates: clearFields });
      }
    }

    return {
      data: { action: 'revert', changes: changes.length },
      mutations,
      ui: [{ type: 'banner', params: {
        title: 'Proposal Dropped',
        message: `${changes.length} change(s) reverted.`,
        severity: 'info',
      }}],
    };
  },
  requires: {},
  outputSchema: { action: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Submit Reply ───

registerFunction({
  id: 'submit-reply',
  name: 'Submit Reply',
  description: 'Submits a reply/comment on a proposal discussion.',
  icon: 'MessageSquare',
  executor: 'local',
  fn: async (input) => {
    const extra = input.focus?.extra as Record<string, unknown> || {};
    const sectionId = input.focus?.sectionId || 'document';
    const proposalId = (extra.proposalId || input.config?.proposalId) as string;
    // Read reply text from interaction store (stored by set-reply action)
    const replyResult = getResult('reply', sectionId);
    const comment = (replyResult?.output?.text as string)
      || (extra.comment || input.config?.comment) as string || '';


    if (!proposalId) {
      return {
        data: { success: false },
        ui: [{ type: 'banner', params: { title: 'Error', message: 'No proposal to reply to.', severity: 'error' } }],
      };
    }
    if (!comment.trim()) {
      return {
        data: { success: false },
        ui: [{ type: 'banner', params: { title: 'Error', message: 'Please enter a reply.', severity: 'error' } }],
      };
    }

    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote: 'response', comment }),
      });
      if (!res.ok) {
        return {
          data: { success: false },
          ui: [{ type: 'banner', params: { title: 'Error', message: `Failed: ${res.status}`, severity: 'error' } }],
        };
      }
      return {
        data: { success: true },
        ui: [{ type: 'banner', params: { title: 'Reply Sent', message: 'Your reply has been submitted.', severity: 'success' } }],
      };
    } catch {
      return {
        data: { success: false },
        ui: [{ type: 'banner', params: { title: 'Error', message: 'Failed to send reply.', severity: 'error' } }],
      };
    }
  },
  requires: {},
  outputSchema: { success: 'boolean' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});


// ─── Submit Vote ───

registerFunction({
  id: 'submit-vote',
  name: 'Submit Vote',
  description: 'Submits a vote (acknowledge, approve, reject, escalate) on a proposal.',
  icon: 'Vote',
  executor: 'local',
  fn: async (input) => {
    // Read from config (passed by NegotiateRunner) and focus.extra (passed by step params)
    const extra = input.focus?.extra as Record<string, unknown> || {};
    const sectionId = input.focus?.sectionId || 'document';
    const proposalId = (extra.proposalId || input.config?.proposalId) as string;
    const vote = (extra.vote || input.config?.vote) as string || 'acknowledge';
    // Read comment from interaction store (set-reply action) or from params
    const replyResult = getResult('reply', sectionId);
    const comment = (replyResult?.output?.text as string)
      || (extra.comment || input.config?.comment) as string || '';

    if (!proposalId) {
      return {
        data: { success: false, error: 'No proposal ID' },
        ui: [{ type: 'banner', params: { title: 'Error', message: 'No proposal to vote on.', severity: 'error' } }],
      };
    }

    try {
      const response = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote, comment }),
      });
      const result = await response.json();

      return {
        data: { success: true, vote, resolved: result.resolved || null },
        ui: [{ type: 'banner', params: {
          title: vote === 'acknowledge' ? 'Acknowledged' : vote === 'approve' ? 'Approved' : vote === 'reject' ? 'Rejected' : 'Submitted',
          message: vote === 'acknowledge' ? 'You have acknowledged this change.' : `Vote: ${vote}`,
          severity: 'success',
        }}],
      };
    } catch (err) {
      return {
        data: { success: false, error: String(err) },
        ui: [{ type: 'banner', params: { title: 'Error', message: 'Failed to submit vote.', severity: 'error' } }],
      };
    }
  },
  requires: {},
  outputSchema: { success: 'boolean', vote: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});
