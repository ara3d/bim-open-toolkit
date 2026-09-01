using Ara3D.DataTable;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimParamCoverageNodeTests
{
    private static readonly BimParamCoverageNode Node = new();

    private static IDataTable Profile(Ara3D.DataFlowEngine.Abstractions.FlowValue input)
        => Node.EvalTable([input]);

    [Test]
    public void CountsDistinctAndFillRate()
    {
        // 3 entities; A on all 3 with 2 distinct values; B on 2 rows (one null value).
        var input = NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [1L, 2L, 3L, 1L, 2L]),
            ("Name", typeof(string), ["A", "A", "A", "B", "B"]),
            ("Value", typeof(string), ["x", "x", "y", "v", null]));
        var table = Profile(input);

        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
            { "Name", "ParameterGroup", "ValueType", "Count", "Distinct", "FillRate" }));
        Assert.That(table.ColumnCells("Name"), Is.EqualTo(new[] { "A", "B" }));
        Assert.That(table.ColumnCells("Count"), Is.EqualTo(new object[] { 3L, 2L }));
        Assert.That(table.ColumnCells("Distinct"), Is.EqualTo(new object[] { 2L, 1L }));
        Assert.That((double)table.Cell("FillRate", 0)!, Is.EqualTo(1.0));
        Assert.That((double)table.Cell("FillRate", 1)!, Is.EqualTo(2.0 / 3.0));
        // Input had no ParameterGroup/ValueType columns: cells are null.
        Assert.That(table.ColumnCells("ParameterGroup"), Is.All.Null);
        Assert.That(table.ColumnCells("ValueType"), Is.All.Null);
    }

    [Test]
    public void Ordering_IsCountDescThenNameAsc()
    {
        var input = NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [1L, 2L, 1L, 2L, 3L]),
            ("Name", typeof(string), ["C", "C", "B", "B", "A"]),
            ("Value", typeof(string), ["1", "2", "3", "4", "5"]));
        Assert.That(Profile(input).ColumnCells("Name"), Is.EqualTo(new[] { "B", "C", "A" }));
    }

    [Test]
    public void BosLoadShapedInput_CarriesGroupAndValueType()
    {
        var input = NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [10L, 11L, 10L]),
            ("Name", typeof(string), ["Rvt:Room:Number", "Rvt:Room:Number", "Rvt:Room:Volume"]),
            ("ParameterGroup", typeof(string), ["Identity Data", "Identity Data", "Dimensions"]),
            ("Units", typeof(string), ["", "", "m3"]),
            ("ValueType", typeof(string), ["String", "String", "Number"]),
            ("Value", typeof(string), ["101", "102", "60"]));
        var table = Profile(input);

        Assert.That(table.ColumnCells("Name"),
            Is.EqualTo(new[] { "Rvt:Room:Number", "Rvt:Room:Volume" }));
        Assert.That(table.Cell("ParameterGroup", 0), Is.EqualTo("Identity Data"));
        Assert.That(table.Cell("ValueType", 0), Is.EqualTo("String"));
        Assert.That(table.Cell("ParameterGroup", 1), Is.EqualTo("Dimensions"));
        Assert.That(table.Cell("ValueType", 1), Is.EqualTo("Number"));
        Assert.That(table.ColumnCells("Count"), Is.EqualTo(new object[] { 2L, 1L }));
        Assert.That((double)table.Cell("FillRate", 0)!, Is.EqualTo(1.0));
        Assert.That((double)table.Cell("FillRate", 1)!, Is.EqualTo(0.5));
    }

    [Test]
    public void EmptyInput_YieldsNoRows()
    {
        var input = NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), []),
            ("Name", typeof(string), []),
            ("Value", typeof(string), []));
        Assert.That(Profile(input).ColumnCells("Name"), Is.Empty);
    }

    [Test]
    public void MissingRequiredColumn_Throws()
    {
        var input = NodeTestHelpers.Table(
            ("EntityIndex", typeof(long), [1L]),
            ("Name", typeof(string), ["A"]));
        var ex = Assert.Throws<ArgumentException>(() => Profile(input));
        Assert.That(ex!.Message, Does.Contain(BimParamCoverageNode.Kind));
    }
}
