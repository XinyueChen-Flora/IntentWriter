// ─── Pipeline ↔ MetaRuleConfig Compatibility ───
// Converts between the old flat MetaRuleConfig and the new Pipeline format.
// MetaRuleConfig is still used at runtime (shouldBypassGate, resolveCoordinationPath).
// Pipeline is used by the builder UI and stored in roomMeta.

import type { MetaRuleConfig } from './metarule-types';
import { DEFAULT_METARULE_CONFIG } from './metarule-types';
import type { Pipeline, StageInstance } from './pipeline-protocol';
import { createStageInstance, findStage } from './pipeline-protocol';
import {
  DRIFT_DETECTION,
  IMPACT_PREVIEW,
  GATE,
  ROUTING,
  APPLY,
  WRITER_PROPOSES,
  TEAM_RESPONDS,
  createDefaultPipeline,
} from './pipeline-stages';

/** Convert a Pipeline to the flat MetaRuleConfig used at runtime */
export function pipelineToMetaRule(pipeline: Pipeline): MetaRuleConfig {
  const detection = findStage(pipeline, 'drift-detection');
  const gate = findStage(pipeline, 'gate');
  const routing = findStage(pipeline, 'routing');
  const apply = findStage(pipeline, 'apply');

  const routes = (routing?.config?.routes as Record<string, string>) ?? { minor: 'decided', significant: 'negotiate' };

  return {
    version: 1,

    detection: {
      checks: [{
        type: 'drift',
        trigger: (detection?.config?.trigger as any) ?? 'manual',
        autoFrequency: (detection?.config?.autoFrequency as any) ?? undefined,
        autoIntervalMinutes: (detection?.config?.autoIntervalMinutes as number) ?? undefined,
        displayMode: (detection?.config?.displayMode as any) ?? 'inline',
      }],
    },

    gate: {
      bypassWhenNoImpact: (gate?.config?.bypassWhenNoImpact as boolean) ?? true,
      bypassWhenAllMinor: (gate?.config?.bypassWhenAllMinor as boolean) ?? false,
      ownerCanSelfResolve: (gate?.config?.ownerCanSelfResolve as boolean) ?? true,
    },

    routing: [
      { condition: { impactLevel: 'none' }, path: 'decided' as any },
      { condition: { impactLevel: 'minor' }, path: (routes.minor ?? 'decided') as any },
      { condition: { impactLevel: 'significant' }, path: (routes.significant ?? 'negotiate') as any },
    ],

    coordination: {
      decided: {
        defaultNotifyLevel: (routing?.config?.['decided.notifyLevel'] as any) ?? 'heads-up',
        receiverCanEscalate: (routing?.config?.['decided.receiverCanEscalate'] as boolean) ?? true,
        escalateTo: (routing?.config?.['decided.escalateTo'] as any) ?? 'discussion',
      },
      input: {
        routeTo: (routing?.config?.['input.routeTo'] as any) ?? 'impacted-owners',
        receiverActions: (routing?.config?.['input.receiverActions'] as any) ?? 'approve-suggest',
        noResponsePolicy: (routing?.config?.['input.noResponsePolicy'] as any) ?? 'auto-approve',
        deadlineHours: (routing?.config?.['input.deadlineHours'] as number) ?? 48,
      },
      discussion: {
        participants: (routing?.config?.['discussion.participants'] as any) ?? 'impacted-owners',
        closedBy: (routing?.config?.['discussion.closedBy'] as any) ?? 'proposer',
        receiverCanCounterPropose: (routing?.config?.['discussion.receiverCanCounterPropose'] as boolean) ?? true,
        receiverCanEscalate: (routing?.config?.['discussion.receiverCanEscalate'] as boolean) ?? true,
        noResponsePolicy: (routing?.config?.['discussion.noResponsePolicy'] as any) ?? 'wait',
        deadlineHours: (routing?.config?.['discussion.deadlineHours'] as number) ?? 72,
      },
      negotiate: {
        voteThreshold: (routing?.config?.['negotiate.voteThreshold'] as any) ?? 'majority',
        voters: (routing?.config?.['negotiate.voters'] as any) ?? 'impacted-owners',
        receiverCanCounterPropose: (routing?.config?.['negotiate.receiverCanCounterPropose'] as boolean) ?? false,
        noResponsePolicy: (routing?.config?.['negotiate.noResponsePolicy'] as any) ?? 'count-as-abstain',
        deadlineHours: (routing?.config?.['negotiate.deadlineHours'] as number) ?? 48,
      },
    },

    apply: {
      autoApplyOnApproval: (apply?.config?.autoApplyOnApproval as boolean) ?? false,
      autoGenerateWritingPreview: (apply?.config?.autoGenerateWritingPreview as boolean) ?? true,
    },

    allowOverride: pipeline.allowOverride,
    updatedAt: pipeline.updatedAt,
    updatedBy: pipeline.updatedBy,
  };
}

