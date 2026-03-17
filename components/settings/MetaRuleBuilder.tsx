"use client";

import { useState, useRef, useEffect } from "react";
import {
  MetaRuleConfig,
  DEFAULT_METARULE_CONFIG,
  CoordinationPath,
  NotifyLevel,
  VoteThreshold,
  ImpactLevel,
} from "@/lib/metarule-types";
import { getAllFunctions, type FunctionDefinition } from "@/platform/functions/protocol";
import { getAllPathUIs, getPathUI, type PathUI } from "@/platform/coordination/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Zap,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  Settings2,
  User,
  Users,
  ShieldCheck,
  CircleDot,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

// Ensure builtins are registered
import "@/platform/functions/builtin";
import "@/platform/coordination/builtin";

type MetaRuleBuilderProps = {
  initialConfig?: MetaRuleConfig;
  onSave: (config: MetaRuleConfig) => void;
  onCancel: () => void;
};

// Which section is currently visible (for flow highlight)
type ActiveSection = "capabilities" | "display" | "gate" | "routing" | "paths" | "override";

export default function MetaRuleBuilder({
  initialConfig,
  onSave,
  onCancel,
}: MetaRuleBuilderProps) {
  const [config, setConfig] = useState<MetaRuleConfig>(
    initialConfig ?? DEFAULT_METARULE_CONFIG
  );
  const [activeSection, setActiveSection] = useState<ActiveSection>("capabilities");
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ─── Read from registries ───
  const allFunctions = getAllFunctions();
  const allPathUIs = getAllPathUIs();

  const updateConfig = (partial: Partial<MetaRuleConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  // Track which section is in view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            setActiveSection(entry.target.getAttribute("data-section") as ActiveSection);
          }
        }
      },
      { root: container, threshold: 0.4 }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const registerSection = (id: string) => (el: HTMLDivElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  };

  const driftCheck = config.detection.checks.find((c) => c.type === "drift");

  const updateDriftCheck = (updates: Partial<MetaRuleConfig["detection"]["checks"][0]>) => {
    const checks = config.detection.checks.map((c) =>
      c.type === "drift" ? { ...c, ...updates } : c
    );
    updateConfig({ detection: { checks } });
  };

  const updateGate = (updates: Partial<MetaRuleConfig["gate"]>) => {
    updateConfig({ gate: { ...config.gate, ...updates } });
  };

  const updateRouting = (impactLevel: ImpactLevel, path: CoordinationPath) => {
    const routing = config.routing.map((r) =>
      r.condition.impactLevel === impactLevel ? { ...r, path } : r
    );
    updateConfig({ routing });
  };

  const updateCoordination = (updates: Partial<MetaRuleConfig["coordination"]>) => {
    updateConfig({ coordination: { ...config.coordination, ...updates } });
  };

  return (
    <div className="flex h-full">
      {/* Left: All settings in one scrollable view */}
      <div className="w-[520px] border-r flex flex-col">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Coordination Rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how your team coordinates writing changes. Discuss each choice together.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-10">

            {/* ─── Section 1: Capabilities (from registry) ─── */}
            <div ref={registerSection("capabilities")} data-section="capabilities">
              <SectionHeader
                number={1}
                question="Which functions should run?"
                hint="Functions are checks, analyses, and transformations. They can be AI-powered or rule-based."
              />
              <div className="mt-4 space-y-3">
                {allFunctions.map(cap => (
                  <FunctionToggle
                    key={cap.id}
                    func={cap}
                    isActive={cap.id === 'check-drift' || cap.id === 'assess-impact'}
                    driftCheck={cap.id === 'check-drift' ? driftCheck : undefined}
                    onUpdateDriftCheck={updateDriftCheck}
                  />
                ))}
              </div>
            </div>

            {/* ─── Section 2: Display ─── */}
            <div ref={registerSection("display")} data-section="display">
              <SectionHeader
                number={2}
                question="How should detection results appear?"
                hint="This determines what writers see after detection runs."
              />
              <div className="mt-4 space-y-3">
                <ChoiceCard
                  selected={driftCheck?.displayMode === "inline"}
                  onClick={() => updateDriftCheck({ displayMode: "inline" })}
                  icon={<Eye className="h-4 w-4" />}
                  title="Show everything inline"
                  description="All detection results appear next to the relevant text."
                  tag="Full transparency"
                />
                <ChoiceCard
                  selected={driftCheck?.displayMode === "summary"}
                  onClick={() => updateDriftCheck({ displayMode: "summary" })}
                  icon={<CircleDot className="h-4 w-4" />}
                  title="Summary panel"
                  description="A compact overview. Writers dig in when they want details."
                  tag="Less noise"
                />
                <ChoiceCard
                  selected={driftCheck?.displayMode === "severe-only"}
                  onClick={() => updateDriftCheck({ displayMode: "severe-only" })}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Only significant issues"
                  description="Minor drifts are hidden."
                  tag="Minimal interruption"
                />
              </div>
            </div>

            {/* ─── Section 3: Gate ─── */}
            <div ref={registerSection("gate")} data-section="gate">
              <SectionHeader
                number={3}
                question="What can skip team coordination?"
                hint="Some changes might not need the whole team involved."
              />
              <div className="mt-4 space-y-3">
                <ToggleChoice
                  checked={config.gate.bypassWhenNoImpact}
                  onChange={(v) => updateGate({ bypassWhenNoImpact: v })}
                  title="Changes with no cross-section impact"
                  description="If a change only affects the writer's own section, apply directly."
                  consequence={config.gate.bypassWhenNoImpact
                    ? "Writers can freely change their own section as long as it doesn't affect others."
                    : "Even self-contained changes go through team coordination."}
                />
                <ToggleChoice
                  checked={config.gate.bypassWhenAllMinor}
                  onChange={(v) => updateGate({ bypassWhenAllMinor: v })}
                  title="Changes where all impacts are minor"
                  description="If AI assesses all impacts as minor, skip coordination."
                  consequence={config.gate.bypassWhenAllMinor
                    ? "Minor cross-section impacts are auto-resolved."
                    : "Any cross-section impact requires team coordination."}
                />
                <ToggleChoice
                  checked={config.gate.ownerCanSelfResolve}
                  onChange={(v) => updateGate({ ownerCanSelfResolve: v })}
                  title="Section owners can self-resolve"
                  description="The person assigned to a section can apply changes without approval."
                  consequence={config.gate.ownerCanSelfResolve
                    ? "Owners have autonomy over their sections."
                    : "Even section owners need team approval."}
                />
              </div>
            </div>

            {/* ─── Section 4: Routing (from registry) ─── */}
            <div ref={registerSection("routing")} data-section="routing">
              <SectionHeader
                number={4}
                question="When coordination is needed, what process?"
                hint="Different impact levels can use different coordination processes."
              />
              <div className="mt-4 space-y-4">
                {(["minor", "significant"] as ImpactLevel[]).map((level) => {
                  const rule = config.routing.find((r) => r.condition.impactLevel === level);
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={level === "significant" ? "destructive" : "secondary"}>
                          {level} impact
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">which process?</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {allPathUIs.map(ui => (
                          <PathChoice
                            key={ui.id}
                            selected={rule?.path === ui.id}
                            onClick={() => updateRouting(level, ui.id as CoordinationPath)}
                            icon={<ui.Icon className={`h-4 w-4 ${ui.textColor}`} />}
                            title={ui.label}
                            description={ui.description}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Section 5: Path-specific settings (from registry) ─── */}
            <div ref={registerSection("paths")} data-section="paths">
              <SectionHeader
                number={5}
                question="Fine-tune each coordination path"
                hint="Configure the details of each coordination process your team uses."
              />
              <div className="mt-4 space-y-4">
                {allPathUIs.map(ui => {
                  if (!isPathUsed(config, ui.id as CoordinationPath)) return null;
                  return (
                    <RegistryPathSettings
                      key={ui.id}
                      pathUI={ui}
                      config={config}
                      usedFor={getPathUsage(config, ui.id as CoordinationPath)}
                      onUpdateCoordination={updateCoordination}
                    />
                  );
                })}

                {allPathUIs.every(ui => !isPathUsed(config, ui.id as CoordinationPath)) && (
                  <p className="text-sm text-muted-foreground italic">
                    No coordination paths are in use. Go back to step 4 to assign paths.
                  </p>
                )}
              </div>
            </div>

            {/* ─── Section 6: Override ─── */}
            <div ref={registerSection("override")} data-section="override">
              <SectionHeader
                number={6}
                question="Can writers override these rules?"
                hint="Should writers be allowed to choose a different process?"
              />
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceCard
                    selected={config.allowOverride}
                    onClick={() => updateConfig({ allowOverride: true })}
                    title="Yes, allow overrides"
                    description="Writers can choose a different coordination path. Default is still suggested."
                    tag="Flexible"
                  />
                  <ChoiceCard
                    selected={!config.allowOverride}
                    onClick={() => updateConfig({ allowOverride: false })}
                    title="No, enforce rules"
                    description="The configured rules always apply."
                    tag="Consistent"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(config);
              setSaveState('saved');
              setTimeout(() => setSaveState('idle'), 1500);
            }}
            className={saveState === 'saved' ? 'bg-green-600 hover:bg-green-600' : ''}
          >
            {saveState === 'saved' ? (
              <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Saved!</>
            ) : (
              'Save Rules'
            )}
          </Button>
        </div>
      </div>

      {/* Right: Live Flow */}
      <div className="flex-1 bg-muted/20 overflow-y-auto">
        <div className="sticky top-0 bg-muted/20 px-6 pt-6 pb-3 z-10">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Your Team&apos;s Coordination Pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updates as you configure each setting
          </p>
        </div>
        <div className="px-6 pb-6">
          <FlowPreview config={config} activeSection={activeSection} allPathUIs={allPathUIs} />
        </div>

        {/* Registry summary */}
        <div className="px-6 pb-6 border-t mt-4 pt-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Registered in Platform
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                Functions ({allFunctions.length})
              </div>
              <div className="space-y-1">
                {allFunctions.map(cap => (
                  <div key={cap.id} className="flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="truncate">{cap.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{cap.id}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                Coordination Paths ({allPathUIs.length})
              </div>
              <div className="space-y-1">
                {allPathUIs.map(ui => (
                  <div key={ui.id} className="flex items-center gap-1.5 text-xs">
                    <ui.Icon className={`h-3 w-3 ${ui.textColor} flex-shrink-0`} />
                    <span className="truncate">{ui.label}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{ui.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <a
            href="/dev"
            target="_blank"
            className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-3"
          >
            Developer Reference
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Capability Toggle (reads from registry definition) ───

function FunctionToggle({
  func,
  isActive,
  driftCheck,
  onUpdateDriftCheck,
}: {
  func: FunctionDefinition;
  isActive: boolean;
  driftCheck?: MetaRuleConfig["detection"]["checks"][0];
  onUpdateDriftCheck: (updates: Partial<MetaRuleConfig["detection"]["checks"][0]>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDriftConfig = func.id === 'check-drift' && driftCheck;

  return (
    <div className={`rounded-lg border-2 transition-all ${
      isActive ? 'border-primary/30 bg-primary/[0.02]' : 'border-border'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{func.name}</div>
          <div className="text-xs text-muted-foreground">{func.description}</div>
        </div>
        <Badge variant="outline" className="text-[9px] flex-shrink-0">{func.trigger}</Badge>
        {(hasDriftConfig || func.configFields.length > 0) && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {expanded && hasDriftConfig && (
        <div className="px-3 pb-3 border-t mx-3 pt-3 space-y-3">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Trigger
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceCard
              selected={driftCheck?.trigger === "manual"}
              onClick={() => onUpdateDriftCheck({ trigger: "manual" })}
              icon={<User className="h-3.5 w-3.5" />}
              title="Writer decides"
              description="Triggers when writer wants feedback"
              small
            />
            <ChoiceCard
              selected={driftCheck?.trigger === "auto"}
              onClick={() => onUpdateDriftCheck({ trigger: "auto" })}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title="Automatic"
              description="Runs periodically while writing"
              small
            />
          </div>
          {driftCheck?.trigger === "auto" && (
            <div className="ml-1 pl-3 border-l-2 border-primary/20 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard
                  selected={driftCheck?.autoFrequency === "per-paragraph"}
                  onClick={() => onUpdateDriftCheck({ autoFrequency: "per-paragraph" })}
                  title="Per paragraph"
                  description="Checks when you pause"
                  small
                />
                <ChoiceCard
                  selected={driftCheck?.autoFrequency === "per-minute"}
                  onClick={() => onUpdateDriftCheck({
                    autoFrequency: "per-minute",
                    autoIntervalMinutes: driftCheck?.autoIntervalMinutes ?? 5,
                  })}
                  title="On a timer"
                  description="Runs every few minutes"
                  small
                />
              </div>
              {driftCheck?.autoFrequency === "per-minute" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={driftCheck.autoIntervalMinutes ?? 5}
                    onChange={(e) => onUpdateDriftCheck({ autoIntervalMinutes: parseInt(e.target.value) || 5 })}
                    className="w-14 rounded border px-2 py-1 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {expanded && !hasDriftConfig && func.configFields.length > 0 && (
        <div className="px-3 pb-3 border-t mx-3 pt-3">
          <div className="text-xs text-muted-foreground italic">
            {func.configFields.length} configurable field{func.configFields.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Registry-driven Path Settings ───

function RegistryPathSettings({
  pathUI,
  config,
  usedFor,
  onUpdateCoordination,
}: {
  pathUI: PathUI;
  config: MetaRuleConfig;
  usedFor: string;
  onUpdateCoordination: (updates: Partial<MetaRuleConfig["coordination"]>) => void;
}) {
  const pathDef = pathUI.definition;

  // Build segment controls from path's configFields
  const renderConfigFields = () => {
    const pathId = pathUI.id as keyof MetaRuleConfig["coordination"];
    const currentPathConfig = config.coordination[pathId];
    if (!currentPathConfig) return null;

    return pathDef.configFields.map((field, idx) => {
      if (field.type !== 'segment' || !('options' in field)) return null;
      const segField = field as { type: 'segment'; key: string; label: string; options: { value: string; label: string }[] };
      const currentValue = (currentPathConfig as Record<string, unknown>)[segField.key] as string;

      return (
        <SettingRow key={idx} label={segField.label}>
          <SegmentedControl
            options={segField.options}
            value={currentValue ?? ''}
            onChange={(v) => {
              onUpdateCoordination({
                [pathId]: { ...currentPathConfig, [segField.key]: v },
              });
            }}
          />
        </SettingRow>
      );
    });
  };

  return (
    <PathSettings
      icon={<pathUI.Icon className={`h-4 w-4 ${pathUI.textColor}`} />}
      title={pathUI.label}
      usedFor={usedFor}
    >
      {renderConfigFields()}
    </PathSettings>
  );
}

// ─── Section Header ───

function SectionHeader({
  number,
  question,
  hint,
}: {
  number: number;
  question: string;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {number}
        </span>
        <h3 className="text-sm font-semibold">{question}</h3>
      </div>
      <p className="text-xs text-muted-foreground ml-8">{hint}</p>
    </div>
  );
}

// ─── Choice Card ───

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  description,
  tag,
  small,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  description: string;
  tag?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border-2 transition-all ${small ? "p-2.5" : "p-3"} ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className={selected ? "text-primary" : "text-muted-foreground"}>{icon}</span>}
        <span className={`font-medium ${small ? "text-xs" : "text-sm"}`}>{title}</span>
        {tag && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            {tag}
          </Badge>
        )}
      </div>
      <p className={`text-muted-foreground mt-1 ${small ? "text-[11px]" : "text-xs"} ${icon ? "ml-6" : ""}`}>
        {description}
      </p>
    </button>
  );
}

// ─── Toggle Choice ───

function ToggleChoice({
  checked,
  onChange,
  title,
  description,
  consequence,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  consequence: string;
}) {
  return (
    <label className={`block rounded-lg border-2 cursor-pointer transition-all ${
      checked ? "border-primary/50 bg-primary/5" : "border-border hover:border-muted-foreground/30"
    }`}>
      <div className="p-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 rounded"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          </div>
        </div>
      </div>
      <div className={`px-3 pb-3 pt-0 ml-9 transition-opacity ${checked ? "opacity-100" : "opacity-50"}`}>
        <div className="text-xs text-muted-foreground/80 italic flex items-start gap-1.5">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {consequence}
        </div>
      </div>
    </label>
  );
}

// ─── Path Choice ───

function PathChoice({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-2.5 rounded-lg border-2 transition-all ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 ml-6">{description}</p>
    </button>
  );
}

// ─── Path Settings ───

function PathSettings({
  icon,
  title,
  usedFor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  usedFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{usedFor}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Setting Row ───

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// ─── Segmented Control ───

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          } ${opt.value !== options[0].value ? "border-l" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ───

function isPathUsed(config: MetaRuleConfig, path: CoordinationPath): boolean {
  return config.routing.some(
    (r) => r.path === path && r.condition.impactLevel !== "none"
  );
}

function getPathUsage(config: MetaRuleConfig, path: CoordinationPath): string {
  const levels = config.routing
    .filter((r) => r.path === path && r.condition.impactLevel !== "none")
    .map((r) => r.condition.impactLevel);
  if (levels.length === 0) return "";
  return `used for ${levels.join(", ")} impact`;
}

// ─── Flow Preview (registry-driven) ───

function FlowPreview({
  config,
  activeSection,
  allPathUIs,
}: {
  config: MetaRuleConfig;
  activeSection: ActiveSection;
  allPathUIs: PathUI[];
}) {
  const driftCheck = config.detection.checks.find((c) => c.type === "drift");
  const minorRule = config.routing.find((r) => r.condition.impactLevel === "minor");
  const sigRule = config.routing.find((r) => r.condition.impactLevel === "significant");

  const pathLabel = (pathId: string) => {
    const ui = allPathUIs.find(u => u.id === pathId);
    return ui?.label ?? pathId;
  };

  const pathColor = (pathId: string) => {
    const ui = allPathUIs.find(u => u.id === pathId);
    if (!ui) return "text-gray-600 bg-gray-50 border-gray-200";
    return `${ui.textColor} ${ui.bgColor} ${ui.borderColor}`;
  };

  const allFunctions = getAllFunctions();

  return (
    <div className="max-w-sm mx-auto space-y-1">
      {/* Writer is writing */}
      <FlowNode highlighted={false} title="Writer is writing" muted />
      <FlowArrow />

      {/* Capabilities */}
      <FlowNode
        highlighted={activeSection === "capabilities" || activeSection === "display"}
        title={`AI Capabilities (${allFunctions.length})`}
        subtitle={
          driftCheck?.trigger === "auto"
            ? `Drift: auto · Display: ${driftCheck?.displayMode ?? 'inline'}`
            : `Drift: manual · Display: ${driftCheck?.displayMode ?? 'inline'}`
        }
        icon={<Eye className="h-3.5 w-3.5" />}
      />
      <FlowArrow />

      {/* Writer proposes */}
      <FlowNode
        highlighted={false}
        title="Writer proposes a change"
        isDecisionPoint
        icon={<Zap className="h-3.5 w-3.5" />}
      />
      <FlowArrow />

      {/* Impact Preview */}
      <FlowNode
        highlighted={false}
        title="Impact Preview"
        subtitle="AI analyzes cross-section impact"
        icon={<Sparkles className="h-3.5 w-3.5" />}
      />
      <FlowArrow />

      {/* Gate */}
      <FlowNode
        highlighted={activeSection === "gate"}
        title="Gate Check"
        subtitle={
          config.gate.bypassWhenNoImpact && config.gate.bypassWhenAllMinor
            ? "Bypass: no impact or all minor"
            : config.gate.bypassWhenNoImpact
              ? "Bypass: no cross-section impact"
              : "All changes go through coordination"
        }
        icon={<GitBranch className="h-3.5 w-3.5" />}
      />

      {/* Branches */}
      <div className="flex gap-3 pt-1">
        <div className="flex-1">
          <div className="text-center mb-1">
            <span className="text-[10px] text-muted-foreground">bypass</span>
          </div>
          <div className="text-center py-2 rounded border border-dashed text-xs text-muted-foreground">
            Apply directly
          </div>
        </div>

        <div className="flex-1">
          <div className="text-center mb-1">
            <span className="text-[10px] text-muted-foreground">needs coordination</span>
          </div>
          <div className={`space-y-1.5 ${activeSection === "routing" || activeSection === "paths" ? "ring-2 ring-primary/30 rounded-lg p-1.5" : "p-1.5"}`}>
            {minorRule && minorRule.condition.impactLevel !== "none" && (
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs ${pathColor(minorRule.path)}`}>
                <Badge variant="secondary" className="text-[9px] h-4">minor</Badge>
                <span className="font-medium">{pathLabel(minorRule.path)}</span>
              </div>
            )}
            {sigRule && sigRule.condition.impactLevel !== "none" && (
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs ${pathColor(sigRule.path)}`}>
                <Badge variant="destructive" className="text-[9px] h-4">significant</Badge>
                <span className="font-medium">{pathLabel(sigRule.path)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <FlowArrow />

      {/* Team responds */}
      <FlowNode
        highlighted={false}
        title="Team responds"
        isDecisionPoint
        icon={<Users className="h-3.5 w-3.5" />}
      />
      <FlowArrow />

      {/* Resolution */}
      <FlowNode
        highlighted={activeSection === "override"}
        title="Resolution & Apply"
        subtitle={config.allowOverride ? "Writers can override defaults" : "Rules are enforced"}
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
      />
    </div>
  );
}

// ─── Flow UI Components ───

function FlowNode({
  highlighted,
  title,
  subtitle,
  icon,
  isDecisionPoint,
  muted,
}: {
  highlighted: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isDecisionPoint?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`px-3 py-2.5 rounded-lg border-2 transition-all ${
        highlighted
          ? "border-primary bg-primary/5 shadow-sm"
          : isDecisionPoint
            ? "border-dashed border-amber-300 bg-amber-50/30"
            : muted
              ? "border-border/50 bg-muted/30"
              : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className={isDecisionPoint ? "text-amber-600" : muted ? "text-muted-foreground/50" : "text-muted-foreground"}>
            {icon}
          </span>
        )}
        <span className={`text-xs font-medium ${muted ? "text-muted-foreground" : ""}`}>{title}</span>
        {isDecisionPoint && (
          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 ml-auto">
            writer decides
          </Badge>
        )}
      </div>
      {subtitle && (
        <p className={`text-[11px] text-muted-foreground mt-0.5 ${icon ? "ml-6" : ""}`}>{subtitle}</p>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-0.5">
      <ArrowDown className="h-3.5 w-3.5 text-border" />
    </div>
  );
}
