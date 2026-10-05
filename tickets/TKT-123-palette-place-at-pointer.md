---
id: TKT-123
title: A node added from the Space palette lands under the pointer
status: open
depends_on: [TKT-120]
owner:
fence: [bimopenflow/web/packages/graph/src/canvasEditor.ts, bimopenflow/web/packages/graph/test/**, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/startPage.ts, bimopenflow/web/packages/app/test/**]
workflow: [W2]
---

## Acceptance criteria

- [ ] GraphEditor exposes the screen-to-canvas conversion (clientToWorld in canvasEditor.ts) or the viewport, and app.ts places a Space-palette node at the pointer's canvas position, or the visible centre when the pointer is off the canvas
- [ ] The added node is always inside the visible canvas
- [ ] Space does not open the palette while the start page is showing
- [ ] App and graph unit tests pass; gates/web-smoke.mjs passes

Left from TKT-120 (d068ef1), 2026-09-28: Space opens the palette at the pointer, but the node goes to the first free grid spot (freeSpot in app.ts) because clientToWorld is private to the graph package, so it can land off-screen. The builder also noted Space opens the palette over the start page when nothing is focused. Serves W2.
