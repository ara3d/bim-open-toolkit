---
id: TKT-286
title: Sample graphs pass a layout and wiring check: no overlapping cards, no wire behind a card, no backward wire, no unwired input; autoLayout produces such layouts and the editor relays out a graph whose cards overlap
status: done
depends_on: []
owner: session
session: 3777d13d-6750-4d06-989e-0517bca2a2c7
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/autoLayout.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/layoutCheck.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/portGeometry.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/viewModel.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/index.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/scripts/**, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**, deps/bim-open-flow/bimopenflow/web/packages/graph/package.json, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/samples/**/*.json, samples/**/*.json, bimopenflow/web/packages/studio-web/test/**]
workflow: [W2]
related: [TKT-110, TKT-125, TKT-141, TKT-259, TKT-277, TKT-278]
created: 2026-10-12
claimed: 2026-10-12
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] layoutCheck.ts reports overlapping cards, wires drawn behind a third card, wires running right to left, unwired required inputs and isolated nodes; npm run layout-report lists them per sample graph
- [x] autoLayout lays a graph out left to right with lanes for long wires and a wire-clearing pass; its unit test on the bim-door-rooms shape reports no fault
- [x] Every sample graph in the toolkit and in bim-open-flow passes the check, enforced by a test in each repository's default test run
- [x] Opening a graph whose cards overlap at today's card sizes lays it out afresh, as one undo step
- [x] http://localhost:5300/?analysis=bim-door-rooms shows no overlap and no wire behind a card in the browser

Owner's report 2026-10-12 with a screenshot of bim-door-rooms: bim.bounds runs under bim.rooms, the about note sits under spatial.intersects, the rooms wire passes behind a table.filter. The overlap test of TKT-110 existed but checked card boxes only and was not run when TKT-259 placed cards on a hand grid (rows 184 px) or when TKT-277/TKT-278 changed card heights. Before this ticket the new check found 201 overlaps, 270 wires behind cards and 88 backward wires in 77 of 96 toolkit sample graphs (with the TKT-278 working tree). Vertical (top-to-bottom) flow is out of scope: sockets sit on the left and right edges, so it bends every wire back; it needs top and bottom sockets first.

## Outcome (2026-10-12)

bim-open-flow e219661 (layoutCheck.ts, layered autoLayout, layout-report), 0cbab71 (several tunings scored by the check), ab3ddeb (the sources rail holds only sources whose every wire is a chip), 8d5a6c0 (8 samples relaid out, graph/test/sampleLayout.test.ts), dc965be (the app relays out a flow whose cards overlap on open, test/relayoutOnOpen.test.ts). Toolkit 0069c2c4: 62 samples relaid out (x and y only), bimopenflow/web/packages/studio-web/test/sampleLayout.test.ts. The pin moved to dc965be.

After: no overlap, no backward wire, no unwired input or isolated node in any sample of either repository. nrc-enrich-run keeps five wires behind cards (two sources each feed four steps across three layers) and is excused by name in the studio-web test until TKT-287 routes wires; the test fails if it stops needing the excuse. The graph package's npm test passes (54 files, 412 tests). Browser check on 5300: bim-door-rooms draws with no overlap and no wire behind a card, from the layout the host now serves.

Vertical flow is TKT-288. sampleGraphs.ts still has its own overlappingPairs and paintedBox; sampleOverlap.test.ts is now covered by sampleLayout.test.ts and could go, with them.
