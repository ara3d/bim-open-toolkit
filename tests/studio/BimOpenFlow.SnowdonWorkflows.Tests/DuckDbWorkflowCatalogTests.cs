using System.Text.Json;
using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using BimOpenFlow.Host;
using BimOpenFlow.TableWorkflows.Tests;
using BimOpenToolkit.TestSupport;
using DuckDB.NET.Data;

namespace BimOpenFlow.SnowdonWorkflows.Tests;

/// <summary>
/// Every graph embedded in samples/duckdb-analyses/workflows.json (the catalog the
/// /duckdb.html demo and scripts/check-bim-flow-duckdb.mjs consume) parses and validates
/// against the tables profile registry, declares a graph input `model` holding its database
/// placeholder, and lays its wires out left to right. Each entry names its database: "public"
/// graphs read bim-open-data's Schependomlaan export (deps/bim-open-data/samples/public,
/// fetched by `node deps.mjs`) and are evaluated here with their numbers asserted; "snowdon"
/// graphs read the private typed Snowdon export, so they are evaluated over a small database
/// written here with the same tables and columns (SnowdonShape), and the graph that reads only
/// information_schema also over a freshly generated sample.duckdb.
/// </summary>
[TestFixture]
public sealed class DuckDbWorkflowCatalogTests
{
    public const string DuckDbPlaceholder = "{DUCKDB}";
    public const string PublicDuckDbPlaceholder = "{PUBLIC_DUCKDB}";
    public const string PublicBuilding = "schependomlaan";
    public const string ModelInput = "model";

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

    public static IEnumerable<TestCaseData> SnowdonGraphs
        => Graphs.Where(t => Entry(t).Database == "snowdon");

    public static IEnumerable<TestCaseData> SampleDbGraphs
        => Graphs.Where(t => Entry(t).Database == "snowdon" && !SnowdonOnly.Contains(Entry(t).Id));

    public static IEnumerable<TestCaseData> PublicGraphs
        => Graphs.Where(t => Entry(t).Database == "public");

    private string _dir = null!;

    private string SampleDuckDb => Path.Combine(_dir, SampleFixtures.DuckDbName);

    private string SnowdonShapedDuckDb => Path.Combine(_dir, "snowdon-shaped.duckdb");

    [OneTimeSetUp]
    public void SeedSampleDuckDb()
    {
        _dir = Path.Combine(Path.GetTempPath(), "bimopenflow-duckdb-catalog", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);
        SampleFixtures.WriteDuckDb(SampleFixtures.ReadAll(SamplePaths.TablesDir), SampleDuckDb);
        using var connection = new DuckDBConnection($"Data Source={SnowdonShapedDuckDb}");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = SnowdonShape;
        command.ExecuteNonQuery();
    }

    /// <summary>The tables and columns of the typed Snowdon export that the Snowdon graphs
    /// read, with column types as export-duckdb writes them (bim-open-data's
    /// DuckDbProjectionWriterTests), and a few rows chosen to exercise each graph: two storeys
    /// share the name Level 1, one space has no storey, one door has no width.</summary>
    private const string SnowdonShape = """
        CREATE TABLE storey (id VARCHAR, element_name VARCHAR);
        INSERT INTO storey VALUES ('s1', 'Level 1'), ('s2', 'Level 1'), ('s3', 'Roof');
        CREATE TABLE space (number VARCHAR, element_name VARCHAR, storey VARCHAR, net_floor_area DOUBLE, net_floor_area_reason VARCHAR);
        INSERT INTO space VALUES ('101', 'Office', 's1', 20.0, NULL), ('102', 'Hall', 's2', NULL, 'NotObserved'),
            ('201', 'Plant', 's3', NULL, 'NotObserved'), ('X1', 'Void', NULL, NULL, 'NotObserved');
        CREATE TABLE door (element_mark VARCHAR, element_name VARCHAR, element_location_primary_storey VARCHAR,
            nominal_width DOUBLE, nominal_width_reason VARCHAR, nominal_width_explanation VARCHAR, nominal_width_evidence VARCHAR[]);
        INSERT INTO door VALUES ('D1', 'Single', 's1', 0.9, NULL, NULL, ['e1']),
            ('D2', 'Double', 's2', NULL, 'NotObserved', 'no width in the source', ['e2']);
        CREATE TABLE roof (net_surface_area DOUBLE, net_surface_area_reason VARCHAR);
        INSERT INTO roof VALUES (50.0, NULL), (NULL, 'NotObserved');
        CREATE TABLE evidence (id VARCHAR, origin VARCHAR, method VARCHAR, explanation VARCHAR);
        INSERT INTO evidence VALUES ('e1', 'Source', 'Mapped', 'OverallWidth'), ('e2', 'Source', 'Unavailable', 'no width');
        CREATE TABLE source_document (id VARCHAR, name VARCHAR);
        INSERT INTO source_document VALUES ('doc1', 'Snowdon-ARC.rvt');
        CREATE TABLE source_revision (id VARCHAR, document_id VARCHAR, exporter VARCHAR);
        INSERT INTO source_revision VALUES ('r1', 'doc1', 'Revit');
        CREATE TABLE source_object (source_revision_id VARCHAR, source_role VARCHAR);
        INSERT INTO source_object VALUES ('r1', 'Occurrence'), ('r1', 'Type');
        """;

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

