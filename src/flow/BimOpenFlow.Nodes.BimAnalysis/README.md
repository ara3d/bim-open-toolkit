# BimOpenFlow.Nodes.BimAnalysis

The `bim.*` node pack: BIM Open Schema analysis workflows as dataflow nodes.
Where `bos.load` exposes the raw data as three flat text tables, this pack
answers the questions people otherwise write code for:

- **Grouping tables** — `bim.elements` (the wide per-element table: category,
  type, level, room, document, workset, group), `bim.rooms`, `bim.levels`.
- **Parameters** — `bim.paramTable` (typed columns per chosen parameter, points
  expanded to X/Y/Z), `bim.paramCoverage` (fill-rate data quality profile).
- **Geometry** — `bim.bounds` (bounding boxes with 2D/3D dimensions),
  `bim.containment` (point-in-box spatial join), `bim.nearest` (nearest-neighbour
  join with distance).
- **Classification** — `bim.discipline` (category to discipline),
  `bim.classifyRooms` (room names to room classes by regex rules).
- **Navigation** — `bim.navGraph` (door-connectivity edges between rooms),
  `bim.hops` (breadth-first reachability from a start room).

Source nodes read a `.bos` file through `BimModel`, cached per content hash.
All outputs are plain tables, so results feed directly into the generic table
nodes (`table.aggregate`, `table.filter`, ...), the visualization panes, and the
database sinks. `BimSampleModel` builds the deterministic two-storey sample
building used by the tests and sample analyses.
