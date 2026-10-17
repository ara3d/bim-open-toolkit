using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.Relations;
using BimOpenFlow.Relations;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// The CSV-backed nrc-q* flows' answers, checked against the same numbers
/// tests/studio/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs asserts (both cite
/// nrc-ifc-llm/poc/results/expected_answers.json). This project cannot reference that test
/// project's private literals directly, so the numbers are repeated here; a change to either
/// copy without the other is exactly the drift this duplication risks; it is a NUnit
/// assertion, not a table, because there is nowhere else this ticket's fence lets the
/// answer live as shared, importable data. The bim profile is used, since it seeds every
/// nrc-analyses graph (TablesProfile skips the bim-only ones, but every nrc-q* id here is
/// shared between both, per NrcSeedingTests.SharedIds).
/// </summary>
[TestFixture]
public sealed class NrcAnswerTests
{
    private const double Tolerance = 0.05;

    private static IDataTable Answer(string id)
    {
        var data = SampleFlowsFixture.Profile(SampleFlowsFixture.BimProfile);
        var snapshot = SampleFlowsFixture.Snapshot(SampleFlowsFixture.BimProfile, id);
        var result = snapshot.Results["answer"];
        Assert.That(result.Status, Is.EqualTo(NodeStatus.Ok), id);
        var plan = (Plan)((RelationValue)result.Outputs[0]).Payload!;
        return data.Runtime.Materialize(plan);
    }

    [Test]
    public void Q1_BuildingTotal()
    {
        var answer = Answer("nrc-q1-building-total");
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(Convert.ToDouble(answer.Cell("OperationalCarbon_kgCO2e_per_year", 0)), Is.EqualTo(37196.2).Within(Tolerance));
        Assert.That(answer.Cell("Elements", 0), Is.EqualTo(218L));
    }

    [Test]
    public void Q5_ByIfcClass()
    {
        var answer = Answer("nrc-q5-by-category");
        Assert.That(answer.Rows, Has.Count.EqualTo(14));
        Assert.That(answer.ColumnCells("IfcType").First(), Is.EqualTo("IFCWALLSTANDARDCASE"));
        Assert.That(answer.ColumnCells("IfcType").Last(), Is.EqualTo("IFCRAILING"));

        // The chart draws the same 14 totals, through rel.materialize.
        var chart = SampleFlowsFixture.Snapshot(SampleFlowsFixture.BimProfile, "nrc-q5-by-category").Results["chart"];
        Assert.That(chart.Status, Is.EqualTo(NodeStatus.Ok));
        Assert.That(((TableValue)chart.Outputs[0]).Table.Rows, Has.Count.EqualTo(14));
    }

    [Test]
    public void Q7_Absence()
    {
        var answer = Answer("nrc-q7-absence");
        // The analysed elements with no embodied-carbon row: only the roof, as a row, not
        // a zero (PROJECT.md principle 3, honest absence).
        Assert.That(answer.Rows, Has.Count.EqualTo(1));
        Assert.That(answer.Cell("GlobalId", 0), Is.EqualTo("0jf0rYHfX3RAB3bSIRjmxl"));
        Assert.That(answer.Cell("IfcClass", 0), Is.EqualTo("IFCROOF"));
        // The two metric rows it does have: operational carbon and energy use intensity.
        Assert.That(answer.Cell("OtherMetrics", 0), Is.EqualTo(2L));
    }

    [Test]
    public void Q8_PerStorey()
    {
        var answer = Answer("nrc-q8-per-storey");
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        Assert.That(answer.ColumnCells("Storey"),
            Is.EqualTo(new object?[] { "Level 1", "Level 2", "T/FDN", "Roof" }));
    }
}
