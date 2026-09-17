# Building model: status and open decision

Written 2026-09-17. Covers the five `Ara3D.BimOpenSchema.BuildingModel*` projects under `src/data/`.

## Layout

The building model is already split into a specification half and an implementation half at the project level:

| Half | Project | Lines | Dependencies |
|---|---|---|---|
| Specification | `BuildingModel` (records, enums, unit structs) | 1,657 | none |
| Implementation | `BuildingModel.Workflows` (mapper, reports) | 2,281 | `DataModel` |
| Implementation | `BuildingModel.Source` (prepared BOS cache) | 405 | BFAST, Parquet.Net |
| Implementation | `BuildingModel.DuckDb` (typed export) | 331 | DuckDB.NET |
| Implementation | `BuildingModel.Workflows.IO` (projection store) | 199 | Workflows |

The specification project follows the same rule as the table schema in the `bim-open-schema` repository: no behavior, no references beyond the .NET base library. `CoreBoundaryTests` enforces it.

## Why the specification half stays in this repository for now

The mapper drives changes to the records (new fields, evidence kinds, diagnostics), and `ASSESSMENT.md` names the mapping slice as the next work. A repository boundary now would turn each such change into two commits and a package publish. The table schema earned its own repository only after it stopped moving and had consumers outside this toolkit.

## Open decision: library or second specification

Not yet decided: whether the records are an intermediate for this toolkit's schedules and takeoffs (then they stay here permanently) or a contract other tools produce and consume (then they become a second specification beside the table schema).

Promote when both hold:

1. The records have gone several mapper waves without changing.
2. Something outside this repository needs them.

The move is then the `BuildingModel` project alone into `spec/` in `bim-open-schema`; the four implementation projects stay here.
