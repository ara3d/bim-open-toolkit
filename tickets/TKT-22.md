---
id: TKT-22
title: Remove the properties panel: every parameter is edited on its node
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/state/**, docs/DEMOS.md]
---

## Acceptance criteria

- [ ] paramsPane.ts and paramsPane.test.ts are deleted, the pane chooser offers no Params tab, and nothing under bimopenflow/web references the pane
- [ ] Every parameter kind in contracts.json (including Json, Expression, ModelRef, and Text with ColumnsOf suggestions) can be edited on the node card; a long value opens an editor anchored to the node; every edit goes through setParam and reverts in one undo step
- [ ] npm test in bimopenflow/web and node gates/web-smoke.mjs pass, with the paramsPane tests replaced by on-node tests covering the three kinds the pane used to hold
- [ ] The picked-element property sets in the 3D pane (inspectorPane.ts, entityProperties.ts) are untouched: they show model data, not node parameters

Serves W2 and W3 (inspect and adjust a graph) and principle 5 of PROJECT.md. Decision recorded in TKT-5 (owner, 2026-09-26): scalar parameters live in the graph, on the node, always; the properties panel is a second place to look and a second editing path, and it complicates the editor. Today canvasSlots.ts draws inline controls for scalars while paramsPane.ts keeps Json, Expression, and ModelRef; the split is what confuses a node author (docs/proposals/param-data-types.md, NOTES.md data-node-sets wave).
