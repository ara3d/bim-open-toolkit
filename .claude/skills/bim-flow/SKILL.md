---
name: bim-flow
description: Build, edit, evaluate and read BimOpenFlow dataflow graphs over a BIM Open Schema DuckDB export through the bimopenflow-duckdb MCP server. Use when the user asks a question about a building model in the DuckDB workflow studio ("how many rooms per storey", "a door schedule"), asks to build or change a graph, or names a node kind such as duck.query, table.join or sql.query. Read BEFORE the first bimopenflow-duckdb tool call.
---

# BimOpenFlow graphs through MCP

The `bimopenflow-duckdb` server (registered in `.mcp.json`; build it with `node scripts/build-mcp.mjs`) exposes the same operations the studio's editor and HTTP API use, so a graph you build is one a person could have built by hand, and every node stays editable in the studio afterwards. A graph is a set of nodes joined by edges from an output port (`nodeId.port`) to an input port. Every graph tool takes an analysis `id`; pass it on every call.

Read, in this folder, before the first tool call:

- [schema-guide.md](schema-guide.md): what the element tables share, how storeys link, why measures are NULL, how lineage chains, how list columns behave.
- [node-guide.md](node-guide.md): the expression language of `table.derive` and `table.filter` (no null test), aggregate syntax, join modes, when to reach for `sql.query`.
- [working-rules.md](working-rules.md): the order of calls that builds a correct graph in one `editGraph` plus a fix-up, and when to answer instead of build.

The same three files are embedded in the studio's Ask endpoint as its system prompt, so an edit here changes both.

## Tools

| Tool | Use it for |
|---|---|
| `listDatabases` | The `.duckdb` files under the model roots, with paths for a `duck.source` node. Prefer the file the existing graphs use (`listAnalyses` then `getAnalysis` shows their `duck.source` path). |
| `describeDatabase` | Without `table`: every table with row count and base column names, companion columns folded. With `table`: types, NULL and distinct counts, sample values, numeric range. |
| `getNodeCatalog` | Every node kind with ports, parameters and enum values. Read it once per session. |
| `listAnalyses`, `getAnalysis`, `saveAnalysis` | The graph library: list, read as JSON, replace a whole document. |
| `editGraph` | A list of addNode / setParam / connect / removeNode edits, validated together and saved once. A failed batch saves nothing. |
| `addNode`, `setParam`, `connect`, `removeNode` | Single edits for small fixes. |
| `evaluate` | Per-node status: `Ok`, `Unready`, `EffectPending`, `Unavailable`, or `Error` with the message. |
| `getResult` | One node output as a paged table slice (`skip`, `take`). |
| `createRun`, `listRuns` | Freeze the current evaluation as an immutable run; list the archive. |

## Conventions in this repository

- New graphs get an id of the form `ask-` plus the main words of the request (`ask-rooms-per-storey`), so they sit beside the sample graphs in the studio's picker. Check `listAnalyses` first so you extend rather than shadow an existing graph when the user is refining one.
- After you save, tell the user the analysis id and that the studio needs a reload to show it.
- The supplied Snowdon export has no walls or windows. An empty category table is an answer, not a failure: say what is missing and offer what is there.
- Do not call the same tool with the same arguments twice in a row expecting a different result; change something first.
