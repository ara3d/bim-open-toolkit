# Snowdon 3D toolkit graph

`snowdon-toolkit.json` is the graph the Snowdon graph demo at `/3d.html` opens
(see [docs/bim-flow-3d.md](../../docs/bim-flow-3d.md)). It shows every `view3d.*`
recipe kind composed on one model: a `view3d.scene` root feeding
`view3d.categoryStyle`, `view3d.section`, `view3d.sectionBox`, `view3d.explode`,
two `view3d.projection` nodes (plan and orthographic), a ghosted
`view3d.categoryStyle`, `view3d.environment`, `view3d.tint`, and
`view3d.sectionRange`: eleven nodes in all. Each node's output is a recipe
table (`operation` and JSON `input` columns) that the browser validates and
renders; no mesh bytes pass through the graph.

## Input

The scene node's `path` is the placeholder `{SNOWDON}`. The bim-profile host
seeds this graph on an empty store when `BIMOPENFLOW_SNOWDON` points to a BOS
file, or `Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`
exists, and replaces the placeholder with that path. The model itself is
private and never committed; the Geometry pack's recipe nodes only record the
path, so the graph evaluates without reading it.

## Tests

- `tests/flow/BimOpenFlow.View3dWorkflows.Tests/View3dSampleTests.cs`,
  `SnowdonToolkitGraph_ComposesEveryRecipeWithoutReadingPrivateModelBytes`:
  the graph validates against the Bos and Geometry packs and every node
  evaluates Ok with the placeholder left in place.
- `scripts/check-bim-flow-3d.mjs` and `scripts/check-bim-flow-graph.mjs` drive
  the running demo against the real model.
