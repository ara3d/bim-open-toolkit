using System.Globalization;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.Ifc.DuckDb;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.Geometry;
using BimOpenFlow.Relations;
using BimOpenFlow.Studio;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>nrc-join-analytics over the IFC viewer test kit's own analytics_dataset_with_levels.csv
/// (samples/nrc/test-kit, 268 rows) and samples/nrc/duplex-base.ifc: proves the join, the match
/// report, both colourings, and the per-storey totals and means against an independent
/// computation from the CSV and the model (a raw SQL query and, for "physical element", the
/// mesh instances loaded directly through <see cref="ModelGeometryCache"/> rather than the
/// rel.* engine under test).
/// <para>Builds its own duplex-base.duckdb rather than reusing <c>Fixture</c> (owned by another
/// builder, TKT-48, which only knows "duplex-enriched"), so the "duplex-base" source this graph
/// names resolves here. TKT-48 tracks the separate gap that the host does not yet prepare that
/// database in the background the way it does for duplex-enriched.</para></summary>
[TestFixture]
public sealed class JoinAnalyticsTests
{
    private const string GraphId = "nrc-join-analytics";
    private const double Tolerance = 0.05;

    private static readonly Lazy<string> BuiltDatabaseDir = new(() =>
    {
        var dir = Path.Combine(Path.GetTempPath(), "bof-nrc-join-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        IfcDuckDbBuild.Build(new FilePath(Path.Combine(NrcPaths.SamplesDir, "duplex-base.ifc")),
            new FilePath(Path.Combine(dir, "duplex-base.duckdb")));
        return dir;
    });

    private static RelationRuntime Runtime
        => RelationRuntime.FromRoots([NrcPaths.SamplesDir, BuiltDatabaseDir.Value]);

    [OneTimeTearDown]
    public void DeleteDatabase()
    {
        if (!BuiltDatabaseDir.IsValueCreated)
            return;
        try { Directory.Delete(BuiltDatabaseDir.Value, recursive: true); }
        catch (IOException) { }
    }

