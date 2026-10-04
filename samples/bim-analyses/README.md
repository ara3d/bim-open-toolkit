# BIM sample analyses

Ready-made BIM-profile graphs over the `bim.*` analysis pack. Each file is a
canonical graph document (`.dfg.json` shape) whose file name is the analysis id.
Paths use the literal placeholder `{SAMPLES}` for the directory holding
`sample.bos` — the deterministic two-storey building generated from
`BimSampleModel` (in `BimOpenFlow.Nodes.BimAnalysis`); no model binary is
committed.

| Id | Shows |
|---|---|
| `bim-discipline-mix` | elements classified into disciplines, counted, ranked |
| `bim-level-summary` | elements and rooms per level from `bim.levels`, as a bar chart |
| `bim-room-classes` | rooms classified by name, counted with total volume per class |
| `bim-dimensions` | bounding boxes with a derived aspect ratio, filtered tall, ranked by volume |
| `bim-nav-hops` | door navigation graph, hop distances from Corridor 102 |
| `bim-room-containment` | doors touching each room, by `spatial.intersects` overlap, keyed and grouped by room entity id |
| `bim-param-quality` | `bos.load` parameter table profiled by `bim.paramCoverage`, FillRate measured within each parameter's category |
| `bim-nearest-door` | each room's nearest door with its distance, ranked |
| `bim-duct-rooms` | the rooms each duct passes through, by `spatial.intersects` overlap volume |
| `bim-door-rooms` | the room(s) each door's box overlaps, by `spatial.intersects` filtered to a real overlap |
| `bim-room-footprints` | room boxes as WKT footprints with polygon area and perimeter, ranked by perimeter |

Every sample validates against `StudioComposition.BimPacks()` (in `src/studio/BimOpenFlow.Studio`) and evaluates green
over a generated `sample.bos`; `tests/studio/BimOpenFlow.BimWorkflows.Tests` enforces
both.
