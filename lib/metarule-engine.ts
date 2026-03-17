// ─── MetaRule Engine ───
//
// The WHEN-THEN rule evaluation engine.
// Teams compose rules that connect capability results to coordination paths:
//
//   WHEN check-drift.alignedIntents is-not-empty
//   THEN vote(threshold: majority)
//
// The engine evaluates rules against capability results and returns
// which coordination path (and config) should be used.
//
// This is pure platform logic — no hardcoded capabilities or paths.
//
// Usage:
//   const result = evaluateRules(rules, capabilityResults);
//   if (result) {
//     // Use result.pathId and result.pathConfig for coordination
//   }

import type { FunctionResult } from '@/platform/functions/protocol';

// ─── MetaRule V2 Types ───

/** A single WHEN-THEN rule */
export type MetaRuleRule = {
  /** Unique rule ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Lower number = higher priority. Rules are evaluated in priority order. */
  priority: number;
  /** The condition to check */
  when: {
    /** Which capability's output to check */
    functionId: string;
    /** Dot-path into the capability result data (e.g. "maxLevel", "alignedIntents.length") */
    field: string;
    /** Comparison operator */
    operator: 'equals' | 'not-equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'is-empty' | 'is-not-empty';
    /** The value to compare against (not used for is-empty / is-not-empty) */
    value?: unknown;
  };
  /** What to do when the condition matches */
  then: {
    /** Which coordination path to use */
    pathId: string;
    /** Config overrides for that path (e.g. { voteThreshold: 'majority' }) */
    pathConfig: Record<string, unknown>;
  };
};

/** The complete MetaRule V2 configuration for a room */
export type MetaRuleV2 = {
  version: 2;
  /** Which functions are enabled and their config */
  functions: Record<string, {
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
  /** Ordered rules (evaluated by priority) */
  rules: MetaRuleRule[];
  /** Allow writers to override the rule-determined path at proposal time */
  allowOverride: boolean;
};

/** Result of rule evaluation */
export type RuleEvaluationResult = {
  /** The rule that matched */
  matchedRule: MetaRuleRule;
  /** The coordination path to use */
  pathId: string;
  /** Merged path config (path defaults + rule overrides) */
  pathConfig: Record<string, unknown>;
};

// ─── Engine ───

/**
 * Evaluate rules against capability results.
 * Returns the first matching rule (by priority), or null if no rules match.
 *
 * Rules are sorted by priority (ascending — lower number = higher priority).
 * First match wins.
 */
export function evaluateRules(
  rules: MetaRuleRule[],
  results: Map<string, FunctionResult>
): RuleEvaluationResult | null {
  // Sort by priority (ascending)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const capResult = results.get(rule.when.functionId);
    if (!capResult) continue;

    const fieldValue = resolveFieldPath(capResult.data, rule.when.field);
    const matches = evaluateCondition(fieldValue, rule.when.operator, rule.when.value);

    if (matches) {
      return {
        matchedRule: rule,
        pathId: rule.then.pathId,
        pathConfig: { ...rule.then.pathConfig },
      };
    }
  }

  return null;
}

/**
 * Resolve a dot-path into a nested object.
 * Supports: "maxLevel", "alignedIntents.length", "sectionImpacts.0.impactLevel"
 */
function resolveFieldPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current == null) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluate a single condition against a field value.
 */
function evaluateCondition(
  fieldValue: unknown,
  operator: MetaRuleRule['when']['operator'],
  compareValue?: unknown
): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === compareValue;

    case 'not-equals':
      return fieldValue !== compareValue;

    case 'gt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        && fieldValue > compareValue;

    case 'lt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        && fieldValue < compareValue;

    case 'gte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        && fieldValue >= compareValue;

    case 'lte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        && fieldValue <= compareValue;

    case 'is-empty':
      if (fieldValue == null) return true;
      if (Array.isArray(fieldValue)) return fieldValue.length === 0;
      if (typeof fieldValue === 'string') return fieldValue.length === 0;
      return false;

    case 'is-not-empty':
      if (fieldValue == null) return false;
      if (Array.isArray(fieldValue)) return fieldValue.length > 0;
      if (typeof fieldValue === 'string') return fieldValue.length > 0;
      return true;

    default:
      return false;
  }
}

// ─── Defaults ───

/** Create an empty MetaRuleV2 config */
export function createDefaultMetaRuleV2(): MetaRuleV2 {
  return {
    version: 2,
    functions: {},
    rules: [],
    allowOverride: true,
  };
}

/** Create a new rule with sensible defaults */
export function createRule(partial?: Partial<MetaRuleRule>): MetaRuleRule {
  return {
    id: crypto.randomUUID(),
    name: partial?.name ?? 'New Rule',
    priority: partial?.priority ?? 100,
    when: partial?.when ?? {
      functionId: '',
      field: '',
      operator: 'equals',
      value: undefined,
    },
    then: partial?.then ?? {
      pathId: '',
      pathConfig: {},
    },
  };
}
