using Ara3D.DataFlowEngine.Abstractions;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.nearest on small in-memory tables: nearest key + distance, tie
/// breaking, null propagation, empty b, custom column params, and collisions.</summary>
[TestFixture]
public sealed class BimNearestNodeTests
{
    private static readonly BimNearestNode Node = new();

    private static TableValue Rows(params (string Name, object? X, object? Y, object? Z)[] rows)
        => NodeTestHelpers.Table(
            ("Name", typeof(string), rows.Select(r => (object?)r.Name).ToArray()),
            ("CenterX", typeof(double), rows.Select(r => r.X).ToArray()),
            ("CenterY", typeof(double), rows.Select(r => r.Y).ToArray()),
            ("CenterZ", typeof(double), rows.Select(r => r.Z).ToArray()));

    [Test]
    public void NearestRow_GetsKeyAndDistance()
    {
        var t = Node.EvalTable(
            [
                Rows(("P1", 0.0, 0.0, 0.0)),
                Rows(("B1", 1.0, 0.0, 0.0), ("B2", 3.0, 4.0, 0.0)),
            ]);
        Assert.That(t.ColumnNames(),
            Is.EqualTo(new[] { "Name", "CenterX", "CenterY", "CenterZ", "Nearest", "Distance" }));
        Assert.That(t.Cell("Nearest", 0), Is.EqualTo("B1"));
        Assert.That((double)t.Cell("Distance", 0)!, Is.EqualTo(1.0).Within(1e-12));
    }

    [Test]
    public void Distance_IsEuclidean3d()
    {
        var t = Node.EvalTable(
            [Rows(("P1", 0.0, 0.0, 0.0)), Rows(("B1", 1.0, 2.0, 2.0))]);
        Assert.That((double)t.Cell("Distance", 0)!, Is.EqualTo(3.0).Within(1e-12));
    }

    [Test]
    public void ExactTie_FirstRowOfBWins()
    {
        var t = Node.EvalTable(
            [
                Rows(("P1", 0.0, 0.0, 0.0)),
                Rows(("First", 1.0, 0.0, 0.0), ("Second", -1.0, 0.0, 0.0)),
            ]);
        Assert.That(t.Cell("Nearest", 0), Is.EqualTo("First"));
        Assert.That((double)t.Cell("Distance", 0)!, Is.EqualTo(1.0).Within(1e-12));
    }

    [Test]
    public void EmptyB_YieldsNulls()
    {
        var t = Node.EvalTable([Rows(("P1", 0.0, 0.0, 0.0)), Rows()]);
        Assert.That(t.Cell("Nearest", 0), Is.Null);
        Assert.That(t.Cell("Distance", 0), Is.Null);
    }

    [Test]
    public void NullCoordinateInA_YieldsNulls()
    {
        var t = Node.EvalTable(
            [
                Rows(("P1", null, 0.0, 0.0), ("P2", 0.0, 0.0, 0.0)),
                Rows(("B1", 1.0, 0.0, 0.0)),
            ]);
        Assert.That(t.Cell("Nearest", 0), Is.Null);
        Assert.That(t.Cell("Distance", 0), Is.Null);
        Assert.That(t.Cell("Nearest", 1), Is.EqualTo("B1"));
    }

    [Test]
    public void CustomColumnParams_AreHonoured()
    {
        var a = NodeTestHelpers.Table(
            ("Px", typeof(double), [0.0]),
            ("Py", typeof(double), [0.0]),
            ("Pz", typeof(double), [0.0]));
        var b = NodeTestHelpers.Table(
            ("Label", typeof(string), ["Near", "Far"]),
            ("Qx", typeof(double), [2.0, 9.0]),
            ("Qy", typeof(double), [0.0, 0.0]),
            ("Qz", typeof(double), [0.0, 0.0]));
        var t = Node.EvalTable([a, b],
            ("x", "Px"), ("y", "Py"), ("z", "Pz"),
            ("bx", "Qx"), ("by", "Qy"), ("bz", "Qz"),
            ("key", "Label"), ("as", "ClosestLabel"));
        Assert.That(t.Cell("ClosestLabel", 0), Is.EqualTo("Near"));
        Assert.That((double)t.Cell("Distance", 0)!, Is.EqualTo(2.0).Within(1e-12));
    }

    [Test]
    public void AsColumnCollision_Throws()
        => Assert.That(
            () => Node.EvalTable(
                [Rows(("P1", 0.0, 0.0, 0.0)), Rows(("B1", 1.0, 0.0, 0.0))],
                ("as", "Name")),
            Throws.ArgumentException
                .With.Message.Contains(BimNearestNode.Kind).And.Message.Contains("Name"));

    [Test]
    public void DistanceColumnCollision_Throws()
    {
        var a = NodeTestHelpers.Table(
            ("CenterX", typeof(double), [0.0]),
            ("CenterY", typeof(double), [0.0]),
            ("CenterZ", typeof(double), [0.0]),
            ("Distance", typeof(double), [0.0]));
        Assert.That(
            () => Node.EvalTable([a, Rows(("B1", 1.0, 0.0, 0.0))]),
            Throws.ArgumentException
                .With.Message.Contains(BimNearestNode.Kind).And.Message.Contains("Distance"));
    }
}
