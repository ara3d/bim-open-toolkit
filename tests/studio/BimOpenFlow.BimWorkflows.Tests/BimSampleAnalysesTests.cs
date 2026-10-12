using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.BimAnalysis;
using BimOpenToolkit.TestSupport;
using BimOpenFlow.Studio;

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
        => RepoPaths.Samples("bim-analyses");

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
        Assert.That(doc.Validate(StudioComposition.BimPacks()), Is.Empty);
    }

    /// <summary>TKT-259: every graph runs on another building by one value. It declares a FilePath
    /// input `model`, one value.path node `model` holds `$model`, and every file-path parameter
    /// that can take a wire takes it from that node and stores no stale literal of its own.</summary>
    [TestCaseSource(nameof(SampleFiles))]
    public void DeclaresAModelInput_WiredIntoEveryReader(string file)
    {
        var doc = GraphDocumentIO.Load(file);
        var registry = StudioComposition.BimPacks();
        var readers = doc.Nodes
            .Where(n => n.Kind != "value.path")
            .SelectMany(n => (registry.Find(n.Kind, n.Version)?.Spec.Params ?? [])
                .Where(p => p.Kind == ParamKind.FilePath && p.Bindable is not null)
                .Select(p => (Node: n.Id, Param: p.Name)))
            .ToList();
        Assert.Multiple(() =>
        {
            Assert.That(doc.Inputs.Select(i => (i.Name, i.Kind)), Is.EqualTo(new[] { ("model", ParamKind.FilePath) }));
            Assert.That(doc.FindNode("model")?.Kind, Is.EqualTo("value.path"));
            Assert.That(doc.Values["model"]["path"], Is.EqualTo("$model"));
            Assert.That(readers, Is.Not.Empty);
            foreach (var (node, param) in readers)
            {
                Assert.That(doc.Edges.Any(e => e.From == "model.path" && e.To == $"{node}.{param}"),
                    $"{node}.{param} is not wired from model.path");
                Assert.That(doc.Values.GetValueOrDefault(node)?.ContainsKey(param) ?? false, Is.False,
                    $"{node}.{param} stores a literal the wire overrides");
            }
        });
    }

    /// <summary>TKT-259: every graph explains itself in an `about` note and ends in a titled
    /// view.table named `answer`, the table a person or Claude reads first.</summary>
    [TestCaseSource(nameof(SampleFiles))]
    public void HasAnAboutNoteAndATitledAnswer(string file)
    {
        var doc = GraphDocumentIO.Load(file);
        Assert.Multiple(() =>
        {
            Assert.That(doc.FindNode("about")?.Kind, Is.EqualTo("view.note"));
            Assert.That(doc.FindNode("answer")?.Kind, Is.EqualTo("view.table"));
            Assert.That(doc.Values.GetValueOrDefault("answer")?.GetValueOrDefault("title"), Is.Not.Null.And.Not.Empty);
            Assert.That(doc.Edges.Any(e => e.FromRef.NodeId == "answer"), Is.False, "answer feeds another node");
        });
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void Evaluates_EveryNodeOk(string file)
    {
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(file), _dir);
        var session = new FlowTestSession(StudioComposition.BimPacks());
        var snapshot = session.Evaluate(doc);
        var failed = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(failed, Is.Empty, $"Nodes not Ok in {Path.GetFileName(file)}");
    }
}
