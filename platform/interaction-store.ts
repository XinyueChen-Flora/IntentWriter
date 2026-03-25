// ─── Interaction Store ───
//
// In-memory store for FunctionResults, keyed by functionId + targetId.
// Persists results across checks within a session so subsequent functions
// can read prior results (e.g., assess-impact reads check-drift output).

import type { StoredFunctionResult } from './data-model';

type ResultKey = `${string}::${string}`; // functionId::targetId

const _store = new Map<ResultKey, StoredFunctionResult>();

function makeKey(functionId: string, targetId: string): ResultKey {
  return `${functionId}::${targetId}`;
}

/** Store a function result */
export function setResult(functionId: string, targetId: string, output: Record<string, unknown>): void {
  const result: StoredFunctionResult = {
    functionId,
    targetId,
    output,
    timestamp: Date.now(),
  };
  _store.set(makeKey(functionId, targetId), result);
}

/** Get a specific function result */
export function getResult(functionId: string, targetId: string): StoredFunctionResult | undefined {
  return _store.get(makeKey(functionId, targetId));
}

/** Get all results for a target (e.g., all checks run on a section) */
export function getResultsForTarget(targetId: string): StoredFunctionResult[] {
  const results: StoredFunctionResult[] = [];
  for (const [key, result] of _store) {
    if (result.targetId === targetId) {
      results.push(result);
    }
  }
  return results;
}

/** Get all results for a function (e.g., all check-drift results across sections) */
export function getResultsForFunction(functionId: string): StoredFunctionResult[] {
  const results: StoredFunctionResult[] = [];
  for (const [key, result] of _store) {
    if (result.functionId === functionId) {
      results.push(result);
    }
  }
  return results;
}

/** Get all stored results */
export function getAllResults(): StoredFunctionResult[] {
  return Array.from(_store.values());
}

/** Clear results for a specific target */
export function clearTarget(targetId: string): void {
  for (const [key, result] of _store) {
    if (result.targetId === targetId) {
      _store.delete(key);
    }
  }
}

/** Clear all stored results */
export function clearAll(): void {
  _store.clear();
}

/** Export all results as an array (for passing into DocumentSnapshot) */
export function toArray(): StoredFunctionResult[] {
  return Array.from(_store.values());
}
