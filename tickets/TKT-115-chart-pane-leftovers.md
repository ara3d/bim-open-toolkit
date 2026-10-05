---
id: TKT-115
title: Finish TKT-20's leftovers: the studio doc's right-panel text, and rename the tableOnly option
status: open
depends_on: []
owner:
fence: [docs/bim-flow-duckdb.md, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/studio-web/src/duckdbDemo.ts, bimopenflow/web/packages/client/src/paneChoice.ts, bimopenflow/web/packages/app/src/paneArea.ts]
workflow: [W3]
---

## Acceptance criteria

- [ ] docs/bim-flow-duckdb.md says the right panel has a Chart tab for chart nodes and lists Rooms by storey's chart
- [ ] The pane-area option tableOnly has a name that says it allows a Chart tab

Held back 2026-09-28 because another session had uncommitted edits in docs/bim-flow-duckdb.md and TKT-12/TKT-26 hold app.ts and duckdbDemo.ts. Note: scripts/nrc-walkthrough.mjs's Snowdon room-distribution figure now captures the chart, since the flow opens on it.

Added 2026-09-29 by TKT-114: docs/bim-flow-duckdb.md also says the check "evaluates all 48 nodes"; it is 50 across the 9 graphs since TKT-20 added two to Rooms by storey.
