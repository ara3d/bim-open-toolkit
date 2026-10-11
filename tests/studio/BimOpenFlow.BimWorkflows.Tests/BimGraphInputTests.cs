using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.BimAnalysis;
using BimOpenFlow.Studio;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>TKT-204: bim-discipline-mix declares a `model` input held by its value.path node, so
/// one value swaps the building and every reader re-evaluates (workflow 1: run it on my model).
/// The default is the generated sample.bos; the swap is a public sample building from bim-open-data.</summary>
[TestFixture]
public sealed class BimGraphInputTests
{
    private const string Id = "bim-discipline-mix";
    private const string Public = "duplex";

    private string _dir = null!;
    private GraphDocument _doc = null!;

    [OneTimeSetUp]
    public void GenerateSampleAndLoadGraph()
    {
        _dir = Path.Combine(Path.GetTempPath(), "bimopenflow-graph-input", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);
        Ara3D.BimOpenSchema.IO.ParquetUtils.WriteToParquetZip(
            BimSampleModel.Build(), new FilePath(Path.Combine(_dir, "sample.bos")));
        _doc = SampleSeeding.RewritePaths(
            GraphDocumentIO.Load(RepoPaths.Samples("bim-analyses", Id + ".json")), _dir);
    }

    [OneTimeTearDown]
    public void DeleteSampleData()
    {
        try { Directory.Delete(_dir, recursive: true); }
        catch (IOException) { }
    }

    private static string PublicBos
        => RepoPaths.Deps("bim-open-data", "samples", "public", Public + ".bos");

    /// <summary>Evaluates the graph with the given input values: the element count and the
    /// per-discipline counts the chart-ready table ranks.</summary>
    private (int Elements, Dictionary<string, long> ByDiscipline) Evaluate(IReadOnlyDictionary<string, string> graphInputs)
    {
        var snapshot = _doc.Evaluate(StudioComposition.BimPacks(), graphInputs);
        var failed = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(failed, Is.Empty);
        var elements = ((TableValue)snapshot.Results["elements"].Outputs[0]).Table.Rows.Count;
        var ranked = ((TableValue)snapshot.Results["ranked"].Outputs[0]).Table;
        var byDiscipline = Enumerable.Range(0, ranked.Rows.Count)
            .ToDictionary(i => (string)ranked.Cell("Discipline", i)!, i => Convert.ToInt64(ranked.Cell("Elements", i)));
        return (elements, byDiscipline);
    }

    [Test]
    public void DeclaresAModelInput_HeldByTheValuePathNode()
    {
        var input = _doc.Inputs.Single();
        Assert.Multiple(() =>
        {
            Assert.That(input.Name, Is.EqualTo("model"));
            Assert.That(input.Kind, Is.EqualTo(ParamKind.FilePath));
            Assert.That(input.Default, Is.EqualTo(Path.Combine(_dir, "sample.bos").Replace(Path.DirectorySeparatorChar, '/')));
            Assert.That(_doc.Values["model"]["path"], Is.EqualTo("$model"));
        });
    }

    [Test]
    public void SwappingTheModel_GivesDifferentNumbers()
    {
        Assume.That(File.Exists(PublicBos), $"{Public}.bos is not fetched (node deps.mjs)");
        var generated = Evaluate(new Dictionary<string, string>());
        var named = Evaluate(new Dictionary<string, string> { ["model"] = PublicBos });
        TestContext.Out.WriteLine($"elements: generated sample.bos {generated.Elements} "
            + $"({string.Join(", ", generated.ByDiscipline)}); public {Public}.bos {named.Elements} "
            + $"({string.Join(", ", named.ByDiscipline)})");
        Assert.Multiple(() =>
        {
            Assert.That(generated.Elements, Is.GreaterThan(0));
            Assert.That(named.Elements, Is.GreaterThan(generated.Elements));
            Assert.That(generated.ByDiscipline.Values.Sum(), Is.EqualTo(generated.Elements));
            Assert.That(named.ByDiscipline.Values.Sum(), Is.EqualTo(named.Elements));
            Assert.That(named.ByDiscipline.Keys, Is.Not.EquivalentTo(generated.ByDiscipline.Keys));
        });
    }
}
