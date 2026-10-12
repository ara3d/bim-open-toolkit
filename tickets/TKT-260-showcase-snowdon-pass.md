---
id: TKT-260
title: showcase and snowdon-toolkit pass: bos-to-relations charts building elements not STEP entities, inputs, notes, layout
status: done
depends_on: []
owner: builder-TKT-260
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/showcase-analyses/**, samples/showcase-tables/**, samples/snowdon-analyses/snowdon-toolkit.json, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bos-to-relations.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/csv-to-chart.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bfast-buffers.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/bfast-buffers.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/csv-to-chart.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/snowdon-toolkit.txt, tests/studio/BimOpenFlow.NrcWorkflows.Tests/ShowcaseGraphTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/BfastGraphTests.cs]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] bos-to-relations charts one bar per building element category (fed from bim.elements, or rel.filter Category not null plus rel.limit 20), so doors are visible, and declares a `model` input through a value.path
- [x] csv-to-chart columns at 40, 370, 700, 1030, 1360
- [x] bfast-buffers: the two readers' stale literal paths are blank, `values` is renamed (priceView or answer) and laid out level with its source, and an about note says the two chains read one file
- [x] snowdon-toolkit declares a `model` input (default {SNOWDON}) through a value.path so the recipes run on duplex.bos by one change; its wires no longer cross cards; an about note names the roots and says to open any leaf in the 3D pane
- [x] Goldens re-approved; README numbers hold

From the 2026-10-11 review. bos-to-relations' chart has 78 bars led by IFCPOLYLINE 864 and a null category of 77 because bos.load.entities lists every STEP entity; the 14 doors the README advertises are past the 40th bar. snowdon-toolkit's categories-to-band wire crosses the interior card and the snowdon-to-tint wire drops 600 px. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
