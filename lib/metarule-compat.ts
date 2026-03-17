// ─── MetaRule V1 ↔ V2 Compatibility ───
//
// Converts between the existing MetaRuleConfig (v1) and MetaRuleV2.
// Existing rooms with v1 config auto-convert on read.
// This ensures backward compatibility during the migration period.
//
// V1: Flat config with hardcoded routing rules (impactLevel → path)
// V2: WHEN-THEN rules referencing capability results and coordination paths
//
// Usage:
//   const v2 = metaRuleV1ToV2(existingConfig);  // auto-upgrade on room load
//   const v1 = metaRuleV2ToV1(v2Config);         // for runtime compat

import type { MetaRuleConfig } from './metarule-types';
import { DEFAULT_METARULE_CONFIG } from './metarule-types';
import type { MetaRuleV2, MetaRuleRule } from './metarule-engine';

/**
 * Convert a V1 MetaRuleConfig to V2 MetaRuleV2.
 *
 * Translation logic:
 * - V1 routing rules become WHEN-THEN rules on the 'assess-impact' capability
 * - V1 gate bypass rules become high-priority rules that route to 'decided' with skip
 * - V1 coordination path configs become pathConfig on each rule's `then`
 */
export function metaRuleV1ToV2(v1: MetaRuleConfig): MetaRuleV2 {
  const rules: MetaRuleRule[] = [];
  let priority = 10;

  // ─── Gate bypass → high-priority rules that skip coordination ───

  if (v1.gate.bypassWhenNoImpact) {
    rules.push({
      id: `compat-bypass-no-impact`,
      name: 'Bypass: no cross-section impact',
      priority: priority++,
      when: {
        functionId: 'assess-impact',
        field: 'hasCrossSection',
        operator: 'equals',
        value: false,
      },
      then: {
        pathId: 'decided',
        pathConfig: { notifyLevel: v1.coordination.decided.defaultNotifyLevel },
      },
    });
  }

  if (v1.gate.bypassWhenAllMinor) {
    rules.push({
      id: `compat-bypass-all-minor`,
      name: 'Bypass: all impacts minor',
      priority: priority++,
      when: {
        functionId: 'assess-impact',
        field: 'maxLevel',
        operator: 'not-equals',
        value: 'significant',
      },
      then: {
        pathId: 'decided',
        pathConfig: { notifyLevel: v1.coordination.decided.defaultNotifyLevel },
      },
    });
  }

  // ─── Routing rules → WHEN-THEN rules ───

  for (const route of v1.routing) {
    if (!route.condition.impactLevel || route.condition.impactLevel === 'none') continue;

    const pathConfig = buildPathConfig(v1, route.path);

    rules.push({
      id: `compat-route-${route.condition.impactLevel}`,
      name: `${route.condition.impactLevel} impact → ${route.path}`,
      priority: priority++,
      when: {
        functionId: 'assess-impact',
        field: 'maxLevel',
        operator: 'equals',
        value: route.condition.impactLevel,
      },
      then: {
        pathId: route.path,
        pathConfig,
      },
    });
  }

  // ─── Functions ───

  const driftCheck = v1.detection.checks.find(c => c.type === 'drift');

  return {
    version: 2,
    functions: {
      'check-drift': {
        enabled: true,
        config: {
          trigger: driftCheck?.trigger ?? 'manual',
          displayMode: driftCheck?.displayMode ?? 'inline',
          autoFrequency: driftCheck?.autoFrequency,
          autoIntervalMinutes: driftCheck?.autoIntervalMinutes,
        },
      },
      'assess-impact': {
        enabled: true,
        config: {},
      },
    },
    rules,
    allowOverride: v1.allowOverride,
  };
}

/**
 * Convert a V2 MetaRuleV2 back to V1 MetaRuleConfig.
 * Used for runtime compatibility with existing code that reads V1 config.
 *
 * This is a best-effort conversion — V2 rules that don't map to V1's
 * fixed structure are approximated.
 */
