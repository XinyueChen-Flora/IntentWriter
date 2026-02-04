# System Design: Intent Versioning & Common Ground Pipeline

## Current Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Next.js    │────▶│    PartyKit      │────▶│   Supabase   │
│   Frontend   │◀────│  (Real-time)     │     │ (Persistent) │
│              │     │                  │     │              │
│  - Editor    │     │  - Yjs CRDT      │     │  - documents │
│  - Intent    │     │  - IntentBlock[] │     │  - backups   │
│  - Writing   │     │  - WritingBlock[]│     │  - users     │
│              │     │  - RuleBlock[]   │     │              │
└──────────────┘     └──────────────────┘     └──────────────┘
```

**Current state**: PartyKit holds real-time collaborative state. Supabase stores document metadata, user auth, and periodic backups (full JSON snapshots). There is no concept of intent versioning, baseline agreement, or decision tracking.

## What Needs to Be Added

To support the design space (see `design-space.md`), the system needs:

1. **Room Phases** — setup phase (outline) vs writing phase, with explicit transition
2. **Intent Dependencies** — cross-branch dependency relationships between intent blocks
3. **Baseline Intent** — a snapshot of the team's agreed-upon intent state, against which all drift is measured
4. **Intent Version History** — track both content changes and structural changes to intent blocks
5. **Decision Log** — record team agreements so future evaluations can reference past decisions
6. **Delta Computation** — ability to compare current state against baseline to produce deltas
7. **Simulation Pipeline** — evaluate, translate, and propagate deltas through the staged pipeline

## Data Model

### Room Phase (PartyKit real-time state)

```typescript
interface RoomMeta {
  phase: 'setup' | 'writing';
  baselineVersion: number;        // current baseline version (0 = no baseline yet)
  phaseTransitionAt?: number;     // when the room entered writing phase
  phaseTransitionBy?: string;     // who triggered "Agree & Start Writing"
}
```

### Intent Dependencies (PartyKit real-time state)

```typescript
interface IntentDependency {
  id: string;
  fromIntentId: string;           // the dependent intent
  toIntentId: string;             // the intent it depends on
  type: DependencyType;
  source: 'manual' | 'ai-suggested' | 'ai-confirmed';
  confirmed: boolean;             // false for AI suggestions not yet accepted
  createdBy?: string;
  createdAt: number;
}

type DependencyType =
  | 'hierarchical'      // parent constrains children (auto from structure)
  | 'sequential'        // later section builds on earlier
  | 'argumentative'     // one claim depends on another claim
  | 'consistency'       // must not contradict each other
  | 'scope';            // one defines scope that constrains the other
```

Dependencies are stored as part of the room state alongside IntentBlock[] and WritingBlock[]. They are also included in baseline snapshots.

### Extended IntentBlock (PartyKit real-time state)

The IntentBlock in PartyKit gains baseline-related fields:

```typescript
interface IntentBlock {
  // --- existing fields ---
  id: string;
  content: string;
  position: number;
  linkedWritingIds: string[];
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
  level: number;
  intentTag?: string;
  intentCreatedBy?: string;
  intentCreatedByName?: string;
  intentCreatedByEmail?: string;
  intentCreatedAt?: number;
  isCollapsed?: boolean;
  assignee?: string;
  assigneeName?: string;
  assigneeEmail?: string;

  // --- new: baseline tracking ---
  baselineContent: string;        // content at last agreement
  baselineVersion: number;        // which version of baseline
  baselineAt: number;             // timestamp of last agreement
  driftStatus?: DriftStatus;      // computed: current alignment state
}

type DriftStatus =
  | 'aligned'           // content matches baseline, no drift
  | 'minor-drift'       // small delta, Stage 1 only
  | 'intent-boundary'   // delta crosses intent boundary, Stage 2
  | 'team-impact';      // delta affects others, Stage 3
```

### Supabase: intent_baselines

A full snapshot of the agreed intent structure. Created each time the team reaches a new agreement.

```sql
create table intent_baselines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  version integer not null,  -- incrementing version number

  -- full snapshot of intent hierarchy at time of agreement
  intent_snapshot jsonb not null,
  -- schema: {
  --   blocks: Array<{
  --     id: string,
  --     content: string,
  --     position: number,
  --     parentId: string | null,
  --     level: number,
  --     assignee?: string,
  --     linkedWritingIds: string[]
  --   }>,
  --   dependencies: Array<{
  --     id: string,
  --     fromIntentId: string,
  --     toIntentId: string,
  --     type: DependencyType,
  --     source: 'manual' | 'ai-suggested' | 'ai-confirmed'
  --   }>
  -- }

  -- structural metadata for quick comparison
  block_count integer not null,
  structure_hash text not null,  -- hash of the hierarchy structure (ids + parentIds + positions)

  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  decision_id uuid,  -- which decision created this baseline (null for initial)

  unique(document_id, version)
);

