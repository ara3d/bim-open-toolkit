---
id: TKT-98
title: Switchable node card styles, so the owner can compare how a node shows its title, description, and status
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/nodeStyle.ts, bimopenflow/web/packages/app/src/nodeRender.ts, bimopenflow/web/packages/app/src/nodeStyleChoice.ts, bimopenflow/web/packages/app/src/canvasParts.ts, bimopenflow/web/packages/app/src/topbar.ts, bimopenflow/web/packages/app/src/viewModel.ts, bimopenflow/web/packages/app/test/nodeStyle.test.ts, bimopenflow/web/packages/app/test/nodeRender.test.ts, bimopenflow/web/packages/app/test/canvasParts.test.ts, bimopenflow/web/packages/app/test/topbar.test.ts, bimopenflow/web/packages/app/src/app.ts]
---

## Acceptance criteria

- [ ] The topbar offers at least four node styles; switching redraws the canvas without reloading and the choice persists in localStorage
- [ ] Every style shows the node's catalog description on the card; the styles differ in where the title, id, and status live (dot, chip, colour bar, header tint)
- [ ] Node drawing lives in its own module with a pure layout function that the tests cover for each style

Requested by the owner 2026-09-28: nodes should carry text describing them, and the 4 px status dot at the top right (canvasParts.ts) is in question. The styles are the experiment that answers which presentation reads best.
