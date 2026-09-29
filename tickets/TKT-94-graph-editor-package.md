---
id: TKT-94
title: The graph editor as a reusable package: per-instance state, a read-only mode, and live graph cells in the notebook
status: done
depends_on: [TKT-11, TKT-12]
owner:
fence: [bimopenflow/web/packages/graph/**, bimopenflow/web/packages/app/src/{autoLayout, canvasControls, canvasEditor, canvasIntents, canvasLongSlot, canvasParts, canvasSlots, canvasTheme, columnSelect, graphPreview, graphWidgets, longValueEditor, nodeBadge, nodeContextMenu, numericParam, paramText, peekCard, portGeometry, portHover, portResults, selectionBorder, slotRegistry, slotShared, suggestInput, suggestText, upstreamEdges, viewModel}.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/README.md, bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/bim-open-notebook/src/embeds/{graph, graphDiagram, contract}.ts, bimopenflow/web/packages/bim-open-notebook/src/page/{main, notebookView, styles}.ts, bimopenflow/web/packages/bim-open-notebook/test/**, bimopenflow/web/packages/bim-open-notebook/package.json, bimopenflow/web/packages/bim-open-notebook/README.md, bimopenflow/web/package-lock.json, gates/web-smoke.mjs, docs/ARCHITECTURE.md, docs/graph-module-layering.md, docs/plans/graph-editor-package.md, docs/plans/notebook.md]
---

## Acceptance criteria

- [ ] @bimopenflow/graph holds the canvas editor with its own tests and README, imports nothing from app, panes, api-client, or the notebook (a test enforces it), and gates/web-smoke.mjs runs it
- [ ] Two editors on one page keep separate island, editor, dropdown, and dispatch state: a parameter edited in one never reaches the other's store, and disposing one leaves the other intact (a headless test with two runtimes)
- [ ] A read-only editor pans, zooms, and selects, but no gesture, key, or island changes the document (a headless test drives a wire drag, a node drag, Delete, and a toggle press)
- [ ] The studio is unchanged: app tests and web-smoke pass, and a session in the browser pane drags a node, wires two ports, edits a parameter, switches theme, and peeks a wire as before
- [ ] Every graph embed in the twelve sample notebooks renders as a live read-only canvas with its focus nodes selected and their upstream wires lit; graphDiagram.ts is deleted; Re-evaluate all still reports every graph embed current

Plan: docs/plans/graph-editor-package.md (chunks G1 to G10, two waves). Wave A (G1 to G3) can start now; wave B waits on TKT-11 C8 and TKT-12 C9 and C10, or on their fences being narrowed, and is serialized with the Editor UX wave (TKT-95 to TKT-98), which edits the same canvas files. Owner request of 2026-09-28: the canvas as a reusable package with per-instance state and a read-only mode, so every notebook graph cell is a live editor, not an SVG diagram.
