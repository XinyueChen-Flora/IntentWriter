# IntentWriter Lab Study Plan

## Overview

**RQ**: Does IntentWriter help collaborative writers (1) discover alignment problems, (2) resolve them with less coordination overhead, and (3) make better-informed decisions about changes?

**Design**: Between-subjects, 2 conditions
**Duration**: 2 days per group
**Group size**: 2 or 3 people (flexible based on available time)

---

## Conditions

| Condition | Tool |
|-----------|------|
| **Baseline** | Google Docs + ChatGPT (current best practice — participants can use AI freely for writing, reviewing, checking consistency) |
| **IntentWriter** | Full workflow: structured outline with intent, drift detection, impact simulation, proposal traces |

The comparison is not "AI vs no AI" — both conditions have AI. The question is whether **structured, intent-aligned AI** outperforms **ad-hoc AI use**.

---

## Participants

- **2-person groups**: 4-6 groups per condition → 16-24 total
- **3-person groups**: 3-5 groups per condition → 18-30 total

Recruit university students with collaborative writing experience.

---

## Schedule (2 Days)

### Day 1: Kickoff + Writing Round 1 (In-lab, ~90 min)

| Time | Activity |
|------|----------|
| 0-10 min | Intro, consent, tool tutorial |
| 10-40 min | Group discussion: agree on outline, assign sections, identify dependencies |
| 40-80 min | **Person A writes** their sections (Person B waits or leaves) |
| 80-90 min | Person A completes post-session survey |

### Day 2: Writing Round 2 + Debrief (In-lab, ~90 min)

| Time | Activity |
|------|----------|
| 0-40 min | **Person B writes** their sections (seeing A's work + traces) |
| 40-50 min | Person B completes post-session survey |
| 50-65 min | Both review the full document together, fill consistency assessment |
| 65-85 min | Semi-structured interview (group + individual) |
| 85-90 min | Final questionnaire, compensation |

If 3-person groups: Person B writes Day 1 afternoon or Day 2 morning, Person C writes after B, debrief with all three at the end of Day 2.

---

## Writing Task

Write a proposal for a mobile app that helps university students manage their sleep schedule.

Sections:
1. Problem & User Needs (Person A)
2. Competitive Analysis (Person B)
3. Proposed Solution (Person A)
4. Technical Feasibility (Person B)
5. Evaluation Plan (Person B or C)

Section 3 depends on Section 1 + 2. Section 4 depends on Section 3. This forces the dependency tension: A writes Section 3 before B has written Section 2.

---

## Metrics

### Problem Discovery

Can the writer identify alignment issues in their own writing?

| Metric | Measure |
|--------|---------|
| Issues found | After writing, ask: "List any inconsistencies or gaps you noticed." Compare against researcher-identified ground truth. |
| Discovery rate | # issues found by participant / # actual issues (precision + recall) |
| Discovery timing | Did they find the issue during writing or only during final review? |

### Problem Resolution

Once an issue is found, can the writer resolve it effectively?

| Metric | Measure |
|--------|---------|
| Resolution quality | External reviewers rate: did the resolution improve consistency or make it worse? |
| Resolution speed | Time from discovering an issue to resolving it (tool logs / observation) |
| Coordination needed | Did they need to message/ask their partner, or could they resolve it with the tool alone? |

### Decision Support

When making changes, does the tool help the writer understand consequences?

| Metric | Measure |
|--------|---------|
| Impact awareness | Post-session: "What other sections would be affected by your changes?" Compare against actual dependencies. |
| Decision confidence | Likert: "I felt confident my changes wouldn't break other sections." |
| Decision traceability | Ask Person B: "What changes did Person A make and why?" Compare against actual change log. |

### Document Quality

| Metric | Measure |
|--------|---------|
| Cross-section consistency | External reviewers (2 raters) score coherence, contradiction, argument flow (1-7 per dimension) |
| Intent alignment | Researcher compares final content against original outline intent |

---

## Post-Session Survey (5 min, after each person writes)

**Problem Discovery** (7-point Likert):
1. I noticed when my writing didn't match the original outline.
2. The tool helped me find issues I wouldn't have caught on my own.

**Problem Resolution** (7-point Likert):
3. When I found an inconsistency, I knew how to fix it.
4. I could resolve issues without needing to contact my teammate.

**Decision Support** (7-point Likert):
5. I understood how my changes would affect other sections.
6. I had enough information to make decisions about the writing direction.
7. I felt comfortable making changes that affected other people's sections.

**Coordination** (mixed):
8. How many times did you want to contact your teammate? (count)
9. What questions couldn't you answer from the tool alone? (open-ended)

---

## Interview Guide (15-20 min)

**Process**:
1. Walk me through what happened when you were writing. Did you run into any problems?
2. Was there a moment where you realized something was inconsistent? What did you do?

**Decision Making**:
3. Did you make any changes to the direction of the proposal? How did you decide?
4. (Person B) When you saw what Person A had written, was there anything unexpected? How did you handle it?

**Tool**:
5. What was most helpful about the tool? What was frustrating?
6. Was there a moment where the tool changed what you would have done?
7. (IntentWriter) Did you trust the alignment check results? Any false alarms or missed issues?
8. (IntentWriter) Show me a specific proposal or simulation — was it useful?

---

## Practical Notes

- Both conditions use the same task and same time constraints
- Baseline participants get a shared ChatGPT link — usage is unstructured and up to them
- Participants cannot discuss content outside the tool (logistics only)
- Screen-record all sessions for later analysis
- Pilot with 1 group per condition before full study
