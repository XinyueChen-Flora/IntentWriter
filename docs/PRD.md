# IntentWriter - Product Requirements Document

## 1. Vision & Problem Statement

### 1.1 The Problem with Traditional Collaborative Writing

In traditional collaborative writing systems, we assume a linear pathway:

```
Writer A's mental model (IM₁)
→ Writing action (IW₁)
→ Artifact change (A)
→ Writer B sees and understands (assumes CG is automatically formed)
→ Writer B's mental model (IM₂)
→ Writer B's subsequent actions (IW₂)
```

**This assumption is flawed.** Individual decisions don't reliably propagate into common ground or coordinate others' actions.

### 1.2 Two Fundamental Gaps

| Gap | Name | Problem |
|-----|------|---------|
| **Gap 1** | Decision Formation (IM₁ → IW₁) | Writer needs team input but has no support to get it. Writers either decide alone (risking misalignment) or remain stuck. |
| **Gap 2** | Decision Propagation (A → IM₂) | System assumes others will automatically notice changes, understand rationale, update mental models, and coordinate actions. In reality, this rarely happens. |

### 1.3 Our Solution: Three-Layer Model with Explicit Common Ground

IntentWriter bridges these gaps through a three-layer model:

| Layer | Purpose | Gap Addressed |
|-------|---------|---------------|
| **Layer 1** | Judging Team-Relevance | Helps writers recognize which decisions need team engagement |
| **Layer 2** | Collective Decision Formation | Addresses Gap 1 by supporting collective negotiation |
| **Layer 3** | Explicit Decision Propagation | Addresses Gap 2 by making CG updates explicit |

---

## 2. Current State Analysis

### 2.1 Existing Features

| Feature | Description | Layer Coverage |
|---------|-------------|----------------|
| **Intent Structure** | Hierarchical intent blocks with parent-child relationships | Layer 2 (partial) |
| **Coverage Status** | AI-powered alignment analysis (covered/partial/misaligned/missing/extra) | Layer 1 (partial) |
| **Writing Editor** | BlockNote-based collaborative editing linked to intents | Core infrastructure |
| **Shared Rules** | Writing rules with rationale, examples, and editing trace | Layer 2 (partial) |
| **Assignment System** | Assign intents to team members | Layer 3 (partial) |
| **Intent Attribution** | Track who created each intent and when | Layer 3 (partial) |
| **Real-time Sync** | PartyKit + Yjs for conflict-free collaboration | Core infrastructure |
| **AI Suggestions** | Suggested intents for content not in outline | Layer 2 (partial) |

### 2.2 Gap Analysis: What's Missing

#### Layer 1 Gaps (Judging Team-Relevance)

| Missing Feature | Description |
|-----------------|-------------|
| **Proactive Relevance Cues** | No system to alert writers when their edits may affect others |
| **Impact Preview** | Cannot see potential impacts before making changes |
| **Dependency Visualization** | No view of how sections/intents relate to each other |
| **Scope Indicators** | No visual distinction between local edits vs. team-affecting edits |

#### Layer 2 Gaps (Collective Decision Formation)

| Missing Feature | Description |
|-----------------|-------------|
| **Uncertainty Externalization** | No way to express "I'm stuck" or "I need input" |
| **Discussion/Negotiation Space** | No mechanism for team discussion on specific intents |
| **Option Comparison** | Cannot present multiple options for team to evaluate |
| **Voting/Consensus** | No mechanism for team to vote or reach consensus |
| **Decision Templates** | No structured templates for common uncertainty types |

#### Layer 3 Gaps (Decision Propagation)

| Missing Feature | Description |
|-----------------|-------------|
| **CG Update Notifications** | No explicit notifications when shared understanding changes |
| **Coordination Strength Levels** | Cannot specify if decision is FYI vs. requires acknowledgment vs. blocks others |
| **Acknowledgment Mechanisms** | No way for others to signal they've understood a change |
| **Impact Alerts** | No "this affects your work" notifications |
| **Disagreement Escalation** | No path to return to Layer 2 when someone disagrees |

---

## 3. Feature Roadmap

### Phase 1: Layer 1 - Team Relevance Awareness

> **Goal**: Help writers become aware of whether and how their action relates to the team

