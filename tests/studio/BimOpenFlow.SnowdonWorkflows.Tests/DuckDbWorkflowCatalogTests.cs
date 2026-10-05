using System.Text.Json;
using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using BimOpenFlow.Host;
using BimOpenFlow.TableWorkflows.Tests;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.SnowdonWorkflows.Tests;

/// <summary>
/// Every graph embedded in samples/duckdb-analyses/workflows.json (the catalog the
/// /duckdb.html demo and scripts/check-bim-flow-duckdb.mjs consume) parses and validates
/// against the tables profile registry. Each entry names its database: "public" graphs
/// read bim-open-data's Schependomlaan export (deps/bim-open-data/samples/public, fetched by
/// `node deps.mjs`) and are evaluated here with their numbers asserted; "snowdon" graphs
/// read the private typed Snowdon export, whose tables (door, storey, space, roof, evidence,
/// source_*) sample.duckdb lacks, so of those only the graph that reads information_schema
/// evaluates here, over a freshly generated sample.duckdb.
/// </summary>
[TestFixture]
public sealed class DuckDbWorkflowCatalogTests
{
    public const string DuckDbPlaceholder = "{DUCKDB}";
    public const string PublicDuckDbPlaceholder = "{PUBLIC_DUCKDB}";
    public const string PublicBuilding = "schependomlaan";

    /// <summary>One catalog entry: the analysis id, its database ("public" or "snowdon"),
    /// its result node, and its embedded graph document.</summary>
    public sealed record CatalogGraph(string Id, string Database, string ResultNode, GraphDocument Graph)
    {
        public string Placeholder
            => Database == "public" ? PublicDuckDbPlaceholder : DuckDbPlaceholder;
    }

    public static string CatalogFile
        => RepoPaths.Samples("duckdb-analyses", "workflows.json");

    public static string PublicDuckDb
        => RepoPaths.PublicDuckDb(PublicBuilding);

    /// <summary>Graph ids whose SQL names Snowdon tables that sample.duckdb does not hold.</summary>
    private static readonly IReadOnlySet<string> SnowdonOnly = new HashSet<string>
    {
        "duckdb-door-schedule", "duckdb-door-types", "duckdb-room-schedule", "duckdb-room-distribution",
        "duckdb-missing-widths", "duckdb-roof-coverage", "duckdb-evidence-trace", "duckdb-source-lineage",
    };

    public static IReadOnlyList<CatalogGraph> ReadCatalog()
    {
        using var json = JsonDocument.Parse(File.ReadAllText(CatalogFile));
        return json.RootElement.EnumerateArray()
            .Select(entry => new CatalogGraph(
                entry.GetProperty("id").GetString()!,
                entry.GetProperty("database").GetString()!,
                entry.GetProperty("result").GetString()!,
                GraphDocumentIO.Parse(entry.GetProperty("graph").GetRawText())))
            .ToList();
    }

    public static IEnumerable<TestCaseData> Graphs
        => ReadCatalog().Select(g => new TestCaseData(g).SetArgDisplayNames(g.Id));

    private static CatalogGraph Entry(TestCaseData t)
        => (CatalogGraph)t.Arguments[0]!;

    public static IEnumerable<TestCaseData> SnowdonOnlyGraphs
        => Graphs.Where(t => SnowdonOnly.Contains(Entry(t).Id));

    public static IEnumerable<TestCaseData> SampleDbGraphs
        => Graphs.Where(t => Entry(t).Database == "snowdon" && !SnowdonOnly.Contains(Entry(t).Id));

    public static IEnumerable<TestCaseData> PublicGraphs
        => Graphs.Where(t => Entry(t).Database == "public");

    private string _dir = null!;

    private string SampleDuckDb => Path.Combine(_dir, SampleFixtures.DuckDbName);

    [OneTimeSetUp]
    public void SeedSampleDuckDb()
    {
        _dir = Path.Combine(Path.GetTempPath(), "bimopenflow-duckdb-catalog", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);
        SampleFixtures.WriteDuckDb(SampleFixtures.ReadAll(SamplePaths.TablesDir), SampleDuckDb);
    }

