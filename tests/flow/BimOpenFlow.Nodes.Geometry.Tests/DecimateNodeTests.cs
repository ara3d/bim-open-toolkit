using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class DecimateNodeTests
{
    private static readonly DecimateNode Node = new();

    /// <summary>Rows are axis-aligned boxes at the origin, one per size triple.</summary>
    private static TableValue Boxes(params (long Id, double X, double Y, double Z)[] rows)
        => Table(
            ("entityId", typeof(long), [.. rows.Select(r => (object?)r.Id)]),
            ("minX", typeof(double), [.. rows.Select(_ => (object?)0.0)]),
            ("minY", typeof(double), [.. rows.Select(_ => (object?)0.0)]),
            ("minZ", typeof(double), [.. rows.Select(_ => (object?)0.0)]),
            ("maxX", typeof(double), [.. rows.Select(r => (object?)r.X)]),
            ("maxY", typeof(double), [.. rows.Select(r => (object?)r.Y)]),
            ("maxZ", typeof(double), [.. rows.Select(r => (object?)r.Z)]));

    [Test]
    public void KeepFractionOne_KeepsAllRowsInOrder()
    {
        var boxes = Boxes((1, 1, 1, 1), (2, 3, 3, 3), (3, 2, 2, 2));

        var result = Node.EvalTable([boxes], ("keepFraction", "1"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 2L, 3L }));
    }

    [Test]
    public void KeepFractionZero_KeepsNothing()
    {
        var boxes = Boxes((1, 1, 1, 1), (2, 2, 2, 2));

        var result = Node.EvalTable([boxes], ("keepFraction", "0"));

        Assert.That(result.ColumnCells("entityId"), Is.Empty);
    }

    [Test]
    public void NanKeepFraction_WarnsAndUsesDefault()
    {
        var boxes = Boxes((1, 1, 1, 1), (2, 4, 4, 4), (3, 2, 2, 2), (4, 3, 3, 3));

        var (result, warnings) = Node.EvalWithWarnings([boxes], ("keepFraction", "NaN"));

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 2L }));
    }

    [Test]
    public void KeepsLargestByVolume_PreservingOriginalRowOrder()
    {
        var boxes = Boxes((1, 3, 3, 3), (2, 1, 1, 1), (3, 2, 2, 2));

        var result = Node.EvalTable([boxes], ("keepFraction", "0.5"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 3L }));
    }

    [Test]
    public void MinDiagonal_DropsSmallRowsBeforeTheFractionApplies()
    {
        var boxes = Boxes((1, 0.1, 0.1, 0.1), (2, 5, 5, 5), (3, 4, 4, 4));

        var result = Node.EvalTable([boxes], ("keepFraction", "1"), ("minDiagonal", "1"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 2L, 3L }));
    }

    [Test]
    public void EqualVolumes_TieGoesToLowerRowIndex()
    {
        var boxes = Boxes((1, 2, 2, 2), (2, 2, 2, 2), (3, 2, 2, 2));

        var result = Node.EvalTable([boxes], ("keepFraction", "0.5"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 2L }));
    }

    [Test]
    public void KeepCount_IsCeilingOfFractionTimesRemaining()
    {
        var boxes = Boxes((1, 1, 1, 1), (2, 2, 2, 2), (3, 3, 3, 3));

        var result = Node.EvalTable([boxes], ("keepFraction", "0.4"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 2L, 3L }));
    }

    [Test]
    public void NegativeExtent_ClampsVolumeToZero_ButDiagonalStillCounts()
    {
        var boxes = Boxes((1, -2, 2, 2), (2, 1, 1, 1));

        var result = Node.EvalTable([boxes], ("keepFraction", "0.5"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 2L }));
    }

    [Test]
    public void KeepFractionOutOfRange_WarnsAndClamps()
    {
        var boxes = Boxes((1, 1, 1, 1), (2, 2, 2, 2));

        var (result, warnings) = Node.EvalWithWarnings([boxes], ("keepFraction", "2"));

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 2L }));
    }

    [Test]
    public void MissingBoundsColumn_Throws()
    {
        var noBounds = Table(("entityId", typeof(long), [1L]));

        Assert.Throws<ArgumentException>(() => Node.EvalTable([noBounds], ("keepFraction", "1")));
    }
}