#### F1.1 Relevance Indicators in Writing Editor

**Description**: Show visual cues in the writing panel indicating team relevance of edits.

**User Story**: As a writer, I want to see which parts of my writing might affect others' work, so I can decide whether to involve the team.

**Requirements**:
- [ ] Color-coded highlighting in editor:
  - 🟢 Green: Within my assigned scope
  - 🟡 Yellow: Potential update to shared understanding
  - 🔴 Red: Potential conflict with others' work
- [ ] Hover tooltip showing: "This section is referenced by [Person B]'s work on [Section X]"
- [ ] Toggle to show/hide relevance indicators

**UI Mockup**:
```
┌─────────────────────────────────────────┐
│ [Writing Panel]                         │
│                                         │
│ This paragraph discusses... [🟢]        │
│                                         │
│ The core concept is... [🟡]             │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ This relates to Intent 2.3      │ │
│ │    assigned to @Alice               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ We should restructure... [🔴]           │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ Potential conflict:             │ │
│ │    @Bob is editing this section     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### F1.2 Dependency Graph View

**Description**: Visual graph showing relationships between intents and sections.

**User Story**: As a team member, I want to see how different parts of our document relate to each other, so I can understand the impact of changes.

**Requirements**:
- [ ] Graph view showing intent hierarchy with connections
- [ ] Highlight affected nodes when hovering over an intent
- [ ] Show assignments on nodes
- [ ] Filter by: my work, team member, coverage status

#### F1.3 Impact Preview Before Edit

**Description**: Show potential impacts before committing significant changes.

**User Story**: As a writer, before I restructure a section, I want to see what other parts might be affected.

**Requirements**:
- [ ] "Preview Impact" button for structural changes
- [ ] Modal showing: affected intents, affected team members, related writing blocks
- [ ] Option to notify affected team members before proceeding

---

### Phase 2: Layer 2 - Collective Decision Formation

> **Goal**: Support explicit negotiation to form/update common ground when individuals face uncertainty

#### F2.1 Uncertainty Markers

**Description**: Allow writers to mark specific points as "needs team input".

**User Story**: As a writer, when I'm uncertain about how to proceed, I want to easily escalate the decision to the team space.

**Requirements**:
- [ ] "Mark as Uncertain" button on any intent or writing block
- [ ] Uncertainty types:
  - "Choosing between options..." (present alternatives)
  - "How to..." (open question)
  - "Whether to..." (yes/no decision)
- [ ] Specify what input is needed: opinions, implications, alternatives
- [ ] Visual indicator showing pending uncertainties

**UI Mockup**:
```
┌─────────────────────────────────────────┐
│ Intent: Introduction approach           │
│                                         │
│ [❓ NEEDS TEAM INPUT]                   │
│                                         │
│ Type: Choosing between options          │
│ ┌─────────────────────────────────────┐ │
│ │ Option A: Start with problem stmt   │ │
│ │ Option B: Start with solution       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Asked by: @You • Needs: opinions        │
│                                         │
│ [💬 2 comments] [👍 Vote]               │
└─────────────────────────────────────────┘
```

#### F2.2 Discussion Threads on Intents

**Description**: Enable threaded discussions attached to specific intents.

**User Story**: As a team member, I want to discuss specific decisions with my team in context.

**Requirements**:
- [ ] Comment thread on each intent block
- [ ] @mention team members
- [ ] Reply and threading support
- [ ] Resolve/close discussion when decision is made
- [ ] Link discussion to resulting CG update

#### F2.3 Option Voting & Consensus

**Description**: Structured mechanism for team to vote on competing options.

**User Story**: As a team, we want to efficiently reach consensus on uncertain decisions.

**Requirements**:
- [ ] Create poll with 2-4 options
- [ ] Team members can vote + provide rationale
- [ ] Show vote distribution in real-time
- [ ] Configurable consensus threshold (majority, unanimous, etc.)
- [ ] Auto-resolve when threshold reached
- [ ] Summary of rationales when decision is made

#### F2.4 AI-Assisted Decision Support

**Description**: AI helps surface relevant context and implications for decisions.

**User Story**: As a writer facing uncertainty, I want AI to help me see implications I might have missed.

**Requirements**:
- [ ] "Analyze Options" button showing:
  - Trade-offs for each option
  - Related past decisions in the document
  - Affected sections/intents
- [ ] Predict potential questions from team
- [ ] Suggest missing options based on document context

---

### Phase 3: Layer 3 - Explicit Decision Propagation

> **Goal**: Enable formed decisions to explicitly propagate through CG and coordinate others' actions

#### F3.1 Decision Announcement with Coordination Levels

**Description**: When making significant decisions, writers specify coordination strength.

**User Story**: As a writer, when I make a decision that affects the team, I want to specify how much coordination is needed.

**Requirements**:
- [ ] Coordination levels:
  - 📢 **FYI**: Awareness only (no response needed)
  - ✋ **Acknowledge**: Needs confirmation of understanding
  - 🔗 **Align**: Requires others to align their work
  - 🚫 **Blocking**: Blocks others' work until resolved
- [ ] Each level triggers appropriate notification
- [ ] Include: decision summary, rationale, affected areas

**UI Mockup**:
```
┌─────────────────────────────────────────┐
│ 📣 New Decision                         │
├─────────────────────────────────────────┤
│ Intent: Introduction approach           │
│                                         │
│ Decision: Start with problem statement  │
│ Rationale: Better hook for readers...   │
│                                         │
│ Coordination Level:                     │
│ ○ 📢 FYI (awareness only)              │
│ ● ✋ Acknowledge (confirm understanding)│
│ ○ 🔗 Align (requires alignment)        │
│ ○ 🚫 Blocking (blocks until resolved)  │
│                                         │
│ Affects: @Alice (Section 2), @Bob (3)   │
│                                         │
│ [Cancel] [Announce Decision]            │
└─────────────────────────────────────────┘
```

#### F3.2 Acknowledgment & Response System

**Description**: Team members respond to decisions based on coordination level.

**User Story**: As a team member, when a decision affects my work, I want to acknowledge it and flag any concerns.

**Requirements**:
- [ ] Notification center for pending decisions
- [ ] Response options:
  - ✅ Acknowledged / Understood
  - ❓ Need clarification
  - ⚠️ Have concerns → escalate to Layer 2
- [ ] Track acknowledgment status per team member
- [ ] Reminder for unacknowledged decisions

#### F3.3 CG Update Log (Decision History)

**Description**: Maintain explicit log of all common ground updates.

**User Story**: As a team member, I want to see the history of team decisions to understand how our shared understanding evolved.

**Requirements**:
- [ ] Chronological log of all CG updates
- [ ] Filter by: intent, person, time, coordination level
- [ ] Each entry shows: decision, rationale, votes/discussion, acknowledgments
- [ ] Link from current intent to its decision history

#### F3.4 Personal Impact Dashboard

**Description**: Show each team member how recent decisions affect their assigned work.

**User Story**: As a team member, I want to quickly see which recent decisions require my attention or action.

**Requirements**:
- [ ] Dashboard showing:
  - Decisions awaiting my acknowledgment
  - Decisions affecting my assigned intents
  - My work that may need updating due to team decisions
- [ ] Priority sorting by coordination level
- [ ] One-click navigation to affected sections

---

## 4. Data Model Extensions

### 4.1 New Types

```typescript
// Uncertainty marker for Layer 2
type UncertaintyMarker = {
  id: string;
  intentId: string;
  type: 'choosing-options' | 'how-to' | 'whether-to' | 'open-question';
  description: string;
  options?: Array<{
    id: string;
    content: string;
    votes: string[]; // user IDs
    rationales: Array<{ userId: string; text: string }>;
  }>;
  inputNeeded: 'opinions' | 'implications' | 'alternatives';
  createdBy: string;
  createdAt: number;
  status: 'open' | 'resolved';
  resolvedDecisionId?: string;
};

