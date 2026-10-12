---
id: TKT-259
title: bim-analyses pass: a model input, an answer view with readable columns, a note and a chart per graph, one grid
status: done
depends_on: []
owner: builder-TKT-259
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/bim-analyses/**, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bim-*.txt, tests/studio/BimOpenFlow.BimWorkflows.Tests/BimSampleAnalysesTests.cs, tests/studio/BimOpenFlow.BimWorkflows.Tests/BimGraphInputTests.cs]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [ ] All 11 graphs declare a graph input `model` (default {SAMPLES}/sample.bos) held by one value.path node wired into every reader; the stale literal paths on wired readers are blank
- [ ] Every graph ends in a node named `answer`: a view.table with a title and only the readable columns (bim-dimensions: Name, Category, Level, SizeX, SizeY, SizeZ, Aspect, Volume; bim-nearest-door: Name, Number, Level, Nearest, Distance; bim-room-footprints: Name, Number, Level, Area, Perimeter, Footprint; bim-door-rooms and bim-duct-rooms rename A/B to Door or Duct and Room)
- [ ] bim-discipline-mix and bim-room-classes draw a chart.bar; every graph has an `about` view.note (bim-param-quality's says 30 entities, not 28, and explains the null Category rows or filters them)
- [ ] bim-param-quality's no-op `top` sort is removed or becomes table.limit; bim-dimensions' Aspect guards SizeY == 0; bim-room-containment is laid out in step order and sorted by Doors desc
- [ ] bim-door-rooms and bim-duct-rooms either fold into bim-room-containment as extra views or keep an about note naming it as the full version; the commit says which
- [ ] Positions follow one grid (second column 370, fourth 1030, second row y 224, value.path at x 40 not -290); table.sort uses A/descendingA in all graphs; goldens re-approved and README numbers checked

From the 2026-10-11 sample graph review (bim-analyses: 11 graphs, all green). Only bim-discipline-mix declares an input; no graph has an answer node; most end in a 20-plus-column table where the computed columns hide under '+n more'; sort is written two ways; positions drift (370/390, 1030/1050/1140, y 224/280). Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
