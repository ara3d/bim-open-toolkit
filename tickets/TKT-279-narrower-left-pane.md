---
id: TKT-279
title: The left sidebar opens narrower by default and can be dragged narrower, with step rows that wrap instead of truncating
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/columnSplitter.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/shell.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/stepList.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
---

## Acceptance criteria

- [ ] The Steps and Nodes sidebar opens at about 200 px on a fresh browser and can be dragged down to about 160 px; a stored width is still honoured
- [ ] At 200 px the step rows wrap their description instead of truncating the node kind and id, and the Nodes catalog rows still show kind and pack

Owner's request 2026-10-11: the left pane takes more of the window than it earns. columnSplitter.ts sets fallback 240 and min 240 for bof-app-left-width; the step rows truncate the kind and the id with an ellipsis at that width already, so the fix is the row layout as much as the number.
