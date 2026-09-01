using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class ArrangeNodeTests
{
    private static readonly ArrangeNode Node = new();

    private static object?[] Boxed(params double[] values)
        => Array.ConvertAll(values, v => (object?)v);

    private static TableValue Bounded(object?[] categories,
        double[] minX, double[] minY, double[] minZ, double[] maxX, double[] maxY, double[] maxZ)
        => Table(
            ("category", typeof(string), categories),
            ("minX", typeof(double), Boxed(minX)),
            ("minY", typeof(double), Boxed(minY)),
            ("minZ", typeof(double), Boxed(minZ)),
            ("maxX", typeof(double), Boxed(maxX)),
            ("maxY", typeof(double), Boxed(maxY)),
            ("maxZ", typeof(double), Boxed(maxZ)));

    [Test]
    public void SingleGroup_MovesUnionMinToOrigin_ZUnchanged()
    {
        var table = Bounded(["a", "a"],
            minX: [2, 3], minY: [3, 4], minZ: [1, 0],
            maxX: [4, 6], maxY: [5, 7], maxZ: [2, 1]);

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "5"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { -2.0, -2 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { -3.0, -3 }));
        Assert.That(result.ColumnCells("offsetZ"), Is.EqualTo(new[] { 0.0, 0 }));
        Assert.That(result.ColumnCells("minX"), Is.EqualTo(new[] { 0.0, 1 }));
        Assert.That(result.ColumnCells("minY"), Is.EqualTo(new[] { 0.0, 1 }));
        Assert.That(result.ColumnCells("maxX"), Is.EqualTo(new[] { 2.0, 4 }));
        Assert.That(result.ColumnCells("maxY"), Is.EqualTo(new[] { 2.0, 4 }));
        Assert.That(result.ColumnCells("minZ"), Is.EqualTo(new[] { 1.0, 0 }));
        Assert.That(result.ColumnCells("maxZ"), Is.EqualTo(new[] { 2.0, 1 }));
    }

    [Test]
    public void TwoGroups_CellSizeIsLargestExtentPlusGap()
    {
        var table = Bounded(["a", "b"],
            minX: [1, 10], minY: [0, 10], minZ: [0, 0],
            maxX: [5, 12], maxY: [2, 16], maxZ: [1, 1]);

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "5"));

        // cellW = max extent X (4) + 5 = 9; cellH = max extent Y (6) + 5 = 11; cols = 2.
        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { -1.0, -1 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { 0.0, -10 }));
        Assert.That(result.ColumnCells("offsetZ"), Is.EqualTo(new[] { 0.0, 0 }));
    }

    [Test]
    public void FiveGroups_PlacedInThreeColumnGrid()
    {
        var table = Bounded(["a", "b", "c", "d", "e"],
            minX: [0, 0, 0, 0, 0], minY: [0, 0, 0, 0, 0], minZ: [0, 0, 0, 0, 0],
            maxX: [1, 1, 1, 1, 1], maxY: [1, 1, 1, 1, 1], maxZ: [1, 1, 1, 1, 1]);

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "0"));

        // cellW = cellH = 1; cols = ceil(sqrt(5)) = 3.
        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 1, 2, 0, 1 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { 0.0, 0, 0, 1, 1 }));
        Assert.That(result.ColumnCells("offsetZ"), Is.EqualTo(new[] { 0.0, 0, 0, 0, 0 }));
    }

    [Test]
    public void MissingBoundsColumns_Throws()
    {
        var table = Table(("category", typeof(string), ["a", "b"]));

        Assert.Throws<ArgumentException>(
            () => Node.EvalTable([table], ("groupColumn", "category"), ("gap", "5")));
    }

    [Test]
    public void NullGroupRows_StayInPlace()
    {
        var table = Bounded([null, "a"],
            minX: [7, 5], minY: [8, 5], minZ: [0, 0],
            maxX: [9, 6], maxY: [9, 6], maxZ: [1, 1]);

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "0"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, -5 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { 0.0, -5 }));
        Assert.That(result.ColumnCells("minX"), Is.EqualTo(new[] { 7.0, 0 }));
        Assert.That(result.ColumnCells("maxX"), Is.EqualTo(new[] { 9.0, 1 }));
    }

    [Test]
    public void AccumulatesOntoExistingOffsetColumn_KeptInPlace()
    {
        var table = Table(
            ("offsetX", typeof(double), Boxed(100, 100)),
            ("category", typeof(string), ["a", "b"]),
            ("minX", typeof(double), Boxed(1, 3)),
            ("minY", typeof(double), Boxed(0, 0)),
            ("minZ", typeof(double), Boxed(0, 0)),
            ("maxX", typeof(double), Boxed(2, 4)),
            ("maxY", typeof(double), Boxed(1, 1)),
            ("maxZ", typeof(double), Boxed(1, 1)));

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "0"));

        // cellW = 1, cols = 2: a -> -1, b -> 1 - 3 = -2; added onto the existing 100s.
        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 99.0, 98 }));
        Assert.That(result.ColumnNames(), Is.EqualTo(new[]
            { "offsetX", "category", "minX", "minY", "minZ", "maxX", "maxY", "maxZ", "offsetY", "offsetZ" }));
    }

    [Test]
    public void EmptyTable_AppendsOffsetColumns()
    {
        var table = Bounded([], minX: [], minY: [], minZ: [], maxX: [], maxY: [], maxZ: []);

        var result = Node.EvalTable([table], ("groupColumn", "category"), ("gap", "5"));

        Assert.That(result.Rows, Is.Empty);
        Assert.That(result.ColumnNames(), Is.EqualTo(new[]
            { "category", "minX", "minY", "minZ", "maxX", "maxY", "maxZ", "offsetX", "offsetY", "offsetZ" }));
    }
}