    private static (EvalSnapshot Snapshot, RelationRuntime Runtime) Evaluate()
    {
        var runtime = Runtime;
        var registry = StudioComposition.BimPacks(runtime);
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(NrcPaths.Graph(GraphId)), NrcPaths.SamplesDir);
        Assert.That(doc.Validate(registry), Is.Empty, GraphId);
        var snapshot = doc.Evaluate(registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, GraphId);
        return (snapshot, runtime);
    }

    private static IDataTable Materialize(EvalSnapshot snapshot, RelationRuntime runtime, string nodeId)
        => runtime.Materialize((Plan)((RelationValue)snapshot.Results[nodeId].Outputs[0]).Payload!);

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    /// <summary>One row of samples/nrc/test-kit/analytics_dataset_with_levels.csv, parsed
    /// independently of the graph under test (no quoted fields in this file, so a plain split
    /// is safe: every data line has exactly 6 comma-separated fields).</summary>
    private sealed record CsvRow(string GlobalId, string Name, string Level, double Carbon, double Energy, string Category);

    private static IReadOnlyList<CsvRow> ReadCsv()
        => File.ReadAllLines(Path.Combine(NrcPaths.SamplesDir, "test-kit", "analytics_dataset_with_levels.csv"))
            .Skip(1)
            .Select(line => line.Split(','))
            .Select(f => new CsvRow(f[0], f[1], f[2],
                double.Parse(f[3], CultureInfo.InvariantCulture), double.Parse(f[4], CultureInfo.InvariantCulture), f[5]))
            .ToList();

    /// <summary>Every entity's GlobalId and category, read by a plain SQL query rather than
    /// through a rel.table plan.</summary>
    private static IReadOnlyDictionary<string, string> ReadEntityCategories()
    {
        var result = new Dictionary<string, string>();
        using var conn = Ara3D.BimOpenSchema.DuckDb.BosDuckDb.Open(
            new FilePath(Path.Combine(BuiltDatabaseDir.Value, "duplex-base.duckdb")));
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT GlobalId, Category FROM EntityText WHERE GlobalId IS NOT NULL";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            result[reader.GetString(0)] = reader.IsDBNull(1) ? "" : reader.GetString(1);
        return result;
    }

    /// <summary>Every entity's GlobalId to its StoreyOfElement storey name, by a plain SQL
    /// query rather than through the graph's rel.join chain.</summary>
    private static IReadOnlyDictionary<string, string> ReadStoreyByGlobalId()
    {
        var result = new Dictionary<string, string>();
        using var conn = Ara3D.BimOpenSchema.DuckDb.BosDuckDb.Open(
            new FilePath(Path.Combine(BuiltDatabaseDir.Value, "duplex-base.duckdb")));
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT e.GlobalId, s.StoreyName FROM StoreyOfElement s " +
                           "JOIN EntityText e ON e.EntityIndex = s.EntityIndex WHERE e.GlobalId IS NOT NULL";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            result[reader.GetString(0)] = reader.IsDBNull(1) ? "" : reader.GetString(1);
        return result;
    }

    /// <summary>Physical elements, defined as entities with at least one rendered mesh instance
    /// (view3d.instances' own criterion for a row), read straight from the mesher rather than
    /// from any rel.* node.</summary>
    private static IReadOnlySet<string> ReadPhysicalGlobalIds()
        => ModelGeometryCache.Load(new FilePath(Path.Combine(NrcPaths.SamplesDir, "duplex-base.ifc")))
            .Instances.Select(i => i.GlobalId).Where(g => !string.IsNullOrEmpty(g)).ToHashSet();

    [Test]
    public void MatchReport_CountsAgreeWithAnIndependentComputation()
    {
        var csv = ReadCsv();
        var entities = ReadEntityCategories();
        var physical = ReadPhysicalGlobalIds();
        var csvIds = csv.Select(r => r.GlobalId).ToHashSet();

        // Independent counts: every CSV row's GlobalId is in the model (0 misses); the
        // physical elements the CSV never mentions; and CSV rows that do match an entity, but
        // one with no mesh, so far all IFCOPENINGELEMENT (the test kit's synthetic doors and
        // windows carry analytics on their voids) and two IFCSTAIR entities that are meshed
        // only through their flights.
        var expectedCsvNoEntity = csv.Count(r => !entities.ContainsKey(r.GlobalId));
        var expectedPhysicalNoCsv = physical.Count(id => !csvIds.Contains(id));
        var expectedNonPhysicalMatches = csv.Where(r => entities.ContainsKey(r.GlobalId) && !physical.Contains(r.GlobalId)).ToList();

        Assert.That(expectedCsvNoEntity, Is.EqualTo(0));
        Assert.That(expectedPhysicalNoCsv, Is.EqualTo(21));
        Assert.That(expectedNonPhysicalMatches, Has.Count.EqualTo(52));
        Assert.That(expectedNonPhysicalMatches.Count(r => entities[r.GlobalId] == "IFCOPENINGELEMENT"), Is.EqualTo(50));
        Assert.That(expectedNonPhysicalMatches.Count(r => entities[r.GlobalId] == "IFCSTAIR"), Is.EqualTo(2));

        var (snapshot, runtime) = Evaluate();
        var answer = Materialize(snapshot, runtime, "answer");
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.Cell("CsvRowsWithNoEntity", 0), Is.EqualTo((long)expectedCsvNoEntity));
        Assert.That(answer.Cell("PhysicalElementsWithNoCsvRow", 0), Is.EqualTo((long)expectedPhysicalNoCsv));
        Assert.That(answer.Cell("CsvRowsMatchingNonPhysicalEntity", 0), Is.EqualTo((long)expectedNonPhysicalMatches.Count));
    }

    [Test]
    public void Colouring_MatchesTheSameInstanceRowsForBothColumns()
    {
        var (snapshot, _) = Evaluate();
        var unmatched = ColorNode.Unmatched.R;

        var carbon = ((TableValue)snapshot.Results["coloredCarbon"].Outputs[0]).Table;
        var category = ((TableValue)snapshot.Results["coloredCategory"].Outputs[0]).Table;

        // Duplex-base has 714 mesh instances (one row per placed mesh, several per element);
        // 693 belong to one of the 216 physical elements the CSV also names (the 693 counts
        // meshes, so it differs from the 216-element figure below).
        Assert.That(carbon.Rows, Has.Count.EqualTo(714));
        Assert.That(category.Rows, Has.Count.EqualTo(714));
        var carbonMatched = Enumerable.Range(0, carbon.Rows.Count).Count(i => !Equals(carbon.Cell("r", i), unmatched));
        var categoryMatched = Enumerable.Range(0, category.Rows.Count).Count(i => !Equals(category.Cell("r", i), unmatched));
        Assert.That(carbonMatched, Is.EqualTo(693));
        Assert.That(categoryMatched, Is.EqualTo(693));

        var physical = ReadPhysicalGlobalIds();
        var csvIds = ReadCsv().Select(r => r.GlobalId).ToHashSet();
        Assert.That(physical.Count(id => csvIds.Contains(id)), Is.EqualTo(216));
    }

    [Test]
    public void PerStorey_TotalsAndMeansMatchAnIndependentGroupByOverTheCsv()
    {
        var storeyOf = ReadStoreyByGlobalId();
        var csv = ReadCsv().Where(r => storeyOf.ContainsKey(r.GlobalId)).ToList();
        var expected = csv.GroupBy(r => storeyOf[r.GlobalId])
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Total: g.Sum(r => r.Carbon),
                Mean: g.Average(r => r.Carbon), MeanEui: g.Average(r => r.Energy)));

        var (snapshot, runtime) = Evaluate();
        var perStorey = Materialize(snapshot, runtime, "perStorey");
        Assert.That(perStorey.Rows, Has.Count.EqualTo(4));
        Assert.That(perStorey.ColumnCells("StoreyName"),
            Is.EquivalentTo(new object?[] { "Level 1", "Level 2", "Roof", "T/FDN" }));

        for (var row = 0; row < perStorey.Rows.Count; row++)
        {
            var storey = (string)perStorey.Cell("StoreyName", row)!;
            var exp = expected[storey];
            Assert.That(perStorey.Cell("Elements", row), Is.EqualTo((long)exp.Count), storey);
            Assert.That(Number(perStorey, "TotalOperationalCarbon", row), Is.EqualTo(exp.Total).Within(Tolerance), storey);
            Assert.That(Number(perStorey, "MeanOperationalCarbon", row), Is.EqualTo(exp.Mean).Within(Tolerance), storey);
            Assert.That(Number(perStorey, "MeanEnergyIntensity", row), Is.EqualTo(exp.MeanEui).Within(Tolerance), storey);
        }

        // The four storeys' element counts, 103/93/8/14, are the same split as
        // samples/nrc/nrc_analytics_storeys.csv, because both datasets analyse the same
        // 218 physical elements of the Duplex model; only the carbon and energy values differ.
        Assert.That(expected["Level 1"].Count, Is.EqualTo(103));
        Assert.That(expected["Level 2"].Count, Is.EqualTo(93));
        Assert.That(expected["Roof"].Count, Is.EqualTo(8));
        Assert.That(expected["T/FDN"].Count, Is.EqualTo(14));
    }

    [Test]
    public void StoreyComparison_DisagreesWithCsvLevelForDoorAndWindowScheduleMarks()
    {
        var storeyOf = ReadStoreyByGlobalId();
        var csv = ReadCsv().Where(r => storeyOf.ContainsKey(r.GlobalId)).ToList();
        var expectedDisagreements = csv.Count(r => !string.Equals(r.Level, storeyOf[r.GlobalId], StringComparison.OrdinalIgnoreCase));
        Assert.That(csv, Has.Count.EqualTo(218));
        // The test kit's Level column holds the storey name for most rows, but a door or window
        // schedule mark (e.g. "A102", "B103") for others: neither IFC entity nor storey knows
        // that mark, so StoreyOfElement's answer legitimately disagrees with it.
        Assert.That(expectedDisagreements, Is.EqualTo(61));

        var (snapshot, runtime) = Evaluate();
        var comparison = Materialize(snapshot, runtime, "storeyComparison");
        Assert.That(comparison.Rows, Has.Count.EqualTo(218));
        var disagreements = Enumerable.Range(0, comparison.Rows.Count)
            .Count(row => !string.Equals((string?)comparison.Cell("Level", row),
                (string?)comparison.Cell("StoreyName", row), StringComparison.OrdinalIgnoreCase));
        Assert.That(disagreements, Is.EqualTo(61));
    }
}
