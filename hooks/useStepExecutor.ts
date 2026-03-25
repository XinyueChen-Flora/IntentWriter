"use client";

import { useState, useCallback, useRef } from "react";
import type { ProtocolStep, ProtocolAction } from "@/platform/protocol-types";
import { runFunction } from "@/platform/functions/runner";
import { getFunction } from "@/platform/functions/protocol";
import {
  resolveBindings,
  groupByLocation,
  type ResolvedPrimitive,
} from "@/platform/primitives/resolver";
import { getResult as getStoredResult } from "@/platform/interaction-store";
import type { DocumentSnapshot } from "@/platform/data-model";
import type { FunctionResult, MutationExecutor, BlockMutation } from "@/platform/functions/protocol";

// ═══════════════════════════════════════════════════════
// SHARED STEP EXECUTOR
// ═══════════════════════════════════════════════════════
//
// Core loop shared by Sense and Negotiate runners:
// 1. Walk steps in order
// 2. For each step:
//    - run: call function → render via display bindings → store result
//    - show: read stored result → render via display bindings
//    - actions: render buttons, pause for user choice
//    - when: evaluate condition, skip if false
// 3. User clicks action → continue / goto / stop / gate / sub-steps

export type StepState = {
  /** Current step index in the sequence */
  currentIndex: number;
  /** Which steps have completed (index → rendered primitives) */
  completed: Map<number, ResolvedPrimitive[]>;
  /** Currently running function (if any) */
  running: string | null;
  /** Waiting for user action at this step index */
  waitingAt: number | null;
  /** Protocol finished (stop or gate exit) */
  finished: boolean;
  /** Exited to gate */
  exitedToGate: boolean;
  /** Error */
  error: string | null;
};

export type StepExecutorProps = {
  steps: ProtocolStep[];
  snapshot: DocumentSnapshot | null;
  sectionId?: string;
  config?: Record<string, unknown>;
  /** Called when a function produces a result (for storing / cross-section dispatch) */
  onFunctionResult?: (functionId: string, result: FunctionResult) => void;
  /** Called when protocol exits to Gate */
  onGateExit?: () => void;
  /** Called when step requests dispatch (e.g. cross-section impacts) */
  onDispatch?: (dispatch: import("@/platform/protocol-types").StepDispatch, result: FunctionResult) => void;
  /** Callbacks for executing mutations returned by functions */
  mutationExecutor?: MutationExecutor;
};

export type StepExecutorResult = {
  /** Current state */
  state: StepState;
  /** All primitives rendered so far (in order) */
  allPrimitives: ResolvedPrimitive[];
  /** Current actions waiting for user (if any) */
  currentActions: ProtocolAction[] | null;
  /** Execute next step / resume after action */
  executeNext: () => Promise<void>;
  /** Handle user clicking an action */
  handleAction: (action: ProtocolAction) => Promise<void>;
  /** Reset to beginning */
  reset: () => void;
  /** Start execution from the beginning */
  start: () => Promise<void>;
};

// ─── Mutation Executor ───
// Applies mutations returned by functions to the outline.
// The runtime provides the actual ctx callbacks; the function only declares what to change.

function executeMutations(mutations: BlockMutation[], executor: MutationExecutor) {
  for (const m of mutations) {
    switch (m.type) {
      case 'update-block':
        executor.updateBlockRaw(m.blockId, m.updates);
        break;
      case 'update-content':
        executor.updateBlock(m.blockId, m.content);
        break;
      case 'add-block': {
        const newBlock = executor.addBlock({ asChildOf: m.parentId });
        executor.updateBlock(newBlock.id, m.content);
        if (m.updates) executor.updateBlockRaw(newBlock.id, m.updates);
        break;
      }
      case 'delete-block':
        executor.deleteBlock(m.blockId);
        break;
    }
  }
}

const INITIAL_STATE: StepState = {
  currentIndex: 0,
  completed: new Map(),
  running: null,
  waitingAt: null,
  finished: false,
  exitedToGate: false,
  error: null,
};

