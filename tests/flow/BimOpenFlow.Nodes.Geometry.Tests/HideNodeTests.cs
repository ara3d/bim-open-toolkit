using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class HideNodeTests
{
    private static readonly HideNode Node = new();

    private static TableValue Instances(params long[] entityIds)
        => Table(("entityId", typeof(long), [.. entityIds.Cast<object?>()]));

    [Test]
    public void MatchedRows_AreRemoved()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table(("entityId", typeof(long), [2L]));

        var result = Node.EvalTable([instances, ids], ("joinColumn", "entityId"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 3L }));
    }

    [Test]
    public void IdsWithoutSameNamedColumn_MatchOnFirstColumn()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table(("someOtherName", typeof(long), [1L, 3L]));

        var result = Node.EvalTable([instances, ids], ("joinColumn", "entityId"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 2L }));
    }

    [Test]
    public void EmptyIds_KeepsAllRows()
    {
        var instances = Instances(1, 2);
        var ids = Table(("entityId", typeof(long), []));

        var result = Node.EvalTable([instances, ids], ("joinColumn", "entityId"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L, 2L }));
    }

    [Test]
    public void TextIdsMatchNumericInstances_ViaCanonicalText()
    {
        var instances = Instances(1, 2);
        var ids = Table(("entityId", typeof(string), ["2"]));

        var result = Node.EvalTable([instances, ids], ("joinColumn", "entityId"));

        Assert.That(result.ColumnCells("entityId"), Is.EqualTo(new object[] { 1L }));
    }

    [Test]
    public void MissingJoinColumn_Throws()
    {
        var instances = Instances(1);
        var ids = Table(("entityId", typeof(long), [1L]));

        Assert.Throws<ArgumentException>(
            () => Node.EvalTable([instances, ids], ("joinColumn", "nope")));
    }
}
