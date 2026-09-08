# Core BIM DuckDB export

This package exports a `BuildingProjection` to DuckDB. `CoreSchema` discovers the stable relational contract from public core records: each record with a self-typed `Id` becomes a snake_case table, and its properties become snake_case columns. The present core contract has 83 tables and 862 columns.

`IBuildingProjectionWriter` separates the projection from its storage implementation. `DuckDbProjectionWriter` creates all tables, writes the projection collections that are presently mapped from BOS, and serializes relationships, facts, and value objects as JSON. A different storage target can implement the same interface without coupling the mapper to DuckDB.

The integration test `DuckDbProjectionWriterTests.SnowdonBosExportsItsMappedArchitecturalRowsToDuckDb` prepares the Snowdon `.bos` fixture, maps it, exports it, and queries its expected architectural row counts.
