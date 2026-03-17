// ─── UI Primitives ───
//
// The primitive registry defines every visual building block available to functions.
// Each primitive declares where it renders, what parameters it needs, and whether
// it supports array iteration (forEach/filter).
//
// Functions declare UI bindings referencing these primitives by type string.
// The resolver fills templates and evaluates conditions to produce ResolvedPrimitive[],
// which React renderer components consume directly.
//
// 12 primitives organized by render location:
//   Editor (4):  sentence-highlight, issue-dot, inline-widget, ai-marker
//   Outline (4): node-icon, node-badge, section-alert, summary-bar
//   Panel (3):   result-list, diff-view, action-group
//   Global (1):  banner


// ═══════════════════════════════════════════════════════
// PRIMITIVE DEFINITION
// ═══════════════════════════════════════════════════════

export type PrimitiveLocation = 'writing-editor' | 'outline-node' | 'right-panel' | 'global';

export type PrimitiveParamType =
  | 'string'           // general text
  | 'anchor'           // text substring for editor position matching
  | 'color'            // color token: red, yellow, green, blue, orange, purple
  | 'node-id'          // outline node ID
  | 'severity'         // info | warning | error | success
  | 'issue-type'       // partial | missing | orphan | conflict
  | 'node-status'      // covered | partial | missing | ai-covered
  | 'badge-variant'    // new | modified | removed | info | warning
  | 'widget-variant'   // suggestion | missing | info
  | 'diff-mode'        // word | side-by-side
  | 'alignment-level'  // aligned | partial | drifted
  | 'actions-json'     // JSON-encoded Array<{label, variant, action}>
  | 'counts-json';     // JSON-encoded Record<string, number>

export type PrimitiveParam = {
  key: string;
  type: PrimitiveParamType;
  required: boolean;
  description: string;
};

export type PrimitiveDefinition = {
  /** Unique type string */
  type: string;
  /** Display name */
  name: string;
  /** Where this primitive renders */
  location: PrimitiveLocation;
  /** Human-readable description */
  description: string;
  /** Parameter schema */
  params: PrimitiveParam[];
  /** Whether this primitive iterates over an array field (supports forEach/filter) */
  supportsIteration: boolean;
};


// ═══════════════════════════════════════════════════════
// UI BINDING — how a function connects output to a primitive
// ═══════════════════════════════════════════════════════

export type UIBinding = {
  /** Which primitive to render */
  type: string;
  /** For array primitives: dot-path into the result object to iterate */
  forEach?: string;
  /** Filter expression: only render items matching this condition */
  filter?: string;
  /** For non-array primitives: condition to show/hide */
  when?: string;
  /** Parameter values — template strings with {{item.field}} or {{field}} */
  params: Record<string, string>;
};


// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const _primitiveRegistry = new Map<string, PrimitiveDefinition>();

export function registerPrimitive(definition: PrimitiveDefinition): void {
  _primitiveRegistry.set(definition.type, definition);
}

export function getPrimitive(type: string): PrimitiveDefinition | undefined {
  return _primitiveRegistry.get(type);
}

export function getAllPrimitives(): PrimitiveDefinition[] {
  return Array.from(_primitiveRegistry.values());
}

export function getPrimitivesByLocation(location: PrimitiveLocation): PrimitiveDefinition[] {
  return getAllPrimitives().filter(p => p.location === location);
}

/** Validate that a UI binding references a registered primitive and has required params */
export function validateBinding(binding: UIBinding): string[] {
  const errors: string[] = [];
  const primitive = getPrimitive(binding.type);

  if (!primitive) {
    errors.push(`Unknown primitive type: "${binding.type}"`);
    return errors;
  }

  if (binding.forEach && !primitive.supportsIteration) {
    errors.push(`Primitive "${binding.type}" does not support forEach`);
  }

  for (const param of primitive.params) {
    if (param.required && !(param.key in binding.params)) {
      errors.push(`Missing required param "${param.key}" for primitive "${binding.type}"`);
    }
  }

  return errors;
}


