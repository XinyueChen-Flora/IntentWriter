"use client";

import React, { useState, useCallback, useEffect } from "react";
import { getAllFunctions, registerFunction, getFunction, type FunctionDefinition, type FunctionResult } from "@/platform/functions/protocol";
import { runFunction } from "@/platform/functions/runner";
import { resolveBindings, groupByLocation, type ResolvedPrimitive } from "@/platform/primitives/resolver";
import { PrimitiveRenderer } from "@/components/capability/PrimitiveRenderer";
import type { DocumentSnapshot } from "@/platform/data-model";
import { ChevronDown, ChevronRight, FlaskConical, ArrowLeft, Copy, Check, Code2, Play, Eye, Plus } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import Link from "next/link";

import "@/platform/functions/builtin";

// ═══════════════════════════════════════════════════════
// MOCK SNAPSHOT
// ═══════════════════════════════════════════════════════

const now = Date.now();
const mockAttr = { userId: 'user-1', userName: 'Alice', at: now };
const MOCK_SNAPSHOT: DocumentSnapshot = {
  documentId: 'mock-doc',
  phase: 'writing',
  currentUserId: 'user-1',
  nodes: [
    { id: 'sec-1', content: 'Introduction: Motivation and research questions', position: 0, parentId: null, level: 0, createdBy: mockAttr },
    { id: 'sec-1-1', content: 'Collaborative writing is challenging because teams must maintain shared understanding', position: 0, parentId: 'sec-1', level: 1, createdBy: mockAttr },
    { id: 'sec-1-2', content: 'Current tools lack semantic awareness of author intentions', position: 1, parentId: 'sec-1', level: 1, createdBy: mockAttr },
    { id: 'sec-2', content: 'Related Work: Previous approaches to collaborative editing', position: 1, parentId: null, level: 0, createdBy: mockAttr },
    { id: 'sec-2-1', content: 'Real-time collaboration systems', position: 0, parentId: 'sec-2', level: 1, createdBy: mockAttr },
  ],
  writing: [
    { sectionId: 'sec-1', html: '', text: 'Collaborative writing is one of the most common forms of knowledge work. When multiple authors work on a shared document, they must continuously negotiate what to write, how to organize it, and how individual contributions fit together. This negotiation is the essence of collaborative writing — yet current tools provide almost no support for it.', wordCount: 55, paragraphs: [] },
    { sectionId: 'sec-2', html: '', text: 'Previous work on collaborative writing has focused primarily on conflict resolution at the text level. Systems like Google Docs provide real-time synchronization but lack semantic awareness.', wordCount: 30, paragraphs: [] },
  ],
  dependencies: [
    { id: 'dep-1', fromId: 'sec-1', toId: 'sec-2', type: 'supports', label: 'Introduction motivates related work', direction: 'directed', source: 'manual', confirmed: true, createdBy: mockAttr },
  ],
  assignments: [
    { sectionId: 'sec-1', assigneeId: 'user-1', assigneeName: 'Alice', assignedAt: now },
    { sectionId: 'sec-2', assigneeId: 'user-2', assigneeName: 'Bob', assignedAt: now },
  ],
  members: [
    { userId: 'user-1', name: 'Alice', role: 'owner', email: 'alice@example.com', joinedAt: now },
    { userId: 'user-2', name: 'Bob', role: 'editor', email: 'bob@example.com', joinedAt: now },
  ],
};

// ═══════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════

