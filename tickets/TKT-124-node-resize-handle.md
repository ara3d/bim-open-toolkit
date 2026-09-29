---
id: TKT-124
title: Nodes can be resized by dragging a corner handle, and the size is saved in the layout
status: done
depends_on: []
owner: claude-tkt124
fence: [bimopenflow/web/packages/graph/src/canvasParts.ts, bimopenflow/web/packages/graph/src/canvasIntents.ts, bimopenflow/web/packages/graph/src/viewModel.ts, bimopenflow/web/packages/graph/src/nodeRender.ts, bimopenflow/web/packages/graph/src/canvasSlots.ts, bimopenflow/web/packages/graph/src/canvasResize.ts, bimopenflow/web/packages/graph/test/canvasResize.test.ts, bimopenflow/web/packages/graph/test/viewModel.test.ts]
---

## Acceptance criteria

- [x] Dragging a node's bottom-right corner changes its width (and height for notes) on the canvas, with a min width of NODE_WIDTH and min height of the computed nodeHeight
- [x] Releasing the drag writes w (and h) into the document's layout for that node through setLayout, so it is saved, undoable with Ctrl+Z, and survives reload
- [x] A wider card gives its inline param slots and header text the extra room; ports stay on the card edges
- [x] Read-only canvases (notebook embeds) show no handle and ignore the gesture
- [x] Unit tests cover the intent, the min-size clamp, and the setLayout merge; graph package tests pass

Nodes are not resizeable today. The document contract already carries an optional w and h per node (packages/state/src/document.ts NodeLayout), the reducer's setLayout merges over them so a drag does not drop a size, and viewModel.ts uses layout.w/h when present (lines ~185, ~200). Nothing sets them: canvasParts.ts has drag-to-move and drag-to-wire only, and CanvasIntent has move/moveEnd but no resize. Add a corner handle on hover of a selected or hovered card, transient 'resize' intents during the drag (like 'move'), and one 'resizeEnd' that dispatches setLayout with w/h; add both to MUTATING_INTENTS. Serves W2 (a graph you can inspect: long SQL and column lists on wide cards) and W3.

## Done (commit 75c351b)

A press within 10 px of a card's bottom-right corner starts a resize. The drag sends transient `resize` intents, and releasing sends one `resizeEnd`, which calls setLayout with x, y, w, and h for a note. The pure clamp and hit test are in `packages/graph/src/canvasResize.ts`. `viewModel.fitNodeSize` applies the clamp to saved layouts as well.

- Minimum size is the card's default size: `nodeWidth(params)`, so 260 for a card with params, and NODE_WIDTH (184) for one without. Notes use NOTE_WIDTH and `noteHeight`. Maximum is 900.
- Only a note's height can be resized. For other cards the height follows the content, and `layout.h` is ignored for them.
- A taller note wraps as many lines as its height holds.
- The grip is drawn only on hovered or selected cards, never in read-only mode. There is no resize cursor, because gratify parts have no cursor API.
- nodeRender.ts, canvasSlots.ts, and portGeometry.ts already read the node's width. They needed no change.

Verified: `vitest run` in packages/graph gives 38 files and 268 tests passed. `test/canvasResize.test.ts` covers the hit test, the clamp, the intents, the setLayout merge after a move, undo, and read-only. The packages/state tests give 56 passed. `tsc --noEmit` is clean for graph and app. No browser check was done.
