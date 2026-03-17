"use client";

import { useState, useCallback, useEffect } from "react";
import { getAllFunctions, getFunctionsByTrigger, registerFunction, type FunctionDefinition } from "@/platform/functions/protocol";
import { runFunction } from "@/platform/functions/runner";
import { resolveBindings, groupByLocation, type ResolvedPrimitive } from "@/platform/primitives/resolver";
import { getAllCoordinationPaths, type CoordinationPathDefinition } from "@/platform/coordination/protocol";
import { getPathUI, getAllPathUIs } from "@/platform/coordination/ui";
import { getAllPrimitives } from "@/platform/primitives/registry";
import type { UIBinding } from "@/platform/primitives/registry";
import type { DocumentSnapshot } from "@/platform/data-model";
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, Plus, Trash2, Play, FlaskConical } from "lucide-react";

// Ensure builtins are registered
import "@/platform/primitives/registry";
import "@/platform/functions/builtin";
import "@/platform/coordination/builtin";

type Tab = "functions" | "paths" | "data-slots";

export default function DevPage() {
  const [tab, setTab] = useState<Tab>("functions");
  const [refreshKey, setRefreshKey] = useState(0);
  const functions = getAllFunctions();
  const paths = getAllCoordinationPaths();

  // Load saved custom functions on mount
  useEffect(() => {
    fetch('/api/dev/save-function')
      .then(res => res.json())
      .then(({ functions: saved }) => {
        if (!saved?.length) return;
        let registered = 0;
        for (const { code } of saved as Array<{ id: string; code: string }>) {
          try {
            const stripped = code.replace(/import.*from.*;\n?/g, '');
            const fn = new Function('registerFunction', stripped);
            fn(registerFunction);
            registered++;
          } catch (e) {
            console.warn('[dev] Failed to load custom function:', e);
          }
        }
        if (registered > 0) setRefreshKey(k => k + 1);
      })
      .catch(() => {});
  }, []);

  const handleFunctionRegistered = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="text-xs font-mono text-muted-foreground mb-2">GroundingKit Platform</div>
          <h1 className="text-2xl font-semibold tracking-tight">Developer Reference</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Register functions and coordination paths to extend the platform.
          </p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 flex gap-0">
          <TabButton active={tab === "functions"} onClick={() => setTab("functions")}>
            Functions <CountBadge count={functions.length} />
          </TabButton>
          <TabButton active={tab === "paths"} onClick={() => setTab("paths")}>
            Coordination Paths <CountBadge count={paths.length} />
          </TabButton>
          <TabButton active={tab === "data-slots"} onClick={() => setTab("data-slots")}>
            Data Slots
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {tab === "functions" ? (
          <FunctionsTab key={refreshKey} functions={functions} onRegistered={handleFunctionRegistered} />
        ) : tab === "paths" ? (
          <PathsTab paths={paths} />
        ) : (
          <DataSlotsTab />
        )}
      </div>
    </div>
  );
}

// ─── Functions Tab ───

