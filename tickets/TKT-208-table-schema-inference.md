---
id: TKT-208
title: Schema inference for every table.*, sql, reader and bim node, sharing the relation layer's rules
status: done
depends_on: [TKT-207]
owner:
fence: []
workflow: [W2]
related: [TKT-134, TKT-202]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [x] Every `table.*` node declares a schema: `Inferred` for join (left columns, then right columns with the `_right` suffix the relation layer uses), aggregate (group columns, then one column per `func(column) as name` with the function's result type), project, rename, drop, derive (the expression typer gives the type), filter, sort, limit, distinct, dedupe, cast, concat, setOp, fillNulls, dropNulls, replace, sample, window, splitColumn, unpivot; `Dynamic` for pivot and transpose; `Static` for range, calendar, profile and schema
- [x] `sql.query` and `duck.query` infer through DuckDB `DESCRIBE` over empty typed views of their inputs, as `DuckDbCatalog.QuerySchema` already does for `rel.sql`
- [x] Readers infer from their source: `duck.table` from the database (TKT-202's Database value, or the path), `csv.read`, `parquet.read` and `xlsx.read` from the file's header, `bos.load` and every `bim.*` node statically, from the registry (TKT-206), `check.*` statically from the verdict columns
- [x] One inference rule set serves both layers: the relation layer's `SchemaInference` rules for select, rename, derive, filter, join, union and aggregate are shared with the table nodes, not copied
- [x] A golden test per node: the inferred schema of each sample graph's nodes equals the recorded columns of its results

Source: `docs/plans/declared-schemas.md`. This is where the owner's "joined tables are new classes, and the static structure is known without evaluating" becomes code. TKT-134 (project aliases) changes `table.project`'s rule and should land before or with it.
