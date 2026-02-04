# Design Space: Managing Common Ground Breakdown in Collaborative Writing

## Core Problem

In collaborative writing, teams start with a shared outline that represents their **common ground** — the agreed-upon structure, intent, and direction of the writing. However, as individual authors begin writing, they inevitably make decisions that go beyond the original outline. These decisions can **expand on** or **conflict with** the existing common ground, leading to **common ground breakdown**.

The system's goal is to help teams **detect, understand, and resolve** common ground breakdowns through appropriate interaction designs.

## How Common Ground Breaks Down

When an author (A) starts writing, she implements the shared outline into concrete text. During this process:

1. **A makes many decisions beyond the outline** — The outline is abstract; writing requires concrete choices (tone, argument structure, specific claims, examples). These choices may implicitly expand or conflict with common ground.

2. **A may not realize these decisions affect common ground** — She doesn't recognize that her writing choices have implications for the shared understanding that B, C, D rely on.

3. **A may realize the outline needs updating but doesn't know how** — She senses something has shifted but can't articulate what changed or how much of the outline to update.

4. **A may know what to change but can't negotiate effectively** — She can articulate the change, but lacks the means to show others *why* it matters and *how* it would impact their work.

## The Three-Axis Framework

Three orthogonal axes define the space of common ground breakdowns:

### Axis 1: Where does the change originate?

- **Writing level**: The author edits the actual text.
- **Intent level**: The author edits the outline/intent directly.

### Axis 2: When does the system intervene?

- **Post-hoc**: The change has already been made. The system helps the author *understand what happened* and communicate it to the team.
- **Pre-hoc**: The change hasn't been made yet. The author wants to *preview what would happen* before deciding whether to proceed.

### Axis 3: Is the change intention explicit or implicit?

- **Implicit**: The author is not consciously intending to break common ground. The drift happens naturally during writing — she makes decisions (tone, argument structure, specific claims) that happen to expand on or conflict with the shared outline, without realizing it.
- **Explicit**: The author deliberately wants to change something about the common ground. She knows she wants to take the writing in a different direction or modify an agreed-upon intent.

This axis is independent from Axis 1. For example:
- **Implicit + Writing**: A writes a paragraph and it naturally drifts from the outline without her noticing.
- **Explicit + Writing**: A intentionally rewrites a paragraph to take a different argumentative direction.
- **Implicit + Intent**: A casually tweaks an intent block's wording without fully realizing the downstream implications.
- **Explicit + Intent**: A deliberately restructures part of the outline because she thinks the approach should change.

The distinction matters because it changes the **starting point** of the system's intervention:
- **Implicit** → The system must first **make the author aware** that a common ground change has occurred or is about to occur. Awareness is the prerequisite before anything else can happen.
- **Explicit** → The author already has awareness. The system can skip directly to **impact preview and negotiation support**.

### The Design Space

The three axes form a 2×2×2 space. Not all eight cells are equally likely or important, but the framework ensures full coverage:

|  | Change in Writing | Change in Intent |
|---|---|---|
| **Post-hoc + Implicit** | A has written something that drifts from the outline without realizing it. System detects the drift, surfaces it to A, then shows impact. | A has casually edited an intent without fully grasping the downstream effects. System surfaces the implications. |
| **Post-hoc + Explicit** | A has intentionally rewritten something that she knows diverges from common ground. System helps her articulate and show the impact to the team. | A has deliberately changed an intent. System shows what this means for existing writing and other members' work. |
| **Pre-hoc + Implicit** | Less common: A is writing and the system proactively warns her that what she's about to write may conflict with common ground. | Less common: A is editing an intent and the system proactively warns about implications she may not have considered. |
| **Pre-hoc + Explicit** | A is considering rewriting a section and knows it will change the direction. System previews: what would this imply for intents? What ripple effects? | A is considering changing an intent and wants to see the impact first. System previews: what writing needs to change? How does it affect others? |

## Intent as the Common Ground Boundary

### The Two Layers

The system operates across two layers with fundamentally different characteristics:

- **Writing layer**: High-frequency, individual work. Authors are constantly drafting, revising, and refining text. Most writing edits are part of normal individual work and **do not need to be surfaced to the team**. Writing is concrete, specific, and dynamic.

- **Intent layer**: Relatively stable, shared structure. The intent hierarchy represents the team's **common ground** — what they agreed to write about, how it's structured, and what each section should accomplish. Intent is abstract and changes less frequently. **Any change at the intent level is by definition a change to the team's common ground.**

### Intent as the Boundary Between Individual and Team Concern

This distinction establishes intent as the **boundary** between individual work and team-level concern:

