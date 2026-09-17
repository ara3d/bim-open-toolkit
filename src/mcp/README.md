# src/mcp

Model Context Protocol servers. Each one is an adapter over a layer below it,
and nothing below references this folder.

| Project | Exposes | Sits on |
|---|---|---|
| `Ara3D.Ifc.Mcp` | Direct IFC and BOS queries: entities, properties, SQL over DuckDB, geometry, conversion | `src/data` only |
| `BimOpenFlow.Mcp` | The graph operations, evaluation, and runs of a BimOpenFlow host | `src/flow` |

Both run over stdio by default, or HTTP with `--http <port>`. The protocol
helpers (`Ara3D.MCP`) come from the SDK submodule. Tests are under `tests/mcp`.
