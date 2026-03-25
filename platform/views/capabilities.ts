// ─── Entity Capability Mapping ───
//
// Maps the paper's entity-based view capabilities to existing primitives.
// The paper defines capabilities organized by entity type:
//   IntentItem: Indicator, Expandable, Actions
//   Paragraph:  Inline, Side, Block
//   Dependency: State
//   Panel:      Card, Widget
//
// Each capability maps to one or more primitives from the registry.
// Functions can declare display bindings using either:
//   1. Direct primitive names (existing): { type: 'node-icon', ... }
//   2. Capability-based (new): { on: 'IntentItem', capability: 'Indicator', ... }

/** Entity types that capabilities operate on */
export type EntityType = 'IntentItem' | 'Paragraph' | 'Dependency' | 'Panel';

/** Capability names per entity */
export type IntentItemCapability = 'Indicator' | 'Expandable' | 'Actions';
export type ParagraphCapability = 'Inline' | 'Side' | 'Block';
export type DependencyCapability = 'State';
export type PanelCapability = 'Card' | 'Widget';

export type CapabilityName =
  | IntentItemCapability
  | ParagraphCapability
  | DependencyCapability
  | PanelCapability;

/** A capability-based display binding */
export type CapabilityBinding = {
  /** Which entity this targets */
  on: EntityType;
  /** Which capability to use */
  capability: CapabilityName;
  /** Same forEach/filter/when/params as UIBinding */
  forEach?: string;
  filter?: string;
  when?: string;
  params: Record<string, string>;
};

/** Mapping from entity.capability to primitive type(s) */
export type EntityCapabilityMapping = {
  entity: EntityType;
  capability: CapabilityName;
  /** Primary primitive to use */
  primaryPrimitive: string;
  /** Additional primitives that can be used */
  secondaryPrimitives?: string[];
  description: string;
};

/** The complete capability-to-primitive mapping */
export const CAPABILITY_MAPPINGS: EntityCapabilityMapping[] = [
  // IntentItem capabilities
  {
    entity: 'IntentItem',
    capability: 'Indicator',
    primaryPrimitive: 'node-icon',
    secondaryPrimitives: ['node-badge'],
    description: 'Status indicators on outline intent nodes',
  },
  {
    entity: 'IntentItem',
    capability: 'Expandable',
    primaryPrimitive: 'section-alert',
    description: 'Expandable alerts and details below intent nodes',
  },
  {
    entity: 'IntentItem',
    capability: 'Actions',
    primaryPrimitive: 'action-group',
    description: 'Action buttons for intent-level operations',
  },

  // Paragraph capabilities
  {
    entity: 'Paragraph',
    capability: 'Inline',
    primaryPrimitive: 'sentence-highlight',
    secondaryPrimitives: ['ai-marker'],
    description: 'Inline text decorations within paragraphs',
  },
  {
    entity: 'Paragraph',
    capability: 'Side',
    primaryPrimitive: 'issue-dot',
    description: 'Side annotations at paragraph boundaries',
  },
  {
    entity: 'Paragraph',
    capability: 'Block',
    primaryPrimitive: 'inline-widget',
    description: 'Block-level widgets inserted between paragraphs',
  },

  // Dependency capabilities
  {
    entity: 'Dependency',
    capability: 'State',
    primaryPrimitive: 'node-badge',
    secondaryPrimitives: ['section-alert'],
    description: 'Dependency relationship state indicators',
  },

  // Panel capabilities
  {
    entity: 'Panel',
    capability: 'Card',
    primaryPrimitive: 'result-list',
    secondaryPrimitives: ['diff-view'],
    description: 'Card-based result displays in panels',
  },
  {
    entity: 'Panel',
    capability: 'Widget',
    primaryPrimitive: 'action-group',
    secondaryPrimitives: ['banner'],
    description: 'Widget-level panel components',
  },
];

/** Look up the primary primitive for a capability */
export function getPrimitiveForCapability(
  entity: EntityType,
  capability: CapabilityName,
): string | undefined {
  const mapping = CAPABILITY_MAPPINGS.find(
    m => m.entity === entity && m.capability === capability,
  );
  return mapping?.primaryPrimitive;
}

/** Get all primitives (primary + secondary) for a capability */
export function getAllPrimitivesForCapability(
  entity: EntityType,
  capability: CapabilityName,
): string[] {
  const mapping = CAPABILITY_MAPPINGS.find(
    m => m.entity === entity && m.capability === capability,
  );
  if (!mapping) return [];
  return [mapping.primaryPrimitive, ...(mapping.secondaryPrimitives ?? [])];
}

/** Resolve a CapabilityBinding to a UIBinding-compatible format */
export function resolveCapabilityBinding(binding: CapabilityBinding): {
  type: string;
  forEach?: string;
  filter?: string;
  when?: string;
  params: Record<string, string>;
} | null {
  const primitive = getPrimitiveForCapability(binding.on, binding.capability);
  if (!primitive) return null;

  return {
    type: primitive,
    forEach: binding.forEach,
    filter: binding.filter,
    when: binding.when,
    params: binding.params,
  };
}
