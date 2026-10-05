---
id: TKT-100
title: An Ask turn that only edits the graph is not forced to add an answer node
status: open
depends_on: [TKT-84]
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] Asking "add a note explaining the chart" to bim-level-summary adds the note and no other node
- [ ] A question that needs an answer is still checked for one

Found 2026-09-28 testing the Ask box: `src/studio/BimOpenFlow.Studio/AskChecks.cs:33` rejects any graph without a node named `answer`, so Haiku added an unrequested `view.table` named `answer` with a wrong title ("Elements and Rooms per Level" over an element count).
