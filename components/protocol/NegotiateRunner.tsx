"use client";

import React, { useMemo } from "react";
import { useStepExecutor } from "@/hooks/useStepExecutor";
import { PrimitiveRenderer } from "@/components/capability/PrimitiveRenderer";
import type { ProtocolAction } from "@/platform/protocol-types";
import type { CoordinationPathDefinition, NegotiateStage } from "@/platform/coordination/protocol";
import type { DocumentSnapshot } from "@/platform/data-model";
import type { FunctionResult, MutationExecutor } from "@/platform/functions/protocol";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";

// ═══════════════════════════════════════════════════════
// NEGOTIATE RUNNER
// ═══════════════════════════════════════════════════════
//
// Wraps useStepExecutor with:
// - Role-based stage routing (proposer sees propose, voter sees deliberate)
// - Proposal state management
// - Action sub-steps
// - Cross-user context

export type NegotiateRunnerProps = {
  protocol: CoordinationPathDefinition;
  /** Which stage the current user is in */
  stage: 'propose' | 'deliberate' | 'resolve';
  /** Current user's role */
  userRole: string;
  snapshot: DocumentSnapshot | null;
  sectionId?: string;
  config?: Record<string, unknown>;
  onFunctionResult?: (functionId: string, result: FunctionResult) => void;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
  /** Called when an action is submitted (approve, reject, etc.) */
  onActionSubmit?: (actionId: string, data?: Record<string, unknown>) => void;
  /** Callbacks for executing mutations returned by functions */
  mutationExecutor?: MutationExecutor;
};

export function NegotiateRunner({
  protocol,
  stage,
  userRole,
  snapshot,
  sectionId,
  config = {},
  onFunctionResult,
  onAction,
  onActionSubmit,
  mutationExecutor,
}: NegotiateRunnerProps) {
  // Get the current stage definition
  const stageDef: NegotiateStage = protocol[stage];

  // Filter actions by role
  const visibleActions = useMemo(() => {
    if (!stageDef.actions) return [];
    return stageDef.actions.filter(action => {
      if (!action.who || action.who.length === 0) return true;
      return action.who.includes(userRole);
    });
  }, [stageDef.actions, userRole]);

  // Resolve {{config.xxx}} in who field to check if current user should see this stage
  const resolvedWho = stageDef.who.replace(/\{\{config\.(\w+)\}\}/g, (_, k) => {
    const v = config[k];
    return v != null ? String(v) : '';
  });

  const executor = useStepExecutor({
    steps: stageDef.steps,
    snapshot,
    sectionId,
    config,
    onFunctionResult,
    mutationExecutor,
  });

  // Auto-start when stage changes
  const hasStartedRef = React.useRef(false);
  const prevStageRef = React.useRef(stage);
  if (prevStageRef.current !== stage) {
    prevStageRef.current = stage;
    hasStartedRef.current = false;
    executor.reset();
  }
  React.useEffect(() => {
    if (snapshot && stageDef.steps.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      executor.start();
    }
  }, [snapshot, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle action click ──
  const handleActionClick = async (action: ProtocolAction) => {
    // If action has sub-steps, execute them first
    if (action.steps && action.steps.length > 0) {
      await executor.handleAction(action);
    }

    // Notify parent of the action
    if (action.id) {
      onActionSubmit?.(action.id);
    }
  };

  return (
    <div className="negotiate-runner space-y-3">
      {/* Stage header */}
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {stage} · {resolvedWho}
      </div>

      {/* Rendered function outputs */}
      {executor.allPrimitives.length > 0 && (
        <PrimitiveRenderer
          primitives={executor.allPrimitives}
          onAction={(action, prim) => onAction?.(action, prim)}
        />
      )}

      {/* Loading */}
      {executor.state.running && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
          <div className="h-3.5 w-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          Running {executor.state.running}...
        </div>
      )}

      {/* Step-level actions (from the step sequence) */}
      {executor.currentActions && (
        <div className="flex gap-2 flex-wrap">
          {executor.currentActions.map((action, i) => (
            <button
              key={action.id || action.label || i}
              onClick={() => executor.handleAction(action)}
              className="px-3 py-1.5 text-sm rounded-md border bg-background border-border hover:bg-accent transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Stage-level actions (approve, reject, etc.) — only shown when steps are done */}
      {!executor.state.running && !executor.currentActions && visibleActions.length > 0 && (
        <div className="flex gap-2 flex-wrap pt-2 border-t">
          {visibleActions.map((action, i) => (
            <button
              key={action.id || action.label || i}
              onClick={() => handleActionClick(action)}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                action.id === 'approve' || action.id === 'close-approve' || action.id === 'apply'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : action.id === 'reject' || action.id === 'close-reject' || action.id === 'revert'
                  ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  : 'bg-background border border-border hover:bg-accent'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {executor.state.error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
          Error: {executor.state.error}
        </div>
      )}
    </div>
  );
}
