using System.IO.Compression;
using System.Text;
using Ara3D.BimOpenSchema.DataModel.IO;
using DuckDB.NET.Data;
using Microsoft.Data.Sqlite;
using Parquet;
using Parquet.Data;
using Parquet.Schema;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure, TestFixture, Category("Feature.Serialization"), Category("Size.Small"), Category("Stage.Stable"), Category("Source.Synthetic")]
public sealed class SerializationTests
{
    [Test]
    public void JsonRoundTripPreservesAllRowsAndRebuildsIndexes()
    {
        var model = Fixtures.Model();
        using var stream = new MemoryStream();
        BimModelIO.WriteJson(model, stream);
        var json = Encoding.UTF8.GetString(stream.ToArray());
        stream.Position = 0;
        var restored = BimModelIO.ReadJson(stream).Match(m => m, _ => throw new AssertionException("JSON failed"));
        using var again = new MemoryStream();
        BimModelIO.WriteJson(restored, again);
        Assert.That(Encoding.UTF8.GetString(again.ToArray()), Is.EqualTo(json));
        Assert.That(restored.PropertiesOf(2), Is.EqualTo(model.PropertiesOf(2)));
        Assert.That(restored.Spatial.Intersect(model.Tables.Geometry[0].Bounds), Is.EqualTo(new[] { 2 }));
        using var bad = new MemoryStream(Encoding.UTF8.GetBytes(json.Replace("\"SchemaVersion\":\"1.0\"", "\"SchemaVersion\":\"99\"")));
        Assert.That(BimModelIO.ReadJson(bad).IsOk, Is.False);
        using var brokenReference = new MemoryStream(Encoding.UTF8.GetBytes(json.Replace("\"EntityId\":2", "\"EntityId\":999")));
        Assert.That(BimModelIO.ReadJson(brokenReference).IsOk, Is.False);
    }

    [Test]
    public void DuckDbBulkExportAndPortableSqlHaveTheSameTypedValues()
    {
        var model = Fixtures.Model();
        using var duck = new DuckDBConnection("DataSource=:memory:"); duck.Open();
        ModelSql.WriteDuckDb(model, duck);
        using var command = duck.CreateCommand();
        command.CommandText = "SELECT TextValue FROM Properties WHERE TextValue IS NOT NULL";
        Assert.That(command.ExecuteScalar(), Is.EqualTo("O'Brien"));
        command.CommandText = "SELECT CAST(SUM(TriangleCount) AS BIGINT) FROM Geometry";
        Assert.That(System.Convert.ToInt64(command.ExecuteScalar()), Is.EqualTo(1));
        command.CommandText = "SELECT COUNT(*) FROM Properties WHERE CanonicalNumber IS NULL";
        Assert.That(System.Convert.ToInt64(command.ExecuteScalar()), Is.EqualTo(5));
        using var text = new StringWriter(); ModelSql.WriteSql(model, text);
        using var sqlite = new SqliteConnection("Data Source=:memory:"); sqlite.Open();
        using var sql = sqlite.CreateCommand(); sql.CommandText = text.ToString(); sql.ExecuteNonQuery();
        sql.CommandText = "SELECT TextValue FROM Properties WHERE TextValue IS NOT NULL";
        Assert.That(sql.ExecuteScalar(), Is.EqualTo("O'Brien"));
        sql.CommandText = "SELECT NumberValue FROM Properties WHERE Id=0";
        Assert.That(System.Convert.ToDouble(sql.ExecuteScalar()), Is.EqualTo(3000));
        command.CommandText = "WITH RECURSIVE reachable(id) AS (SELECT 2 UNION SELECT e.TargetId FROM Edges e JOIN reachable r ON e.SourceId=r.id WHERE e.Kind='PartOf') SELECT COUNT(*) FROM reachable";
        Assert.That(System.Convert.ToInt64(command.ExecuteScalar()), Is.EqualTo(2));
    }

    [Test]
    public void DuckDbExportRollsBackIfATableAlreadyExists()
    {
        using var duck = new DuckDBConnection("DataSource=:memory:"); duck.Open();
        using var command = duck.CreateCommand(); command.CommandText = "CREATE TABLE Entities(Existing INTEGER); INSERT INTO Entities VALUES (42);"; command.ExecuteNonQuery();
        Assert.Throws<DuckDBException>(() => ModelSql.WriteDuckDb(Fixtures.Model(), duck));
        command.CommandText = "SELECT Existing FROM Entities";
        Assert.That(command.ExecuteScalar(), Is.EqualTo(42));
        command.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='Documents'";
        Assert.That(System.Convert.ToInt64(command.ExecuteScalar()), Is.Zero);
    }

