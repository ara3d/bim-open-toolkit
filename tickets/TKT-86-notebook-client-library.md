---
id: TKT-86
title: Move the app helpers the notebook deep-imports into a client library
status: open
depends_on: [TKT-80]
owner:
fence: [bimopenflow/web/packages/client/**, bimopenflow/web/packages/app/src/**, bimopenflow/web/packages/bim-open-notebook/src/**]
---

## Acceptance criteria

- [ ] No file under packages/bim-open-notebook imports from @bimopenflow/app/src
- [ ] The /api/ask event reader and AskEvent exist once, used by duckdbDemo.ts and the notebook
- [ ] The 3D feed choice (planFeed in notebook, feedModel/feedData in paneArea.ts) exists once

From docs/plans/notebook.md, Debt: deep imports from @bimopenflow/app, the /api/ask stream reader, the 3D feed order. Blocked while app/src files are in claimed fences (TKT-11, 12, 26).
