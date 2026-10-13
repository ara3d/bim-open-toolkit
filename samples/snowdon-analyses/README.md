# Snowdon graphs

Graphs over the private Snowdon Towers sample. The model is never committed.
The model is Autodesk's Snowdon Towers Sample Project, CC BY-NC-SA 3.0; `NOTICE.md` in this folder carries the attribution and lists the committed files computed from it.

| File | What it is | Seeded by the bim profile |
|---|---|---|
| `snowdon-toolkit.json` | The 3D toolkit graph the Snowdon demo at `/3d.html` opens | Yes, when the Snowdon BOS file is present |
| `federation-match.json` | Matches the storeys of several discipline models merged into one union, and writes the correspondence table as Parquet (TKT-30) | No: test-only, on purpose |
| `federation-confirmations.csv` | The decisions `federation-match.json` reads: one row per confirmed or rejected match, header only as committed | Not a graph |

## snowdon-toolkit.json

The graph the Snowdon graph demo at `/3d.html` opens
(see [docs/bim-flow-3d.md](../../docs/bim-flow-3d.md)). It shows every `view3d.*`
recipe kind composed on one model: a `view3d.scene` root (`scene`) feeding
`view3d.categoryStyle`, `view3d.section`, `view3d.sectionBox`, `view3d.explode`,
two `view3d.projection` nodes (plan and orthographic), a ghosted
`view3d.categoryStyle`, `view3d.environment`, `view3d.tint`, and
`view3d.sectionRange`, with an `about` note and a `model` value.path: thirteen
nodes in all. Each recipe node's output is a recipe table (`operation` and JSON
`input` columns) that the browser validates and renders; no mesh bytes pass
through the graph.

The graph input `model` defaults to the placeholder `{SNOWDON}`, and the
`model` value.path holding `$model` feeds the scene's `path`. The bim-profile
host seeds this graph on an empty store when `BIMOPENFLOW_SNOWDON` points to a
BOS file, or `Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`
exists, and replaces the placeholder with that path; set `model` to another
`.bos` file to view that building instead. The Geometry pack's recipe nodes
only record the path, so the graph evaluates without reading the model.

## federation-match.json

Reads a BIM Open Schema union of several discipline models as a DuckDB file
(`union`), and finds which storeys in different models are the same storey:

1. `storeys` (duck.query) reads every `IFCBUILDINGSTOREY` with its document,
   name, and elevation converted to metres by the document's length unit.
2. `clusters` (sql.query) is the one SQL step: it groups storeys whose
   elevations lie within 0.05 ft (0.01524 m) of the next one below, and names
   each group by its median elevation (`storey/2464mm`) and its most common name.
3. Table steps join the groups back, give a storey with no known elevation its
   own key (`storey/unknown/<document>/<step id>`), and flag conflicts: a name
   that differs from the group's, an elevation 0.5 mm or more off the median, a
   name used in another group, two storeys of one document in a group, and an
   unknown length unit. A GlobalId shared across groups is a warning.
4. The latest decision per storey in `federation-confirmations.csv` sets
   `status` (Confirmed or Rejected); a decision that names no storey row is kept
   with `rule_status` NoRuleRow.
5. `answer` shows the storey correspondence before Run; `write` writes it as
   Parquet on Run.

The `about` note on the canvas says the same in short. `conflicts` and
`warnings` are comma-joined text, not lists, because the DuckDB table writer
every sink uses (`DuckDbUtils.WriteTable`) cannot write list columns.

### Why the host does not seed it

The graph has three placeholders: `{FEDERATION_UNION}` (the union DuckDB),
`{FEDERATION_CONFIRMATIONS}` (this folder's CSV), and
`{FEDERATION_CORRESPONDENCE}` (the Parquet output). The union is built from the
seven private Snowdon discipline IFC files, and no host preparation job builds
it, so the bim profile gives the placeholders no target and skips the graph.
`BimSampleSeeding.TestOnly` (`src/studio/BimOpenFlow.Studio/BimSampleSeeding.cs`)
names it, and `NrcSeedingTests.BimProfile_SeedsEveryNrcGraph` checks that this
is the only skip. The plan's pipeline script that would run it over the real
files (`federate-snowdon.mjs`, chunk C10 of
[docs/plans/snowdon-federation-build.md](../../docs/plans/snowdon-federation-build.md))
is not written.

## Tests

- `tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/SnowdonFederationGraphTests.cs`
  is the only evaluation of `federation-match.json`. It fills the placeholders
  with a temp copy of `FederationExample`'s five-document union and a test
  confirmations CSV, and checks: the graph validates; every node is Ok before
  Run and `answer` feeds `write`; the 12 storey rows match the plan's worked
  example column by column; a confirmation gives Confirmed and a decision for a
  missing storey gives NoRuleRow; Run writes the Parquet file; a second Run
  leaves the CSV byte-identical.
- `tests/flow/BimOpenFlow.View3dWorkflows.Tests/View3dSampleTests.cs`,
  `SnowdonToolkitGraph_ComposesEveryRecipeWithoutReadingPrivateModelBytes`:
  the toolkit graph validates against the Bos and Geometry packs and every node
  evaluates Ok with the placeholder left in place.
- `scripts/check-bim-flow-3d.mjs` and `scripts/check-bim-flow-graph.mjs` drive
  the running demo against the real model.

What the converter does with the seven Snowdon IFC files (time, memory, units,
storey elevations) is in
[docs/plans/snowdon-converter-facts.md](../../docs/plans/snowdon-converter-facts.md).
