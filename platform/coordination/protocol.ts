// ─── Negotiate Protocol ───
//
// A negotiate protocol structures how a team processes a proposed change.
// Three stages: propose → deliberate → resolve.
// Each stage has the same structure: who acts, what steps run, what actions are available.
//
// All "doing" is in Functions. The protocol only orchestrates.
// Actions don't have effects — they have steps (which call functions).

import type { ProtocolStep, ProtocolAction } from '@/platform/protocol-types';

// Re-export for convenience
export type { ProtocolStep, ProtocolAction };

// ─── Stage ───

export type NegotiateStage = {
  /** Who acts in this stage (supports {{config.xxx}} templates) */
  who: string;
  /** Steps to execute — run functions, show stored results */
  steps: ProtocolStep[];
  /** Actions available to participants in this stage */
  actions?: ProtocolAction[];
};

// ─── Protocol Definition ───

export type CoordinationPathDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;

  /** Propose stage: proposer presents the change */
  propose: NegotiateStage;
  /** Deliberate stage: participants review and act */
  deliberate: NegotiateStage;
  /** Resolve stage: determine outcome and apply */
  resolve: NegotiateStage;

  /** Config fields declared by developer, filled by team.
   *  Referenced in stages via {{config.xxx}} templates. */
  config?: Record<string, {
    default?: unknown;
    options?: Array<string | { value: string; label: string }>;
    type?: string;
    label?: string;
  }>;

  /** Function IDs referenced by this protocol (for dependency tracking) */
  functions?: string[];
};

// ─── Registry ───

const _pathRegistry = new Map<string, CoordinationPathDefinition>();

export function registerCoordinationPath(definition: CoordinationPathDefinition): void {
  _pathRegistry.set(definition.id, definition);
}

export function getCoordinationPath(id: string): CoordinationPathDefinition | undefined {
  return _pathRegistry.get(id);
}

export function getAllCoordinationPaths(): CoordinationPathDefinition[] {
  return Array.from(_pathRegistry.values());
}

// ─── Aliases (new naming) ───

export type NegotiateProtocolDefinition = CoordinationPathDefinition;
export const registerNegotiateProtocol = registerCoordinationPath;
export const getNegotiateProtocol = getCoordinationPath;
export const getAllNegotiateProtocols = getAllCoordinationPaths;
