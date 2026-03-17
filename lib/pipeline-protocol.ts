// ─── Pipeline Protocol ───
// Each stage in the coordination pipeline is a plugin that declares:
//   1. What it is (metadata)
//   2. What it configures (schema)
//   3. How it appears in the flow preview
//   4. How it summarizes its current config
//
// The UI renders entirely from these declarations — no hardcoded components per stage.
// New stages can be added by registering a new StageDefinition.

// ─── Config Schema (drives the builder UI) ───

export type SelectField = {
  type: 'select';
  key: string;
  label: string;
  description?: string;
  layout?: 'grid-2' | 'stack';  // grid-2 = 2 columns, stack = vertical list
  options: {
    value: string;
    label: string;
    description?: string;
    tag?: string;       // e.g. "More autonomy", "Less noise"
    icon?: string;      // lucide icon name
  }[];
};

export type ToggleField = {
  type: 'toggle';
  key: string;
  label: string;
  description?: string;
  consequence?: {
    on: string;   // what happens when enabled
    off: string;  // what happens when disabled
  };
};

export type SegmentField = {
  type: 'segment';
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type NumberField = {
  type: 'number';
  key: string;
  label: string;
  min?: number;
  max?: number;
  unit?: string;
  prefix?: string;  // e.g. "Every"
};

/** Show child fields only when a condition is met */
export type ConditionalField = {
  type: 'conditional';
  when: { field: string; value: unknown } | { field: string; not: unknown };
  fields: ConfigField[];
};

/** Route by condition — maps a condition field to different coordination paths */
export type RouterField = {
  type: 'router';
  key: string;
  label: string;
  description?: string;
  /** The condition values to route on (e.g. impact levels) */
  conditions: {
    value: string;
    label: string;
    badgeVariant?: 'secondary' | 'destructive' | 'outline';
  }[];
  /** The path options available for each condition */
  paths: {
    value: string;
    label: string;
    description?: string;
    icon?: string;
  }[];
};

/** A group of fields that only appears when a specific path is in use */
export type PathSettingsField = {
  type: 'path-settings';
  pathKey: string;        // which router path this configures
  pathValue: string;      // the path value this applies to
  label: string;
  icon?: string;
  fields: ConfigField[];
};

export type ConfigField =
  | SelectField
  | ToggleField
  | SegmentField
  | NumberField
  | ConditionalField
  | RouterField
  | PathSettingsField;

// ─── Stage Definition (the plugin interface) ───

export type FlowAppearance = {
  /** Is this a point where humans decide at runtime? */
  isDecisionPoint?: boolean;
  /** Does the system run this automatically (no human involvement)? */
  isAutomatic?: boolean;
  /** Can this stage branch the pipeline? */
  canBranch?: boolean;
  /** Muted appearance (less prominent in flow) */
  muted?: boolean;
  /** Template string for flow subtitle, e.g. "{{trigger}} trigger, {{displayMode}} display" */
  summaryTemplate?: string;
};

export type StageDefinition = {
  /** Unique identifier for this stage type */
  id: string;
  /** Display name */
  name: string;
  /** Brief description of what this stage does */
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Category for grouping in "add stage" UI */
  category: 'awareness' | 'analysis' | 'gate' | 'coordination' | 'action';

  // ─── Builder UI ───
  /** Question posed to the team (drives reflection) */
  question: string;
  /** Hint text below the question */
  hint: string;
  /** Config fields — rendered in order by the generic builder */
  fields: ConfigField[];
  /** Default config values for a new instance of this stage */
  defaultConfig: Record<string, unknown>;

  // ─── Flow Preview ───
  flow: FlowAppearance;
};

// ─── Stage Instance (a configured plugin in the pipeline) ───

export type StageInstance = {
  /** Unique instance ID (UUID) */
  instanceId: string;
  /** References StageDefinition.id */
  stageId: string;
  /** Concrete config values (keys match field keys in the definition) */
  config: Record<string, unknown>;
  /** Whether this stage is enabled */
  enabled: boolean;
};

// ─── Pipeline (the full MetaRule as an ordered list of stages) ───

export type Pipeline = {
  version: number;
  /** Ordered list of stage instances */
  stages: StageInstance[];
  /** Allow writers to override defaults at proposal time */
  allowOverride: boolean;
  /** Metadata */
  updatedAt?: number;
  updatedBy?: string;
};

// ─── Stage Registry ───

const _registry = new Map<string, StageDefinition>();

export function registerStage(definition: StageDefinition): void {
  _registry.set(definition.id, definition);
}

export function getStageDefinition(id: string): StageDefinition | undefined {
  return _registry.get(id);
}

export function getAllStageDefinitions(): StageDefinition[] {
  return Array.from(_registry.values());
}

export function getStagesByCategory(category: StageDefinition['category']): StageDefinition[] {
  return getAllStageDefinitions().filter((s) => s.category === category);
}

// ─── Pipeline Helpers ───

/** Read a config value from a stage instance, falling back to definition default */
export function getStageConfig<T = unknown>(
  instance: StageInstance,
  key: string,
  definition?: StageDefinition
): T {
  if (key in instance.config) return instance.config[key] as T;
  if (definition && key in definition.defaultConfig) return definition.defaultConfig[key] as T;
  return undefined as T;
}

/** Find a stage instance by stageId */
export function findStage(pipeline: Pipeline, stageId: string): StageInstance | undefined {
  return pipeline.stages.find((s) => s.stageId === stageId);
}

/** Resolve the summary text for a stage instance using its definition's template */
export function resolveSummary(instance: StageInstance, definition: StageDefinition): string {
  const template = definition.flow.summaryTemplate;
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = instance.config[key];
    return val != null ? String(val) : '';
  });
}

/** Create a new stage instance from a definition */
export function createStageInstance(definition: StageDefinition): StageInstance {
  return {
    instanceId: crypto.randomUUID(),
    stageId: definition.id,
    config: { ...definition.defaultConfig },
    enabled: true,
  };
}
