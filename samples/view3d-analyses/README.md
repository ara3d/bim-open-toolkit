# view3d sample analyses

Ready-made graphs for the 3D visualization nodes (`view3d.*`, see
`src/BimOpenFlow.Nodes.Geometry/README.md`). Each file is a canonical graph
document whose file name is the analysis id. The literal placeholder `{DATA}`
stands for the repo's `data/` directory (they all load `duplex.ifc`).

| Id | Shows |
|---|---|
| `color-by-category` | instances colored categorically by IFC category |
| `ghost-context` | walls opaque, everything else faded to alpha 0.15 |
| `explode-categories` | categories spread apart along X (`view3d.spacing`) |
| `massing-boxes` | one union bounding box per category (`view3d.boundingBoxes`) |
| `voxel-density` | 0.5 m voxelization colored by per-voxel instance count |
| `decimate-overview` | only the largest quarter of instances, small parts dropped |

Every sample validates against the Bos + Geometry packs and evaluates green
over `data/duplex.ifc`; `tests/BimOpenFlow.View3dWorkflows.Tests` enforces both.

These are not yet seeded into the host's analysis store at startup (the tables
profile seeds `samples/analyses`); seeding for the bim profile is tracked as a
follow-up alongside `samples/bim-analyses`.
