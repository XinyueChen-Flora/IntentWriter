# IntentWriter: Complete Interaction Design

## Overview

This document describes the end-to-end interaction flow for IntentWriter's coordination pipeline: from detecting alignment issues through simulation, judgment, team coordination, and resolution.

Two roles throughout: **Writer A** (the person making/proposing a change) and **Writer B** (the person who is affected by or needs to respond to the change).

---

## Part 1: Writer A's Flow

### Step 1: Writing & Detection

Writer A writes their section. The system continuously monitors alignment between writing and the outline.

**UI — Writing View:**
```
┌─────────────────────────┬──────────────────────────────┐
│   OUTLINE (left)        │   WRITING (right)            │
│                         │                              │
│   Section 1: Problem    │   [TipTap editor]            │
│     ✓ fitness beginners │                              │
│     ◐ manual input      │   Sentences highlighted:     │
│     ✓ hard to stick     │   green = covers intent      │
│                         │   yellow = orphan (not in     │
│   Section 3: Solution   │           outline)            │
│     ✓ photo recognition │                              │
│     ○ social motivation │                              │
│     ✓ simplified UI     │                              │
│                         │                              │
│                         │   ┌─────────────────────┐    │
│                         │   │ ✓ Check Alignment   │    │
│                         │   └─────────────────────┘    │
└─────────────────────────┴──────────────────────────────┘
```

After check, alignment issues appear in an **Alignment Summary** panel between the outline and the writing:

