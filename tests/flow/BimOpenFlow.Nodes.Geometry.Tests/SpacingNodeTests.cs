using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class SpacingNodeTests
{
    private static readonly SpacingNode Node = new();

    private static TableValue Grouped(params object?[] categories)
        => Table(("category", typeof(string), categories));

    private static object?[] Boxed(params double[] values)
        => Array.ConvertAll(values, v => (object?)v);

    [Test]
    public void GroupsOrderedBySortedCanonicalText()
    {
        var result = Node.EvalTable([Grouped("b", "a", "a", "c")],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 10.0, 0, 0, 20 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { 0.0, 0, 0, 0 }));
        Assert.That(result.ColumnCells("offsetZ"), Is.EqualTo(new[] { 0.0, 0, 0, 0 }));
    }

    [Test]
    public void AxisSelectsOffsetColumn()
    {
        var result = Node.EvalTable([Grouped("a", "b")],
            ("groupColumn", "category"), ("axis", "z"), ("spacing", "7"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 0 }));
        Assert.That(result.ColumnCells("offsetY"), Is.EqualTo(new[] { 0.0, 0 }));
        Assert.That(result.ColumnCells("offsetZ"), Is.EqualTo(new[] { 0.0, 7 }));
    }

    [Test]
    public void ChainedEvalsAccumulateOffsets()
    {
        var first = Node.EvalTable([Grouped("a", "b")],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));
        var second = Node.EvalTable([new TableValue(first)],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "5"));

        Assert.That(second.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 15 }));
        Assert.That(second.ColumnNames(), Is.EqualTo(first.ColumnNames()));
    }

    [Test]
    public void ShiftsBoundsWhenAllSixPresent()
    {
        var table = Table(
            ("category", typeof(string), ["a", "b"]),
            ("minX", typeof(double), Boxed(0, 1)),
            ("minY", typeof(double), Boxed(2, 3)),
            ("minZ", typeof(double), Boxed(4, 5)),
            ("maxX", typeof(double), Boxed(6, 7)),
            ("maxY", typeof(double), Boxed(8, 9)),
            ("maxZ", typeof(double), Boxed(10, 11)));

        var result = Node.EvalTable([table],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.ColumnCells("minX"), Is.EqualTo(new[] { 0.0, 11 }));
        Assert.That(result.ColumnCells("maxX"), Is.EqualTo(new[] { 6.0, 17 }));
        Assert.That(result.ColumnCells("minY"), Is.EqualTo(new[] { 2.0, 3 }));
        Assert.That(result.ColumnCells("maxY"), Is.EqualTo(new[] { 8.0, 9 }));
        Assert.That(result.ColumnCells("minZ"), Is.EqualTo(new[] { 4.0, 5 }));
        Assert.That(result.ColumnCells("maxZ"), Is.EqualTo(new[] { 10.0, 11 }));
    }

    [Test]
    public void PartialBoundsColumns_NotShifted_OffsetsStillEmitted()
    {
        var table = Table(
            ("category", typeof(string), ["a", "b"]),
            ("minX", typeof(double), Boxed(0, 1)),
            ("maxX", typeof(double), Boxed(2, 3)));

        var result = Node.EvalTable([table],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.ColumnCells("minX"), Is.EqualTo(new[] { 0.0, 1 }));
        Assert.That(result.ColumnCells("maxX"), Is.EqualTo(new[] { 2.0, 3 }));
        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 10 }));
    }

    [Test]
    public void NullGroupRows_GetNoOffset()
    {
        var result = Node.EvalTable([Grouped(null, "b", "a")],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 10, 0 }));
    }

    [Test]
    public void SingleGroup_AllOffsetsZero()
    {
        var result = Node.EvalTable([Grouped("a", "a", "a")],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.ColumnCells("offsetX"), Is.EqualTo(new[] { 0.0, 0, 0 }));
    }

    [Test]
    public void EmptyTable_AppendsOffsetColumns()
    {
        var result = Node.EvalTable([Grouped()],
            ("groupColumn", "category"), ("axis", "x"), ("spacing", "10"));

        Assert.That(result.Rows, Is.Empty);
        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "category", "offsetX", "offsetY", "offsetZ" }));
    }

    [Test]
    public void ColumnOrderPreserved_NewOffsetsAppendedXyz()
    {
        var table = Table(
            ("entityId", typeof(long), [1L, 2L]),
            ("category", typeof(string), ["a", "b"]));

        var result = Node.EvalTable([table],
            ("groupColumn", "category"), ("axis", "y"), ("spacing", "10"));

        Assert.That(result.ColumnNames(),
            Is.EqualTo(new[] { "entityId", "category", "offsetX", "offsetY", "offsetZ" }));
        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new[] { 1L, 2L }));
    }

    [Test]
    public void MissingGroupColumn_Throws()
        => Assert.Throws<ArgumentException>(() => Node.EvalTable([Grouped("a")],
            ("groupColumn", "nope"), ("axis", "x"), ("spacing", "10")));
}
