# Data model IO

Platform-neutral adapters for ZIP/Parquet BOS, snapshot JSON, DuckDB, and portable SQL. This project
uses the new model and Parquet/DuckDB packages directly; it does not modify or depend on the older
Windows IO project.

```csharp
using Ara3D.BimOpenSchema.DataModel.IO;
using DuckDB.NET.Data;

var result = BimModelIO.LoadBos("building.bos");
result.Match(model =>
{
    using var connection = new DuckDBConnection("DataSource=building.duckdb");
    connection.Open();
    ModelSql.WriteDuckDb(model, connection);
    using var json = File.Create("building.query-model.json");
    BimModelIO.WriteJson(model, json);
    using var sql = File.CreateText("building.sql");
    ModelSql.WriteSql(model, sql);
    return true;
}, issues => false);
```

`ReadJson(Stream)` returns a result, validates snapshot identities/references and typed values, and
rebuilds indexes. Stream ownership remains with the caller. DuckDB export requires an open
connection without an active transaction and creates tables atomically. Existing tables are never
replaced. SQL scripts use the same table definitions; the caller must handle rollback after a script
execution error. SQL values use invariant formatting and escaped literals; DuckDB uses typed bulk
appenders. BOS reads all row groups and retains source row order within each table.

Example SQL (table and field names are also discoverable with `ToRelationalTables()`):

```sql
SELECT DocumentTitle, Category, COUNT(*) AS ElementCount
FROM Entities WHERE NOT IsType AND NOT IsCategory
GROUP BY DocumentTitle, Category;

SELECT e.Id, e.Name, p.NumberValue, p.Units
FROM Entities e JOIN Properties p ON p.EntityId = e.Id
WHERE p.NormalizedName = 'HEIGHT' AND p.NormalizedGroup = 'DIMENSIONS'
  AND p.NormalizedUnits = 'mm' AND p.Kind = 'Number'
  AND p.IsValid AND NOT p.IsMissing AND p.NumberValue > 3000;

-- Cycle-safe ancestor reachability. Replace 42 with a bound query parameter in applications.
WITH RECURSIVE reachable(id) AS (
  SELECT 42
  UNION
  SELECT e.TargetId FROM Edges e JOIN reachable r ON e.SourceId = r.id
  WHERE e.Kind = 'PartOf'
)
SELECT Entities.* FROM Entities JOIN reachable ON Entities.Id = reachable.id;

-- Broad-phase overlap candidates; this does not establish an exact clash.
SELECT e.Id, e.Name FROM Geometry g JOIN Entities e ON e.Id = g.EntityId
WHERE g.MaxX >= 0 AND g.MinX <= 10 AND g.MaxY >= 0 AND g.MinY <= 10
  AND g.MaxZ >= 0 AND g.MinZ <= 3;
```

SQL properties are explicit assignments. SQL consumers must implement their desired type-inheritance
projection; the C# `PropertiesOf`/`Schedule` APIs already provide one. The edge table stores the source
direction for `ConnectsTo`; SQL must include its reverse direction when treating it as connectivity.
No graph extension is installed automatically. See the core [design](../Ara3D.BimOpenSchema.DataModel/DESIGN.md).
