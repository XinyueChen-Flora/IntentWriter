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

export type PrimitiveLocation = 'writing-editor' | 'outline-node' | 'right-panel' | 'draft-panel' | 'global';

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

/** Capability grouping metadata for entity-based resolution */
export type CapabilityGroup = {
  entity: string;      // 'IntentItem' | 'Paragraph' | 'Dependency' | 'Panel'
  capability: string;  // 'Indicator' | 'Inline' | 'Card' | etc.
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
  /** Entity-capability grouping (for capability-based resolution) */
  capabilityGroup?: CapabilityGroup;
};


// ═══════════════════════════════════════════════════════
// UI BINDING — how a function connects output to a primitive
// ═══════════════════════════════════════════════════════

export type UIBinding = {
  /** Which primitive to render */
  type: string;
  /** Override the primitive's default render location */
  location?: PrimitiveLocation;
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

/** Get primitives by entity-capability grouping */
export function getPrimitivesByCapability(entity: string, capability: string): PrimitiveDefinition[] {
  return getAllPrimitives().filter(
    p => p.capabilityGroup?.entity === entity && p.capabilityGroup?.capability === capability,
  );
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
  capabilityGroup: { entity: 'Paragraph', capability: 'Inline' },
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
  capabilityGroup: { entity: 'Paragraph', capability: 'Side' },
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
  capabilityGroup: { entity: 'Paragraph', capability: 'Block' },
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
  capabilityGroup: { entity: 'Paragraph', capability: 'Inline' },
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
  capabilityGroup: { entity: 'IntentItem', capability: 'Indicator' },
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
  capabilityGroup: { entity: 'IntentItem', capability: 'Indicator' },
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
  capabilityGroup: { entity: 'IntentItem', capability: 'Expandable' },
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
  capabilityGroup: { entity: 'Panel', capability: 'Card' },
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
  description: 'Text comparison widget. Word-level inline diff or side-by-side layout.',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Card' },
  params: [
    { key: 'before', type: 'string', required: true, description: 'Original text' },
    { key: 'after', type: 'string', required: true, description: 'Updated text' },
    { key: 'mode', type: 'diff-mode', required: true, description: 'word (inline tokens) or side-by-side' },
  ],
});

registerPrimitive({
  type: 'action-group',
  name: 'Action Group',
  location: 'right-panel',
  description: 'Standalone button row at the panel footer. For top-level actions like "Accept all" or "Dismiss".',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
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
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'title', type: 'string', required: true, description: 'Banner heading' },
    { key: 'message', type: 'string', required: true, description: 'Banner body' },
    { key: 'severity', type: 'severity', required: true, description: 'info (blue), warning (yellow), error (red), success (green)' },
  ],
});


// ═══════════════════════════════════════════════════════
// INTERACTION PRIMITIVES (for coordination flows)
// ═══════════════════════════════════════════════════════

registerPrimitive({
  type: 'text-input',
  name: 'Text Input',
  location: 'right-panel',
  description: 'Text input field for reasoning, comments, or replies. Emits the input value via onAction.',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'placeholder', type: 'string', required: false, description: 'Placeholder text' },
    { key: 'label', type: 'string', required: false, description: 'Label above the input' },
    { key: 'action', type: 'string', required: true, description: 'Action ID emitted on submit' },
    { key: 'rows', type: 'string', required: false, description: 'Number of rows (default 3)' },
  ],
});

registerPrimitive({
  type: 'comment-thread',
  name: 'Comment Thread',
  location: 'right-panel',
  description: 'Displays a threaded list of comments/votes/responses with author, action, and optional text.',
  supportsIteration: true,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'author', type: 'string', required: true, description: 'Author name or ID' },
    { key: 'action', type: 'string', required: true, description: 'Action taken (approve, reject, comment)' },
    { key: 'text', type: 'string', required: false, description: 'Comment text (if any)' },
    { key: 'timestamp', type: 'string', required: false, description: 'When the action was taken' },
  ],
});

registerPrimitive({
  type: 'progress-bar',
  name: 'Progress Bar',
  location: 'right-panel',
  description: 'Shows progress toward a threshold (e.g., vote count toward majority).',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'current', type: 'string', required: true, description: 'Current count' },
    { key: 'total', type: 'string', required: true, description: 'Total needed' },
    { key: 'label', type: 'string', required: false, description: 'Description (e.g., "3/5 approved")' },
    { key: 'variant', type: 'string', required: false, description: 'Color variant: default, success, warning' },
  ],
});

registerPrimitive({
  type: 'outline-draft',
  name: 'Outline Draft',
  location: 'right-panel',
  description: 'Shows a proposed outline with changes highlighted. Unchanged items shown plain, changed/added/removed items visually distinct. Includes propose and dismiss actions.',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'items', type: 'string', required: true, description: 'JSON array [{id, content, status: "unchanged"|"changed"|"added"|"removed", originalContent?, reason?}]' },
    { key: 'proposeAction', type: 'string', required: false, description: 'Action ID for propose button' },
    { key: 'dismissAction', type: 'string', required: false, description: 'Action ID for dismiss button' },
  ],
});

registerPrimitive({
  type: 'route-picker',
  name: 'Route Picker',
  location: 'right-panel',
  description: 'Shows available negotiate routes as selectable cards. User picks one to proceed.',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'routes', type: 'string', required: true, description: 'JSON array of {id, name, description}' },
    { key: 'reason', type: 'string', required: false, description: 'Explanation text shown above routes' },
    { key: 'action', type: 'string', required: true, description: 'Action ID prefix emitted with selected route (action:routeId)' },
  ],
});

registerPrimitive({
  type: 'draft-editor',
  name: 'Draft Editor',
  location: 'draft-panel',
  description: 'Editable list of outline items. Users can add, remove, and modify entries. Emits updated items via onAction.',
  supportsIteration: false,
  capabilityGroup: { entity: 'Panel', capability: 'Widget' },
  params: [
    { key: 'items', type: 'string', required: true, description: 'JSON array of draft items [{id, content, originalContent, isNew, isRemoved}]' },
    { key: 'action', type: 'string', required: true, description: 'Action ID emitted when items change' },
    { key: 'addLabel', type: 'string', required: false, description: 'Label for add button (default: "Add item")' },
  ],
});
