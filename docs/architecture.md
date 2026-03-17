# GroundingKit: Function Developer Reference

A **function** is a unit of analysis that reads document data, produces structured results, and declares how those results render in the UI. This document covers everything a developer needs to register a new function.

---

## 1. Available Data

Every function receives a `DocumentSnapshot` — a read-only view of the document's current state. Here is what's inside:

### Outline

```typescript
snapshot.nodes: OutlineNode[]
```

The hierarchical intent structure. Each node has:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `content` | `string` | The intent text |
| `position` | `number` | Sort order among siblings |
| `parentId` | `string \| null` | `null` = root section, otherwise child of parent |
| `level` | `number` | `0` = section, `1+` = nested intent |
| `createdBy` | `Attribution` | `{ userId, userName, at }` |
| `modifiedBy?` | `Attribution` | Present only if edited after creation |

```typescript
snapshot.assignments: SectionAssignment[]
```

Who owns each section:

| Field | Type | Description |
|---|---|---|
| `sectionId` | `string` | Root node ID |
| `assigneeId` | `string` | User ID of the owner |
| `assigneeName` | `string` | Display name |
| `assigneeEmail?` | `string` | Email |

**Helpers:**

```typescript
getSections(snapshot)              // root nodes, sorted by position
getChildren(snapshot, parentId)    // children of a node, sorted
getAssignee(snapshot, sectionId)   // assignment for a section
```

### Writing

```typescript
snapshot.writing: WritingContent[]
```

One entry per section. Each has:

| Field | Type | Description |
|---|---|---|
| `sectionId` | `string` | Which section this writing belongs to |
| `html` | `string` | HTML content from the editor |
| `text` | `string` | Plain text (for word count, search) |
| `wordCount` | `number` | Word count |
| `paragraphs` | `ParagraphAttribution[]` | Who last edited each paragraph |

Each `ParagraphAttribution`:

| Field | Type | Description |
|---|---|---|
| `index` | `number` | Paragraph index (0-based) |
| `textPrefix` | `string` | First ~50 chars (for matching) |
| `lastEditBy` | `Attribution` | `{ userId, userName, at }` |

**Helper:**

```typescript
getWriting(snapshot, sectionId)    // writing for a section
```

### Dependencies

```typescript
snapshot.dependencies: OutlineDependency[]
```

Relationships between outline nodes:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Dependency ID |
| `fromId` | `string` | Source node |
| `toId` | `string` | Target node |
| `type` | `string` | `'depends-on'`, `'must-be-consistent'`, `'builds-upon'`, ... |
| `label` | `string` | Human-readable label |
| `direction` | `'directed' \| 'bidirectional'` | |
| `source` | `'manual' \| 'ai-suggested' \| 'ai-confirmed'` | How it was created |
| `confirmed` | `boolean` | Whether team has confirmed this |

### Team

```typescript
snapshot.members: DocumentMember[]
snapshot.currentUserId: string
```

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | |
| `name` | `string` | Display name |
| `email?` | `string` | |
| `role` | `'owner' \| 'editor' \| 'viewer'` | |

### Meta

```typescript
snapshot.documentId: string
snapshot.phase: 'setup' | 'writing'
```

---

## 2. UI Primitives

Functions declare how their results appear in the UI by binding output fields to primitives. Each primitive has a fixed location and a set of parameters.

| Primitive | Location | Parameters |
|---|---|---|
| `inline-highlight` | Writing editor — highlights a text span | `text`: text to match, `color`: highlight color, `tooltip?`: hover text |
| `inline-badge` | Outline — badge next to an intent | `targetId`: node ID, `icon`: lucide icon, `label`: badge text, `color`: badge color |
| `side-panel` | Right panel — structured content | `title`: panel title, `badge?`: status badge, `detail?`: body text |
| `banner` | Top of section — alert bar | `message`: alert text, `severity`: `'info' \| 'warning' \| 'error'` |
| `tooltip` | On hover — contextual info | `text`: tooltip content |
| `gutter-marker` | Editor gutter — icon on a paragraph | `paragraphIndex`: which paragraph, `icon`: lucide icon, `color`: icon color |
| `status-icon` | Section header — status indicator | `icon`: lucide icon, `color`: icon color, `label?`: hover text |

A binding connects a primitive to your output data:

