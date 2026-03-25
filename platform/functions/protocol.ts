// ─── Function Protocol ───
//
// A function is an atomic computational capability.
// It takes the data model as input and produces structured output
// with rendering declarations (display bindings).
//
// Functions are the shared base layer — both Awareness Protocols and
// Coordination Protocols reference functions but do not own them.
// A function does not know which protocol invokes it or when.
//
// Register a new function:
//   import { registerFunction } from '@/platform/functions/protocol';
//   registerFunction({ id: 'my-function', ... });

import type { ConfigField } from '@/lib/pipeline-protocol';
import type { DocumentSnapshot } from '../data-model';
import type { UIBinding } from '../primitives/registry';


// ═══════════════════════════════════════════════════════
// FUNCTION INPUT
// ═══════════════════════════════════════════════════════

/** Focus: a specific section or item the function targets */
export type FunctionFocus = {
  sectionId: string;
  intentId?: string;
  proposedChanges?: ProposedChange[];
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

  // ─── Execution ───
  /** How to execute: 'prompt' (AI), 'local' (JS function), 'api' (HTTP endpoint) */
  executor: 'api' | 'local' | 'prompt';

  /** For 'api' executor: the endpoint to call */
  endpoint?: string;
  /** For 'local' executor: inline implementation */
  fn?: (input: FunctionInput) => Promise<FunctionResult | { data: Record<string, unknown> }> | FunctionResult | { data: Record<string, unknown> };
  /** For 'prompt' executor: the AI prompt template */
  prompt?: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  };

  // ─── Data contract ───
  /** Which snapshot fields this function requires */
  requires: {
    writing?: boolean;
    dependencies?: boolean;
    members?: boolean;
  };
  /** Describes the shape of the result object */
  outputSchema: Record<string, string>;
  /** Structured output type definition */
  output?: { type: string; fields: Record<string, string> };

  // ─── Display contract ───
  /** How to render output — binds output fields to View Layer primitives */
  ui: UIBinding[];

  // ─── Configuration ───
  /** Config fields for function-level tuning (e.g., prompt focus) */
  configFields: ConfigField[];
  /** Default values for config fields */
  defaultConfig: Record<string, unknown>;

  // ─── Chaining ───
  /** IDs of functions whose stored results this function can read */
  dependsOn?: string[];

  // ─── Legacy fields (kept for backward compatibility with builtin registrations) ───
  /** @deprecated Use Awareness Protocol trigger options instead */
  trigger?: string;
  /** @deprecated Use Awareness Protocol instead */
  category?: string;
  /** @deprecated Use Awareness Protocol trigger options instead */
  triggerOptions?: Array<{ value: string; label: string; config?: Record<string, unknown> }>;
  /** @deprecated Use Awareness Protocol default trigger instead */
  defaultTrigger?: string;
  /** @deprecated Metadata only — not used by runtime */
  target?: { type: string; description?: string };
  /** @deprecated Use Awareness Protocol config fields instead */
  options?: Array<{ key: string; label: string; type: string; choices?: Array<{ value: string; label: string }>; default: unknown; description?: string }>;
  /** @deprecated Use ui instead */
  display?: UIBinding[];
};


// ═══════════════════════════════════════════════════════
// FUNCTION RESULT
// ═══════════════════════════════════════════════════════

// ─── Mutations ───
// Functions can return mutations to modify the outline.
// The runtime executes them — functions stay pure (declare what, not how).

export type BlockMutation =
  | { type: 'update-block'; blockId: string; updates: Record<string, unknown> }
  | { type: 'update-content'; blockId: string; content: string }
  | { type: 'add-block'; parentId: string; content: string; updates?: Record<string, unknown> }
  | { type: 'delete-block'; blockId: string };

/** Callbacks the runtime provides to execute mutations */
export type MutationExecutor = {
  updateBlockRaw: (blockId: string, updates: Record<string, unknown>) => void;
  updateBlock: (blockId: string, content: string) => void;
  addBlock: (options: { asChildOf: string }) => { id: string };
  deleteBlock: (blockId: string) => void;
};

export type FunctionResult = {
  functionId: string;
  data: Record<string, unknown>;
  ui: UIBinding[];
  /** Mutations to apply to the outline. Executed by the runtime, not the function. */
  mutations?: BlockMutation[];
  computedAt: number;
};


// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const _functionRegistry = new Map<string, FunctionDefinition>();

export function registerFunction(definition: FunctionDefinition): void {
  // Merge display bindings into ui if provided (legacy support)
  if (definition.display && definition.display.length > 0) {
    definition.ui = [...definition.ui, ...definition.display];
  }
  _functionRegistry.set(definition.id, definition);
}

export function getFunction(id: string): FunctionDefinition | undefined {
  return _functionRegistry.get(id);
}

export function getAllFunctions(): FunctionDefinition[] {
  return Array.from(_functionRegistry.values());
}
