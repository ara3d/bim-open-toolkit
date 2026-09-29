---
id: TKT-28
title: One studio for data and 3D: the view3d pane opens inside the DuckDB studio on the same graph
status: open
depends_on: [TKT-7, TKT-16]
owner:
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/panes/**, bimopenflow/web/packages/viz/**, samples/**, gates/**, docs/bim-flow-3d.md, docs/bim-flow-duckdb.md]
---

## Acceptance criteria

- [ ] The DuckDB studio offers the 3D view pane next to table and chart, fed by view3d.* nodes in the same graph, over the same host and store
- [ ] A committed Snowdon sample colours the model by a value a table node computed (rooms per storey or door width), with the legend TKT-16 defines
- [ ] The 3D page (/3d.html) is either the same page or documented as the standalone showcase of the same recipe, not a second data path
- [ ] A headless gate loads the sample and asserts the coloured instance count; the Snowdon captures regenerate

Owner's finding of 2026-09-26: there is a difference between graphs for data and graphs for 3D, and I want it all. Today the studio (tables, Ask) and the 3D page run on different hosts and data, and the brief's Scope had put query-driven colouring in 3D out; this ticket moves it in. Serves W3 and W4. Waits on TKT-7 for a shared Snowdon store; design the shared host and data path first.
