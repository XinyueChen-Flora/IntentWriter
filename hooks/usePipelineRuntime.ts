"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { runFunction } from "@/platform/functions/runner";
import {
  resolveBindings,
  groupByLocation,
  type ResolvedPrimitive,
} from "@/platform/primitives/resolver";
import type { PrimitiveLocation } from "@/platform/primitives/registry";
import type {
  FunctionResult,
  FunctionFocus,
} from "@/platform/functions/protocol";
import type { DocumentSnapshot } from "@/platform/data-model";
import {
  DEFAULT_METARULE_CONFIG,
  type EnabledSenseProtocol,
  type MetaRuleConfig,
  type PipelineConfig,
} from "@/lib/metarule-types";
import {
  getSenseProtocol,
  type SenseProtocolDefinition,
} from "@/platform/sense/protocol";
import {
} from "@/platform/gate/protocol";
import "@/platform/sense/builtin"; // ensure sense protocols are registered
import "@/platform/gate/builtin"; // ensure gates are registered
import "@/platform/functions/builtin"; // ensure functions are registered

export type EnabledAwarenessProtocol = EnabledSenseProtocol;

export type UsePipelineRuntimeProps = {
  snapshot: DocumentSnapshot | null;
  pipelineConfig: PipelineConfig;
  sectionId?: string;
};

export type UsePipelineRuntimeResult = {
  /** Primitives grouped by render location (all sections combined) */
  primitivesByLocation: Record<PrimitiveLocation, ResolvedPrimitive[]>;
  /** Primitives scoped to a specific section */
  getPrimitivesForSection: (sectionId: string) => Record<PrimitiveLocation, ResolvedPrimitive[]>;
  /** Gate suggestion (if any gate rule matched or manual selection needed) */
  /** Manually run a function */
  runFunction: (functionId: string, focus?: FunctionFocus) => Promise<void>;
  /** Run all functions in a sense protocol */
  runSenseProtocol: (protocolId: string, focus?: FunctionFocus) => Promise<void>;
  /** @deprecated Use runSenseProtocol */
  runAwarenessProtocol: (protocolId: string, focus?: FunctionFocus) => Promise<void>;
  /** Inject a result directly under a section key (for cross-section dispatch) */
  injectResult: (functionId: string, targetSectionId: string, result: FunctionResult) => void;
  /** Get cross-section impact notifications for a section (separate from regular primitives) */
  getCrossSectionImpact: (sectionId: string) => ResolvedPrimitive[] | null;
  /** Status */
  isRunning: (functionId: string) => boolean;
  runningFunctions: string[];
  /** Get raw result for a function */
  getResult: (functionId: string) => FunctionResult | undefined;
  /** All stored results */
  getAllResults: () => Map<string, FunctionResult>;
  /** Clear a stored result */
  clearResult: (functionId: string) => void;
  /** Clear all results for a section (or all results if no sectionId) */
  clearAllResults: (sectionId?: string) => void;
};

// ═══════════════════════════════════════════════════════
// EMPTY DEFAULT
// ═══════════════════════════════════════════════════════

const EMPTY_LOCATIONS: Record<PrimitiveLocation, ResolvedPrimitive[]> = {
  "writing-editor": [],
  "outline-node": [],
  "right-panel": [],
  "draft-panel": [],
  global: [],
};

// Gate evaluation is now handled by platform/gate/protocol.ts

// ═══════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════

