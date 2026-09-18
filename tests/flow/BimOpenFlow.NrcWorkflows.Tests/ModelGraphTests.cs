using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The model-backed graphs in samples/nrc-analyses: each document validates against the
/// bim-profile registry plus the rel.* pack, evaluates green, and its answer node reproduces the
/// numbers the NRC paper published. Every asserted number cites
/// nrc-ifc-llm/poc/results/expected_answers.json, poc/data/nrc_analytics_storeys.csv, or the
/// committed copies of those files under samples/nrc.
/// The database comes from <see cref="Fixture"/>, built from samples/nrc/duplex-enriched.ifc.</summary>
[TestFixture]
public sealed class ModelGraphTests
{
    private const double Tolerance = 0.05;

    private static RelationRuntime Runtime => Fixture.Runtime;

    private static GraphDocument Document(string id)
        => GraphDocumentIO.Load(NrcPaths.Graph(id));

    /// <summary>Validates and evaluates the document, asserting that every node reached Ok.</summary>
    private static EvalSnapshot EvaluateGreen(GraphDocument doc, string id, NodeRegistry registry)
    {
        Assert.That(doc.Validate(registry), Is.Empty, id);
        var snapshot = doc.Evaluate(registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, id);
        return snapshot;
    }

    /// <summary>The rows of the answer node, whether it carries a Relation or an ordinary Table.</summary>
    private static IDataTable AnswerRows(EvalSnapshot snapshot, RelationRuntime runtime)
        => snapshot.Results["answer"].Outputs[0] switch
        {
            RelationValue relation => runtime.Materialize((Plan)relation.Payload!),
            TableValue table => table.Table,
            var other => throw new InvalidOperationException($"answer carries a {other.GetType().Name}"),
        };

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    [Test]
    public void StoreyOfElement_MatchesTheStoreyCsv()
    {
        var runtime = Runtime;
        var snapshot = EvaluateGreen(Document("nrc-storey-of-element"), "nrc-storey-of-element",
            Fixture.Registry(runtime));
        var answer = AnswerRows(snapshot, runtime);

        // nrc_analytics_storeys.csv has four storey rows (the fifth, "Building", is the whole model),
        // here in descending embodied carbon, which is also the order of expected_answers.json Q8.
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        Assert.That(answer.ColumnCells("StoreyName"),
            Is.EqualTo(new object?[] { "Level 1", "Level 2", "T/FDN", "Roof" }));

        // nrc_analytics_storeys.csv columns Elements and EmbodiedCarbon_A1A3_kgCO2e, row by row.
        Assert.That(answer.ColumnCells("Elements"), Is.EqualTo(new object?[] { 103L, 93L, 14L, 8L }));
        Assert.That(Number(answer, "Embodied", 0), Is.EqualTo(49451.2).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 1), Is.EqualTo(48696.8).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 2), Is.EqualTo(11761.3).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 3), Is.EqualTo(5821.0).Within(Tolerance));
    }
}
