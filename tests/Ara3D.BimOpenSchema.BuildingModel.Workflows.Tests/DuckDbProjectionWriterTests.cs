using Ara3D.BimOpenSchema.BuildingModel.DuckDb;
using Ara3D.BimOpenSchema.BuildingModel.Source;
using DuckDB.NET.Data;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

[Impure, TestFixture, Category("Feature.DuckDbExport")]
public sealed class DuckDbProjectionWriterTests
{
    private string directory = null!;

    [SetUp]
    public void SetUp() => directory = Directory.CreateDirectory(Path.Combine(TestContext.CurrentContext.WorkDirectory, "duckdb-" + Guid.NewGuid().ToString("N"))).FullName;

    [TearDown]
    public void TearDown()
    {
        var expected = Path.GetFullPath(TestContext.CurrentContext.WorkDirectory) + Path.DirectorySeparatorChar;
        if (!Path.GetFullPath(directory).StartsWith(expected, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unexpected test directory.");
        Directory.Delete(directory, true);
    }

    [Test, Category("Size.Small"), Category("Source.Synthetic")]
    public void WriterCreatesTheSpecifiedCoreSchema()
    {
        var database = Path.Combine(directory, "core.duckdb");
        new DuckDbProjectionWriter().Write(Empty(), database);

        Assert.That(CoreSchema.Tables, Has.Length.EqualTo(83));
        Assert.That(CoreSchema.Tables.Sum(table => table.Columns.Length), Is.EqualTo(862));
        Assert.That(CoreSchema.Tables.Single(table => table.Name == "door").Columns.Select(column => column.Name),
            Is.EqualTo(new[] { "id", "element", "product", "opening", "adjacent_spaces", "operation", "leaf_count", "nominal_width", "nominal_height", "clear_width", "clear_height", "fire_resistance", "is_smoke_control", "hardware_set", "is_accessible" }));

        using var connection = Open(database);
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'main'"), Is.EqualTo(83));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'main'"), Is.EqualTo(862));
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void SnowdonBosExportsItsMappedArchitecturalRowsToDuckDb()
    {
        var source = Environment.GetEnvironmentVariable("BIM_OPEN_SCHEMA_SNOWDON")
            ?? "C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos";
        if (!File.Exists(source)) Assert.Ignore($"Snowdon BOS fixture is unavailable: {source}");

        var cache = Path.Combine(directory, "snowdon.bfast");
        var database = Path.Combine(directory, "snowdon.duckdb");
        var metadata = SourceCache.Prepare(source, cache);
        var projection = BuildingMapper.Map(SourceCache.Load(cache), new MappingOptions(metadata.SourceSha256,
            "sha256:" + metadata.SourceSha256, "snowdon", DateTimeOffset.UnixEpoch,
            NumericStorage: NumericStoragePolicy.RevitInternal));
        new DuckDbProjectionWriter().Write(projection, database);

        using var connection = Open(database);
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM storey"), Is.EqualTo(84));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM space"), Is.EqualTo(290));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM door"), Is.EqualTo(142));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM roof"), Is.EqualTo(26));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM door WHERE nominal_width IS NOT NULL"), Is.EqualTo(142));
    }

    private static BuildingProjection Empty() => new(
        new(new("snapshot-a"), "fixture", "test", [], [], DateTimeOffset.UnixEpoch),
        [], [], [], [], [], [], [], [], [], [], [], [], []);

    private static DuckDBConnection Open(string database)
    {
        var connection = new DuckDBConnection($"DataSource={database}");
        connection.Open();
        return connection;
    }

    private static T Scalar<T>(DuckDBConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return (T)Convert.ChangeType(command.ExecuteScalar() ?? throw new InvalidOperationException("Query returned null."),
            typeof(T), System.Globalization.CultureInfo.InvariantCulture);
    }
}