// ═══════════════════════════════════════════════════════
// EDITOR PRIMITIVES (writing-editor)
// ═══════════════════════════════════════════════════════

registerPrimitive({
  type: 'sentence-highlight',
  name: 'Sentence Highlight',
  location: 'writing-editor',
  description: 'Color a text range by anchor text matching. Finds startAnchor in the editor and applies a background color with optional tooltip.',
  supportsIteration: true,
  params: [
    { key: 'startAnchor', type: 'anchor', required: true, description: 'Substring to match for the start of the highlight range' },
    { key: 'endAnchor', type: 'anchor', required: false, description: 'Substring to match for the end. When absent, highlights only the startAnchor match' },
    { key: 'color', type: 'color', required: true, description: 'Background color: red, yellow, green, blue, orange, purple' },
    { key: 'tooltip', type: 'string', required: false, description: 'Text shown on hover' },
  ],
});

registerPrimitive({
  type: 'issue-dot',
  name: 'Issue Dot',
  location: 'writing-editor',
  description: 'Numbered dot at a sentence boundary. Click to expand a detail popover with optional actions.',
  supportsIteration: true,
  params: [
    { key: 'anchor', type: 'anchor', required: true, description: 'Text to match. Dot placed after the end of this substring' },
    { key: 'index', type: 'string', required: true, description: 'Display number shown inside the dot' },
    { key: 'type', type: 'issue-type', required: true, description: 'partial (yellow), missing (red), orphan (orange), conflict (purple)' },
    { key: 'detail', type: 'string', required: false, description: 'Body text of the expanded popover' },
    { key: 'actions', type: 'actions-json', required: false, description: 'JSON array of {label, variant, action} for popover buttons' },
  ],
});

registerPrimitive({
  type: 'inline-widget',
  name: 'Inline Widget',
  location: 'writing-editor',
  description: 'Block-level widget inserted into the editor at an anchor position. For suggestions, missing content indicators, or info notices.',
  supportsIteration: true,
  params: [
    { key: 'anchor', type: 'anchor', required: true, description: 'Text preceding the insertion point. Use "__start__" for document head' },
    { key: 'content', type: 'string', required: true, description: 'Widget body text (proposed prose, missing description, or notice)' },
    { key: 'intentRef', type: 'node-id', required: false, description: 'ID of the related outline node' },
    { key: 'variant', type: 'widget-variant', required: true, description: 'suggestion (accept/dismiss), missing (dashed warning), info (neutral)' },
    { key: 'actions', type: 'actions-json', required: false, description: 'JSON array of {label, variant, action}. Omit to use variant defaults' },
  ],
});

registerPrimitive({
  type: 'ai-marker',
  name: 'AI Marker',
  location: 'writing-editor',
  description: 'Marks a text range as AI-generated content with a subtle tint and provenance icon.',
  supportsIteration: true,
  params: [
    { key: 'startAnchor', type: 'anchor', required: true, description: 'Start of the AI-generated range' },
    { key: 'endAnchor', type: 'anchor', required: false, description: 'End of the range. When absent, covers only startAnchor match' },
  ],
});


// ═══════════════════════════════════════════════════════
// OUTLINE PRIMITIVES (outline-node)
// ═══════════════════════════════════════════════════════

registerPrimitive({
  type: 'node-icon',
  name: 'Node Icon',
  location: 'outline-node',
  description: 'Status icon on an intent node. Shows coverage state. One icon per node (highest severity wins).',
  supportsIteration: true,
  params: [
    { key: 'nodeId', type: 'node-id', required: true, description: 'ID of the outline intent node' },
    { key: 'status', type: 'node-status', required: true, description: 'covered (green), partial (yellow), missing (red), ai-covered (blue sparkle)' },
    { key: 'tooltip', type: 'string', required: false, description: 'Hover text. Defaults to status value' },
  ],
});

