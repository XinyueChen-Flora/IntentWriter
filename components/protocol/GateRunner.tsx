"use client";

import { useEffect, useRef, useMemo } from "react";
import { useStepExecutor } from "@/hooks/useStepExecutor";
import type { ProtocolAction } from "@/platform/protocol-types";
import type { GateDefinition } from "@/platform/gate/protocol";
import type { DocumentSnapshot } from "@/platform/data-model";
import type { FunctionResult } from "@/platform/functions/protocol";

// ═══════════════════════════════════════════════════════
// GATE RUNNER — Sits between Sense and Negotiate
// ═══════════════════════════════════════════════════════
//
// Headless. Executes gate steps (evaluate-gate, render-route-choices).
// When a step's action has gate: true, the runner resolves the route
// from the evaluate-gate result and calls onRouteDecided.
//
// For automatic gates: evaluate-gate runs → route determined → user confirms → exit.
// For manual gates: render-route-choices runs → user picks → confirms → exit.

export type GateRunnerProps = {
  gate: GateDefinition;
  snapshot: DocumentSnapshot | null;
  sectionId?: string;
  /** Pipeline config (includes team gate rules) */
  config?: Record<string, unknown>;
  /** Called when gate determines a route → NegotiateRunner should start */
  onRouteDecided: (route: string) => void;
  /** Called when gate is dismissed */
  onDismiss?: () => void;
  /** Exposes actions for parent to render */
  onActionsChanged?: (actions: ProtocolAction[] | null) => void;
  /** Running state */
  onRunningChanged?: (running: string | null) => void;
  /** Function results (for pipeline injection) */
  onFunctionResult?: (functionId: string, result: FunctionResult) => void;
  /** Exposes handleAction so parent can trigger actions */
  onExecutorReady?: (executor: { handleAction: (action: ProtocolAction) => Promise<void> }) => void;
};

export function GateRunner({
  gate,
  snapshot,
  sectionId,
  config = {},
  onRouteDecided,
  onDismiss,
  onActionsChanged,
  onRunningChanged,
  onFunctionResult,
  onExecutorReady,
}: GateRunnerProps) {
  // Track the resolved route from evaluate-gate or route selection
  const routeRef = useRef<string>(gate.defaultRoute);

  // Merge gate metadata into config so evaluate-gate can access it
  const gateConfig = useMemo(() => ({
    ...config,
    _gateId: gate.id,
    _gateRules: config._gateRules,
  }), [config, gate.id]);

  const executor = useStepExecutor({
    steps: gate.steps,
    snapshot,
    sectionId,
    config: gateConfig,
    onFunctionResult: (fnId, result) => {
      onFunctionResult?.(fnId, result);
      // Capture route from evaluate-gate result
      if (fnId === 'evaluate-gate' && result.data) {
        const route = (result.data as Record<string, unknown>).route as string;
        if (route) routeRef.current = route;
      }
      // Capture route from render-route-choices if user selected one
      if (fnId === 'render-route-choices' && result.data) {
        const route = (result.data as Record<string, unknown>).route as string;
        if (route && route !== 'pending') routeRef.current = route;
      }
    },
    onGateExit: () => {
      // gate: true action fired → exit to negotiate with resolved route
      onRouteDecided(routeRef.current);
    },
  });

  // Expose handleAction to parent
  useEffect(() => {
    onExecutorReady?.({ handleAction: executor.handleAction });
  }, [executor.handleAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasStartedRef = useRef(false);
  const prevActionsRef = useRef<ProtocolAction[] | null>(null);
  const prevRunningRef = useRef<string | null>(null);

  // Auto-start on mount
  useEffect(() => {
    if (!snapshot || hasStartedRef.current) return;
    hasStartedRef.current = true;
    executor.start();
  }, [snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of state changes
  useEffect(() => {
    if (executor.currentActions !== prevActionsRef.current) {
      prevActionsRef.current = executor.currentActions;
      onActionsChanged?.(executor.currentActions);
    }
  }, [executor.currentActions, onActionsChanged]);

  useEffect(() => {
    if (executor.state.running !== prevRunningRef.current) {
      prevRunningRef.current = executor.state.running;
      onRunningChanged?.(executor.state.running);
    }
  }, [executor.state.running, onRunningChanged]);

  useEffect(() => {
    if (executor.state.finished && !executor.state.exitedToGate) {
      onDismiss?.();
    }
  }, [executor.state.finished, executor.state.exitedToGate, onDismiss]);

  // Headless
  return null;
}