// Discussion thread for Layer 2
type DiscussionThread = {
  id: string;
  intentId: string;
  comments: Array<{
    id: string;
    userId: string;
    content: string;
    createdAt: number;
    replyTo?: string;
  }>;
  status: 'active' | 'resolved';
};

// Decision announcement for Layer 3
type DecisionAnnouncement = {
  id: string;
  intentId: string;
  decision: string;
  rationale: string;
  coordinationLevel: 'fyi' | 'acknowledge' | 'align' | 'blocking';
  affectedUserIds: string[];
  affectedIntentIds: string[];
  createdBy: string;
  createdAt: number;
  acknowledgments: Array<{
    userId: string;
    status: 'acknowledged' | 'need-clarification' | 'have-concerns';
    comment?: string;
    timestamp: number;
  }>;
  linkedUncertaintyId?: string; // if resolved from Layer 2
};

// Extended IntentBlock
type IntentBlockExtended = IntentBlock & {
  uncertaintyMarker?: UncertaintyMarker;
  discussionThreadId?: string;
  decisionHistory: string[]; // DecisionAnnouncement IDs
  relevanceScore?: number; // for Layer 1 indicators
  affectsIntentIds?: string[]; // dependencies
};
```

### 4.2 Database Schema Additions

```sql
-- Uncertainty markers
CREATE TABLE uncertainty_markers (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  intent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  options JSONB,
  input_needed TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open',
  resolved_decision_id UUID
);

