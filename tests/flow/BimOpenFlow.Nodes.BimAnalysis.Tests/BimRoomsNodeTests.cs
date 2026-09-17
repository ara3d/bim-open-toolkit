using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimRoomsNodeTests
{
    private static readonly BimRoomsNode Node = new();

    [Test]
    public void Rooms_HaveTheContractColumnsInOrder()
    {
        var table = Node.SampleTable();
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.EntityIndex, BimColumns.Name, BimColumns.Number, BimColumns.Level,
            BimColumns.Elevation, BimColumns.Volume, BimColumns.UnboundedHeight, BimColumns.ElementCount,
            BimColumns.MinX, BimColumns.MinY, BimColumns.MinZ,
            BimColumns.MaxX, BimColumns.MaxY, BimColumns.MaxZ,
            BimColumns.SizeX, BimColumns.SizeY, BimColumns.SizeZ,
            BimColumns.CenterX, BimColumns.CenterY, BimColumns.CenterZ,
            BimColumns.FootprintArea,
        }));
        Assert.That(table.Rows, Has.Count.EqualTo(6));
        Assert.That(table.ColumnCells(BimColumns.Number),
            Is.EqualTo(new[] { "101", "102", "103", "104", "201", "202" }));
    }

    [Test]
    public void Office101_HasIdentitySizeAndBounds()
    {
        var table = Node.SampleTable();
        Assert.That(table.Cell(BimColumns.Name, 0), Is.EqualTo("Office"));
        Assert.That(table.Cell(BimColumns.Number, 0), Is.EqualTo("101"));
        Assert.That(table.Cell(BimColumns.Level, 0), Is.EqualTo("Level 1"));
        Assert.That(table.Cell(BimColumns.Elevation, 0), Is.EqualTo(0d));
        Assert.That(table.Cell(BimColumns.Volume, 0), Is.EqualTo(60d));
        Assert.That(table.Cell(BimColumns.UnboundedHeight, 0), Is.EqualTo(3d));
        Assert.That(table.Cell(BimColumns.MinX, 0), Is.EqualTo(0d));
        Assert.That(table.Cell(BimColumns.MinY, 0), Is.EqualTo(0d));
        Assert.That(table.Cell(BimColumns.MinZ, 0), Is.EqualTo(0d));
        Assert.That(table.Cell(BimColumns.MaxX, 0), Is.EqualTo(5d));
        Assert.That(table.Cell(BimColumns.MaxY, 0), Is.EqualTo(4d));
        Assert.That(table.Cell(BimColumns.MaxZ, 0), Is.EqualTo(3d));
        Assert.That(table.Cell(BimColumns.SizeX, 0), Is.EqualTo(5d));
        Assert.That(table.Cell(BimColumns.SizeY, 0), Is.EqualTo(4d));
        Assert.That(table.Cell(BimColumns.SizeZ, 0), Is.EqualTo(3d));
        Assert.That(table.Cell(BimColumns.CenterX, 0), Is.EqualTo(2.5d));
        Assert.That(table.Cell(BimColumns.CenterY, 0), Is.EqualTo(2d));
        Assert.That(table.Cell(BimColumns.CenterZ, 0), Is.EqualTo(1.5d));
        Assert.That(table.Cell(BimColumns.FootprintArea, 0), Is.EqualTo(20d));
    }

    [Test]
    public void Volumes_MatchTheSampleModel()
    {
        var table = Node.SampleTable();
        Assert.That(table.ColumnCells(BimColumns.Volume),
            Is.EqualTo(new object[] { 60d, 48d, 60d, 18d, 120d, 48d }));
    }

    [Test]
    public void ElementCount_CountsRoomAndSpaceReferences()
    {
        var table = Node.SampleTable();
        // WN1 sits in Office 101 (FIRoom), LF1 in Meeting Room 201 (FISpace).
        Assert.That(table.ColumnCells(BimColumns.ElementCount),
            Is.EqualTo(new object[] { 1L, 0L, 0L, 0L, 1L, 0L }));
    }

    [Test]
    public void SecondStorey_RoomsCarryLevel2Elevation()
    {
        var table = Node.SampleTable();
        Assert.That(table.Cell(BimColumns.Level, 4), Is.EqualTo("Level 2"));
        Assert.That(table.Cell(BimColumns.Elevation, 4), Is.EqualTo(3d));
    }

    [Test]
    public void Categories_ParameterSelectsOtherCategories()
    {
        var table = Node.SampleTable(("categories", "Doors"));
        Assert.That(table.Rows, Has.Count.EqualTo(5));
        Assert.That(table.Cell(BimColumns.Number, 0), Is.Null);
        Assert.That(table.Cell(BimColumns.Volume, 0), Is.Null);
    }

    [Test]
    public void MissingFile_ThrowsWithTheKind()
        => Assert.That(() => Node.EvalTable([], ("path", @"C:\does\not\exist.bos")),
            Throws.TypeOf<FileNotFoundException>().With.Message.Contains(BimRoomsNode.Kind));
}
