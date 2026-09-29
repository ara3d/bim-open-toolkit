---
id: TKT-104
title: An editable notebook graph cell: a live editor that forks or updates the turn's analysis
status: open
depends_on: [TKT-94]
owner:
fence: [bimopenflow/web/packages/bim-open-notebook/src/embeds/graph.ts, bimopenflow/web/packages/bim-open-notebook/src/document/format.ts, bimopenflow/web/packages/bim-open-notebook/test/**]
kind: idea
---

Extension point from docs/plans/graph-editor-package.md. A graph cell is a read-only mount of @bimopenflow/graph; readOnly: false plus connectAnalysis over the cell's analysis id would give a cell that autosaves to the host, which is the notebook plan's Editor embed (sessions S4 and S8, TKT-91). Open question first: a turn's embed is a snapshot of that turn, so an edit either forks the analysis under a new id or rewrites history; decide before building.
