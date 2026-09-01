using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class BoundingBoxesNodeTests
{
    private static readonly BoundingBoxesNode Node = new();

    private static (string, Type, object?[])[] Bounds(params double[][] rows)
    {
        var names = new[] { "minX", "minY", "minZ", "maxX", "maxY", "maxZ" };
        return names.Select((name, c) =>
            (name, typeof(double), rows.Select(r => (object?)r[c]).ToArray())).ToArray();
    }

    private static double[] Row(double minX, double minY, double minZ, double maxX, double maxY, double maxZ)
        => [minX, minY, minZ, maxX, maxY, maxZ];

    [Test]
    public void PerRow_OneBoxPerRow_LabelFromGlobalId()
    {
        var instances = Table(Bounds(Row(0, 1, 2, 3, 4, 5), Row(10, 11, 12, 13, 14, 15))
            .Append(("globalId", typeof(string), ["g1", "g2"])).ToArray());

        var result = Node.EvalTable([instances]);

        Assert.That(result.Name, Is.EqualTo("boxes"));
        Assert.That(result.Rows, Has.Count.EqualTo(2));
        Assert.That(result.ColumnCells("label"), Is.EqualTo(new[] { "g1", "g2" }));
        Assert.That(result.Cell("minX", 0), Is.EqualTo(0.0));
        Assert.That(result.Cell("maxZ", 1), Is.EqualTo(15.0));
    }

    [Test]
    public void PerRow_LabelFallsBackToInstanceIndex()
    {
        var instances = Table(Bounds(Row(0, 0, 0, 1, 1, 1))
            .Append(("instanceIndex", typeof(long), [7L])).ToArray());

        Assert.That(Node.EvalTable([instances]).Cell("label", 0), Is.EqualTo("7"));
    }

    [Test]
    public void PerRow_LabelFallsBackToRowNumber()
    {
        var instances = Table(Bounds(Row(0, 0, 0, 1, 1, 1), Row(2, 2, 2, 3, 3, 3)));

        Assert.That(Node.EvalTable([instances]).ColumnCells("label"), Is.EqualTo(new[] { "0", "1" }));
    }

    [Test]
    public void PerRow_CarriesColorsWhenAllFourPresent()
    {
        var instances = Table(Bounds(Row(0, 0, 0, 1, 1, 1))
            .Append(("r", typeof(double), [0.1]))
            .Append(("g", typeof(double), [0.2]))
            .Append(("b", typeof(double), [0.3]))
            .Append(("a", typeof(double), [0.4])).ToArray());

        var result = Node.EvalTable([instances]);

        Assert.That(result.Cell("r", 0), Is.EqualTo(0.1));
        Assert.That(result.Cell("g", 0), Is.EqualTo(0.2));
        Assert.That(result.Cell("b", 0), Is.EqualTo(0.3));
        Assert.That(result.Cell("a", 0), Is.EqualTo(0.4));
    }

    [Test]
    public void PerRow_PartialColorColumns_OmitsColors()
    {
        var instances = Table(Bounds(Row(0, 0, 0, 1, 1, 1))
            .Append(("r", typeof(double), [0.1]))
            .Append(("g", typeof(double), [0.2]))
            .Append(("b", typeof(double), [0.3])).ToArray());

        Assert.That(Node.EvalTable([instances]).ColumnNames(), Has.None.AnyOf("r", "g", "b", "a"));
    }

    [Test]
    public void Grouped_UnionBoundsPerSortedGroup()
    {
        var instances = Table(Bounds(
                Row(5, 5, 5, 6, 6, 6),
                Row(0, 1, 2, 3, 4, 5),
                Row(-1, 2, 1, 2, 9, 4))
            .Append(("category", typeof(string), ["wall", "door", "door"])).ToArray());

        var result = Node.EvalTable([instances], ("groupColumn", "category"));

        Assert.That(result.ColumnCells("label"), Is.EqualTo(new[] { "door", "wall" }));
        Assert.That(result.Cell("minX", 0), Is.EqualTo(-1.0));
        Assert.That(result.Cell("minY", 0), Is.EqualTo(1.0));
        Assert.That(result.Cell("minZ", 0), Is.EqualTo(1.0));
        Assert.That(result.Cell("maxX", 0), Is.EqualTo(3.0));
        Assert.That(result.Cell("maxY", 0), Is.EqualTo(9.0));
        Assert.That(result.Cell("maxZ", 0), Is.EqualTo(5.0));
        Assert.That(result.Cell("maxX", 1), Is.EqualTo(6.0));
    }

    [Test]
    public void Grouped_NullValues_GroupedUnderNoneAfterSorted()
    {
        var instances = Table(Bounds(
                Row(0, 0, 0, 1, 1, 1),
                Row(2, 2, 2, 3, 3, 3),
                Row(4, 4, 4, 5, 5, 5))
            .Append(("category", typeof(string), ["b", null, "a"])).ToArray());

        var result = Node.EvalTable([instances], ("groupColumn", "category"));

        Assert.That(result.ColumnCells("label"), Is.EqualTo(new[] { "a", "b", "(none)" }));
        Assert.That(result.Cell("minX", 2), Is.EqualTo(2.0));
        Assert.That(result.Cell("maxX", 2), Is.EqualTo(3.0));
    }

    [Test]
    public void Grouped_ColorFromFirstRowOfGroup()
    {
        var instances = Table(Bounds(Row(0, 0, 0, 1, 1, 1), Row(2, 2, 2, 3, 3, 3))
            .Append(("category", typeof(string), ["x", "x"]))
            .Append(("r", typeof(double), [0.1, 0.9]))
            .Append(("g", typeof(double), [0.2, 0.9]))
            .Append(("b", typeof(double), [0.3, 0.9]))
            .Append(("a", typeof(double), [1.0, 0.5])).ToArray());

        var result = Node.EvalTable([instances], ("groupColumn", "category"));

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(result.Cell("r", 0), Is.EqualTo(0.1));
        Assert.That(result.Cell("a", 0), Is.EqualTo(1.0));
    }

    [Test]
    public void MissingBoundsColumn_Throws()
    {
        var instances = Table(("minX", typeof(double), [0.0]));

        Assert.Throws<ArgumentException>(() => Node.Eval(Ctx, [instances], Params()));
    }
}
