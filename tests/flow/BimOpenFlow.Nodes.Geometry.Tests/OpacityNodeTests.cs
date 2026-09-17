using Ara3D.DataFlowEngine.Abstractions;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class OpacityNodeTests
{
    private static readonly OpacityNode Node = new();

    private static TableValue Instances(params long[] entityIds)
        => Table(("entityId", typeof(long), [.. entityIds.Cast<object?>()]));

    [Test]
    public void MissingIds_EveryRowGetsAlpha_AndAColumnIsAppended()
    {
        var instances = Instances(1, 2);

        var result = Node.EvalTable([instances, MissingValue.Instance], ("alpha", "0.5"));

        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "entityId", "a" }));
        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 0.5, 0.5 }));
    }

    [Test]
    public void ScopeMatched_OnlyMatchedRowsGetAlpha_OthersDefaultToOne()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table(("entityId", typeof(long), [2L]));

        var result = Node.EvalTable([instances, ids],
            ("alpha", "0.25"), ("joinColumn", "entityId"), ("scope", "matched"));

        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 1.0, 0.25, 1.0 }));
    }

    [Test]
    public void ScopeOthers_NonMatchedRowsGetAlpha()
    {
        var instances = Instances(1, 2, 3);
        var ids = Table(("entityId", typeof(long), [2L]));

        var result = Node.EvalTable([instances, ids],
            ("alpha", "0.25"), ("joinColumn", "entityId"), ("scope", "others"));

        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 0.25, 1.0, 0.25 }));
    }

    [Test]
    public void ExistingAColumn_UnassignedRowsKeepValues_ColumnStaysInPlace()
    {
        var instances = Table(
            ("entityId", typeof(long), [1L, 2L]),
            ("a", typeof(double), [0.9, 0.8]),
            ("label", typeof(string), ["x", "y"]));
        var ids = Table(("entityId", typeof(long), [2L]));

        var result = Node.EvalTable([instances, ids],
            ("alpha", "0.1"), ("joinColumn", "entityId"), ("scope", "matched"));

        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "entityId", "a", "label" }));
        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 0.9, 0.1 }));
        Assert.That(result.ColumnCells("label"), Is.EqualTo(new object[] { "x", "y" }));
    }

    [Test]
    public void EmptyIds_ScopeMatched_NoRowChanges()
    {
        var instances = Instances(1, 2);
        var ids = Table(("entityId", typeof(long), []));

        var result = Node.EvalTable([instances, ids],
            ("alpha", "0.25"), ("joinColumn", "entityId"), ("scope", "matched"));

        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 1.0, 1.0 }));
    }

    [Test]
    public void IdsWithoutSameNamedColumn_MatchOnFirstColumn()
    {
        var instances = Instances(1, 2);
        var ids = Table(("someOtherName", typeof(long), [1L]));

        var result = Node.EvalTable([instances, ids],
            ("alpha", "0.25"), ("joinColumn", "entityId"), ("scope", "matched"));

        Assert.That(result.ColumnCells("a"), Is.EqualTo(new object[] { 0.25, 1.0 }));
    }

    [Test]
    public void MissingJoinColumn_WithIds_Throws()
    {
        var instances = Instances(1);
        var ids = Table(("entityId", typeof(long), [1L]));

        Assert.Throws<ArgumentException>(
            () => Node.EvalTable([instances, ids], ("alpha", "0.25"), ("joinColumn", "nope")));
    }
}
