// ─── Binding Resolver ───
//
// Takes a function's result data + UI bindings → produces resolved render instructions.
//
// Pipeline:
//   FunctionResult.data  +  FunctionResult.ui (UIBinding[])
//          ↓
//   resolveBindings()
//          ↓
//   ResolvedPrimitive[]  →  React renderer dispatches by type/location
//
// How it works:
//   1. For each UIBinding, check if it has forEach (array iteration) or when (condition)
//   2. For forEach: iterate over the array in result data, evaluate filter, expand templates
//   3. For when: evaluate the condition against scalar fields
//   4. Fill all {{item.field}} and {{field}} template strings with actual values
//   5. Look up primitive location from registry
//   6. Return concrete ResolvedPrimitive objects ready for rendering

import type { UIBinding, PrimitiveLocation } from './registry';
import { getPrimitive, getPrimitivesByCapability } from './registry';
import { resolveCapabilityBinding, type CapabilityBinding } from '../views/capabilities';


// ═══════════════════════════════════════════════════════
// RESOLVED PRIMITIVE — what the renderer receives
// ═══════════════════════════════════════════════════════

export type ResolvedPrimitive = {
  /** Which primitive to render */
  type: string;
  /** Where it renders (looked up from registry) */
  location: PrimitiveLocation;
  /** Resolved parameter values (no more templates, all filled in) */
  params: Record<string, string>;
  /** The source data item (for forEach bindings) — useful for click handlers etc. */
  sourceItem?: Record<string, unknown>;
};


// ═══════════════════════════════════════════════════════
// TEMPLATE ENGINE
// ═══════════════════════════════════════════════════════

/**
 * Fill {{item.field}} and {{field}} placeholders in a template string.
 */
function fillTemplate(
  template: string,
  item: Record<string, unknown> | null,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed = path.trim();

    // {{item.field}} — reference current array item
    if (trimmed.startsWith('item.') && item) {
      const fieldPath = trimmed.slice(5);
      const value = resolveFieldPath(item, fieldPath);
      // For objects/arrays, serialize to JSON so downstream renderers can parse
      if (value !== null && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value ?? '');
    }

    // {{field}} — reference top-level result data
    const value = resolveFieldPath(data, trimmed);
    if (value !== null && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  });
}

/** Resolve a dot-path like "foo.bar.baz" against an object */
function resolveFieldPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}


// ═══════════════════════════════════════════════════════
// CONDITION EVALUATOR
// ═══════════════════════════════════════════════════════

/**
 * Evaluate a simple condition expression against data + item.
 *
 * Supports:
 *   - "item.status !== 'aligned'"
 *   - "total > 0"
 *   - "item.over"  (truthy check)
 *
 * Uses Function constructor for flexibility. Safe because
 * expressions come from registered function definitions (developer code).
 */
function evaluateCondition(
  expr: string,
  item: Record<string, unknown> | null,
  data: Record<string, unknown>,
): boolean {
  try {
    const context: Record<string, unknown> = { ...data };
    if (item) {
      context.item = item;
    }
    const keys = Object.keys(context);
    const values = keys.map(k => context[k]);
    const fn = new Function(...keys, `return Boolean(${expr})`);
    return fn(...values);
  } catch {
    return false;
  }
}


// ═══════════════════════════════════════════════════════
// RESOLVER
// ═══════════════════════════════════════════════════════

/**
 * Resolve all UI bindings against function result data.
 *
 * @param bindings - UIBinding[] from the function definition
 * @param data     - The result data from running the function
 * @returns ResolvedPrimitive[] ready for React components to render
 */
export function resolveBindings(
  bindings: UIBinding[],
  data: Record<string, unknown>,
): ResolvedPrimitive[] {
  const resolved: ResolvedPrimitive[] = [];

  for (const binding of bindings) {
    const primDef = getPrimitive(binding.type);
    // Binding can override the primitive's default location
    const location = binding.location ?? primDef?.location ?? 'global';

    if (binding.forEach) {
      // ── Array binding: iterate over result array ──
      const array = resolveFieldPath(data, binding.forEach);
      if (!Array.isArray(array)) continue;

      for (const item of array) {
        const itemRecord = item as Record<string, unknown>;

        if (binding.filter && !evaluateCondition(binding.filter, itemRecord, data)) {
          continue;
        }

        const filledParams: Record<string, string> = {};
        for (const [key, template] of Object.entries(binding.params)) {
          filledParams[key] = fillTemplate(template, itemRecord, data);
        }

        resolved.push({ type: binding.type, location, params: filledParams, sourceItem: itemRecord });
      }
    } else {
      // ── Scalar binding: check when condition ──
      if (binding.when && !evaluateCondition(binding.when, null, data)) {
        continue;
      }

      const filledParams: Record<string, string> = {};
      for (const [key, template] of Object.entries(binding.params)) {
        filledParams[key] = fillTemplate(template, null, data);
      }

      resolved.push({ type: binding.type, location, params: filledParams });
    }
  }

  return resolved;
}


// ═══════════════════════════════════════════════════════
// GROUPING HELPERS
// ═══════════════════════════════════════════════════════

/** Group resolved primitives by type */
export function groupByType(
  primitives: ResolvedPrimitive[],
): Record<string, ResolvedPrimitive[]> {
  const groups: Record<string, ResolvedPrimitive[]> = {};
  for (const p of primitives) {
    if (!groups[p.type]) groups[p.type] = [];
    groups[p.type].push(p);
  }
  return groups;
}

/**
 * Resolve capability-based bindings to ResolvedPrimitives.
 * Accepts either UIBinding[] or CapabilityBinding[], normalizes both.
 */
export function resolveDisplayBindings(
  bindings: (UIBinding | CapabilityBinding)[],
  data: Record<string, unknown>,
): ResolvedPrimitive[] {
  const normalized: UIBinding[] = bindings.map(b => {
    if ('on' in b && 'capability' in b) {
      const resolved = resolveCapabilityBinding(b as CapabilityBinding);
      if (!resolved) return null;
      return resolved as UIBinding;
    }
    return b as UIBinding;
  }).filter((b): b is UIBinding => b !== null);

  return resolveBindings(normalized, data);
}

/** Group resolved primitives by render location */
export function groupByLocation(
  primitives: ResolvedPrimitive[],
): Record<PrimitiveLocation, ResolvedPrimitive[]> {
  const groups = {
    'writing-editor': [],
    'outline-node': [],
    'right-panel': [],
    'draft-panel': [],
    'global': [],
  } as Record<PrimitiveLocation, ResolvedPrimitive[]>;

  for (const p of primitives) {
    groups[p.location].push(p);
  }
  return groups;
}
