using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Studio;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The graphs in samples/checking-analyses, the ids.* and bcf.* packs over samples/nrc:
/// each validates against the bim-profile registry, evaluates green (bcf.write pending until
/// Run), and gives the numbers below. The Duplex .bos the graphs load is built from
/// duplex-enriched.ifc into samples/nrc the way the host prepares it (NrcPreparation.Bos), so
/// the {SAMPLES} paths stay as seeded. DC-W1 numbers cite samples/nrc/door_verdicts.csv (8 pass,
/// 6 fail); the carbon numbers cite nrc_analytics_elements.csv (218 analysed elements).</summary>
[TestFixture]
public sealed class CheckingGraphTests
{
    private static readonly string Dir = Path.Combine(NrcPaths.Root, "samples", "checking-analyses");

    /// <summary>The Duplex roof's GlobalId, the element nrc-q7-absence also answers with.</summary>
    private const string RoofGlobalId = "0jf0rYHfX3RAB3bSIRjmxl";

    private static readonly string[] Ids =
    [
        "check-ids-door-width", "check-ids-specifications", "check-ids-carbon-psets",
        "bcf-from-ids-failures", "bcf-from-sql", "bcf-read-colour",
    ];

    /// <summary>samples/nrc/duplex-enriched.bos, rebuilt from the IFC when its stamp is stale.</summary>
    private static readonly Lazy<string> DuplexBos = new(() =>
    {
        var job = NrcPreparation.Bos(NrcPaths.Root) ?? throw new FileNotFoundException(NrcPaths.Ifc);
        if (!job.IsCurrent)
            job.Run();
        return job.Output;
    });

    private static GraphDocument Document(string id)
    {
        _ = DuplexBos.Value;
        return SampleSeeding.RewritePaths(GraphDocumentIO.Load(Path.Combine(Dir, id + ".json")), NrcPaths.SamplesDir);
    }

    private static IDataTable Table(EvalSnapshot snapshot, string nodeId, int output = 0)
        => ((TableValue)snapshot.Results[nodeId].Outputs[output]).Table;

    private static GraphDocument WithParam(GraphDocument doc, string nodeId, string name, string value)
        => doc with
        {
            Values = doc.Values.ToDictionary(
                node => node.Key,
                node => node.Key != nodeId
                    ? node.Value
                    : node.Value.ToDictionary(p => p.Key, p => p.Key == name ? value : p.Value)),
        };

    private static string TempBcf(string name)
        => Path.Combine(Path.GetTempPath(), "bof-checking", Guid.NewGuid().ToString("N"), name).Replace('\\', '/');

    [Test]
    public void EverySampleIsListedHere_AndEveryIdIsASample()
        => Assert.That(Directory.EnumerateFiles(Dir, "*.json").Select(Path.GetFileNameWithoutExtension), Is.EquivalentTo(Ids));

    [TestCaseSource(nameof(Ids))]
    public void ParsesAndValidates(string id)
    {
        var doc = GraphDocumentIO.Load(Path.Combine(Dir, id + ".json"));
        Assert.That(doc.Nodes, Is.Not.Empty);
        Assert.That(doc.Validate(StudioComposition.BimPacks()), Is.Empty);
        Assert.That(doc.Nodes.Select(n => n.Id), Does.Contain("answer"), "every graph ends in a node named answer");
    }

    /// <summary>A graph that reads the Duplex reads it from one value.path, modelPath, holding the
    /// graph input model, so a user swaps the building in one place. check-ids-door-width also
    /// declares geometry, the IFC its 3D scene reads, because view3d.instances meshes IFC only.</summary>
    [TestCaseSource(nameof(Ids))]
    public void TheModelPathIsOneGraphInput(string id)
    {
        var doc = GraphDocumentIO.Load(Path.Combine(Dir, id + ".json"));
        var literals = doc.Values.SelectMany(node => node.Value.Values).Where(v => v.Contains("duplex-enriched"));
        Assert.That(literals, Is.Empty, "no node types the model path");
        if (id == "check-ids-specifications")
            return;
        var scene = id == "check-ids-door-width";
        Assert.That(doc.Inputs.Select(i => i.Name), Is.EquivalentTo(scene ? new[] { "model", "geometry" } : new[] { "model" }));
        Assert.That(doc.Nodes.Where(n => n.Kind == "value.path").Select(n => n.Id),
            Is.EquivalentTo(scene ? new[] { "modelPath", "scenePath" } : new[] { "modelPath" }));
        Assert.That(doc.Values["modelPath"]["path"], Is.EqualTo("$model"));
    }

