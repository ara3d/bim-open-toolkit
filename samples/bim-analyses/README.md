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
| `bim-level-summary` | per-level element counts next to the `bim.levels` table |
| `bim-room-classes` | rooms classified by name, counted with total volume per class |
| `bim-dimensions` | bounding boxes with a derived aspect ratio, filtered tall, ranked by volume |
| `bim-nav-hops` | door navigation graph, hop distances from Corridor 102 |
| `bim-room-containment` | door centers spatially joined into room boxes, counted per room |
| `bim-param-quality` | `bos.load` parameter table profiled by `bim.paramCoverage` |
| `bim-nearest-door` | each room's nearest door with its distance, ranked |

Every sample validates against `HostComposition.AllPacks()` and evaluates green
over a generated `sample.bos`; `tests/BimOpenFlow.BimWorkflows.Tests` enforces
both.
