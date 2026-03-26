import type { GateRule } from "@/platform/gate/protocol";

export type NotifyLevel = "skip" | "heads-up" | "notify";

export type EnabledSenseProtocol = {
  protocolId: string;
  enabled: boolean;
  trigger: string;
  config: Record<string, unknown>;
};

export type MetaRuleConfig = {
  version: 2;
  senseProtocols: Record<string, EnabledSenseProtocol>;
  gateId?: string;
  gateRules?: GateRule[];
  defaultNegotiateProtocol: string;
  defaultNotifyLevel: NotifyLevel;
  allowOverride: boolean;
  /** Per-path configuration overrides (e.g. { negotiate: { voters: 'all-members', resolutionFn: 'check-unanimous' } }) */
  pathConfigs?: Record<string, Record<string, unknown>>;
};

export type PipelineConfig = MetaRuleConfig;

export const DEFAULT_METARULE_CONFIG: MetaRuleConfig = {
  version: 2,
  senseProtocols: {
    "drift-impact-preview": {
      protocolId: "drift-impact-preview",
      enabled: true,
      trigger: "manual",
      config: {},
    },
  },
  gateId: undefined,
  gateRules: undefined,
  defaultNegotiateProtocol: "decided",
  defaultNotifyLevel: "heads-up",
  allowOverride: true,
};

export const EMPTY_PIPELINE_CONFIG: PipelineConfig = DEFAULT_METARULE_CONFIG;

// ─── Legacy Gate Threshold Helpers (used by metaRule-engine) ───

export type CoordinationPath = "decided" | "input" | "discussion" | "negotiate";
export type ImpactScope = "same-section" | "cross-section";
export type ImpactSeverity = "none" | "minor" | "significant";
export type GroupInterest = "low" | "medium" | "high";

export type GateThreshold = {
  id: string;
  name: string;
  minScope?: ImpactScope;
  minSeverity?: ImpactSeverity;
  minGroupInterest?: GroupInterest;
  suggestedPath: CoordinationPath;
  pathConfig?: Record<string, unknown>;
};

const SCOPE_ORDER: ImpactScope[] = ["same-section", "cross-section"];
const SEVERITY_ORDER: ImpactSeverity[] = ["none", "minor", "significant"];
const INTEREST_ORDER: GroupInterest[] = ["low", "medium", "high"];

function meetsOrExceeds<T>(value: T, threshold: T, order: T[]): boolean {
  return order.indexOf(value) >= order.indexOf(threshold);
}

export type GateSuggestion = {
  thresholdId: string;
  thresholdName: string;
  suggestedPath: CoordinationPath;
  pathConfig?: Record<string, unknown>;
  reason: string;
};

export function evaluateGateThresholds(
  thresholds: GateThreshold[],
  scope: ImpactScope,
  severity: ImpactSeverity,
  groupInterest: GroupInterest
): GateSuggestion | null {
  for (const threshold of thresholds) {
    const scopeMatch =
      !threshold.minScope || meetsOrExceeds(scope, threshold.minScope, SCOPE_ORDER);
    const severityMatch =
      !threshold.minSeverity ||
      meetsOrExceeds(severity, threshold.minSeverity, SEVERITY_ORDER);
    const interestMatch =
      !threshold.minGroupInterest ||
      meetsOrExceeds(groupInterest, threshold.minGroupInterest, INTEREST_ORDER);

    if (scopeMatch && severityMatch && interestMatch) {
      const reasons: string[] = [];
      if (threshold.minScope) reasons.push(`scope: ${scope}`);
      if (threshold.minSeverity) reasons.push(`severity: ${severity}`);
      if (threshold.minGroupInterest)
        reasons.push(`group interest: ${groupInterest}`);

      return {
        thresholdId: threshold.id,
        thresholdName: threshold.name,
        suggestedPath: threshold.suggestedPath,
        pathConfig: threshold.pathConfig,
        reason: `Gate "${threshold.name}" crossed (${reasons.join(", ")})`,
      };
    }
  }

  return null;
}
