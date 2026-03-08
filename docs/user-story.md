# IntentWriter User Story: Calorie Tracking APP Proposal

## Background

HCI course group assignment. Three students — Alice, Bob, Charlie — need to write a proposal for a calorie tracking APP. They meet, discuss the structure, and agree on an outline.

## The Outline

| Section | Owner | Intent |
|---------|-------|--------|
| 1. Problem & User Needs | Alice | Target users are fitness beginners. Pain points: existing apps are too complex, manual input is tedious, hard to stick with long-term |
| 2. Competitive Analysis | Bob | Objectively compare MyFitnessPal, Lose It!, Yazio. Find the market gap: no app does photo-based food recognition |
| 3. Proposed Solution | Alice | Based on Section 1's pain points and Section 2's market gap, propose: photo recognition + simplified UI + social motivation |
| 4. Technical Feasibility | Bob | Demonstrate that Section 3's solution is technically viable: food recognition API, database, development timeline |
| 5. Evaluation Plan | Charlie | Design user testing: SUS score + task completion rate + 7-day retention + social interaction frequency |

Dependencies:
- Section 3 depends on Section 1 and Section 2
- Section 4 depends on Section 3
- Section 5 depends on Section 3

---

## Alice (Day 1)

Alice opens the document. All writing areas are empty. She is responsible for Section 1 and Section 3.

### Writing Section 1

Alice writes Section 1 and runs Check Alignment. Result:

| Intent Point | Status |
|---|---|
| Target users are fitness beginners | Aligned |
| Existing apps too complex | Aligned |
| Manual input is tedious | Partially Covered |
| Hard to stick with long-term | Aligned |

"Manual input is tedious" is only mentioned in passing. She clicks to see the AI explanation: "You mentioned manual input but didn't expand on specific pain points — searching food databases, estimating portions, repeating every meal."

Alice chooses **Align Writing** — AI generates supplementary content expanding on the manual input pain points. She reviews, adjusts, and accepts. Section 1 is now fully aligned.

### Writing Section 3