```
Writing layer (individual work)
  │  High-frequency edits, personal drafting
  │  Most changes stay here — they are the author's own work
  │  NOT everything needs team awareness
  │
  │  Threshold 1: Does this writing change affect intent?
  │  No → stays at individual level, no escalation
  │  Yes ↓
  │
Intent layer (common ground)
  │  The team's shared agreement
  │  Changes here = changes to common ground
  │  Team needs to be AWARE
  │
  │  Threshold 2: Does this intent change affect other people's work?
  │  No → author updates their own intent, done
  │  Yes ↓
  │
Team negotiation layer
  │  Changes that impact other people's intents and writing
  │  Requires discussion, agreement, and decision tracking
```

### Baseline Intent and the Update Cycle

The system maintains a concept of **baseline intent** — the intent state that the team has most recently agreed upon. All evaluations of "drift" and "delta" are measured **relative to this baseline**.

The baseline is not static. It evolves through a continuous cycle:

```
1. Team establishes initial common ground (baseline intent)
       ↓
2. Authors write, making decisions that may drift from baseline
       ↓
3. System detects drift crossing the intent threshold
       ↓
4. Team negotiates and reaches new agreement
       ↓
5. Baseline intent updates to reflect the new agreement
       ↓
   (Cycle repeats from step 2)
```

Previous decisions carry **weight** in future evaluations. A change that contradicts an explicitly negotiated agreement should be escalated more aggressively than one that drifts from an original outline that was never explicitly discussed. The system tracks this decision history to inform its evaluation.

## Core Design Principle: Bidirectional Simulation

A change visible at one level (writing or intent) is **not sufficient for understanding**. Seeing text change in real-time doesn't tell you *why* it changed or what it means for common ground. Seeing an intent block change doesn't tell you what it *concretely means* for the writing.

Intent and writing are **two representations of the same underlying common ground**. Any change on one side must be **projected onto the other side** to be fully comprehensible:

```
Writing change ──→ Extract/surface what this means at the intent level
                   (What implicit decisions were made? How does this
                    expand or conflict with the outline?)

Intent change  ──→ Simulate what this means at the writing level
                   (What would the text need to look like? Which
                    sections would need to be rewritten?)
```

The two directions involve fundamentally different operations:
- **Writing → Intent** is an act of **extraction/abstraction**: distilling concrete text changes into their intent-level meaning
- **Intent → Writing** is an act of **generation/concretization**: translating abstract intent changes into concrete textual impact

This bidirectional simulation is not a feature — it is the **foundational principle** that enables all system responses. Without it:
- An author who changes writing cannot communicate the intent-level implications to the team
- An author who changes intent cannot show the team what the concrete writing impact would be
- Team members who see changes on either side cannot fully grasp what those changes mean

The system's core value proposition is **bridging the gap between these two levels of representation** so that changes on either side become legible, assessable, and negotiable.

## The Unified Interaction: One Operation, Adaptive Depth

### One Core Operation

Regardless of how a change enters the system — whether the system detects drift, the user previews a hypothetical change, or the user declares a change they've already made — the core operation is the same:

```
Delta (from any source) → Simulation → Adaptive Visualization
```

The delta can come from:
- **System detection**: The system compares current writing against baseline intent and finds misalignment (implicit, post-hoc)
- **User preview**: The user selects text or an intent block and asks "what if I change this?" (explicit, pre-hoc)
- **User declaration**: The user has already made a change and tells the system "I changed this" (explicit, post-hoc)

Once there is a delta, **the same pipeline runs**. The visualization adapts not just in visual style, but in **simulation depth** — the system decides how deep to simulate based on the significance of the delta.

### Three Entry Points, One Pipeline

| Entry Point | Trigger | How the Delta Is Produced |
|---|---|---|
| **System-initiated** (implicit) | System detects misalignment between writing and baseline intent | AI compares current writing against baseline intent, produces actual delta |
| **User preview** (explicit, pre-hoc) | User selects content and asks "what would happen if I change this?" | User provides hypothetical change, system produces hypothetical delta |
| **User declaration** (explicit, post-hoc) | User has already made a change and explicitly flags it | AI compares before/after state, produces actual delta |

All three entries feed into the same adaptive pipeline below.

## The Staged Pipeline: Adaptive Depth

The magnitude of a delta determines **how deep the pipeline goes**. Small deltas stop early; large deltas cascade all the way to team negotiation. This is not three separate features — it is **one continuous, adaptive process**.

