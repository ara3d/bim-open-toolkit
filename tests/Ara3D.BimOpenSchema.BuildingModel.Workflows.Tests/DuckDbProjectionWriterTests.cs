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
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM information_schema.columns WHERE data_type LIKE '%JSON%'"), Is.Zero);
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
        var widths = projection.Doors.Select(door => door.NominalWidth).OfType<Fact<Length>.Known>().Select(fact => fact.Value.Metres).ToArray();
        Assert.That(widths, Is.Not.Empty);
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM door WHERE nominal_width IS NOT NULL"), Is.EqualTo(widths.Length));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM door WHERE nominal_width IS NULL AND nominal_width_reason IS NOT NULL"),
            Is.EqualTo(projection.Doors.Length - widths.Length));
        Assert.That(Scalar<double>(connection, "SELECT sum(nominal_width) FROM door"),
            Is.EqualTo(widths.Sum()).Within(1e-8));
    }

    [Test, Category("Size.Small"), Category("Source.Synthetic")]
    [SetCulture("en-US")]
    public void WriterPreservesTypedValuesNullsRelationshipsAndEvidence()
    {
        var projection = Empty();
        var objectId = new ReferenceKey<BimObject>("object-a");
        var evidenceId = new ReferenceKey<Evidence>("evidence-a");
        var door = new Door(new(projection.Snapshot.Id, "door-a"),
            new(objectId, "O'Brien", null, LifecycleState.Existing,
                new(Fact<SnapshotKey<Building>>.Unknown("unknown"), Fact<SnapshotKey<Storey>>.Unknown("unknown"),
                    LinkSet<Storey>.Unknown(), LinkSet<Space>.Unknown(), LinkSet<Zone>.Unknown()),
                Fact<Placement>.Unknown("unknown"), LinkSet<GeometryRepresentation>.Unknown(), []),
            Fact<ReferenceKey<ProductDefinition>>.Unknown("unknown"), Fact<SnapshotKey<Opening>>.Unknown("unknown"),
            LinkSet<Space>.Unknown(), new Fact<DoorOperation>.Known(DoorOperation.Swinging, Assurance.Observed, []),
            new Fact<int>.Known(0, Assurance.Observed, []),
            new Fact<Length>.Known(new(0.9), Assurance.Verified, [evidenceId]),
            Fact<Length>.Unknown("height unavailable"), Fact<Length>.Unknown("unknown"), Fact<Length>.Unknown("unknown"),
            new Fact<DurationValue>.Known(new(TimeSpan.FromMinutes(30)), Assurance.Observed, []),
            new Fact<bool>.Known(false, Assurance.Observed, []),
            new Fact<string>.Known("", Assurance.Observed, []), Fact<bool>.Unknown("unknown"));
        projection = projection with
        {
            Objects = [new(objectId, IdentityStatus.Provisional, "fixture", [], [])],
            Doors = [door],
            Evidence = [new(evidenceId, EvidenceOrigin.External, [], [new("test", "Spec", "1", "section 2")],
                Fact<ReferenceKey<InterpretationPolicy>>.Unknown("unknown"), "fixture", "width")]
        };
        var database = Path.Combine(directory, "values.duckdb");
        new DuckDbProjectionWriter().Write(projection, database);
        using var connection = Open(database);
        Assert.That(Scalar<long>(connection, "SELECT epoch(prepared_at) FROM model_snapshot"), Is.Zero);
        Assert.That(Scalar<double>(connection, "SELECT nominal_width + 0.1 FROM door"), Is.EqualTo(1).Within(1e-12));
        Assert.That(Scalar<string>(connection, "SELECT typeof(nominal_width) FROM door"), Is.EqualTo("DOUBLE"));
        Assert.That(Scalar<long>(connection, "SELECT count(*) FROM door WHERE nominal_height IS NULL AND nominal_height_reason = 'NotObserved' AND nominal_height_explanation = 'height unavailable' AND leaf_count = 0 AND is_smoke_control = false AND hardware_set = '' AND fire_resistance = INTERVAL '30 minutes'"), Is.EqualTo(1));
        Assert.That(Scalar<string>(connection, "SELECT nominal_width_assurance FROM door"), Is.EqualTo("Verified"));
        Assert.That(Scalar<string>(connection, "SELECT e.external_references[1].title FROM door d JOIN evidence e ON e.id = d.nominal_width_evidence[1]"), Is.EqualTo("Spec"));
        Assert.That(Scalar<string>(connection, "SELECT o.id FROM door d JOIN bim_object o ON d.element_object_id = o.id"), Is.EqualTo("object-a"));
        Assert.That(Scalar<string>(connection, "SELECT element_name FROM door"), Is.EqualTo("O'Brien"));
        Assert.That(Scalar<long>(connection, "SELECT len(adjacent_spaces) FROM door WHERE adjacent_spaces_completeness = 'NotObserved'"), Is.Zero);
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
