# DuckDB workflow catalog

`workflows.json` holds the 14 sample graphs of the DuckDB workflow studio
(`/duckdb.html`, described in [docs/bim-flow-duckdb.md](../../docs/bim-flow-duckdb.md)).
Unlike the other sample folders, which keep one graph document per file, this is
one JSON array: each entry carries `id`, `title`, `tag`, `description`, the name of
its `result` node (always `answer`), and the graph document under `graph`. The
web page imports the file directly for its flow picker and descriptions;
`scripts/prepare-bim-flow-duckdb.mjs` writes each `graph` into a demo store.

## Input

The default export is Autodesk's Snowdon Towers Sample Project (CC BY-NC-SA 3.0, never committed; attribution in `samples/snowdon-analyses/NOTICE.md`). The graphs carry no model data.

Every graph declares a graph input `model`, the database file, and starts from
one `duck.source` whose `path` is `$model`, so setting `model` runs the graph on
another building. The input's default is a placeholder, and each entry's
`database` field says which one:

- `public`: `{PUBLIC_DUCKDB}`, replaced by bim-open-data's
  `samples/public/schependomlaan.duckdb` (`deps/bim-open-data`, fetched by
  `node deps.mjs`; CC BY 4.0, attribution in that folder's NOTICE.md). These five
  graphs come first, run from a clean clone, and are the analysis context of
  `docs/proposals/demo-contexts.md` (TKT-165). They query the BOS text views
  `EntityText`, `ParameterText`, and `StoreyOfElement`.
- `snowdon`: `{DUCKDB}`, replaced by a typed BIM export, by default
  `artifacts/building-model-workflows/snowdon-cli.duckdb` (the wave R5 Snowdon
  export, private, never committed). Eight graphs SELECT from its `door`,
  `storey`, `space`, `roof`, `evidence`, `source_object`, `source_revision`, and
  `source_document` tables; `duckdb-typed-schema` reads only
  `information_schema.columns`, so it runs over any DuckDB file. Preparation
  skips these when the export is absent, and the page's picker then omits them.

| Id | Shape | Schependomlaan result |
|---|---|---|
| `public-door-schedule` | two queries, left join, derive WidthStatus, project, sort | 205 doors on four storeys; 101 without an OverallWidth, WidthStatus says so |
| `public-door-types` | query, aggregate, sort, limit | `32_KD_berkvens_BA` first with 73 doors |
| `public-rooms-per-storey` | query, aggregate, sort, `chart.bar` | 32, 29, 20, 19 spaces on the four storeys with rooms |
| `public-missing-widths` | query, filter `isnull(Width_mm)`, project | the 101 doors with no width, left NULL |
| `public-floor-area-by-use` | two queries, left join, aggregate, derive (round), project, sort, `chart.bar`; a note translates the Dutch use names | Verblijfsruimte (habitable rooms) 705.8 m2 of 965.8 m2 across six uses |

| Id | Shape |
|---|---|
| `duckdb-door-schedule` | two queries, left join, project, sort |
| `duckdb-door-types` | query, aggregate, sort, limit |
| `duckdb-room-schedule` | two queries, left join, project, sort |
| `duckdb-room-distribution` | two queries, aggregate, join, `sql.query` that numbers storeys sharing a name, `chart.bar` of the answer; a note explains the numbering |
| `duckdb-missing-widths` | query, filter `isnull(Width_m)`, project |
| `duckdb-roof-coverage` | query, aggregate, sort |
| `duckdb-evidence-trace` | UNNEST query and evidence query, join, project, sort |
| `duckdb-source-lineage` | two queries, join, aggregate, sort |
| `duckdb-typed-schema` | schema query, filter on SqlType, aggregate, sort |

All node kinds come from the tables profile (`HostComposition.TablePacks()` in `deps/bim-open-flow/src/flow/BimOpenFlow.Host`).

## Tests

- `tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/DuckDbWorkflowCatalogTests.cs`
  enumerates the entries: each parses, validates against the tables registry,
  declares the `model` input with its placeholder as default, and lays its
  wires out left to right from the database at (20, 30). The public five
  evaluate over Schependomlaan with the numbers above, and `public-door-types`
  also over the duplex through the `model` input. The Snowdon nine evaluate
  every node Ok over a small database the test writes with the Snowdon tables
  and columns; `duckdb-typed-schema` also over a generated
  `samples/tables/sample.duckdb`.
- `scripts/check-bim-flow-duckdb.mjs` drives the running page over the Snowdon
  export and checks the row counts listed in docs/bim-flow-duckdb.md.