create index idx_intent_baselines_document on intent_baselines(document_id, version desc);
```

### Supabase: intent_block_versions

Per-block version history. A new row is created whenever an intent block's content or structural position changes in a meaningful way (not every keystroke — debounced or on save).

```sql
create table intent_block_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  intent_block_id text not null,  -- matches IntentBlock.id in PartyKit

  version integer not null,
  content text not null,

  -- structural position at this version
  parent_id text,
  level integer not null,
  position integer not null,

  -- change metadata
  change_type text not null,  -- 'content' | 'structural' | 'initial' | 'agreed'
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now(),

  -- link to baseline if this version was part of an agreement
  baseline_id uuid references intent_baselines(id),

  unique(document_id, intent_block_id, version)
);

create index idx_intent_block_versions_lookup
  on intent_block_versions(document_id, intent_block_id, version desc);
```

### Supabase: decisions

Records of team agreements. Each decision captures what changed, why, and who agreed.

```sql
create table decisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,

  -- what triggered this decision
  trigger_type text not null,  -- 'system_detected' | 'user_preview' | 'user_declared'
  origin_level text not null,  -- 'writing' | 'intent'

  -- what changed
  change_summary text not null,         -- human-readable description
  affected_intent_ids text[] not null,  -- which intent blocks were affected
  affected_writing_ids text[],          -- which writing blocks were affected
  change_type text not null,            -- 'content' | 'structural' | 'both'

  -- the delta (for future reference / replay)
  delta jsonb not null,
  -- schema: {
  --   intentChanges: Array<{
  --     intentBlockId: string,
  --     before: string,
  --     after: string,
  --     changeType: 'content' | 'added' | 'removed' | 'moved'
  --   }>,
  --   writingChanges?: Array<{
  --     writingBlockId: string,
  --     before: string,
  --     after: string
  --   }>
  -- }

  -- who was involved
  initiated_by uuid references auth.users(id),
  participants uuid[] not null,  -- who participated in the negotiation

  -- negotiation context
  reason text,                    -- why the change was made
  discussion_summary text,        -- summary of team discussion

  -- resolution
  status text not null default 'proposed',  -- 'proposed' | 'agreed' | 'rejected' | 'superseded'
  resolved_at timestamptz,

  -- links to baselines
  previous_baseline_id uuid references intent_baselines(id),
  new_baseline_id uuid references intent_baselines(id),

  created_at timestamptz default now()
);

