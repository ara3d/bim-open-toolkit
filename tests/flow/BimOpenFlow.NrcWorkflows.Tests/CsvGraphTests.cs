using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Relations;
using NUnit.Framework.Constraints;

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

    private static readonly RelationRuntime Runtime =
        RelationRuntime.FromRoots([NrcPaths.SamplesDir]);

    private static readonly NodeRegistry Registry =
        HostComposition.AllPacks(Runtime);

    /// <summary>Loads the graph, asserts it validates and evaluates green, and returns the
    /// rows of its answer relation.</summary>
    private static IDataTable Answer(string id)
    {
        var doc = GraphDocumentIO.Load(NrcPaths.Graph(id));
        Assert.That(doc.Validate(Registry), Is.Empty, id);
        var snapshot = doc.Evaluate(Registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Error}"), Is.Empty, id);
        var output = snapshot.Results["answer"].Outputs[0];
        return Runtime.Materialize((Plan)((RelationValue)output).Payload!);
    }

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    private static IReadOnlyList<double> Numbers(IDataTable table, string column)
        => table.ColumnCells(column).Select(Convert.ToDouble).ToList();

    private static Constraint Near(params double[] expected)
        => Is.EqualTo(expected).Within(Tolerance);

    [Test]
    public void Q1_BuildingTotal()
    {
        var answer = Answer("nrc-q1-building-total");
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        // expected_answers.json Q1: 37196.2 kgCO2e/yr over the 218 rows of nrc_analytics_elements.csv.
        Assert.That(Number(answer, "Total", 0), Is.EqualTo(37196.2).Within(Tolerance));
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(218L));
    }

    [Test]
    public void Q8_PerStorey()
    {
        var answer = Answer("nrc-q8-per-storey");
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        // expected_answers.json Q8, in descending embodied carbon.
        Assert.That(answer.ColumnCells("Storey"),
            Is.EqualTo(new object?[] { "Level 1", "Level 2", "T/FDN", "Roof" }));
        Assert.That(Numbers(answer, "Embodied"), Near(49451.2, 48696.8, 11761.3, 5821.0));
        // nrc_analytics_storeys.csv row "Level 1": 103 elements; Q2: mean EUI 40.5.
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(103L));
        Assert.That(Number(answer, "MeanEui", 0), Is.EqualTo(40.5).Within(Tolerance));
    }

    [Test]
    public void Q3_TopElements()
    {
        var answer = Answer("nrc-q3-top-elements");
        Assert.That(answer.Rows, Has.Count.EqualTo(5));
        // expected_answers.json Q3, in the order it lists them.
        Assert.That(answer.ColumnCells("GlobalId"), Is.EqualTo(new object?[]
        {
            "0iEHWY1$XA8eQeeULq4jpl", "0jf0rYHfX3RAB3bSIRjmr1", "0iEHWY1$XA8eQeeULq4ien",
            "3Y4YRln2r91vflHcHE5IVT", "3Y4YRln2r91vflHcHE5IVS",
        }));
        Assert.That(Numbers(answer, "OperationalCarbon_kgCO2e_per_year"),
            Near(412.0, 410.8, 402.0, 399.7, 398.6));
    }

    [Test]
    public void Q5_ByCategory()
    {
        var answer = Answer("nrc-q5-by-category");
        Assert.That(answer.Rows, Has.Count.EqualTo(9));
        // expected_answers.json Q5, in descending total.
        Assert.That(answer.ColumnCells("Category"), Is.EqualTo(new object?[]
        {
            "Wall", "Floor", "Other", "Stair", "Finish", "Window", "Door", "Roof", "Railing",
        }));
        Assert.That(Numbers(answer, "Total"),
            Near(22854.1, 5593.5, 4313.1, 1144.2, 985.7, 978.9, 687.2, 474.7, 164.8));
    }

    [Test]
    public void Q7_Absence()
    {
        var answer = Answer("nrc-q7-absence");
        // expected_answers.json Q7: no embodied-carbon row was written for the roof, so the
        // answer is the roof itself, as a row. nrc_analytics_long.csv holds two metrics for
        // it, which the graph's aggregate collapses to one row per GlobalId.
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.ColumnNames(), Is.EqualTo(new[] { "GlobalId", "IfcClass" }));
        Assert.That(answer.Cell("GlobalId", 0), Is.EqualTo("0jf0rYHfX3RAB3bSIRjmxl"));
        Assert.That(answer.Cell("IfcClass", 0), Is.EqualTo("IFCROOF"));
    }
}
