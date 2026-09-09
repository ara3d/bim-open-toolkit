# BIM Flow DuckDB workflow studio

The local demo at `/duckdb.html` is the same graph-demo shell as the 3D demo: the BIM Flow graph editor on the left, its result-table pane on the right. The flow picker in the top bar switches between the sample graphs. Nine editable sample graphs run through the C# dataflow engine against the typed Snowdon database. Clicking a node or choosing it in **Preview** inspects that stage. Parameter edits save to a separate demo store and recompute results. **Download** in the top bar exports the current edited graph.

An agent can build graphs into this same store through the MCP server; see [Building a DuckDB BIM Flow graph from natural language](bim-flow-mcp-demo.md).

## Start

From the repository root, with .NET 8 and the existing `bimopenflow/web` and `viewer` npm dependencies installed. Once, to prepare the graphs and build an isolated host under `artifacts/bim-flow-duckdb/host`:

```powershell
npm run duckdb:prepare --prefix bimopenflow/web
npm run duckdb:build --prefix bimopenflow/web
```

Then start the two services in two terminals:

```powershell
npm run duckdb:host --prefix bimopenflow/web
```

```powershell
npm run duckdb:web --prefix bimopenflow/web
```

Open [the workflow studio](http://127.0.0.1:5308/duckdb.html). Host port 5218, web port 5308; each service logs to its own terminal and stops with Ctrl+C. Existing graph edits are preserved when preparing again. Rerun `duckdb:build` after changing C# nodes. Because that build has its own output directory, this host does not collide with the 3D demo's and the two can run at the same time.

The default input is `artifacts/building-model-workflows/snowdon-cli.duckdb`. Prepare a store for another compatible export with `node scripts/prepare-bim-flow-duckdb.mjs <database> <store>`. Existing graph paths are preserved with their edits; change those paths in the editor or prepare a fresh store. A single `duck.source` holds the path and opens the database read-only. Its output branches into `duck.query` nodes containing SQL. Queries share a bounded connection cache (up to eight databases), including when SQL changes; eviction or a changed file stamp reopens the connection. Changing a graph never modifies the database. The private database and query results are not bundled with the page or committed.

Sort nodes expose **A**, **B**, and **C** column dropdowns, applied in that order, with an ascending/descending arrow for each. Their choices follow the upstream table schema. A removed column stays visibly marked unavailable until another column is selected; choosing None skips that key. Graphs automatically arrange and fit on opening. The right panel displays the selected node's table without Chart, Params, or Inspector tabs.

To upgrade an existing demo store after rebuilding and restarting the host, run `node scripts/migrate-bim-flow-duckdb.mjs`. It adds shared sources and converts legacy sort keys while preserving SQL and other edits. Original graphs are backed up under `artifacts/bim-flow-duckdb/migrations`. Older path-based `duck.query` and `by` sort graphs still evaluate.

## Workflows

| Sample | Composition | Snowdon result |
|---|---|---|
| Door schedule | Two queries → left join → projection → sort | 142 doors with source marks, types, storeys and width availability |
| Most-used door types | Query → aggregate → sort → limit | Top ten source door types; edit the limit inline |
| Room schedule | Two queries → left join → projection → sort | 290 spaces with room numbers, storeys and area availability |
| Rooms by storey | Shared source → two queries → aggregate → join → SQL | 34 referenced storeys; counts sum to 290 |
| Missing door widths | Query → filter → projection | 142 unavailable widths with reasons and explanations |
| Roof quantity coverage | Query → aggregate → sort | 26 roofs; missing area totals remain NULL |
| Trace a width to evidence | UNNEST query + evidence query → join → projection → sort | 156 evidence references supporting door-width facts |
| Source provenance | Two queries → join → aggregate → sort | Eight document/exporter/source-role groups |
| Explore typed columns | Schema query → numeric filter → aggregate → sort | 84 table/type groups, including empty core tables |

The graphs and their descriptions live in `samples/duckdb-analyses/workflows.json`. `{DUCKDB}` is replaced with the selected local path during preparation. Each graph's final node is named `answer`, so it is the initial preview under the editor's canonical node ordering. All intermediate nodes remain selectable and editable.

The supplied database retains its original **Unknown** numeric storage policy. Its missing dimensions are not inferred from names, converted to zero, or treated as compliance failures. Evidence and availability remain visible. Count summaries are usable even when source measurements are unavailable. This is a source-backed dataflow demo, not a geometry viewer or a compliance assessment.

## Verify

With the demo running:

```powershell
node scripts/check-bim-flow-duckdb.mjs
```

The check evaluates all 48 nodes, checks shared-source wiring, schedule counts and grouped totals, exercises all nine workflow buttons, edits the top-N limit and verifies recomputation, changes an upstream schema and checks live sort choices, previews an upstream node, downloads a graph, checks visible startup errors, and verifies the database SHA-256 is unchanged. It restores the edited graph in `finally`. Headless Edge screenshots and evidence are written to `artifacts/bim-flow-duckdb/browser`. Override `BOF_DUCKDB_URL` for another web port; `BOF_DUCKDB` identifies the database to hash. The fixed row-count assertions target the supplied Snowdon export.

Typecheck and build the page from `bimopenflow/web/packages/app`:

```powershell
node ../../node_modules/typescript/bin/tsc --noEmit
node ../../node_modules/vite/bin/vite.js build --config vite.duckdb.config.ts
```

The built page still requires the local host API. Its Vite configuration and entry point are separate from the ongoing 3D graph-demo work; it reuses the existing `createApp({ graphDemo: true })`, shared canvas editor, table pane, API client and engine.
