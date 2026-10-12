---
id: TKT-279
title: The left sidebar opens narrower by default and can be dragged narrower, with step rows that wrap instead of truncating
status: done
depends_on: []
owner: builder-TKT-279
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/columnSplitter.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/shell.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/stepList.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] The Steps and Nodes sidebar opens at about 200 px on a fresh browser and can be dragged down to about 160 px; a stored width is still honoured
- [x] At 200 px the step rows wrap their description instead of truncating the node kind and id, and the Nodes catalog rows still show kind and pack

Owner's request 2026-10-11: the left pane takes more of the window than it earns. columnSplitter.ts sets fallback 240 and min 240 for bof-app-left-width; the step rows truncate the kind and the id with an ellipsis at that width already, so the fix is the row layout as much as the number.

## Resolution

bim-open-flow b938785. `LEFT_SPLIT` (app/src/columnSplitter.ts) falls back to 200 px, keeps its 160 px least width, and still reads a stored `bof-app-left-width`. Step rows wrap the title, the id, and the description (`overflow-wrap: anywhere`); only the parameter summary keeps one line with an ellipsis. Catalog rows are unchanged: the kind (which carries the pack prefix) and the description already wrap as block text under their pack heading. Tests: app/test/columnSplitter.test.ts, stepList.test.ts. Not covered by this fence: the studio look (studio.html) sets its own left fallback of 300 px in app/src/studio/studioChrome.ts (`leftCfg`) and `--bof-app-left: 280px` in studio.css; making it 200 too is a one-line change there.
