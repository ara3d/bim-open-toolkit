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
| `viz-storey-stacking` | BIM manager: how many elements of each class sit on each storey, from the foundation to the roof? | Stacked bar of elements per storey by class; storey totals and the 3D model coloured by storey elevation on one scale |
| `viz-model-composition` | BIM manager: which element classes make up the model, and where are they? | Sorted bar of the seven largest classes plus Other, with shares; 3D model on the same category colours |
| `viz-carbon-by-material` | Sustainability lead: which few materials carry 80% of the embodied carbon (A1-A3), and where are they? | Pareto: ranked bars with a cumulative-share line and an 80% rule; 3D model coloured by each element's main material on the same scale |
| `viz-carbon-intensity-by-storey` | Sustainability lead: how much embodied carbon does each storey carry per m² of floor? | Bars of kgCO2e/m² per storey, the storey with no floor area left missing; 3D tinted by intensity on the same scale |
| `viz-door-accessibility` | Accessibility reviewer: which doors are narrower than 850 mm, and where are they? | Width histogram with an 850 mm rule, unknown widths as their own bar; failing doors red in 3D, the rest faded |
| `viz-opening-schedule` | Estimator: how many doors and windows of each type and size are on each storey? | Bars per storey, type and size, coloured by type; openings coloured the same in 3D |
| `viz-facade-orientation` | Facade engineer: how much wall and glazing sits on each side of the building? (uses `bim.orientation`) | Wall and window m² per compass sector, a polar chart in the spec; 3D coloured by sector |
| `viz-window-to-wall-ratio` | Energy modeller: what share of each facade is glazing, and does any side pass 0.40? | Window-to-wall ratio per facing with a 0.40 rule; table of areas |
| `viz-construction-sequence` | Site superintendent: in what order are floors and trades built, and what is finished by which week? Synthetic dates (uses `bim.buildSequence`) | Gantt by task and trade; 3D coloured by finish week on the same scale |
| `viz-progress-s-curve` | Project manager: how many elements should be installed by each week, and how far behind is the site? Synthetic plan and actual | S-curve of cumulative installs, planned against a synthetic actual |
| `viz-element-size-outliers` | Model auditor: which elements are ten times larger or smaller than their class median? | Log-scale scatter of volume against height by class, outliers emphasised; outliers isolated in 3D |
| `viz-clash-matrix` | Coordinator: which pairs of classes have the most overlapping bounding boxes (candidates, not clashes)? | Class-by-class heatmap and matrix table; 3D coloured by each element's candidate count |
| `viz-parameter-completeness` | BIM manager at handover: which classes miss the fields a handover needs? | Heatmap of fill rate, class by parameter, blank where a class never has the field; worst classes ranked; 3D by element completeness |
| `viz-room-areas` | Space planner: how big is each room, and how much area does each room type take per storey? | Area histogram by room type; per-room bars and 3D rooms on one area scale; totals per type per storey |

`tests/studio/BimOpenFlow.BimWorkflows.Tests/VizSampleAnalysesTests.cs` checks that every graph validates
against the bim profile, evaluates all-green, carries a `view.note`, and has its spec.
