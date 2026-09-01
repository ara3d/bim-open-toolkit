using Ara3D.DataFlowEngine.Abstractions;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.containment on small in-memory tables plus the sample-model
/// composition: door centers from bim.bounds against hand-built room boxes.</summary>
[TestFixture]
public sealed class BimContainmentNodeTests
{
    private static readonly BimContainmentNode Node = new();

    private static TableValue Points(params (string Name, object? X, object? Y, object? Z)[] rows)
        => NodeTestHelpers.Table(
            ("Name", typeof(string), rows.Select(r => (object?)r.Name).ToArray()),
            ("CenterX", typeof(double), rows.Select(r => r.X).ToArray()),
            ("CenterY", typeof(double), rows.Select(r => r.Y).ToArray()),
            ("CenterZ", typeof(double), rows.Select(r => r.Z).ToArray()));

    private static TableValue Boxes(
        params (string Name, double X0, double Y0, double Z0, double X1, double Y1, double Z1)[] rows)
        => NodeTestHelpers.Table(
            ("Name", typeof(string), rows.Select(r => (object?)r.Name).ToArray()),
            ("MinX", typeof(double), rows.Select(r => (object?)r.X0).ToArray()),
            ("MinY", typeof(double), rows.Select(r => (object?)r.Y0).ToArray()),
            ("MinZ", typeof(double), rows.Select(r => (object?)r.Z0).ToArray()),
            ("MaxX", typeof(double), rows.Select(r => (object?)r.X1).ToArray()),
            ("MaxY", typeof(double), rows.Select(r => (object?)r.Y1).ToArray()),
            ("MaxZ", typeof(double), rows.Select(r => (object?)r.Z1).ToArray()));

    [Test]
    public void PointInOneBox_GetsItsKey()
    {
        var t = Node.EvalTable(
            [Points(("P1", 1.0, 1.0, 1.0)), Boxes(("A", 0, 0, 0, 2, 2, 2))]);
        Assert.That(t.Cell("ContainedIn", 0), Is.EqualTo("A"));
        Assert.That(t.ColumnNames(), Is.EqualTo(new[] { "Name", "CenterX", "CenterY", "CenterZ", "ContainedIn" }));
        Assert.That(t.Cell("Name", 0), Is.EqualTo("P1"));
    }

    [Test]
    public void NestedBoxes_PickTheSmallestVolume()
    {
        var t = Node.EvalTable(
            [
                Points(("P1", 1.0, 1.0, 1.0)),
                Boxes(("Outer", 0, 0, 0, 10, 10, 10), ("Inner", 0, 0, 0, 2, 2, 2)),
            ]);
        Assert.That(t.Cell("ContainedIn", 0), Is.EqualTo("Inner"));
    }

    [Test]
    public void PointOutsideAllBoxes_IsNull()
    {
        var t = Node.EvalTable(
            [Points(("P1", 50.0, 50.0, 50.0)), Boxes(("A", 0, 0, 0, 2, 2, 2))]);
        Assert.That(t.Cell("ContainedIn", 0), Is.Null);
    }

    [Test]
    public void IgnoreZ_TestsPlanOnly_AndPicksSmallestFootprint()
    {
        var inputs = new FlowValue[]
        {
            Points(("P1", 1.0, 1.0, 50.0)),
            Boxes(("A", 0, 0, 0, 2, 2, 3), ("Wide", 0, 0, 0, 10, 10, 3)),
        };
        Assert.That(Node.EvalTable(inputs).Cell("ContainedIn", 0), Is.Null,
            "the 3D test must reject a point far above the box");
        Assert.That(Node.EvalTable(inputs, ("ignoreZ", "true")).Cell("ContainedIn", 0), Is.EqualTo("A"));
    }

