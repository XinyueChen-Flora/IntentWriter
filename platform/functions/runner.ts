// ─── Function Runner ───
//
// Unified invocation layer for functions.
// Looks up definition → executes (local / prompt / api) → returns typed result.
//
// Pipeline:
//   registerFunction()  →  runFunction(id, input)  →  FunctionResult
//                                                        ↓
//                                              resolveBindings(result)
//                                                        ↓
//                                              ResolvedPrimitive[] (renderable)

import { getFunction, type FunctionResult, type FunctionInput } from './protocol';
import { setResult as storeResult } from '../interaction-store';

/**
 * Run a function by ID.
 *
 * @param id     - Registered function ID
 * @param input  - FunctionInput (snapshot + focus + config) or legacy bespoke data
 * @param config - Optional config overrides (merged with definition defaults)
 *
 * Execution modes:
 *   'local'  → calls fn(input) directly in the browser
 *   'prompt' → POSTs prompt template + snapshot to /api/run-prompt, AI returns structured result
 *   'api'    → POSTs input to the function's custom endpoint
 */
export async function runFunction(
  id: string,
  input: FunctionInput | Record<string, unknown>,
  config?: Record<string, unknown>
): Promise<FunctionResult> {
  const definition = getFunction(id);
  if (!definition) {
    throw new Error(`Function "${id}" not found in registry`);
  }

  // Merge: definition defaults < input.config (from useStepExecutor) < explicit 3rd arg
  const inputConfig = (input as FunctionInput).config || {};
  const mergedConfig = { ...definition.defaultConfig, ...inputConfig, ...config };

  let data: Record<string, unknown>;
  // Local functions can return their own ui bindings and mutations
  let localUi: import('./protocol').UIBinding[] | undefined;
  let localMutations: import('./protocol').BlockMutation[] | undefined;

  if (definition.executor === 'local') {
    // ── Local: run inline function ──
    if (!definition.fn) {
      throw new Error(`Function "${id}" is a local executor but has no fn`);
    }
    const fnInput: FunctionInput = {
      snapshot: (input as FunctionInput).snapshot ?? input,
      focus: (input as FunctionInput).focus,
      config: mergedConfig,
    };
    const result = await definition.fn(fnInput);
    data = result.data ?? (result as any);
    if (result.ui && result.ui.length > 0) {
      localUi = result.ui;
    }
    if ((result as any).mutations && (result as any).mutations.length > 0) {
      localMutations = (result as any).mutations;
    }

  } else if (definition.executor === 'prompt') {
    // ── Prompt: send prompt template + snapshot to /api/run-prompt ──
    if (!definition.prompt) {
      throw new Error(`Function "${id}" is a prompt executor but has no prompt`);
    }
    const snapshot = (input as FunctionInput).snapshot ?? input;
    const focus = (input as FunctionInput).focus;

    const response = await fetch('/api/run-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: definition.prompt,
        snapshot,
        focus,
        config: mergedConfig,
      }),
    });

    if (!response.ok) {
      throw new Error(`Function "${id}" prompt execution failed: ${response.status}`);
    }

    const json = await response.json();
    data = json.result ?? json;

  } else if (definition.executor === 'api') {
    // ── API: POST to custom endpoint ──
    if (!definition.endpoint) {
      throw new Error(`Function "${id}" is an API executor but has no endpoint`);
    }

    const response = await fetch(definition.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, config: mergedConfig }),
    });

    if (!response.ok) {
      throw new Error(`Function "${id}" API call failed: ${response.status}`);
    }

    const json = await response.json();
    data = json.result ?? json;

  } else {
    throw new Error(`Unknown executor type "${definition.executor}" for function "${id}"`);
  }

  const result: FunctionResult = {
    functionId: id,
    data,
    ui: localUi || definition.ui,
    mutations: localMutations,
    computedAt: Date.now(),
  };

  // Store result in interaction store for cross-function access
  const targetId = (input as FunctionInput).focus?.sectionId ?? 'document';
  storeResult(id, targetId, data);

  return result;
}
