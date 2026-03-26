"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { getAllFunctions, registerFunction, getFunction, type FunctionDefinition } from "@/platform/functions/protocol";
import { runFunction } from "@/platform/functions/runner";
import { resolveBindings, groupByLocation, type ResolvedPrimitive } from "@/platform/primitives/resolver";
import { getAllPrimitives, type PrimitiveDefinition } from "@/platform/primitives/registry";
import { getAllSenseProtocols, registerSenseProtocol, type SenseProtocolDefinition } from "@/platform/sense/protocol";
import { getAllCoordinationPaths, registerCoordinationPath, type CoordinationPathDefinition } from "@/platform/coordination/protocol";
import { getAllGates, type GateDefinition } from "@/platform/gate/protocol";
import "@/platform/gate/builtin";
import type { ProtocolStep } from "@/platform/protocol-types";
import { getPathUI } from "@/platform/coordination/ui";
import { PrimitiveRenderer } from "@/components/capability/PrimitiveRenderer";
import type { DocumentSnapshot } from "@/platform/data-model";
import { ChevronDown, ChevronRight, FlaskConical, Code2, Plus, Layers, Eye, Users, Code, Play } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";

import "@/platform/functions/builtin";
import "@/platform/sense/builtin";
import "@/platform/coordination/builtin";

// ═══════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════

const now = Date.now();
const mockAttr = { userId: 'user-1', userName: 'Alice', at: now };
const mockAttr2 = { userId: 'user-2', userName: 'Bob', at: now };
const MOCK_SNAPSHOT: DocumentSnapshot = {
  documentId: 'mock-doc', phase: 'writing', currentUserId: 'user-1',
  nodes: [
    // Section 1: Introduction (Alice)
    { id: 'sec-1', content: 'Introduction: Motivation and research questions for collaborative writing support', position: 0, parentId: null, level: 0, createdBy: mockAttr },
    { id: 'sec-1-1', content: 'Collaborative writing is challenging because teams must maintain shared understanding of what to write', position: 0, parentId: 'sec-1', level: 1, createdBy: mockAttr },
    { id: 'sec-1-2', content: 'Current tools lack semantic awareness of author intentions and cross-section dependencies', position: 1, parentId: 'sec-1', level: 1, createdBy: mockAttr },
    { id: 'sec-1-3', content: 'We propose intent-level coordination as a new paradigm for collaborative writing', position: 2, parentId: 'sec-1', level: 1, createdBy: mockAttr },
    // Section 2: Related Work (Bob)
    { id: 'sec-2', content: 'Related Work: Previous approaches to collaborative editing and coordination', position: 1, parentId: null, level: 0, createdBy: mockAttr2 },
    { id: 'sec-2-1', content: 'Real-time collaborative editing systems and their limitations', position: 0, parentId: 'sec-2', level: 1, createdBy: mockAttr2 },
    { id: 'sec-2-2', content: 'Awareness and coordination in CSCW literature', position: 1, parentId: 'sec-2', level: 1, createdBy: mockAttr2 },
    // Section 3: System (Alice)
    { id: 'sec-3', content: 'System Design: Architecture and implementation', position: 2, parentId: null, level: 0, createdBy: mockAttr },
    { id: 'sec-3-1', content: 'Living outline as the shared understanding representation', position: 0, parentId: 'sec-3', level: 1, createdBy: mockAttr },
  ],
  writing: [
    { sectionId: 'sec-1', html: '', text: 'Collaborative writing is one of the most common forms of knowledge work. When multiple authors work on a shared document, they must continuously negotiate what to write, how to organize it, and how individual contributions fit together. This negotiation is the essence of collaborative writing — yet current tools provide almost no support for it. Existing systems like Google Docs and Notion offer real-time text synchronization, but they operate entirely at the character level without understanding what each author intends to communicate. We argue that a fundamentally different approach is needed: one that separates shared understanding from individual writing, makes cross-section dependencies explicit, and provides structured coordination when conflicts arise.', wordCount: 112, paragraphs: [] },
    { sectionId: 'sec-2', html: '', text: 'Previous work on collaborative writing has focused primarily on conflict resolution at the text level. Systems like Google Docs provide real-time synchronization using operational transformation, while newer tools like Notion use block-based editing. However, these approaches treat writing as a sequence of characters rather than a structured expression of team intent. The CSCW literature has long recognized the importance of awareness in collaboration, but existing frameworks focus on presence awareness rather than semantic awareness of how individual work relates to team goals.', wordCount: 85, paragraphs: [] },
    { sectionId: 'sec-3', html: '', text: 'Our system introduces a three-layer architecture built around a living outline that serves as the team\'s shared understanding.', wordCount: 20, paragraphs: [] },
  ],
  dependencies: [
    { id: 'dep-1', fromId: 'sec-1', toId: 'sec-2', type: 'supports', label: 'Introduction motivates related work', direction: 'directed', source: 'manual', confirmed: true, createdBy: mockAttr },
    { id: 'dep-2', fromId: 'sec-2', toId: 'sec-3', type: 'supports', label: 'Related work gaps motivate system design', direction: 'directed', source: 'manual', confirmed: true, createdBy: mockAttr2 },
    { id: 'dep-3', fromId: 'sec-1-3', toId: 'sec-3-1', type: 'depends-on', label: 'Proposal connects to implementation', direction: 'directed', source: 'ai-suggested', confirmed: true, createdBy: mockAttr },
  ],
  assignments: [
    { sectionId: 'sec-1', assigneeId: 'user-1', assigneeName: 'Alice', assignedAt: now },
    { sectionId: 'sec-2', assigneeId: 'user-2', assigneeName: 'Bob', assignedAt: now },
    { sectionId: 'sec-3', assigneeId: 'user-1', assigneeName: 'Alice', assignedAt: now },
  ],
  members: [
    { userId: 'user-1', name: 'Alice', role: 'owner', email: 'alice@example.com', joinedAt: now },
    { userId: 'user-2', name: 'Bob', role: 'editor', email: 'bob@example.com', joinedAt: now },
    { userId: 'user-3', name: 'Carol', role: 'editor', email: 'carol@example.com', joinedAt: now },
  ],
};

// Preview primitives for Foundation
const PREVIEW_PRIMITIVES: Record<string, ResolvedPrimitive> = {
  'banner': { type: 'banner', location: 'global', params: { title: 'Drift detected', message: 'Writing has diverged from the outline.', severity: 'warning' } },
  'node-icon': { type: 'node-icon', location: 'outline-node', params: { nodeId: 'sec-1', status: 'partial', tooltip: '2 of 4 covered' } },
  'node-badge': { type: 'node-badge', location: 'outline-node', params: { nodeId: 'sec-1', label: 'modified', variant: 'modified' } },
  'section-alert': { type: 'section-alert', location: 'outline-node', params: { sectionId: 'sec-2', title: 'Cross-section conflict', message: 'Changes conflict with Method section.', severity: 'warning' } },
  'summary-bar': { type: 'summary-bar', location: 'outline-node', params: { level: 'partial', counts: '{"covered":3,"partial":2,"missing":1}' } },
  'sentence-highlight': { type: 'sentence-highlight', location: 'writing-editor', params: { startAnchor: 'Collaborative writing is one of...', color: 'yellow', tooltip: 'Partially covers intent' } },
  'issue-dot': { type: 'issue-dot', location: 'writing-editor', params: { anchor: 'This negotiation...', type: 'orphan', index: '1', detail: 'No matching intent' } },
  'inline-widget': { type: 'inline-widget', location: 'writing-editor', params: { variant: 'suggestion', content: 'Consider adding content about synchronization.', intentRef: 'sec-1-2' } },
  'ai-marker': { type: 'ai-marker', location: 'writing-editor', params: { startAnchor: 'AI-generated paragraph...' } },
  'result-list': { type: 'result-list', location: 'right-panel', params: { title: 'Method Section', badge: 'significant', badgeVariant: 'warning', detail: 'Research question change affects system design.' } },
  'diff-view': { type: 'diff-view', location: 'right-panel', params: { before: 'The system uses a centralized architecture.', after: 'The system uses a distributed architecture with CRDTs.' } },
  'action-group': { type: 'action-group', location: 'right-panel', params: { actions: JSON.stringify([{ label: 'Propose Change', action: 'propose', variant: 'primary' }, { label: 'Dismiss', action: 'dismiss', variant: 'default' }]) } },
  'text-input': { type: 'text-input', location: 'right-panel', params: { label: 'What changed?', placeholder: 'Explain your reasoning...', action: 'set-reasoning', rows: '2' } },
  'comment-thread': { type: 'comment-thread', location: 'right-panel', params: { author: 'Alice', action: 'approve', text: 'Looks good.' } },
  'progress-bar': { type: 'progress-bar', location: 'right-panel', params: { current: '3', total: '5', label: '3/5 approved', variant: 'success' } },
};

