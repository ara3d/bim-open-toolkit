using Ara3D.DataFlowEngine.TestKit;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;
using static BimOpenFlow.Nodes.Geometry.Tests.GeometryTestData;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class IsolateNodeTests
{
    private static readonly IsolateNode Node = new();
    private static readonly (string Name, string Value)[] JoinOnEntityId = [("joinColumn", "entityId")];

    [Test]
    public void KeepsOnlyMatchingRows()
    {
        var ids = Table(("entityId", new long[] { 20, 40 }));

        var result = Node.EvalTable([Instances(10, 20, 30, 40), ids], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(2));
        Assert.That(result.Cell("entityId", 0), Is.EqualTo(20L));
        Assert.That(result.Cell("entityId", 1), Is.EqualTo(40L));
    }

    [Test]
    public void JoinsAcrossTypes_ByCanonicalText()
    {
        var ids = Table(("entityId", new[] { "2" }));

        var result = Node.EvalTable([Instances(1, 2, 3), ids], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(result.Cell("entityId", 0), Is.EqualTo(2L));
    }

    [Test]
    public void IdsTableWithoutJoinColumn_UsesFirstColumn()
    {
        var ids = Table(("selection", new long[] { 3 }));

        var result = Node.EvalTable([Instances(1, 2, 3), ids], JoinOnEntityId);

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(result.Cell("entityId", 0), Is.EqualTo(3L));
    }

    [Test]
    public void KeepsColumnSchema()
    {
        var instances = Instances(1, 2);
        var ids = Table(("entityId", new long[] { 1 }));

        var result = Node.EvalTable([instances, ids], JoinOnEntityId);

        Assert.That(result.ColumnNames(), Is.EqualTo(instances.Table.ColumnNames()));
    }
}
