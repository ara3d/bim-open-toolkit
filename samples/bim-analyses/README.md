# BIM sample analyses

Ready-made BIM-profile graphs over the `bim.*` analysis pack. Each file is a
canonical graph document (`.dfg.json` shape) whose file name is the analysis id.
Paths use the literal placeholder `{SAMPLES}` for the directory holding
`sample.bos` — the deterministic two-storey building generated from
`BimSampleModel` (in `BimOpenFlow.Nodes.BimAnalysis`); no model binary is
committed.

Every graph declares a graph input `model` (kind FilePath, default `{SAMPLES}/sample.bos`). One `value.path` node
`model` holds `$model` and feeds the `path` socket of every reader (`bim.elements`, `bim.rooms`, `bim.bounds`,
`bim.levels`, `bim.navGraph`, `bos.load`), so the readers store no path of their own (TKT-204, TKT-259). To run a
graph on another building, set the input to that building's `.bos` file: one `setParam` with no `nodeId` and the
name `$model` over MCP, or the `graphInputs` argument of `evaluate`. On the generated sample `bim-discipline-mix`
counts 20 elements; on `deps/bim-open-data/samples/public/duplex.bos` it counts 4607. `BimGraphInputTests` checks
both.

Each graph opens with an `about` note and ends in a titled `view.table` named `answer` that keeps only the
readable columns; `bim-discipline-mix`, `bim-level-summary`, and `bim-room-classes` also draw a bar chart.
`bim-door-rooms` and `bim-duct-rooms` stay as the short versions of `bim-room-containment`, which counts the
door-room pairs per room and names each room; their notes say so.

| Id | Shows |
|---|---|
| `bim-discipline-mix` | elements classified into disciplines, counted, ranked, as a bar chart |
| `bim-level-summary` | elements and rooms per level from `bim.levels`, as a table and a bar chart |
| `bim-room-classes` | rooms classified by name, counted with total volume per class, volume as a bar chart |
| `bim-dimensions` | bounding boxes with a derived aspect ratio (blank when SizeY is 0), filtered tall, ranked by volume |
| `bim-nav-hops` | door navigation graph, hop distances from Corridor 102 |
| `bim-room-containment` | doors touching each room, by `spatial.intersects` overlap, keyed and grouped by room entity id, most doors first |
| `bim-param-quality` | `bos.load` parameter table profiled by `bim.paramCoverage`, FillRate measured within each parameter's category; the category entities' own rows dropped |
| `bim-nearest-door` | each room's nearest door with its distance, ranked |
| `bim-duct-rooms` | the rooms each duct passes through, by `spatial.intersects` overlap volume, as Duct and Room |
| `bim-door-rooms` | the room(s) each door's box overlaps, by `spatial.intersects` filtered to a real overlap, as DoorName and Room |
| `bim-room-footprints` | room boxes as WKT footprints with polygon area and perimeter, ranked by perimeter |

Every sample validates against `StudioComposition.BimPacks()` (in `src/studio/BimOpenFlow.Studio`) and evaluates green
over a generated `sample.bos`; `tests/studio/BimOpenFlow.BimWorkflows.Tests` enforces
both.
