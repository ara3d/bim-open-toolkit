---
id: TKT-108
title: Notebook graph embeds fit the whole graph to the cell
status: done
depends_on: []
owner: claude-tkt108
fence: [bimopenflow/web/packages/bim-open-notebook/src/embeds/graph.ts, bimopenflow/web/packages/bim-open-notebook/src/page/styles.ts, bimopenflow/web/packages/bim-open-notebook/test/**, bimopenflow/web/packages/graph/src/canvasEditor.ts, bimopenflow/web/packages/graph/test/**]
---

## Acceptance criteria

- [x] Every graph embed in the notebook shows the whole graph inside its cell on first paint: no node cropped at the right or bottom edge, no large empty margin
- [x] The cell's height follows the graph's aspect ratio within a minimum and maximum, so a wide shallow graph does not sit in a tall empty box and a deep graph is not squashed
- [x] The fit is recomputed when the cell is resized (column width change, window resize)
- [x] Tests cover the fit computation for a wide graph, a tall graph, and a one-node graph; notebook and graph typecheck clean

Requested by the owner 2026-09-28: in the notebook, graphs should be properly fit to the space. Today (commit 6993443, TKT-94) the embed calls editor.fit({ minZoom: 1 }) in embeds/graph.ts, which anchors a graph wider than the column at its top-left corner and crops the rest instead of scaling it down. canvasEditor.ts fit() also reserves fixed 48/72 px margins. Readability at small zoom is a trade-off to weigh; if text becomes unreadable, say so and choose a floor with a reason.
