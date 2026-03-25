"use client";

import { useState } from "react";
import { getAllCoordinationPaths, type CoordinationPathDefinition } from "@/platform/coordination/protocol";
import type { ProtocolStep } from "@/platform/protocol-types";
import { getPathUI } from "@/platform/coordination/ui";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import Link from "next/link";

import "@/platform/coordination/builtin";

export default function CoordinationPage() {
  const paths = getAllCoordinationPaths();

  return (
    <div className="min-h-screen bg-background" style={{ fontSize: '16px' }}>
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/dev" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Developer Reference
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Negotiate Protocol</h1>
          <p className="text-base text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
            Negotiate protocols define how teams negotiate changes to shared understanding.
            Each declares three stages (Propose, Deliberate, Resolve) as step sequences,
            with actions on each stage. Actions can carry their own steps for extensible interaction patterns.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* How to create */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Creating a Negotiate Protocol</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Each stage is an ordered list of steps. Steps either run functions or show stored results
            — all through the same primitive system.
            Actions can also carry steps (e.g., counter-propose triggers impact analysis).
          </p>

          <h3 className="text-base font-semibold mb-2">Step Fields</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="border rounded-lg p-3">
              <div className="text-sm font-mono font-medium text-purple-600 mb-1">run</div>
              <p className="text-sm text-muted-foreground">Execute a function and render its display bindings.</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm font-mono font-medium text-blue-600 mb-1">show</div>
              <p className="text-sm text-muted-foreground">Display a previously stored function result (no re-running).</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm font-mono font-medium text-emerald-600 mb-1">params</div>
              <p className="text-sm text-muted-foreground">Parameters to pass to the function.</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-sm font-mono font-medium text-amber-600 mb-1">actions</div>
              <p className="text-sm text-muted-foreground">Action buttons to show after this step.</p>
            </div>
          </div>

          <CodeBlock>{`import { registerCoordinationPath } from '@/platform/coordination/protocol';

registerCoordinationPath({
  id: 'expert-review',
  name: 'Expert Review',
  description: 'A designated expert reviews and decides.',
  icon: 'GraduationCap',
  color: 'violet',

  functions: ['frame-proposal', 'assess-impact', 'preview-writing-impact', 'check-single-approval'],

  propose: {
    who: 'proposer',
    steps: [
      { run: 'render-draft' },
      { run: 'assess-impact' },
    ],
  },

  deliberate: {
    who: '{{config.expertId}}',
    steps: [
      { show: 'frame-proposal' },
      { run: 'preview-writing-impact' },
    ],
    actions: [
      { id: 'approve', label: 'Approve', who: ['expert'] },
      { id: 'reject', label: 'Reject', who: ['expert'] },
    ],
  },

  resolve: {
    who: 'system',
    steps: [
      { run: 'check-single-approval' },
    ],
    actions: [
      { id: 'apply', label: 'Apply Changes', steps: [{ run: 'apply-proposal' }] },
    ],
  },

  config: {
    expertId: { type: 'select', label: 'Designated expert', options: [] },
  },
});`}</CodeBlock>
        </section>

        {/* Registered protocols */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Registered Protocols ({paths.length})</h2>
          <div className="space-y-3">
            {paths.map(path => (
              <PathCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Path Card ───

function PathCard({ path }: { path: CoordinationPathDefinition }) {
  const [open, setOpen] = useState(false);
  const ui = getPathUI(path.id);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        {ui && <ui.Icon className={`h-5 w-5 ${ui.textColor}`} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{path.name}</span>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{path.id}</span>
            <span className="text-sm font-mono text-muted-foreground">resolve: {path.resolve.who}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{path.description}</div>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
          {/* Stage Steps */}
          {(['propose', 'deliberate', 'resolve'] as const).map(stage => (
            <div key={stage}>
              <Label>{stage.charAt(0).toUpperCase() + stage.slice(1)} (who: {path[stage].who}, {path[stage].steps.length} steps)</Label>
              <StepList steps={path[stage].steps} />
              {path[stage].actions && path[stage].actions!.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground font-medium">Actions:</span>
                  <div className="space-y-1 mt-1">
                    {path[stage].actions!.map(action => (
                      <div key={action.id ?? action.label} className="text-sm flex items-center gap-2">
                        <span className="font-mono font-medium">{action.id ?? '-'}</span>
                        <span className="text-muted-foreground">{action.label}</span>
                        {action.who && <span className="text-muted-foreground text-xs">[{action.who.join(', ')}]</span>}
                        {action.steps && action.steps.length > 0 && (
                          <span className="text-xs text-muted-foreground">({action.steps.length} sub-steps)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Config */}
          {path.config && Object.keys(path.config).length > 0 && (
            <div>
              <Label>Config</Label>
              <div className="space-y-1">
                {Object.entries(path.config).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-medium">{key}</span>
                    <span className="text-muted-foreground">{cfg.label ?? '-'}</span>
                    {cfg.default !== undefined && (
                      <span className="font-mono text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        default: {String(cfg.default)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step List ───

function StepList({ steps }: { steps: ProtocolStep[] }) {
  if (steps.length === 0) return <span className="text-sm text-muted-foreground">none</span>;

  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-sm font-mono">
          <span className="text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}.</span>
          {step.run && (
            <>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-600">run</span>
              <span>{step.run}</span>
            </>
          )}
          {step.show && (
            <>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600">show</span>
              <span>{step.show}</span>
            </>
          )}
          {step.when && <span className="text-muted-foreground text-xs">when: {step.when}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">{children}</div>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-3">
      <Highlight theme={themes.vsLight} code={children.trim()} language="typescript">
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={{ ...style, margin: 0, padding: '16px', fontSize: '14px', lineHeight: 1.6, overflow: 'auto' }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
