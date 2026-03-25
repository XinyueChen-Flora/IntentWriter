// ─── Sense Protocol ───
//
// A sense protocol embeds functions into the writing process as a
// step-by-step sequence, initiated by a trigger.
//
// Steps run functions (which handle their own rendering via display bindings),
// show stored results, or present action buttons for user choices.
// Actions can branch (goto), continue, exit to Gate, or trigger sub-steps.

import type { ProtocolStep, ProtocolAction } from '@/platform/protocol-types';
import type { UIBinding } from '@/platform/primitives/registry';

// Re-export for convenience
export type { ProtocolStep, ProtocolAction };

// ─── Trigger Options ───

export type SenseTriggerOption = {
  value: string;
  label: string;
  description?: string;
  config?: Record<string, unknown>;
};

// ─── Config Field ───

export type SenseConfigField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'toggle' | 'number';
  description?: string;
  options?: Array<{ value: string; label: string }>;
  default: unknown;
  /** Only show this field when trigger matches these values */
  showWhenTrigger?: string[];
};

// ─── Sense Protocol Definition ───

export type SenseProtocolDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;

  /** Step sequence — the core of the protocol.
   *  Each step runs a function and/or shows actions.
   *  Actions can branch (goto), continue, exit to Gate, or stop. */
  steps: ProtocolStep[];

  /** Function IDs referenced by this protocol (for dependency tracking / config UI).
   *  Derived from steps, but declared explicitly for discoverability. */
  functions: string[];

  /** Available trigger modes */
  triggerOptions: SenseTriggerOption[];
  defaultTrigger: string;

  /** Config fields declared by developer, filled by team */
  configFields?: SenseConfigField[];
  defaultConfig?: Record<string, unknown>;

  /** Protocol-level UI (e.g., "Check Drift" button rendered in the writing panel) */
  ui?: UIBinding[];
};

// ─── Registry ───

const _senseRegistry = new Map<string, SenseProtocolDefinition>();

export function registerSenseProtocol(definition: SenseProtocolDefinition): void {
  _senseRegistry.set(definition.id, definition);
}

export function getSenseProtocol(id: string): SenseProtocolDefinition | undefined {
  return _senseRegistry.get(id);
}

export function getAllSenseProtocols(): SenseProtocolDefinition[] {
  return Array.from(_senseRegistry.values());
}
