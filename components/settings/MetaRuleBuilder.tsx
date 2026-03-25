"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_METARULE_CONFIG,
  type EnabledSenseProtocol,
  type MetaRuleConfig,
  type NotifyLevel,
} from "@/lib/metarule-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllSenseProtocols,
  type SenseConfigField,
  type SenseProtocolDefinition,
} from "@/platform/sense/protocol";
import { getAllGates } from "@/platform/gate/protocol";
import { getAllCoordinationPaths } from "@/platform/coordination/protocol";
import { CheckCircle2 } from "lucide-react";

import "@/platform/sense/builtin";
import "@/platform/gate/builtin";
import "@/platform/coordination/builtin";

type MetaRuleBuilderProps = {
  initialConfig?: MetaRuleConfig;
  onSave: (config: MetaRuleConfig) => void;
  onCancel: () => void;
};

const NOTIFY_OPTIONS: { value: NotifyLevel; label: string }[] = [
  { value: "heads-up", label: "Heads up" },
  { value: "notify", label: "Notify" },
  { value: "skip", label: "Skip (only when required)" },
];

export default function MetaRuleBuilder({
  initialConfig,
  onSave,
  onCancel,
}: MetaRuleBuilderProps) {
  const [config, setConfig] = useState<MetaRuleConfig>(
    initialConfig ?? DEFAULT_METARULE_CONFIG
  );
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  const senseProtocols = useMemo(() => getAllSenseProtocols(), []);
  const availableGates = useMemo(() => getAllGates(), []);
  const coordinationPaths = useMemo(() => getAllCoordinationPaths(), []);

  const ensureSenseEntry = (
    protocolId: string,
    definition: SenseProtocolDefinition
  ): EnabledSenseProtocol => {
    const existing = config.senseProtocols[protocolId];
    if (existing) return existing;
    const trigger =
      definition.defaultTrigger ||
      definition.triggerOptions[0]?.value ||
      "manual";
    return {
      protocolId,
      enabled: false,
      trigger,
      config: definition.defaultConfig ?? {},
    };
  };

  const updateSenseProtocol = (
    protocolId: string,
    definition: SenseProtocolDefinition,
    updates: Partial<EnabledSenseProtocol>
  ) => {
    setConfig((prev) => {
      const nextEntry = {
        ...ensureSenseEntry(protocolId, definition),
        ...updates,
      };
      return {
        ...prev,
        senseProtocols: {
          ...prev.senseProtocols,
          [protocolId]: nextEntry,
        },
      };
    });
  };

  const handleSave = () => {
    const cleaned: MetaRuleConfig = {
      ...config,
      version: 2,
    };
    setConfig(cleaned);
    onSave(cleaned);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-1">Sense Protocols</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enable the capabilities you want running in this document. These come
            directly from the registered sense protocols.
          </p>
          <div className="space-y-3">
            {senseProtocols.map((protocol) => {
              const entry = ensureSenseEntry(protocol.id, protocol);
              return (
                <div
                  key={protocol.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    entry.enabled ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{protocol.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {protocol.description}
                      </div>
                    </div>
                    <label className="text-xs flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entry.enabled}
                        onChange={(e) =>
                          updateSenseProtocol(protocol.id, protocol, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>

                  {entry.enabled && (
                    <div className="mt-3 space-y-3">
                      {protocol.triggerOptions.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Trigger</Label>
                          <select
                            className="w-full rounded-md border px-2 py-2 text-sm bg-background"
                            value={entry.trigger}
                            onChange={(e) =>
                              updateSenseProtocol(protocol.id, protocol, {
                                trigger: e.target.value,
                              })
                            }
                          >
                            {protocol.triggerOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {protocol.configFields?.length ? (
                        <div className="space-y-2">
                          {protocol.configFields.map((field) => {
                            if (
                              field.showWhenTrigger &&
                              !field.showWhenTrigger.includes(entry.trigger)
                            ) {
                              return null;
                            }
                            return (
                              <SenseConfigFieldEditor
                                key={field.key}
                                field={field}
                                value={entry.config?.[field.key]}
                                onChange={(value) => {
                                  updateSenseProtocol(protocol.id, protocol, {
                                    config: {
                                      ...entry.config,
                                      [field.key]: value,
                                    },
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">Gate</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which gate decides whether proposals need coordination.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">Gate</Label>
            <select
              className="w-full rounded-md border px-2 py-2 text-sm bg-background"
              value={config.gateId ?? ""}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  gateId: e.target.value || undefined,
                }))
              }
            >
              {availableGates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-1">Coordination</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Pick the default coordination path and how strongly you want writers
            to be notified about changes.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Default coordination path</Label>
              <div className="grid gap-2">
                {coordinationPaths.map((path) => (
                  <label
                    key={path.id}
                    className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                      config.defaultNegotiateProtocol === path.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="coordination-path"
                      className="mt-1"
                      checked={config.defaultNegotiateProtocol === path.id}
                      onChange={() =>
                        setConfig((prev) => ({
                          ...prev,
                          defaultNegotiateProtocol: path.id,
                        }))
                      }
                    />
                    <div>
                      <div className="text-sm font-medium">{path.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {path.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Default notify level</Label>
              <select
                className="w-full rounded-md border px-2 py-2 text-sm bg-background"
                value={config.defaultNotifyLevel}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    defaultNotifyLevel: e.target.value as NotifyLevel,
                  }))
                }
              >
                {NOTIFY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="text-xs flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allowOverride}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    allowOverride: e.target.checked,
                  }))
                }
              />
              Allow writers to override the suggested path
            </label>
          </div>
        </section>
      </div>

  <div className="border-t px-6 py-4 flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className={saveState === "saved" ? "bg-emerald-600 hover:bg-emerald-600" : ""}
        >
          {saveState === "saved" ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Saved!
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

type FieldProps = {
  field: SenseConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
};

function SenseConfigFieldEditor({ field, value, onChange }: FieldProps) {
  const fallback = field.default;

  switch (field.type) {
    case "text":
      const textValue = (value ?? fallback ?? "") as string;
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            value={textValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description}
          />
        </div>
      );
    case "number":
      const numberValue = value ?? fallback;
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            value={numberValue === undefined ? "" : (numberValue as number)}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : Number(e.target.value))
            }
            placeholder={field.description}
          />
        </div>
      );
    case "select":
      const selectValue = (value ?? fallback ?? "") as string;
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <select
            className="w-full rounded-md border px-2 py-2 text-sm bg-background"
            value={selectValue}
            onChange={(e) => onChange(e.target.value)}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "toggle":
      const toggleValue =
        value === undefined ? Boolean(fallback) : Boolean(value);
      return (
        <label className="text-xs flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={toggleValue}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
    default:
      return null;
  }
}