function FunctionsTab({ functions, onRegistered }: { functions: FunctionDefinition[]; onRegistered: () => void }) {
  const grouped = {
    detection: functions.filter(f => f.trigger === "detection"),
    proposal: functions.filter(f => f.trigger === "proposal"),
    'on-demand': functions.filter(f => f.trigger === "on-demand"),
  };

  return (
    <div className="space-y-10">
      {/* Overview */}
      <section>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          A <strong>function</strong> reads document data, produces structured results,
          and declares how those results render in the UI.
        </p>
      </section>

      {/* ─── Step 1: Input ─── */}
      <section>
        <SectionTitle>1. Input &mdash; what data your function receives</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed max-w-2xl">
          Every function receives a <Code>FunctionInput</Code>. The core is the{' '}
          <Code>snapshot</Code> &mdash; a read-only view of the entire document.
        </p>
        <CodeBlock>{`type FunctionInput = {
  snapshot: DocumentSnapshot;        // full document state
  focus?: FunctionFocus;             // optional: specific target
  config: Record<string, unknown>;   // team-configured options
};`}</CodeBlock>

        <p className="text-xs text-muted-foreground mt-4 mb-2">
          Here is what <Code>snapshot</Code> looks like at runtime:
        </p>
        <CodeBlock>{`snapshot = {
  documentId: "doc-abc",
  phase: "writing",

  // ── Outline (always available) ──
  nodes: [
    { id: "s1", content: "Introduction", parentId: null, level: 0, position: 0,
      createdBy: { userId: "u1", userName: "Alice", at: 1710000000 } },
    { id: "i1", content: "Explain the motivation", parentId: "s1", level: 1, position: 0, ... },
    { id: "i2", content: "Define key terms", parentId: "s1", level: 1, position: 1, ... },
    { id: "s2", content: "Method", parentId: null, level: 0, position: 1, ... },
  ],
  assignments: [
    { sectionId: "s1", assigneeId: "u1", assigneeName: "Alice" },
    { sectionId: "s2", assigneeId: "u2", assigneeName: "Bob" },
  ],

  // ── Writing (requires: { writing: true }) ──
  writing: [
    {
      sectionId: "s1",
      html: "<p>The system addresses a gap in...</p><p>We define alignment as...</p>",
      text: "The system addresses a gap in... We define alignment as...",
      wordCount: 156,
      paragraphs: [
        { index: 0, textPrefix: "The system addresses a gap in", lastEditBy: { userId: "u1", userName: "Alice", at: 1710001000 } },
        { index: 1, textPrefix: "We define alignment as", lastEditBy: { userId: "u2", userName: "Bob", at: 1710002000 } },
      ],
    },
  ],

  // ── Dependencies (requires: { dependencies: true }) ──
  dependencies: [
    { id: "d1", fromId: "s1", toId: "s2", type: "builds-upon", label: "Method builds on Introduction",
      direction: "directed", source: "ai-suggested", confirmed: true, ... },
  ],

  // ── Team (requires: { members: true }) ──
  members: [
    { userId: "u1", name: "Alice", role: "owner" },
    { userId: "u2", name: "Bob", role: "editor" },
  ],
  currentUserId: "u1",
}`}</CodeBlock>

        <p className="text-xs text-muted-foreground mt-4 mb-2">
          Declare which parts you need via <Code>requires</Code>.
          Outline (<Code>nodes</Code>, <Code>assignments</Code>) is always available:
        </p>
        <div className="border rounded-lg overflow-hidden">
          <div className="divide-y">
            {([
              ['requires: { writing: true }', 'snapshot.writing', 'Per-section content: html, text, wordCount, paragraph attributions'],
              ['requires: { dependencies: true }', 'snapshot.dependencies', 'Relationships between nodes: type, direction, confirmed'],
              ['requires: { members: true }', 'snapshot.members', 'Team members: name, role, email + currentUserId'],
            ] as const).map(([req, field, desc]) => (
              <div key={req} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                <span className="font-mono font-medium flex-shrink-0">{req}</span>
                <span className="font-mono text-muted-foreground flex-shrink-0">&rarr; {field}</span>
                <span className="text-muted-foreground ml-auto text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Helpers for traversing the outline:
        </p>
        <CodeBlock>{`import { getSections, getChildren, getWriting, getAssignee } from '@/lib/data-model';

const sections = getSections(snapshot);           // root nodes (level 0), sorted
const children = getChildren(snapshot, "s1");     // children of s1, sorted
const writing  = getWriting(snapshot, "s1");      // WritingContent for section s1
const assignee = getAssignee(snapshot, "s1");     // who owns section s1`}</CodeBlock>
      </section>

      {/* ─── Step 2: Logic ─── */}
      <section>
        <SectionTitle>2. Logic &mdash; how your function runs</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed max-w-2xl">
          Two execution modes:
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-4">
            <div className="text-xs font-semibold mb-1">Rule-based <Code>executor: &apos;local&apos;</Code></div>
            <div className="text-[11px] text-muted-foreground mb-2">Write a function that reads snapshot and returns results.</div>
            <CodeBlock>{`executor: 'local',
fn: (input: FunctionInput) => {
  const { snapshot, config } = input;

  // Read data from snapshot
  const sections = getSections(snapshot);
  const limit = (config.wordLimit as number) ?? 200;

  // Compute results
  const violations = sections
    .map(s => ({
      sectionId: s.id,
      wordCount: getWriting(snapshot, s.id)?.wordCount ?? 0,
      limit,
    }))
    .filter(v => v.wordCount > v.limit);

  // Return structured result
  return {
    functionId: 'my-function',
    data: { violations, total: violations.length },
    ui: [],
    computedAt: Date.now(),
  };
},`}</CodeBlock>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-xs font-semibold mb-1">Prompt-based <Code>executor: &apos;prompt&apos;</Code></div>
            <div className="text-[11px] text-muted-foreground mb-2">Write a prompt. Platform fills data, calls AI, parses response.</div>
            <CodeBlock>{`executor: 'prompt',
prompt: {
  system: \`You check if each sentence
serves its parent intent.

Return JSON:
{
  "sentences": [{
    "text": "...",
    "intentId": "...",
    "status": "aligned | off-topic",
    "reason": "..."
  }],
  "alignedCount": number,
  "totalCount": number
}\`,
  user: \`## Intents
{{nodes}}

## Writing
{{writing}}\`,
},
// Platform automatically:
// 1. Fills {{nodes}}, {{writing}} from snapshot
// 2. Calls AI with your prompt
// 3. Parses JSON response
// 4. Validates against outputSchema`}</CodeBlock>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Prompt templates can use: <Code>{"{{nodes}}"}</Code> <Code>{"{{writing}}"}</Code>{' '}
          <Code>{"{{dependencies}}"}</Code> <Code>{"{{assignments}}"}</Code>{' '}
          <Code>{"{{members}}"}</Code> <Code>{"{{focus}}"}</Code> <Code>{"{{config}}"}</Code>.
          Arrays are auto-formatted as readable text.
        </p>
      </section>

      {/* ─── Step 3: Output → UI ─── */}
      <section>
        <SectionTitle>3. Output &amp; UI &mdash; what you return and how it renders</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed max-w-2xl">
          Your function returns a <Code>data</Code> object. Each field can be bound to
          a UI primitive. <strong>Array fields</strong> produce per-item rendering
          (one highlight per sentence), <strong>scalar fields</strong> drive conditions and summary text.
        </p>

        <p className="text-xs font-semibold mb-2">Example: function returns this data &darr;</p>
        <CodeBlock>{`data: {
  sentences: [
    { text: "The system addresses a gap in...", intentId: "i1", status: "aligned",  reason: "Supports motivation" },
    { text: "Performance is critical for...",   intentId: "i1", status: "off-topic", reason: "Not related to motivation" },
    { text: "We define alignment as...",        intentId: "i2", status: "partial",   reason: "Partially covers definition" },
  ],
  alignedCount: 1,
  totalCount: 3,
}`}</CodeBlock>
      </section>

      {/* ─── UI Primitives with previews ─── */}
      <section>
        <SectionTitle>UI Primitives</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed max-w-2xl">
          12 primitives organized by render location. Use <Code>forEach</Code> to iterate arrays,{' '}
          <Code>filter</Code> to conditionally render, <Code>{"{{item.field}}"}</Code> to fill parameters.
        </p>

        {/* ── Editor Primitives ── */}
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-6">Editor (writing area)</div>
        <div className="space-y-3">
          <PrimitivePreview
            name="sentence-highlight"
            location="writing-editor"
            description="Color a text range by anchor text matching. For sentence-level feedback."
            binding={`{
  type: 'sentence-highlight',
  forEach: 'issues',
  filter: 'item.status !== "aligned"',
  params: {
    startAnchor: '{{item.text}}',
    color: 'red',
    tooltip: '{{item.reason}}',
  }
}`}
            preview={
              <div className="text-sm leading-relaxed space-y-1.5">
                <p>The system addresses a gap in collaborative writing.</p>
                <p><span className="bg-red-100 border-b-2 border-red-400 px-0.5">Performance is critical for real-time systems.</span></p>
                <p className="text-[10px] text-muted-foreground ml-4">hover: &quot;Not related to motivation&quot;</p>
                <p><span className="bg-yellow-100 border-b-2 border-yellow-400 px-0.5">We define alignment as the degree to which...</span></p>
              </div>
            }
          />

          <PrimitivePreview
            name="issue-dot"
            location="writing-editor"
            description="Numbered dot at sentence boundary. Click to expand detail popover with actions."
            binding={`{
  type: 'issue-dot',
  forEach: 'issues',
  params: {
    anchor: '{{item.sentence}}',
    index: '{{item.index}}',
    type: '{{item.issueType}}',
    detail: '{{item.description}}',
  }
}`}
            preview={
              <div className="text-sm leading-relaxed">
                <p>The system addresses a gap in collaborative writing.
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 text-[9px] font-bold ml-0.5 align-super">1</span>
                </p>
                <p>We propose a framework for intent-aware coordination.
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-100 text-yellow-600 text-[9px] font-bold ml-0.5 align-super">2</span>
                </p>
                <div className="mt-2 border rounded-md p-2 bg-muted/20 text-xs max-w-[200px]">
                  <div className="font-medium text-red-600 mb-1">Missing coverage</div>
                  <div className="text-muted-foreground">No sentences support this intent</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Simulate</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border">Dismiss</span>
                  </div>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="inline-widget"
            location="writing-editor"
            description="Block widget in editor: suggestions with Accept/Dismiss, missing content indicators."
            binding={`{
  type: 'inline-widget',
  when: 'suggestion.content',
  params: {
    anchor: '{{suggestion.insertAfter}}',
    content: '{{suggestion.content}}',
    variant: 'suggestion',
    intentRef: '{{suggestion.intentId}}',
  }
}`}
            preview={
              <div className="text-sm leading-relaxed space-y-2">
                <p className="text-muted-foreground">...collaborative writing where intent and output diverge.</p>
                <div className="border-2 border-dashed border-emerald-300 rounded-md p-3 bg-emerald-50/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Suggested</span>
                    <span className="text-[10px] text-muted-foreground italic">for: Explain the motivation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Prior work on document collaboration has focused on conflict resolution at the text level, but lacks semantic awareness of author intentions.</p>
                  <div className="flex gap-1.5 mt-2">
                    <span className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">Accept</span>
                    <span className="text-[10px] px-2 py-1 rounded border">Dismiss</span>
                  </div>
                </div>
                <p className="text-muted-foreground">We propose a framework for...</p>
              </div>
            }
          />

          <PrimitivePreview
            name="ai-marker"
            location="writing-editor"
            description="Marks a text range as AI-generated with a subtle tint and provenance icon."
            binding={`{
  type: 'ai-marker',
  forEach: 'aiGeneratedRanges',
  params: {
    startAnchor: '{{item.start}}',
    endAnchor: '{{item.end}}',
  }
}`}
            preview={
              <div className="text-sm leading-relaxed">
                <p>The system addresses a gap in collaborative writing.</p>
                <p className="bg-blue-50/50 border-l-2 border-blue-200 pl-2">
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 font-medium mr-1 align-middle">&#10024; AI</span>
                  Prior work has focused primarily on conflict resolution at the text level.
                </p>
              </div>
            }
          />
        </div>

        {/* ── Outline Primitives ── */}
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-8">Outline (left panel)</div>
        <div className="space-y-3">
          <PrimitivePreview
            name="node-icon"
            location="outline-node"
            description="Status icon on intent node. Shows coverage state: covered, partial, missing, ai-covered."
            binding={`{
  type: 'node-icon',
  forEach: 'alignedIntents',
  params: {
    nodeId: '{{item.id}}',
    status: '{{item.coverageStatus}}',
  }
}`}
            preview={
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-500">&#10003;</span>
                  <span>Explain the motivation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500">&#9681;</span>
                  <span>Define key terms</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-400">&#9675;</span>
                  <span>State the research question</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-500">&#10024;</span>
                  <span>Summarize contributions</span>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="node-badge"
            location="outline-node"
            description="Small pill label on an intent node. Multiple badges can stack."
            binding={`{
  type: 'node-badge',
  forEach: 'intents',
  filter: 'item.coverageStatus !== "covered"',
  params: {
    nodeId: '{{item.id}}',
    label: '{{item.coverageStatus}}',
    variant: 'warning',
  }
}`}
            preview={
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">&#9654;</span>
                  <span>Explain the motivation</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">partial</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">&#9654;</span>
                  <span>State the research question</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">missing</span>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="section-alert"
            location="outline-node"
            description="Notification card below a section node. For cross-section impacts and warnings."
            binding={`{
  type: 'section-alert',
  forEach: 'impacts',
  filter: 'item.impactLevel === "significant"',
  params: {
    sectionId: '{{item.sectionId}}',
    title: 'Impact from proposed change',
    message: '{{item.reason}}',
    severity: 'warning',
  }
}`}
            preview={
              <div className="max-w-xs">
                <div className="text-sm font-medium mb-2">&#9654; Related Work</div>
                <div className="ml-4 border-l-2 border-amber-300 bg-amber-50 rounded-r-md px-3 py-2">
                  <div className="text-xs font-semibold text-amber-800">Impact from proposed change</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">Terminology definitions used here must stay consistent with updated Introduction.</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white">Review</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-300 text-amber-700">Dismiss</span>
                  </div>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="summary-bar"
            location="outline-node"
            description="Alignment stats bar. Shows coverage counts and overall alignment level."
            binding={`{
  type: 'summary-bar',
  params: {
    counts: '{{coverageCounts}}',
    level: '{{level}}',
  }
}`}
            preview={
              <div className="border rounded-lg px-3 py-2 bg-muted/20">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">Alignment</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">partial</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[11px]"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 3 covered</span>
                  <span className="flex items-center gap-1 text-[11px]"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> 1 partial</span>
                  <span className="flex items-center gap-1 text-[11px]"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 1 missing</span>
                </div>
              </div>
            }
          />
        </div>

        {/* ── Panel Primitives ── */}
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-8">Panel (right side)</div>
        <div className="space-y-3">
          <PrimitivePreview
            name="result-list"
            location="right-panel"
            description="Expandable card list. Each card has title, badge, detail, and optional action buttons."
            binding={`{
  type: 'result-list',
  forEach: 'impacts',
  filter: 'item.impactLevel !== "none"',
  params: {
    title: '{{item.sectionIntent}}',
    badge: '{{item.impactLevel}}',
    badgeVariant: 'warning',
    detail: '{{item.reason}}',
  }
}`}
            preview={
              <div className="space-y-2 max-w-xs">
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium">Method</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">significant</span>
                  </div>
                  <div className="px-3 py-2 border-t bg-muted/10 text-[11px] text-muted-foreground">Terminology definitions must stay consistent.</div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium">Related Work</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">minor</span>
                  </div>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="diff-view"
            location="right-panel"
            description="Text comparison: word-level inline diff or side-by-side two-column layout."
            binding={`{
  type: 'diff-view',
  params: {
    before: '{{currentPreview}}',
    after: '{{changedPreview}}',
    mode: 'side-by-side',
  }
}`}
            preview={
              <div className="grid grid-cols-2 gap-2 text-[11px] max-w-sm">
                <div className="border rounded p-2 bg-red-50/30">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Before</div>
                  <p>The system addresses <span className="bg-red-200 line-through">performance bottlenecks</span> in collaborative writing.</p>
                </div>
                <div className="border rounded p-2 bg-emerald-50/30">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">After</div>
                  <p>The system addresses <span className="bg-emerald-200 underline">intent alignment gaps</span> in collaborative writing.</p>
                </div>
              </div>
            }
          />

          <PrimitivePreview
            name="action-group"
            location="right-panel"
            description="Standalone button row at panel footer. For top-level actions."
            binding={`{
  type: 'action-group',
  when: 'proposedChanges.length > 0',
  params: {
    actions: '[{"label":"Apply","variant":"primary","action":"apply"},{"label":"Dismiss","variant":"secondary","action":"dismiss"}]',
  }
}`}
            preview={
              <div className="flex gap-2 pt-2 border-t">
                <button className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Apply Changes</button>
                <button className="text-[11px] px-3 py-1.5 rounded-md border">Dismiss</button>
                <button className="text-[11px] px-3 py-1.5 rounded-md border text-red-600 border-red-200">Reject</button>
              </div>
            }
          />
        </div>

        {/* ── Global Primitives ── */}
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-8">Global</div>
        <div className="space-y-3">
          <PrimitivePreview
            name="banner"
            location="global"
            description="Top-of-app notification bar. For document-level status and warnings."
            binding={`{
  type: 'banner',
  when: 'level === "drifted"',
  params: {
    title: 'Drift detected',
    message: '{{summary}}',
    severity: 'warning',
  }
}`}
            preview={
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200">
                <span className="text-amber-500 mt-0.5">&#9888;</span>
                <div>
                  <div className="text-xs font-semibold text-amber-800">Drift detected</div>
                  <div className="text-xs text-amber-700">2 intents have partial coverage, 1 is missing</div>
                </div>
              </div>
            }
          />
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Template syntax: <Code>{"{{item.field}}"}</Code> references the current array item,{' '}
          <Code>{"{{fieldName}}"}</Code> references top-level scalar fields in the result.
        </p>
      </section>

      {/* ─── Full Examples ─── */}
      <section>
        <SectionTitle>Complete Examples</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4">Two end-to-end examples showing how input, logic, output, and UI fit together.</p>

        <div className="text-xs font-semibold mb-2">A. Rule-based &mdash; Intent Word Limit</div>
        <p className="text-xs text-muted-foreground mb-3">
          Check if each section&apos;s writing exceeds 200 words. Badge on the intent, banner at the top.
        </p>
        <CodeBlock>{`import { registerFunction, type FunctionInput } from '@/lib/function-protocol';
import { getSections, getWriting } from '@/lib/data-model';

registerFunction({
  id: 'intent-word-limit',
  name: 'Intent Word Limit',
  description: 'Flag sections whose writing exceeds a word limit.',
  icon: 'Hash',
  trigger: 'detection',
  requires: { writing: true },

  executor: 'local',
  fn: (input: FunctionInput) => {
    const { snapshot, config } = input;
    const limit = (config.wordLimit as number) ?? 200;
    const violations = getSections(snapshot)
      .map(section => {
        const w = getWriting(snapshot, section.id);
        return { sectionId: section.id, intent: section.content, wordCount: w?.wordCount ?? 0, limit };
      })
      .filter(v => v.wordCount > v.limit);

    return {
      functionId: 'intent-word-limit',
      data: { violations, total: violations.length },
      ui: [],
      computedAt: Date.now(),
    };
  },

  outputSchema: {
    violations: "Array<{ sectionId, intent, wordCount, limit }>",
    total: "number",
  },

  ui: [
    {
      type: 'inline-badge',
      forEach: 'violations',
      attachTo: '{{item.sectionId}}',
      label: '{{item.wordCount}}/{{item.limit}} words',
      variant: 'warning',
    },
    {
      type: 'banner',
      when: 'total > 0',
      title: 'Word limit exceeded',
      message: '{{total}} section(s) over the {{violations[0].limit}}-word limit',
      severity: 'warning',
    },
  ],

  configFields: [
    { type: 'number', key: 'wordLimit', label: 'Word limit', min: 50, max: 5000, unit: 'words' },
  ],
  defaultConfig: { wordLimit: 200 },
});`}</CodeBlock>

        <div className="text-xs font-semibold mb-2 mt-6">B. Prompt-based &mdash; Sentence Alignment Check</div>
        <p className="text-xs text-muted-foreground mb-3">
          Developer writes a prompt to evaluate whether each sentence serves its intent.
          Platform calls AI, parses the response, and renders sentence-level highlights.
        </p>
        <CodeBlock>{`import { registerFunction } from '@/lib/function-protocol';

registerFunction({
  id: 'check-sentence-alignment',
  name: 'Sentence Alignment',
  description: 'Check if each sentence accurately reflects its intent.',
  icon: 'ScanSearch',
  trigger: 'detection',
  requires: { writing: true },

  executor: 'prompt',
  prompt: {
    system: \`You check whether each sentence in the writing serves its parent intent.

For each sentence, determine:
- "aligned": sentence directly supports the intent
- "partial": loosely related but doesn't fully address it
- "off-topic": sentence doesn't belong under this intent

Return JSON:
{
  "sentences": [
    { "text": "the sentence", "intentId": "id", "status": "aligned|partial|off-topic", "reason": "why" }
  ],
  "alignedCount": number,
  "totalCount": number
}\`,
    user: \`## Intents
{{nodes}}

## Writing
{{writing}}\`,
  },

  // The output shape the AI must return — platform validates this
  outputSchema: {
    sentences: \`Array<{
      text: string,
      intentId: string,
      status: 'aligned' | 'partial' | 'off-topic',
      reason: string,
    }>\`,
    alignedCount: "number",
    totalCount: "number",
  },

  // How the parsed results render in the UI
  ui: [
    // Highlight misaligned sentences in the writing editor
    {
      type: 'inline-highlight',
      forEach: 'sentences',
      filter: 'item.status !== "aligned"',
      startAnchor: '{{item.text}}',
      endAnchor: '{{item.text}}',
      color: '{{item.status === "off-topic" ? "red" : "yellow"}}',
    },
    // Badge on the intent node for off-topic sentences
    {
      type: 'inline-badge',
      forEach: 'sentences',
      filter: 'item.status === "off-topic"',
      attachTo: '{{item.intentId}}',
      label: 'Off-topic',
      variant: 'destructive',
    },
    // Summary banner
    {
      type: 'banner',
      when: 'alignedCount < totalCount',
      title: 'Alignment issues',
      message: '{{totalCount - alignedCount}} of {{totalCount}} sentences need attention',
      severity: 'warning',
    },
  ],

  configFields: [],
  defaultConfig: {},
});`}</CodeBlock>
      </section>

      {/* ─── Register a new function ─── */}
      <section>
        <SectionTitle>Register a Function</SectionTitle>
        <RegisterFunctionSection onRegistered={onRegistered} />
      </section>

      {/* Registered functions by trigger */}
      {(["detection", "proposal", "on-demand"] as const).map(trigger => {
        const items = grouped[trigger];
        if (items.length === 0) return null;
        return (
          <section key={trigger}>
            <SectionTitle>
              {trigger === 'detection' ? 'Detection' : trigger === 'proposal' ? 'Proposal' : 'On-demand'}
              {' '}<span className="text-muted-foreground font-normal">({items.length})</span>
            </SectionTitle>
            <p className="text-xs text-muted-foreground mb-3">
              {trigger === 'detection' && 'Run during or after writing to check alignment.'}
              {trigger === 'proposal' && 'Run when a writer proposes a change to analyze impact.'}
              {trigger === 'on-demand' && 'Invoked explicitly by user action.'}
            </p>
            <div className="space-y-3">
              {items.map(fn => (
                <FunctionCard key={fn.id} func={fn} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Data Slots Tab ───

function DataSlotsTab() {
  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Every function receives a <Code>DocumentSnapshot</Code> — a read-only view of the
          document&apos;s current state. It contains the outline, writing, dependencies, and team info.
          Functions declare which parts they need via <Code>requires</Code>.
        </p>
        <div className="mt-3">
          <CodeBlock>{`// What your function receives:
type FunctionInput = {
  snapshot: DocumentSnapshot;   // full current state
  focus?: FunctionFocus;        // optional: specific target (section, intent)
  config: Record<string, unknown>;  // team-configured options
};`}</CodeBlock>
        </div>
      </section>

      {/* Outline */}
      <section>
        <SectionTitle>snapshot.nodes <span className="text-muted-foreground font-normal">— Outline</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          The hierarchical intent structure. Sections are root nodes (parentId = null),
          intents are children. Always available.
        </p>
        <TypeBlock title="OutlineNode" fields={[
          ["id", "string", "Unique identifier"],
          ["content", "string", "The intent text"],
          ["position", "number", "Sort order among siblings"],
          ["parentId", "string | null", "null = section (root), otherwise child"],
          ["level", "number", "0 = section, 1+ = nested intent"],
          ["createdBy", "Attribution", "{ userId, userName, at }"],
          ["modifiedBy?", "Attribution", "Present only if edited after creation"],
        ]} />
        <div className="mt-2" />
        <TypeBlock title="SectionAssignment (snapshot.assignments)" fields={[
          ["sectionId", "string", "Root node ID"],
          ["assigneeId", "string", "User ID of the owner"],
          ["assigneeName", "string", "Display name"],
          ["assigneeEmail?", "string", "Email"],
        ]} />
        <div className="mt-3 text-xs text-muted-foreground">
          Helpers: <Code>getSections(snapshot)</Code> <Code>getChildren(snapshot, parentId)</Code> <Code>getAssignee(snapshot, sectionId)</Code>
        </div>
      </section>

      {/* Writing */}
      <section>
        <SectionTitle>snapshot.writing <span className="text-muted-foreground font-normal">— Writing Content</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          One entry per section. Includes HTML, plain text, word count, and per-paragraph attribution.
          Available in writing phase. Declare <Code>requires: {"{ writing: true }"}</Code> to use.
        </p>
        <TypeBlock title="WritingContent" fields={[
          ["sectionId", "string", "Which section this writing belongs to"],
          ["html", "string", "HTML content from the editor"],
          ["text", "string", "Plain text (for word count, search)"],
          ["wordCount", "number", "Word count"],
          ["paragraphs", "ParagraphAttribution[]", "Who last edited each paragraph"],
        ]} />
        <div className="mt-2" />
        <TypeBlock title="ParagraphAttribution" fields={[
          ["index", "number", "Paragraph index (0-based)"],
          ["textPrefix", "string", "First ~50 chars (for matching)"],
          ["lastEditBy", "Attribution", "{ userId, userName, at }"],
        ]} />
        <div className="mt-3 text-xs text-muted-foreground">
          Helper: <Code>getWriting(snapshot, sectionId)</Code>
        </div>
      </section>

      {/* Dependencies */}
      <section>
        <SectionTitle>snapshot.dependencies <span className="text-muted-foreground font-normal">— Relationships</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          Relationships between outline nodes. Declare <Code>requires: {"{ dependencies: true }"}</Code> to use.
        </p>
        <TypeBlock title="OutlineDependency" fields={[
          ["id", "string", "Dependency ID"],
          ["fromId", "string", "Source node"],
          ["toId", "string", "Target node"],
          ["type", "string", "'depends-on' | 'must-be-consistent' | 'builds-upon' | ..."],
          ["label", "string", "Human-readable label"],
          ["direction", "'directed' | 'bidirectional'", ""],
          ["source", "'manual' | 'ai-suggested' | 'ai-confirmed'", "How it was created"],
          ["confirmed", "boolean", "Whether team has confirmed this"],
        ]} />
      </section>

      {/* Team */}
      <section>
        <SectionTitle>snapshot.members <span className="text-muted-foreground font-normal">— Team</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          Team members and current user. Declare <Code>requires: {"{ members: true }"}</Code> to use.
        </p>
        <TypeBlock title="DocumentMember" fields={[
          ["userId", "string", ""],
          ["name", "string", "Display name"],
          ["email?", "string", ""],
          ["role", "'owner' | 'editor' | 'viewer'", ""],
        ]} />
        <div className="mt-3 text-xs text-muted-foreground">
          Also available: <Code>snapshot.currentUserId</Code>
        </div>
      </section>

      {/* Meta */}
      <section>
        <SectionTitle>snapshot.documentId, snapshot.phase <span className="text-muted-foreground font-normal">— Meta</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          Document metadata. Always available.
        </p>
        <TypeBlock title="Meta fields" fields={[
          ["documentId", "string", "Document ID"],
          ["phase", "'setup' | 'writing'", "Current document phase"],
        ]} />
      </section>

      {/* Focus (optional) */}
      <section>
        <SectionTitle>focus <span className="text-muted-foreground font-normal">— Optional Target</span></SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">
          When a function targets a specific section or intent (e.g. during a proposal),
          it also receives a <Code>FunctionFocus</Code>.
        </p>
        <TypeBlock title="FunctionFocus" fields={[
          ["sectionId", "string", "The section being analyzed"],
          ["intentId?", "string", "Specific intent within the section"],
          ["proposedChanges?", "ProposedChange[]", "Changes to evaluate"],
          ["extra?", "Record<string, unknown>", "Function-specific context"],
        ]} />
      </section>
    </div>
  );
}

// ─── Paths Tab ───

function PathsTab({ paths }: { paths: CoordinationPathDefinition[] }) {
  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          A <strong>coordination path</strong> defines how the team handles a proposed change.
          Each path declares roles, actions, and resolution rules.
        </p>
      </section>

      <section>
        <SectionTitle>Register a new coordination path</SectionTitle>
        <CodeBlock>{`import { registerCoordinationPath } from '@/lib/coordination-protocol';

registerCoordinationPath({
  id: 'approval',
  name: 'Manager Approval',
  description: 'A designated approver reviews and decides.',
  icon: 'ShieldCheck',
  color: 'emerald',              // blue | emerald | indigo | amber

  roles: [
    { id: 'proposer', label: 'Proposer', description: 'Person proposing', assignment: 'proposer' },
    { id: 'approver', label: 'Approver', description: 'Designated reviewer', assignment: 'config-designated' },
  ],

  actions: [
    { id: 'approve', label: 'Approve', icon: 'Check', availableTo: ['approver'], effect: 'approve' },
    { id: 'reject', label: 'Reject', icon: 'X', availableTo: ['approver'], effect: 'reject' },
  ],

  resolution: { type: 'single-approval' },

  configFields: [],
  defaultConfig: { approver: 'section-owner' },
  proposerSummary: 'A designated approver will review your change.',
  receiverSummary: 'You are asked to approve or reject a proposed change.',
});

// Then wire UI in lib/coordination-ui.ts:
// ICON_MAP: { ..., ShieldCheck }
// PATH_LABELS: { approval: { receiverLabel, ctaLabel, actionText } }`}</CodeBlock>
      </section>

      <section>
        <SectionTitle>Registered Paths <span className="text-muted-foreground font-normal">({paths.length})</span></SectionTitle>
        <div className="space-y-3">
          {paths.map(path => (
            <PathCard key={path.id} path={path} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Type Reference</SectionTitle>
        <TypeBlock title="ResolutionRule" fields={[
          ["type", "'immediate' | 'single-approval' | 'threshold' | 'proposer-closes' | 'timeout'", "Resolution strategy"],
          ["thresholdOptions?", "('any' | 'majority' | 'all')[]", "For threshold type"],
          ["allowTimeout?", "boolean", "Whether timeout is configurable"],
        ]} />
      </section>
    </div>
  );
}

// ─── Register Function Section (Form + Code toggle) ───

function RegisterFunctionSection({ onRegistered }: { onRegistered: () => void }) {
  const [mode, setMode] = useState<'form' | 'code'>('form');

  return (
    <div>
      <div className="flex gap-1 mb-4 border rounded-md p-0.5 w-fit bg-muted/30">
        <button
          onClick={() => setMode('form')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            mode === 'form' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Form
        </button>
        <button
          onClick={() => setMode('code')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            mode === 'code' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Code
        </button>
      </div>
      {mode === 'form' ? (
        <RegisterFunctionForm onRegistered={onRegistered} />
      ) : (
        <CodeRegisterPanel onRegistered={onRegistered} />
      )}
    </div>
  );
}

// ─── Code Register Panel ───

const CODE_TEMPLATES: Record<string, { label: string; code: string }> = {
  'word-count': {
    label: 'Paragraph Word Count (local)',
    code: `import { registerFunction } from '@/platform/functions/protocol';

registerFunction({
  id: 'paragraph-word-count',
  name: 'Paragraph Word Count',
  description: 'Check each paragraph against a word limit. Highlights paragraphs that are too long.',
  icon: 'Hash',
  trigger: 'detection',

  requires: {
    writing: true,
  },

  executor: 'local',
  fn: (input) => {
    const limit = Number(input.config.limit) || 40;
    const paragraphs = [];

    for (const w of input.snapshot.writing) {
      const paras = w.text.split('\\n\\n').filter(p => p.trim());
      for (const para of paras) {
        const wordCount = para.split(/\\s+/).length;
        paragraphs.push({
          sectionId: w.sectionId,
          text: para.slice(0, 60) + (para.length > 60 ? '...' : ''),
          wordCount,
          limit,
          over: wordCount > limit,
        });
      }
    }

    const overCount = paragraphs.filter(p => p.over).length;
    return {
      data: { paragraphs, overCount, totalCount: paragraphs.length },
    };
  },

  outputSchema: {
    paragraphs: 'Array<{ sectionId, text, wordCount, limit, over }>',
    overCount: 'number',
    totalCount: 'number',
  },

  ui: [
    {
      type: 'sentence-highlight',
      forEach: 'paragraphs',
      filter: 'item.over',
      params: {
        startAnchor: '{{item.text}}',
        color: 'red',
        tooltip: '{{item.wordCount}}/{{item.limit}} words',
      },
    },
    {
      type: 'banner',
      when: 'overCount > 0',
      params: {
        title: 'Word count issues',
        message: '{{overCount}} of {{totalCount}} paragraphs exceed the limit',
        severity: 'warning',
      },
    },
  ],

  configFields: [
    {
      type: 'number', key: 'limit', label: 'Word limit per paragraph',
      min: 10, max: 500,
    },
  ],
  defaultConfig: { limit: 40 },
});`,
  },
  'grammar-check': {
    label: 'Grammar Check (AI prompt)',
    code: `import { registerFunction } from '@/platform/functions/protocol';

registerFunction({
  id: 'grammar-check',
  name: 'Grammar Check',
  description: 'AI-powered grammar and style checker. Highlights issues at the sentence level.',
  icon: 'Pencil',
  trigger: 'detection',

  requires: {
    writing: true,
  },

  executor: 'prompt',
  prompt: {
    system: \`You are a grammar and style checker for academic writing.

Analyze the writing and find grammar errors, awkward phrasing, and style issues.

Return JSON:
{
  "issues": [
    {
      "sentence": "the exact sentence with the issue",
      "type": "grammar" | "style" | "clarity" | "punctuation",
      "description": "what's wrong",
      "suggestion": "corrected version"
    }
  ],
  "summary": "brief overall assessment"
}\`,
    user: \`## Writing to check

{{writing}}\`,
    temperature: 0.2,
  },

  outputSchema: {
    issues: 'Array<{ sentence, type, description, suggestion }>',
    summary: 'string',
  },

  ui: [
    {
      type: 'sentence-highlight',
      forEach: 'issues',
      params: {
        startAnchor: '{{item.sentence}}',
        color: '{{item.type}}',
        tooltip: '{{item.description}} → {{item.suggestion}}',
      },
    },
    {
      type: 'banner',
      when: 'issues.length > 0',
      params: {
        title: 'Grammar Check',
        message: '{{summary}}',
        severity: 'info',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});`,
  },
  'blank': {
    label: 'Blank template',
    code: `import { registerFunction } from '@/platform/functions/protocol';

registerFunction({
  id: 'my-function',
  name: 'My Function',
  description: 'What this function does',
  icon: 'Sparkles',
  trigger: 'detection',

  requires: {
    writing: true,
  },

  executor: 'prompt',
  prompt: {
    system: \`Your system instruction here.

Return JSON:
{ "items": [...], "summary": "..." }\`,
    user: \`## Intents
{{nodes}}

## Writing
{{writing}}\`,
  },

  outputSchema: {
    items: 'Array<{ text: string, status: string }>',
    summary: 'string',
  },

  ui: [],
  configFields: [],
  defaultConfig: {},
});`,
  },
};

function CodeRegisterPanel({ onRegistered }: { onRegistered: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('word-count');
  const [code, setCode] = useState(CODE_TEMPLATES['word-count'].code);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleTemplateChange = (key: string) => {
    setSelectedTemplate(key);
    setCode(CODE_TEMPLATES[key].code);
    setStatus(null);
  };

  const handleExecute = async () => {
    setStatus(null);
    try {
      // 1. Register in memory (eval the code)
      const fn = new Function('registerFunction', code.replace(/import.*from.*;\n?/g, ''));
      fn(registerFunction);

      // 2. Extract function ID from code
      const idMatch = code.match(/id:\s*['"`]([^'"`]+)['"`]/);
      const funcId = idMatch?.[1];

      if (!funcId) {
        setStatus({ type: 'error', message: 'Could not extract function ID from code' });
        return;
      }

      // 3. Save to file (persist)
      const res = await fetch('/api/dev/save-function', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: funcId, code }),
      });

      if (!res.ok) {
        const err = await res.json();
        setStatus({ type: 'error', message: `Registered in memory but failed to save file: ${err.error}` });
        onRegistered();
        return;
      }

      const result = await res.json();
      setStatus({ type: 'success', message: `Saved to ${result.path}` });
      onRegistered();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ type: 'error', message });
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-400">Template:</span>
          <div className="flex gap-1">
            {Object.entries(CODE_TEMPLATES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => handleTemplateChange(key)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  selectedTemplate === key
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        spellCheck={false}
        className="w-full text-[12px] font-mono bg-zinc-950 text-zinc-100 px-4 py-3 leading-relaxed resize-y focus:outline-none"
        rows={30}
      />
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-950 border-t border-zinc-800">
        <button
          onClick={handleExecute}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-3.5 w-3.5" />
          Execute
        </button>
        {status && (
          <span className={`text-xs flex items-center gap-1 ${status.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {status.type === 'success' ? <Check className="h-3.5 w-3.5" /> : null}
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Register Function Form ───

type BindingDraft = {
  type: string;
  forEach: string;
  filter: string;
  when: string;
  params: Record<string, string>;
};

function RegisterFunctionForm({ onRegistered }: { onRegistered: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<'detection' | 'proposal' | 'on-demand'>('detection');
  const [reqWriting, setReqWriting] = useState(true);
  const [reqDeps, setReqDeps] = useState(false);
  const [reqMembers, setReqMembers] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('## Intents\n{{nodes}}\n\n## Writing\n{{writing}}');
  const [outputFields, setOutputFields] = useState<Array<{ key: string; type: string }>>([
    { key: '', type: '' },
  ]);
  const [bindings, setBindings] = useState<BindingDraft[]>([]);
  const [registered, setRegistered] = useState(false);

  const primitives = getAllPrimitives();

  const handleAddBinding = () => {
    setBindings([...bindings, { type: 'banner', forEach: '', filter: '', when: '', params: {} }]);
  };

  const handleRemoveBinding = (idx: number) => {
    setBindings(bindings.filter((_, i) => i !== idx));
  };

  const handleBindingChange = (idx: number, field: string, value: string) => {
    const updated = [...bindings];
    (updated[idx] as any)[field] = value;
    setBindings(updated);
  };

  const handleBindingParamChange = (idx: number, key: string, value: string) => {
    const updated = [...bindings];
    updated[idx].params = { ...updated[idx].params, [key]: value };
    setBindings(updated);
  };

  const handleRegister = () => {
    if (!id || !name || !systemPrompt) return;

    const outputSchema: Record<string, string> = {};
    for (const f of outputFields) {
      if (f.key) outputSchema[f.key] = f.type;
    }

    const ui: UIBinding[] = bindings.map(b => {
      const binding: UIBinding = { type: b.type, params: b.params };
      if (b.forEach) binding.forEach = b.forEach;
      if (b.filter) binding.filter = b.filter;
      if (b.when) binding.when = b.when;
      return binding;
    });

    registerFunction({
      id,
      name,
      description,
      icon: 'Sparkles',
      trigger,
      requires: {
        writing: reqWriting,
        dependencies: reqDeps,
        members: reqMembers,
      },
      executor: 'prompt',
      prompt: {
        system: systemPrompt,
        user: userPrompt,
      },
      outputSchema,
      ui,
      configFields: [],
      defaultConfig: {},
    });

    setRegistered(true);
    onRegistered();
    setTimeout(() => setRegistered(false), 3000);
  };

  return (
    <div className="border rounded-lg p-5 space-y-5">
      {/* ── Meta ── */}
      <div className="grid grid-cols-3 gap-3">
        <FieldInput label="ID" placeholder="my-function" value={id} onChange={setId} />
        <FieldInput label="Name" placeholder="My Function" value={name} onChange={setName} />
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Trigger</label>
          <select
            value={trigger}
            onChange={e => setTrigger(e.target.value as typeof trigger)}
            className="mt-1 w-full text-xs border rounded-md px-2 py-1.5 bg-background"
          >
            <option value="detection">Detection</option>
            <option value="proposal">Proposal</option>
            <option value="on-demand">On-demand</option>
          </select>
        </div>
      </div>
      <FieldInput label="Description" placeholder="What this function does" value={description} onChange={setDescription} />

      {/* ── Requires ── */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Data Required</label>
        <div className="flex gap-4 mt-1.5">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={reqWriting} onChange={e => setReqWriting(e.target.checked)} className="rounded" />
            writing
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={reqDeps} onChange={e => setReqDeps(e.target.checked)} className="rounded" />
            dependencies
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={reqMembers} onChange={e => setReqMembers(e.target.checked)} className="rounded" />
            members
          </label>
        </div>
      </div>

      {/* ── Prompt ── */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={6}
          placeholder="You analyze writing against intents...&#10;&#10;Return JSON:&#10;{ &quot;sentences&quot;: [...], &quot;summary&quot;: &quot;...&quot; }"
          className="mt-1 w-full text-xs font-mono border rounded-md px-3 py-2 bg-background resize-y"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          User Prompt Template
          <span className="font-normal text-muted-foreground/60 ml-2">
            {"{{nodes}} {{writing}} {{dependencies}} {{focus}} {{config}}"}
          </span>
        </label>
        <textarea
          value={userPrompt}
          onChange={e => setUserPrompt(e.target.value)}
          rows={4}
          className="mt-1 w-full text-xs font-mono border rounded-md px-3 py-2 bg-background resize-y"
        />
      </div>

      {/* ── Output Schema ── */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Output Schema</label>
          <button onClick={() => setOutputFields([...outputFields, { key: '', type: '' }])} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add field
          </button>
        </div>
        <div className="space-y-1.5 mt-1.5">
          {outputFields.map((field, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={field.key}
                onChange={e => {
                  const updated = [...outputFields];
                  updated[i].key = e.target.value;
                  setOutputFields(updated);
                }}
                placeholder="field name"
                className="flex-1 text-xs font-mono border rounded-md px-2 py-1.5 bg-background"
              />
              <input
                value={field.type}
                onChange={e => {
                  const updated = [...outputFields];
                  updated[i].type = e.target.value;
                  setOutputFields(updated);
                }}
                placeholder="type (e.g. Array<{ text, status }>, string, number)"
                className="flex-[2] text-xs font-mono border rounded-md px-2 py-1.5 bg-background"
              />
              <button onClick={() => setOutputFields(outputFields.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── UI Bindings ── */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">UI Bindings</label>
          <button onClick={handleAddBinding} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add binding
          </button>
        </div>
        <div className="space-y-3 mt-2">
          {bindings.map((binding, i) => {
            const primDef = primitives.find(p => p.type === binding.type);
            return (
              <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <select
                    value={binding.type}
                    onChange={e => handleBindingChange(i, 'type', e.target.value)}
                    className="text-xs border rounded-md px-2 py-1 bg-background font-mono"
                  >
                    {primitives.map(p => (
                      <option key={p.type} value={p.type}>{p.type}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground flex-1">{primDef?.description}</span>
                  <button onClick={() => handleRemoveBinding(i)} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {primDef?.supportsIteration && (
                  <div className="grid grid-cols-2 gap-2">
                    <FieldInput label="forEach" placeholder="e.g. sentences" value={binding.forEach} onChange={v => handleBindingChange(i, 'forEach', v)} mono />
                    <FieldInput label="filter" placeholder="e.g. item.status !== 'aligned'" value={binding.filter} onChange={v => handleBindingChange(i, 'filter', v)} mono />
                  </div>
                )}

                {!primDef?.supportsIteration && (
                  <FieldInput label="when" placeholder="e.g. alignedCount < totalCount" value={binding.when} onChange={v => handleBindingChange(i, 'when', v)} mono />
                )}

                <div>
                  <label className="text-[10px] text-muted-foreground">Params</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {primDef?.params.map(p => (
                      <FieldInput
                        key={p.key}
                        label={`${p.key}${p.required ? '' : '?'}`}
                        placeholder={p.description}
                        value={binding.params[p.key] || ''}
                        onChange={v => handleBindingParamChange(i, p.key, v)}
                        mono
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {bindings.length === 0 && (
            <p className="text-xs text-muted-foreground">No UI bindings yet. Your function will run but won&apos;t render anything.</p>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2 border-t">
        <button
          onClick={handleRegister}
          disabled={!id || !name || !systemPrompt}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play className="h-3.5 w-3.5" />
          Register Function
        </button>
        {registered && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> Registered — see it below in the function list
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Primitive Renderers ───
// Render ResolvedPrimitive output as actual visual UI for Test Run previews.

const PRIM_RENDERER: Record<string, React.FC<{ params: Record<string, string> }>> = {
  'banner': ({ params }) => {
    const s = params.severity || 'info';
    const style = { warning: 'bg-amber-50 border-amber-200 text-amber-900', error: 'bg-red-50 border-red-200 text-red-900', info: 'bg-blue-50 border-blue-200 text-blue-900', success: 'bg-emerald-50 border-emerald-200 text-emerald-900' }[s] || 'bg-muted border';
    const icon = { warning: '\u26A0', error: '\u2715', info: '\u2139', success: '\u2713' }[s] || '\u2139';
    return (<div className={`flex items-start gap-2.5 px-4 py-3 border-b text-xs ${style}`}><span className="text-base leading-none mt-0.5">{icon}</span><div className="flex-1"><div className="font-semibold text-[13px]">{params.title}</div><div className="mt-0.5 opacity-80">{params.message}</div></div></div>);
  },

  'sentence-highlight': ({ params }) => {
    const color = params.color || 'yellow';
    const bg = { red: 'bg-red-100 border-red-300', yellow: 'bg-yellow-100 border-yellow-300', green: 'bg-emerald-100 border-emerald-300', blue: 'bg-blue-100 border-blue-300', orange: 'bg-orange-100 border-orange-300' }[color] || 'bg-yellow-100 border-yellow-300';
    const dot = { red: 'bg-red-400', yellow: 'bg-yellow-400', green: 'bg-emerald-400', blue: 'bg-blue-400', orange: 'bg-orange-400' }[color] || 'bg-yellow-400';
    return (<div className={`rounded border px-3 py-2 ${bg}`}><div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} /><span className="text-xs">{params.startAnchor}</span></div>{params.tooltip && <div className="text-[11px] text-muted-foreground mt-1 ml-4">{params.tooltip}</div>}</div>);
  },

  'issue-dot': ({ params }) => {
    const typeColor = { partial: 'bg-yellow-100 text-yellow-600', missing: 'bg-red-100 text-red-600', orphan: 'bg-orange-100 text-orange-600', conflict: 'bg-purple-100 text-purple-600' }[params.type] || 'bg-muted text-muted-foreground';
    return (<div className="flex items-center gap-2 px-3 py-1.5"><span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${typeColor}`}>{params.index}</span><span className="text-xs">{params.anchor?.slice(0, 50)}</span>{params.detail && <span className="text-[11px] text-muted-foreground ml-auto">{params.detail}</span>}</div>);
  },

  'inline-widget': ({ params }) => {
    const variantStyle = { suggestion: 'border-emerald-300 bg-emerald-50/50', missing: 'border-red-300 bg-red-50/50 border-dashed', info: 'border-blue-300 bg-blue-50/50' }[params.variant] || 'border bg-muted/10';
    const badge = { suggestion: 'bg-emerald-100 text-emerald-700', missing: 'bg-red-100 text-red-700', info: 'bg-blue-100 text-blue-700' }[params.variant] || 'bg-muted';
    return (<div className={`border-2 rounded-md p-3 ${variantStyle}`}><div className="flex items-center gap-1.5 mb-1.5"><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge}`}>{params.variant}</span>{params.intentRef && <span className="text-[10px] text-muted-foreground italic">for: {params.intentRef}</span>}</div><div className="text-xs text-muted-foreground">{params.content}</div></div>);
  },

  'ai-marker': ({ params }) => {
    return (<div className="bg-blue-50/50 border-l-2 border-blue-200 pl-2 px-3 py-1.5"><span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 font-medium mr-1">{'\u2728'} AI</span><span className="text-xs">{params.startAnchor}</span></div>);
  },

  'node-icon': ({ params }) => {
    const icon = { covered: '\u2713', partial: '\u25D1', missing: '\u25CB', 'ai-covered': '\u2728' }[params.status] || '\u25CB';
    const color = { covered: 'text-emerald-500', partial: 'text-yellow-500', missing: 'text-red-400', 'ai-covered': 'text-blue-500' }[params.status] || 'text-muted-foreground';
    return (<div className="flex items-center gap-2 px-3 py-1"><span className={color}>{icon}</span><span className="text-xs font-mono text-muted-foreground">{params.nodeId}</span>{params.tooltip && <span className="text-[11px] text-muted-foreground ml-auto">{params.tooltip}</span>}</div>);
  },

  'node-badge': ({ params }) => {
    const style = { new: 'bg-emerald-100 text-emerald-700 border-emerald-200', modified: 'bg-blue-100 text-blue-700 border-blue-200', removed: 'bg-red-100 text-red-700 border-red-200', info: 'bg-muted text-muted-foreground border', warning: 'bg-yellow-100 text-yellow-700 border-yellow-200' }[params.variant] || 'bg-muted text-muted-foreground border';
    return (<div className="flex items-center gap-2 px-3 py-1"><span className="text-xs font-mono text-muted-foreground">{params.nodeId}</span><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${style}`}>{params.label}</span></div>);
  },

  'section-alert': ({ params }) => {
    const borderColor = { warning: 'border-amber-300 bg-amber-50', error: 'border-red-300 bg-red-50', info: 'border-blue-300 bg-blue-50', success: 'border-emerald-300 bg-emerald-50' }[params.severity] || 'border bg-muted/20';
    return (<div className={`border-l-2 rounded-r-md px-3 py-2 ${borderColor}`}><div className="text-xs font-semibold">{params.title}</div><div className="text-[11px] text-muted-foreground mt-0.5">{params.message}</div><div className="text-[10px] font-mono text-muted-foreground/50 mt-1">section: {params.sectionId}</div></div>);
  },

  'summary-bar': ({ params }) => {
    let counts: Record<string, number> = {};
    try { counts = JSON.parse(params.counts); } catch { /* ignore */ }
    const dotColor: Record<string, string> = { covered: 'bg-emerald-500', partial: 'bg-yellow-500', missing: 'bg-red-500', 'ai-covered': 'bg-blue-500' };
    return (<div className="border rounded-lg px-3 py-2 bg-muted/20"><div className="flex items-center gap-2 text-xs"><span className="font-medium">Alignment</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${params.level === 'aligned' ? 'bg-emerald-100 text-emerald-700' : params.level === 'drifted' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{params.level}</span></div><div className="flex items-center gap-3 mt-1.5">{Object.entries(counts).map(([k, v]) => (<span key={k} className="flex items-center gap-1 text-[11px]"><span className={`w-2 h-2 rounded-full inline-block ${dotColor[k] || 'bg-muted-foreground'}`} />{v} {k}</span>))}</div></div>);
  },

  'result-list': ({ params }) => {
    const badgeStyle = { new: 'bg-emerald-100 text-emerald-700', modified: 'bg-blue-100 text-blue-700', removed: 'bg-red-100 text-red-700', warning: 'bg-amber-100 text-amber-700', info: 'bg-muted text-muted-foreground', significant: 'bg-amber-100 text-amber-700', minor: 'bg-blue-100 text-blue-700' }[params.badgeVariant || params.badge] || 'bg-muted text-muted-foreground';
    return (<div className="border rounded-md overflow-hidden"><div className="flex items-center justify-between px-3 py-2"><span className="text-xs font-medium truncate">{params.title}</span>{params.badge && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeStyle}`}>{params.badge}</span>}</div>{params.detail && <div className="px-3 py-2 border-t bg-muted/10 text-[11px] text-muted-foreground">{params.detail}</div>}</div>);
  },

  'diff-view': ({ params }) => {
    return (<div className="grid grid-cols-2 gap-2 text-[11px]"><div className="border rounded p-2 bg-red-50/30"><div className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Before</div><p>{params.before}</p></div><div className="border rounded p-2 bg-emerald-50/30"><div className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">After</div><p>{params.after}</p></div></div>);
  },

  'action-group': ({ params }) => {
    let actions: Array<{ label: string; variant: string }> = [];
    try { actions = JSON.parse(params.actions); } catch { /* ignore */ }
    return (<div className="flex gap-2 pt-2 border-t">{actions.map((a, i) => (<button key={i} className={`text-[11px] px-3 py-1.5 rounded-md ${a.variant === 'primary' ? 'bg-primary text-primary-foreground' : a.variant === 'destructive' ? 'border text-red-600 border-red-200' : 'border'}`}>{a.label}</button>))}</div>);
  },
};

/** Render a single ResolvedPrimitive using the appropriate renderer */
function RenderPrimitive({ prim }: { prim: ResolvedPrimitive }) {
  const Renderer = PRIM_RENDERER[prim.type];
  if (!Renderer) {
    return <div className="text-[11px] text-muted-foreground font-mono px-3 py-1">[{prim.type}] {JSON.stringify(prim.params)}</div>;
  }
  return <Renderer params={prim.params} />;
}

function FieldInput({ label, placeholder, value, onChange, mono }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; mono?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full text-xs border rounded-md px-2 py-1.5 bg-background ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

// ─── Cards ───

// Mock snapshot for testing functions
const now = Date.now();
const mockAttribution = { userId: 'user-1', userName: 'Alice', at: now };

const MOCK_SNAPSHOT: DocumentSnapshot = {
  documentId: 'mock-doc',
  currentUserId: 'user-1',
  phase: 'writing',
  nodes: [
    { id: 'sec-1', content: 'Introduction', parentId: null, position: 0, level: 0, createdBy: mockAttribution },
    { id: 'intent-1a', content: 'Motivate the problem with a real-world example', parentId: 'sec-1', position: 0, level: 1, createdBy: mockAttribution },
    { id: 'intent-1b', content: 'State the research question clearly', parentId: 'sec-1', position: 1, level: 1, createdBy: mockAttribution },
    { id: 'sec-2', content: 'Related Work', parentId: null, position: 1, level: 0, createdBy: mockAttribution },
    { id: 'intent-2a', content: 'Compare with existing approaches', parentId: 'sec-2', position: 0, level: 1, createdBy: mockAttribution },
  ],
  writing: [
    {
      sectionId: 'sec-1',
      html: '',
      text: 'Collaborative writing is hard. When multiple authors work on the same document, they often lose track of each other\'s intentions. This leads to inconsistencies and conflicts that are difficult to resolve.\n\nOur system addresses this by introducing intent-aware coordination. We propose a framework where each section of a document is grounded in explicit intents, and changes are evaluated against these intents before being applied. The key research question is: how can we automate the detection of intent drift in collaborative documents?',
      wordCount: 72,
      paragraphs: [],
    },
    {
      sectionId: 'sec-2',
      html: '',
      text: 'Previous work on collaborative writing has focused primarily on conflict resolution at the text level. Systems like Google Docs and Notion provide real-time synchronization but lack semantic awareness of author intentions. Track changes in Microsoft Word offers a review workflow but does not connect changes to the document\'s underlying goals.',
      wordCount: 51,
      paragraphs: [],
    },
  ],
  dependencies: [
    { id: 'dep-1', fromId: 'sec-1', toId: 'sec-2', type: 'supports', label: 'Introduction motivates related work', direction: 'directed', source: 'manual', confirmed: true, createdBy: mockAttribution },
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

function FunctionCard({ func }: { func: FunctionDefinition }) {
  const [open, setOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ data: Record<string, unknown>; resolved: ResolvedPrimitive[] } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTestRun = async () => {
    setTestRunning(true);
    setTestResult(null);
    setTestError(null);
    try {
      // All executors (local, prompt, api) go through runFunction with mock snapshot
      const result = await runFunction(func.id, {
        snapshot: MOCK_SNAPSHOT,
        config: func.defaultConfig,
      });
      const resolved = resolveBindings(result.ui, result.data);
      setTestResult({ data: result.data, resolved });
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{func.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{func.id}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{func.description}</div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{func.executor}{func.endpoint ? ` → ${func.endpoint}` : ''}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 bg-muted/10 space-y-3">
          {/* Requirements */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requires</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(func.requires).map(([key, required]) => (
                <span key={key} className={`font-mono text-[11px] px-2 py-0.5 rounded border ${required ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'}`}>
                  {key}
                  {!required && <span className="text-muted-foreground/50 ml-0.5">?</span>}
                </span>
              ))}
              {Object.keys(func.requires).length === 0 && (
                <span className="text-[11px] text-muted-foreground">outline only</span>
              )}
            </div>
          </div>

          {/* Output schema */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Output Schema</div>
            <pre className="text-[11px] font-mono bg-muted/30 rounded px-3 py-2 overflow-x-auto">
              {JSON.stringify(func.outputSchema, null, 2)}
            </pre>
          </div>

          {/* UI components */}
          {func.ui.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">UI Bindings</div>
              <div className="space-y-1">
                {func.ui.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      u.type === 'banner' ? 'bg-amber-50 text-amber-600' :
                      u.type === 'inline-badge' ? 'bg-blue-50 text-blue-600' :
                      u.type === 'inline-highlight' ? 'bg-yellow-50 text-yellow-600' :
                      u.type === 'side-panel' ? 'bg-indigo-50 text-indigo-600' :
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

          {/* Config fields */}
          {func.configFields.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Config Fields</div>
              <div className="space-y-1">
                {func.configFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground">{f.type}</span>
                    <span>{'key' in f ? f.key : ''}</span>
                    {'options' in f && f.options && (
                      <span className="text-muted-foreground">
                        [{(f.options as { value: string }[]).map(o => o.value).join(' | ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Test Run ── */}
          <div className="pt-2 border-t">
            <button
              onClick={handleTestRun}
              disabled={testRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-muted/50 transition-colors disabled:opacity-40"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {testRunning ? 'Running...' : 'Test Run'}
              <span className="text-muted-foreground font-normal ml-1">(mock data)</span>
            </button>

            {testError && (
              <div className="mt-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-mono">
                {testError}
              </div>
            )}

            {testResult && (
              <div className="mt-3 space-y-4">
                {/* ── Rendered UI Output ── */}
                {testResult.resolved.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Rendered Output ({testResult.resolved.length} primitives)
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-background">
                      {/* Group by location and render each section */}
                      {(() => {
                        const grouped = groupByLocation(testResult.resolved);
                        const locationLabels: Record<string, string> = {
                          'global': 'Global',
                          'writing-editor': 'Editor',
                          'outline-node': 'Outline',
                          'right-panel': 'Panel',
                        };
                        const order: Array<'global' | 'writing-editor' | 'outline-node' | 'right-panel'> = ['global', 'outline-node', 'writing-editor', 'right-panel'];
                        return order.map(loc => {
                          const prims = grouped[loc];
                          if (!prims || prims.length === 0) return null;
                          return (
                            <div key={loc}>
                              <div className="px-3 py-1.5 bg-muted/30 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                {locationLabels[loc]} ({prims.length})
                              </div>
                              <div className="space-y-1.5 p-3">
                                {prims.map((prim, i) => (
                                  <RenderPrimitive key={`${loc}-${i}`} prim={prim} />
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {testResult.resolved.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No UI primitives resolved (function has no UI bindings or conditions not met).
                  </div>
                )}

                {/* Raw data (collapsed) */}
                <details className="group">
                  <summary className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground">
                    Raw Output Data
                  </summary>
                  <pre className="mt-1 text-[11px] font-mono bg-zinc-950 text-zinc-100 rounded-lg px-4 py-3 overflow-x-auto max-h-60 overflow-y-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PathCard({ path }: { path: CoordinationPathDefinition }) {
  const [open, setOpen] = useState(false);
  const ui = getPathUI(path.id);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
        {ui && <ui.Icon className={`h-4 w-4 ${ui.textColor} flex-shrink-0`} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{path.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{path.id}</span>
            {ui && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${ui.bgColor} ${ui.textColor}`}>
                {path.color}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{path.description}</div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{path.resolution.type}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 bg-muted/10 space-y-3">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Roles</div>
            <div className="space-y-1">
              {path.roles.map(role => (
                <div key={role.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-medium">{role.id}</span>
                  <span className="text-muted-foreground">— {role.description}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{role.assignment}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actions</div>
            <div className="space-y-1">
              {path.actions.map(action => (
                <div key={action.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-medium">{action.id}</span>
                  <span className="text-muted-foreground">{action.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    action.effect === 'approve' ? 'bg-emerald-50 text-emerald-600' :
                    action.effect === 'reject' ? 'bg-red-50 text-red-600' :
                    'bg-muted text-muted-foreground'
                  }`}>{action.effect}</span>
                  <span className="text-[10px] text-muted-foreground">→ [{action.availableTo.join(', ')}]</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resolution</div>
            <div className="text-xs font-mono">
              {path.resolution.type}
              {path.resolution.thresholdOptions && (
                <span className="text-muted-foreground"> [{path.resolution.thresholdOptions.join(' | ')}]</span>
              )}
            </div>
          </div>

          {path.configFields.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Config Fields</div>
              <div className="space-y-1">
                {path.configFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground">{f.type}</span>
                    <span>{'key' in f ? f.key : ''}</span>
                    {'options' in f && f.options && (
                      <span className="text-muted-foreground">
                        [{(f.options as { value: string }[]).map(o => o.value).join(' | ')}]
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

// ─── Shared UI Components ───

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
      {count}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold mb-3">{children}</h2>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] bg-muted px-1.5 py-0.5 rounded border">
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <pre className="text-[12px] font-mono bg-zinc-950 text-zinc-100 rounded-lg px-4 py-3 overflow-x-auto leading-relaxed">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function PrimitivePreview({ name, location, description, binding, preview }: {
  name: string;
  location: string;
  description: string;
  binding: string;
  preview: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const colorClass =
    name === 'inline-highlight' ? 'text-yellow-600' :
    name === 'inline-badge' ? 'text-blue-600' :
    name === 'banner' ? 'text-amber-600' :
    name === 'side-panel' ? 'text-indigo-600' :
    name === 'gutter-marker' ? 'text-emerald-600' :
    name === 'status-dot' ? 'text-orange-500' :
    'text-muted-foreground';

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-medium ${colorClass}`}>{name}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{location}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
      </button>

      {open && (
        <div className="border-t">
          <div className="grid grid-cols-2 divide-x">
            {/* Binding code */}
            <div className="p-4">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Binding</div>
              <CodeBlock>{binding}</CodeBlock>
            </div>
            {/* Visual preview */}
            <div className="p-4 bg-muted/10">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview</div>
              <div className="mt-2">{preview}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBlock({ title, fields }: { title: string; fields: [string, string, string][] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 border-b">
        <span className="font-mono text-sm font-medium">{title}</span>
      </div>
      <div className="divide-y">
        {fields.map(([name, type, desc]) => (
          <div key={name} className="flex items-baseline gap-3 px-4 py-2 text-xs">
            <span className="font-mono font-medium w-36 flex-shrink-0">{name}</span>
            <span className="font-mono text-muted-foreground flex-shrink-0">{type}</span>
            <span className="text-muted-foreground ml-auto text-right">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