create index idx_decisions_document on decisions(document_id, created_at desc);
create index idx_decisions_intent on decisions using gin(affected_intent_ids);
```

## How the Pipeline Maps to the System

### Delta Computation

The system needs to compute deltas at two levels:

**Content delta** (per intent block):
```typescript
interface ContentDelta {
  intentBlockId: string;
  baselineContent: string;   // from IntentBlock.baselineContent
  currentContent: string;    // from IntentBlock.content
  // or for writing-origin:
  writingBlockId: string;
  writingContent: string;    // current writing
  linkedIntentContent: string; // the intent it should align with
}
```

**Structural delta** (across the hierarchy):
```typescript
interface StructuralDelta {
  added: IntentBlock[];      // blocks that exist now but not in baseline
  removed: BaselineBlock[];  // blocks in baseline but not in current state
  moved: Array<{             // blocks whose parent/position changed
    blockId: string;
    baselineParentId: string | null;
    currentParentId: string | null;
    baselinePosition: number;
    currentPosition: number;
  }>;
}
```

Delta computation compares current PartyKit state against the latest `intent_baselines` snapshot.

### Pipeline Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                             │
│                                                                 │
│  System-detected    User preview       User declaration         │
│  (background)       (on demand)        (on demand)              │
│       │                  │                   │                  │
│       ▼                  ▼                   ▼                  │
│  Compare current    User provides      Compare before/          │
│  state vs baseline  hypothetical       after state              │
│       │             change                   │                  │
│       └──────────────┬───────────────────────┘                  │
│                      │                                          │
│                      ▼                                          │
│               DELTA PRODUCED                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: EVALUATE                                               │
│                                                                 │
│ Input: delta + baseline intent + current writing                │
│ Process: AI evaluates significance                              │
│ Output: significance score + drift status                       │
│                                                                 │
│ API: POST /api/evaluate-delta                                   │
│ Request: { delta, baselineIntent, currentWriting }              │
│ Response: {                                                     │
│   significance: number (0-1),                                   │
│   driftStatus: DriftStatus,                                     │
│   summary: string,                                              │
│   crossesIntentBoundary: boolean,                               │
│   contradictsPreviousDecision?: { decisionId, description }     │
│ }                                                               │
│                                                                 │
│ If significance < threshold → return Stage 1 result → STOP     │
│ If crossesIntentBoundary → continue to Stage 2                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: TRANSLATE                                              │
│                                                                 │
│ Input: delta + full intent hierarchy + full writing blocks      │
│ Process: AI translates across levels                            │
│                                                                 │
│ If writing→intent:                                              │
│   API: POST /api/extract-intent-shift                           │
│   Response: {                                                   │
│     impliedIntentChanges: Array<{                               │
│       intentBlockId: string,                                    │
│       currentIntentContent: string,                             │
│       proposedIntentContent: string,                            │
│       reason: string                                            │
│     }>,                                                         │
│     affectsOthers: boolean,                                     │
│     affectedBlockIds: string[]                                  │
│   }                                                             │
│                                                                 │
│ If intent→writing:                                              │
│   API: POST /api/simulate-writing-impact                        │
│   Response: {                                                   │
│     simulatedWritingChanges: Array<{                            │
│       writingBlockId: string,                                   │
│       currentContent: string,                                   │
│       simulatedContent: string,                                 │
│       changeType: 'minor-edit' | 'rewrite' | 'new-section'     │
│     }>,                                                         │
│     affectsOthers: boolean,                                     │
│     affectedBlockIds: string[]                                  │
│   }                                                             │
│                                                                 │
│ If !affectsOthers → return Stage 2 result → STOP               │
│ If affectsOthers → continue to Stage 3                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: PROPAGATE & NEGOTIATE                                  │
│                                                                 │
│ Input: Stage 2 output + all blocks + all assignees              │
│                                                                 │
│ API: POST /api/propagate-impact                                 │
│ Response: {                                                     │
│   impactMap: Array<{                                            │
│     userId: string,                                             │
│     userName: string,                                           │
│     affectedIntentBlocks: Array<{                               │
│       id, currentContent, simulatedContent, changeType          │
│     }>,                                                         │
│     affectedWritingBlocks: Array<{                              │
│       id, currentContent, simulatedContent, changeType          │
│     }>,                                                         │
│     impactDegree: 'minor' | 'moderate' | 'major'               │
│   }>,                                                           │
│   totalAffectedBlocks: number,                                  │
│   totalAffectedUsers: number                                    │
│ }                                                               │
│                                                                 │
│ → Frontend shows impact visualization                           │
│ → Author initiates negotiation                                  │
│ → On agreement: create Decision record + new IntentBaseline     │
└─────────────────────────────────────────────────────────────────┘
```

### Baseline Lifecycle

```
1. Document created
   → First intent blocks added by team
   → Team marks intents as "agreed" (explicit action or implicit on first save)
   → INSERT intent_baselines (version=1, snapshot=current intents)
   → Each IntentBlock.baselineContent = IntentBlock.content
   → Each IntentBlock.baselineVersion = 1

2. Authors write, intents may drift
   → PartyKit state changes in real-time
   → Background job periodically compares current state vs baseline
   → Updates IntentBlock.driftStatus

3. Pipeline triggers (any entry point)
   → Delta computed against latest baseline
   → Pipeline runs to appropriate depth

4. Agreement reached (Stage 2 self-resolve or Stage 3 team negotiation)
   → INSERT decisions (record what was decided)
   → INSERT intent_baselines (version=N+1, snapshot=new agreed state)
   → UPDATE each affected IntentBlock:
       baselineContent = content
       baselineVersion = N+1
       baselineAt = now()
       driftStatus = 'aligned'
   → INSERT intent_block_versions for each changed block (change_type='agreed')

5. Cycle continues from step 2
```

### Background Drift Detection

For the implicit/system-detected entry point, a background process runs periodically:

