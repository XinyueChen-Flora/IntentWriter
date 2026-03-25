"use client";

import { useState } from "react";
import { getAllSenseProtocols, type SenseProtocolDefinition } from "@/platform/sense/protocol";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import Link from "next/link";

import "@/platform/sense/builtin";

export default function SensePage() {
  const protocols = getAllSenseProtocols();

  return (
    <div className="min-h-screen bg-background" style={{ fontSize: '16px' }}>
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/dev" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Developer Reference
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Sense Protocol</h1>
          <p className="text-base text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
            Sense protocols help individual writers sense and understand the coordination space.
            Each bundles functions with trigger options and an optional Gate condition.
            Users see these as toggleable capabilities — they never interact with raw functions.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* How to create */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Creating a Sense Protocol</h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            A sense protocol references registered functions (by ID), declares trigger options
            for users to choose from, and optionally defines a Gate — conditions that suggest transitioning
            to team negotiation.
          </p>

          <CodeBlock>{`import { registerSenseProtocol } from '@/platform/sense/protocol';

registerSenseProtocol({
  id: 'grammar-check',
  name: 'Grammar Check',
  description: 'Checks writing for grammar and style issues.',
  icon: 'SpellCheck',

  // Reference registered functions (by ID)
  functions: ['check-grammar', 'check-style'],

  // Trigger options for users
  triggerOptions: [
    { value: 'per-paragraph', label: 'After each paragraph' },
    { value: 'manual', label: 'Manual only' },
  ],
  defaultTrigger: 'per-paragraph',

  // No gate — grammar issues don't need team coordination
});`}</CodeBlock>

          <h3 className="text-base font-semibold mt-6 mb-2">With a Gate</h3>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            A Gate suggests transitioning to team coordination when conditions are met.
            The Gate reads function output and evaluates conditions.
          </p>

          <CodeBlock>{`registerSenseProtocol({
  id: 'impact-monitor',
  name: 'Impact Monitor',
  description: 'Monitors cross-section impact of your changes.',
  icon: 'AlertTriangle',

  functions: ['assess-impact', 'preview-writing-impact'],

  triggerOptions: [
    { value: 'on-change', label: 'When you edit the outline' },
    { value: 'manual', label: 'Manual only' },
  ],
  defaultTrigger: 'on-change',

  // Gate: when impact is cross-section, suggest team coordination
  gate: {
    conditions: [
      {
        description: 'Cross-section impact detected',
        functionId: 'assess-impact',
        field: 'impacts',
        operator: 'is-not-empty',
      },
    ],
    suggestProtocol: 'negotiate',  // suggest Team Vote
    allowOverride: true,
  },
});`}</CodeBlock>
        </section>

        {/* Registered protocols */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Registered Protocols ({protocols.length})</h2>
          <div className="space-y-3">
            {protocols.map(p => (
              <ProtocolCard key={p.id} protocol={p} />
            ))}
          </div>
          {protocols.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">No sense protocols registered.</div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Protocol Card ───

function ProtocolCard({ protocol }: { protocol: SenseProtocolDefinition }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{protocol.name}</span>
            <span className="font-mono text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{protocol.id}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{protocol.description}</div>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
          <div>
            <Label>Functions Referenced</Label>
            <div className="flex flex-wrap gap-1.5">
              {protocol.functions.map(fn => (
                <span key={fn} className="font-mono text-sm px-2 py-0.5 rounded bg-blue-50 text-blue-600">{fn}</span>
              ))}
            </div>
          </div>

          <div>
            <Label>Trigger Options</Label>
            <div className="space-y-1.5">
              {protocol.triggerOptions.map(t => (
                <div key={t.value} className="flex items-center gap-2 text-sm">
                  <span className={`font-mono px-2 py-0.5 rounded ${t.value === protocol.defaultTrigger ? 'bg-primary/10 text-primary font-medium' : 'bg-muted text-muted-foreground'}`}>
                    {t.value}
                  </span>
                  <span className="text-muted-foreground">{t.label}</span>
                  {t.value === protocol.defaultTrigger && <span className="text-sm text-primary">default</span>}
                </div>
              ))}
            </div>
          </div>


          {protocol.configFields && protocol.configFields.length > 0 && (
            <div>
              <Label>User Config</Label>
              <div className="space-y-1.5">
                {protocol.configFields.map(f => (
                  <div key={f.key} className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-medium">{f.key}</span>
                    <span className="text-muted-foreground">({f.type}) — {f.label}</span>
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
