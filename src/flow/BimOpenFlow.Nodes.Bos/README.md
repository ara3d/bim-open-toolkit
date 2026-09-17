# BimOpenFlow.Nodes.Bos

Dataflow nodes over BIM Open Schema: the workhorse vocabulary for takeoffs,
audits, and analytics. Exposes `BosNodes.All` for registry composition
(`NodeRegistry.Combine(BosNodes.All, ...)`). All nodes are version 1 and Pure.

## Nodes

| Kind | Inputs | Outputs | Params |
|---|---|---|---|
| `bos.load` | — | entities, parameters, relations (Table) | path (FilePath), harmonize (Boolean, default false) |
| `bos.query` | table | table | sql (Text, one read-only SELECT/WITH; input available as `t`) |
| `table.filter` | table | table | expr (Expression, Boolean over the table's columns) |
| `table.derive` | table | table | name (Text), expr (Expression) |
| `table.aggregate` | table | table | groupBy (Text, comma-separated, may be empty), aggregates (Text, `func(column) as name`, funcs count/sum/min/max/avg) |
| `table.sort` | table | table | by (Text, comma-separated names, optional ` desc` suffix) |

## Semantics

- `bos.load` reads a `.bos` file (parquet zip), optionally harmonizes it
  (canonical `Bos:` categories/parameters, SI units), loads it into an
  in-memory DuckDB, and materializes the EntityText/ParameterText/RelationText
  views as tables. Results are cached by file content hash, so repeated
  evaluations of unchanged files are free.
- Expressions (`table.filter`, `table.derive`) see the table's scalar columns
  by name; columns with non-scalar .NET types are unavailable. Null cells
  propagate: a null filter result excludes the row, a null derive result
  yields a null cell.
- `bos.query`, `table.aggregate`, and `table.sort` run through DuckDB: the
  input table is written to an in-memory database as `t`.

## Errors

Invalid parameters, expressions (parse or type errors, with character
offsets), unknown columns, and malformed aggregate/sort specs all throw
`ArgumentException` with the node kind prefixed to the message. Deterministic
runtime expression errors (e.g. integer overflow) propagate as
`EvaluationException`.
