using Ara3D.DataTable;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimNavGraphNodeTests
{
    private static IDataTable NavGraph() => new BimNavGraphNode().SampleTable();

    [Test]
    public void SampleModel_OneRowPerDoor_WithExpectedColumns()
    {
        var table = NavGraph();
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.Door, BimColumns.DoorName, BimColumns.Level,
            BimColumns.FromRoom, BimColumns.ToRoom,
        }));
        Assert.That(table.Rows, Has.Count.EqualTo(5));
        Assert.That(table.ColumnCells(BimColumns.DoorName),
            Is.EqualTo(new[] { "D1", "D2", "D3", "D4", "D5" }));
    }

    [Test]
    public void SampleModel_EdgesUseRoomLabels()
    {
        var table = NavGraph();
        Assert.That(table.ColumnCells(BimColumns.FromRoom), Is.EqualTo(new[]
        {
            "Office 101", "Corridor 102", "Corridor 102", "Corridor 102", "Meeting Room 201",
        }));
        Assert.That(table.ColumnCells(BimColumns.ToRoom), Is.EqualTo(new[]
        {
            "Corridor 102", "Kitchen 103", "WC 104", BimColumns.Outside, "Corridor 202",
        }));
    }

    [Test]
    public void SampleModel_LevelsAndEntityIndices()
    {
        var table = NavGraph();
        Assert.That(table.ColumnCells(BimColumns.Level), Is.EqualTo(new[]
        {
            "Level 1", "Level 1", "Level 1", "Level 1", "Level 2",
        }));
        var doors = table.ColumnCells(BimColumns.Door);
        Assert.That(doors, Is.All.InstanceOf<long>());
        Assert.That(doors.Cast<long>(), Is.Ordered.Ascending);
    }

    [Test]
    public void MissingSide_IsOutside()
    {
        var table = NavGraph();
        Assert.That(table.Cell(BimColumns.DoorName, 3), Is.EqualTo("D4"));
        Assert.That(table.Cell(BimColumns.ToRoom, 3), Is.EqualTo(BimColumns.Outside));
    }
}
