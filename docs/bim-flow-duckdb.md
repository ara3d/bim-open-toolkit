# BIM Flow DuckDB workflow studio

The local demo at `/duckdb.html` is the same graph-demo shell as the 3D demo: the BIM Flow graph editor on the left, its result-table pane on the right. The flow picker in the top bar switches between the sample graphs, and the **Ask** box next to it has an agent build a new graph from a plain-language request (see below). It is the analysis context of [docs/proposals/demo-contexts.md](proposals/demo-contexts.md): a strap above the editor says who it is for (an analyst with a question) and which model is open. It holds 14 sample graphs. Five run over the public Schependomlaan export (`deps/bim-open-data/samples/public/schependomlaan.duckdb`, CC BY 4.0, present after `node deps.mjs`), so the page opens from a clean clone; nine run against the private typed Snowdon database and are listed only when that file was present at preparation (`samples/duckdb-analyses/README.md` gives both sets and their numbers). Every graph runs through the C# dataflow engine. Clicking a node or choosing it in **Preview** inspects that stage. Parameter edits save to a separate demo store and recompute results. **Download** in the top bar exports the current edited graph.

The Ask box and the MCP server behind it are described in [Building a DuckDB BIM Flow graph from natural language](bim-flow-mcp-demo.md), including the model key the Ask box needs.

## Start

From the repository root, with .NET 8 and the existing `bimopenflow/web` and `viewer` npm dependencies installed. Once, to prepare the graphs and build the studio host (`bimopenflow-studio`: the host API plus the Ask endpoint) under `artifacts/bim-flow-duckdb/studio`:

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