    [TestCase(false), TestCase(true)]
    public void BosLoaderReadsAllGroupsAndLegacySingleValues(bool legacy)
    {
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, $"groups-{Guid.NewGuid():N}.bos");
        try
        {
            using (var file = File.Create(path))
            using (var zip = new ZipArchive(file, ZipArchiveMode.Create))
            {
                WriteTable(zip, "Strings", [new DataField<string>("Strings")], [[new[] { "Height", "mm", "P" }]]);
                WriteTable(zip, "Documents", [new DataField<int>("Title"), new DataField<int>("Path")], [[new[] { 2 }, new[] { -1 }]]);
                WriteTable(zip, "Entities", [new DataField<long>("LocalId"), new DataField<int>("GlobalId"), new DataField<int>("Document"),
                    new DataField<int>("Name"), new DataField<int>("Category"), new DataField<int>("Type")],
                    [[new long[] { 10 }, new[] { -1 }, new[] { 0 }, new[] { 0 }, new[] { -1 }, new[] { -1 }],
                     [new long[] { 20 }, new[] { -1 }, new[] { 0 }, new[] { 0 }, new[] { -1 }, new[] { -1 }]]);
                WriteTable(zip, "Descriptors", [new DataField<int>("Name"), new DataField<int>("Units"), new DataField<int>("Group"), new DataField<int>("Type")],
                    [[new[] { 0 }, new[] { 1 }, new[] { -1 }, new[] { 1 }]]);
                if (legacy)
                    WriteTable(zip, "SingleParameters", [new DataField<int>("Entity"), new DataField<int>("Descriptor"), new DataField<float>("Value")],
                        [[new[] { 0 }, new[] { 0 }, new[] { 1000f }], [new[] { 1 }, new[] { 0 }, new[] { 2000f }]]);
                else
                {
                    WriteTable(zip, "Numbers", [new DataField<float>("Numbers")], [[new[] { 1000f }], [new[] { 2000f }]]);
                    WriteTable(zip, "Parameters", [new DataField<int>("Entity"), new DataField<int>("Descriptor"), new DataField<int>("Value")],
                        [[new[] { 0 }, new[] { 0 }, new[] { 0 }], [new[] { 1 }, new[] { 0 }, new[] { 1 }]]);
                }
            }
            var model = BimModelIO.LoadBos(path).Match(m => m, e => throw new AssertionException(e[0].Message));
            Assert.That(model.Tables.Entities.Select(e => e.LocalId), Is.EqualTo(new long[] { 10, 20 }));
            Assert.That(model.Tables.Properties.Select(p => p.NumberValue), Is.EqualTo(new double[] { 1000, 2000 }));
            Assert.That(model.Tables.Issues, Is.Empty);
        }
        finally { File.Delete(path); }
    }

    private static void WriteTable(ZipArchive zip, string name, DataField[] fields, Array[][] groups)
    {
        using var buffer = new MemoryStream();
        using (var writer = ParquetWriter.CreateAsync(new ParquetSchema(fields), buffer).GetAwaiter().GetResult())
            foreach (var columns in groups)
            {
                using var group = writer.CreateRowGroup();
                for (var i = 0; i < fields.Length; i++) group.WriteColumnAsync(new DataColumn(fields[i], columns[i])).GetAwaiter().GetResult();
            }
        buffer.Position = 0;
        using var entry = zip.CreateEntry(name + ".parquet").Open(); buffer.CopyTo(entry);
    }

    [Test]
    public void MalformedBosManifestReturnsAnErrorResult()
    {
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, $"invalid-{Guid.NewGuid():N}.bos");
        try
        {
            using (var file = File.Create(path))
            using (var zip = new ZipArchive(file, ZipArchiveMode.Create))
            using (var manifest = new StreamWriter(zip.CreateEntry("Manifest.json").Open())) manifest.Write("not JSON");
            Assert.That(BimModelIO.LoadBos(path).IsOk, Is.False);
        }
        finally { File.Delete(path); }
    }
}
