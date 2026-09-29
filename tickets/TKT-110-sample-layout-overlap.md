---
id: TKT-110
title: Sample graph layouts have no overlapping nodes, checked by a non-blocking test
status: done
depends_on: []
owner: claude-tkt110
fence: [bimopenflow/web/packages/graph/src/autoLayout.ts, bimopenflow/web/packages/graph/src/nodeRender.ts, bimopenflow/web/packages/graph/test/**, bimopenflow/web/packages/graph/scripts/**, bimopenflow/web/packages/graph/vitest.layout.config.ts, bimopenflow/web/packages/graph/tsconfig.json, bimopenflow/web/packages/graph/package.json, samples/*/*.json, samples/*/graphs/**/*.json]
---

## Acceptance criteria

- [x] No two nodes overlap in any committed sample graph, measured with the node sizes the current node card styles draw (TKT-98), including the tallest style
- [x] Auto layout (graph/src/autoLayout.ts) spaces nodes by their measured size, so a graph laid out afresh has no overlap
- [x] A test lists every sample graph with overlapping nodes; it runs in its own command, outside the default test and gate runs, so a failure warns without blocking other work

Requested by the owner 2026-09-28: sample graph layouts overlap, likely because node cards grew with the switchable styles of TKT-98 (description text on the card) while stored positions and auto-layout spacing assume the old size. Low priority: the overlap test must not block commits, CI, or other agents' gates.

Fence changed 2026-09-28 by claude-tkt110: the painted card size is computed in `nodeRender.ts` (new `nodeFootprint`, next to the TKT-98 card layout it reuses), so it joins the fence; the relayout script lives in the graph package (`scripts/relayout-samples.ts`, run with vite-node) instead of the root `scripts/`, because it imports the TypeScript layout code and the gratify source alias; `tsconfig.json` includes that folder; the sample globs widen to `samples/analyses`, `samples/relations`, and the notebook graphs one folder deeper, which overlap too.

## Outcome (2026-09-28, claude-tkt110)

Root cause: nothing measured what a card paints. The classic and bar styles of TKT-98 hang the catalog description in a 21 px footer below the card rectangle, and the sockets sit 4.5 px outside it, while auto layout and every check used the rectangle alone. Separately, the stored sample positions were written for cards of about 140 px on a 180 to 220 px row pitch, and cards with inline parameters are 190 to 500 px tall. Before: 47 sample graphs overlapped as shown (38 files with stored positions, 9 DuckDB workflow entries at their stored positions); 33 of them overlap on the card rectangle alone, 14 more only through the footer.

- `nodeRender.nodeFootprint` gives the box a card paints in whichever style paints the most, from `nodeCardLayout`; `autoLayout` spaces nodes by it (8ab5331).
- `autoLayout.tidyLayout` fixes a stored layout without reordering it; `npm run relayout-samples` in `bimopenflow/web/packages/graph` rewrites the samples with it (a206ee2, samples in 4acf943).
- `npm run test:layout` in the same package lists every sample graph with overlapping cards, against a running host's catalog (`BOF_HOST`, default 5214). It is outside `npm test`. After: 0 graphs. DuckDB workflow entries are checked as the studio shows them, after `autoLayout`.

Left: the sample notebooks under `samples/notebooks/*.notebook.json` embed copies of their graphs with the old positions; regenerating them with `write-sample-notebooks.ts` picks up the new layouts. Hosts with an existing store keep their stale seeded copies until TKT-102 lands.
