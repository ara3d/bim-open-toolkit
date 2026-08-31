using Ara3D.DataFlowEngine.Abstractions;
using static BimOpenFlow.Nodes.Geometry.Tests.TestSupport;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class IsolateNodeTests
{
    private static readonly IsolateNode Node = new();
    private static readonly ParamValues JoinOnEntityId = Params(("joinColumn", "entityId"));

    [Test]
    public void KeepsOnlyMatchingRows()
    {
        var instances = Instances(10, 20, 30, 40);
        var ids = Table("ids", ("entityId", new long[] { 20, 40 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(ids)], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(2));
        Assert.That(Cell(result, "entityId", 0), Is.EqualTo(20L));
        Assert.That(Cell(result, "entityId", 1), Is.EqualTo(40L));
    }

    [Test]
    public void JoinsAcrossTypes_ByCanonicalText()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table("ids", ("entityId", new[] { "2" }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(ids)], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(Cell(result, "entityId", 0), Is.EqualTo(2L));
    }

    [Test]
    public void IdsTableWithoutJoinColumn_UsesFirstColumn()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table("ids", ("selection", new long[] { 3 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(ids)], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(Cell(result, "entityId", 0), Is.EqualTo(3L));
    }

    [Test]
    public void KeepsColumnSchema()
    {
        var instances = Instances(1, 2);
        var ids = Table("ids", ("entityId", new long[] { 1 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(ids)], JoinOnEntityId);

        Assert.That(ColumnNames(result), Is.EqualTo(ColumnNames(instances)));
    }
}