-- Discussion threads
CREATE TABLE discussion_threads (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  intent_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_comments (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES discussion_threads(id),
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  reply_to UUID REFERENCES discussion_comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision announcements
CREATE TABLE decision_announcements (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  intent_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  coordination_level TEXT NOT NULL,
  affected_user_ids UUID[],
  affected_intent_ids TEXT[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  linked_uncertainty_id UUID REFERENCES uncertainty_markers(id)
);

CREATE TABLE decision_acknowledgments (
  id UUID PRIMARY KEY,
  decision_id UUID REFERENCES decision_announcements(id),
  user_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Success Metrics

### 5.1 Layer 1 Metrics (Team Relevance)
- % of edits where relevance indicator was shown
- % of "potential conflict" warnings that were acted upon
- Reduction in conflicting simultaneous edits

### 5.2 Layer 2 Metrics (Decision Formation)
- Number of uncertainties externalized vs. decided alone
- Average time to resolve uncertainty
- Team participation rate in voting/discussion
- % of decisions with documented rationale

### 5.3 Layer 3 Metrics (Decision Propagation)
- % of decisions with acknowledgment from affected parties
- Average time to full acknowledgment
- Reduction in "I didn't know about that decision" incidents
- % of work that aligns with recent CG updates

---

## 6. Implementation Priority

### MVP (Phase 1)
Focus on Layer 1 basics + Layer 2 uncertainty markers:
1. Relevance indicators in writing editor (F1.1 - simplified)
2. Uncertainty markers on intents (F2.1)
3. Discussion threads on intents (F2.2)

### V1.0 (Phase 2)
Complete Layer 2 + start Layer 3:
1. Option voting & consensus (F2.3)
2. Decision announcements with levels (F3.1)
3. Acknowledgment system (F3.2)

### V1.5 (Phase 3)
Complete all layers:
1. Dependency graph view (F1.2)
2. Impact preview (F1.3)
3. AI-assisted decision support (F2.4)
4. CG update log (F3.3)
5. Personal impact dashboard (F3.4)

---

## 7. Appendix: Mapping Current Features to Three-Layer Model

| Current Feature | Layer | Coverage | Enhancement Needed |
|-----------------|-------|----------|-------------------|
| Coverage Status (covered/partial/misaligned/etc.) | L1 | Partial | Add relevance to others |
| Intent Structure | L2 | Partial | Add uncertainty markers |
| Assignment System | L3 | Partial | Add acknowledgment flow |
| Intent Attribution | L3 | Partial | Add decision history |
| Shared Rules | L2 | Partial | Add discussion/voting |
| AI Suggestions | L2 | Partial | Add implication analysis |
| Alignment Analysis | L1 | Partial | Add dependency detection |

---

## 8. Open Questions for Discussion

1. **Notification Philosophy**: How aggressive should notifications be? Balance between awareness and interruption.

2. **AI Role**: Should AI simulate team member reactions (as shown in notes)? What are the risks?

3. **Async vs Sync**: How do we handle time-sensitive decisions when team members are in different time zones?

4. **Escalation Paths**: When Layer 3 disagreement escalates to Layer 2, how do we prevent infinite loops?

5. **Adoption Strategy**: How do we introduce these features gradually without overwhelming users?