```typescript
{
  primitive: 'inline-highlight',   // which primitive
  forEach: 'sentences',            // iterate over result.sentences[]
  filter: 'item.type === "orphan"', // only items matching this condition
  params: {                        // fill the primitive's parameters
    text: '{{item.text}}',         // template string referencing result fields
    color: 'yellow',
    tooltip: '{{item.suggestion}}',
  },
}
```

- `forEach` — dot-path into your result object. Each item becomes `{{item.fieldName}}`.
- `filter` — JavaScript expression. Only matching items render.
- `params` — template strings with `{{item.field}}` or `{{result.field}}` placeholders.

---

## 3. Registering a Function

A function has three parts:

1. **Input declaration** — which data from `DocumentSnapshot` you read
2. **Logic** — a function or API endpoint that produces results
3. **Output → UI** — bindings that render results

### Example A: Rule-based (plain logic, no AI)

A page count check that shows a banner when the document exceeds a limit:

```typescript
import { registerCapability } from '@/lib/capability-protocol';
import type { DocumentSnapshot } from '@/lib/data-model';

registerCapability({
  id: 'page-count',
  name: 'Page Count Check',
  description: 'Warn when the document exceeds a page limit.',
  icon: 'FileText',
  category: 'metric',

  // 1. What data I read
  inputs: [
    { key: 'writing', source: 'writing', required: true },
  ],

  // 2. My logic (rule-based — no AI)
  executor: 'function',
  fn: (snapshot: DocumentSnapshot, config: Record<string, unknown>) => {
    const totalWords = snapshot.writing.reduce((sum, w) => sum + w.wordCount, 0);
    const estimatedPages = Math.ceil(totalWords / 250);
    const limit = (config.pageLimit as number) ?? 5;

    return {
      pages: estimatedPages,
      limit,
      over: estimatedPages > limit,
      overBy: Math.max(0, estimatedPages - limit),
    };
  },

  // 3. How my results render
  outputSchema: {
    pages: 'number',
    limit: 'number',
    over: 'boolean',
    overBy: 'number',
  },
  uiBindings: [
    {
      primitive: 'banner',
      filter: 'result.over',
      params: {
        message: '{{result.pages}} pages (limit: {{result.limit}}, over by {{result.overBy}})',
        severity: 'warning',
      },
    },
    {
      primitive: 'status-icon',
      filter: 'result.over',
      params: { icon: 'AlertTriangle', color: 'orange', label: 'Over page limit' },
    },
  ],

  // Team-configurable options
  configFields: [
    { type: 'number', key: 'pageLimit', label: 'Page limit', min: 1, max: 100, unit: 'pages' },
  ],
  defaultConfig: { pageLimit: 5 },
});
```

### Example B: Prompt-based (AI analysis via API route)

A drift detection function that calls an AI endpoint:

```typescript
import { registerCapability } from '@/lib/capability-protocol';

registerCapability({
  id: 'check-drift',
  name: 'Drift Detection',
  description: 'Compare writing against the outline to find drifts and missing content.',
  icon: 'Eye',
  category: 'check',

  // 1. What data I read
  inputs: [
    { key: 'outline', source: 'outline', required: true },
    { key: 'writing', source: 'writing', required: true },
    { key: 'dependencies', source: 'dependencies', required: false },
  ],

  // 2. My logic (AI — calls an API route that runs a prompt)
  executor: 'api',
  endpoint: '/api/check-drift',
  //
  // The platform POSTs { snapshot: DocumentSnapshot, config: {...} } to this endpoint.
  // The API route extracts what it needs from snapshot, runs the prompt, returns results.

  // 3. How my results render
  outputSchema: {
    alignedIntents: 'AlignedIntent[]',
    dependencyIssues: 'DependencyIssue[]',
    summary: 'string',
  },
  uiBindings: [
    {
      primitive: 'inline-highlight',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus !== "covered"',
      params: {
        color: '{{item.coverageStatus}}',
        label: '{{item.coverageNote}}',
      },
    },
    {
      primitive: 'inline-badge',
      forEach: 'alignedIntents',
      filter: 'item.coverageStatus === "missing"',
      params: {
        targetId: '{{item.id}}',
        icon: 'circle-slash',
        label: 'Not covered',
        color: 'red',
      },
    },
  ],

  configFields: [
    {
      type: 'select', key: 'trigger', label: 'When to run', layout: 'grid-2',
      options: [
        { value: 'manual', label: 'Writer decides', icon: 'User' },
        { value: 'auto', label: 'Automatic', icon: 'Sparkles' },
      ],
    },
  ],
  defaultConfig: { trigger: 'manual' },
});
```