Section 3 depends on Section 2 (Bob's competitive analysis), which is still empty. Alice writes based on the agreed intent — "the core innovation is photo recognition."

She runs Check Alignment. Two issues surface:

**Issue 1: "Social motivation" → Missing**

AI explanation: "Your intent includes social motivation features, but your writing doesn't mention them at all."

Alice thinks about it. The proposal has limited space, and she believes the focus should be on photo recognition, not social features. She decides to propose removing "social motivation" from the outline.

She clicks **Propose Change** on the outline:
- ~~Photo recognition + simplified UI + social motivation~~ → Photo recognition + simplified UI

The system generates a full diff preview — she sees:
- **Outline diff**: Section 3, 4, 5's intents with social-related content marked for removal
- **Writing diff**: Her paragraph about social features in Section 3 marked for deletion, with AI suggesting redistributing that space to expand on photo recognition details

She submits the proposal. On the outline, all affected sections now show the proposed diff with a trace: "Alice proposed removing social motivation — focus limited space on photo recognition."

**Issue 2: Section 2 not yet written — her solution rests on an unverified assumption**

Alice has done some research herself and suspects competitors might already have photo recognition. She's not sure. She runs Impact Simulation for two paths:

**Path A — Competitors do NOT have photo recognition (original intent):**
- Outline diff: no changes needed
- Writing diff: no changes needed

**Path B — Competitors already HAVE photo recognition:**
- Outline diff: Section 1 intent adds "existing photo features are inaccurate"; Section 3 changes from "build photo recognition" to "build more accurate photo recognition"; Section 4 adds accuracy benchmarking; Section 5 adds accuracy comparison testing
- Writing diff: Section 1 gets an inserted sentence about low accuracy of existing features; Section 3's "our innovation is building photo recognition" changes to "our innovation is building more accurate photo recognition"

Both path previews are saved in the document, tagged: **Needs input from @Bob — pending Section 2 competitive research findings.**

### Alice writes Section 3 and leaves

Alice picks Path A for now (original intent) and writes Section 3 accordingly. She leaves the document with:

- Section 1: Completed, fully aligned
- Section 3: Completed, aligned to current intent but with a flagged dependency on Bob's findings
- A proposal to remove social motivation (with full diff preview)
- Two saved path simulations for the photo recognition question

---

## Bob (Day 2)

Bob opens the document. He sees:

- Section 1 (Alice): completed
- Section 2 (his): empty
- Section 3 (Alice): completed, with a flag — "Needs input from @Bob"
- Section 4 (his): empty
- Section 5 (Charlie): empty

### Alice's proposal: remove social motivation

On his Section 4's outline, Bob sees the proposed diff — the social features portion of his intent is marked for removal, with Alice's reasoning. This is a trace, not a blocking action. Bob notes it and moves on.

### Alice's two paths: does the competitor have photo recognition?

Bob has already done his research. MyFitnessPal does have photo recognition, but its accuracy is only about 60%. The answer is Path B.

He opens the two saved simulations and sees exactly what each path looks like — outline diff and writing diff side by side. He selects **Path B** and writes his reasoning: "Research confirms MyFitnessPal has photo recognition at ~60% accuracy. Our differentiation should focus on accuracy improvement."

Upon confirmation:
- Alice's Section 1 and Section 3 **automatically update** according to Path B's diff
- The change is recorded with Bob's reasoning attached
- Section 4 and 5's outlines show the downstream intent changes

### Writing Section 2

Bob writes his competitive analysis according to the confirmed direction — competitors have photo recognition but accuracy is poor. He runs Check Alignment. Fully aligned.

### Writing Section 4

Bob writes the technical feasibility section — how to improve recognition accuracy from 60% to 90%+, model selection, training data, development timeline.

He runs Check Alignment. Fully aligned. But while writing, Bob realized something new: to achieve 90%+ accuracy, they'd need a **user feedback loop** — users correct wrong recognitions, and the model learns. This wasn't in the original intent.

Bob sees an Orphan in his alignment check — content about the feedback loop that doesn't map to any intent point. Instead of deleting it, he **proposes a change from writing to outline**: add "user feedback loop for continuous accuracy improvement" to Section 4's intent.

He runs Impact Simulation to preview:
- **Outline diff**: Section 4 intent adds feedback loop; Section 3 intent adds a mention of the feedback mechanism as part of the solution; Section 5 intent adds "feedback loop engagement rate" as an evaluation metric
- **Writing diff**: Section 3 (Alice's) gets a suggested sentence about the feedback mechanism; Section 5 (Charlie's) shows where the new metric would go

Bob submits the proposal with the full diff preview.

### Bob leaves

- Section 2: Completed, fully aligned
- Section 4: Completed, fully aligned (with a pending proposal to add feedback loop to intent)
- Path B confirmed, Alice's sections auto-updated
- Proposal: add user feedback loop (with full diff preview)

---

## Charlie (Day 3)

Charlie opens the document. All sections are written except his. On his Section 5's outline, he sees:

**Change 1: Social motivation removed**
- His Section 5 intent: ~~social interaction frequency~~ removed
- Trace: Alice proposed, Bob noted — with full diff and reasoning

**Change 2: Photo recognition direction changed**
- His Section 5 intent: adds "accuracy comparison with competitors"
- Trace: Alice simulated two paths, Bob confirmed Path B — with full diff and reasoning

**Change 3: User feedback loop proposed**
- His Section 5 intent: proposed addition of "feedback loop engagement rate"
- Trace: Bob proposed from his Section 4 writing — with full diff preview

For Charlie, all three look the same: **his section is affected, here's what changed, here's why, here's the diff.** He reviews each one, sees they make sense, and now has complete context for writing Section 5.

### Writing Section 5

Charlie writes the evaluation plan based on the final state of the outline:
- SUS score
- Task completion rate
- 7-day retention
- Accuracy comparison with competitors (from Change 2)
- Feedback loop engagement rate (from Change 3)

He runs Check Alignment. Fully aligned. No orphans, no missing content, no contradictions.

### Final state

All five sections are fully aligned. The outline reflects the actual content. Every change that happened along the way has a trace — who, when, why, what was the impact, and who acknowledged it.

| Section | Owner | Status | Key Changes |
|---|---|---|---|
| 1. Problem & User Needs | Alice | Aligned | Expanded manual input pain points (Day 1); auto-updated to include accuracy issue (Day 2, Bob confirmed Path B) |
| 2. Competitive Analysis | Bob | Aligned | Written based on actual research — competitors have photo recognition at ~60% accuracy |
| 3. Proposed Solution | Alice | Aligned | Social motivation removed (Day 1, Alice proposed); shifted from "build photo recognition" to "build more accurate photo recognition" (Day 2, Path B); feedback mechanism added (Day 2, Bob proposed) |
| 4. Technical Feasibility | Bob | Aligned | Focused on accuracy improvement path; added user feedback loop for continuous learning |
| 5. Evaluation Plan | Charlie | Aligned | Metrics reflect all upstream changes — accuracy comparison and feedback engagement added, social metrics removed |

---

## What would have happened in Google Docs

1. Alice writes Section 1 and 3 on Day 1. She drifts slightly but doesn't notice. No tool tells her.

2. Bob opens the doc on Day 2. Reads Alice's sections, feels something is off but can't pinpoint what changed from the original plan. Sends a message in the group chat: "Did we change the direction?" No response for hours.

3. Bob does his research, finds competitors already have photo recognition. Writes his sections based on this new finding. Doesn't update Alice's sections because he doesn't want to edit her work. Leaves a comment: "FYI competitors already have this feature." Alice sees it the next day, isn't sure how much of her writing needs to change.

4. Charlie opens the doc on Day 3. Section 1 says "the innovation is building photo recognition." Section 2 says "competitors already have photo recognition." Section 3 still mentions social features that Bob's section doesn't account for. Charlie doesn't know which version to follow. Sends a message: "Can we meet to align?" The meeting happens on Day 4, one day before the deadline.

5. After the meeting, everyone spends Day 4 rewriting. They submit a version that's mostly coherent but rushed.

The problem isn't that the team is bad at communicating. The problem is that Google Docs tracks text changes, not intent changes. You can see what words were edited, but you can't see why, what it means for the rest of the document, or what decisions were made along the way.
