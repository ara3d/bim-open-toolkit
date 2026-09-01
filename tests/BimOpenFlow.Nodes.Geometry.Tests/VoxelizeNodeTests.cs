using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class VoxelizeNodeTests
{
    private static readonly VoxelizeNode Node = new();

    private static TableValue Instances(params double[][] rows)
    {
        var names = new[] { "minX", "minY", "minZ", "maxX", "maxY", "maxZ" };
        return Table(names.Select((name, c) =>
            (name, typeof(double), rows.Select(r => (object?)r[c]).ToArray())).ToArray());
    }

    private static double[] Row(double minX, double minY, double minZ, double maxX, double maxY, double maxZ)
        => [minX, minY, minZ, maxX, maxY, maxZ];

    [Test]
    public void SmallInstance_OneVoxel_CountOne()
    {
        var result = Node.EvalTable([Instances(Row(2, 3, 4, 4, 5, 6))], ("size", "10"));

        Assert.That(result.Name, Is.EqualTo("boxes"));
        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(result.Cell("count", 0), Is.EqualTo(1L));
        Assert.That(result.Cell("voxelId", 0), Is.EqualTo("0,0,0"));
        Assert.That(result.Cell("minX", 0), Is.EqualTo(2.0));
        Assert.That(result.Cell("minY", 0), Is.EqualTo(3.0));
        Assert.That(result.Cell("minZ", 0), Is.EqualTo(4.0));
        Assert.That(result.Cell("maxX", 0), Is.EqualTo(12.0));
        Assert.That(result.Cell("maxY", 0), Is.EqualTo(13.0));
        Assert.That(result.Cell("maxZ", 0), Is.EqualTo(14.0));
    }

    [Test]
    public void InstanceSpanningMultipleCells_MarksAllOverlappedCells()
    {
        var result = Node.EvalTable([Instances(Row(0, 0, 0, 2.5, 2.5, 2.5))], ("size", "1"));

        Assert.That(result.Rows, Has.Count.EqualTo(27));
        Assert.That(result.ColumnCells("count"), Is.All.EqualTo(1L));
        Assert.That(result.Cell("voxelId", 0), Is.EqualTo("0,0,0"));
        Assert.That(result.Cell("minX", 0), Is.EqualTo(0.0));
        Assert.That(result.Cell("maxX", 0), Is.EqualTo(1.0));
        Assert.That(result.Cell("voxelId", 26), Is.EqualTo("2,2,2"));
        Assert.That(result.Cell("minZ", 26), Is.EqualTo(2.0));
        Assert.That(result.Cell("maxZ", 26), Is.EqualTo(3.0));
    }

    [Test]
    public void OverlappingInstances_CountTwoInSharedCells()
    {
        var result = Node.EvalTable(
            [Instances(Row(0, 0, 0, 0.9, 0.9, 0.9), Row(0.5, 0, 0, 1.5, 0.9, 0.9))],
            ("size", "1"));

        Assert.That(result.ColumnCells("voxelId"), Is.EqualTo(new[] { "0,0,0", "1,0,0" }));
        Assert.That(result.ColumnCells("count"), Is.EqualTo(new[] { 2L, 1L }));
    }

    [Test]
    public void Ordering_IsZThenYThenX()
    {
        var result = Node.EvalTable([Instances(Row(0, 0, 0, 1.5, 1.5, 1.5))], ("size", "1"));

        Assert.That(result.ColumnCells("voxelId"), Is.EqualTo(new[]
        {
            "0,0,0", "1,0,0", "0,1,0", "1,1,0",
            "0,0,1", "1,0,1", "0,1,1", "1,1,1",
        }));
    }

    [Test]
    public void NonPositiveSize_Throws()
    {
        var instances = Instances(Row(0, 0, 0, 1, 1, 1));

        Assert.Throws<ArgumentException>(() => Node.Eval(Ctx, [instances], Params(("size", "0"))));
        Assert.Throws<ArgumentException>(() => Node.Eval(Ctx, [instances], Params(("size", "-2"))));
    }

    [Test]
    public void GridOverMaxVoxels_CoarsensSizeAndWarns()
    {
        var instances = Instances(
            Row(0, 0, 0, 1, 1, 1),
            Row(999, 999, 999, 1000, 1000, 1000));

        var (result, warnings) = Node.EvalWithWarnings([instances], ("size", "0.1"));

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(warnings[0], Does.Contain("0.1").And.Contain("12.8"));
        Assert.That(result.Rows, Has.Count.LessThanOrEqualTo(VoxelizeNode.MaxVoxels));
        Assert.That(result.Cell("voxelId", 0), Is.EqualTo("0,0,0"));
        Assert.That(result.ColumnCells("count"), Is.All.EqualTo(1L));
    }
}
