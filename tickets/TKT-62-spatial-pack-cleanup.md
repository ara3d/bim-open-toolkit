---
id: TKT-62
title: Clean up the spatial pack: move bim.containment and bim.nearest onto it, and remove the extra box index and column copier
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Spatial/**, src/flow/BimOpenFlow.Nodes.BimAnalysis/**, src/flow/BimOpenFlow.Nodes.Geometry/**, src/flow/BimOpenFlow.Nodes.Support/**, src/data/Ara3D.BimOpenSchema.DataModel/**, tests/flow/**]
---

## Acceptance criteria

- [ ] `bim.containment` and `bim.nearest` run on the spatial pack's `BoxIndex` (TODO at `BimContainmentNode.cs:37` gone)
- [ ] `SpatialIndex` in `Ara3D.BimOpenSchema.DataModel` is removed or delegates to `BoxIndex` (`BimModel.cs:11`)
- [ ] One column-copying helper remains: Geometry's `TableOps.AddColumns` and Support's `CopyBuilder` are merged, with one null-handling rule

Deferred from the 2026-09-18 spatial review to 'the bim.* migration' (`docs/proposals/spatial-node-set.md:192-211`); no ticket existed. OBB extents, MULTIPOLYGON, and two-table `polygonIntersects` stay in the proposal as conditional. Raised by reviews/2026-09-27-status.md
