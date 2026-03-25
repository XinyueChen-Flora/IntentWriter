// ─── Gate Protocol ───
//
// The Gate sits between Sense and Negotiate.
// Like Sense and Negotiate, it uses steps: ProtocolStep[].
//
// An automatic gate runs evaluate-gate → auto-routes.
// A manual gate runs render-route-choices → user picks.
// A hybrid gate runs evaluate-gate → shows result → user can override.
//
// Developer declares: steps to execute, conditions for team config,
//   which negotiate protocols can be routed to.
// Team configures: the actual routing rules (which conditions → which protocol).

import type { ProtocolStep } from '@/platform/protocol-types';

export interface GateConditionField {
  /** Path to the field in stored function output, e.g. 'assess-impact.maxSeverity' */
  field: string;
  /** Human-readable label for the condition */
  label: string;
  /** Available values (for select-type conditions) */
  options?: string[];
  /** For numeric conditions */
  type?: 'string' | 'number';
}

export interface GateRule {
  /** Conditions to match (all must be true). Keys are condition field paths, values are expected values. */
  when: Record<string, unknown>;
  /** Where to route: a negotiate protocol ID, or 'personal' */
  then: string;
  /** Human-readable description of this rule */
  description?: string;
}

export interface GateDefinition {
  id: string;
  name: string;
  description?: string;

  // ─── Step-based execution (same pattern as Sense/Negotiate) ───
  /** Steps to execute. Run functions (evaluate-gate, render-route-choices) and show UI.
   *  gate: true action exits to the negotiate protocol. */
  steps: ProtocolStep[];
  /** Function IDs referenced by this gate's steps */
  functions: string[];

  // ─── Configuration metadata (for GuidedSetup / team config) ───
  /** Which function outputs to read for condition evaluation */
  reads: string[];
  /** What condition fields are available for teams to build rules with */
  availableConditions: GateConditionField[];
  /** Which negotiate protocols this gate can route to */
  routes: string[];
  /** Default routing rules (team can modify) */
  defaultRules: GateRule[];
  /** Default route when no rule matches */
  defaultRoute: string;
}

// ─── Registry ───

const gateRegistry = new Map<string, GateDefinition>();

export function registerGate(definition: GateDefinition): void {
  gateRegistry.set(definition.id, definition);
}

export function getGate(id: string): GateDefinition | undefined {
  return gateRegistry.get(id);
}

export function getAllGates(): GateDefinition[] {
  return Array.from(gateRegistry.values());
}

// ─── Gate Evaluation ───

/**
 * Evaluate a gate against stored function results.
 * Uses teamRules if provided (team's custom configuration), otherwise falls back to defaultRules.
 */
export function evaluateGate(
  gate: GateDefinition,
  storedResults: Record<string, unknown>,
  teamRules?: GateRule[],
): { route: string; matchedRule?: GateRule } {
  const rules = teamRules ?? gate.defaultRules;
  for (const rule of rules) {
    if (evaluateConditions(rule.when, storedResults)) {
      return { route: rule.then, matchedRule: rule };
    }
  }
  return { route: gate.defaultRoute };
}

function evaluateConditions(
  conditions: Record<string, unknown>,
  results: Record<string, unknown>,
): boolean {
  for (const [path, expected] of Object.entries(conditions)) {
    const actual = getNestedValue(results, path);
    if (typeof expected === 'object' && expected !== null) {
      const op = expected as Record<string, unknown>;
      if ('gt' in op && typeof actual === 'number' && actual <= (op.gt as number)) return false;
      if ('gte' in op && typeof actual === 'number' && actual < (op.gte as number)) return false;
      if ('equals' in op && actual !== op.equals) return false;
      if ('not' in op && actual === op.not) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
