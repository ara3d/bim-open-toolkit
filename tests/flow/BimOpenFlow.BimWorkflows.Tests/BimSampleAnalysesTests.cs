using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>
/// Every committed BIM sample analysis (samples/bim-analyses/*.json) parses,
/// validates against the bim profile registry, and evaluates all-green over a
/// temp-dir sample.bos generated from BimSampleModel — the tests depend on no
/// committed binaries and never touch the real store.
/// </summary>
[TestFixture]
public sealed class BimSampleAnalysesTests
{
    private string _dir = null!;

    public static string AnalysesDir
        => Path.Combine(SampleSeeding.FindRepoRoot(TestContext.CurrentContext.TestDirectory)
            ?? throw new InvalidOperationException("repo root not found"), "samples", "bim-analyses");

    public static IEnumerable<TestCaseData> SampleFiles
        => Directory.EnumerateFiles(AnalysesDir, "*.json")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetArgDisplayNames(Path.GetFileNameWithoutExtension(f)));

    [OneTimeSetUp]
    public void SeedTempSampleData()
    {
        _dir = Path.Combine(Path.GetTempPath(), "bimopenflow-bim-analyses", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);
        Ara3D.BimOpenSchema.IO.ParquetUtils.WriteToParquetZip(
            BimSampleModel.Build(), new FilePath(Path.Combine(_dir, "sample.bos")));
    }

    [OneTimeTearDown]
    public void DeleteTempSampleData()
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
    public void ThereAreSampleAnalyses()
        => Assert.That(SampleFiles.Count(), Is.GreaterThanOrEqualTo(8));

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
        Assert.That(doc.Validate(HostComposition.AllPacks()), Is.Empty);
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void Evaluates_EveryNodeOk(string file)
    {
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(file), _dir);
        var session = new FlowTestSession(HostComposition.AllPacks());
        var snapshot = session.Evaluate(doc);
        var failed = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(failed, Is.Empty, $"Nodes not Ok in {Path.GetFileName(file)}");
    }
}
