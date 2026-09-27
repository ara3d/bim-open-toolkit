---
id: TKT-52
title: NRC test kit as a graph: bring any IFC and CSV, get a match report, colours, and storey totals
status: claimed
depends_on: []
owner: parallel-wave-builder-p5
fence: [samples/nrc-analyses/nrc-join-analytics.json, samples/nrc/test-kit/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/JoinAnalyticsTests.cs]
---

## Acceptance criteria

- [x] Graph nrc-join-analytics joins a CSV to a model on a key column (default GlobalId), reports CSV rows with no element and physical elements with no row, colours by a numeric and a text column, and gives per-storey totals and means
- [x] Run on IFC-Test-Kit/analytics_dataset_with_levels.csv (268 rows) against duplex-base.ifc; the match report's counts are asserted in a test and explained in samples/nrc/test-kit/README.md

P5 of Proposal: docs/proposals/nrc-deliverables.md, test kit steps 1 to 5. Step 6 (large_test_model.ifc) moved to the performance ticket.

## Result

Commits: graph + test-kit CSV/README, and the test file (see builder report for
this ticket). `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests` — 72
passed, 0 failed, including the four new `JoinAnalyticsTests` and the
`SampleEnumerationTests` coverage check for `nrc-join-analytics`.

Numbers from the test kit's `analytics_dataset_with_levels.csv` (268 rows)
against `duplex-base.ifc` (346 entities, 237 with a mesh, 714 mesh
instances): 0 CSV rows unmatched to any entity; 21 of 237 physical elements
(entities with a mesh) have no CSV row; 52 CSV rows match a non-physical
entity (50 `IFCOPENINGELEMENT`, 2 `IFCSTAIR`); 693 of 714 mesh instances take
a real colour for both the carbon gradient and the category palette; four
storeys' totals and means computed via `StoreyOfElement`; 61 of 218
storey-matched rows disagree between the CSV's own `Level` column and the
model-derived storey (door/window schedule marks, not storey names). Full
explanation in `samples/nrc/test-kit/README.md`.

Known gap, not fixed here (belongs to TKT-48, and is called out in the
README): the host has no background job building a `duplex-base.duckdb`, so
`rel.table` sources named `duplex-base` resolve in `JoinAnalyticsTests`
(which builds its own) but not yet in the running studio. Also noted for
TKT-56: the graph needs three separate parameter changes (CSV path x2, model
path, two `rel.table` sources) to point at a different model, not one each,
and the "physical element" definition (has a rendered mesh) is IFC-specific
and would need a BOS-native replacement for a model with no accompanying
IFC file.