```typescript
// Runs on a timer or after writing changes stabilize (debounced)
async function detectDrift(documentId: string) {
  const currentIntents = getCurrentIntentBlocks();  // from PartyKit
  const currentWriting = getCurrentWritingBlocks();  // from PartyKit
  const baseline = await getLatestBaseline(documentId);  // from Supabase

  for (const intent of currentIntents) {
    const linkedWriting = currentWriting.filter(w => w.linkedIntentId === intent.id);

    // Compute content delta
    const contentDelta = computeContentDelta(intent, baseline);

    // If content changed, evaluate significance via AI
    if (contentDelta.hasChanges) {
      const evaluation = await evaluateDelta(contentDelta, intent, linkedWriting);

      // Update drift status on the intent block
      updateIntentDriftStatus(intent.id, evaluation.driftStatus);
    }
  }

  // Also check structural changes
  const structuralDelta = computeStructuralDelta(currentIntents, baseline);
  if (structuralDelta.hasChanges) {
    // Handle added/removed/moved blocks
  }
}
```

### Where Each Piece Lives

| Component | Location | Why |
|---|---|---|
| Current IntentBlock/WritingBlock state | PartyKit | Real-time collaboration, low latency |
| Baseline snapshots (intent_baselines) | Supabase | Persistent, shared reference point |
| Version history (intent_block_versions) | Supabase | Persistent, queryable history |
| Decision log (decisions) | Supabase | Persistent, team record |
| Drift detection | PartyKit server or Next.js API | Periodic background computation |
| Delta evaluation (Stage 1) | Next.js API → OpenAI | AI evaluation |
| Cross-level translation (Stage 2) | Next.js API → OpenAI | AI extraction/generation |
| Impact propagation (Stage 3) | Next.js API → OpenAI | AI simulation |
| Negotiation state | PartyKit | Real-time discussion |
| Negotiation resolution | Supabase (decisions) | Persistent record |

## Development Phases

### Phase 0: Outline Setup

**Goal**: Team can set up a complete intent structure with dependencies before writing begins.

**Build**:
- `RoomMeta` with phase tracking (`setup` / `writing`) in PartyKit
- `IntentDependency` data model in PartyKit
- UI: Room phase indicator + "Agree & Start Writing" button
- UI: Setup-focused intent panel (writing editor hidden/disabled)
- UI: Side dependency lines visualization
  - Click two intent blocks to create a manual dependency
  - Dependency type selector (sequential, argumentative, consistency, scope)
  - Solid lines = confirmed, dashed lines = AI-suggested
- API: `POST /api/detect-dependencies` — AI analyzes intent structure and suggests dependencies
- Supabase migration: `intent_baselines` table
- "Agree & Start Writing" action: snapshot intent structure + dependencies → baseline v1, switch phase to `writing`

### Phase 1: Ambient Drift Detection + Full Evaluation Chain

**Goal**: During writing, the system continuously evaluates alignment and shows ambient indicators encoding the full severity.

**Build**:
- Extend IntentBlock with baseline fields (`baselineContent`, `baselineVersion`, `driftStatus`)
- Background drift detection (on paragraph switch + every 5 min)
- Stage 1 API: `POST /api/evaluate-delta`
  - Input: current writing + baseline intent + dependency graph + decision history
  - Output: significance score + driftStatus (aligned / minor-drift / intent-boundary / team-impact)
  - Uses dependency graph to determine if change would cascade to others
- UI: Ambient color indicators on both panels (green/yellow/orange/red)
  - Intent block: left border color + brief drift summary
  - Writing block: left border color (synced with intent side)
  - Both sides show the same alignment state simultaneously

### Phase 2: Cross-Level Translation + Detailed Interaction

**Goal**: User can click an ambient indicator to see detailed cross-level translation and take action.

**Build**:
- Supabase migration: `intent_block_versions` table
- Stage 2 APIs: `POST /api/extract-intent-shift` and `POST /api/simulate-writing-impact`
- UI: Click amber/red indicator → detail panel showing:
  - What changed at the current level
  - What this means at the other level (proposed changes)
  - Actions: update intent / adjust writing / discuss with team
- Unified interaction component (same UI for all three entry points)
- User preview entry point: select text/intent → "What if?" → hypothetical delta
- User declaration entry point: "I changed this" → before/after delta
- Baseline updates when user accepts intent changes

### Phase 3: Impact & Negotiation

**Goal**: When changes affect others, show full impact via dependency cascade and support negotiation.

**Build**:
- Supabase migration: `decisions` table
- Stage 3 API: `POST /api/propagate-impact`
  - Uses dependency graph to trace cascade paths
  - Generates simulated outcomes for all affected blocks
- UI: Diff view with per-user impact breakdown
- UI: Dependency lines highlight cascade path during impact preview
- Negotiation flow: propose → discuss → resolve
- Decision recording and baseline update on agreement
