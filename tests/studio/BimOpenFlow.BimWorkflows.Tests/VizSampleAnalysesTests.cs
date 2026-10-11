using System.Text.Json;
using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;
using BimOpenFlow.Host;
using BimOpenToolkit.TestSupport;
using BimOpenFlow.Studio;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>
/// Every committed visualization demo (samples/viz-analyses/*.json) parses, validates
/// against the bim profile registry, evaluates all-green with {SAMPLES} pointed at
/// samples/nrc, explains itself in a view.note, and has a Vega-Lite spec for its figure
/// at samples/viz-analyses/specs/&lt;id&gt;.vl.json. The git-ignored files the graphs read
/// (duplex-enriched.bos, duplex-enriched.duckdb, duplex-base.duckdb) are built from the
/// committed IFCs the way the studio prepares them (NrcPreparation), once, when missing or stale.
/// </summary>
[TestFixture]
public sealed class VizSampleAnalysesTests
{
    public static string AnalysesDir
        => RepoPaths.Samples("viz-analyses");

    public static IEnumerable<TestCaseData> SampleFiles
        => Directory.EnumerateFiles(AnalysesDir, "*.json")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetArgDisplayNames(Path.GetFileNameWithoutExtension(f)));

    /// <summary>Builds every NRC sample file the studio would prepare in the background that is
    /// missing or older than its IFC; about 30 s per file when cold.</summary>
    public static void PrepareSamples()
    {
        foreach (var job in NrcPreparation.Jobs(RepoPaths.Root))
            if (!job.IsCurrent)
                job.Run();
    }

    [OneTimeSetUp]
    public void PrepareNrcSamples()
        => PrepareSamples();

    private static GraphDocument Load(string file)
        => SampleSeeding.RewritePaths(GraphDocumentIO.Load(file), NrcSamples.Dir(RepoPaths.Root));

    [Test]
    public void ThereAreAtLeastTenDemos()
        => Assert.That(SampleFiles.Count(), Is.GreaterThanOrEqualTo(10));

    [Test]
    public void SampleFileNames_AreValidAnalysisIds()
        => Assert.That(
            SampleFiles.Select(t => Path.GetFileNameWithoutExtension((string)t.Arguments[0]!)),
            Has.All.Matches<string>(BimOpenFlow.Host.Store.AnalysisId.IsValid));

    [TestCaseSource(nameof(SampleFiles))]
    public void ParsesAndValidates(string file)
    {
        var doc = GraphDocumentIO.Load(file);
        Assert.That(doc.Nodes, Is.Not.Empty);
        Assert.That(doc.Validate(StudioComposition.BimPacks()), Is.Empty);
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void ExplainsItself_InANote(string file)
        => Assert.That(GraphDocumentIO.Load(file).Nodes.Select(n => n.Kind), Has.Member("view.note"));

    [TestCaseSource(nameof(SampleFiles))]
    public void HasAVegaLiteSpec(string file)
    {
        var spec = Path.Combine(AnalysesDir, "specs", Path.GetFileNameWithoutExtension(file) + ".vl.json");
        Assert.That(File.Exists(spec), Is.True, $"missing {spec}");
        using var json = JsonDocument.Parse(File.ReadAllText(spec));
        Assert.That(json.RootElement.GetProperty("$schema").GetString(), Does.Contain("vega-lite"));
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void Evaluates_EveryNodeOk(string file)
    {
        var session = new FlowTestSession(StudioComposition.BimPacks());
        var snapshot = session.Evaluate(Load(file));
        var failed = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(failed, Is.Empty, $"Nodes not Ok in {Path.GetFileName(file)}");
    }
}