    [Test]
    public void DoorWidth_EightPassSixFail_ChartedAndColoured()
    {
        var snapshot = ModelGraphTests.EvaluateGreen(Document("check-ids-door-width"), "check-ids-door-width", Fixture.Registry(Fixture.Runtime));
        var verdicts = Table(snapshot, "verdicts");
        var summary = Table(snapshot, "verdicts", 1);
        var chart = Table(snapshot, "chart");
        var answer = Table(snapshot, "answer");
        Assert.Multiple(() =>
        {
            Assert.That(verdicts.Rows, Has.Count.EqualTo(14), "one row per IFCDOOR");
            Assert.That(answer.ColumnNames(), Is.EqualTo(new[] { "Name", "Verdict", "Reason", "GlobalId" }));
            Assert.That(answer.Rows, Has.Count.EqualTo(14));
            Assert.That(answer.ColumnCells("Name"), Has.None.Null, "every door is named from the entity table");
            Assert.That(verdicts.ColumnCells("Verdict").Count(v => Equals(v, "Pass")), Is.EqualTo(8));
            Assert.That(verdicts.ColumnCells("Verdict").Count(v => Equals(v, "Fail")), Is.EqualTo(6));
            Assert.That(summary.Rows, Has.Count.EqualTo(1));
            Assert.That(summary.Cell("Pass", 0), Is.EqualTo(8L));
            Assert.That(chart.ColumnNames(), Is.EqualTo(new[] { "Verdict", "Doors" }));
            Assert.That(chart.Cell("Verdict", 0), Is.EqualTo("Pass"));
            Assert.That(Convert.ToInt64(chart.Cell("Doors", 1)), Is.EqualTo(6));
            Assert.That(Table(snapshot, "coloured").Rows, Is.Not.Empty);
        });
    }

    [Test]
    public void Specifications_ListBothFiles()
    {
        var snapshot = ModelGraphTests.EvaluateGreen(Document("check-ids-specifications"), "check-ids-specifications", Fixture.Registry(Fixture.Runtime));
        Assert.That(Table(snapshot, "carbon").ColumnCells("CheckId"), Is.EqualTo(new object?[] { "IDS-OC", "IDS-EC" }));
        Assert.That(Table(snapshot, "carbon").ColumnCells("Supported"), Has.All.EqualTo(true));
        Assert.That(Table(snapshot, "doors").Cell("CheckTitle", 0), Is.EqualTo("Door leaf width at least 850 mm"));
        Assert.That(Table(snapshot, "doors").ColumnCells("Supported"), Has.All.EqualTo(true));
    }

    [Test]
    public void CarbonPsets_EveryAnalysedElementPasses_ButOneEmbodiedValue()
    {
        var snapshot = ModelGraphTests.EvaluateGreen(Document("check-ids-carbon-psets"), "check-ids-carbon-psets", Fixture.Registry(Fixture.Runtime));
        var summary = Table(snapshot, "verdicts", 1);
        var failures = Table(snapshot, "failures");
        var answer = Table(snapshot, "answer");
        Assert.Multiple(() =>
        {
            Assert.That(summary.ColumnCells("CheckId"), Is.EqualTo(new object?[] { "IDS-OC", "IDS-EC" }));
            Assert.That(summary.ColumnCells("Rows"), Is.EqualTo(new object?[] { 218L, 218L }), "the 218 analysed elements");
            Assert.That(summary.Cell("Pass", 0), Is.EqualTo(218L));
            // The enrichment wrote no embodied-carbon row for the roof (PROJECT.md principle 3,
            // honest absence; nrc-q7-absence answers the same question), so IDS-EC fails it.
            Assert.That(summary.Cell("Pass", 1), Is.EqualTo(217L));
            Assert.That(summary.Cell("Fail", 1), Is.EqualTo(1L));
            Assert.That(failures.Rows, Has.Count.EqualTo(1));
            Assert.That(failures.Cell("CheckId", 0), Is.EqualTo("IDS-EC"));
            Assert.That(failures.Cell("GlobalId", 0), Is.EqualTo(RoofGlobalId), "the roof, the one element with no embodied-carbon row");
            Assert.That(answer.ColumnNames(), Is.EqualTo(new[] { "GlobalId", "CheckId", "Reason" }));
            Assert.That(answer.Rows, Has.Count.EqualTo(1));
            Assert.That(Table(snapshot, "chart").ColumnNames(), Is.EqualTo(new[] { "CheckTitle", "Pass", "Fail", "InfoNotAvailable" }));
        });
    }