```
┌─ Alignment Summary ─────────────────────────────┐
│                                                  │
│  ◐ "manual input is tedious" — partially covered │
│     AI: "You mentioned it but didn't expand on   │
│     specific pain points."                       │
│     [Align Writing]  [Modify Outline]            │
│                                                  │
│  ○ "social motivation" — missing                 │
│     AI: "Your writing doesn't mention social     │
│     features at all."                            │
│     [Align Writing]  [Modify Outline]            │
│                                                  │
│  ⚠ Orphan detected — "gamification badges"       │
│     Your writing mentions this but it's not in   │
│     the outline.                                 │
│     [Add to Outline]  [Ignore]                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Writer A's choices at this point:**
- **Align Writing**: AI helps fill the gap in writing. No intent change. No Gate needed.
- **Modify Outline** / **Add to Outline**: This changes team consensus. → Enters Simulation Gate.

---

### Step 2: Simulation Gate

Writer A clicks "Modify Outline" (e.g., remove "social motivation" from the intent). The system runs impact simulation.

**UI — Simulation View:**

The middle panel transforms into the simulation panel. The writing sections on the right show before/after previews inline.

```
┌────────────────┬─────────────────────┬─────────────────────┐
│  OUTLINE       │  SIMULATION PANEL   │  WRITING            │
│  (left)        │  (center)           │  (right)            │
│                │                     │                     │
│  Section 3:    │  ┌─ Your Changes ─┐ │  Section 3:         │
│  Solution      │  │                 │ │  ┌── Before/After ─┐│
│   [struck:     │  │ - social        │ │  │ Current | After  ││
│    social      │  │   motivation    │ │  │ ~~~~~~~ | ...    ││
│    motivation] │  │   (removed)     │ │  │         |        ││
│                │  │                 │ │  └──────────────────┘│
│   + photo      │  └─────────────────┘ │                     │
│     recognition│                     │  Section 4:         │
│   + simplified │  ┌─ Impact ────────┐ │  (Bob's)            │
│     UI         │  │                 │ │  Minor impact       │
│                │  │ Sec 4 (Bob)     │ │  [Preview Writing]  │
│                │  │ Minor — social  │ │                     │
│                │  │ features ref    │ │  Section 5:         │
│                │  │ removed         │ │  (Charlie's)        │
│                │  │                 │ │  ┌── Before/After ─┐│
│                │  │ Sec 5 (Charlie) │ │  │ Current | After  ││
│                │  │ Significant —   │ │  │ social  | [gone] ││
│                │  │ evaluation      │ │  │ metric  |        ││
│                │  │ metrics change  │ │  │ removed |        ││
│                │  │                 │ │  └──────────────────┘│
│                │  └─────────────────┘ │                     │
└────────────────┴─────────────────────┴─────────────────────┘
```

Key elements:
- **Your Changes**: What outline modifications Writer A is making (with diff highlight)
- **Impact cards**: Which other sections are affected, at what level (minor/significant), and why
- **Writing before/after**: Inline in each affected section's writing area — shows the two paths (current state vs. changed state) side by side

Writer A can expand/collapse each impact card. For minor impacts, they can optionally trigger a writing preview to see the concrete before/after.

---

### Step 3: Judgment — Reasoning + Coordination Choice

After reviewing the simulation, the bottom of the simulation panel shows the judgment UI:

```
┌─ Share with Team ──────────────────────────────────────────┐
│                                                            │
│  Reasoning (required):                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ The proposal has limited space. Photo recognition    │  │
│  │ is our core innovation — social features would       │  │
│  │ dilute the focus. Removing social motivation lets    │  │
│  │ us go deeper on the technical differentiation.       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  What do you need from the team?                           │
│  ┌──────────┐ ┌────────────────┐ ┌──────────────────────┐  │
│  │ Inform   │ │ Ask for Input  │ │ Open for Discussion  │  │
│  │          │ │                │ │                      │  │
│  │ I've     │ │ I need someone │ │ Let's figure this    │  │
│  │ decided  │ │ to answer or   │ │ out together         │  │
│  │          │ │ make the call  │ │                      │  │
│  └──────────┘ └────────────────┘ └──────────────────────┘  │
│                                                            │
│  Notify:                                                   │
│  [Auto-filled based on impact: @Bob (Sec 4), @Charlie     │
│   (Sec 5)]                                                 │
│  Writer can add/remove people.                             │
│                                                            │
│  For "Ask for Input":                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Question: Should we keep social features or focus    │  │
│  │ entirely on photo recognition?                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  Assign to: [@Bob ▼]                                       │
│                                                            │
│                                    [Submit]                │
└────────────────────────────────────────────────────────────┘
```

**Three options — different intent, different recipient experience:**

**Inform** — "I've decided, letting you know."
- Outline updates immediately. The change is presented to recipients as a **done decision**.
- Recipients see the change trace with a lighter, informational tone.
- They can acknowledge, or escalate if they disagree.
- Good for: changes where Writer A is confident and the impact is manageable.

**Ask for Input** — "I need your judgment before this is settled."
- Outline updates to Writer A's best guess, but the change is marked as **pending input**.
- Recipients see it with a stronger signal: "your input is needed."
- They can answer a question, make the call (choose between before/after), or provide context.
- Good for: when Writer A lacks information or wants someone else to decide.

**Open for Discussion** — "Let's look at this together and decide."
- Outline updates to Writer A's proposed version, but the change is marked as **under discussion**.
- Recipients see it with the strongest signal: "this needs your attention."
- They can see the **simulated writing (before/after)** for all affected sections, discuss which direction to take, and collectively decide.
- Key: the simulation already generated concrete writing for both paths. The discussion is grounded in these real previews — "do we go with this version or the current one?" When a decision is made, the chosen writing is already there. No one needs to rewrite from scratch.
- Good for: significant cross-section impact where multiple people are affected.

The three modes differ in **how the change appears to recipients** (informational → needs input → needs discussion), **what actions recipients can take**, and **how settled the change feels** when they see it.

After submitting:
- Outline intent blocks update with change trace
- Affected blocks show a CHANGES indicator
- The simulation evidence, reasoning, and coordination choice are all persisted

---

### Step 4: After Submission — Writer A's View

The simulation panel closes. Writer A sees the outline updated with their changes. The changed intent blocks show traces:

```
┌─ Section 3: Proposed Solution ──────────────────────┐
│                                                      │
│  ✓ photo recognition                                 │
│  ✓ simplified UI                                     │
│  ⊘ social motivation  ── REMOVED                     │
│     changes by [Alice avatar]                        │
│     "Focus limited space on photo recognition"       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Writer A continues writing. The change is done from their side.

---

## Part 2: Writer B's Flow

### Step 1: Entering the Document

Writer B (Bob) opens the document. He sees change indicators on sections that have been affected.

**UI — Overview on entry:**

```
┌─────────────────────────┬──────────────────────────────┐
│   OUTLINE               │   WRITING                    │
│                         │                              │
│   Section 1: Problem    │                              │
│   (Alice) — aligned     │                              │
│                         │                              │
│   Section 2: Competitive│   [Bob's writing area]       │
│   (Bob) — empty         │                              │
│                         │                              │
│   Section 3: Solution   │                              │
│   (Alice) — aligned     │                              │
│    └ 1 change ──────────┼── ◆                          │
│                         │                              │
│   Section 4: Technical  │   [Bob's writing area]       │
│   (Bob)                 │                              │
│    └ affected by ───────┼── ◆ Alice's change           │
│      1 change           │   Minor impact on your       │
│                         │   section                    │
│                         │                              │
│   Section 5: Evaluation │                              │
│   (Charlie)             │                              │
│    └ affected by ───────┼── ◆                          │
│      1 change           │                              │
│                         │                              │
└─────────────────────────┴──────────────────────────────┘
```

The key signal for Bob: **his Section 4 has been affected by a change.** The indicator shows who made the change, the impact level, and the coordination mode.

**Notification strength depends on two factors:**

1. **Proximity** — Are you directly affected?
   - Your section is impacted → strong indicator, prominent badge
   - Another section changed but doesn't affect yours → lighter indicator, awareness only

2. **Coordination mode** — What does the proposer need from you?
   - Inform → informational badge: "Alice made a change" (can review at your pace)
   - Input → action-needed badge: "Alice needs your input" (should respond)
   - Discussion → discussion badge: "Alice opened this for discussion" (should participate)

The combination determines urgency. E.g., "your section is directly impacted + input needed" is the strongest signal. "Another section changed + inform" is the lightest.

---

### Step 2: Reviewing a Change

Bob clicks on the change indicator on his Section 4. This reconstructs the simulation view — the same evidence that Writer A saw, but now from Bob's perspective:

**UI — Change Review View:**

```
┌────────────────┬─────────────────────┬─────────────────────┐
│  OUTLINE       │  CHANGE DETAIL      │  WRITING            │
│  (left)        │  (center)           │  (right)            │
│                │                     │                     │
│  Section 3:    │  ┌─ Change ────────┐│                     │
│   [struck:     │  │ Alice removed   ││  Section 3:         │
│    social      │  │ "social         ││  Writing before/    │
│    motivation] │  │ motivation"     ││  after diff         │
│                │  │ from Section 3  ││                     │
│                │  │                 ││                     │
│                │  │ Reasoning:      ││                     │
│                │  │ "Focus limited  ││  Section 4 (yours): │
│                │  │ space on photo  ││  Impact: Minor      │
│                │  │ recognition"    ││  "Social features   │
│                │  │                 ││  reference in your  │
│                │  │ Impact on you:  ││  feasibility section │
│                │  │ Minor — your    ││  would need removal"│
│                │  │ section refs    ││                     │
│                │  │ social features ││  [Preview Writing   │
│                │  │                 ││   Impact]           │
│                │  └─────────────────┘│                     │
│                │                     │  Section 5:         │
│                │                     │  Impact: Significant│
│                │                     │  Writing before/    │
│                │                     │  after diff         │
│                │                     │                     │
└────────────────┴─────────────────────┴─────────────────────┘
```

Bob sees:
1. **What changed**: Alice removed "social motivation" from Section 3's outline
2. **Why**: Alice's reasoning — "Focus limited space on photo recognition"
3. **How it affects him**: Minor impact — his Section 4 references social features in the technical feasibility discussion
4. **Concrete evidence**: Before/after writing preview showing what would change in his and other sections

---

### Step 3: Writer B's Response

Based on what Writer A chose (Inform / Input / Discussion), Bob sees different action options at the bottom of the change detail panel.

#### If Writer A chose "Inform":

```
┌─ Response ──────────────────────────────────────────┐
│                                                      │
│  Alice informed you about this change.               │
│                                                      │
│  ┌──────────────┐  ┌────────────────────────┐        │
│  │ Acknowledge  │  │ I want to discuss this │        │
│  │     ✓        │  │ (escalate)             │        │
│  └──────────────┘  └────────────────────────┘        │
│                                                      │
│  Optional note:                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Bob can:
- **Acknowledge**: "Got it, I'll adjust my section accordingly." The trace records Bob's acknowledgment.
- **Escalate**: "I think we need to discuss this." This opens a discussion thread on this change, inviting others to weigh in.

#### If Writer A chose "Ask for Input":

```
┌─ Alice is asking for your input ────────────────────┐
│                                                      │
│  Question: "Based on your competitive research,      │
│  do competitors already have photo recognition?      │
│  If yes, we need to shift our positioning."          │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Your response:                               │    │
│  │ Yes — MyFitnessPal has photo recognition at  │    │
│  │ ~60% accuracy. Our differentiation should    │    │
│  │ focus on accuracy improvement.               │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────┐      │
│  │ Make the call:   │  │ Submit Response      │      │
│  │ Keep current ◯   │  │                      │      │
│  │ Accept change ◉  │  │                      │      │
│  └──────────────────┘  └──────────────────────┘      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Bob can:
- **Answer the question** with text
- **Make the call** if Alice asked him to decide (choose between before/after)
- The response is recorded in the change trace

#### If Writer A chose "Open for Discussion":

The key difference: recipients see the **full simulated writing side by side** and discuss which path to take. The simulation already generated concrete before/after writing for every affected section — the discussion is about choosing between these real previews.

```
┌─ Alice opened this for discussion ──────────────────┐
│                                                      │
│  Alice's reasoning:                                  │
│  "Focus limited space on photo recognition..."       │
│                                                      │
│  ┌─ Your Section (Section 4) ───────────────────┐    │
│  │                                              │    │
│  │  ┌─ Current ─────┐  ┌─ After Change ────┐   │    │
│  │  │ ...social     │  │ ...photo          │   │    │
│  │  │ features      │  │ recognition       │   │    │
│  │  │ include...    │  │ accuracy is the   │   │    │
│  │  │               │  │ key challenge...  │   │    │
│  │  └───────────────┘  └───────────────────┘   │    │
│  │                                              │    │
│  │  Impact: Minor — social features reference   │    │
│  │  would need removal from feasibility section │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─ Discussion ─────────────────────────────────┐    │
│  │                                              │    │
│  │  Bob: "I agree. My research shows the photo  │    │
│  │  recognition angle is stronger. The 'after'  │    │
│  │  version for my section looks right."         │    │
│  │                                              │    │
│  │  Charlie: "The 'after' version removes the   │    │
│  │  social metric from my section — that's fine, │    │
│  │  but I'd want to add an accuracy metric       │    │
│  │  instead."                                   │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Add your thoughts...                         │    │
│  └──────────────────────────────────────────────┘    │
│  [Reply]                                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

The discussion is grounded in **concrete writing artifacts**, not abstract outline changes:
- Each affected person sees the before/after writing preview for **their own section**
- They can evaluate: "does this 'after' version work for me?"
- They can respond with their assessment, suggest modifications, or raise concerns
- When the team agrees on a direction, the simulated writing is already generated — the affected writer's section can update directly from the simulation output, without requiring them to rewrite from scratch

---

## Part 3: Accumulation — The Timeline

Over time, changes accumulate on the outline. When Charlie opens the document on Day 3, he sees a timeline of all changes that affected his section:

**UI — Change Timeline on a Section:**

```
┌─ Section 5: Evaluation Plan ────────────────────────┐
│                                                      │
│  Current outline:                                    │
│  • SUS score                                         │
│  • Task completion rate                              │
│  • 7-day retention                                   │
│  • Accuracy comparison with competitors (new)        │
│  • Feedback loop engagement rate (new)               │
│                                                      │
│  ┌─ Change History ─────────────────────────────┐    │
│  │                                              │    │
│  │  ◆ Mar 6 — Alice removed social motivation   │    │
│  │    Impact: social interaction frequency       │    │
│  │    metric removed from your section           │    │
│  │    [View simulation + reasoning]              │    │
│  │    Bob acknowledged ✓                         │    │
│  │                                              │    │
│  │  ◆ Mar 7 — Bob confirmed: competitors have   │    │
│  │    photo recognition at 60% accuracy          │    │
│  │    Impact: added "accuracy comparison with    │    │
│  │    competitors" to your evaluation metrics    │    │
│  │    [View simulation + reasoning]              │    │
│  │                                              │    │
│  │  ◆ Mar 7 — Bob proposed: add feedback loop   │    │
│  │    Impact: added "feedback loop engagement    │    │
│  │    rate" to your evaluation metrics           │    │
│  │    [View simulation + reasoning]              │    │
│  │    Discussion: Alice agreed, Charlie pending  │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Each entry in the timeline has:
- **Who** made the change and **when**
- **What** changed (the outline diff)
- **Why** (reasoning, clickable to expand)
- **How it affects this section** (the specific impact)
- **Simulation evidence** (clickable — reconstructs the before/after view)
- **Team response** (acknowledgments, discussion, decisions)

Charlie can click into any change to see the full simulation context — the same view that the original proposer saw, including before/after writing previews. This gives Charlie complete context for understanding how the outline evolved and why, without needing to schedule a meeting.

---

## Part 4: Resolution & The Cycle Continues

When a change is resolved (through any coordination mode):

1. **Outline updates to the agreed direction.** The intent blocks reflect the new consensus.

2. **Simulated writing can be applied directly.** If the team chose the "after" path, the simulation already generated concrete writing for affected sections. The affected writer can review and accept this generated writing — they don't need to rewrite from scratch. The simulation output serves as both decision-making evidence AND the actual content that gets applied.

3. **Affected sections' alignment status resets.** Even with simulated writing applied, the writer may want to adjust phrasing, add nuance, or integrate it with surrounding text. The next alignment check will verify everything is consistent.

4. **Each iteration adds to the timeline.** If Bob adjusts his outline further, that change gets its own trace. The timeline grows, providing a complete history of how the document's direction evolved.

```
   A writes → detects drift → simulates → shares (Inform/Input/Discuss)
       ↑                                           │
       │         Outline updates                    │
       │         Simulated writing applied          │
       │              │                             ▼
       │              ▼                        B sees change
       │     B's alignment resets              B reviews evidence
       │              │                        B responds
       │              ▼                             │
       └──── B writes → detects new drift ──────────┘
                    (cycle continues)
```

The simulation serves a dual purpose throughout this cycle:
- **Before decision**: It's evidence — "if we make this change, here's what the writing would look like"
- **After decision**: It's content — the generated writing can be directly applied, reducing the cost of accepting a change

---

## Summary: What Exists vs. What Needs to Be Built

### Already built:
- Writing + outline side-by-side layout
- Alignment detection (check-drift API) with coverage icons
- Bidirectional sentence ↔ intent linking and highlighting
- Alignment summary with Align Writing / Modify Outline options
- Simulation Gate: impact assessment + writing preview (before/after)
- Proposal creation with reasoning
- Basic proposal viewing (ProposalViewer reconstructs simulation)
- Change traces on intent blocks (CHANGES badge)
- Basic voting (approve/reject)

### Needs to be built:
- **Judgment UI**: The three-option coordination choice (Inform / Input / Discussion) after simulation, with notification targeting
- **Inform flow**: Outline auto-update + notification with impact detail + acknowledge/escalate actions
- **Input flow**: Question field + assign to person + response UI (answer + make the call)
- **Discussion flow**: Thread attached to change trace + multi-person responses
- **Escalation**: Inform → Discussion conversion
- **Resolution flow**: Outline auto-update after resolution + affected sections' alignment status reset
- **Change Timeline**: Accumulated history view per section showing all changes with expandable simulation evidence
- **Notification system**: Differentiated notification strength (direct impact = strong, awareness = light)