export function metaRuleV2ToV1(v2: MetaRuleV2): MetaRuleConfig {
  const config = { ...DEFAULT_METARULE_CONFIG };

  // ─── Functions → detection config ───

  const driftCap = v2.functions['check-drift'];
  if (driftCap) {
    config.detection = {
      checks: [{
        type: 'drift',
        trigger: (driftCap.config.trigger as 'auto' | 'manual') ?? 'manual',
        displayMode: (driftCap.config.displayMode as 'inline' | 'summary' | 'severe-only') ?? 'inline',
        autoFrequency: driftCap.config.autoFrequency as 'per-paragraph' | 'per-minute' | undefined,
        autoIntervalMinutes: driftCap.config.autoIntervalMinutes as number | undefined,
      }],
    };
  }

  // ─── Rules → routing + gate + coordination ───

  // Find bypass rules (they route to 'decided' with high priority)
  const bypassRules = v2.rules.filter(
    r => r.then.pathId === 'decided' && r.priority < 20
  );

  config.gate.bypassWhenNoImpact = bypassRules.some(
    r => r.when.field === 'hasCrossSection' && r.when.operator === 'equals' && r.when.value === false
  );
  config.gate.bypassWhenAllMinor = bypassRules.some(
    r => r.when.field === 'maxLevel' && r.when.operator === 'not-equals' && r.when.value === 'significant'
  );

  // Find routing rules (impact level → path)
  const routingRules = v2.rules.filter(
    r => r.when.functionId === 'assess-impact' &&
         r.when.field === 'maxLevel' &&
         r.when.operator === 'equals' &&
         r.priority >= 20
  );

  config.routing = [
    { condition: { impactLevel: 'none' }, path: 'decided' as const },
    ...routingRules.map(r => ({
      condition: { impactLevel: r.when.value as 'minor' | 'significant' },
      path: r.then.pathId as 'decided' | 'input' | 'discussion' | 'negotiate',
    })),
  ];

  // Fill in missing routing entries
  if (!config.routing.find(r => r.condition.impactLevel === 'minor')) {
    config.routing.push({ condition: { impactLevel: 'minor' }, path: 'decided' });
  }
  if (!config.routing.find(r => r.condition.impactLevel === 'significant')) {
    config.routing.push({ condition: { impactLevel: 'significant' }, path: 'negotiate' });
  }

  // Extract coordination configs from rule pathConfigs
  for (const rule of v2.rules) {
    const pc = rule.then.pathConfig;
    switch (rule.then.pathId) {
      case 'decided':
        if (pc.notifyLevel) config.coordination.decided.defaultNotifyLevel = pc.notifyLevel as 'skip' | 'heads-up' | 'notify';
        break;
      case 'input':
        if (pc.routeTo) config.coordination.input.routeTo = pc.routeTo as 'impacted-owners' | 'all-members';
        break;
      case 'discussion':
        if (pc.participants) config.coordination.discussion.participants = pc.participants as 'impacted-owners' | 'all-members';
        if (pc.closedBy) config.coordination.discussion.closedBy = pc.closedBy as 'proposer' | 'anyone' | 'consensus';
        break;
      case 'negotiate':
        if (pc.voteThreshold) config.coordination.negotiate.voteThreshold = pc.voteThreshold as 'any' | 'majority' | 'all';
        if (pc.voters) config.coordination.negotiate.voters = pc.voters as 'impacted-owners' | 'all-members';
        break;
    }
  }

  config.allowOverride = v2.allowOverride;

  return config;
}

/**
 * Auto-detect version and return a normalized V2 config.
 * If already V2, returns as-is. If V1, converts.
 */
export function ensureMetaRuleV2(
  config: MetaRuleConfig | MetaRuleV2 | undefined
): MetaRuleV2 {
  if (!config) {
    return metaRuleV1ToV2(DEFAULT_METARULE_CONFIG);
  }
  if ('version' in config && config.version === 2) {
    return config as MetaRuleV2;
  }
  return metaRuleV1ToV2(config as MetaRuleConfig);
}

// ─── Internal helpers ───

function buildPathConfig(
  v1: MetaRuleConfig,
  pathId: string
): Record<string, unknown> {
  switch (pathId) {
    case 'decided':
      return {
        notifyLevel: v1.coordination.decided.defaultNotifyLevel,
        receiverCanEscalate: v1.coordination.decided.receiverCanEscalate,
        escalateTo: v1.coordination.decided.escalateTo,
      };
    case 'input':
      return {
        routeTo: v1.coordination.input.routeTo,
        receiverActions: v1.coordination.input.receiverActions,
        noResponsePolicy: v1.coordination.input.noResponsePolicy,
        deadlineHours: v1.coordination.input.deadlineHours,
      };
    case 'discussion':
      return {
        participants: v1.coordination.discussion.participants,
        closedBy: v1.coordination.discussion.closedBy,
        receiverCanCounterPropose: v1.coordination.discussion.receiverCanCounterPropose,
        receiverCanEscalate: v1.coordination.discussion.receiverCanEscalate,
        noResponsePolicy: v1.coordination.discussion.noResponsePolicy,
        deadlineHours: v1.coordination.discussion.deadlineHours,
      };
    case 'negotiate':
      return {
        voteThreshold: v1.coordination.negotiate.voteThreshold,
        voters: v1.coordination.negotiate.voters,
        receiverCanCounterPropose: v1.coordination.negotiate.receiverCanCounterPropose,
        noResponsePolicy: v1.coordination.negotiate.noResponsePolicy,
        deadlineHours: v1.coordination.negotiate.deadlineHours,
      };
    default:
      return {};
  }
}
