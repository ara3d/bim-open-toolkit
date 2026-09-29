---
id: TKT-124
title: Nodes can be resized by dragging a corner handle, and the size is saved in the layout
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/graph/src/canvasParts.ts, bimopenflow/web/packages/graph/src/canvasIntents.ts, bimopenflow/web/packages/graph/src/viewModel.ts, bimopenflow/web/packages/graph/src/nodeRender.ts, bimopenflow/web/packages/graph/src/canvasSlots.ts, bimopenflow/web/packages/graph/src/canvasResize.ts, bimopenflow/web/packages/graph/test/canvasResize.test.ts, bimopenflow/web/packages/graph/test/viewModel.test.ts]
---

## Acceptance criteria

- [ ] Dragging a node's bottom-right corner changes its width (and height for notes) on the canvas, with a min width of NODE_WIDTH and min height of the computed nodeHeight
- [ ] Releasing the drag writes w (and h) into the document's layout for that node through setLayout, so it is saved, undoable with Ctrl+Z, and survives reload
- [ ] A wider card gives its inline param slots and header text the extra room; ports stay on the card edges
- [ ] Read-only canvases (notebook embeds) show no handle and ignore the gesture
- [ ] Unit tests cover the intent, the min-size clamp, and the setLayout merge; graph package tests pass

Nodes are not resizeable today. The document contract already carries an optional w and h per node (packages/state/src/document.ts NodeLayout), the reducer's setLayout merges over them so a drag does not drop a size, and viewModel.ts uses layout.w/h when present (lines ~185, ~200). Nothing sets them: canvasParts.ts has drag-to-move and drag-to-wire only, and CanvasIntent has move/moveEnd but no resize. Add a corner handle on hover of a selected or hovered card, transient 'resize' intents during the drag (like 'move'), and one 'resizeEnd' that dispatches setLayout with w/h; add both to MUTATING_INTENTS. Serves W2 (a graph you can inspect: long SQL and column lists on wide cards) and W3.
