using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.DuckDb.Tests;

/// <summary>Runs against a tiny BOS dataset built in code, so every test here works on a bare
/// checkout with no sample models.</summary>
[TestFixture]
public sealed class BosDuckDbTests
{
    private DuckDBConnection _conn = null!;

    /// <summary>One wall in one document: a category entity, a type entity, and the wall itself,
    /// with a string, a number, and an entity parameter, plus one relation.</summary>
    public static BimData BuildTinyData()
    {
        var bdb = new BimDataBuilder();
        var doc = bdb.AddDocument("TestDoc", "test.ifc");
        var category = bdb.AddEntity(1, "guid-cat", doc, "Walls", BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
        var type = bdb.AddEntity(2, "guid-type", doc, "BasicWall", category, BimDataBuilder.InvalidEntityIndex);
        var wall = bdb.AddEntity(3, "guid-wall", doc, "Wall-001", category, type);
        bdb.AddParameter(wall, "Concrete", "Material", "", "Construction");
        bdb.AddParameter(wall, 2.5, "Height", "m", "Dimensions");
        bdb.AddParameter(wall, type, "TypeRef", "", "Refs");
        bdb.AddRelation(wall, type, RelationType.MemberOf);
        return bdb.Build();
    }

    [OneTimeSetUp]
    public void OneTimeSetUp()
        => _conn = BuildTinyData().ToDuckDb();

    [OneTimeTearDown]
    public void OneTimeTearDown()
        => _conn.Dispose();

    [Test]
    public void ToDuckDb_CreatesTheTextViews()
        => Assert.That(_conn.GetTableNames(includeViews: true),
            Is.SupersetOf(new[] { "EntityText", "ParameterText", "RelationText" }));

    [Test]
    public void EntityText_ResolvesNamesCategoriesAndTypes()
    {
        var table = _conn.Query("SELECT StepId, Name, Category, Type FROM EntityText ORDER BY EntityIndex");
        Assert.That(table.Rows, Has.Count.EqualTo(3));

        var wall = table.Rows[2];
        Assert.That(wall[0], Is.EqualTo(3L));
        Assert.That(wall[1], Is.EqualTo("Wall-001"));
        Assert.That(wall[2], Is.EqualTo("Walls"));
        Assert.That(wall[3], Is.EqualTo("BasicWall"));

        var category = table.Rows[0];
        Assert.That(category[1], Is.EqualTo("Walls"));
        Assert.That(category[2], Is.Null);
    }

    [Test]
    public void ParameterText_ResolvesEachValueKind()
    {
        var table = _conn.Query("SELECT Name, ParameterGroup, Units, ValueType, Value FROM ParameterText ORDER BY Name");

        var height = table.Rows[0];
        Assert.That(height[0], Is.EqualTo("Height"));
        Assert.That(height[1], Is.EqualTo("Dimensions"));
        Assert.That(height[2], Is.EqualTo("m"));
        Assert.That(height[3], Is.EqualTo("Number"));
        Assert.That(height[4], Is.EqualTo("2.5"));

        var material = table.Rows[1];
        Assert.That(material[3], Is.EqualTo("String"));
        Assert.That(material[4], Is.EqualTo("Concrete"));

        var typeRef = table.Rows[2];
        Assert.That(typeRef[3], Is.EqualTo("Entity"));
        Assert.That(typeRef[4], Is.EqualTo("BasicWall"));
    }

    [Test]
    public void RelationText_ResolvesBothNamesAndTheRelationKind()
    {
        var table = _conn.Query("SELECT NameA, NameB, RelationType FROM RelationText");
        Assert.That(table.Rows, Has.Count.EqualTo(1));
        Assert.That(table.Rows[0][0], Is.EqualTo("Wall-001"));
        Assert.That(table.Rows[0][1], Is.EqualTo("BasicWall"));
        Assert.That(table.Rows[0][2], Is.EqualTo("MemberOf"));
    }

    [Test]
    public void QueryPage_ReportsTheUnpagedTotal()
    {
        var page = _conn.QueryPage("SELECT Name FROM EntityText ORDER BY EntityIndex", skip: 1, take: 1);
        Assert.That(page.Total, Is.EqualTo(3));
        Assert.That(page.Skip, Is.EqualTo(1));
        Assert.That(page.Table.Rows, Has.Count.EqualTo(1));
        Assert.That(page.Table.Rows[0][0], Is.EqualTo("BasicWall"));
    }

    [Test]
    public void QueryPage_RejectsInvalidPaging()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => _conn.QueryPage("SELECT 1", skip: -1, take: 1));
        Assert.Throws<ArgumentOutOfRangeException>(() => _conn.QueryPage("SELECT 1", skip: 0, take: 0));
    }

    [Test]
    public void ReadOnlyQuery_AllowsOnlyOneSelectOrWithStatement()
    {
        Assert.That(BosDuckDbQueries.ReadOnlyQuery("SELECT 1;"), Is.EqualTo("SELECT 1"));
        Assert.That(BosDuckDbQueries.ReadOnlyQuery("WITH q AS (SELECT 1) SELECT * FROM q"), Does.StartWith("WITH"));
        Assert.Throws<ArgumentException>(() => BosDuckDbQueries.ReadOnlyQuery("DELETE FROM Entities"));
        Assert.Throws<ArgumentException>(() => BosDuckDbQueries.ReadOnlyQuery("SELECT 1; SELECT 2"));
        Assert.Throws<ArgumentException>(() => BosDuckDbQueries.ReadOnlyQuery("  "));
    }

    [Test]
    public void GetTableInfo_ReportsRowCountsAndColumns()
    {
        var info = _conn.GetTableInfo("Entities").Single();
        Assert.That(info.RowCount, Is.EqualTo(3));
        Assert.That(info.Columns.Select(c => c.Name), Does.Contain("LocalId"));
        Assert.Throws<ArgumentException>(() => _conn.GetTableInfo("NoSuchTable"));
    }

    [Test]
    public void Export_WritesCsvAndReturnsTheTotal()
    {
        var output = new FilePath(Path.Combine(Path.GetTempPath(), "ara3d-duckdb-tests", $"{Guid.NewGuid():N}.csv"));
        try
        {
            var total = _conn.Export("SELECT Name FROM EntityText", output);
            Assert.That(total, Is.EqualTo(3));
            Assert.That(File.ReadAllLines(output.FullPath), Has.Length.EqualTo(4));
        }
        finally
        {
            if (File.Exists(output.FullPath))
                File.Delete(output.FullPath);
        }
    }

    [Test]
    public void FileDatabase_RoundTripsThroughBosZip()
    {
        var folder = Path.Combine(Path.GetTempPath(), "ara3d-duckdb-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var bos = new FilePath(Path.Combine(folder, "tiny.bos"));
            var db = new FilePath(Path.Combine(folder, "tiny.duckdb"));
            BuildTinyData().WriteToParquetZip(bos);
            bos.BosToDuckDB(db);
            BosDuckDbViews.CreateViews(db);

            using var conn = BosDuckDb.Open(db);
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM EntityText"), Is.EqualTo(3));
        }
        finally
        {
            TryDelete(folder);
        }
    }

    /// <summary>Regression: while ParameterType had a Bool = Int alias, the SDK's positional
    /// enum encoding shifted parquet ValueType codes +1, so parquet-derived databases mislabeled
    /// every typed value in ParameterText.</summary>
    [Test]
    public void ParquetDerivedDatabase_LabelsValueTypesCorrectly()
    {
        var folder = Path.Combine(Path.GetTempPath(), "ara3d-duckdb-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var bos = new FilePath(Path.Combine(folder, "tiny.bos"));
            var db = new FilePath(Path.Combine(folder, "tiny.duckdb"));
            BuildTinyData().WriteToParquetZip(bos);
            bos.BosToDuckDB(db);
            BosDuckDbViews.CreateViews(db);

            using var conn = BosDuckDb.Open(db);
            var table = conn.Query("SELECT Name, ValueType, Value FROM ParameterText ORDER BY Name");
            Assert.That(table.Rows, Has.Count.EqualTo(3));
            Assert.That(table.Rows[0][1], Is.EqualTo("Number"));
            Assert.That(table.Rows[0][2], Is.EqualTo("2.5"));
            Assert.That(table.Rows[1][1], Is.EqualTo("String"));
            Assert.That(table.Rows[1][2], Is.EqualTo("Concrete"));
            Assert.That(table.Rows[2][1], Is.EqualTo("Entity"));
            Assert.That(table.Rows[2][2], Is.EqualTo("BasicWall"));
        }
        finally
        {
            TryDelete(folder);
        }
    }

    /// <summary>Best-effort cleanup: the zip/parquet pipeline can hold a handle on the .bos file
    /// until GC (IfcBosArtifacts.Dispose swallows the same IOException).</summary>
    public static void TryDelete(string folder)
    {
        try
        {
            Directory.Delete(folder, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}
