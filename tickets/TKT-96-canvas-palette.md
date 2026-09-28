---
id: TKT-96
title: Add nodes from the canvas: a palette at the cursor on right-click, and a palette filtered to compatible kinds when a wire is dropped on empty canvas
status: done
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/paletteFilter.ts, bimopenflow/web/packages/app/src/addNodePlan.ts, bimopenflow/web/packages/app/src/canvasPalette.ts, bimopenflow/web/packages/app/src/nodeContextMenu.ts, bimopenflow/web/packages/app/src/canvasIntents.ts, bimopenflow/web/packages/app/src/canvasParts.ts, bimopenflow/web/packages/app/test/paletteFilter.test.ts, bimopenflow/web/packages/app/test/addNodePlan.test.ts, bimopenflow/web/packages/app/test/canvasPalette.test.ts, bimopenflow/web/packages/app/test/nodeContextMenu.test.ts, bimopenflow/web/packages/state/src/actions.ts, bimopenflow/web/packages/state/src/reducer.ts, bimopenflow/web/packages/state/test/batch.test.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/canvasEditor.ts]
---

## Acceptance criteria

- [ ] Right-clicking empty canvas opens a searchable palette at the cursor; choosing a kind adds the node there, selected, as one undo step
- [ ] Dropping a dragged wire on empty canvas opens the palette filtered to kinds with a compatible port; choosing one adds the node at the drop point and connects it, as one undo step
- [ ] Adding a node from the sidebar is one undo step

Serves W2. docs/proposals/editor-ux-harvest.md, 'Building a graph': Studio Graph's palette.ts and wires.ts are the prior code. Needs a compound store action so add, place, select, and connect undo together (the TODO in app.ts addNode).
