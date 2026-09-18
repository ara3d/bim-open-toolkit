# BimOpenFlow.Nodes.Bos

Dataflow nodes over BIM Open Schema: loading a `.bos` file and querying it with
SQL. The general table vocabulary (`table.filter`, `table.derive`,
`table.aggregate`, `table.sort`, and the rest) lives in
`BimOpenFlow.Nodes.TableOps`, so this pack is the only one that knows BOS.
Exposes `BosNodes.All` for registry composition
(`NodeRegistry.Combine(BosNodes.All, ...)`). All nodes are version 1 and Pure.

## Nodes

| Kind | Inputs | Outputs | Params |
|---|---|---|---|
| `bos.load` | — | entities, parameters, relations (Table) | path (FilePath), harmonize (Boolean, default false) |
| `bos.query` | table | table | sql (Text, one read-only SELECT/WITH; input available as `t`) |

## Semantics

- `bos.load` reads a `.bos` file (parquet zip), optionally harmonizes it
  (canonical `Bos:` categories/parameters, SI units), loads it into an
  in-memory DuckDB, and materializes the EntityText/ParameterText/RelationText
  views as tables. Results are cached by file content hash, so repeated
  evaluations of unchanged files are free.
- `bos.query` runs through DuckDB: the input table is written to an in-memory
  database as `t` (`BosDuckDbQueries.QueryOver` in the data layer).

## Errors

Invalid parameters, a missing file, and SQL that is not one read-only
SELECT/WITH throw `ArgumentException` with the node kind prefixed to the message.
