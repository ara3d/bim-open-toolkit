# src/flow

BimOpenFlow, the graph product: node packs, the host, and run outputs. It
builds on `src/data` and on the engine in the `ara3d-dataflow` submodule, and
nothing in `src/data` references it.

| Group | Projects | Role |
|---|---|---|
| Contracts | `BimOpenFlow.Contracts` | Wire types shared with the web client, compiled from `contracts/generated` |
| Node packs | `BimOpenFlow.Nodes.Support`, `.Tables`, `.TableOps`, `.Cleaning`, `.Dates`, `.DuckDb`, `.Bos`, `.BimAnalysis`, `.Geometry`, `.Compliance`, `.Effects`, `.Viz` | One pack per node vocabulary; `Support` holds the helpers they share, `Effects` is the only pack that writes to disk |
| Docs | `BimOpenFlow.NodeDocs` | Node catalog to markdown (`docs/nodes.md`) |
| Host | `BimOpenFlow.Host.Catalog`, `.Host.Store`, `.Host.Api`, `BimOpenFlow.Host` | Model discovery, graphs and runs on disk, the four graph operations over HTTP, and the composition root |
| Outputs | `BimOpenFlow.Publishing`, `.Reports`, `.Dashboards`, `.Evidence` | What a run produces for people |

The web editor is `bimopenflow/web`. Tests are under `tests/flow`. The MCP
server over the host and the Studio integration live in their own groups.
