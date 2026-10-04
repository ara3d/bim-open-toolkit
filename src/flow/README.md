# src/flow

The node packs that know about buildings. The rest of BimOpenFlow (the generic packs,
`Nodes.Support`, the host, the outputs, and the MCP server) is `ara3d/bim-open-flow`,
taken from `deps/bim-open-flow` (see `deps.json`); these packs reference its
`Nodes.Support` and the BIM Open Data libraries in `deps/bim-open-data`.

| Project | Role |
|---|---|
| `BimOpenFlow.Nodes.Bos` | Loading BIM Open Schema (`.bos`) files and querying them with SQL |
| `BimOpenFlow.Nodes.BimAnalysis` | The `bim.*` pack: elements, rooms, levels, typed parameters, bounds, classification, containment, navigation |
| `BimOpenFlow.Nodes.Geometry` | The `view3d.*` pack: the tables the 3D pane consumes, from native tessellation (`Ara3D.Ifc.Mesher`) |

`src/studio/BimOpenFlow.Studio` composes them with the generic packs into the `bim`
profile. Tests are under `tests/flow`.
