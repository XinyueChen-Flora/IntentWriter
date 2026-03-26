"use client";

import { useState } from "react";
import { getAllGates, type GateDefinition } from "@/platform/gate/protocol";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import Link from "next/link";

import "@/platform/gate/builtin";

export default function GatePage() {
  const gates = getAllGates();

  return (
    <div className="min-h-screen bg-background" style={{ fontSize: '16px' }}>
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/dev" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Developer Reference
          </Link>
          <h1 className="text-2xl font-bold">Gate Protocols</h1>
          <p className="text-muted-foreground mt-1">
            {gates.length} registered gate(s). Gates sit between Sense and Negotiate, routing proposals to the right coordination path.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {gates.map((gate) => (
          <GateCard key={gate.id} gate={gate} />
        ))}
      </main>
    </div>
  );
}

function GateCard({ gate }: { gate: GateDefinition }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex-1">
          <div className="font-semibold">{gate.name}</div>
          <div className="text-sm text-muted-foreground">{gate.description}</div>
        </div>
        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{gate.id}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t pt-4">
          {/* Routes */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Routes to</div>
            <div className="flex gap-2 flex-wrap">
              {gate.routes.map((r) => (
                <span key={r} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{r}</span>
              ))}
            </div>
          </div>

          {/* Reads */}
          {gate.reads.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Reads from</div>
              <div className="flex gap-2 flex-wrap">
                {gate.reads.map((r) => (
                  <span key={r} className="text-xs bg-muted px-2 py-1 rounded font-mono">{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Default Rules */}
          {gate.defaultRules.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Default Rules</div>
              <div className="space-y-1">
                {gate.defaultRules.map((rule, i) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <span className="text-primary">→</span>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{rule.then}</span>
                    <span className="text-muted-foreground">{rule.description}</span>
                  </div>
                ))}
                <div className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{gate.defaultRoute}</span>
                  <span className="text-muted-foreground">default</span>
                </div>
              </div>
            </div>
          )}

          {/* Steps */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Steps ({gate.steps.length})</div>
            <Highlight theme={themes.vsLight} code={JSON.stringify(gate.steps, null, 2)} language="json">
              {({ style, tokens, getLineProps, getTokenProps }) => (
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto" style={style}>
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
        </div>
      )}
    </div>
  );
}