type MajorTab = 'foundation' | 'functions' | 'sense' | 'gate' | 'negotiate';

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function DevPage() {
  const [tab, setTab] = useState<MajorTab>('foundation');
  const [functions, setFunctions] = useState(getAllFunctions);
  const [senseProtocols, setSenseProtocols] = useState(getAllSenseProtocols);
  const [coordinationPaths, setCoordinationPaths] = useState(getAllCoordinationPaths);
  const refresh = useCallback(() => setFunctions(getAllFunctions()), []);
  const refreshSense = useCallback(() => setSenseProtocols(getAllSenseProtocols()), []);
  const refreshCoordination = useCallback(() => setCoordinationPaths(getAllCoordinationPaths()), []);

  // Load saved custom functions on mount
  useEffect(() => {
    fetch('/api/dev/save-function?type=function')
      .then(res => res.json())
      .then(({ functions: saved }) => {
        if (!saved?.length) return;
        let count = 0;
        for (const { code } of saved as Array<{ id: string; code: string }>) {
          try {
            const stripped = code.replace(/import.*from.*;\n?/g, '');
            new Function('registerFunction', stripped)(registerFunction);
            count++;
          } catch (e) { console.warn('[dev] Failed to load custom function:', e); }
        }
        if (count > 0) setFunctions(getAllFunctions());
      })
      .catch(() => {});
  }, []);

  // Load saved custom sense protocols on mount
  useEffect(() => {
    fetch('/api/dev/save-function?type=sense')
      .then(res => res.json())
      .then(({ functions: saved }) => {
        if (!saved?.length) return;
        let count = 0;
        for (const { code } of saved as Array<{ id: string; code: string }>) {
          try {
            const stripped = code.replace(/import.*from.*;\n?/g, '');
            new Function('registerSenseProtocol', stripped)(registerSenseProtocol);
            count++;
          } catch (e) { console.warn('[dev] Failed to load custom sense protocol:', e); }
        }
        if (count > 0) setSenseProtocols(getAllSenseProtocols());
      })
      .catch(() => {});
  }, []);

  // Load saved custom coordination paths on mount
  useEffect(() => {
    fetch('/api/dev/save-function?type=coordination')
      .then(res => res.json())
      .then(({ functions: saved }) => {
        if (!saved?.length) return;
        let count = 0;
        for (const { code } of saved as Array<{ id: string; code: string }>) {
          try {
            const stripped = code.replace(/import.*from.*;\n?/g, '');
            new Function('registerCoordinationPath', stripped)(registerCoordinationPath);
            count++;
          } catch (e) { console.warn('[dev] Failed to load custom coordination path:', e); }
        }
        if (count > 0) setCoordinationPaths(getAllCoordinationPaths());
      })
      .catch(() => {});
  }, []);

  const primitives = getAllPrimitives();

  return (
    <div className="min-h-screen bg-background dev-ref">
      <style>{`
        .dev-ref { font-size: 16px; line-height: 1.6; color: #1a1a1a; }
        .dev-ref .text-muted-foreground { color: #555; }
        .dev-ref code { font-size: 14px; }
        .dev-ref pre { font-size: 14px; }
      `}</style>

      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="text-sm font-mono text-muted-foreground mb-1">GroundingKit</div>
          <h1 className="text-3xl font-bold tracking-tight">Developer Reference</h1>
          <p className="text-lg text-muted-foreground mt-1">
            Build coordination capabilities for collaborative writing.
          </p>
        </div>
      </header>

      {/* Major tabs */}
      <div className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 flex gap-0">
          <MajorTabBtn active={tab === 'foundation'} onClick={() => setTab('foundation')} icon={<Layers className="h-4 w-4" />}>Foundation</MajorTabBtn>
          <MajorTabBtn active={tab === 'functions'} onClick={() => setTab('functions')} icon={<Code className="h-4 w-4" />}>Functions <Badge>{functions.length}</Badge></MajorTabBtn>
          <MajorTabBtn active={tab === 'sense'} onClick={() => setTab('sense')} icon={<Eye className="h-4 w-4" />}>Sense <Badge>{senseProtocols.length}</Badge></MajorTabBtn>
          <MajorTabBtn active={tab === 'gate'} onClick={() => setTab('gate')} icon={<Code2 className="h-4 w-4" />}>Gate <Badge>{getAllGates().length}</Badge></MajorTabBtn>
          <MajorTabBtn active={tab === 'negotiate'} onClick={() => setTab('negotiate')} icon={<Users className="h-4 w-4" />}>Negotiate <Badge>{coordinationPaths.length}</Badge></MajorTabBtn>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto">
        {tab === 'foundation' && <FoundationContent primitives={primitives} />}
        {tab === 'functions' && <FunctionsContent functions={functions} onRefresh={refresh} />}
        {tab === 'sense' && <SenseContent protocols={senseProtocols} onRefresh={refreshSense} />}
        {tab === 'gate' && <GateContent />}
        {tab === 'negotiate' && <NegotiateContent paths={coordinationPaths} onRefresh={refreshCoordination} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FOUNDATION TAB
// ═══════════════════════════════════════════════════════

function FoundationContent({ primitives }: { primitives: PrimitiveDefinition[] }) {
  const byLocation: Record<string, PrimitiveDefinition[]> = {};
  for (const p of primitives) { (byLocation[p.location] ??= []).push(p); }

  const locInfo: Record<string, { label: string; desc: string; color: string }> = {
    'global': { label: 'Global', desc: 'Top-level banners and alerts', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    'outline-node': { label: 'Outline View', desc: 'Icons, badges, alerts on outline nodes', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'writing-editor': { label: 'Writing View', desc: 'Inline highlights, dots, widgets', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    'right-panel': { label: 'Panel', desc: 'Cards, diffs, inputs, threads', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  };

  return (
    <SidebarLayout
      sidebar={[
        { heading: 'DATA MODEL', items: [{ id: 'dm-overview', label: 'Overview' }, { id: 'dm-snapshot', label: 'DocumentSnapshot' }] },
        { heading: 'UI PRIMITIVES', items: [{ id: 'prim-overview', label: 'Overview' }, ...(['global', 'outline-node', 'writing-editor', 'right-panel'] as const).map(loc => ({ id: `prim-${loc}`, label: locInfo[loc]?.label ?? loc }))] },
        { heading: 'DISPLAY BINDINGS', items: [{ id: 'bindings', label: 'Template Syntax' }] },
      ]}
    >
      <SectionBlock id="dm-overview" title="Data Model">
        <p>Every function receives a <code>DocumentSnapshot</code> — the complete current state of the coordination space. Functions don&apos;t fetch data; the platform assembles it.</p>
      </SectionBlock>

      <SectionBlock id="dm-snapshot" title="DocumentSnapshot">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <DataCard title="Structure Layer" subtitle="The coordination space" items={[
            { name: 'nodes: IntentItem[]', desc: 'Outline nodes (id, content, parentId, position, createdBy)' },
            { name: 'dependencies: Dependency[]', desc: 'Relationships (fromId, toId, type, label, direction)' },
            { name: 'writing: WritingContent[]', desc: 'Writing per section (sectionId, text, wordCount, paragraphs)' },
            { name: 'assignments: SectionAssignment[]', desc: 'Who owns each section' },
            { name: 'members: DocumentMember[]', desc: 'Team members (userId, name, role)' },
          ]} />
          <DataCard title="Interaction Layer" subtitle="Coordination dynamics" items={[
            { name: 'functionResults: StoredFunctionResult[]', desc: 'Previous function outputs (for chaining)' },
            { name: 'proposals: Proposal[]', desc: 'Active/resolved proposals (pathId, changes, votes)' },
          ]} />
        </div>
      </SectionBlock>

      <SectionBlock id="prim-overview" title={`UI Primitives (${primitives.length})`}>
        <p>Primitives are visual building blocks. Functions declare display bindings that map output to primitives. Each has a fixed render location and typed parameters.</p>
      </SectionBlock>

      {(['global', 'outline-node', 'writing-editor', 'right-panel'] as const).map(loc => {
        const prims = byLocation[loc] || [];
        const info = locInfo[loc];
        return (
          <SectionBlock key={loc} id={`prim-${loc}`} title={`${info.label} (${prims.length})`}>
            <div className="space-y-3">
              {prims.map(prim => <PrimitiveDoc key={prim.type} prim={prim} />)}
            </div>
          </SectionBlock>
        );
      })}

      <SectionBlock id="bindings" title="Display Bindings">
        <p className="mb-3">Functions map output to primitives using <code>{"{{field}}"}</code> template syntax.</p>
        <CodeBlock>{`// Scalar: show one primitive when condition is true
{ type: 'banner', when: 'level === "drifted"',
  params: { title: 'Drift detected', message: '{{summary}}', severity: 'warning' } }

// Array: one primitive per item
{ type: 'node-icon', forEach: 'alignedIntents',
  filter: 'item.coverageStatus !== "covered"',
  params: { nodeId: '{{item.id}}', status: '{{item.coverageStatus}}' } }`}</CodeBlock>
      </SectionBlock>
    </SidebarLayout>
  );
}

// ═══════════════════════════════════════════════════════
// FUNCTIONS TAB
// ═══════════════════════════════════════════════════════

function FunctionsContent({ functions, onRefresh }: { functions: FunctionDefinition[]; onRefresh: () => void }) {
  return (
    <SidebarLayout
      sidebar={[
        { heading: 'SPECIFICATION', items: [
          { id: 'fn-overview', label: 'Overview' },
          { id: 'fn-api', label: 'registerFunction()' },
          { id: 'fn-executors', label: 'Executor Types' },
          { id: 'fn-display', label: 'Display Bindings' },
          { id: 'fn-example', label: 'Complete Example' },
        ]},
        { heading: 'REGISTER & TEST', items: [{ id: 'fn-register', label: 'Register Custom' }] },
        { heading: `CATALOG (${functions.length})`, items: functions.map(f => ({ id: `fn-${f.id}`, label: f.name })) },
      ]}
    >
      <SectionBlock id="fn-overview" title="Overview">
        <p>A function declares three concerns:</p>
        <ol className="list-decimal pl-6 space-y-1 mt-2">
          <li><strong>Executor</strong> — how to compute (AI prompt, JS function, or API call)</li>
          <li><strong>Output</strong> — what it produces (typed schema)</li>
          <li><strong>Display</strong> — how to render (bindings to UI primitives)</li>
        </ol>
        <p className="mt-2">Functions don&apos;t know when or by whom they run — that&apos;s defined by Sense and Negotiate protocols.</p>
      </SectionBlock>

      <SectionBlock id="fn-api" title="registerFunction(definition)">
        <FieldTable fields={[
          ['id', 'string', 'required', 'Unique identifier'],
          ['name', 'string', 'required', 'Display name'],
          ['description', 'string', 'required', 'What it does'],
          ['icon', 'string', 'required', 'Lucide icon name'],
          ['executor', '"prompt" | "local" | "api"', 'required', 'How to compute'],
          ['prompt', '{ system, user, model?, temperature? }', 'if prompt', 'AI prompt template with {{variables}}'],
          ['fn', '(input) => { data }', 'if local', 'JS function'],
          ['endpoint', 'string', 'if api', 'HTTP POST endpoint'],
          ['requires', '{ writing?, dependencies?, members? }', 'required', 'Data needs'],
          ['outputSchema', 'Record<string, string>', 'required', 'Output shape'],
          ['ui', 'UIBinding[]', 'required', 'Display bindings'],
          ['configFields', 'ConfigField[]', 'required', 'Config fields (or [])'],
          ['defaultConfig', 'Record<string, unknown>', 'required', 'Default config (or {})'],
          ['dependsOn', 'string[]', 'optional', 'Functions whose results to read'],
        ]} />
      </SectionBlock>

      <SectionBlock id="fn-executors" title="Executor Types">
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2"><span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">prompt</span><span className="text-muted-foreground">AI model + prompt template</span></div>
            <p className="text-muted-foreground mb-2">Platform calls AI, parses JSON output, renders results.</p>
            <CodeBlock>{`prompt: {
  system: 'Analyze alignment. Return JSON only.',
  user: '## Outline\\n{{nodes}}\\n## Writing\\n{{writing}}',
  model: 'gpt-4o',        // default
  temperature: 0.3,        // default
}`}</CodeBlock>
            <div className="mt-2 text-sm"><strong>Template variables:</strong> <code>{"{{nodes}}"}</code> <code>{"{{writing}}"}</code> <code>{"{{dependencies}}"}</code> <code>{"{{focus}}"}</code> <code>{"{{config}}"}</code></div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2"><span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">local</span><span className="text-muted-foreground">JavaScript in browser</span></div>
            <CodeBlock>{`fn: async (input) => ({
  data: { score: input.snapshot.writing.length > 0 ? 80 : 0 }
})`}</CodeBlock>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2"><span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">api</span><span className="text-muted-foreground">HTTP POST to endpoint</span></div>
            <CodeBlock>{`endpoint: '/api/my-check'
// Platform POSTs { snapshot, focus, config }
// Expects { result: { ... } }`}</CodeBlock>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="fn-display" title="Display Bindings">
        <p className="mb-3">The <code>ui</code> array maps output to primitives. See Foundation tab for all 15 primitive types.</p>
        <CodeBlock>{`ui: [
  // One banner when condition is true
  { type: 'banner', when: 'level === "drifted"',
    params: { title: 'Drift', message: '{{summary}}', severity: 'warning' } },
  // One icon per array item
  { type: 'node-icon', forEach: 'intents',
    params: { nodeId: '{{item.id}}', status: '{{item.status}}' } },
]`}</CodeBlock>
      </SectionBlock>

      <SectionBlock id="fn-example" title="Complete Example">
        <CodeBlock>{`registerFunction({
  id: 'check-drift', name: 'Drift Detection',
  description: 'Compares writing against outline.',
  icon: 'Eye', executor: 'prompt',
  prompt: { system: '...', user: '{{nodes}}\\n{{writing}}', temperature: 0.2 },
  requires: { writing: true },
  outputSchema: { level: 'string', alignedIntents: 'array', summary: 'string' },
  ui: [
    { type: 'node-icon', forEach: 'alignedIntents',
      params: { nodeId: '{{item.id}}', status: '{{item.coverageStatus}}' } },
    { type: 'banner', when: 'level === "drifted"',
      params: { title: 'Drift detected', message: '{{summary}}', severity: 'warning' } },
  ],
  configFields: [], defaultConfig: {},
});`}</CodeBlock>
      </SectionBlock>

      <SectionBlock id="fn-register" title="Register & Test">
        <RegisterPanel onRegistered={onRefresh} />
      </SectionBlock>

      {/* ─── Library divider ─── */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Function Library ({functions.length})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {functions.map(func => (
          <div key={func.id} id={`fn-${func.id}`} className="scroll-mt-[60px] border rounded-lg overflow-hidden">
            <FunctionLibraryCard func={func} />
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

// ═══════════════════════════════════════════════════════
// SENSE TAB
// ═══════════════════════════════════════════════════════

function SenseContent({ protocols, onRefresh }: { protocols: SenseProtocolDefinition[]; onRefresh: () => void }) {
  return (
    <SidebarLayout
      sidebar={[
        { heading: 'WHAT IS A SENSE PROTOCOL', items: [
          { id: 'aw-overview', label: 'Overview' },
          { id: 'aw-how', label: 'How It Works' },
        ]},
        { heading: 'SPECIFICATION', items: [
          { id: 'aw-api', label: 'registerSenseProtocol()' },
          { id: 'aw-triggers', label: 'Trigger Options' },
          { id: 'aw-gate', label: 'Gate Conditions' },
        ]},
        { heading: 'REGISTER & TEST', items: [{ id: 'aw-register', label: 'Register Custom' }] },
        { heading: `LIBRARY (${protocols.length})`, items: protocols.map(p => ({ id: `aw-${p.id}`, label: p.name })) },
      ]}
    >
      <SectionBlock id="aw-overview" title="Overview">
        <p>
          A sense protocol helps individual writers understand the coordination space.
          It bundles <strong>Functions</strong> (what to compute) + <strong>Triggers</strong> (when to run) + <strong>Gate</strong> (when to suggest team coordination).
        </p>
        <p className="mt-2">
          Users see protocols as toggleable capabilities with trigger selection — they never touch raw functions.
          When a user enables a protocol and selects a trigger, the platform takes care of invoking the referenced functions
          at the right time, resolving their display bindings into primitives, and evaluating the gate to determine
          whether team negotiation should be suggested.
        </p>
      </SectionBlock>

      <SectionBlock id="aw-how" title="How It Works">
        <p className="mb-3">The runtime walks a simple flow when a trigger fires:</p>
        <div className="flex items-center gap-2 flex-wrap text-sm font-mono py-3 px-4 bg-muted/30 rounded-lg border">
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">User enables protocol</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">Selects trigger</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">Writes</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">Protocol runs functions</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Primitives appear</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">Gate evaluates</span>
        </div>
        <p className="mt-3 text-muted-foreground">
          If the gate condition is met, the system suggests a negotiate protocol (e.g., Team Vote).
          The user can accept or override the suggestion.
        </p>
      </SectionBlock>

      <SectionBlock id="aw-api" title="registerSenseProtocol(definition)">
        <FieldTable fields={[
          ['id', 'string', 'required', 'Unique identifier'],
          ['name', 'string', 'required', 'Display name (what users see)'],
          ['description', 'string', 'required', 'What this sense capability does'],
          ['icon', 'string', 'required', 'Lucide icon name'],
          ['functions', 'string[]', 'required', 'Function IDs to invoke (from the shared function pool)'],
          ['triggerOptions', 'TriggerOption[]', 'required', 'Trigger modes for users to choose from'],
          ['defaultTrigger', 'string', 'required', 'Which trigger is selected by default'],
          ['gate', '{ conditions, suggestProtocol, allowOverride? }', 'optional', 'When to suggest team negotiation'],
          ['configFields', 'SenseConfigField[]', 'optional', 'User-tunable parameters'],
          ['defaultConfig', 'Record<string, unknown>', 'optional', 'Defaults for config fields'],
        ]} />
      </SectionBlock>

      <SectionBlock id="aw-triggers" title="Trigger Options">
        <p className="mb-3">Each trigger option defines when the protocol runs. Users pick one from a dropdown. Common patterns:</p>
        <div className="space-y-2">
          {([
            ['manual', 'User clicks a button to run', 'For expensive or infrequent checks'],
            ['on-change', 'Runs when the outline or writing changes', 'For lightweight, real-time sensing'],
            ['interval', 'Runs on a timer (e.g., every 5 minutes)', 'For periodic background monitoring'],
            ['on-save', 'Runs when the document is saved', 'For pre-save validation checks'],
          ] as const).map(([value, label, note]) => (
            <div key={value} className="flex items-start gap-3 border rounded-lg px-4 py-2.5">
              <code className="font-bold text-sm bg-muted px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{value}</code>
              <div><div className="text-sm">{label}</div><div className="text-sm text-muted-foreground">{note}</div></div>
            </div>
          ))}
        </div>
        <CodeBlock>{`triggerOptions: [
  { value: 'manual', label: 'Manual only' },
  { value: 'on-change', label: 'When outline changes' },
  { value: 'interval', label: 'Every 5 minutes',
    config: { intervalMinutes: 5 } },
],
defaultTrigger: 'on-change',`}</CodeBlock>
      </SectionBlock>

      <SectionBlock id="aw-gate" title="Gate Conditions">
        <p className="mb-3">
          A Gate reads function output and suggests a negotiate protocol when conditions are met.
          This is the bridge between individual sensing and team negotiation — when a function detects
          something significant, the gate can automatically suggest that the team negotiate.
        </p>
        <CodeBlock>{`gate: {
  conditions: [
    { description: 'Cross-section impact detected',
      functionId: 'assess-impact',
      field: 'impacts',
      operator: 'is-not-empty' },
  ],
  suggestProtocol: 'negotiate',  // → Team Vote
  allowOverride: true,
}`}</CodeBlock>
        <p className="mt-2"><strong>Operators:</strong> <code>equals</code> <code>not-equals</code> <code>gt</code> <code>lt</code> <code>gte</code> <code>lte</code> <code>is-empty</code> <code>is-not-empty</code></p>
      </SectionBlock>

      <SectionBlock id="aw-register" title="Register & Test">
        <SenseRegisterPanel onRegistered={onRefresh} />
      </SectionBlock>

      {/* Library divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Sense Library ({protocols.length})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {protocols.map(p => (
          <div key={p.id} id={`aw-${p.id}`} className="scroll-mt-[60px] border rounded-lg overflow-hidden p-5">
            <SenseCard protocol={p} />
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

// ═══════════════════════════════════════════════════════
// NEGOTIATE TAB
// ═══════════════════════════════════════════════════════

function GateContent() {
  const gates = getAllGates();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Gate Protocols</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gates sit between Sense and Negotiate, routing proposals to the right coordination path.
        </p>
      </div>
      {gates.map((gate) => (
        <div key={gate.id} className="border rounded-xl bg-card p-5 space-y-3">
          <div>
            <div className="font-semibold">{gate.name}</div>
            <div className="text-sm text-muted-foreground">{gate.description}</div>
            <div className="text-xs font-mono text-muted-foreground mt-1">{gate.id}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Routes</div>
            <div className="flex gap-2 flex-wrap">
              {gate.routes.map((r) => (
                <span key={r} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{r}</span>
              ))}
            </div>
          </div>
          {gate.defaultRules.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Rules</div>
              {gate.defaultRules.map((rule, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span className="text-primary">→</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{rule.then}</span>
                  <span className="text-muted-foreground">{rule.description}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Steps ({gate.steps.length})</div>
            <div className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto">
              {gate.steps.map((s, i) => (
                <div key={i}>{s.id ? `[${s.id}] ` : ''}{s.run ? `run: ${s.run}` : ''}{s.actions ? `actions: [${s.actions.map(a => a.label).join(', ')}]` : ''}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Functions</div>
            <div className="flex gap-2 flex-wrap">
              {gate.functions.map((f) => (
                <span key={f} className="text-xs bg-muted px-2 py-1 rounded font-mono">{f}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NegotiateContent({ paths, onRefresh }: { paths: CoordinationPathDefinition[]; onRefresh: () => void }) {
  return (
    <SidebarLayout
      sidebar={[
        { heading: 'WHAT IS A NEGOTIATE PROTOCOL', items: [
          { id: 'co-overview', label: 'Overview' },
          { id: 'co-stages', label: 'The Three Stages' },
        ]},
        { heading: 'SPECIFICATION', items: [
          { id: 'co-steps', label: 'Step Types' },
          { id: 'co-actions', label: 'Actions with Steps' },
          { id: 'co-resolution', label: 'Resolution Rules' },
          { id: 'co-api', label: 'registerCoordinationPath()' },
        ]},
        { heading: 'REGISTER & TEST', items: [{ id: 'co-register', label: 'Register Custom' }] },
        { heading: `LIBRARY (${paths.length})`, items: paths.map(p => ({ id: `co-${p.id}`, label: p.name })) },
      ]}
    >
      <SectionBlock id="co-overview" title="Overview">
        <p>
          A negotiate protocol defines how teams negotiate changes to shared understanding.
          When a sense gate fires or a user initiates a proposal, the negotiate protocol
          governs the entire negotiation workflow.
        </p>
        <p className="mt-2">
          Each protocol has three stages: <strong>Propose</strong> (the proposer creates a change request),
          <strong> Deliberate</strong> (reviewers evaluate the proposal), and <strong>Resolve</strong> (a decision is reached).
          Each stage is a sequence of steps, and the runtime walks them in order.
        </p>
        <p className="mt-2">
          Actions (approve, reject, counter-propose) can carry their own steps, enabling rich interaction flows.
          The entire UI is composed from the same primitives used by functions — no hardcoded components.
        </p>
      </SectionBlock>

      <SectionBlock id="co-stages" title="The Three Stages">
        <div className="flex items-center gap-2 flex-wrap text-sm font-mono py-3 px-4 bg-muted/30 rounded-lg border mb-4">
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">Propose steps</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">Deliberate steps</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">Resolution check</span>
          <span className="text-muted-foreground">&#8594;</span>
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Resolve steps</span>
        </div>
        <div className="space-y-3">
          <div className="border rounded-lg p-4">
            <div className="font-semibold text-blue-700 mb-1">Propose</div>
            <p className="text-muted-foreground">The proposer sees these steps. Typically: show what changed, run impact analysis, collect reasoning, then submit. The proposer fills in data that reviewers will later see.</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="font-semibold text-purple-700 mb-1">Deliberate</div>
            <p className="text-muted-foreground">Reviewers see these steps. Typically: show stored results from Propose (no re-running), display impact cards, then present action buttons. Each action can trigger its own sub-steps.</p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="font-semibold text-emerald-700 mb-1">Resolve</div>
            <p className="text-muted-foreground">Shown after the resolution rule is satisfied. Typically: a success/failure banner, summary of the decision, and any follow-up actions.</p>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="co-steps" title="Step Types">
        <p className="mb-3">Each stage is a sequence of typed steps. The runtime renders them in order.</p>
        <div className="space-y-3">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <code className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">run-function</code>
              <span className="text-muted-foreground">Execute a function and render its display bindings</span>
            </div>
            <p className="text-sm text-muted-foreground">Example: Run <code>assess-impact</code> and render its impact cards and alerts. The function receives the current proposal context.</p>
            <CodeBlock>{`{ type: 'run-function', functionId: 'assess-impact' }`}</CodeBlock>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <code className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">show-result</code>
              <span className="text-muted-foreground">Display a stored result without re-running</span>
            </div>
            <p className="text-sm text-muted-foreground">Example: Show the impact analysis from the Propose stage so reviewers can see it without waiting for re-computation.</p>
            <CodeBlock>{`{ type: 'show-result', functionId: 'assess-impact' }`}</CodeBlock>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <code className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">show-data</code>
              <span className="text-muted-foreground">Render proposal data through primitives</span>
            </div>
            <p className="text-sm text-muted-foreground">Example: Show the draft items (what changed) as a result-list so the proposer can review their changes before submitting.</p>
            <CodeBlock>{`{ type: 'show-data', dataKey: 'draftItems',
  ui: [{ type: 'result-list', forEach: 'draftItems',
    params: { title: '{{item.content}}', badge: '{{item.status}}' } }] }`}</CodeBlock>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <code className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">ui</code>
              <span className="text-muted-foreground">Pure coordination UI (inputs, buttons, progress)</span>
            </div>
            <p className="text-sm text-muted-foreground">Example: Show a text input for reasoning, or action buttons for voting. These are interactive primitives that collect user input.</p>
            <CodeBlock>{`{ type: 'ui', ui: [
  { type: 'text-input', params: { label: 'Why?', placeholder: 'Explain...', action: 'set-reasoning' } },
] }`}</CodeBlock>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock id="co-actions" title="Actions with Steps">
        <p className="mb-3">
          Any action can carry its own steps. A simple approve has no steps — just an effect.
          A counter-propose might collect a text input and then re-run impact analysis.
        </p>
        <CodeBlock>{`actions: [
  // Simple: no steps
  { id: 'approve', label: 'Approve', effect: 'approve', availableTo: ['voter'] },
  // With reasoning input
  { id: 'reject', label: 'Reject', effect: 'reject', availableTo: ['voter'],
    steps: [
      { type: 'ui', ui: [{ type: 'text-input',
          params: { label: 'Reason', action: 'set-reasoning' } }] },
    ] },
  // With function re-run
  { id: 'counter-propose', label: 'Counter', effect: 'counter-propose', availableTo: ['voter'],
    steps: [
      { type: 'ui', ui: [{ type: 'text-input', params: { label: 'Alternative', action: 'set-counter' } }] },
      { type: 'run-function', functionId: 'assess-impact' },
      { type: 'run-function', functionId: 'preview-writing-impact' },
    ] },
]`}</CodeBlock>
      </SectionBlock>

      <SectionBlock id="co-resolution" title="Resolution Rules">
        <p className="mb-3">The resolution rule determines when deliberation ends and the Resolve stage begins.</p>
        <div className="space-y-2">
          {([
            ['single-approval', 'One reviewer approves and the proposal passes'],
            ['majority-vote', 'More than half of eligible voters approve'],
            ['unanimous', 'All eligible voters must approve'],
            ['threshold', 'A configurable number or percentage of approvals needed'],
          ] as const).map(([type, desc]) => (
            <div key={type} className="flex items-start gap-3 border rounded-lg px-4 py-2.5">
              <code className="font-bold text-sm bg-muted px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{type}</code>
              <span className="text-sm text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
        <CodeBlock>{`resolution: { type: 'majority-vote' }
// or
resolution: { type: 'threshold', threshold: 3 }`}</CodeBlock>
      </SectionBlock>

      <SectionBlock id="co-api" title="registerCoordinationPath(definition)">
        <FieldTable fields={[
          ['id', 'string', 'required', 'Unique identifier'],
          ['name', 'string', 'required', 'Display name'],
          ['description', 'string', 'required', 'What this protocol does'],
          ['icon', 'string', 'required', 'Lucide icon name'],
          ['color', 'string', 'required', 'Tailwind color name (e.g., emerald, violet)'],
          ['propose', 'NegotiateStage', 'required', 'Propose stage (who, steps, actions?)'],
          ['deliberate', 'NegotiateStage', 'required', 'Deliberate stage (who, steps, actions?)'],
          ['resolve', 'NegotiateStage', 'required', 'Resolve stage (who, steps, actions?)'],
          ['config', 'Record<string, ConfigEntry>', 'optional', 'Config fields (default, options, label)'],
          ['functions', 'string[]', 'optional', 'Function IDs referenced by this protocol'],
        ]} />
      </SectionBlock>

      <SectionBlock id="co-register" title="Register & Test">
        <NegotiateRegisterPanel onRegistered={onRefresh} />
      </SectionBlock>

      {/* Library divider */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Negotiate Library ({paths.length})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paths.map(p => (
          <div key={p.id} id={`co-${p.id}`} className="scroll-mt-[60px] border rounded-lg overflow-hidden p-5">
            <NegotiateCard path={p} />
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}

// ═══════════════════════════════════════════════════════
// LAYOUT: SIDEBAR + CONTENT
// ═══════════════════════════════════════════════════════

type SidebarGroup = { heading: string; items: { id: string; label: string }[] };

function SidebarLayout({ sidebar, children }: { sidebar: SidebarGroup[]; children: React.ReactNode }) {
  const [active, setActive] = useState(sidebar[0]?.items[0]?.id ?? '');

  return (
    <div className="flex gap-0">
      <nav className="w-[220px] flex-shrink-0 border-r hidden lg:block">
        <div className="sticky top-[53px] py-4 px-4 space-y-5 max-h-[calc(100vh-53px)] overflow-y-auto">
          {sidebar.map(group => (
            <div key={group.heading}>
              <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">{group.heading}</div>
              {group.items.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActive(item.id)}
                  className={`block px-2 py-1.5 text-sm rounded transition-colors ${
                    active === item.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >{item.label}</a>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0 px-8 py-6 space-y-10">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CARDS
// ═══════════════════════════════════════════════════════

function FunctionLibraryCard({ func }: { func: FunctionDefinition }) {
  const [expanded, setExpanded] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTestRunning(true); setTestResult(null); setTestError(null);
    try {
      const result = await runFunction(func.id, { snapshot: MOCK_SNAPSHOT, focus: { sectionId: 'sec-1' }, config: func.defaultConfig });
      setTestResult({ data: result.data, resolved: resolveBindings(result.ui, result.data) });
    } catch (e: unknown) { setTestError(e instanceof Error ? e.message : String(e)); }
    finally { setTestRunning(false); }
  };

  return (
    <>
      {/* Header — always visible */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold">{func.name}</span>
            <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">{func.id}</code>
            <span className={`text-sm font-mono px-2 py-0.5 rounded ${
              func.executor === 'prompt' ? 'bg-purple-50 text-purple-600' :
              func.executor === 'local' ? 'bg-emerald-50 text-emerald-600' :
              'bg-blue-50 text-blue-600'
            }`}>{func.executor}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{func.description}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {func.ui.length > 0 && (
            <div className="flex gap-1">
              {func.ui.slice(0, 3).map((u, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{u.type}</span>
              ))}
              {func.ui.length > 3 && <span className="text-xs text-muted-foreground">+{func.ui.length - 3}</span>}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(); }}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted/50 disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            {testRunning ? 'Running...' : 'Test'}
          </button>
        </div>
      </div>

      {/* Test results — show below header when available */}
      {testError && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{testError}</div>
      )}
      {testResult && (
        <div className="mx-5 mb-4 border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted/20 border-b text-sm font-medium flex items-center justify-between">
            <span>Test Output ({testResult.resolved.length} primitives)</span>
            <button onClick={() => setTestResult(null)} className="text-xs text-muted-foreground hover:text-foreground">dismiss</button>
          </div>
          {testResult.resolved.length > 0 ? (
            <div className="p-4"><PrimitiveRenderer primitives={testResult.resolved} /></div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No primitives rendered.</div>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t bg-muted/5 space-y-4">
          <div className="pt-4 flex flex-wrap gap-6">
            {func.dependsOn?.length ? (
              <div><Label>Depends On</Label><div className="flex gap-1">{func.dependsOn.map(d => <code key={d} className="bg-muted px-2 py-0.5 rounded text-sm">{d}</code>)}</div></div>
            ) : null}
            <div><Label>Requires</Label><div className="flex gap-1.5">{Object.entries(func.requires).filter(([, v]) => v).map(([k]) => <code key={k} className="bg-primary/5 border border-primary/20 px-2 py-0.5 rounded text-sm">{k}</code>)}{Object.values(func.requires).every(v => !v) && <span className="text-sm text-muted-foreground">outline only</span>}</div></div>
          </div>
          <div><Label>Output Schema</Label><pre className="font-mono bg-muted/30 rounded-lg px-3 py-2 overflow-x-auto text-sm">{JSON.stringify(func.outputSchema, null, 2)}</pre></div>
          {func.ui.length > 0 && (
            <div><Label>Display Bindings ({func.ui.length})</Label>
              <div className="space-y-1">{func.ui.map((u, i) => (
                <div key={i} className="font-mono text-sm flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-muted">{u.type}</span>
                  {u.forEach && <span className="text-muted-foreground">forEach: {u.forEach}</span>}
                  {u.filter && <span className="text-muted-foreground">filter: {u.filter}</span>}
                  {u.when && <span className="text-muted-foreground">when: {u.when}</span>}
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FunctionCard({ func }: { func: FunctionDefinition }) {
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTestRunning(true); setTestResult(null); setTestError(null);
    try {
      const result = await runFunction(func.id, { snapshot: MOCK_SNAPSHOT, focus: { sectionId: 'sec-1' }, config: func.defaultConfig });
      setTestResult({ data: result.data, resolved: resolveBindings(result.ui, result.data) });
    } catch (e: unknown) { setTestError(e instanceof Error ? e.message : String(e)); }
    finally { setTestRunning(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="bg-muted px-2 py-0.5 rounded">{func.id}</code>
        <span className={`font-mono px-2 py-0.5 rounded ${func.executor === 'prompt' ? 'bg-purple-50 text-purple-600' : func.executor === 'local' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{func.executor}</span>
        <span className="text-muted-foreground">{func.description}</span>
      </div>
      {func.dependsOn?.length ? <div><Label>Depends On</Label><div className="flex gap-1">{func.dependsOn.map(d => <code key={d} className="bg-muted px-2 py-0.5 rounded">{d}</code>)}</div></div> : null}
      <div><Label>Output</Label><pre className="font-mono bg-muted/30 rounded-lg px-3 py-2 overflow-x-auto text-sm">{JSON.stringify(func.outputSchema, null, 2)}</pre></div>
      {func.ui.length > 0 && <div><Label>Display ({func.ui.length} bindings)</Label><div className="space-y-1">{func.ui.map((u, i) => <div key={i} className="font-mono text-sm flex items-center gap-2"><span className="px-2 py-0.5 rounded bg-muted">{u.type}</span>{u.forEach && <span className="text-muted-foreground">forEach: {u.forEach}</span>}{u.when && <span className="text-muted-foreground">when: {u.when}</span>}</div>)}</div></div>}
      <div className="flex gap-2 pt-2 border-t">
        <button onClick={handleTest} disabled={testRunning} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border hover:bg-muted/50 disabled:opacity-40"><FlaskConical className="h-4 w-4" />{testRunning ? 'Running...' : 'Test Run'}</button>
      </div>
      {testError && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{testError}</div>}
      {testResult?.resolved.length ? <div><Label>Rendered</Label><div className="border rounded-lg p-3"><PrimitiveRenderer primitives={testResult.resolved} /></div></div> : null}
    </div>
  );
}

function SenseCard({ protocol }: { protocol: SenseProtocolDefinition }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <code className="bg-muted px-2 py-0.5 rounded">{protocol.id}</code>

        <span className="text-muted-foreground">{protocol.description}</span>
      </div>
      <div><Label>Functions</Label><div className="flex gap-1.5">{protocol.functions.map(f => <code key={f} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{f}</code>)}</div></div>
      <div><Label>Triggers</Label><div className="space-y-1">{protocol.triggerOptions.map(t => <div key={t.value} className="flex items-center gap-2 text-sm"><code className={t.value === protocol.defaultTrigger ? 'bg-primary/10 text-primary px-2 py-0.5 rounded font-medium' : 'bg-muted px-2 py-0.5 rounded'}>{t.value}</code><span className="text-muted-foreground">{t.label}</span>{t.value === protocol.defaultTrigger && <span className="text-primary text-sm">default</span>}</div>)}</div></div>

    </div>
  );
}

function NegotiateCard({ path }: { path: CoordinationPathDefinition }) {
  const ui = getPathUI(path.id);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {ui && <ui.Icon className={`h-5 w-5 ${ui.textColor}`} />}
        <code className="bg-muted px-2 py-0.5 rounded">{path.id}</code>
        <span className="font-mono text-muted-foreground">resolve: {path.resolve.who}</span>
        <span className="text-muted-foreground">{path.description}</span>
      </div>
      {(['propose', 'deliberate', 'resolve'] as const).map(stage => (
        <div key={stage}>
          <Label>{stage.charAt(0).toUpperCase() + stage.slice(1)} (who: {path[stage].who}, {path[stage].steps.length} steps)</Label>
          <StepList steps={path[stage].steps} />
          {path[stage].actions && path[stage].actions!.length > 0 && (
            <div className="mt-1 ml-4 space-y-0.5">
              {path[stage].actions!.map(a => (
                <div key={a.id ?? a.label} className="flex items-center gap-2 text-sm">
                  <code className="font-medium">{a.id ?? '-'}</code>
                  <span className="text-muted-foreground">{a.label}</span>
                  {a.who && <span className="text-xs text-muted-foreground">[{a.who.join(', ')}]</span>}
                  {a.steps?.length ? <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{a.steps.length} sub-steps</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {(['propose', 'deliberate', 'resolve'] as const).map(stage => (
        <div key={stage}><Label>{stage.charAt(0).toUpperCase() + stage.slice(1)} ({path[stage]?.steps?.length ?? 0} steps)</Label><StepList steps={path[stage]?.steps ?? []} /></div>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: ProtocolStep[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-sm font-mono">
          <span className="text-muted-foreground w-4 text-right">{i + 1}.</span>
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

// ═══════════════════════════════════════════════════════
// REGISTER PANEL
// ═══════════════════════════════════════════════════════

const TEMPLATE_CODE = `registerFunction({
  id: 'my-check', name: 'My Check', description: 'Custom check.',
  icon: 'Search', executor: 'local',
  fn: async (input) => ({
    data: {
      sections: input.snapshot.nodes.filter(n => !n.parentId).length,
      words: input.snapshot.writing.reduce((s, w) => s + w.wordCount, 0),
    },
  }),
  requires: { writing: true },
  outputSchema: { sections: 'number', words: 'number' },
  ui: [{ type: 'summary-bar', params: { level: 'aligned', counts: '{"sections":{{sections}},"words":{{words}}}' } }],
  configFields: [], defaultConfig: {},
});`;

function RegisterPanel({ onRegistered }: { onRegistered: () => void }) {
  const [code, setCode] = useState(TEMPLATE_CODE);
  const [error, setError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[]; def: FunctionDefinition } | null>(null);
  const [registered, setRegistered] = useState(false);

  // Test WITHOUT registering — parse the code, extract the definition, run it in a sandbox
  const handleTest = async () => {
    setError(null); setTestResult(null); setTestRunning(true); setRegistered(false);
    try {
      // Parse the code to extract the function definition without actually registering it
      let capturedDef: FunctionDefinition | null = null;
      const fakeRegister = (def: FunctionDefinition) => { capturedDef = def; };
      const stripped = code.replace(/import.*from.*;\n?/g, '');
      new Function('registerFunction', stripped)(fakeRegister);

      if (!capturedDef) throw new Error('No registerFunction() call found in the code.');
      const def: FunctionDefinition = capturedDef;

      // Temporarily register to run it
      registerFunction(def);
      try {
        const result = await runFunction(def.id, { snapshot: MOCK_SNAPSHOT, config: def.defaultConfig });
        const resolved = resolveBindings(result.ui, result.data);
        setTestResult({ data: result.data, resolved, def });
      } finally {
        // Note: can't unregister, but it's fine for dev — will be overwritten on re-test
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestRunning(false);
    }
  };

  // Register permanently (add to library + persist to disk)
  const handleRegister = async () => {
    if (!testResult?.def) return;
    try {
      registerFunction(testResult.def);
      // Persist to backend
      await fetch('/api/dev/save-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: testResult.def.id, code, type: 'function' }),
      });
      setRegistered(true);
      onRegistered();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Write a <code>registerFunction()</code> call. <strong>Test it first</strong> against sample data,
        then add it to the library when you&apos;re satisfied.
      </p>

      {/* Code editor */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-2.5 border-b flex justify-between items-center">
          <span className="font-mono text-sm text-muted-foreground">registerFunction()</span>
          <button
            onClick={handleTest}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted/50 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {testRunning ? 'Running...' : 'Test Run'}
          </button>
        </div>
        <textarea
          value={code}
          onChange={e => { setCode(e.target.value); setTestResult(null); setRegistered(false); setError(null); }}
          className="w-full font-mono text-sm p-4 bg-background border-none resize-none focus:outline-none"
          rows={18}
          spellCheck={false}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Test results */}
      {testResult && (
        <div className="space-y-4">
          {/* Rendered output */}
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/20 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">
                Test Output — <code>{testResult.def.id}</code>
                <span className="text-muted-foreground font-normal ml-2">({testResult.resolved.length} primitives)</span>
              </span>
            </div>
            {testResult.resolved.length > 0 ? (
              <div className="p-4 bg-background">
                <PrimitiveRenderer primitives={testResult.resolved} />
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No primitives rendered. Check your <code>ui</code> bindings and <code>when</code>/<code>forEach</code> conditions.</div>
            )}
          </div>

          {/* Raw data */}
          <details className="border rounded-lg overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">Raw output data</summary>
            <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto border-t">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </details>

          {/* Add to library */}
          {!registered ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
              <span className="text-sm">Looks good?</span>
              <button
                onClick={handleRegister}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add to Library
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <strong>Added to library!</strong> <code>{testResult.def.id}</code> is now available in the catalog and can be referenced by protocols.
            </div>
          )}
        </div>
      )}

      {/* Sample data info */}
      <details className="border rounded-lg overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium text-muted-foreground">View sample document (used for test runs)</summary>
        <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-80 overflow-y-auto border-t">
          {JSON.stringify(MOCK_SNAPSHOT, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SENSE REGISTER PANEL
// ═══════════════════════════════════════════════════════

const SENSE_TEMPLATE_CODE = `registerSenseProtocol({
  id: 'word-count-monitor',
  name: 'Word Count Monitor',
  description: 'Monitors word count per section.',
  icon: 'Hash',
  functions: ['my-custom-check'],  // reference a registered function
  triggerOptions: [
    { value: 'manual', label: 'Manual only' },
    { value: 'interval', label: 'Every 5 minutes', config: { intervalMinutes: 5 } },
  ],
  defaultTrigger: 'manual',
});`;

function SenseRegisterPanel({ onRegistered }: { onRegistered: () => void }) {
  const [code, setCode] = useState(SENSE_TEMPLATE_CODE);
  const [error, setError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ def: SenseProtocolDefinition; functionResults: Array<{ funcId: string; data: Record<string, unknown>; resolved: ResolvedPrimitive[] }> } | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleTest = async () => {
    setError(null); setTestResult(null); setTestRunning(true); setRegistered(false);
    try {
      let capturedDef: SenseProtocolDefinition | null = null;
      const fakeRegister = (def: SenseProtocolDefinition) => { capturedDef = def; };
      const stripped = code.replace(/import.*from.*;\n?/g, '');
      new Function('registerSenseProtocol', stripped)(fakeRegister);

      if (!capturedDef) throw new Error('No registerSenseProtocol() call found in the code.');
      const def: SenseProtocolDefinition = capturedDef;

      // Run each referenced function against MOCK_SNAPSHOT
      const functionResults: Array<{ funcId: string; data: Record<string, unknown>; resolved: ResolvedPrimitive[] }> = [];
      for (const funcId of def.functions) {
        const func = getFunction(funcId);
        if (!func) {
          functionResults.push({ funcId, data: { error: `Function "${funcId}" not found. Register it first in the Functions tab.` }, resolved: [] });
          continue;
        }
        try {
          const result = await runFunction(funcId, { snapshot: MOCK_SNAPSHOT, config: func.defaultConfig });
          const resolved = resolveBindings(result.ui, result.data);
          functionResults.push({ funcId, data: result.data, resolved });
        } catch (e: unknown) {
          functionResults.push({ funcId, data: { error: e instanceof Error ? e.message : String(e) }, resolved: [] });
        }
      }
      setTestResult({ def, functionResults });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestRunning(false);
    }
  };

  const handleRegister = async () => {
    if (!testResult?.def) return;
    try {
      registerSenseProtocol(testResult.def);
      await fetch('/api/dev/save-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: testResult.def.id, code, type: 'sense' }),
      });
      setRegistered(true);
      onRegistered();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Write a <code>registerSenseProtocol()</code> call. <strong>Test it first</strong> — the panel will run each
        referenced function against sample data and show the resulting primitives. Then add it to the library.
      </p>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-2.5 border-b flex justify-between items-center">
          <span className="font-mono text-sm text-muted-foreground">registerSenseProtocol()</span>
          <button
            onClick={handleTest}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted/50 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {testRunning ? 'Running...' : 'Test Run'}
          </button>
        </div>
        <textarea
          value={code}
          onChange={e => { setCode(e.target.value); setTestResult(null); setRegistered(false); setError(null); }}
          className="w-full font-mono text-sm p-4 bg-background border-none resize-none focus:outline-none"
          rows={16}
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {testResult && (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/20 border-b">
              <span className="text-sm font-semibold">
                Test Output — <code>{testResult.def.id}</code>
                <span className="text-muted-foreground font-normal ml-2">
                  ({testResult.def.functions.length} function{testResult.def.functions.length !== 1 ? 's' : ''} referenced)
                </span>
              </span>
            </div>
            <div className="divide-y">
              {testResult.functionResults.map(fr => (
                <div key={fr.funcId} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{fr.funcId}</code>
                    <span className="text-sm text-muted-foreground">{fr.resolved.length} primitives</span>
                  </div>
                  {'error' in fr.data && typeof fr.data.error === 'string' ? (
                    <div className="text-sm text-red-600">{fr.data.error}</div>
                  ) : fr.resolved.length > 0 ? (
                    <PrimitiveRenderer primitives={fr.resolved} />
                  ) : (
                    <div className="text-sm text-muted-foreground">No primitives rendered.</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <details className="border rounded-lg overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">Protocol definition</summary>
            <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto border-t">
              {JSON.stringify(testResult.def, null, 2)}
            </pre>
          </details>

          {!registered ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
              <span className="text-sm">Looks good?</span>
              <button
                onClick={handleRegister}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add to Library
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <strong>Added to library!</strong> <code>{testResult.def.id}</code> is now available and can be enabled by users.
            </div>
          )}
        </div>
      )}

      <details className="border rounded-lg overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium text-muted-foreground">View sample document (used for test runs)</summary>
        <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-80 overflow-y-auto border-t">
          {JSON.stringify(MOCK_SNAPSHOT, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COORDINATION REGISTER PANEL
// ═══════════════════════════════════════════════════════

const COORDINATION_TEMPLATE_CODE = `registerCoordinationPath({
  id: 'quick-review',
  name: 'Quick Review',
  description: 'One person reviews and decides.',
  icon: 'UserCheck',
  color: 'emerald',
  roles: [
    { id: 'proposer', label: 'Proposer', description: 'Proposes the change', assignment: 'proposer' },
    { id: 'reviewer', label: 'Reviewer', description: 'Reviews and decides', assignment: 'impacted-owners' },
  ],
  actions: [
    { id: 'approve', label: 'Approve', icon: 'Check', availableTo: ['reviewer'], effect: 'approve' },
    { id: 'reject', label: 'Reject', icon: 'X', availableTo: ['reviewer'], effect: 'reject' },
  ],
  resolution: { type: 'single-approval' },
  propose: { steps: [
    { type: 'show-data', dataKey: 'draftItems', ui: [{ type: 'result-list', forEach: 'draftItems', params: { title: '{{item.content}}', badge: '{{item.status}}' } }] },
    { type: 'ui', ui: [{ type: 'text-input', params: { label: 'Why?', placeholder: 'Explain...', action: 'set-reasoning' } }] },
    { type: 'ui', ui: [{ type: 'action-group', params: { actions: JSON.stringify([{ label: 'Submit', action: 'submit', variant: 'primary' }]) } }] },
  ]},
  deliberate: { steps: [
    { type: 'show-result', functionId: 'assess-impact' },
  ]},
  resolve: { steps: [
    { type: 'ui', ui: [{ type: 'banner', params: { title: 'Decided', message: 'Reviewer responded.', severity: 'success' } }] },
  ]},
  configFields: [],
  defaultConfig: {},
  proposerSummary: 'A reviewer will decide.',
  receiverSummary: 'You are asked to review.',
});`;

function NegotiateRegisterPanel({ onRegistered }: { onRegistered: () => void }) {
  const [code, setCode] = useState(COORDINATION_TEMPLATE_CODE);
  const [error, setError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ def: CoordinationPathDefinition } | null>(null);
  const [registered, setRegistered] = useState(false);

  const handleTest = async () => {
    setError(null); setTestResult(null); setTestRunning(true); setRegistered(false);
    try {
      let capturedDef: CoordinationPathDefinition | null = null;
      const fakeRegister = (def: CoordinationPathDefinition) => { capturedDef = def; };
      const stripped = code.replace(/import.*from.*;\n?/g, '');
      new Function('registerCoordinationPath', 'JSON', stripped)(fakeRegister, JSON);

      if (!capturedDef) throw new Error('No registerCoordinationPath() call found in the code.');
      const def: CoordinationPathDefinition = capturedDef;
      setTestResult({ def });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestRunning(false);
    }
  };

  const handleRegister = async () => {
    if (!testResult?.def) return;
    try {
      registerCoordinationPath(testResult.def);
      await fetch('/api/dev/save-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: testResult.def.id, code, type: 'coordination' }),
      });
      setRegistered(true);
      onRegistered();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Write a <code>registerCoordinationPath()</code> call. <strong>Test it first</strong> — the panel will
        parse the definition and show the step visualization. Then add it to the library.
      </p>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-2.5 border-b flex justify-between items-center">
          <span className="font-mono text-sm text-muted-foreground">registerCoordinationPath()</span>
          <button
            onClick={handleTest}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted/50 disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {testRunning ? 'Running...' : 'Test Run'}
          </button>
        </div>
        <textarea
          value={code}
          onChange={e => { setCode(e.target.value); setTestResult(null); setRegistered(false); setError(null); }}
          className="w-full font-mono text-sm p-4 bg-background border-none resize-none focus:outline-none"
          rows={28}
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {testResult && (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/20 border-b">
              <span className="text-sm font-semibold">
                Test Output — <code>{testResult.def.id}</code>
                <span className="text-muted-foreground font-normal ml-2">{testResult.def.name}</span>
              </span>
            </div>
            <div className="p-4 space-y-4">
              {(['propose', 'deliberate', 'resolve'] as const).map(stage => (
                <div key={stage}>
                  <Label>{stage.charAt(0).toUpperCase() + stage.slice(1)} (who: {testResult.def[stage]?.who}, {testResult.def[stage]?.steps?.length ?? 0} steps)</Label>
                  <StepList steps={testResult.def[stage]?.steps ?? []} />
                  {testResult.def[stage]?.actions && testResult.def[stage]!.actions!.length > 0 && (
                    <div className="mt-1 ml-4 space-y-0.5">
                      {testResult.def[stage]!.actions!.map((a: import("@/platform/protocol-types").ProtocolAction) => (
                        <div key={a.id ?? a.label} className="flex items-center gap-2 text-sm">
                          <code className="font-medium">{a.id ?? '-'}</code>
                          <span className="text-muted-foreground">{a.label}</span>
                          {a.who && <span className="text-xs text-muted-foreground">[{a.who.join(', ')}]</span>}
                          {a.steps?.length ? <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{a.steps.length} sub-steps</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div>
                <Label>Resolve</Label>
                <code className="text-sm bg-muted px-2 py-0.5 rounded">who: {testResult.def.resolve?.who}</code>
              </div>
            </div>
          </div>

          <details className="border rounded-lg overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 text-sm font-medium">Full definition JSON</summary>
            <pre className="text-sm font-mono bg-muted/10 px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto border-t">
              {JSON.stringify(testResult.def, null, 2)}
            </pre>
          </details>

          {!registered ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
              <span className="text-sm">Looks good?</span>
              <button
                onClick={handleRegister}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add to Library
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
              <strong>Added to library!</strong> <code>{testResult.def.id}</code> is now available for sense gates to reference.
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

function MajorTabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}>{icon}{children}</button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{children}</span>;
}

function SectionBlock({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-[60px]"><h2 className="text-xl font-bold mb-3">{title}</h2><div className="text-[15px] leading-relaxed">{children}</div></section>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{children}</div>;
}

function DataCard({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ name: string; desc: string }> }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b"><div className="font-semibold">{title}</div><div className="text-sm text-muted-foreground">{subtitle}</div></div>
      <div className="divide-y">{items.map(item => <div key={item.name} className="px-4 py-2.5"><div className="font-mono font-medium">{item.name}</div><div className="text-sm text-muted-foreground">{item.desc}</div></div>)}</div>
    </div>
  );
}

function PrimitiveDoc({ prim }: { prim: PrimitiveDefinition }) {
  const [open, setOpen] = useState(false);
  const preview = PREVIEW_PRIMITIVES[prim.type];
  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <code className="font-bold">{prim.type}</code>
        <span className="text-muted-foreground">{prim.name}</span>
        {prim.supportsIteration && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">forEach</span>}
      </button>
      {open && (
        <div className="border-t px-4 py-3 bg-muted/10 space-y-3">
          <p className="text-muted-foreground text-sm">{prim.description}</p>
          <div><Label>Parameters</Label><div className="space-y-1">{prim.params.map(p => <div key={p.key} className="flex items-start gap-2 text-sm"><code className="font-medium w-28 flex-shrink-0">{p.key}</code><code className={`px-1.5 py-0.5 rounded text-xs ${p.required ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>{p.type}{!p.required && '?'}</code><span className="text-muted-foreground">{p.description}</span></div>)}</div></div>
          {preview && <div><Label>Preview</Label><div className="border rounded-lg p-3 bg-background"><PrimitiveRenderer primitives={[preview]} /></div></div>}
        </div>
      )}
    </div>
  );
}

function FieldTable({ fields }: { fields: [string, string, string, string][] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full"><thead><tr className="bg-muted/30 border-b text-sm"><th className="text-left px-4 py-2 font-bold">Field</th><th className="text-left px-4 py-2 font-bold">Type</th><th className="text-left px-4 py-2 font-bold w-20"></th><th className="text-left px-4 py-2 font-bold">Description</th></tr></thead>
      <tbody className="divide-y">{fields.map(([n, t, r, d]) => <tr key={n}><td className="px-4 py-2.5 font-mono font-medium align-top">{n}</td><td className="px-4 py-2.5 font-mono text-muted-foreground align-top text-sm">{t}</td><td className="px-4 py-2.5 text-muted-foreground align-top text-sm">{r}</td><td className="px-4 py-2.5 text-muted-foreground">{d}</td></tr>)}</tbody></table>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border overflow-hidden mt-2 mb-2">
      <Highlight theme={themes.vsLight} code={children.trim()} language="typescript">
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={{ ...style, margin: 0, padding: '14px', fontSize: '14px', lineHeight: 1.6, overflow: 'auto' }}>
            {tokens.map((line, i) => (<div key={i} {...getLineProps({ line })}>{line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}</div>))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
