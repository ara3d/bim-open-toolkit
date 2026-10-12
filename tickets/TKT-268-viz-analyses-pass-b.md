---
id: TKT-268
title: viz-analyses pass B (7 graphs): notes that fit, one grid, Depth = 1 and a shared model source in element-size-outliers, a 3D side for the window-to-wall ratio
status: done
depends_on: [TKT-258]
owner:
fence: [samples/viz-analyses/viz-element-size-outliers.json, samples/viz-analyses/viz-facade-orientation.json, samples/viz-analyses/viz-window-to-wall-ratio.json, samples/viz-analyses/viz-opening-schedule.json, samples/viz-analyses/viz-parameter-completeness.json, samples/viz-analyses/viz-progress-s-curve.json, samples/viz-analyses/viz-room-areas.json, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-element-size-outliers.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-facade-orientation.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-window-to-wall-ratio.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-opening-schedule.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-parameter-completeness.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-progress-s-curve.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-room-areas.txt]
workflow: [W3]
related: [TKT-234, TKT-236]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [ ] Each graph's about note stores width 560 and a height that fits its whole text in layout.about, and sits at (40, 40) with the first row below it; computed numbers move to the README
- [ ] Each graph is on one 330 x 184 grid with its sources at x 40 and no card under another; the duck.query nodes that type the DuckDB path take it from a duck.source named `database` instead
- [ ] chart.sort is none where a table.sort already orders the rows; no-op table.project nodes before view3d.isolate or view3d.hide are removed; goldens approved (after the goldens ticket) and VizSampleAnalysesTests passes
- [ ] viz-element-size-outliers: storeys filters s.Depth = 1 and sits beside withStorey; inst and meas share one value.path `model`; the chart draws the 28 outliers, not 216 elements; meas becomes measures; viz-window-to-wall-ratio gains the four-node 3D side its sibling has and draws WWR alone with the 0.40 limit in the title; viz-opening-schedule's openings and sizes become one query; viz-parameter-completeness' side chains sit on one side of the main row
- [ ] Any change this pass needs in README.md or VizSampleAnalysesTests.cs is stated in the commit message for the pass A builder, not made here

From the 2026-10-11 review of samples/viz-analyses. See the pass A ticket for the shared conventions. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.

Closed 2026-10-12 by the supervisor after commit 531460c9. Deviation accepted: the storeys query in viz-element-size-outliers uses the nearest storey (arg_min(StoreyName, Depth)) rather than Depth = 1, because 72 of 239 elements in duplex-base.duckdb have only a Depth 2 row; the chart draws the 22 outliers the golden already had, not the 28 the old note claimed.
