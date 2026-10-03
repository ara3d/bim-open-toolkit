# src/mcp

Model Context Protocol servers. Each one is an adapter over a layer below it,
and nothing below references this folder.

| Project | Exposes | Sits on |
|---|---|---|
| `BimOpenMcp.Flow` | The graph operations, evaluation, and runs of a BimOpenFlow host | `src/flow` |

The second server, `BimOpenMcp.Ifc` (direct IFC and BOS queries), lives in
bim-open-data with the libraries it sits on: `deps/bim-open-data/src/mcp/BimOpenMcp.Ifc`.
`node scripts/build-mcp.mjs` builds both into the folders `.mcp.json` names.

Both run over stdio by default, or HTTP with `--http <port>`. The protocol
helpers (`Ara3D.MCP`) come from `deps/ara3d-sdk`. Tests are under `tests/mcp`.