    [Test]
    public void NullCoordinate_YieldsNull()
    {
        var t = Node.EvalTable(
            [
                Points(("P1", null, 1.0, 1.0), ("P2", 1.0, 1.0, 1.0)),
                Boxes(("A", 0, 0, 0, 2, 2, 2)),
            ]);
        Assert.That(t.Cell("ContainedIn", 0), Is.Null);
        Assert.That(t.Cell("ContainedIn", 1), Is.EqualTo("A"));
    }

    [Test]
    public void AsColumnCollision_Throws()
        => Assert.That(
            () => Node.EvalTable(
                [Points(("P1", 1.0, 1.0, 1.0)), Boxes(("A", 0, 0, 0, 2, 2, 2))],
                ("as", "Name")),
            Throws.ArgumentException
                .With.Message.Contains(BimContainmentNode.Kind).And.Message.Contains("Name"));

    [Test]
    public void MissingBoxColumn_Throws()
    {
        var boxesWithoutMaxZ = NodeTestHelpers.Table(
            ("Name", typeof(string), ["A"]),
            ("MinX", typeof(double), [0.0]),
            ("MinY", typeof(double), [0.0]),
            ("MinZ", typeof(double), [0.0]),
            ("MaxX", typeof(double), [2.0]),
            ("MaxY", typeof(double), [2.0]));
        Assert.That(
            () => Node.EvalTable([Points(("P1", 1.0, 1.0, 1.0)), boxesWithoutMaxZ]),
            Throws.ArgumentException
                .With.Message.Contains(BimContainmentNode.Kind).And.Message.Contains("MaxZ"));
    }

    [Test]
    public void SampleDoors_LandInExpectedRooms()
    {
        var bounds = new BimBoundsNode().SampleTable();
        var doors = Enumerable.Range(0, bounds.Rows.Count)
            .Where(r => Equals(bounds.Cell(BimColumns.Category, r), "Doors"))
            .ToList();
        Assert.That(doors, Has.Count.EqualTo(5));
        var points = NodeTestHelpers.Table(
            ("Name", typeof(string), doors.Select(r => bounds.Cell(BimColumns.Name, r)).ToArray()),
            ("CenterX", typeof(double), doors.Select(r => bounds.Cell(BimColumns.CenterX, r)).ToArray()),
            ("CenterY", typeof(double), doors.Select(r => bounds.Cell(BimColumns.CenterY, r)).ToArray()),
            ("CenterZ", typeof(double), doors.Select(r => bounds.Cell(BimColumns.CenterZ, r)).ToArray()));
        // Boxes carry a small tolerance: door centers come from float bounds, so
        // e.g. D4's CenterY is 8.0000002, a hair outside an exact 0..8 room.
        const double pad = 0.001;
        (string, double, double, double, double, double, double) Room(
            string name, double x0, double y0, double z0, double x1, double y1, double z1)
            => (name, x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad);
        var rooms = Boxes(
            Room("Office", 0, 0, 0, 5, 4, 3),
            Room("Corridor1", 5, 0, 0, 7, 8, 3),
            Room("Kitchen", 0, 4, 0, 5, 8, 3),
            Room("WC", 7, 0, 0, 9, 3, 3),
            Room("Meeting", 0, 0, 3, 5, 8, 6),
            Room("Corridor2", 5, 0, 3, 7, 8, 6));

        var t = Node.EvalTable([points, rooms]);
        var byDoor = Enumerable.Range(0, t.Rows.Count)
            .ToDictionary(r => (string)t.Cell("Name", r)!, r => t.Cell("ContainedIn", r));
        // Door centers sit on the boundary between the two rooms they join; the
        // smaller-volume room wins (corridor 48 beats office/kitchen/meeting 60/120).
        Assert.That(byDoor["D1"], Is.EqualTo("Corridor1"));
        Assert.That(byDoor["D2"], Is.EqualTo("Corridor1"));
        Assert.That(byDoor["D3"], Is.EqualTo("WC"));
        Assert.That(byDoor["D4"], Is.EqualTo("Corridor1"));
        Assert.That(byDoor["D5"], Is.EqualTo("Corridor2"));
    }
}
