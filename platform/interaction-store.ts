// ─── Interaction Store ───
//
// Store for FunctionResults, keyed by functionId + targetId.
// Backed by sessionStorage so results survive page refreshes.
// Falls back to in-memory if sessionStorage is unavailable (SSR).

import type { StoredFunctionResult } from './data-model';

type ResultKey = `${string}::${string}`; // functionId::targetId

const SESSION_KEY = 'intent-writer-interaction-store';

// ── Storage backend ──

const _store = new Map<ResultKey, StoredFunctionResult>();

function loadFromSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const entries = JSON.parse(raw) as Array<[ResultKey, StoredFunctionResult]>;
      for (const [key, value] of entries) {
        _store.set(key, value);
      }
    }
  } catch { /* ignore parse errors */ }
}

function saveToSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(_store.entries());
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch { /* ignore quota errors */ }
}

// Load on module init (client-side only)
loadFromSession();

// ── Public API ──

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
  saveToSession();
}

/** Get a specific function result */
export function getResult(functionId: string, targetId: string): StoredFunctionResult | undefined {
  return _store.get(makeKey(functionId, targetId));
}

/** Get all results for a target (e.g., all checks run on a section) */
export function getResultsForTarget(targetId: string): StoredFunctionResult[] {
  const results: StoredFunctionResult[] = [];
  for (const [, result] of _store) {
    if (result.targetId === targetId) {
      results.push(result);
    }
  }
  return results;
}

/** Get all results for a function (e.g., all check-drift results across sections) */
export function getResultsForFunction(functionId: string): StoredFunctionResult[] {
  const results: StoredFunctionResult[] = [];
  for (const [, result] of _store) {
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
  saveToSession();
}

/** Clear all stored results */
export function clearAll(): void {
  _store.clear();
  saveToSession();
}

/** Export all results as an array (for passing into DocumentSnapshot) */
export function toArray(): StoredFunctionResult[] {
  return Array.from(_store.values());
}
