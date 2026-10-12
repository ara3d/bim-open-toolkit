---
id: TKT-267
title: viz-analyses pass A (7 graphs): notes that fit, one grid, Depth = 1 in clash-matrix, readable first charts
status: done
depends_on: [TKT-258]
owner:
fence: [samples/viz-analyses/viz-storey-stacking.json, samples/viz-analyses/viz-model-composition.json, samples/viz-analyses/viz-carbon-by-material.json, samples/viz-analyses/viz-carbon-intensity-by-storey.json, samples/viz-analyses/viz-clash-matrix.json, samples/viz-analyses/viz-construction-sequence.json, samples/viz-analyses/viz-door-accessibility.json, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-storey-stacking.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-model-composition.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-carbon-by-material.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-carbon-intensity-by-storey.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-clash-matrix.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-construction-sequence.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-door-accessibility.txt, samples/viz-analyses/README.md, tests/studio/BimOpenFlow.BimWorkflows.Tests/VizSampleAnalysesTests.cs]
workflow: [W3]
related: [TKT-234, TKT-236]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [ ] Each graph's about note stores width 560 and a height that fits its whole text in layout.about, and sits at (40, 40) with the first row below it; computed numbers move to the README
- [ ] Each graph is on one 330 x 184 grid with its sources at x 40 and no card under another; the duck.query nodes that type the DuckDB path take it from a duck.source named `database` instead
- [ ] chart.sort is none where a table.sort already orders the rows; no-op table.project nodes before view3d.isolate or view3d.hide are removed; goldens approved (after the goldens ticket) and VizSampleAnalysesTests passes
- [ ] viz-clash-matrix's storeys query filters s.Depth = 1 and storeys sits beside withStorey, not 3000 px away; viz-storey-stacking's first chart is one bar per storey (the 12-series chart stays as byClass); viz-model-composition's 3D row sits in one line under chart; viz-carbon-by-material's sources are at x 40 and its check chain in one row; viz-construction-sequence's `gantt` becomes taskChart titled Elements per task; viz-door-accessibility's doors and widths become one query
- [ ] This ticket owns README.md and VizSampleAnalysesTests.cs; the pass B ticket reports any test change it needs

From the 2026-10-11 review of samples/viz-analyses (14 graphs, split in two tickets with disjoint files). Every about note is 900 to 2,300 characters but the canvas shows 12 lines, so the explanation is cut before 'how to read it'; three conventions for note placement; column spacing 260 to 330 with cards overlapping in storey-stacking and model-composition. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.

Closed 2026-10-12 by the supervisor after commits 0d17b300 and f2756cc4. Deviation accepted: viz-clash-matrix uses the nearest storey (arg_min(StoreyName, Depth)), the rule TKT-268 adopted, since Depth = 1 would leave 50 of 170 listed elements without a storey; the README states the rule.
