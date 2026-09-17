# Ara3D.BimOpenSchema.IO

Reads and writes `.bos` archives: one Parquet table per record type in the
schema, zipped. `ParquetUtils` holds the entry points (`ReadParquetFromZip`,
`ReadBimGeometryFromParquetZipAsync`, `WriteParquetToZip`); the `Parquet*`
types adapt data tables to Parquet columns.

Parquet.Net is the only external dependency, and the project targets `net8.0`,
so a reader can take this package without Excel, DuckDB, or native libraries.
Those live beside it:

- [Ara3D.BimOpenSchema.IO.Export](../Ara3D.BimOpenSchema.IO.Export): Excel, CSV, Markdown, HTML, and SQLite exports of a table.
- [Ara3D.BimOpenSchema.IO.Bfast](../Ara3D.BimOpenSchema.IO.Bfast): BFAST serialization.
- [Ara3D.BimOpenSchema.DuckDb](../Ara3D.BimOpenSchema.DuckDb): loading into DuckDB and querying.

The types this project reads and writes come from the spec package
`Ara3D.BimOpenSchema` (the `bim-open-schema` submodule) and the builders in
[Ara3D.BimOpenSchema.ObjectModel](../Ara3D.BimOpenSchema.ObjectModel).
