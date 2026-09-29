---
id: TKT-125
title: Cards size themselves to their content, text never overflows, and the layout algorithms use real card sizes
status: done
depends_on: [TKT-124]
owner: claude-tkt125
fence: [bimopenflow/web/packages/graph/src/viewModel.ts, bimopenflow/web/packages/graph/src/nodeSize.ts, bimopenflow/web/packages/graph/src/canvasResize.ts, bimopenflow/web/packages/graph/src/canvasParts.ts, bimopenflow/web/packages/graph/src/canvasIntents.ts, bimopenflow/web/packages/graph/src/autoLayout.ts, bimopenflow/web/packages/graph/src/nodeRender.ts, bimopenflow/web/packages/graph/src/canvasSlots.ts, bimopenflow/web/packages/graph/src/index.ts, bimopenflow/web/packages/graph/test/**, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/addNodePlan.ts, docs/nodes.catalog.json]
---

## Acceptance criteria

- [x] A card with no saved width takes its width from its content: the widest of its title, id, port labels, and inline param values, measured with the painter's Measure, between NODE_WIDTH and a cap (about 520 px); a card with a saved layout.w keeps it (899cbe7; nodeSize.test.ts. Measured with NullPainter's fixed estimate rather than the browser's fonts, so the browser, the tests, and the committed sample layouts agree; see Done)
- [x] No text overflows a card at any width: every header, port label, slot label and value is fitted (fitText or wrapped) to the room the card actually has, with a unit test that measures each drawn text against its card for every sample graph in samples/*/ and every node style (49b52d1; textOverflow.test.ts renders every sample graph and every catalog kind in all four styles, as shown, at least width, and with long values)
- [x] Note height follows its wrapped text at the note's actual width (saved or default), using the same wrap as the painter, not a characters-per-line estimate (899cbe7; nodeSize.test.ts "note height")
- [x] autoLayout, freePosition, defaultPosition, and the palette's add-node placement use each card's actual size (saved or content-derived) so cards never overlap after auto layout or a new node; test/sampleOverlap.test.ts and autoLayout tests cover it (aedeae7; defaultPosition is replaced by freePosition at real size; autoLayout.test.ts and viewModel.test.ts; sampleOverlap green after a relayout of 28 samples in 899cbe7)
- [x] One corner drag adds exactly one undo step, proven by a test that drives gratify's runtime (pointerDown, pointerMove, pointerUp) rather than the intent function alone (b815af7; canvasResize.test.ts "corner drag through the runtime")
- [x] The corner grab radius is measured in screen pixels (divided by the viewport scale), so the handle is grabbable when the graph is zoomed out; same treatment for SOCKET_GRAB_RADIUS if it has the same problem (b815af7; the socket reach and the peek hover reach too)
- [x] All graph, state, and app package tests pass; a browser check on bof-web (host already on 5214, page on 5300) shows a long-value card wider than 260 with no clipped text, and a dragged card undone with one Ctrl+Z (graph 286, state 56, app 267 passed; browser check done with Playwright on Edge, see Done)

Follow-up to TKT-124 (manual corner resize). The owner asked on 2026-09-28: derive width and/or height from content when appropriate, make sure text does not overflow, and update the layout algorithms. Today nodeWidth() is 184 or 260 by whether the node has inline params, notes are a fixed 300 wide with height from a 34-chars-per-line estimate, and long values are ellipsized. autoLayout.ts sizes cards through nodeRender.nodeFootprint with a NullPainter measure (which does not depend on text width, per its comment), and app.ts computes freePosition from nodeWidth/nodeHeight, so both must move to the same size function the canvas draws with; put that function in one module (nodeSize.ts) that viewModel, autoLayout, and the app's placement all call. Content-derived width must be deterministic across the headless tests and the browser: measure with the Measure the canvas is given, and fall back to NullPainter's in tests. Browser check of TKT-124 on 2026-09-28 found: the resize works and the wire follows the new edge, but a tool-driven drag needed two Ctrl+Z presses to restore the original width (unconfirmed whether the synthetic drag sent two pointer-ups; settle it with a runtime-level test), and at the fitted zoom the 10 px world-space grab corner is under 3 screen pixels, so a press lands as a click. Serves W2 and W3.

## Done (commits 4f5ced4, 899cbe7, 49b52d1, aedeae7, b815af7)

`packages/graph/src/nodeSize.ts` holds the one size function, `nodeSize(node, want, measure)`. The view model, the resize gesture, the layouts, and the app's placement (`newNodeSize`, `addNodePlan.freeSpot`) all call it.

- Width without a saved w: the widest of the bold title plus room for the status dot, the id, each row of port labels, and each param row's label and value (`canvasSlots.slotWidth`; a dropdown counts its widest option). It is clamped between 184 (260 with params) and 520. The badge and the description do not count; both are fitted.
- A saved w is kept as set, between the least width and 900, even below the content width. Texts are then fitted to it. Height of non-note cards is never saved.
- Measured with NullPainter's fixed estimate, 0.55 px per px of font size, instead of the painter's Measure. With font-dependent widths, the sample overlap check could not vouch for what the browser shows. The overflow test measures text 10% wider than the estimate, plus 8% for the bold title, and still passes because every text is fitted at draw time.
- The 600-weight title is fitted to its room divided by 1.1, because gratify's CanvasPainter measures every text at weight 400.
- Grab reach is `radius / min(zoom, 1)`, which is unchanged at zoom 1 and above and constant in screen pixels below that. It applies to the corner (capped at half the card's shorter side), the wire sockets, and the peek hover. A corner press nearer a socket goes to the socket.
- The two-Ctrl+Z report from TKT-124 did not reproduce. A drag driven through gratify's Runtime adds exactly one undo step. The likely cause was the corner reach of under 3 pixels, which turned the tool's press into a move.

Browser check on 2026-09-29: Playwright drove Edge against the page on 5300, bfast-buffers analysis, zoom 1. A long title in the directory view.table widened that card from 260 to 520, and the title wrapped with nothing clipped. A mouse drag of its corner 80 px left autosaved `w: 440`, and the text rewrapped. One Ctrl+Z autosaved `{x: 370, y: 40}` and redrew the card at 520. The original title was then restored through `PUT /api/analyses/bfast-buffers`. The zoomed-out grab was checked only by the runtime test, because this page fits at zoom 1.

Outside the fence, and stated in each commit: samples/ (28 graphs relaid out by `npm run relayout-samples`, x and y only), canvasControls.ts, canvasLongSlot.ts, graphWidgets.ts, portGeometry.ts, peekWiring.ts.

Left open: notebooks that embed the relaid-out sample graphs need bim-open-notebook's `scripts/sync-embed-layouts.ts`.