    [Test]
    public void BcfFromIdsFailures_PendingUntilRun_ThenOneTopicOfSixDoorsWithAViewpoint()
    {
        var path = TempBcf("dc-w1-failures.bcf");
        var doc = WithParam(Document("bcf-from-ids-failures"), "bcf", "path", path);
        var snapshot = ModelGraphTests.RunGreen(doc, "bcf-from-ids-failures", Fixture.Registry(Fixture.Runtime), "bcf");
        var topics = Table(snapshot, "topics");
        var written = Table(snapshot, "bcf");
        try
        {
            Assert.Multiple(() =>
            {
                Assert.That(topics.Rows, Has.Count.EqualTo(1), "one check, one topic");
                Assert.That(topics.Cell("Elements", 0), Is.EqualTo(6L));
                Assert.That(topics.Cell("Title", 0), Is.EqualTo("Door leaf width at least 850 mm"));
                Assert.That(File.Exists(path));
                Assert.That(written.Cell("topics", 0), Is.EqualTo(1L));
                Assert.That(written.Cell("viewpoints", 0), Is.EqualTo(1L), "the model gives the doors geometry");
                Assert.That(written.Cell("elements", 0), Is.EqualTo(6L));
                Assert.That(written.Cell("elementsWithoutGeometry", 0), Is.EqualTo(0L));
            });
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(path)!, recursive: true);
        }
    }

    [Test]
    public void BcfFromSql_ExternalDoorsBecomeOneTopic()
    {
        var path = TempBcf("external-doors.bcf");
        var doc = WithParam(Document("bcf-from-sql"), "bcf", "path", path);
        var snapshot = ModelGraphTests.RunGreen(doc, "bcf-from-sql", Fixture.Registry(Fixture.Runtime), "bcf");
        var doors = Table(snapshot, "sorted");
        var topics = Table(snapshot, "topics");
        try
        {
            Assert.Multiple(() =>
            {
                Assert.That(doors.Rows, Is.Not.Empty.And.Count.LessThan(14), "some, not all, Duplex doors are external");
                Assert.That(doors.ColumnNames(), Is.EqualTo(new[] { "Title", "Description", "Name", "GlobalId" }));
                Assert.That(topics.Rows, Has.Count.EqualTo(1));
                Assert.That(topics.Cell("Elements", 0), Is.EqualTo((long)doors.Rows.Count));
                Assert.That(Table(snapshot, "bcf").Cell("viewpoints", 0), Is.EqualTo(1L));
            });
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(path)!, recursive: true);
        }
    }

    [Test]
    public void BcfReadColour_TheCommittedBcf_ColoursSixDoors()
    {
        var snapshot = ModelGraphTests.EvaluateGreen(Document("bcf-read-colour"), "bcf-read-colour", Fixture.Registry(Fixture.Runtime));
        var issues = Table(snapshot, "issues");
        var answer = Table(snapshot, "answer");
        Assert.Multiple(() =>
        {
            Assert.That(issues.Rows, Has.Count.EqualTo(6));
            Assert.That(issues.ColumnCells("Title"), Has.All.EqualTo("Door leaf width at least 850 mm"));
            Assert.That(answer.Rows, Has.Count.EqualTo(1), "bcf.read's topics port, one row per topic");
            Assert.That(answer.Cell("Elements", 0), Is.EqualTo(6L));
            Assert.That(Table(snapshot, "coloured").Rows, Is.Not.Empty);
        });
    }

    /// <summary>Rewrites samples/nrc/bcf/dc-w1-failures.bcf, the file bcf-read-colour reads, from
    /// a Run of bcf-from-ids-failures. Run it after a deliberate change to the writer or the IDS.</summary>
    [Test, Explicit("writes into samples/nrc/bcf")]
    public void RegenerateTheCommittedBcf()
    {
        var path = Path.Combine(NrcPaths.SamplesDir, "bcf", "dc-w1-failures.bcf").Replace('\\', '/');
        var doc = WithParam(Document("bcf-from-ids-failures"), "bcf", "path", path);
        ModelGraphTests.RunGreen(doc, "bcf-from-ids-failures", Fixture.Registry(Fixture.Runtime), "bcf");
        Assert.That(File.Exists(path));
    }
}