---

## 4. Built-in Functions

These are already registered and available:

| ID | Name | Category | Data Used | What It Does |
|---|---|---|---|---|
| `check-drift` | Drift Detection | check | outline, writing, dependencies | Compares writing against outline; finds orphan sentences, missing intents, partial coverage |
| `assess-impact` | Impact Assessment | analysis | outline, dependencies | Analyzes how a proposed change affects other sections |
| `detect-dependencies` | Dependency Detection | analysis | outline | AI-suggests relationships between sections |
| `preview-writing-impact` | Writing Preview | transform | outline, writing | Generates before/after prose preview for a change |
| `simulate-comment` | Comment Simulation | transform | outline | Translates a natural language comment into proposed outline changes |
| `generate-gap-suggestion` | Gap Suggestion | analysis | outline, writing | Suggests a new intent for orphan sentences |
| `analyze-removal-impact` | Removal Impact | analysis | outline, dependencies, writing | Analyzes how removing an intent affects related sections |

Source: [`lib/capabilities/builtin.ts`](../lib/capabilities/builtin.ts)

---

## 5. Template

Copy this to create your own function:

```typescript
import { registerCapability } from '@/lib/capability-protocol';
import type { DocumentSnapshot } from '@/lib/data-model';

registerCapability({
  id: 'my-function',
  name: 'My Function',
  description: 'What this function does.',
  icon: 'Sparkles',                    // any lucide-react icon name
  category: 'check',                   // 'analysis' | 'check' | 'transform' | 'metric'

  // ── What data I read ──
  inputs: [
    { key: 'outline', source: 'outline', required: true },
    // { key: 'writing', source: 'writing', required: true },
    // { key: 'dependencies', source: 'dependencies', required: false },
    // { key: 'team', source: 'team', required: false },
    // { key: 'meta', source: 'meta', required: false },
  ],

  // ── My logic ──
  executor: 'function',               // or 'api' with endpoint: '/api/my-function'
  fn: (snapshot: DocumentSnapshot, config: Record<string, unknown>) => {
    // snapshot.nodes         — OutlineNode[]
    // snapshot.writing       — WritingContent[] (html, text, wordCount, paragraphs)
    // snapshot.dependencies  — OutlineDependency[]
    // snapshot.assignments   — SectionAssignment[]
    // snapshot.members       — DocumentMember[]
    // snapshot.phase         — 'setup' | 'writing'
    //
    // Helpers: getSections(snapshot), getChildren(snapshot, id),
    //          getWriting(snapshot, sectionId), getAssignee(snapshot, sectionId)

    return {
      // your result fields here
    };
  },

  // ── What I output ──
  outputSchema: {
    // describe result shape for documentation
  },

  // ── How results render ──
  uiBindings: [
    // {
    //   primitive: 'banner',
    //   filter: 'result.someCondition',
    //   params: { message: '{{result.someField}}', severity: 'warning' },
    // },
  ],

  // ── Team-configurable options ──
  configFields: [
    // { type: 'number', key: 'threshold', label: 'Threshold', min: 0, max: 100 },
    // { type: 'toggle', key: 'strict', label: 'Strict mode' },
    // { type: 'select', key: 'mode', label: 'Mode', options: [...] },
  ],
  defaultConfig: {},
});
```

---

## 6. How It All Connects

```
Developer registers function
         │
         ▼
  CapabilityDefinition
  ├─ inputs:  what data I read      ← from DocumentSnapshot
  ├─ fn/api:  my analysis logic      ← receives full snapshot
  ├─ output:  what I produce         ← structured result
  └─ ui:      how results render     ← bindings to UI primitives
         │
         ▼
  Team configures MetaRule
  ├─ enables/disables functions
  ├─ sets function config (e.g. page limit = 5)
  └─ writes rules: WHEN function.result THEN coordination path
         │
         ▼
  Runtime: writer edits → function runs → results render in UI
                                        → rules trigger coordination
```

Types: [`lib/data-model.ts`](../lib/data-model.ts) | Protocol: [`lib/capability-protocol.ts`](../lib/capability-protocol.ts) | Built-ins: [`lib/capabilities/builtin.ts`](../lib/capabilities/builtin.ts)
