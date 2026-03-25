"use client";

import React, { useEffect, useRef } from "react";
import { useStepExecutor } from "@/hooks/useStepExecutor";
import type { ProtocolAction } from "@/platform/protocol-types";
import type { SenseProtocolDefinition } from "@/platform/sense/protocol";
import type { DocumentSnapshot } from "@/platform/data-model";
import type { FunctionResult } from "@/platform/functions/protocol";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";
import type { StepDispatch } from "@/platform/protocol-types";

// ═══════════════════════════════════════════════════════
// SENSE RUNNER — Pure Execution Engine
// ═══════════════════════════════════════════════════════
//
// Does NOT render anything itself. Only:
// 1. Executes steps (via useStepExecutor)
// 2. Reports function results to parent (for pipeline rendering)
// 3. Reports current actions to parent (for rendering in right panel)
// 4. Handles branching (goto) and gate exit
//
// All rendering is done by the pipeline's location-based system.

export type SenseRunnerProps = {
  protocol: SenseProtocolDefinition;
  snapshot: DocumentSnapshot | null;
  sectionId?: string;
  trigger: string;
  config?: Record<string, unknown>;
  startAtStep?: string;
  onGateExit?: () => void;
  onFunctionResult?: (functionId: string, result: FunctionResult) => void;
  /** Called when the executor has actions waiting for user input */
  onActionsChanged?: (actions: ProtocolAction[] | null) => void;
  /** Called when running state changes */
  onRunningChanged?: (running: string | null) => void;
  /** Called when execution finishes */
  onFinished?: () => void;
  /** Exposes the executor's handleAction so parent can trigger actions */
  onExecutorReady?: (executor: { handleAction: (action: ProtocolAction) => Promise<void> }) => void;
  /** Dispatch callback for step-level dispatch declarations */
  onDispatch?: (dispatch: StepDispatch, result: FunctionResult) => void;
};

export function SenseRunner({
  protocol,
  snapshot,
  sectionId,
  trigger,
  config = {},
  startAtStep,
  onGateExit,
  onFunctionResult,
  onActionsChanged,
  onRunningChanged,
  onFinished,
  onExecutorReady,
  onDispatch,
}: SenseRunnerProps) {
  const startIndex = startAtStep
    ? protocol.steps.findIndex(s => s.id === startAtStep)
    : 0;
  const effectiveSteps = startIndex > 0 ? protocol.steps.slice(startIndex) : protocol.steps;

  const executor = useStepExecutor({
    steps: effectiveSteps,
    snapshot,
    sectionId,
    config,
    onFunctionResult,
    onGateExit,
    onDispatch,
  });

  // Expose handleAction to parent
  useEffect(() => {
    onExecutorReady?.({ handleAction: executor.handleAction });
  }, [executor.handleAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const prevStartAtRef = useRef(startAtStep);
  const prevActionsRef = useRef<ProtocolAction[] | null>(null);
  const prevRunningRef = useRef<string | null>(null);

  // Reset when startAtStep changes (user picked a different branch)
  if (prevStartAtRef.current !== startAtStep) {
    prevStartAtRef.current = startAtStep;
    hasStartedRef.current = false;
    executor.reset();
  }

  // ── Auto-start ──
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!snapshot) return;

    if (!hasStartedRef.current && (startAtStep || trigger === 'manual')) {
      hasStartedRef.current = true;
      executor.start();
      return;
    }

    if (trigger === 'interval') {
      const triggerDef = protocol.triggerOptions.find(t => t.value === 'interval');
      const minutes = (triggerDef?.config?.intervalMinutes as number) ?? 5;
      intervalRef.current = setInterval(() => {
        executor.reset();
        executor.start();
      }, minutes * 60 * 1000);
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        executor.start();
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [trigger, snapshot, protocol.triggerOptions, startAtStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify parent of state changes ──
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
    if (executor.state.finished) {
      onFinished?.();
    }
  }, [executor.state.finished, onFinished]);

  // ── Expose handleAction for parent to call ──
  // Store in ref so parent can access
  const handleActionRef = useRef(executor.handleAction);
  handleActionRef.current = executor.handleAction;

  // Render nothing — this is a headless component
  return null;
}

// ── Wrapper that exposes handleAction imperatively ──
export type SenseRunnerHandle = {
  handleAction: (action: ProtocolAction) => Promise<void>;
};

export const SenseRunnerWithRef = React.forwardRef<SenseRunnerHandle, SenseRunnerProps>(
  function SenseRunnerWithRef(props, ref) {
    const startIndex = props.startAtStep
      ? props.protocol.steps.findIndex(s => s.id === props.startAtStep)
      : 0;
    const effectiveSteps = startIndex > 0 ? props.protocol.steps.slice(startIndex) : props.protocol.steps;

    const executor = useStepExecutor({
      steps: effectiveSteps,
      snapshot: props.snapshot,
      sectionId: props.sectionId,
      config: props.config || {},
      onFunctionResult: props.onFunctionResult,
      onGateExit: props.onGateExit,
      onDispatch: props.onDispatch,
    });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasStartedRef = useRef(false);

    // Auto-start
    useEffect(() => {
      if (!props.snapshot) return;
      if (!hasStartedRef.current && (props.startAtStep || props.trigger === 'manual')) {
        hasStartedRef.current = true;
        executor.start();
      }
    }, [props.snapshot, props.startAtStep, props.trigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // Notify parent of state changes
    useEffect(() => {
      props.onActionsChanged?.(executor.currentActions);
    }, [executor.currentActions]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      props.onRunningChanged?.(executor.state.running);
    }, [executor.state.running]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (executor.state.finished) props.onFinished?.();
    }, [executor.state.finished]); // eslint-disable-line react-hooks/exhaustive-deps

    // Expose handleAction
    React.useImperativeHandle(ref, () => ({
      handleAction: executor.handleAction,
    }), [executor.handleAction]);

    return null;
  }
);
