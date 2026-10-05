# DuckDB workflow catalog

`workflows.json` holds the nine sample graphs of the DuckDB workflow studio
(`/duckdb.html`, described in [docs/bim-flow-duckdb.md](../../docs/bim-flow-duckdb.md)).
Unlike the other sample folders, which keep one graph document per file, this is
one JSON array: each entry carries `id`, `title`, `tag`, `description`, the name of
its `result` node (always `answer`), and the graph document under `graph`. The
web page imports the file directly for its flow picker and descriptions;
`scripts/prepare-bim-flow-duckdb.mjs` writes each `graph` into a demo store.

## Input

Every graph starts from one `duck.source` whose `path` is a placeholder, and
each entry's `database` field says which one it reads:

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
| `public-door-schedule` | two queries, left join, project, sort | 205 doors on four storeys; 101 without an OverallWidth |
| `public-door-types` | query, aggregate, sort, limit | `32_KD_berkvens_BA` first with 73 doors |
| `public-rooms-per-storey` | query, aggregate, sort, `chart.bar` | 32, 29, 20, 19 spaces on the four storeys with rooms |
| `public-missing-widths` | query, filter, project | the 101 doors with no width, left NULL |
| `public-floor-area-by-use` | two queries, left join, aggregate, `sql.query`, `chart.bar` | Verblijfsruimte 705.8 m2 of 965.8 m2 across six uses |

| Id | Shape |
|---|---|
| `duckdb-door-schedule` | two queries, left join, project, sort |
| `duckdb-door-types` | query, aggregate, sort, limit |
| `duckdb-room-schedule` | two queries, left join, project, sort |
| `duckdb-room-distribution` | two queries, aggregate, join, `sql.query`; a `sql.query` and `chart.bar` branch plot rooms per storey |
| `duckdb-missing-widths` | query, filter, project |
| `duckdb-roof-coverage` | query, aggregate, sort |
| `duckdb-evidence-trace` | UNNEST query and evidence query, join, project, sort |
| `duckdb-source-lineage` | two queries, join, aggregate, sort |
| `duckdb-typed-schema` | schema query, filter, aggregate, sort |

All node kinds come from the tables profile (`HostComposition.TablePacks()` in `deps/bim-open-flow/src/flow/BimOpenFlow.Host`).

## Tests

- `tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/DuckDbWorkflowCatalogTests.cs`
  enumerates the entries: each parses, validates against the tables registry,
  and keeps `{DUCKDB}` as its only database path. `duckdb-typed-schema`
  evaluates every node Ok over a generated `samples/tables/sample.duckdb`; the
  other eight are evaluated over the same file to confirm that only their
  `duck.query` nodes fail (missing Snowdon tables).
- `scripts/check-bim-flow-duckdb.mjs` drives the running page over the Snowdon
  export and checks the row counts listed in docs/bim-flow-duckdb.md.
