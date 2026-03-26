import { registerFunction, type FunctionInput } from '../protocol';
import { getResult } from '../../interaction-store';

registerFunction({
  id: 'frame-proposal',
  name: 'Proposal Framing',
  description: 'Auto-attach impact analysis and history to proposals for informed decision-making.',
  icon: 'Frame',
  trigger: 'proposal',
  target: { type: 'section', description: 'Aggregates awareness results to frame a proposal' },
  category: 'proposing',
  triggerOptions: [{ value: 'auto', label: 'Automatic on propose' }],
  defaultTrigger: 'auto',
  dependsOn: ['check-drift', 'assess-impact'],

  requires: { writing: true, dependencies: true },

  executor: 'local',
  fn: async (input: FunctionInput) => {
    const sectionId = input.focus?.sectionId;
    if (!sectionId) {
      return { data: { framing: null, summary: 'No section specified' } };
    }

    const notification = input.config?.notification as Record<string, unknown> | null;
    const isReviewer = !!notification;

    // Gather prior results — from interaction store (proposer) or notification (reviewer)
    const driftResult = getResult('check-drift', sectionId);
    const impactResult = getResult('assess-impact', sectionId);

    // Build framing context
    const driftLevel = driftResult?.output?.level as string | undefined;
    const impacts = (impactResult?.output?.impacts as Array<Record<string, unknown>>) ?? [];
    const significantImpacts = impacts.filter(i => i.impactLevel === 'significant');
    const minorImpacts = impacts.filter(i => i.impactLevel === 'minor');

    // Compute scope and severity for Gate evaluation
    const scope = significantImpacts.length > 0 ? 'cross-section' : 'same-section';
    const severity = significantImpacts.length > 0 ? 'significant'
      : minorImpacts.length > 0 ? 'minor' : 'none';

    const framing = {
      driftLevel: driftLevel ?? 'unknown',
      scope,
      severity,
      impactedSectionCount: significantImpacts.length + minorImpacts.length,
      significantImpacts: significantImpacts.map(i => ({
        sectionId: i.sectionId,
        reason: i.reason,
      })),
      proposedChanges: input.focus?.proposedChanges ?? [],
      checkedAt: driftResult?.timestamp ?? null,
    };

    const summaryParts: string[] = [];
    if (driftLevel) summaryParts.push(`Drift: ${driftLevel}`);
    if (significantImpacts.length > 0) {
      summaryParts.push(`${significantImpacts.length} section(s) significantly affected`);
    }
    if (minorImpacts.length > 0) {
      summaryParts.push(`${minorImpacts.length} minor impact(s)`);
    }

    // Build all impacts with section names (lookup from snapshot nodes)
    const nodes = (input.snapshot?.nodes || []) as Array<{ id: string; content: string; parentId?: string }>;
    const lookupName = (id: string) => {
      const node = nodes.find(n => n.id === id);
      if (!node) return id;
      // Truncate long content
      const name = node.content.length > 40 ? node.content.slice(0, 40) + '...' : node.content;
      return name;
    };
    const buildImpact = (i: Record<string, unknown>, level: string) => {
      const sid = i.sectionId as string;
      return {
        sectionId: sid,
        sectionName: lookupName(sid),
        level,
        reason: i.reason as string,
      };
    };

    const allImpacts = [
      ...significantImpacts.map(i => buildImpact(i, 'significant')),
      ...minorImpacts.map(i => buildImpact(i, 'minor')),
    ];

    const ui: import('../protocol').UIBinding[] = [];

    if (isReviewer) {
      // ── Reviewer view: show impact on their section + proposer's reasoning ──
      const impactReason = (notification.reason as string) || '';
      const impactLevel = (notification.impactLevel as string) || 'minor';
      const proposerReasoning = (notification.reasoning as string) || '';
      const proposedBy = (notification.proposedByName as string) || '';

      // Why your section is affected
      const isGeneric = !impactReason || impactReason === 'General team update';
      ui.push({
        type: 'banner',
        params: {
          title: isGeneric ? 'Team Update' : 'Impact on Your Section',
          message: isGeneric
            ? `${proposedBy} made changes to ${(notification.sourceSectionName as string) || 'another section'}. Please review.`
            : impactReason,
          severity: impactLevel === 'significant' ? 'warning' : 'info',
        },
      });

      // AI suggested changes for YOUR section (if any)
      const suggestedChanges = (notification.suggestedChanges as any[]) || [];
      if (suggestedChanges.length > 0) {
        ui.push({
          type: 'result-list',
          forEach: 'suggestedChangesForYou',
          params: {
            title: '{{item.content}}',
            badge: '{{item.action}}',
            badgeVariant: '{{item.action === "add" ? "new" : item.action === "remove" ? "removed" : "modified"}}',
            detail: '{{item.reason}}',
          },
        });
      }

      // Proposer's reasoning
      if (proposerReasoning) {
        ui.push({
          type: 'banner',
          params: {
            title: `${proposedBy} says`,
            message: `"${proposerReasoning}"`,
            severity: 'info',
          },
        });
      }

      // Reply input for reviewer
      ui.push({
        type: 'text-input',
        params: {
          label: 'Your reply (optional)',
          placeholder: 'Add a comment or question...',
          action: 'set-reply',
          rows: '2',
        },
      });
    } else {
      // ── Proposer view: show all affected sections + reasoning input ──
      if (allImpacts.length > 0) {
        ui.push({
          type: 'banner',
          params: {
            title: 'Affected Sections',
            message: summaryParts.join('. '),
            severity: significantImpacts.length > 0 ? 'warning' : 'info',
          },
        });
        ui.push({
          type: 'result-list',
          forEach: 'allImpacts',
          params: {
            title: '{{item.sectionName}}',
            badge: '{{item.level}}',
            badgeVariant: '{{item.level === "significant" ? "warning" : "info"}}',
            detail: '{{item.reason}}',
          },
        });
      } else {
        ui.push({
          type: 'banner',
          params: {
            title: 'No Cross-Section Impact',
            message: 'This change only affects the current section.',
            severity: 'success',
          },
        });
      }

      // Reasoning input (only for proposer)
      ui.push({
        type: 'text-input',
        params: {
          label: 'Why are you making this change?',
          placeholder: 'Explain your reasoning (optional)',
          action: 'set-reasoning',
          rows: '2',
        },
      });
    }

    // For reviewer: include suggested changes for their section in the data
    const suggestedChangesForYou = isReviewer
      ? ((notification?.suggestedChanges as any[]) || [])
      : [];

    return {
      data: {
        framing,
        allImpacts,
        suggestedChangesForYou,
        scope,
        severity,
        isReviewer,
        summary: summaryParts.join('. ') || 'No prior analysis available.',
      },
      ui,
    };
  },

  outputSchema: {
    framing: "{ driftLevel, scope, severity, impactedSectionCount, significantImpacts, proposedChanges, checkedAt }",
    scope: "'same-section' | 'cross-section'",
    severity: "'none' | 'minor' | 'significant'",
    summary: "string",
  },

  // Static UI removed — frame-proposal now returns dynamic UI from fn()
  ui: [],

  configFields: [],
  defaultConfig: {},
});
