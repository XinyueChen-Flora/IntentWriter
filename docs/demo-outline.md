# Introduction

1. Background and Motivation
* Collaborative writing is widespread in professional and academic contexts
* Despite tooling advances, collaborators still face coordination challenges

2. Limitations of Current Collaborative Writing Tools
* Edits are represented uniformly regardless of their significance to the team
* AI writing features focus on content quality (grammar, style, generation)
* No existing tool distinguishes routine edits from direction-changing ones

3. Design Vision: IntentWriter
* Maintain a living shared outline as a representation of team consensus
* Support significance-adaptive awareness to modulate notification salience
* Enable writers to preview the impact of changes before committing them
* Provide readable summaries of how edits affect the team's shared direction

4. System Architecture and Technical Approach
* Real-time synchronization using CRDT-based conflict resolution
* AI simulation pipeline for continuous outline-text alignment checking
* Hierarchical intent structure with parent-child dependency tracking
* Integration with collaborative editing frameworks (BlockNote, Yjs)
* Scalable WebSocket infrastructure for multi-user sessions

5. Evaluation Plan and Expected Contributions
* Controlled study comparing IntentWriter with baseline collaborative editing
* Metrics: change awareness accuracy, negotiation quality, artifact coherence
* Between-subjects design with student writing teams
* Expected to demonstrate improved coordination without added overhead
* Contributions: empirical findings on common ground breakdown, interaction design, and evaluation evidence