export function useStepExecutor({
  steps,
  snapshot,
  sectionId,
  config = {},
  onFunctionResult,
  onGateExit,
  onDispatch,
  mutationExecutor,
}: StepExecutorProps): StepExecutorResult {
  const [state, setState] = useState<StepState>({ ...INITIAL_STATE });
  const stateRef = useRef(state);
  stateRef.current = state;

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const configRef = useRef(config);
  configRef.current = config;
  const onFnResultRef = useRef(onFunctionResult);
  onFnResultRef.current = onFunctionResult;
  const onGateExitRef = useRef(onGateExit);
  onGateExitRef.current = onGateExit;
  const onDispatchRef = useRef(onDispatch);
  onDispatchRef.current = onDispatch;
  const mutationExecRef = useRef(mutationExecutor);
  mutationExecRef.current = mutationExecutor;

  // Store function results locally for condition evaluation
  const resultsRef = useRef<Record<string, Record<string, unknown>>>({});

  // Reset when steps change (e.g., branching to a different starting point)
  const stepsKey = steps.map(s => s.id || s.run || s.show || 'action').join(',');
  const prevStepsKeyRef = useRef(stepsKey);
  if (prevStepsKeyRef.current !== stepsKey) {
    prevStepsKeyRef.current = stepsKey;
    setState({ ...INITIAL_STATE });
    resultsRef.current = {};
  }

  // ── Resolve {{config.xxx}} templates in params ──
  const resolveParams = useCallback((params?: Record<string, string>): Record<string, string> => {
    if (!params) return {};
    const resolved: Record<string, string> = {};
    for (const [key, val] of Object.entries(params)) {
      resolved[key] = val.replace(/\{\{config\.(\w+)\}\}/g, (_, k) => {
        const v = configRef.current[k];
        return v != null ? String(v) : '';
      });
    }
    return resolved;
  }, []);

  // ── Evaluate when conditions ──
  const evaluateCondition = useCallback((when?: string): boolean => {
    if (!when) return true;
    try {
      // Simple condition evaluation: "functionId.field != value" or "functionId.field == value"
      const match = when.match(/^(\w[\w-]*)\.(\w+)\s*(!=|==|>=|<=|>|<)\s*"?([^"]*)"?$/);
      if (!match) return true;
      const [, fnId, field, op, expected] = match;
      const fnResult = resultsRef.current[fnId];
      if (!fnResult) return false;
      const actual = fnResult[field];
      switch (op) {
        case '!=': return actual !== expected;
        case '==': return actual === expected;
        case '>=': return Number(actual) >= Number(expected);
        case '<=': return Number(actual) <= Number(expected);
        case '>': return Number(actual) > Number(expected);
        case '<': return Number(actual) < Number(expected);
        default: return true;
      }
    } catch {
      return true;
    }
  }, []);

  // ── Find step by ID (for goto) ──
  const findStepIndex = useCallback((id: string): number => {
    return steps.findIndex(s => s.id === id);
  }, [steps]);

  // ── Execute a single step ──
  const executeStep = useCallback(async (index: number): Promise<void> => {
    if (index >= steps.length) {
      setState(prev => ({ ...prev, finished: true }));
      return;
    }

    const step = steps[index];

    // Check condition
    if (!evaluateCondition(step.when)) {
      // Skip to next
      setState(prev => ({ ...prev, currentIndex: index + 1 }));
      // Auto-continue to next
      setTimeout(() => executeStep(index + 1), 0);
      return;
    }

    // Handle run
    if (step.run) {
      const fnId = step.run.replace(/\{\{config\.(\w+)\}\}/g, (_, k) => {
        const v = configRef.current[k];
        return v != null ? String(v) : '';
      });

      setState(prev => ({ ...prev, currentIndex: index, running: fnId }));

      try {
        const params = resolveParams(step.params);
        const result = await runFunction(fnId, {
          snapshot: snapshotRef.current!,
          focus: { sectionId: sectionId || 'document', extra: { ...configRef.current, ...params } },
          config: configRef.current,
        });

        // Store result for condition evaluation
        if (result.data && typeof result.data === 'object') {
          resultsRef.current[fnId] = result.data as Record<string, unknown>;
        }

        // Resolve display bindings
        const funcDef = getFunction(fnId);
        // Prefer dynamic UI from function result; fall back to static definition UI
        const bindings = (result.ui && result.ui.length > 0) ? result.ui : (funcDef?.ui || []);
        const allPrimitives = resolveBindings(bindings, result.data);

        // Notify parent with full result (pipeline handles location-based rendering)
        onFnResultRef.current?.(fnId, result);

        // Execute mutations if the function returned any
        if (result.mutations && result.mutations.length > 0 && mutationExecRef.current) {
          executeMutations(result.mutations, mutationExecRef.current);
        }

        // Dispatch outputs if requested
        if (step.dispatch) {
          onDispatchRef.current?.(step.dispatch, result);
        }

        // Store all primitives for local rendering (SenseRunner decides what to show)
        setState(prev => {
          const completed = new Map(prev.completed);
          completed.set(index, allPrimitives);
          return { ...prev, completed, running: null, currentIndex: index };
        });
      } catch (err) {
        setState(prev => ({
          ...prev,
          running: null,
          error: err instanceof Error ? err.message : String(err),
        }));
        return;
      }
    }

    // Handle show (stored result)
    if (step.show) {
      const stored = getStoredResult(step.show, sectionId || 'document');
      if (stored) {
        const funcDef = getFunction(step.show);
        const bindings = funcDef?.ui || [];
        const primitives = resolveBindings(bindings, stored.output);
        setState(prev => {
          const completed = new Map(prev.completed);
          completed.set(index, primitives);
          return { ...prev, completed, currentIndex: index };
        });
      }
    }

    // Handle actions on THIS step (pause for user)
    if (step.actions && step.actions.length > 0) {
      setState(prev => ({ ...prev, waitingAt: index }));
      return; // Pause — user must click an action
    }

    // Check if NEXT step is an actions-only step (no run/show) — if so, pause there
    const nextStep = index + 1 < steps.length ? steps[index + 1] : null;
    if (nextStep && !nextStep.run && !nextStep.show && nextStep.actions && nextStep.actions.length > 0) {
      // Next step is actions-only — advance to it and pause
      setState(prev => ({ ...prev, currentIndex: index + 1, waitingAt: index + 1 }));
      return;
    }

    // No actions here or next → auto-continue
    if (!step.actions) {
      setTimeout(() => executeStep(index + 1), 0);
    }
  }, [steps, sectionId, evaluateCondition, resolveParams, findStepIndex]);

  // ── Handle user action ──
  const handleAction = useCallback(async (action: ProtocolAction) => {
    setState(prev => ({ ...prev, waitingAt: null }));

    if (action.stop) {
      setState(prev => ({ ...prev, finished: true }));
      return;
    }

    if (action.gate) {
      setState(prev => ({ ...prev, finished: true, exitedToGate: true }));
      onGateExitRef.current?.();
      return;
    }

    if (action.goto) {
      const targetIndex = findStepIndex(action.goto);
      if (targetIndex >= 0) {
        setState(prev => ({ ...prev, currentIndex: targetIndex }));
        await executeStep(targetIndex);
        return;
      }
    }

    if (action.steps && action.steps.length > 0) {
      // Execute sub-steps inline (simplified — run them sequentially)
      for (const subStep of action.steps) {
        if (subStep.run && snapshotRef.current) {
          const fnId = subStep.run;
          setState(prev => ({ ...prev, running: fnId }));
          try {
            const result = await runFunction(fnId, {
              snapshot: snapshotRef.current!,
              focus: { sectionId: sectionId || 'document' },
              config: configRef.current,
            });
            if (result.data && typeof result.data === 'object') {
              resultsRef.current[fnId] = result.data as Record<string, unknown>;
            }
            onFnResultRef.current?.(fnId, result);
          } catch (err) {
            console.error(`Sub-step ${fnId} failed:`, err);
          }
          setState(prev => ({ ...prev, running: null }));
        }
      }
    }

    if (action.continue) {
      const nextIndex = stateRef.current.currentIndex + 1;
      await executeStep(nextIndex);
      return;
    }

    // Default: continue to next step
    const nextIndex = stateRef.current.currentIndex + 1;
    await executeStep(nextIndex);
  }, [executeStep, findStepIndex, sectionId]);

  // ── Start execution ──
  const start = useCallback(async () => {
    setState({ ...INITIAL_STATE });
    resultsRef.current = {};
    await executeStep(0);
  }, [executeStep]);

  // ── Reset ──
  const reset = useCallback(() => {
    setState({ ...INITIAL_STATE });
    resultsRef.current = {};
  }, []);

  // ── Compute all primitives in order ──
  const allPrimitives: ResolvedPrimitive[] = [];
  const sortedEntries = Array.from(state.completed.entries()).sort(([a], [b]) => a - b);
  for (const [, prims] of sortedEntries) {
    allPrimitives.push(...prims);
  }

  // Current actions
  const currentActions = state.waitingAt != null ? (steps[state.waitingAt]?.actions ?? null) : null;

  return {
    state,
    allPrimitives,
    currentActions,
    executeNext: () => executeStep(state.currentIndex + 1),
    handleAction,
    reset,
    start,
  };
}
