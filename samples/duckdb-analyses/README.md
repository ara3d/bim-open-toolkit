# DuckDB workflow catalog

`workflows.json` holds the nine sample graphs of the DuckDB workflow studio
(`/duckdb.html`, described in [docs/bim-flow-duckdb.md](../../docs/bim-flow-duckdb.md)).
Unlike the other sample folders, which keep one graph document per file, this is
one JSON array: each entry carries `id`, `title`, `tag`, `description`, the name of
its `result` node (always `answer`), and the graph document under `graph`. The
web page imports the file directly for its flow picker and descriptions;
`scripts/prepare-bim-flow-duckdb.mjs` writes each `graph` into a demo store.

## Input

Every graph starts from one `duck.source` whose `path` is the placeholder
`{DUCKDB}`. Preparation replaces it with a typed BIM export, by default
`artifacts/building-model-workflows/snowdon-cli.duckdb` (the wave R5 Snowdon
export, private, never committed). Eight graphs SELECT from its `door`,
`storey`, `space`, `roof`, `evidence`, `source_object`, `source_revision`, and
`source_document` tables; `duckdb-typed-schema` reads only
`information_schema.columns`, so it runs over any DuckDB file.

| Id | Shape |
|---|---|
| `duckdb-door-schedule` | two queries, left join, project, sort |
| `duckdb-door-types` | query, aggregate, sort, limit |
| `duckdb-room-schedule` | two queries, left join, project, sort |
| `duckdb-room-distribution` | two queries, aggregate, join, `sql.query` |
| `duckdb-missing-widths` | query, filter, project |
| `duckdb-roof-coverage` | query, aggregate, sort |
| `duckdb-evidence-trace` | UNNEST query and evidence query, join, project, sort |
| `duckdb-source-lineage` | two queries, join, aggregate, sort |
| `duckdb-typed-schema` | schema query, filter, aggregate, sort |

All node kinds come from the tables profile (`HostComposition.TablePacks()`).

## Tests

- `tests/flow/BimOpenFlow.TableWorkflows.Tests/DuckDbWorkflowCatalogTests.cs`
  enumerates the entries: each parses, validates against the tables registry,
  and keeps `{DUCKDB}` as its only database path. `duckdb-typed-schema`
  evaluates every node Ok over a generated `samples/tables/sample.duckdb`; the
  other eight are evaluated over the same file to confirm that only their
  `duck.query` nodes fail (missing Snowdon tables).
- `scripts/check-bim-flow-duckdb.mjs` drives the running page over the Snowdon
  export and checks the row counts listed in docs/bim-flow-duckdb.md.
