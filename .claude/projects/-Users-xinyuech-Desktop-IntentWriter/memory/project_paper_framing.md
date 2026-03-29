---
name: Paper framing decisions (March 2026)
description: Core framing decisions for the UIST paper - coordination infrastructure, not design space; BNA separates writing from coordination; Sense/Gate/Negotiate as natural questions from relationship changes
type: project
---

## Core Framing

The paper's core argument: **Collaborative writing has never had independent coordination infrastructure.** Writing and coordination have always been entangled in the same document. We build the first coordination infrastructure for writing.

## Key Insights from Discussion

1. **Separation**: The fundamental contribution is separating "writing" (personal space) from "coordination" (team space via BNA). Coordination happens on BNA and the BNA-Writing relationship, not in the document.

2. **BNA as enabler**: BNA is not just an outline - it's the structural prerequisite that makes coordination computable. Without it, nothing else works.

3. **Relationship as core object**: The BNA ↔ Writing relationship is the coordination object. Changes in this relationship naturally produce three questions: how to sense it, what it means, how to respond → Sense, Gate, Negotiate.

4. **Infrastructure, not tool**: Like Git for code, PolicyKit for communities. Not prescribing how to coordinate, but making coordination *possible* for the first time.

5. **Configurable coordination is core contribution**: Different scenarios need different coordination - this is NOT just parameter tuning but qualitatively different workflows. Show through concrete instances (like PolicyKit's 6 examples), not abstract design space tables.

6. **Don't call it "design space" upfront**: The table of options feels abstract and disconnected. Better to show concrete configuration instances that demonstrate the need for configurability. Table can be supplementary.

7. **Xu Wang's concern**: Design space increases learning curve, many options seem predetermined. Response: design space describes the possibility space for researchers/developers, not a configuration UI for end users. Good defaults make it usable without understanding the full space.

## Paper Structure Direction

- Section 4 title should be "Coordination Infrastructure" not "Design Space"
- Need walkthrough figures showing the user experience, not just developer registration
- Need "before vs after" teaser figure
- Evaluation: case studies showing different configurations, not comparative study
- The table can stay but should come after concrete examples, not before
