# Visualization demo graphs (wave, 2026-10-11)

Serves workflow 3 of `PROJECT.md` (get the answer in every form and hand it to someone) and bim-open-plot's
workflow 3 (browse twenty demos). Done for this wave: at least ten non-trivial graphs in `samples/viz-analyses/`
that evaluate green in `VizSampleAnalysesTests`, each answering a question a named role asks of the Duplex,
each with a Vega-Lite spec for its figure, plus the two new nodes they need. Supervisor: session "BIM Open Flow
demo graphs". The plot session ("BIM Open Plot project brief") owns `deps/bim-open-plot`.

## Contract (commit e9d322e)

- Graphs: `samples/viz-analyses/<id>.json`, canonical graph documents like `samples/view3d-analyses/*.json`.
  `{SAMPLES}` stands for `samples/nrc`: `duplex-base.ifc` and `duplex-enriched.ifc` (for `view3d.instances`),
  `duplex-enriched.bos` (for `bim.*` and `bos.*`), `duplex-enriched.duckdb` and `duplex-base.duckdb` (for
  `duck.*`), and the NRC carbon CSVs `nrc_analytics_*.csv`.
- Every graph has a `view.note` (id `about`) that names the role, the question, and how to read the figure, and
  ends in `chart.bar`, `chart.line`, `view.table`, `view.colormap`, or `view3d.*`. A figure that has a 3D side and
  a chart side shares one `view.colormap` scale (see `samples/view3d-analyses/shared-color-legend.json`).
- Every graph has `samples/viz-analyses/specs/<id>.vl.json`: a Vega-Lite v5 spec with `$schema`, no `data`, whose
  field names are the columns of the table that feeds the graph's chart node. This is the `spec` param of
  bim-open-plot's draft `plot.vegaLite` node (input `table`; params `spec`, `title`; outputs `table`, `figure`).
- Tables keep an element key column (StepId or GlobalId when the source has one), a storey column, and one
  numeric value column per figure, so bim-open-plot's planned `plot.drawing`, `plot.scene3d`, and `plot.map`
  kinds fit them.
- Synthetic numbers (a schedule, unit rates) carry a `Synthetic` column set true and say so in the note.
- New nodes: `bim.orientation` (`BimOrientationNode.cs`) and `bim.schedule` (`BimScheduleNode.cs`) are registered
  stubs; their tracks replace the files and add tests in `tests/flow/BimOpenFlow.Nodes.BimAnalysis.Tests/`.

## Building while deps/ is mid-change

The declared-schemas wave (TKT-207) has uncommitted edits in `deps/bim-open-flow`, so a plain build fails.
Build and test against the pinned snapshot in `artifacts/wave-viz/deps-pinned/`, with your own artifacts path:

    dotnet test tests/studio/BimOpenFlow.BimWorkflows.Tests -p:DepsRoot=C:/Users/cdigg/git/bim-open-toolkit/artifacts/wave-viz/deps-pinned/ --artifacts-path artifacts/wave-viz/<track> --filter "FullyQualifiedName~VizSampleAnalyses"

Never edit anything under `deps/` or `artifacts/wave-viz/deps-pinned/`.

## Tracks and fences

Each track owns its graph files, their specs, and the files named. `samples/viz-analyses/README.md` and
`docs/nodes.*` belong to the supervisor: return your README rows instead.

| Track | Graphs | Extra files |
|---|---|---|
| A | `viz-storey-stacking`, `viz-model-composition` | |
| B | `viz-carbon-by-material`, `viz-carbon-intensity-by-storey` | |
| C | `viz-door-accessibility`, `viz-opening-schedule` | |
| D | `viz-facade-orientation`, `viz-window-to-wall-ratio` | `BimOrientationNode.cs`, `BimOrientationNodeTests.cs` |
| E | `viz-construction-sequence`, `viz-progress-s-curve` | `BimScheduleNode.cs`, `BimScheduleNodeTests.cs` |
| F | `viz-element-size-outliers`, `viz-clash-matrix` | |
| G | `viz-parameter-completeness`, `viz-room-areas` | |

## Log

