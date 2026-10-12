---
id: TKT-262
title: nrc-analyses questions pass: notes, unit aliases, readable columns, the storey pick, smaller SQL, one grid
status: done
depends_on: []
owner: builder-TKT-262
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/nrc-analyses/nrc-q*.json, samples/nrc-analyses/nrc-storey-of-element.json, samples/nrc-analyses/nrc-property-values.json, samples/nrc-analyses/nrc-element-psets.json, samples/nrc-analyses/nrc-rollup.json, samples/nrc-analyses/nrc-enrich-run.json, samples/nrc-analyses/README.md, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/nrc-*.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/nrc-*.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/NrcAnswerTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/RollupGraphTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/ModelGraphTests.cs]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] Each of the 13 graphs has an `about` view.note stating the paper question or the README rule it answers (q4 and q8 are the model)
- [ ] Aggregates keep their unit in the alias (q1, q2, q5, q8, storey-of-element: OperationalCarbon_kgCO2e_per_year, MeanEui_kWh_per_m2_year, EmbodiedCarbon_A1A3_kgCO2e); q3's answer leads with Name and Category; q7's answer keeps OtherMetrics
- [ ] nrc-storey-of-element reads StoreyOfElement with the smallest-Depth pick nrc-rollup applies, so no element can count twice; q5 ends in a chart.bar of the nine category totals through rel.materialize
- [ ] nrc-property-values uses rel.filter, rel.join, rel.select and rel.sort instead of one SQL; nrc-element-psets' three-branch UNION is three small rel.sql nodes plus a union answer; nrc-enrich-run's rollupRows and rows become one rel.sql
- [ ] q2 filters the two storeys before aggregating; q6's `when` becomes runFacts; q7 starts at x 40 (not -290) with 330 px columns; rollup and element-psets rows are even; every graph on the 330 x 240 grid
- [ ] q7's two rel.csv readers of one file are either merged into one or the about note says they demonstrate the shared value.path (TKT-138)
- [ ] README rows corrected: nrc-join-analytics, nrc-dc-w1-verdicts, nrc-enrich-run and nrc-color-operational-carbon run in the bim profile only; goldens re-approved in both profiles; NrcAnswerTests still pass

From the 2026-10-11 review of samples/nrc-analyses (17 graphs, all green). The figure graphs (join-analytics, dc-w1-verdicts, color-operational-carbon, storey-carbon-chart) are a separate ticket with a disjoint fence; this ticket owns the README. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