/** Convert an old MetaRuleConfig to the new Pipeline format */
export function metaRuleToPipeline(config: MetaRuleConfig): Pipeline {
  const pipeline = createDefaultPipeline();

  // Detection
  const detection = findStage(pipeline, 'drift-detection');
  if (detection) {
    const check = config.detection.checks[0];
    if (check) {
      detection.config.trigger = check.trigger;
      detection.config.autoFrequency = check.autoFrequency ?? 'per-paragraph';
      detection.config.autoIntervalMinutes = check.autoIntervalMinutes ?? 5;
      detection.config.displayMode = check.displayMode;
    }
  }

  // Gate
  const gate = findStage(pipeline, 'gate');
  if (gate) {
    gate.config.bypassWhenNoImpact = config.gate.bypassWhenNoImpact;
    gate.config.bypassWhenAllMinor = config.gate.bypassWhenAllMinor;
    gate.config.ownerCanSelfResolve = config.gate.ownerCanSelfResolve;
  }

  // Routing
  const routing = findStage(pipeline, 'routing');
  if (routing) {
    const minorRule = config.routing.find((r) => r.condition.impactLevel === 'minor');
    const sigRule = config.routing.find((r) => r.condition.impactLevel === 'significant');
    routing.config.routes = {
      minor: minorRule?.path ?? 'decided',
      significant: sigRule?.path ?? 'negotiate',
    };
    // Inform
    routing.config['decided.notifyLevel'] = config.coordination.decided.defaultNotifyLevel;
    routing.config['decided.receiverCanEscalate'] = config.coordination.decided.receiverCanEscalate ?? true;
    routing.config['decided.escalateTo'] = config.coordination.decided.escalateTo ?? 'discussion';
    // Input
    routing.config['input.routeTo'] = config.coordination.input.routeTo;
    routing.config['input.receiverActions'] = config.coordination.input.receiverActions ?? 'approve-suggest';
    routing.config['input.noResponsePolicy'] = config.coordination.input.noResponsePolicy ?? 'auto-approve';
    routing.config['input.deadlineHours'] = config.coordination.input.deadlineHours ?? 48;
    // Discussion
    routing.config['discussion.participants'] = config.coordination.discussion.participants;
    routing.config['discussion.closedBy'] = config.coordination.discussion.closedBy;
    routing.config['discussion.receiverCanCounterPropose'] = config.coordination.discussion.receiverCanCounterPropose ?? true;
    routing.config['discussion.receiverCanEscalate'] = config.coordination.discussion.receiverCanEscalate ?? true;
    routing.config['discussion.noResponsePolicy'] = config.coordination.discussion.noResponsePolicy ?? 'wait';
    routing.config['discussion.deadlineHours'] = config.coordination.discussion.deadlineHours ?? 72;
    // Vote
    routing.config['negotiate.voteThreshold'] = config.coordination.negotiate.voteThreshold;
    routing.config['negotiate.voters'] = config.coordination.negotiate.voters;
    routing.config['negotiate.receiverCanCounterPropose'] = config.coordination.negotiate.receiverCanCounterPropose ?? false;
    routing.config['negotiate.noResponsePolicy'] = config.coordination.negotiate.noResponsePolicy ?? 'count-as-abstain';
    routing.config['negotiate.deadlineHours'] = config.coordination.negotiate.deadlineHours ?? 48;
  }

  // Apply
  const apply = findStage(pipeline, 'apply');
  if (apply) {
    apply.config.autoApplyOnApproval = config.apply.autoApplyOnApproval;
    apply.config.autoGenerateWritingPreview = config.apply.autoGenerateWritingPreview;
  }

  pipeline.allowOverride = config.allowOverride;
  pipeline.updatedAt = config.updatedAt;
  pipeline.updatedBy = config.updatedBy;

  return pipeline;
}
