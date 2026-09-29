---
id: TKT-125
title: Cards size themselves to their content, text never overflows, and the layout algorithms use real card sizes
status: open
depends_on: [TKT-124]
owner:
fence: [bimopenflow/web/packages/graph/src/viewModel.ts, bimopenflow/web/packages/graph/src/nodeSize.ts, bimopenflow/web/packages/graph/src/canvasResize.ts, bimopenflow/web/packages/graph/src/canvasParts.ts, bimopenflow/web/packages/graph/src/canvasIntents.ts, bimopenflow/web/packages/graph/src/autoLayout.ts, bimopenflow/web/packages/graph/src/nodeRender.ts, bimopenflow/web/packages/graph/src/canvasSlots.ts, bimopenflow/web/packages/graph/src/index.ts, bimopenflow/web/packages/graph/test/**, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/addNodePlan.ts, docs/nodes.catalog.json]
---

## Acceptance criteria

- [ ] A card with no saved width takes its width from its content: the widest of its title, id, port labels, and inline param values, measured with the painter's Measure, between NODE_WIDTH and a cap (about 520 px); a card with a saved layout.w keeps it
- [ ] No text overflows a card at any width: every header, port label, slot label and value is fitted (fitText or wrapped) to the room the card actually has, with a unit test that measures each drawn text against its card for every sample graph in samples/*/ and every node style
- [ ] Note height follows its wrapped text at the note's actual width (saved or default), using the same wrap as the painter, not a characters-per-line estimate
- [ ] autoLayout, freePosition, defaultPosition, and the palette's add-node placement use each card's actual size (saved or content-derived) so cards never overlap after auto layout or a new node; test/sampleOverlap.test.ts and autoLayout tests cover it
- [ ] One corner drag adds exactly one undo step, proven by a test that drives gratify's runtime (pointerDown, pointerMove, pointerUp) rather than the intent function alone
- [ ] The corner grab radius is measured in screen pixels (divided by the viewport scale), so the handle is grabbable when the graph is zoomed out; same treatment for SOCKET_GRAB_RADIUS if it has the same problem
- [ ] All graph, state, and app package tests pass; a browser check on bof-web (host already on 5214, page on 5300) shows a long-value card wider than 260 with no clipped text, and a dragged card undone with one Ctrl+Z

Follow-up to TKT-124 (manual corner resize). The owner asked on 2026-09-28: derive width and/or height from content when appropriate, make sure text does not overflow, and update the layout algorithms. Today nodeWidth() is 184 or 260 by whether the node has inline params, notes are a fixed 300 wide with height from a 34-chars-per-line estimate, and long values are ellipsized. autoLayout.ts sizes cards through nodeRender.nodeFootprint with a NullPainter measure (which does not depend on text width, per its comment), and app.ts computes freePosition from nodeWidth/nodeHeight, so both must move to the same size function the canvas draws with; put that function in one module (nodeSize.ts) that viewModel, autoLayout, and the app's placement all call. Content-derived width must be deterministic across the headless tests and the browser: measure with the Measure the canvas is given, and fall back to NullPainter's in tests. Browser check of TKT-124 on 2026-09-28 found: the resize works and the wire follows the new edge, but a tool-driven drag needed two Ctrl+Z presses to restore the original width (unconfirmed whether the synthetic drag sent two pointer-ups; settle it with a runtime-level test), and at the fitted zoom the 10 px world-space grab corner is under 3 screen pixels, so a press lands as a click. Serves W2 and W3.
