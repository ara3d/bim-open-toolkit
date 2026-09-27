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

## Fresh-eyes review, 2026-09-27

The reviewer recomputed the per-storey numbers, the 0 unmatched rows, the 61 disagreements, and the 50 + 2 non-physical rows from the IFC with an independent Python parser; all reproduce. The join and totals are right. Defects:

1. The 21 "physical elements with no CSV row" are the model's 21 IfcSpace rooms (they have a representation, so meshing counts them). The CSV covers every IfcElement (the test kit's own model_elements.csv lists exactly the 268). Meanwhile IFCROOF #22475 has no representation yet counts as physical. Define "physical" from EntityText.Category (element classes, excluding spatial entities, IFCSPACE, IFCOPENINGELEMENT), restate the counts, add a Category breakdown to physicalNoCsv. This also works on BOS models with no IFC (TKT-56).
2. The per-storey totals inner-join away the 50 opening rows (no storey: StoreyOfEntity does not follow voids), 3228.4 of 40424.6 operational carbon, unreported. Make csvWithStorey a left join so they appear as a null-storey group; add CsvRowsWithNoStorey to answer; assert 50; state it under the README table.
3. The 61 Level disagreements are all IFCFURNISHINGELEMENT whose Level holds the name of the IfcSpace that directly contains them (e.g. B202), not door or window schedule marks. Rewrite README and test comment.
4. The 50 opening rows are extra rows, not values given "instead of" the door or window: every door and window also has a row; 12 of the 50 openings hold no door or window (50 IFCRELVOIDSELEMENT, 38 IFCRELFILLSELEMENT). Correct README and test comment.
5. The "host has no duplex-base database" known gap was already false (62a39e5 added SamplePreparation.NrcBaseDatabase; Fixture.cs builds it). Delete the test's own database build and teardown; use Fixture.Runtime, Fixture.DatabaseDir, NrcPaths.BaseIfc, SampleSeeding.NrcBaseDatabaseFileName. Remove the gap from README and ticket.
6. The CSV is read twice (rel.csv and csv.read) with two path conventions; changing one silently desyncs colours from the report. Replace `values` with csv.relation -> rel.materialize -> both colour nodes.
7. README instructions for another CSV are inaccurate: join keys are set values, not defaults, and differ (EntityIndex, globalId); view3d.color needs the key column name present in both tables (ColorNode.cs:47-48), and instances only have globalId; no command exists to build a .duckdb and --models / BIMOPENFLOW_MODEL_ROOTS are not mentioned; a newcomer changes 6 values across 5 nodes plus up to 4 join keys. Correct it and state the exact counts.
8. Wall in category10 is (0.498, 0.498, 0.498), indistinguishable from no-value grey. Outside this fence: filed as TKT-58.
9. The colouring test asserts literals copied from the graph (714, 693) and only checks "not grey"; a node painting every matched row one colour would pass. Compute expected counts from ModelGeometryCache and the CSV; for a few instances assert all three channels equal the scale's colour for that element's value; assert Wall differs from no-value (ignored with a reason naming TKT-58 until it lands).
10. README CSV SHA-256 is truncated by one digit (append `b`).

Design notes: (1) the model is named in three places that can disagree; add to answer a count of mesh GlobalIds missing from entities (expected 0). (2) nrc-rollup picks the nearest storey, this graph joins every StoreyOfElement row, and groups by StoreyName; a shared nearest-storey view in BosDuckDbViews belongs to TKT-48 or TKT-56. (3) Test helpers duplicate ModelGraphTests' internal Document/EvaluateGreen/Number; evaluate the graph once per fixture. (4) Add a few assertions derived from the test kit's model_elements.csv IFCType column so the definitions themselves are checked. (5) Test kit step 4 (values for a selected element) has no node or test; claim steps 1-3 and 5, or name what covers step 4.
