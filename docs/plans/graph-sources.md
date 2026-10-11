# Graph sources wave: TKT-137, TKT-202 to TKT-205, TKT-138

Started 2026-10-11 from the owner's design discussion on the Schependomlaan storeys graph, whose two `duck.table` nodes repeat one path. Workflows served: 1 (point the toolkit at your own model) and 2 (Claude builds and re-runs graphs).

Paths are relative to this repository. `deps/bim-open-flow` and `deps/ara3d-dataflow` are separate repositories; a builder commits and pushes inside them and reports the hash. The supervisor moves the pins in every `deps.json`.

## Order

| Wave | Ticket | Why it waits |
|---|---|---|
| A | TKT-205 column picker shows every column | - |
| A | TKT-137 FilePath control | - |
| A | TKT-202 Database value and `source` input on the duck readers | - |
| B | TKT-203 bindable parameters and the socket control | engine spec after TKT-202's value kind; editor after TKT-137's control registration |
| C | TKT-138 sources rail and chips | the socket control from TKT-203 |
| D | TKT-204 graph inputs and model swap | the rail from TKT-138 |

## Chunk table (wave A)

Shared file: `deps/bim-open-flow/contracts/contracts.json` and its generated outputs. TKT-137 adds a suggestion kind, TKT-202 a port type. Each commits that addition, by path, as its first commit, before any other edit.

| Id | One-sentence commit | Fence (writes only) | Test command |
|---|---|---|---|
| T205 | The column picker opens with every upstream column, whatever the field holds | `deps/bim-open-flow/bimopenflow/web/packages/graph/src/{suggestInput,suggestText,columnSelect}.ts`, `deps/bim-open-flow/bimopenflow/web/packages/graph/test/**`, one new control file under `graph/src/` if needed | the graph package tests |
| T137 | FilePath parameters offer the files under the model roots, with a browse button and a missing-file warning | `deps/bim-open-flow/src/flow/BimOpenFlow.Host.Api/SuggestEndpoints.cs`, `deps/bim-open-flow/src/flow/BimOpenFlow.Host.Catalog/**`, `deps/ara3d-dataflow/src/Ara3D.DataFlowEngine.Abstractions/Params.cs` (the suggestion kind), `deps/bim-open-flow/contracts/**`, new web control files, `slotRegistry.ts`, `canvasSlots.ts`, their tests, the FilePath declarations in the packs, `docs/nodes*.` regeneration | host api tests, graph package tests |
| T202 | A Database value flows from duck.source into duck.query, duck.table and duck.tables | `deps/ara3d-dataflow/src/Ara3D.DataFlowEngine.Abstractions/{FlowValue,Ports}.cs`, the engine's hashing and run-record code for the new kind, its spec and README, `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.DuckDb/**`, `RunInputs.cs`, the pane that shows a value, `deps/bim-open-flow/contracts/**` (port type only), their tests, one sample graph, `docs/nodes*.` regeneration | engine tests, DuckDb node tests, host api tests |

Supervisor-owned: every `deps.json`, `PROJECT.md`, this file, the tickets.

## Build log
