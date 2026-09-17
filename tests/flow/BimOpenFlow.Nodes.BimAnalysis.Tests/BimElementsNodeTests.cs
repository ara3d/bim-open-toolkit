using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimElementsNodeTests
{
    private static readonly BimElementsNode Node = new();

    [Test]
    public void Elements_HaveTheContractColumnsInOrder()
    {
        var table = Node.SampleTable();
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.EntityIndex, BimColumns.LocalId, BimColumns.GlobalId, BimColumns.Name,
            BimColumns.Category, BimColumns.CategoryType, BimColumns.Type, BimColumns.ClassName,
            BimColumns.Level, BimColumns.Elevation, BimColumns.Room, BimColumns.Document,
            BimColumns.Workset, BimColumns.Group,
        }));
        Assert.That(table.Rows, Has.Count.EqualTo(20));
    }

    [Test]
    public void Elements_AreInEntityIndexOrder()
    {
        var table = Node.SampleTable();
        var names = table.ColumnCells(BimColumns.Name);
        Assert.That(names, Is.EqualTo(new[]
        {
            "Level 1", "Level 2", "Office", "Corridor", "Kitchen", "WC", "Meeting Room", "Corridor",
            "W1", "W2", "W3", "D1", "D2", "D3", "D4", "D5", "WN1", "SC1", "DU1", "LF1",
        }));
        var indexes = table.ColumnCells(BimColumns.EntityIndex).Cast<long>().ToList();
        Assert.That(indexes, Is.Ordered.Ascending);
    }

    [Test]
    public void Wall_RowCarriesTypeLevelWorksetAndDocument()
    {
        var table = Node.SampleTable();
        var row = table.ColumnCells(BimColumns.Name).ToList().IndexOf("W1");
        Assert.That(table.Cell(BimColumns.Category, row), Is.EqualTo("Walls"));
        Assert.That(table.Cell(BimColumns.CategoryType, row), Is.EqualTo("Model"));
        Assert.That(table.Cell(BimColumns.Type, row), Is.EqualTo("Basic Wall 200mm"));
        Assert.That(table.Cell(BimColumns.ClassName, row), Is.EqualTo("Wall"));
        Assert.That(table.Cell(BimColumns.Level, row), Is.EqualTo("Level 1"));
        Assert.That(table.Cell(BimColumns.Elevation, row), Is.EqualTo(0d));
        Assert.That(table.Cell(BimColumns.Room, row), Is.Null);
        Assert.That(table.Cell(BimColumns.Document, row), Is.EqualTo("Sample Tower"));
        Assert.That(table.Cell(BimColumns.Workset, row), Is.EqualTo(1L));
        Assert.That(table.Cell(BimColumns.Group, row), Is.Null);
    }

    [Test]
    public void Level_RowHasNoLevelElevationTypeOrWorkset()
    {
        var table = Node.SampleTable();
        var row = table.ColumnCells(BimColumns.Name).ToList().IndexOf("Level 1");
        Assert.That(table.Cell(BimColumns.Category, row), Is.EqualTo("Levels"));
        Assert.That(table.Cell(BimColumns.Type, row), Is.Null);
        Assert.That(table.Cell(BimColumns.Level, row), Is.Null);
        Assert.That(table.Cell(BimColumns.Elevation, row), Is.Null);
        Assert.That(table.Cell(BimColumns.Workset, row), Is.Null);
    }

    [Test]
    public void SecondStorey_ElementsCarryLevel2Elevation()
    {
        var table = Node.SampleTable();
        var row = table.ColumnCells(BimColumns.Name).ToList().IndexOf("W3");
        Assert.That(table.Cell(BimColumns.Level, row), Is.EqualTo("Level 2"));
        Assert.That(table.Cell(BimColumns.Elevation, row), Is.EqualTo(3d));
    }

    [Test]
    public void Room_ComesFromSpaceOrRoomParameter()
    {
        var table = Node.SampleTable();
        var names = table.ColumnCells(BimColumns.Name).ToList();
        Assert.That(table.Cell(BimColumns.Room, names.IndexOf("WN1")), Is.EqualTo("Office"));
        Assert.That(table.Cell(BimColumns.Room, names.IndexOf("LF1")), Is.EqualTo("Meeting Room"));
        Assert.That(table.Cell(BimColumns.Room, names.IndexOf("D1")), Is.Null);
    }

    [Test]
    public void MissingFile_ThrowsWithTheKind()
        => Assert.That(() => Node.EvalTable([], ("path", @"C:\does\not\exist.bos")),
            Throws.TypeOf<FileNotFoundException>().With.Message.Contains(BimElementsNode.Kind));
}
