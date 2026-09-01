using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimHopsNodeTests
{
    // Chain A-B-C plus the isolated pair D-E.
    private static TableValue ChainEdges() => NodeTestHelpers.Table(
        (BimColumns.FromRoom, typeof(string), ["A", "B", "D"]),
        (BimColumns.ToRoom, typeof(string), ["B", "C", "E"]));

    [Test]
    public void Chain_FromA_CountsHops_NullsForUnreachable()
    {
        var table = new BimHopsNode().EvalTable([ChainEdges()], ("start", "A"));
        Assert.That(table.ColumnNames(), Is.EqualTo(new[] { BimColumns.Room, BimColumns.Hops }));
        Assert.That(table.ColumnCells(BimColumns.Room), Is.EqualTo(new[] { "A", "B", "C", "D", "E" }));
        Assert.That(table.ColumnCells(BimColumns.Hops), Is.EqualTo(new object?[] { 0L, 1L, 2L, null, null }));
    }

    [Test]
    public void Start_InToColumn_Works()
    {
        var table = new BimHopsNode().EvalTable([ChainEdges()], ("start", "C"));
        Assert.That(table.ColumnCells(BimColumns.Room), Is.EqualTo(new[] { "C", "B", "A", "D", "E" }));
        Assert.That(table.ColumnCells(BimColumns.Hops), Is.EqualTo(new object?[] { 0L, 1L, 2L, null, null }));
    }

    [Test]
    public void UnknownStart_Throws()
    {
        var ex = Assert.Throws<ArgumentException>(() =>
            new BimHopsNode().EvalTable([ChainEdges()], ("start", "Nowhere")));
        Assert.That(ex!.Message, Does.Contain(BimHopsNode.Kind).And.Contain("Nowhere"));
    }

    [Test]
    public void CustomColumnNames_Work()
    {
        var edges = NodeTestHelpers.Table(
            ("src", typeof(string), ["A", "B"]),
            ("dst", typeof(string), ["B", "C"]));
        var table = new BimHopsNode().EvalTable([edges],
            ("from", "src"), ("to", "dst"), ("start", "A"));
        Assert.That(table.ColumnCells(BimColumns.Room), Is.EqualTo(new[] { "A", "B", "C" }));
        Assert.That(table.ColumnCells(BimColumns.Hops), Is.EqualTo(new object?[] { 0L, 1L, 2L }));
    }

    [Test]
    public void NavGraphEdges_FromCorridor102_ReachLevel1AndOutsideOnly()
    {
        var edges = new BimNavGraphNode().SampleTable();
        var table = new BimHopsNode().EvalTable([new TableValue(edges)], ("start", "Corridor 102"));
        Assert.That(table.ColumnCells(BimColumns.Room), Is.EqualTo(new[]
        {
            "Corridor 102",
            "Kitchen 103", "Office 101", BimColumns.Outside, "WC 104",
            "Corridor 202", "Meeting Room 201",
        }));
        Assert.That(table.ColumnCells(BimColumns.Hops),
            Is.EqualTo(new object?[] { 0L, 1L, 1L, 1L, 1L, null, null }));
    }
}
