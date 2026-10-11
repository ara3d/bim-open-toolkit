# Visualization demo graphs

Graphs that turn a question about the Duplex into a figure: a chart, a coloured 3D view, or both from one
table. Each file is a canonical graph document whose file name is the analysis id. Paths use the placeholder
`{SAMPLES}` for `samples/nrc`, which holds the committed Duplex as IFC (`duplex-base.ifc`,
`duplex-enriched.ifc`), BOS (`duplex-enriched.bos`), DuckDB, and the NRC carbon CSVs. The studio seeds these
graphs with `{SAMPLES}` rewritten (`BimSampleSeeding`).

Each graph ends today in `chart.bar`, `chart.line`, `view.table`, or `view3d.*`. Each also has the Vega-Lite
spec for its figure at `specs/<id>.vl.json`, written for the draft `plot.vegaLite` node of bim-open-plot
(input `table`, param `spec` with `data` omitted; the node binds the input rows as `data.values`). When that
node lands, the spec moves into the graph. Tables keep an element key column, a storey column, and one value
column per figure, so the drawing, scene3d, and map kinds planned in bim-open-plot fit them too.

A demo whose numbers are synthetic (a schedule, unit rates) says so in its note and in a `Synthetic` column.

| Id | Question | Figure |
|---|---|---|

`tests/studio/BimOpenFlow.BimWorkflows.Tests/VizSampleAnalysesTests.cs` checks that every graph validates
against the bim profile, evaluates all-green, carries a `view.note`, and has its spec.