Open [the workflow studio](http://127.0.0.1:5308/duckdb.html). Host port 5218, web port 5308; each service logs to its own terminal and stops with Ctrl+C. Preparing again refreshes each graph you have not edited to the current sample, archiving the old copy under the graph's `versions/`, and keeps each graph you edited, naming it in the output (`.samples.json` in the store records what each graph was seeded from). Rerun `duckdb:build` after changing C# nodes. Because that build has its own output directory, this host does not collide with the 3D demo's and the two can run at the same time. Set `ANTHROPIC_API_KEY_FILE` or `OPENAI_API_KEY_FILE` (or the plain `_API_KEY` variable) before `duckdb:host` for the Ask box to work; everything else runs without it.

Every graph declares a graph input `model`, the database file, and its single `duck.source` reads it as `$model` and opens the database read-only. To run a graph on another building, set `model` to another file in the editor (or pass `graphInputs` to evaluate over MCP); the graph itself does not change. Preparation sets each input's default: the public Schependomlaan file for the public five, and for the Snowdon nine `artifacts/building-model-workflows/snowdon-cli.duckdb` or the export you name with `node scripts/prepare-bim-flow-duckdb.mjs <database> <store>`. Graphs you have not edited follow a new default; edited graphs keep theirs, so change `model` in the editor or delete the graph and prepare again. Its output branches into `duck.query` nodes containing SQL. Queries share a bounded connection cache (up to eight databases), including when SQL changes; eviction or a changed file stamp reopens the connection. Changing a graph never modifies the database. The private database and query results are not bundled with the page or committed.

Sort nodes expose **A**, **B**, and **C** column dropdowns, applied in that order, with an ascending/descending arrow for each. Their choices follow the upstream table schema. A removed column stays visibly marked unavailable until another column is selected; choosing None skips that key. Graphs automatically arrange and fit on opening; the stored layout, which **Download** keeps, runs left to right from the database. The right panel displays the selected node's table, with Chart and Table tabs when the graph ends in a chart.

To upgrade an existing demo store after rebuilding and restarting the host, run `node scripts/migrate-bim-flow-duckdb.mjs`. It adds shared sources and converts legacy sort keys while preserving SQL and other edits. Original graphs are backed up under `artifacts/bim-flow-duckdb/migrations`. Older path-based `duck.query` and `by` sort graphs still evaluate.

## Workflows

| Sample | Composition | Result |
|---|---|---|
| Door schedule (Schependomlaan) | Two queries → left join → derived WidthStatus → projection → sort | 205 doors on four storeys; 101 without an OverallWidth, left NULL |
| Most-used door types (Schependomlaan) | Query → aggregate → sort → limit | `32_KD_berkvens_BA` first with 73 doors |
| Rooms per storey (Schependomlaan) | Query → aggregate → sort → bar chart | 32, 29, 20, 19 spaces on the four storeys with rooms |
| Doors without a width (Schependomlaan) | Query → filter `isnull(Width_mm)` → projection | The 101 doors with no width |
| Floor area by room use (Schependomlaan) | Two queries → left join → aggregate → rounded area → projection → sort → bar chart | Verblijfsruimte (habitable rooms) 705.8 m2 of 965.8 m2 across six uses; a note translates the Dutch names |
| Door schedule | Two queries → left join → projection → sort | Snowdon: 142 doors with source marks, types, storeys and width availability |
| Most-used door types | Query → aggregate → sort → limit | Snowdon: top ten source door types; edit the limit inline |
| Room schedule | Two queries → left join → projection → sort | Snowdon: 290 spaces with room numbers, storeys and area availability |
| Rooms by storey | Two queries → aggregate → join → SQL → bar chart | Snowdon: 34 rows, one per storey with rooms (shared names numbered) and one for the 4 rooms with no storey; counts sum to 290 |
| Missing door widths | Query → filter `isnull(Width_m)` → projection | Snowdon: 142 unavailable widths with reasons and explanations |
| Roof quantity coverage | Query → aggregate → sort | Snowdon: 26 roofs; missing area totals remain NULL |
| Trace a width to evidence | UNNEST query + evidence query → join → projection → sort | Snowdon: 156 evidence references supporting door-width facts |
| Source provenance | Two queries → join → aggregate → sort | Snowdon: 14 document/exporter/source-role groups, an occurrence row and a type row for each of the seven Snowdon documents |
| Explore typed columns | Schema query → filter on SqlType → aggregate → sort | Snowdon: 84 table/type groups, including empty core tables |

The graphs and their descriptions live in `samples/duckdb-analyses/workflows.json`. Preparation replaces the `model` input's default, `{PUBLIC_DUCKDB}` or `{DUCKDB}`, with the local path. Each graph's final node is named `answer`, so it is the initial preview under the editor's canonical node ordering. All intermediate nodes remain selectable and editable.

The supplied database is the wave R5 export of the core building model (`export-duckdb` from the Snowdon cache; see [the CLI README](https://github.com/ara3d/bim-open-data/blob/main/tools/building-model-workflows/README.md), in a checkout `deps/bim-open-data/tools/building-model-workflows`). It populates 48 of the 83 core tables: besides the storeys, spaces, doors and roofs the sample graphs use, it holds walls, windows, floors, ceilings, stairs, structural members, pipes, ducts, lighting fixtures, electrical circuits, materials and the other mapped kinds, with about 147,000 evidence rows. The sample graphs only query the four original kinds, so their counts did not change with the swap; the Ask box and your own `duck.query` SQL can reach every populated table. The supplied database retains its original **Unknown** numeric storage policy. Its missing dimensions are not inferred from names, converted to zero, or treated as compliance failures. Evidence and availability remain visible. Count summaries are usable even when source measurements are unavailable. This is a source-backed dataflow demo, not a geometry viewer or a compliance assessment.

## Verify

With the demo running:

```powershell
node scripts/check-bim-flow-duckdb.mjs
```

The check needs the Snowdon export, so it runs only where that file is present. It evaluates all 81 nodes of the 14 graphs, checks shared-source wiring, schedule counts and grouped totals, opens every graph from the flow picker, edits the top-N limit and verifies recomputation, changes an upstream schema and checks live sort choices, previews an upstream node, downloads a graph, checks visible startup errors, and verifies the database SHA-256 is unchanged. It restores the edited graph in `finally`. Headless Edge screenshots and evidence are written to `artifacts/bim-flow-duckdb/browser`. Override `BOF_DUCKDB_URL` for another web port; `BOF_DUCKDB` identifies the database to hash. The fixed row-count assertions target the supplied Snowdon export. Without it, `tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/DuckDbWorkflowCatalogTests.cs` covers the catalog: it evaluates the public five over Schependomlaan and checks the numbers above, and evaluates the Snowdon nine over a small database with the Snowdon tables and columns.

Typecheck and build the page from `bimopenflow/web/packages/app`:

```powershell
node ../../node_modules/typescript/bin/tsc --noEmit
node ../../node_modules/vite/bin/vite.js build --config vite.duckdb.config.ts
```

The built page still requires the local host API. Its Vite configuration and entry point are separate from the ongoing 3D graph-demo work; it reuses the existing `createApp({ graphDemo: true })`, shared canvas editor, table pane, API client and engine.
