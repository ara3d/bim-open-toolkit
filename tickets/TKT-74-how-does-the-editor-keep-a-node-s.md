---
id: TKT-74
title: How does the editor keep a node's schema current: show it before the node is clicked, and refresh it when a source gains columns?
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
kind: question
---

`docs/proposals/table-graph-migration.md:192` and `docs/proposals/table-graph-layers.md:262`. `NodeState` has no schema field, and the editor refreshes column options only after evaluation (`app.ts:207`).

Options: a schema field on node status; a separate endpoint; or leave schemas visible only after a click.

No default in the source.

Raised by reviews/2026-09-27-status.md