registerPrimitive({
  type: 'node-badge',
  name: 'Node Badge',
  location: 'outline-node',
  description: 'Small pill label on an intent node. Multiple badges can stack.',
  supportsIteration: true,
  params: [
    { key: 'nodeId', type: 'node-id', required: true, description: 'ID of the outline intent node' },
    { key: 'label', type: 'string', required: true, description: 'Badge text (keep under 12 chars)' },
    { key: 'variant', type: 'badge-variant', required: true, description: 'new (green), modified (blue), removed (red), info (gray), warning (yellow)' },
  ],
});

registerPrimitive({
  type: 'section-alert',
  name: 'Section Alert',
  location: 'outline-node',
  description: 'Notification card below a section node. For section-level findings affecting the whole section.',
  supportsIteration: true,
  params: [
    { key: 'sectionId', type: 'node-id', required: true, description: 'ID of the root-level section node' },
    { key: 'title', type: 'string', required: true, description: 'Alert heading' },
    { key: 'message', type: 'string', required: true, description: 'Alert body' },
    { key: 'severity', type: 'severity', required: true, description: 'info, warning, error, success' },
    { key: 'actions', type: 'actions-json', required: false, description: 'JSON array of {label, variant, action} for action buttons' },
  ],
});

registerPrimitive({
  type: 'summary-bar',
  name: 'Summary Bar',
  location: 'outline-node',
  description: 'Alignment stats bar at the top of the outline panel. Shows coverage counts and overall level.',
  supportsIteration: false,
  params: [
    { key: 'counts', type: 'counts-json', required: true, description: 'JSON object mapping status→count, e.g. {"covered":4,"partial":2}' },
    { key: 'level', type: 'alignment-level', required: true, description: 'aligned, partial, or drifted' },
  ],
});


// ═══════════════════════════════════════════════════════
// PANEL PRIMITIVES (right-panel)
// ═══════════════════════════════════════════════════════

registerPrimitive({
  type: 'result-list',
  name: 'Result List',
  location: 'right-panel',
  description: 'Expandable card list in the right panel. Each card has title, badge, detail, and optional actions.',
  supportsIteration: true,
  params: [
    { key: 'title', type: 'string', required: true, description: 'Card header text' },
    { key: 'badge', type: 'string', required: false, description: 'Status pill beside the title' },
    { key: 'badgeVariant', type: 'badge-variant', required: false, description: 'Badge color. Defaults to info' },
    { key: 'detail', type: 'string', required: false, description: 'Body text when expanded' },
    { key: 'actions', type: 'actions-json', required: false, description: 'JSON array of {label, variant, action} for card footer buttons' },
  ],
});

registerPrimitive({
  type: 'diff-view',
  name: 'Diff View',
  location: 'right-panel',
  description: 'Text comparison widget. Word-level inline diff or side-by-side two-column layout.',
  supportsIteration: false,
  params: [
    { key: 'before', type: 'string', required: true, description: 'Original text (current state)' },
    { key: 'after', type: 'string', required: true, description: 'Proposed text (changed state)' },
    { key: 'mode', type: 'diff-mode', required: true, description: 'word (inline tokens) or side-by-side (two columns)' },
  ],
});

registerPrimitive({
  type: 'action-group',
  name: 'Action Group',
  location: 'right-panel',
  description: 'Standalone button row at the panel footer. For top-level actions like "Accept all" or "Dismiss".',
  supportsIteration: false,
  params: [
    { key: 'actions', type: 'actions-json', required: true, description: 'JSON array of {label, variant, action}. At least one item required' },
  ],
});


// ═══════════════════════════════════════════════════════
// GLOBAL PRIMITIVES
// ═══════════════════════════════════════════════════════

registerPrimitive({
  type: 'banner',
  name: 'Banner',
  location: 'global',
  description: 'Top-of-app notification bar. For document-level status. Highest severity wins if multiple.',
  supportsIteration: false,
  params: [
    { key: 'title', type: 'string', required: true, description: 'Banner heading' },
    { key: 'message', type: 'string', required: true, description: 'Banner body' },
    { key: 'severity', type: 'severity', required: true, description: 'info (blue), warning (yellow), error (red), success (green)' },
  ],
});
