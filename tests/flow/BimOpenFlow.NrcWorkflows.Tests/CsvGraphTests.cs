using System.Runtime.CompilerServices;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The nrc-q* graphs over samples/nrc: each document validates, evaluates green,
/// and its answer node materializes to the numbers the NRC paper published. Every
/// asserted number cites nrc-ifc-llm/poc/results/expected_answers.json by question key,
/// or poc/data/nrc_analytics_storeys.csv by row.
/// The registry is built here rather than taken from Fixture so these tests do not
/// depend on the DuckDB build (track A).</summary>
[TestFixture]
public sealed class CsvGraphTests
{
    private const double Tolerance = 0.05;

    /// <summary>The repo root found from this source file, not from the test output folder:
    /// the wave builds with --artifacts-path, which puts the output outside the checkout.</summary>
    private static readonly string Root = SampleSeeding.FindRepoRoot(Path.GetDirectoryName(SourceFile())!)
        ?? throw new InvalidOperationException("BimOpenToolkit.sln not found above " + SourceFile());

    private static string SourceFile([CallerFilePath] string path = "") => path;

    private static string GraphFile(string id)
        => Path.Combine(SampleSeeding.NrcAnalyses(Root).AnalysesDir, id + ".json");

    private static readonly RelationRuntime Runtime =
        RelationRuntime.FromRoots([SampleSeeding.NrcSamplesDir(Root)]);

    private static readonly NodeRegistry Registry =
        NodeRegistry.Combine(HostComposition.AllPacks().Nodes, RelationNodes.All(Runtime));

    /// <summary>Loads the graph, asserts it validates and evaluates green, and returns the
    /// rows of its answer relation.</summary>
    private static IDataTable Answer(string id)
    {
        var doc = GraphDocumentIO.Load(GraphFile(id));
        Assert.That(doc.Validate(Registry), Is.Empty, id);
        var snapshot = doc.Evaluate(Registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Error}"), Is.Empty, id);
        var output = snapshot.Results["answer"].Outputs[0];
        return Runtime.Materialize((Plan)((RelationValue)output).Payload!);
    }

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    [Test]
    public void Q1_BuildingTotal()
    {
        var answer = Answer("nrc-q1-building-total");
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        // expected_answers.json Q1: 37196.2 kgCO2e/yr over the 218 rows of nrc_analytics_elements.csv.
        Assert.That(Number(answer, "Total", 0), Is.EqualTo(37196.2).Within(Tolerance));
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(218L));
    }
}