    /// <summary>The database is a graph input, so one value runs the graph on another building:
    /// its default is the placeholder preparation rewrites, and the one duck.source reads it.</summary>
    [TestCaseSource(nameof(Graphs))]
    public void DeclaresAModelInputHoldingItsPlaceholder(CatalogGraph entry)
    {
        var input = entry.Graph.Inputs.Single();
        var sources = entry.Graph.Nodes.Where(n => n.Kind == "duck.source").ToList();
        Assert.Multiple(() =>
        {
            Assert.That(input.Name, Is.EqualTo(ModelInput));
            Assert.That(input.Kind, Is.EqualTo(ParamKind.FilePath));
            Assert.That(input.Default, Is.EqualTo(entry.Placeholder));
            Assert.That(sources.Select(n => entry.Graph.Values[n.Id]["path"]), Is.EqualTo(new[] { "$" + ModelInput }));
            Assert.That(entry.Graph.Values.Values.SelectMany(p => p.Values).Where(v => v.Contains("DUCKDB}")), Is.Empty);
        });
    }

    /// <summary>The page arranges a graph on opening, but Download and other editors use the
    /// stored layout: the database sits at (20, 30) and every wire runs left to right.</summary>
    [TestCaseSource(nameof(Graphs))]
    public void LayoutRunsLeftToRightFromTheDatabase(CatalogGraph entry)
    {
        var layout = entry.Graph.Layout;
        Assert.That((layout["database"].X, layout["database"].Y), Is.EqualTo((20.0, 30.0)));
        Assert.That(entry.Graph.Edges.Where(e => layout[e.FromRef.NodeId].X >= layout[e.ToRef.NodeId].X)
            .Select(e => $"{e.From} -> {e.To}"), Is.Empty);
    }

    [TestCaseSource(nameof(SnowdonGraphs))]
    public void Snowdon_EvaluatesEveryNodeOkOverTheSnowdonShape(CatalogGraph entry)
        => AssertEveryNodeOk(entry, Evaluate(entry, SnowdonShapedDuckDb));

    [Test]
    public void Snowdon_RoomDistribution_NumbersSharedStoreyNamesAndKeepsUnplacedRooms()
    {
        var answer = Answer("duckdb-room-distribution", SnowdonShapedDuckDb);
        Assert.That(answer.Column("Level"), Is.EqualTo(new object?[]
            { "Level 1 · 1", "Level 1 · 2", "Roof", "(no storey reference)" }));
        Assert.That(answer.Column("Rooms").Select(Convert.ToInt64), Is.EqualTo(new long[] { 1, 1, 1, 1 }));
    }

    [Test]
    public void Snowdon_MissingWidths_KeepsOnlyDoorsWithoutAWidth()
        => Assert.That(Answer("duckdb-missing-widths", SnowdonShapedDuckDb).Column("Mark"), Is.EqualTo(new object?[] { "D2" }));

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
        Assert.That(answer.Column("WidthStatus").Count(v => (string?)v == "No OverallWidth in the file"), Is.EqualTo(101));
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

    /// <summary>The model input swaps the building without editing the graph: the duplex's
    /// door types differ from Schependomlaan's.</summary>
    [Test]
    public void Public_DoorTypes_RunsOnAnotherBuildingThroughTheModelInput()
    {
        var duplex = RepoPaths.PublicDuckDb("duplex");
        if (!File.Exists(duplex))
            Assert.Ignore($"{duplex} is absent; run `node deps.mjs` to fetch bim-open-data");
        var entry = ReadCatalog().Single(g => g.Id == "public-door-types");
        var snapshot = SampleSeeding.RewritePaths(entry.Graph, entry.Placeholder, PublicDuckDb)
            .Evaluate(HostComposition.TablePacks(), new Dictionary<string, string> { [ModelInput] = duplex });
        var answer = AnswerOf(entry, snapshot);
        Assert.That(answer.Rows, Is.Not.Empty);
        Assert.That(answer.Cell("DoorType", 0), Is.Not.EqualTo("32_KD_berkvens_BA"));
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
        return AnswerOf(entry, EvaluatePublic(entry));
    }

    private static IDataTable Answer(string id, string database)
    {
        var entry = ReadCatalog().Single(g => g.Id == id);
        return AnswerOf(entry, Evaluate(entry, database));
    }

    private static IDataTable AnswerOf(CatalogGraph entry, EvalSnapshot snapshot)
    {
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
