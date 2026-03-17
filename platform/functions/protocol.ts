// ─── Function Protocol ───
//
// A function is a unit of analysis, checking, or transformation
// that runs against a document's current state (DocumentSnapshot).
//
// Each function declares:
//   1. What it needs from the snapshot (required fields)
//   2. What it outputs (schema)
//   3. What UI components it uses to display results
//   4. How to execute it (API endpoint or inline function)
//
// Register a new function:
//   import { registerFunction } from '@/platform/functions/protocol';
//   registerFunction({ id: 'my-function', ... });

import type { ConfigField } from '@/lib/pipeline-protocol';
import type { DocumentSnapshot } from '../data-model';
import type { UIBinding } from '../primitives/registry';


// ═══════════════════════════════════════════════════════
// FUNCTION INPUT — what a function receives
// ═══════════════════════════════════════════════════════
//
// Every function gets the full DocumentSnapshot.
// It also gets an optional "focus" — a specific target
// the function should analyze (e.g. a specific section,
// a proposed change, etc.)

/** Focus: a specific section or item the function targets */
export type FunctionFocus = {
  /** The section being analyzed */
  sectionId: string;
  /** Optional: specific item within the section */
  intentId?: string;
  /** Optional: proposed changes to evaluate */
  proposedChanges?: ProposedChange[];
  /** Optional: extra context (comment text, coverage info, etc.) */
  extra?: Record<string, unknown>;
};

/** A proposed change to an outline item */
export type ProposedChange = {
  id: string;
  content: string;
  status: 'new' | 'modified' | 'removed';
  previousContent?: string;
  reason?: string;
};

/** What a function receives: full snapshot + optional focus */
export type FunctionInput = {
  snapshot: DocumentSnapshot;
  focus?: FunctionFocus;
  config: Record<string, unknown>;
};


// UI bindings are defined in platform/primitives/registry.ts
// Re-export for convenience
export type { UIBinding } from '../primitives/registry';


// ═══════════════════════════════════════════════════════
// FUNCTION DEFINITION
// ═══════════════════════════════════════════════════════

export type FunctionDefinition = {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** Lucide icon name */
  icon: string;
  /** When this function runs */
  trigger: 'detection' | 'proposal' | 'on-demand';

  // ─── Data contract ───
  /** Which snapshot fields this function requires */
  requires: {
    writing?: boolean;      // needs writing content
    dependencies?: boolean; // needs dependency graph
    members?: boolean;      // needs team info
  };

  /** Describes the shape of the result object */
  outputSchema: Record<string, string>;

  // ─── UI contract ───
  ui: UIBinding[];

  // ─── Configuration ───
  configFields: ConfigField[];
  defaultConfig: Record<string, unknown>;

  // ─── Execution ───
  executor: 'api' | 'local' | 'prompt';
  /** For 'api' executor: the endpoint to call */
  endpoint?: string;
  /** For 'local' executor: inline implementation.
   *  Can return just { data: {...} } — the runner fills in functionId, ui, computedAt. */
  fn?: (input: FunctionInput) => Promise<FunctionResult | { data: Record<string, unknown> }> | FunctionResult | { data: Record<string, unknown> };
  /**
   * For 'prompt' executor: define the AI prompt.
   * The platform calls the AI, parses the response against outputSchema,
   * and returns the result. Developer only writes the prompt.
   */
  prompt?: {
    /** System instruction for the AI */
    system: string;
    /**
     * User message template. Use {{snapshot.field}} to reference data.
     * Available: {{nodes}}, {{writing}}, {{dependencies}}, {{assignments}},
     * {{members}}, {{focus}}, {{config}}.
     * Arrays are formatted as readable text automatically.
     */
    user: string;
    /** Optional: model to use (default: gpt-4o) */
    model?: string;
    /** Optional: temperature (default: 0.3) */
    temperature?: number;
  };
};


// ═══════════════════════════════════════════════════════
// FUNCTION RESULT
// ═══════════════════════════════════════════════════════

export type FunctionResult = {
  functionId: string;
  data: Record<string, unknown>;
  ui: UIBinding[];
  computedAt: number;
};


// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const _functionRegistry = new Map<string, FunctionDefinition>();

export function registerFunction(definition: FunctionDefinition): void {
  _functionRegistry.set(definition.id, definition);
}

export function getFunction(id: string): FunctionDefinition | undefined {
  return _functionRegistry.get(id);
}

export function getAllFunctions(): FunctionDefinition[] {
  return Array.from(_functionRegistry.values());
}

export function getFunctionsByTrigger(
  trigger: FunctionDefinition['trigger']
): FunctionDefinition[] {
  return getAllFunctions().filter((f) => f.trigger === trigger);
}
