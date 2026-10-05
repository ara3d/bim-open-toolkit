---
id: TKT-84
title: Ask Claude from the editor: a text box beside the graph that edits the open flow
status: open
depends_on: [TKT-45]
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] The main editor shows an Ask box when the host offers /api/ask, and a request edits the open flow, whose edits arrive on the canvas
- [ ] start-bim-flow starts a host that offers /api/ask

Owner's flow review, 2026-09-27: 'I was expecting to be able to edit the graph by writing to Claude in a text box somewhere.' The Ask box exists only on /duckdb.html, served by BimOpenFlow.Studio. Relates to TKT-26 and TKT-29.
