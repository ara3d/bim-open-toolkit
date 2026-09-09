# Building a DuckDB BIM Flow graph from natural language

An agent connected to the `bimopenflow` MCP server can build a working graph from a plain-language request: read the database schema, add nodes, set their SQL and parameters, wire the ports, evaluate, and read the result. The graph lands in the same store the [DuckDB workflow studio](bim-flow-duckdb.md) reads, so it appears in the studio's flow picker as soon as the page reloads.

The server holds no logic of its own. Each tool is one of the operations behind the HTTP API and the editor (`addNode`, `connect`, `setParam`, `evaluate`, ...), so a graph an agent builds is exactly the kind a person builds by hand.

## Setup

From the repository root, with .NET 8 installed and the DuckDB demo prepared (`duckdb:prepare`, see the studio doc). Build the server into its own output directory:

```powershell
npm run duckdb:mcp-build --prefix bimopenflow/web
```

The repository's `.mcp.json` registers the server as `bimopenflow-duckdb`. It launches the built `bimopenflow-mcp.dll` over stdio with the tables profile, the demo store under `artifacts/bim-flow-duckdb/store`, and `artifacts/building-model-workflows` as the model root where `listDatabases` looks for `.duckdb` files. Open Claude Code in the repository root and approve the project server when asked. Any MCP client can use the same entry; the arguments are those of `bimopenflow-host`, except that `--port` does nothing under stdio (pass `--http [port]` to listen on HTTP instead).

The server can run while the studio's host is running. Both read and write the same store directory, and both open the database read-only. Rebuild with `duckdb:mcp-build` after changing C# nodes or tools.

## Tools

| Tool | What it does |
|---|---|
| `listDatabases` | The `.duckdb` files under the model roots, with paths ready for a `duck.source` node. |
| `describeDatabase` | Every table in one file: columns with DuckDB types, and row counts. |
| `getNodeCatalog` | Every node kind with its ports, parameters, enum values, and capability. |
| `listAnalyses`, `getAnalysis`, `saveAnalysis` | The graph library: list, read as canonical JSON, or replace a whole document. |
| `addNode`, `setParam`, `connect`, `removeNode` | Incremental edits. Each validates the graph against the catalog before saving. |
| `evaluate` | Per-node status: `Ok`, `Unready`, `EffectPending`, `Unavailable`, or `Error`. |
| `getResult` | One node output as a paged table slice. |
| `createRun`, `listRuns` | Freeze the current evaluation as an immutable run record; list the archive. |

`listDatabases` and `describeDatabase` exist for this demo. Without them an agent has no way to learn column names before writing SQL.

## The demo

Ask Claude Code, with the server connected:

> Using the Snowdon database, build me a door schedule: every door with its mark, type and storey name, plus the width in metres and why it is missing when it is. Sort by storey, then mark.

The agent's tool sequence, in the order the scripted replay makes it:

1. `listDatabases`, then `describeDatabase` on `snowdon-cli.duckdb`. The `door` table has 142 rows and 120 columns; the ones that matter are `element_mark`, `element_name`, `element_location_primary_storey`, `nominal_width`, and `nominal_width_reason`. `storey` has `id` and `element_name`.
2. `addNode` a `duck.source` named `database`; `setParam` its `path`.
3. `addNode` two `duck.query` nodes, `doors` and `levels`; `setParam` their `sql`.
4. `addNode` a `table.join` (`aKey`, `bKey`, `mode` = `left`), a `table.project` (`columns`), and a `table.sort` named `answer` (`A` = `Storey`, `B` = `Mark`).
5. Six `connect` calls: the source into both queries, the queries into the join, the join through the projection into the sort.
6. `evaluate`: six nodes `Ok`. `getResult` on `answer.table`: 142 rows with columns `Mark, DoorType, Storey, Width_m, WidthStatus`. Every width is `NULL` with status `NotObserved`, because the supplied export never established door widths.

Reload the studio and pick `agent-door-schedule` from the flow list. The graph is arranged automatically and the result pane shows the same 142 rows. Every node is editable there; edits save back to the same store the agent wrote.

Other requests that work with the same vocabulary: rooms per storey sorted by count (two queries, `table.aggregate`, `table.join`, `table.sort`), the ten most common door types (`table.aggregate`, `table.sort`, `table.limit`), or doors whose width is missing, with the reason (`table.filter`, `table.project`). The nine sample graphs in `samples/duckdb-analyses/workflows.json` show what each looks like once built.

## Replay without a language model

The scripted replay drives the built server over stdio with the JSON-RPC messages an MCP client sends, makes the door-schedule tool calls above, and checks the result:

```powershell
npm run duckdb:mcp-demo --prefix bimopenflow/web
```

It prints the request, each tool call, the first five rows, and `OK` when the graph is in the store. It removes any earlier `agent-door-schedule` from the demo store first, so every run builds from scratch. It fails if a tool is missing, a node is not `Ok`, the columns differ, or (against the supplied Snowdon export) the row count is not 142. Override `BOF_MCP_DLL`, `BOF_DUCKDB_STORE`, `BOF_DUCKDB_MODELS`, `BOF_DUCKDB` (the database file name to pick), or `BOF_MCP_ANALYSIS` (the graph id) for another setup.

The tool tests live in `tests/BimOpenFlow.Mcp.Tests`; `DatabaseToolTests` covers the two discovery tools against a database written for the test.

## Limits

The server has no tool for naming a graph, so the picker shows the id the agent chose. `duck.query` accepts one read-only `SELECT` or `WITH` statement; anything else is rejected at evaluation, not at `setParam`. The agent sees column names and types but not the values, so questions that depend on the vocabulary of a column (which reason codes exist, which storeys are referenced) take an extra query node and a `getResult` before the final graph is right.
