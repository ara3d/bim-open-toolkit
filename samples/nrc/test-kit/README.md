# samples/nrc/test-kit

`analytics_dataset_with_levels.csv` is a byte-for-byte copy of
`nrc-ifc-llm/IFC-Test-Kit/analytics_dataset_with_levels.csv`, taken 2026-09-27.
SHA-256 `0d2c7cf06c0e98f394a8d099f50aa53cf8cfac2fec247417b8751210df8f926`. 268
rows (plus a UTF-8-BOM header), columns `GlobalId, Name, Level,
operational_carbon, energy_intensity, category`, all synthetic. It is matched
by `GlobalId` to `duplex.ifc` from the same test kit folder, which is
byte-identical to the model already committed here as
`samples/nrc/duplex-base.ifc` (see `samples/nrc/README.md`).

The IFC viewer test kit's own steps (`nrc-ifc-llm/IFC-Test-Kit/README.md`)
are: load the model, connect the CSV on `GlobalId`, colour by a numeric and
by a category column, show values for a selection, and total or average by
level. The graph `samples/nrc-analyses/nrc-join-analytics.json` answers
steps 1 to 5 in one document; step 6 (`large_test_model.ifc`, performance
only) is out of scope for this ticket.

## Using the graph on your own IFC and CSV

The graph has three kinds of parameter to change together when pointing it
at a different model and dataset:

1. **The CSV.** Two nodes read the same file two different ways: `csv`
   (`rel.csv`, `path` relative to its `source` folder) feeds the match
   report, the storey join, and the per-storey aggregate; `values`
   (`csv.read`, `path` an absolute or `{SAMPLES}`-relative path) feeds both
   colourings. Point both at the new file.
2. **The model.** `model` (`view3d.instances`, `path`) loads the IFC
   directly for rendering and for the mesh-based physical-element test.
   `entities` and `storeyOf` (`rel.table`, `source`) read the same model's
   `EntityText` and `StoreyOfElement` views from a named database source;
   today that means a `<name>.duckdb` built from the IFC and placed in a
   folder the host scans as a model root (see "known gaps" below).
3. **The key column.** Every `rel.join` node's `leftKey`/`rightKey` default
   to `GlobalId` on both sides, since the test kit CSV and BOS both spell it
   that way. A CSV with a different key column name only needs the `csv`
   node's own column name changed on the joins that read from it
   (`csvNoEntity`, `physicalNoCsv`, `csvMatchedNonPhysical`, `csvWithStorey`);
   the model-side names (`GlobalId`, `EntityIndex`, `globalId`) do not change
   with the dataset.

Changing three separate parameter groups instead of one "model" and one
"CSV" parameter is a real gap for TKT-56 (any BOS model, one parameter
each), not fixed here; see "known gaps" below.

## What the match report found on the test kit

Every number below is asserted in
`tests/studio/BimOpenFlow.NrcWorkflows.Tests/JoinAnalyticsTests.cs`, each
against an independent computation (a raw SQL query, or the mesh instances
read straight from `ModelGeometryCache`, never through the `rel.*` engine
the graph itself uses).

- **0 of the 268 CSV rows have no matching entity** in `duplex-base.ifc`:
  every `GlobalId` in the test kit's analytics file names a real entity in
  the model.
- **21 of the model's 237 physical elements have no CSV row.** "Physical
  element" is defined here as an entity with at least one rendered mesh
  instance (the same criterion `view3d.instances` itself uses to decide
  whether a row exists at all), not a hard-coded list of IFC classes.
- **52 CSV rows match an entity that exists but is not physical** by that
  definition: 50 match an `IFCOPENINGELEMENT` (the test kit's synthetic
  dataset carries carbon and energy figures for the void behind a door or
  window rather than for the door or window itself, for 50 of them) and 2
  match an `IFCSTAIR` entity that is meshed only through its flights, never
  itself.
- **714 mesh instances render**, one row per placed mesh; **693 of them take
  a real colour** from either the `operational_carbon` gradient or the
  `category` palette (the same 693, since both colourings share one join
  column and one CSV). The rest stay grey, unmatched. This is a mesh count,
  not an element count: 216 of the 237 physical elements are the ones
  actually matched to a CSV row, each contributing one or more of the 693
  rows.
- **Per storey**, joining through the model's own `StoreyOfElement` view:

  | Storey | Elements | Total operational carbon | Mean operational carbon | Mean energy intensity |
  |---|---|---|---|---|
  | Level 1 | 103 | 17457.0 | 169.49 | 40.50 |
  | Level 2 | 93 | 13970.2 | 150.22 | 40.56 |
  | Roof | 8 | 1767.3 | 220.91 | 62.04 |
  | T/FDN | 14 | 4001.7 | 285.84 | 61.76 |

  The four element counts (103, 93, 8, 14) are the same split as
  `samples/nrc/nrc_analytics_storeys.csv`, because both datasets analyse the
  same 218 physical elements of the same Duplex model; only the carbon and
  energy values differ between the two synthetic datasets.
- **The CSV's own `Level` column disagrees with the model-derived storey for
  61 of the 218 rows that have one.** `Level` holds the storey name for most
  rows, but a door or window schedule mark (for example `A102`, `B103`)
  for others — a mark neither the IFC entity nor its storey knows about, so
  the disagreement is real, not a bug in the join.

## Known gaps

- **The host does not yet build a `duplex-base` database.** `rel.table`
  needs a `<source>.duckdb` file in a model root; the background job that
  builds one from `duplex-enriched.ifc` (`SamplePreparation.cs`) has no
  counterpart for `duplex-base.ifc` yet (tracked under TKT-48). Until it
  does, this graph seeds into the store (it validates) but its `entities`
  and `storeyOf` nodes cannot resolve outside a test that builds the
  database itself, as `JoinAnalyticsTests` does.
- **The physical-element definition is IFC-specific.** It comes from
  `view3d.instances`, which always meshes through `IfcFile`/web-ifc; a BOS
  file with no accompanying IFC (for example a Revit-exported `.bos` with
  no IFC alongside it, as TKT-56 asks this graph to eventually support)
  never produces mesh instances, so this definition would need a
  BOS-native signal instead — there is not yet a column or view that marks
  an entity as physical independent of meshing.