    [OneTimeTearDown]
    public void DeleteSampleDuckDb()
    {
        try
        {
            Directory.Delete(_dir, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Test]
    public void CatalogHoldsFourteenGraphsWithUniqueIds()
    {
        var ids = ReadCatalog().Select(g => g.Id).ToList();
        Assert.That(ids, Has.Count.EqualTo(14));
        Assert.That(ids, Is.Unique);
        Assert.That(ids, Has.All.Matches<string>(BimOpenFlow.Host.Store.AnalysisId.IsValid));
    }

    [Test]
    public void EveryEntryNamesAKnownDatabase()
        => Assert.That(ReadCatalog().Select(g => g.Database), Has.All.AnyOf("public", "snowdon"));

    [Test]
    public void FivePublicGraphsComeFirst()
        => Assert.That(ReadCatalog().Take(5).Select(g => g.Database), Has.All.EqualTo("public"),
            "the demo opens on the first entry, which must run without the private model");

    [Test]
    public void SnowdonOnlyListNamesCatalogGraphs()
        => Assert.That(SnowdonOnly, Is.SubsetOf(ReadCatalog().Select(g => g.Id)));

    [TestCaseSource(nameof(Graphs))]
    public void ParsesAndValidates(CatalogGraph entry)
    {
        Assert.That(entry.Graph.Nodes, Is.Not.Empty);
        Assert.That(entry.Graph.FindNode(entry.ResultNode), Is.Not.Null, "result node");
        Assert.That(entry.Graph.Validate(HostComposition.TablePacks()), Is.Empty);
    }

    [TestCaseSource(nameof(Graphs))]
    public void DatabasePathIsItsPlaceholder(CatalogGraph entry)
        => Assert.That(entry.Graph.Values.Values.SelectMany(p => p.Values).Where(v => v.Contains("DUCKDB}")),
            Is.EqualTo(new[] { entry.Placeholder }));

    /// <summary>These graphs SELECT from Snowdon tables, so over sample.duckdb the duck.query
    /// nodes fail with a missing-table error and everything downstream is Unavailable.</summary>
    [TestCaseSource(nameof(SnowdonOnlyGraphs))]
    public void SnowdonOnly_FailsOnlyAtTheQueriesOverSampleDb(CatalogGraph entry)
    {
        var snapshot = Evaluate(entry, SampleDuckDb);
        var failed = snapshot.Results.Where(r => r.Value.Status == NodeStatus.Error).Select(r => r.Key).ToList();
        Assert.That(failed, Is.Not.Empty);
        Assert.That(failed, Has.All.Matches<string>(id => entry.Graph.FindNode(id)!.Kind == "duck.query"));
    }

    [TestCaseSource(nameof(SampleDbGraphs))]
    public void SampleDb_EvaluatesEveryNodeOk(CatalogGraph entry)
        => AssertEveryNodeOk(entry, Evaluate(entry, SampleDuckDb));

    [TestCaseSource(nameof(PublicGraphs))]
    public void Public_EvaluatesEveryNodeOkOverSchependomlaan(CatalogGraph entry)
        => AssertEveryNodeOk(entry, EvaluatePublic(entry));

    /// <summary>The numbers each public graph's description cites, measured on
    /// bim-open-data's schependomlaan.duckdb with the DuckDB shell on 2026-10-05.</summary>
    [Test]
    public void Public_DoorSchedule_Lists205DoorsOnFourStoreys()
    {
        var answer = PublicAnswer("public-door-schedule");
        Assert.That(answer.Rows, Has.Count.EqualTo(205));
        Assert.That(answer.Column("Storey").Distinct().Count(), Is.EqualTo(4), "doors sit on four of the six storeys");
        Assert.That(answer.Column("Width_mm").Count(v => v is null), Is.EqualTo(101), "101 doors carry no OverallWidth");
    }

    [Test]
    public void Public_DoorTypes_RanksTheBerkvensTypeFirst()
    {
        var answer = PublicAnswer("public-door-types");
        Assert.That(answer.Rows, Has.Count.EqualTo(10));
        Assert.That(answer.Cell("DoorType", 0), Is.EqualTo("32_KD_berkvens_BA"));
        Assert.That(Convert.ToInt64(answer.Cell("Doors", 0)), Is.EqualTo(73));
    }

    [Test]
    public void Public_RoomsPerStorey_Counts100SpacesOnFourStoreys()
    {
        var answer = PublicAnswer("public-rooms-per-storey");
        Assert.That(answer.Column("Storey"), Is.EqualTo(new object?[]
            { "00 begane grond", "01 eerste verdieping", "02 tweede verdieping", "03 derde verdieping" }));
        Assert.That(answer.Column("Rooms").Select(Convert.ToInt64), Is.EqualTo(new long[] { 32, 29, 20, 19 }));
    }

    [Test]
    public void Public_MissingWidths_Finds101Doors()
    {
        var answer = PublicAnswer("public-missing-widths");
        Assert.That(answer.Rows, Has.Count.EqualTo(101));
        Assert.That(answer.Column("Width_mm"), Has.All.Null, "the graph never fills a missing width");
    }

    [Test]
    public void Public_FloorAreaByUse_PutsLivingRoomsFirst()
    {
        var answer = PublicAnswer("public-floor-area-by-use");
        Assert.That(answer.Rows, Has.Count.EqualTo(6));
        Assert.That(answer.Cell("Use", 0), Is.EqualTo("Verblijfsruimte"));
        Assert.That(Convert.ToInt64(answer.Cell("Spaces", 0)), Is.EqualTo(39));
        Assert.That(Convert.ToDouble(answer.Cell("NetFloorArea_m2", 0)), Is.EqualTo(705.8).Within(0.05));
    }

    private static void AssertEveryNodeOk(CatalogGraph entry, EvalSnapshot snapshot)
    {
        var notOk = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(notOk, Is.Empty, entry.Id);
        Assert.That(snapshot.Results[entry.ResultNode].Outputs, Is.Not.Empty);
    }

    private static IDataTable PublicAnswer(string id)
    {
        var entry = ReadCatalog().Single(g => g.Id == id);
        var snapshot = EvaluatePublic(entry);
        AssertEveryNodeOk(entry, snapshot);
        return ((TableValue)snapshot.Results[entry.ResultNode].Outputs[0]).Table;
    }

    private static EvalSnapshot EvaluatePublic(CatalogGraph entry)
    {
        if (!File.Exists(PublicDuckDb))
            Assert.Ignore($"{PublicDuckDb} is absent; run `node deps.mjs` to fetch bim-open-data");
        return Evaluate(entry, PublicDuckDb);
    }

    private static EvalSnapshot Evaluate(CatalogGraph entry, string database)
        => SampleSeeding.RewritePaths(entry.Graph, entry.Placeholder, database)
            .Evaluate(HostComposition.TablePacks());
}
