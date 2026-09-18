# Demos

Every runnable demo of BimOpenFlow, what it needs, what you see, and the test
that guards it. Ports and commands come from `.claude/launch.json`; the host
opens its port in well under a second and prepares slow generated samples
(the Duplex DuckDB and BOS) in the background, so a graph over them says
"not ready yet" for a few seconds and then turns green on its own. Every page
shows a banner whenever the host is unreachable.

## Start a host and the editor

| Profile | Host | Editor | Packs |
|---|---|---|---|
| `bim` | `bof-host` (port 5214, models `data/`) | `bof-web` (port 5300) | Bos, TableOps, BimAnalysis, Geometry, Compliance, Effects, Viz, Relations |
| `tables` | `bof-rel-host` (port 5224, models `samples/tables`) | `bof-rel-web` (port 5310) | DuckDb, Tables, TableOps, Cleaning, Dates, Viz, table sinks, Relations |

By hand:

```bash
dotnet run --project src/flow/BimOpenFlow.Host -- --port 5214 --profile bim --models data --store %TEMP%/bof/store --cache %TEMP%/bof/cache
```

```bash
cd bimopenflow/web/packages/app && npx vite --port 5300
```

The editor proxies `/api` to the host named by `BOF_HOST` (default
`http://127.0.0.1:5214`). An empty store is seeded with every sample graph the
profile can run; graphs the profile lacks nodes for are skipped and named in the
host log. Pages: `/` (editor with table, chart, 3D, and verdict panes),
`/3d.html?analysis=<id>` (3D-first layout), `/duckdb.html` (DuckDB demo with a
flow picker and an Ask box), `/showcase.html` (button-driven 3D recipes).

## Sample graphs by input

| Folder | Input | Profile | You see | Guarded by |
|---|---|---|---|---|
| `samples/showcase-analyses` | CSV, BOS, IFC-derived DuckDB, IFC | both / bim | the whole chain: relations into verdicts, a coloured 3D view, a chart, an HTML report | `NrcWorkflows.Tests/ShowcaseGraphTests` |
| `samples/nrc-analyses` | CSV and the Duplex DuckDB | both (two graphs bim only) | the NRC paper's eight answers, DC-W1 doors coloured in 3D, property sets written back to an IFC | `NrcWorkflows.Tests` |
| `samples/analyses` | CSV, XLSX, SQLite, DuckDB | tables | table panes over `samples/tables` | `TableWorkflows.Tests/SampleAnalysesTests` |
| `samples/relations` | CSV, DuckDB | tables | the `rel.*` pack: lazy plans, one SQL statement per chain | `Nodes.Relations.Tests/SampleGraphTests` |
| `samples/duckdb-analyses` | DuckDB (Snowdon, prepared by `npm run duckdb:prepare`) | tables, `/duckdb.html` | nine query workflows over a building database | `TableWorkflows.Tests/DuckDbWorkflowCatalogTests` |
| `samples/bim-analyses` | BOS (`samples/bim/sample.bos`, generated) | bim | the `bim.*` analyses: disciplines, levels, rooms, containment, nearest door | `BimWorkflows.Tests` |
| `samples/view3d-analyses` | IFC (`data/duplex.ifc`, fetched by `data/get-test-data.ps1`) | bim, `/3d.html` | colour by category, ghost context, exploded categories, massing boxes, voxels, decimation | `View3dWorkflows.Tests` |
| `samples/snowdon-analyses` | BOS (local Snowdon model, never committed) | bim, when present | the 3D recipe nodes over a real building | `View3dWorkflows.Tests` |

Each folder's README lists its graphs and the numbers they produce.

## Where a format enters

| Format | Node | Notes |
|---|---|---|
| IFC | `view3d.instances` / `view3d.scene` (path) | the host converts IFC to BOS once and caches it by content hash; `IfcDuckDbBuild` turns an IFC into a DuckDB with text views for `rel.table` |
| BOS | `bos.load` (path), `bim.*` | `rel.fromTable` takes any table into the relation pack |
| CSV | `rel.csv` (named source), `csv.read`, `duck.read` | a model root folder is a source named after the folder |
| DuckDB | `rel.table` (named source), `duck.query`, `sql.query` | every `.duckdb` file directly inside a root is a source named after the file |
| BFAST | none as a graph input | BFAST is the transport the 3D pane receives prepared geometry in; a `bfast.*` reader is a gap |
| XLSX, SQLite, Parquet, JSON | `xlsx.read`, `sqlite.query`, `duck.read` | tables profile |

## Headless checks

```bash
node gates/host-smoke.mjs
```

```bash
node gates/web-smoke.mjs
```

`gates/all.mjs` runs the solution build, every C# test, and both smokes.
