# view3d sample analyses

Ready-made graphs for the 3D visualization nodes (`view3d.*`, see
`src/flow/BimOpenFlow.Nodes.Geometry/README.md`). Each file is a canonical graph
document whose file name is the analysis id. Every graph declares a graph input
`model` (default `{SAMPLES}/duplex-base.ifc`) held by one `value.path` node `model`
and wired into the readers' `path`; set the input to run the same graph on another
IFC file. The literal placeholder `{SAMPLES}` stands for `samples/nrc`, whose committed
`duplex-base.ifc` is the IFC Test Kit's Duplex (see `samples/nrc/README.md`), so they
run in a fresh clone. Each graph has an `about` note with the Duplex numbers below.

| Id | Shows | On the Duplex |
|---|---|---|
| `color-by-category` | elements coloured by category group (walls, structure, slabs, roofs, doors, windows, stairs and railings, coverings, furniture, other), spaces and openings left out; `groups` lists each category's count | 13 categories in 9 groups, 693 instances |
| `ghost-context` | walls (`IFCWALL`, `IFCWALLSTANDARDCASE`) opaque, everything else faded to alpha 0.15 | 57 opaque, 657 faded |
| `explode-categories` | categories laid out side by side on a grid (`view3d.arrange`, 5 m gap) | 14 categories in about 52 m by 113 m |
| `massing-boxes` | one union bounding box per category (`view3d.boundingBoxes`), coloured by label | 14 boxes in 10 colours |
| `voxel-density` | 0.5 m voxels (`voxels`) coloured by per-voxel instance count | 14,503 voxels, counts 1 to 17 |
| `decimate-overview` | `largest`: instances with a box diagonal of at least 0.5 m, then the largest quarter by box volume | 172 of 714 instances |
| `clash-candidates` | elements coloured by how many others their box overlaps with positive volume (`spatial.intersects` self-join, spaces and openings left out); grey overlaps none | 549 of 693 elements, up to 74 overlaps |
| `shared-color-legend` | elements and a top-20 bar chart (bars labelled by category and STEP id) coloured by enclosed mesh volume (`view3d.measures`) from one automatic `view.colormap` scale; absorbed `mesh-volume`, its first half (TKT-93) | scale 0 to 60.75 m3 (the roof), nothing clamped |

Every sample validates against the Bos, TableOps, Geometry, Spatial, Viz and Value packs
and evaluates green over `samples/nrc/duplex-base.ifc`;
`tests/flow/BimOpenFlow.View3dWorkflows.Tests` enforces both, and the goldens under
`tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/` pin each node's output.

The bim-profile host seeds them into an empty analysis store at startup
(`BimSampleSeeding` in `src/studio/BimOpenFlow.Studio`, with `{SAMPLES}` rewritten to
`samples/nrc`, which it also registers as a model root). Open one in
the 3D demo shell with `3d.html?analysis=<id>`, for example
`3d.html?analysis=color-by-category`.
