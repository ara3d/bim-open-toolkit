---
id: TKT-263
title: nrc-analyses figure graphs pass: inputs for the two templates, one CSV read, titles, layout, a chart title that is computed
status: done
depends_on: []
owner: builder-TKT-263
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/nrc-analyses/nrc-join-analytics.json, samples/nrc-analyses/nrc-dc-w1-verdicts.json, samples/nrc-analyses/nrc-color-operational-carbon.json, samples/nrc-analyses/nrc-storey-carbon-chart.json, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/nrc-join-analytics.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/nrc-dc-w1-verdicts.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/nrc-color-operational-carbon.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/nrc-storey-carbon-chart.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/nrc-storey-carbon-chart.txt, tests/studio/BimOpenFlow.NrcWorkflows.Tests/JoinAnalyticsTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/FigureGraphTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs]
workflow: [W2, W3]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] nrc-join-analytics declares `csv` and `model` FilePath inputs through value.path nodes, reads the test-kit CSV once (rel.materialize of `csv` replaces the csv.read twin), titles its five terminal tables, counts the Level-versus-storey disagreements (Agrees column and aggregate), and its about note moves to the top with answer beside its inputs
- [x] nrc-color-operational-carbon declares a `model` input on view3d.instances.path through a value.path and gains an about note naming Figure 5, the viridis scale and the 21 grey instances
- [x] nrc-storey-carbon-chart's title no longer hardcodes 115,730.3 and 37,196.2: a buildingOnly filter feeds a view.table titled Building total, and a table.rename gives the legend readable series names
- [x] nrc-dc-w1-verdicts: model and report cards sit in the rows under answer and coloured; metres and millimetres merge into one derive; joinColumn is GlobalId; an about note says it is the check.rule twin of check-ids-door-width and that report writes on Run
- [x] Goldens re-approved; JoinAnalyticsTests and FigureGraphTests still pass; README rows for these four are updated by the questions-pass ticket, not here

From the 2026-10-11 review. The README and the about note call nrc-join-analytics a template ('point the CSV and the model at your own files') but it declares no input; its CSV is read twice from two spellings; 21 nodes span 2110 x 1750 px with the note at the bottom. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.

2026-10-11, f806f728: four terminal tables are titled (answer, perStorey, storeyComparison, levelAgreement); the two view3d.color terminals have no title parameter. The model input reaches only the meshes: EntityText and StoreyOfElement come from rel.table source duplex-base, whose source is not a socket. README rows for the four graphs are left to TKT-262.