export function usePipelineRuntime({
  snapshot,
  pipelineConfig,
  sectionId,
}: UsePipelineRuntimeProps): UsePipelineRuntimeResult {
  const [resultStore, setResultStore] = useState<Map<string, FunctionResult>>(
    () => new Map()
  );
  const [runningSet, setRunningSet] = useState<Set<string>>(() => new Set());
  const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevSnapshotRef = useRef<DocumentSnapshot | null>(null);

  // ── Resolve enabled protocols to their definitions ──
  // Support both old (awarenessProtocols) and new (senseProtocols) field names
  const senseProtocolsConfig = pipelineConfig.senseProtocols || {};
  const enabledProtocols = useMemo(() => {
    const result: Array<{
      config: EnabledSenseProtocol;
      definition: SenseProtocolDefinition;
    }> = [];
    for (const [id, config] of Object.entries(senseProtocolsConfig)) {
      if (!config.enabled) continue;
      const def = getSenseProtocol(id);
      if (def) result.push({ config, definition: def });
    }
    return result;
  }, [senseProtocolsConfig]);

  // ── Run a single function ──
  const runSingleFunction = useCallback(
    async (
      functionId: string,
      focus?: FunctionFocus,
      overrideConfig?: Record<string, unknown>
    ) => {
      if (!snapshot) return;

      setRunningSet((prev) => {
        const next = new Set(prev);
        next.add(functionId);
        return next;
      });

      try {
        const resolvedFocus: FunctionFocus | undefined =
          focus ?? (sectionId ? { sectionId } : undefined);

        const result = await runFunction(
          functionId,
          {
            snapshot,
            focus: resolvedFocus,
            config: overrideConfig ?? {},
          },
        );

        // Key by functionId::sectionId so results are scoped per section
        const targetSection = resolvedFocus?.sectionId || 'document';
        const resultKey = `${functionId}::${targetSection}`;
        setResultStore((prev) => {
          const next = new Map(prev);
          next.set(resultKey, result);
          return next;
        });
      } catch (err) {
        console.error(`[pipeline] Failed to run ${functionId}:`, err);
      } finally {
        setRunningSet((prev) => {
          const next = new Set(prev);
          next.delete(functionId);
          return next;
        });
      }
    },
    [snapshot, sectionId]
  );

  // ── Run a sense protocol (extracts function IDs from steps, runs in order) ──
  const runSenseProtocol = useCallback(
    async (protocolId: string, focus?: FunctionFocus) => {
      const def = getSenseProtocol(protocolId);
      if (!def || !snapshot) return;
      const pipelineEntry = pipelineConfig.senseProtocols?.[protocolId];

      // Extract function IDs from steps (run only, not show)
      const fnIds = def.steps
        .filter(s => s.run)
        .map(s => s.run!)
        // Also include legacy functions[] for backward compat
        .concat(def.functions.filter(f => !def.steps.some(s => s.run === f)));
      const uniqueFnIds = [...new Set(fnIds)];

      // Clear old results from THIS protocol's functions
      const targetSection = focus?.sectionId || 'document';
      setResultStore((prev) => {
        const protocolFnIds = new Set(uniqueFnIds);
        const next = new Map<string, import("@/platform/functions/protocol").FunctionResult>();
        for (const [key, result] of prev) {
          const baseFnId = key.split('::')[0];
          const keySectionId = key.split('::')[1];
          if (protocolFnIds.has(baseFnId) && keySectionId === targetSection) continue;
          next.set(key, result);
        }
        return next;
      });

      // Run first function only (the initial step — branching handled by SenseRunner component)
      // This is the "quick run" for button clicks; full step execution uses SenseRunner
      const firstFn = def.steps.find(s => s.run)?.run;
      if (firstFn) {
        await runSingleFunction(firstFn, focus, pipelineEntry?.config);
      }
    },
    [snapshot, runSingleFunction, pipelineConfig.senseProtocols]
  );

  // ── Trigger scheduling based on awareness protocol triggers ──
  useEffect(() => {
    intervalRefs.current.forEach((timer) => clearInterval(timer));
    intervalRefs.current.clear();

    if (!snapshot) return;

    for (const { config: entry, definition } of enabledProtocols) {
      const trigger = entry.trigger || definition.defaultTrigger;

      if (trigger === "interval") {
        const triggerDef = definition.triggerOptions.find(t => t.value === 'interval');
        const intervalMinutes =
          (entry.config?.intervalMinutes as number) ??
          (definition.defaultConfig?.intervalMinutes as number) ??
          (triggerDef?.config?.intervalMinutes as number) ??
          5;
        const ms = intervalMinutes * 60 * 1000;
        const timer = setInterval(() => {
          for (const fnId of definition.functions) {
            runSingleFunction(fnId, undefined, entry.config);
          }
        }, ms);
        intervalRefs.current.set(definition.id, timer);
      }
    }

    return () => {
      intervalRefs.current.forEach((timer) => clearInterval(timer));
      intervalRefs.current.clear();
    };
  }, [enabledProtocols, snapshot, runSingleFunction]);

  // Note: ambient/on-change triggers are NOT used at the document level.
  // Section-scoped functions (check-drift, etc.) need a sectionId, which
  // only exists when triggered per-section (via Check Drift button or interval).
  // Document-level auto-triggers would cause cross-section result pollution.

  // ── Resolve results into primitives, scoped by section ──
  // Returns primitives only for a specific section (or all if no section specified)
  const getPrimitivesForSection = useCallback((targetSectionId?: string): Record<
    PrimitiveLocation,
    ResolvedPrimitive[]
  > => {
    if (resultStore.size === 0) return EMPTY_LOCATIONS;

    const storeKeys = [...resultStore.keys()];
    console.log('[pipeline] getPrimitivesForSection', targetSectionId, 'keys:', storeKeys.join(', '));

    const allPrimitives: ResolvedPrimitive[] = [];
    for (const [key, result] of resultStore) {
      const baseFnId = key.split('::')[0];

      // Skip cross-section notifications — they render in their own panel, not in summary
      if (baseFnId === 'cross-section-impact' || baseFnId === 'cross-section-notification') {
        continue;
      }

      // Key format: functionId::sectionId
      if (targetSectionId) {
        const keySectionId = key.split('::')[1];
        if (keySectionId && keySectionId !== targetSectionId && keySectionId !== 'document') {
          continue;
        }
      }
      const resolved = resolveBindings(result.ui, result.data);
      allPrimitives.push(...resolved);
    }

    if (allPrimitives.length === 0) return EMPTY_LOCATIONS;
    return groupByLocation(allPrimitives);
  }, [resultStore]);

  // Global primitives (backward compat — all results combined)
  const primitivesByLocation = useMemo(() => {
    const result = getPrimitivesForSection();
    console.log('[pipeline] GLOBAL primitivesByLocation', { outlineCount: result['outline-node']?.length, writingCount: result['writing-editor']?.length, panelCount: result['right-panel']?.length });
    return result;
  }, [getPrimitivesForSection]);

  // Cross-section impact notifications (separate from regular primitives)
  const getCrossSectionImpact = useCallback((targetSectionId: string): ResolvedPrimitive[] | null => {
    const key = `cross-section-impact::${targetSectionId}`;
    const result = resultStore.get(key);
    if (!result || !result.ui || result.ui.length === 0) return null;
    const resolved = resolveBindings(result.ui, result.data);
    return resolved.length > 0 ? resolved : null;
  }, [resultStore]);

  // Gate evaluation removed — now handled by GateRunner via evaluate-gate function

  // ── Public API ──
  const isRunning = useCallback(
    (functionId: string) => runningSet.has(functionId),
    [runningSet]
  );

  const runningFunctions = useMemo(
    () => Array.from(runningSet),
    [runningSet]
  );

  const getResult = useCallback(
    (functionId: string) => resultStore.get(functionId),
    [resultStore]
  );

  const getAllResults = useCallback(() => resultStore, [resultStore]);

  const clearResult = useCallback((functionId: string) => {
    setResultStore((prev) => {
      const next = new Map(prev);
      // Delete exact key and any scoped keys (functionId::sectionId)
      for (const key of prev.keys()) {
        if (key === functionId || key.startsWith(`${functionId}::`)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  /** Clear all results for a specific section, or all results if no sectionId */
  const clearAllResults = useCallback((sectionId?: string) => {
    setResultStore((prev) => {
      if (!sectionId) return new Map();
      const next = new Map(prev);
      for (const key of prev.keys()) {
        if (key.endsWith(`::${sectionId}`)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  // Inject a result directly into the store under a specific section key
  // Used for cross-section impact dispatch (no re-running functions)
  const injectResult = useCallback((functionId: string, targetSectionId: string, result: import("@/platform/functions/protocol").FunctionResult) => {
    const key = `${functionId}::${targetSectionId}`;
    setResultStore((prev) => {
      const next = new Map(prev);
      next.set(key, result);
      return next;
    });
  }, []);

  return {
    primitivesByLocation,
    getPrimitivesForSection,
    runFunction: runSingleFunction,
    runSenseProtocol,
    runAwarenessProtocol: runSenseProtocol, // backward compat
    injectResult,
    getCrossSectionImpact,
    isRunning,
    runningFunctions,
    getResult,
    getAllResults,
    clearResult,
    clearAllResults,
  };
}

// ═══════════════════════════════════════════════════════
// CONFIG CONVERTERS
// ═══════════════════════════════════════════════════════

export function metaRuleToPipelineConfig(metaRule?: MetaRuleConfig): PipelineConfig {
  return metaRule ?? DEFAULT_METARULE_CONFIG;
}
