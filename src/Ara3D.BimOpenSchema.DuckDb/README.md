# Ara3D.BimOpenSchema.DuckDb

The DuckDB view and query layer over BIM Open Schema (BOS) data.

BOS interns every string and enum, so the raw tables are almost entirely integer
indexes. This project turns a BOS dataset into a queryable DuckDB database:

- `BosDuckDb` — connection primitives: open a file or in-memory database, load an
  `IBimData` into it (`LoadBimData`), or do both plus views in one call
  (`data.ToDuckDb()`).
- `BosDuckDbViews.CreateViews` — the text views (`EntityText`, `ParameterText`,
  `RelationText`) that resolve interned indexes to names by joining on `rowid`.
- `BosDuckDbQueries` — read-only query surface returning `Ara3D.DataTable.IDataTable`:
  `Query`, paged `QueryPage` (with unpaged total), `Export` (parquet/json/csv),
  `GetTableInfo`, and the `ReadOnlyQuery` single-statement SELECT/WITH validator.

The project exists so the DuckDB native dependency is isolated here instead of
riding along into every consumer of `Ara3D.BimOpenSchema.IO`.

Provenance: extracted from `src/Ara3D.Ifc.Mcp/IfcDuck.cs` (fix-on-entry item 2).
View and query SQL is kept identical to the origin; the MCP-specific result
shaping (JSON-friendly value coercion, tool-named error messages) stayed behind
in the MCP layer.
