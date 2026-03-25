// ─── Proposal & Resolution Functions ───
//
// These functions replace hardcoded show-data/resolution logic.
// They read from DocumentSnapshot (proposal data, votes, etc.)
// and render through display bindings like any other function.

import { registerFunction } from '../protocol';
import { getResult } from '../../interaction-store';

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

    return {
      data: { changes, reason, proposedBy, sourceSectionName, hasChanges: changes.length > 0, isReviewer },
      ui: changes.length > 0 ? [
        // Header: who changed what (reviewer) or "Your Changes" (proposer)
        { type: 'banner', params: {
          title: isReviewer ? `${proposedBy} changed ${sourceSectionName}` : 'Your Changes',
          message: `${changes.length} change(s)`,
          severity: isReviewer ? 'warning' : 'info',
        }},
        { type: 'result-list', forEach: 'changes',
          params: {
            title: '{{item.content}}',
            badge: '{{item.status}}',
            badgeVariant: '{{item.status === "added" ? "new" : item.status === "removed" ? "removed" : "modified"}}',
            detail: '{{item.reason}}',
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
  description: 'Displays voting progress toward threshold.',
  icon: 'BarChart',
  executor: 'local',
  fn: (input) => {
    const proposal = getProposal(input);
    const votes: any[] = proposal?.votes || [];
    const approvalCount = votes.filter((v) => v.action === 'approve').length;
    const totalEligible = (input.focus?.extra?.eligibleCount as number) || votes.length || 1;
    const threshold = Math.ceil(totalEligible / 2);
    return {
      data: { approvalCount, threshold, votes },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { approvalCount: 'number', threshold: 'number', votes: 'Array' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'progress-bar', params: {
      current: '{{approvalCount}}', total: '{{threshold}}',
      label: '{{approvalCount}}/{{threshold}} approved', variant: 'success',
    }},
  ],
});


// ─── Render Vote Thread ───

registerFunction({
  id: 'render-vote-thread',
  name: 'Render Vote Thread',
  description: 'Displays the list of votes and comments.',
  icon: 'MessageSquare',
  executor: 'local',
  fn: (input) => {
    const proposal = getProposal(input);
    const votes = proposal?.votes || [];
    return {
      data: { votes },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { votes: 'Array' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'comment-thread', forEach: 'votes', params: {
      author: '{{item.userName}}', action: '{{item.action}}', text: '{{item.comment}}',
    }},
  ],
});


// ─── Check Majority ───

registerFunction({
  id: 'check-majority',
  name: 'Check Majority',
  description: 'Checks if the majority voting threshold has been reached.',
  icon: 'CheckCircle',
  executor: 'local',
  fn: (input) => {
    const proposal = getProposal(input);
    const votes: any[] = proposal?.votes || [];
    const approvals = votes.filter((v) => v.action === 'approve').length;
    const rejections = votes.filter((v) => v.action === 'reject').length;
    const total = (input.focus?.extra?.eligibleCount as number) || votes.length || 1;
    const majority = Math.ceil(total / 2);
    const resolved = approvals >= majority || rejections >= majority;
    const outcome = approvals >= majority ? 'approved' : rejections >= majority ? 'rejected' : 'pending';
    return {
      data: { resolved, outcome, approvals, rejections, total, majority },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { resolved: 'boolean', outcome: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'banner', when: 'resolved', params: {
      title: '{{outcome === "approved" ? "Approved" : "Rejected"}}',
      message: '{{approvals}}/{{majority}} needed · {{approvals}} approved, {{rejections}} rejected',
      severity: '{{outcome === "approved" ? "success" : "warning"}}',
    }},
  ],
});


// ─── Check Unanimous ───

registerFunction({
  id: 'check-unanimous',
  name: 'Check Unanimous',
  description: 'Checks if all voters have approved.',
  icon: 'CheckCircle',
  executor: 'local',
  fn: (input) => {
    const proposal = getProposal(input);
    const votes: any[] = proposal?.votes || [];
    const total = (input.focus?.extra?.eligibleCount as number) || votes.length || 1;
    const approvals = votes.filter((v) => v.action === 'approve').length;
    const hasRejection = votes.some((v) => v.action === 'reject');
    const resolved = approvals >= total || hasRejection;
    const outcome = hasRejection ? 'rejected' : approvals >= total ? 'approved' : 'pending';
    return {
      data: { resolved, outcome, approvals, total },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { resolved: 'boolean', outcome: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'banner', when: 'resolved', params: {
      title: '{{outcome}}', message: '{{approvals}}/{{total}} approved', severity: '{{outcome === "approved" ? "success" : "warning"}}',
    }},
  ],
});


// ─── Check Single Approval ───

registerFunction({
  id: 'check-single-approval',
  name: 'Check Single Approval',
  description: 'Resolves when any one person approves or rejects.',
  icon: 'UserCheck',
  executor: 'local',
  fn: (input) => {
    const proposal = getProposal(input);
    const votes: any[] = proposal?.votes || [];
    const firstVote = votes[0];
    const resolved = votes.length > 0;
    const outcome = firstVote?.action === 'approve' ? 'approved' : firstVote?.action === 'reject' ? 'rejected' : 'pending';
    return {
      data: { resolved, outcome },
      ui: [],
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

    const changes = allItems.filter((d: any) =>
      d.isNew || d.isRemoved || d.status === 'changed' || d.status === 'added' || d.status === 'removed' ||
      (d.content && d.originalContent && d.content !== d.originalContent)
    );

    if (changes.length === 0) {
      return {
        data: { action: 'none', changes: [] },
        ui: [{ type: 'banner', params: { title: 'No Changes', message: 'Nothing to apply.', severity: 'info' } }],
      };
    }

    // Create proposal in DB
    const impacts = ((impactResult?.output?.impacts as any[]) || [])
      .filter((i: any) => i.impactLevel !== 'none');
    try {
      if (documentId) {
        await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId, sectionId, proposeType: pathId,
            reasoning: reasoning || 'Outline change applied',
            sourceChanges: changes,
            sectionImpacts: impacts,
          }),
        });
      }
    } catch (err) {
      console.error('[apply-proposal] Failed to create proposal:', err);
    }

    // Build mutations for the runtime to execute
    const mutations: import('../protocol').BlockMutation[] = [];
    const userId = (input.config?.userId as string) || '';
    const userName = (input.config?.userName as string) || '';
    const now = Date.now();

    const changeBase = {
      changeBy: userId, changeByName: userName, changeAt: now,
      changeReasoning: reasoning && reasoning !== 'Outline change applied' ? reasoning : undefined,
    };

    for (const change of changes) {
      if (change.isNew || change.status === 'added') {
        mutations.push({
          type: 'add-block',
          parentId: sectionId,
          content: change.content,
          updates: { ...changeBase, changeStatus: 'added' },
        });
      } else if (change.isRemoved || change.status === 'removed') {
        mutations.push({
          type: 'update-block',
          blockId: change.id,
          updates: { ...changeBase, changeStatus: 'removed' },
        });
      } else {
        mutations.push({
          type: 'update-block',
          blockId: change.id,
          updates: { ...changeBase, changeStatus: 'modified', previousContent: change.originalContent },
        });
        mutations.push({
          type: 'update-content',
          blockId: change.id,
          content: change.content,
        });
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
        title: 'Changes Applied',
        message: `${changes.length} change(s) applied to the outline.`,
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
  description: 'Reverts the proposed changes.',
  icon: 'Undo',
  executor: 'local',
  fn: (input) => {
    return {
      data: { action: 'revert', proposalId: input.snapshot?.proposals?.[0]?.id },
      ui: [],
    };
  },
  requires: {},
  outputSchema: { action: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [
    { type: 'banner', params: {
      title: 'Changes Reverted', message: 'The proposal has been rejected.', severity: 'info',
    }},
  ],
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
    const proposalId = (extra.proposalId || input.config?.proposalId) as string;
    const vote = (extra.vote || input.config?.vote) as string || 'acknowledge';
    const comment = (extra.comment || input.config?.comment) as string || '';

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