export default function FunctionsPage() {
  const [functions, setFunctions] = useState(getAllFunctions);
  const [activeTab, setActiveTab] = useState<'spec' | 'register' | 'catalog'>('spec');

  const refresh = useCallback(() => setFunctions(getAllFunctions()), []);

  return (
    <div className="min-h-screen bg-background" style={{ fontSize: '16px' }}>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Link href="/dev" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Developer Reference
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Function Protocol</h1>
          <p className="text-base text-muted-foreground mt-1.5 max-w-3xl leading-relaxed">
            Functions are atomic computational capabilities — the shared building blocks that both
            Sense and Negotiate protocols reference. A function takes a DocumentSnapshot as input,
            runs an executor, and produces structured output with display bindings.
          </p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 flex gap-0">
          <TabBtn active={activeTab === 'spec'} onClick={() => setActiveTab('spec')}>Specification</TabBtn>
          <TabBtn active={activeTab === 'register'} onClick={() => setActiveTab('register')}>Register &amp; Test</TabBtn>
          <TabBtn active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')}>Catalog ({functions.length})</TabBtn>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'spec' && <SpecTab />}
        {activeTab === 'register' && <RegisterTab onRegistered={refresh} />}
        {activeTab === 'catalog' && <CatalogTab functions={functions} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 1: SPECIFICATION
// ═══════════════════════════════════════════════════════

function SpecTab() {
  return (
    <div className="space-y-10 max-w-3xl">
      {/* Overview */}
      <Section title="Overview">
        <p>A function declares three concerns:</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li><strong>Executor</strong> — how to compute (AI prompt, JavaScript function, or API call)</li>
          <li><strong>Output</strong> — what it produces (typed schema)</li>
          <li><strong>Display</strong> — how to render (bindings to <Link href="/dev/foundation" className="text-primary underline">UI primitives</Link>)</li>
        </ol>
        <p className="mt-3">
          Functions do not declare <em>when</em> they run or <em>who</em> invokes them — that is
          defined by <Link href="/dev/sense" className="text-primary underline">Sense</Link> and <Link href="/dev/coordination" className="text-primary underline">Negotiate</Link> protocols
          that reference them.
        </p>
      </Section>

      {/* registerFunction API */}
      <Section title="registerFunction(definition)">
        <p className="mb-4">Register a function by calling <code>registerFunction()</code> with a definition object.</p>
        <FieldTable fields={[
          ['id', 'string', 'required', 'Unique identifier (e.g., "check-drift")'],
          ['name', 'string', 'required', 'Display name'],
          ['description', 'string', 'required', 'Brief description of what it does'],
          ['icon', 'string', 'required', 'Lucide icon name'],
          ['executor', '"prompt" | "local" | "api"', 'required', 'How to compute'],
          ['prompt', '{ system, user, model?, temperature? }', 'if executor="prompt"', 'AI prompt template. Use {{nodes}}, {{writing}}, {{dependencies}}, {{focus}}, {{config}} in user template.'],
          ['fn', '(input: FunctionInput) => FunctionResult', 'if executor="local"', 'JavaScript function that runs in the browser'],
          ['endpoint', 'string', 'if executor="api"', 'HTTP endpoint to POST to'],
          ['requires', '{ writing?, dependencies?, members? }', 'required', 'Which snapshot fields are needed'],
          ['outputSchema', 'Record<string, string>', 'required', 'Shape of the output data'],
          ['ui', 'UIBinding[]', 'required', 'Display bindings — maps output to UI primitives'],
          ['configFields', 'ConfigField[]', 'required', 'Config fields (can be empty [])'],
          ['defaultConfig', 'Record<string, unknown>', 'required', 'Default config values (can be {})'],
          ['dependsOn', 'string[]', 'optional', 'IDs of functions whose stored results this function can read'],
        ]} />
      </Section>

      {/* Executor types */}
      <Section title="Executor Types">
        <div className="space-y-4">
          <ExecutorDoc
            type="prompt"
            color="purple"
            description="Sends a prompt to an AI model. The platform fills template variables, calls the AI, and parses JSON output."
            example={`executor: 'prompt',
prompt: {
  system: 'You analyze writing alignment. Return valid JSON only.',
  user: \`## Outline
{{nodes}}

## Writing
{{writing}}

Analyze alignment and return:
{ level: "aligned"|"partial"|"drifted", summary: "..." }\`,
  model: 'gpt-4o',       // optional, default: gpt-4o
  temperature: 0.3,       // optional, default: 0.3
},`}
            variables={[
              ['{{nodes}}', 'Formatted outline nodes with IDs, content, and owners'],
              ['{{writing}}', 'Writing content per section with word counts'],
              ['{{dependencies}}', 'Dependency relationships between nodes'],
              ['{{focus}}', 'The FunctionFocus object (sectionId, proposedChanges, etc.)'],
              ['{{config}}', 'User-configured parameters'],
            ]}
          />
          <ExecutorDoc
            type="local"
            color="emerald"
            description="Runs a JavaScript function in the browser. For rule-based checks or aggregating stored results from other functions."
            example={`executor: 'local',
fn: async (input) => {
  const coverage = input.snapshot.writing.length;
  const total = input.snapshot.nodes.filter(n => !n.parentId).length;
  return {
    data: {
      coveragePercent: total > 0 ? (coverage / total) * 100 : 0,
      missingSections: total - coverage,
    },
  };
},`}
          />
          <ExecutorDoc
            type="api"
            color="blue"
            description="POSTs the input to an external HTTP endpoint. For custom backends or third-party services."
            example={`executor: 'api',
endpoint: '/api/my-custom-check',
// The platform POSTs { snapshot, focus, config } to this endpoint
// and expects { result: { ... } } in the response.`}
          />
        </div>
      </Section>

      {/* Display bindings */}
      <Section title="Display Bindings (ui)">
        <p className="mb-3">
          The <code>ui</code> array maps output fields to <Link href="/dev/foundation" className="text-primary underline">UI primitives</Link>.
          Each binding declares a primitive type and template params. The platform resolves templates and renders.
        </p>

        <h4 className="font-semibold mt-4 mb-2">Scalar binding (show one primitive)</h4>
        <CodeBlock>{`{
  type: 'banner',
  when: 'level === "drifted"',   // optional condition
  params: {
    title: 'Drift detected',
    message: '{{summary}}',       // template: filled from output.summary
    severity: 'warning',
  },
}`}</CodeBlock>

        <h4 className="font-semibold mt-4 mb-2">Array binding (one primitive per item)</h4>
        <CodeBlock>{`{
  type: 'node-icon',
  forEach: 'alignedIntents',                          // iterate over output.alignedIntents[]
  filter: 'item.coverageStatus !== "covered"',        // optional filter
  params: {
    nodeId: '{{item.id}}',
    status: '{{item.coverageStatus}}',
    tooltip: '{{item.coverageNote}}',
  },
}`}</CodeBlock>

        <h4 className="font-semibold mt-4 mb-2">Available primitive types</h4>
        <p className="text-muted-foreground mb-2">
          See <Link href="/dev/foundation" className="text-primary underline">Foundation → UI Primitives</Link> for
          the complete list of 15 primitives with parameters and live previews.
        </p>
      </Section>

      {/* Complete example */}
      <Section title="Complete Example">
        <CodeBlock>{`import { registerFunction } from '@/platform/functions/protocol';

registerFunction({
  id: 'check-drift',
  name: 'Drift Detection',
  description: 'Compares writing against outline to detect coverage and drift.',
  icon: 'Eye',

  executor: 'prompt',
  prompt: {
    system: 'You analyze alignment between writing and outline...',
    user: '## Outline\\n{{nodes}}\\n\\n## Writing\\n{{writing}}\\n\\nReturn JSON...',
    temperature: 0.2,
  },

  requires: { writing: true },
  outputSchema: {
    level: "'aligned' | 'partial' | 'drifted'",
    alignedIntents: 'Array<{ id, coverageStatus, coverageNote, sentences }>',
    summary: 'string',
  },

  ui: [
    { type: 'node-icon', forEach: 'alignedIntents',
      params: { nodeId: '{{item.id}}', status: '{{item.coverageStatus}}' } },
    { type: 'banner', when: 'level === "drifted"',
      params: { title: 'Drift detected', message: '{{summary}}', severity: 'warning' } },
  ],

  configFields: [],
  defaultConfig: {},
  dependsOn: [],
});`}</CodeBlock>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB 2: REGISTER & TEST
// ═══════════════════════════════════════════════════════

function RegisterTab({ onRegistered }: { onRegistered: () => void }) {
  const [code, setCode] = useState(TEMPLATE_CODE);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const handleRegister = () => {
    setError(null);
    setRegistered(false);
    setTestResult(null);
    setTestError(null);
    try {
      const stripped = code.replace(/import.*from.*;\n?/g, '');
      const fn = new Function('registerFunction', stripped);
      fn(registerFunction);
      setRegistered(true);
      onRegistered();

      // Extract ID from code
      const idMatch = code.match(/id:\s*['"]([^'"]+)['"]/);
      if (idMatch) setRegisteredId(idMatch[1]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleTestRun = async () => {
    if (!registeredId) return;
    setTestRunning(true);
    setTestResult(null);
    setTestError(null);
    try {
      const func = getFunction(registeredId);
      const result = await runFunction(registeredId, {
        snapshot: MOCK_SNAPSHOT,
        config: func?.defaultConfig ?? {},
      });
      const resolved = resolveBindings(result.ui, result.data);
      setTestResult({ data: result.data, resolved });
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Register a Custom Function">
        <p className="mb-3">
          Paste your <code>registerFunction()</code> call below. The function will be registered in the
          current session. After registering, you can test it with mock data.
        </p>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">registerFunction()</span>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" /> Register
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => { setCode(e.target.value); setRegistered(false); }}
            className="w-full font-mono text-sm p-4 bg-background border-none resize-none focus:outline-none"
            rows={20}
            spellCheck={false}
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {registered && (
          <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center justify-between">
            <span><strong>Registered!</strong> Function &quot;{registeredId}&quot; is now available.</span>
            <button
              onClick={handleTestRun}
              disabled={testRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border bg-background hover:bg-muted/50 disabled:opacity-40"
            >
              <FlaskConical className="h-4 w-4" />
              {testRunning ? 'Running...' : 'Test Run'}
            </button>
          </div>
        )}

        {testError && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-mono">
            {testError}
          </div>
        )}

        {testResult && (
          <div className="space-y-4">
            {testResult.resolved.length > 0 && (
              <div>
                <Label>Rendered Output ({testResult.resolved.length} primitives)</Label>
                <div className="border rounded-lg p-4 bg-background">
                  <PrimitiveRenderer primitives={testResult.resolved} />
                </div>
              </div>
            )}
            <div>
              <Label>Raw Output</Label>
              <pre className="text-sm font-mono bg-muted/30 rounded-lg px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Section>

      <Section title="Mock Data">
        <p className="mb-3 text-muted-foreground">Test runs use this mock DocumentSnapshot:</p>
        <details className="border rounded-lg overflow-hidden">
          <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">View mock snapshot</summary>
          <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-80 overflow-y-auto border-t">
            {JSON.stringify(MOCK_SNAPSHOT, null, 2)}
          </pre>
        </details>
      </Section>
    </div>
  );
}

const TEMPLATE_CODE = `registerFunction({
  id: 'my-custom-check',
  name: 'My Custom Check',
  description: 'Describe what this function checks or analyzes.',
  icon: 'Search',

  executor: 'local',
  fn: async (input) => {
    const sectionCount = input.snapshot.nodes.filter(n => !n.parentId).length;
    const wordCount = input.snapshot.writing.reduce((sum, w) => sum + w.wordCount, 0);
    return {
      data: {
        sectionCount,
        wordCount,
        avgWordsPerSection: sectionCount > 0 ? Math.round(wordCount / sectionCount) : 0,
        status: wordCount > 50 ? 'good' : 'needs-more',
      },
    };
  },

  requires: { writing: true },
  outputSchema: {
    sectionCount: 'number',
    wordCount: 'number',
    avgWordsPerSection: 'number',
    status: "'good' | 'needs-more'",
  },

  ui: [
    {
      type: 'banner',
      when: 'status === "needs-more"',
      params: {
        title: 'Writing is short',
        message: '{{wordCount}} words across {{sectionCount}} sections',
        severity: 'warning',
      },
    },
    {
      type: 'summary-bar',
      params: {
        level: '{{status}}',
        counts: '{"sections": {{sectionCount}}, "words": {{wordCount}}}',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});`;

// ═══════════════════════════════════════════════════════
// TAB 3: CATALOG
// ═══════════════════════════════════════════════════════

function CatalogTab({ functions }: { functions: FunctionDefinition[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-2xl">
        All registered functions. Expand to see executor details, output schema, display bindings, and test with mock data.
      </p>
      <div className="space-y-3">
        {functions.map(func => (
          <FunctionCard key={func.id} func={func} />
        ))}
      </div>
      {functions.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">No functions registered.</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FUNCTION CARD
// ═══════════════════════════════════════════════════════

function FunctionCard({ func }: { func: FunctionDefinition }) {
  const [open, setOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  const handleTestRun = async () => {
    setTestRunning(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await runFunction(func.id, { snapshot: MOCK_SNAPSHOT, config: func.defaultConfig });
      const resolved = resolveBindings(result.ui, result.data);
      setTestResult({ data: result.data, resolved });
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-medium">{func.name}</span>
            <code className="text-sm text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{func.id}</code>
            <span className={`text-sm font-mono px-2 py-0.5 rounded ${
              func.executor === 'prompt' ? 'bg-purple-50 text-purple-600' :
              func.executor === 'local' ? 'bg-emerald-50 text-emerald-600' :
              'bg-blue-50 text-blue-600'
            }`}>{func.executor}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{func.description}</div>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
          {/* Quick info row */}
          <div className="flex flex-wrap gap-6">
            {func.dependsOn && func.dependsOn.length > 0 && (
              <div>
                <Label>Depends On</Label>
                <div className="flex gap-1">
                  {func.dependsOn.map(dep => (
                    <code key={dep} className="text-sm px-2 py-0.5 rounded bg-muted border">{dep}</code>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Requires</Label>
              <div className="flex gap-1.5">
                {Object.entries(func.requires).filter(([, v]) => v).map(([key]) => (
                  <code key={key} className="text-sm px-2 py-0.5 rounded bg-primary/5 border border-primary/20">{key}</code>
                ))}
                {Object.values(func.requires).every(v => !v) && <span className="text-sm text-muted-foreground">outline only</span>}
              </div>
            </div>
          </div>

          {/* Output Schema */}
          <div>
            <Label>Output Schema</Label>
            <pre className="text-sm font-mono bg-muted/30 rounded-lg px-3 py-2.5 overflow-x-auto">{JSON.stringify(func.outputSchema, null, 2)}</pre>
          </div>

          {/* Display Bindings */}
          {func.ui.length > 0 && (
            <div>
              <Label>Display Bindings ({func.ui.length})</Label>
              <div className="space-y-1.5">
                {func.ui.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono flex-wrap">
                    <span className={`px-2 py-0.5 rounded ${
                      u.type.includes('banner') ? 'bg-amber-50 text-amber-600' :
                      u.type.includes('node') ? 'bg-emerald-50 text-emerald-600' :
                      u.type.includes('result') ? 'bg-indigo-50 text-indigo-600' :
                      u.type.includes('diff') ? 'bg-purple-50 text-purple-600' :
                      'bg-muted text-muted-foreground'
                    }`}>{u.type}</span>
                    {u.forEach && <span className="text-muted-foreground">forEach: {u.forEach}</span>}
                    {u.filter && <span className="text-muted-foreground">filter: {u.filter}</span>}
                    {u.when && <span className="text-muted-foreground">when: {u.when}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions: Test + View Source */}
          <div className="pt-3 border-t flex gap-2">
            <button
              onClick={handleTestRun}
              disabled={testRunning}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted/50 disabled:opacity-40"
            >
              <FlaskConical className="h-4 w-4" />
              {testRunning ? 'Running...' : 'Test Run'}
            </button>
            <button
              onClick={() => setShowSource(!showSource)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted/50"
            >
              <Code2 className="h-4 w-4" />
              {showSource ? 'Hide Source' : 'View Source'}
            </button>
          </div>

          {/* Source */}
          {showSource && (
            <div>
              <Label>Registration Source</Label>
              <pre className="text-sm font-mono bg-muted/30 rounded-lg px-4 py-3 overflow-x-auto max-h-80 overflow-y-auto">
                {`registerFunction(${JSON.stringify({
                  id: func.id,
                  name: func.name,
                  description: func.description,
                  icon: func.icon,
                  executor: func.executor,
                  requires: func.requires,
                  outputSchema: func.outputSchema,
                  ui: func.ui,
                  configFields: func.configFields,
                  defaultConfig: func.defaultConfig,
                  dependsOn: func.dependsOn,
                }, null, 2)})`}
              </pre>
            </div>
          )}

          {/* Test results */}
          {testError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-mono">{testError}</div>
          )}
          {testResult && (
            <div className="space-y-3">
              {testResult.resolved.length > 0 && (
                <div>
                  <Label>Rendered Output ({testResult.resolved.length} primitives)</Label>
                  <div className="border rounded-lg p-4 bg-background">
                    <PrimitiveRenderer primitives={testResult.resolved} />
                  </div>
                </div>
              )}
              <details className="border rounded-lg overflow-hidden">
                <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">Raw output</summary>
                <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto border-t">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}>{children}</button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{children}</div>;
}

function FieldTable({ fields }: { fields: [string, string, string, string][] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b">
            <th className="text-left px-4 py-2 font-semibold">Field</th>
            <th className="text-left px-4 py-2 font-semibold">Type</th>
            <th className="text-left px-4 py-2 font-semibold w-20">Required</th>
            <th className="text-left px-4 py-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {fields.map(([name, type, req, desc]) => (
            <tr key={name}>
              <td className="px-4 py-2.5 font-mono font-medium align-top">{name}</td>
              <td className="px-4 py-2.5 font-mono text-muted-foreground align-top">{type}</td>
              <td className="px-4 py-2.5 text-muted-foreground align-top">{req}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecutorDoc({ type, color, description, example, variables }: {
  type: string; color: string; description: string; example: string;
  variables?: [string, string][];
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/20 border-b">
        <span className={`text-sm font-mono font-medium px-2 py-0.5 rounded bg-${color}-50 text-${color}-600`}>{type}</span>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="px-4 py-3">
        <CodeBlock>{example}</CodeBlock>
        {variables && (
          <div className="mt-3">
            <div className="text-sm font-semibold text-muted-foreground mb-1">Template Variables</div>
            <div className="space-y-0.5">
              {variables.map(([v, desc]) => (
                <div key={v} className="flex items-start gap-2 text-sm">
                  <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded flex-shrink-0">{v}</code>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-2">
      <Highlight theme={themes.vsLight} code={children.trim()} language="typescript">
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={{ ...style, margin: 0, padding: '14px', fontSize: '14px', lineHeight: 1.6, overflow: 'auto' }}>
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