### The Pipeline (Unified for Both Directions)

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: AWARENESS                                              │
│ (Individual level — between the author and the system)          │
│                                                                 │
│ The system evaluates the delta against the baseline intent.     │
│                                                                 │
│ Simulation role: EVALUATE                                       │
│ → Does the writing still align with its linked intent?          │
│   (if delta originates from writing)                            │
│ → Does the linked writing still satisfy the changed intent?     │
│   (if delta originates from intent)                             │
│ → How significant is the drift?                                 │
│                                                                 │
│ If delta is small (does not cross the intent boundary):         │
│   → Show inline delta / alignment annotation                   │
│   → The change stays at the individual level                    │
│   → 【STOP HERE】                                               │
│                                                                 │
│ If delta is significant enough to cross the intent boundary:    │
│   → Escalate to Stage 2                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: CROSS-LEVEL TRANSLATION                                │
│ (Common ground level — the change affects shared intent)        │
│                                                                 │
│ The delta has crossed the intent boundary. The system now       │
│ translates the change to the other level so it becomes fully    │
│ comprehensible.                                                 │
│                                                                 │
│ Simulation role: TRANSLATE                                      │
│                                                                 │
│ If change originated from writing:                              │
│   → EXTRACT: What does this writing change imply at the intent  │
│     level? Propose how the intent structure should be updated.  │
│                                                                 │
│ If change originated from intent:                               │
│   → GENERATE: What would the writing need to look like given    │
│     this new intent? Show simulated text changes.               │
│                                                                 │
│ Representation: highlight affected blocks at both levels +      │
│ show proposed changes at the other level                        │
│                                                                 │
│ If the change only affects the author's own blocks:             │
│   → Author reviews, accepts/modifies the proposed update        │
│   → Baseline intent updates for the affected block              │
│   → 【STOP HERE】                                               │
│                                                                 │
│ If the change ripples to other people's blocks:                 │
│   → Escalate to Stage 3                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: IMPACT & NEGOTIATION                                   │
│ (Team level — the change affects other people's work)           │
│                                                                 │
│ The change affects other team members' intent blocks and/or     │
│ writing blocks.                                                 │
│                                                                 │
│ Simulation role: PROPAGATE & MATERIALIZE                        │
│ → Which other intent blocks are affected?                       │
│ → What would the affected writing blocks need to become?        │
│   (Generate simulated writing to make impact concrete)          │
│ → Who is affected? How much of their work needs to change?      │
│                                                                 │
│ Representation: diff view showing the full scope of impact      │
│ across both levels, for all affected members                    │
│                                                                 │
│ → Author initiates negotiation with affected team members       │
│ → Team reviews the simulated impact, discusses, and reaches     │
│   new common ground (accept / modify / reject)                  │
│ → Decision is recorded, baseline intent updates                 │
└─────────────────────────────────────────────────────────────────┘
```

### Each Stage Maps to a Scope of Concern

| Stage | Scope | Who Cares | Representation |
|---|---|---|---|
| Stage 1: Awareness | Individual | Author only | Inline annotation |
| Stage 2: Cross-level | Common ground | Author + linked intent/writing | Highlight + proposed changes |
| Stage 3: Impact | Team-wide | All affected members | Diff view + impact map + negotiation |

### The Three Roles of Simulation

Simulation serves a **different role** at each stage:

**1. Simulation as Evaluator (Stage 1)**

Answers: **"Is this change important enough to cross the intent boundary?"**

The system compares the current state against the baseline intent and determines the degree of misalignment. Evaluation criteria include:
- **Structural coverage**: Does the writing still address the key claims/arguments specified in the intent? Are new claims introduced that aren't in the intent?
- **Semantic alignment**: How far has the meaning drifted? A small wording change may have large semantic impact ("we will" → "we might"), or a large textual change may be semantically minor (restructuring without changing the argument).
- **Decision history weight**: Does this change contradict a previously negotiated agreement? If so, escalate more aggressively.

The evaluation produces a **significance score** that determines whether to stop at Stage 1 or escalate.

**2. Simulation as Translator (Stage 2)**

Answers: **"What does this change mean at the other level?"**

- **Writing → Intent** (extraction): "Your writing now implies X instead of Y. Here's how the intent structure could be updated."
- **Intent → Writing** (generation): "If this intent changes, here's what the text would need to look like."

This translation makes the change **legible across levels** — the team can understand the change at both the abstract (intent) and concrete (writing) levels.

**3. Simulation as Negotiation Material (Stage 3)**

Answers: **"What would this mean for everyone else?"**

The system propagates the change and generates:
- **Impact map**: Which blocks and which people are affected, and to what degree
- **Simulated outcomes**: Concrete previews of what affected blocks would need to become — not just "Block X is affected" but "Block X would need to change from A to B"
- **Change cost**: How many blocks need to change — this constrains the option space for negotiation

These outputs become the **shared artifact** around which the team negotiates.

### How the Three Axes Interact with the Pipeline

| Axis | Effect on Pipeline |
|---|---|
| **Where** (Writing vs Intent) | Determines the **direction** of Stage 2 simulation: extract intent from writing, or generate writing from intent |
| **When** (Post-hoc vs Pre-hoc) | Determines the **tense**: "what has changed" vs "what would change if you proceed" |
| **Awareness** (Implicit vs Explicit) | Determines the **entry point**: Implicit → system initiates at Stage 1; Explicit post-hoc → user declares, may enter at Stage 2; Explicit pre-hoc → user previews, enters at Stage 1 in hypothetical mode |
| **Magnitude** | Determines **how deep** the pipeline goes: Stage 1, 2, or 3 |

## Negotiation and Decision Tracking

### What Simulation Provides for Negotiation

When the pipeline reaches Stage 3, the simulation has already produced:
- The **change itself** — what was changed (or would be changed) and why
- The **cross-level translation** — what this means at both intent and writing levels
- The **impact map** — who is affected, which blocks, to what degree
- The **simulated outcomes** — concrete previews of what everyone's work would need to become

This gives the team a **shared, concrete basis** for discussion, rather than negotiating over abstract descriptions of change.

### Decision Tracking

Warnings and escalation decisions should be informed not just by the current state of text and intents, but also by **the history of previous decisions**:

- If the team previously discussed and agreed on an intent, and a new change contradicts that agreement, the system should surface this: "This change conflicts with a decision made on [date] where the team agreed to [X]."
- Previous decisions add **weight** to the evaluation at Stage 1 — a change that contradicts an explicit team agreement should be escalated more aggressively than one that drifts from an original outline that was never explicitly discussed.
- When the team reaches a new agreement, the **baseline intent updates**, and this becomes the new reference point for future evaluations.

### Open Questions

- What counts as a "decision" that gets tracked? (Accepting a simulation suggestion? Completing a team discussion? Any edit to an intent that was reviewed by others?)
- How much structure should the negotiation process have? (Free-form discussion vs. structured approve/modify/reject workflow)
- Synchronous vs. asynchronous negotiation?
- Can the author proceed with the change before negotiation is complete, or does the change require team approval?

## Summary

```
ARCHITECTURE

  Writing layer (individual, dynamic, high-frequency)
      │
      │ Threshold 1: Does the delta cross the intent boundary?
      ▼
  Intent layer (common ground, stable, shared)
      │
      │ Threshold 2: Does the intent change affect other people?
      ▼
  Team negotiation (resolve and update baseline)


THREE AXES

  Axis 1: Where         Writing ←————————→ Intent
  Axis 2: When          Post-hoc ←———————→ Pre-hoc
  Axis 3: Awareness     Implicit ←———————→ Explicit


ONE CORE OPERATION

  Delta (from any source) → Simulation → Adaptive Visualization

  Three entry points, one pipeline:
    • System detects drift (implicit)
    • User previews hypothetical change (explicit, pre-hoc)
    • User declares completed change (explicit, post-hoc)


STAGED PIPELINE (adaptive depth)

  ┌──────────────────────────────────────────────────────┐
  │ Stage 1: AWARENESS (Individual)                      │
  │ Simulation EVALUATES the delta.                      │
  │ Small delta → inline annotation → STOP               │
  │ Crosses intent boundary → escalate ↓                 │
  ├──────────────────────────────────────────────────────┤
  │ Stage 2: CROSS-LEVEL TRANSLATION (Common Ground)     │
  │ Simulation TRANSLATES across levels.                 │
  │ Writing→Intent: extract implicit intent shift        │
  │ Intent→Writing: generate simulated text              │
  │ Only affects self → review & apply → STOP            │
  │ Affects others → escalate ↓                          │
  ├──────────────────────────────────────────────────────┤
  │ Stage 3: IMPACT & NEGOTIATION (Team)                 │
  │ Simulation MATERIALIZES outcomes for all affected.   │
  │ Team negotiates over concrete simulated impact.      │
  │ Decision recorded. Baseline intent updates.          │
  └──────────────────────────────────────────────────────┘

  Adaptive representation maps to stages:
    Stage 1 → Inline annotation (individual awareness)
    Stage 2 → Highlight + proposed changes (common ground update)
    Stage 3 → Diff view + impact map + negotiation (team resolution)

  Baseline intent evolves through the cycle:
    Initial agreement → drift detected → negotiation → new baseline → ...
```
