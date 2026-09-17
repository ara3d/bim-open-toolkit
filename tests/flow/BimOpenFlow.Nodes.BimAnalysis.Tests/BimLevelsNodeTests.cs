using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimLevelsNodeTests
{
    private static readonly BimLevelsNode Node = new();

    [Test]
    public void Levels_HaveTheContractColumnsInOrder()
    {
        var table = Node.SampleTable();
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.EntityIndex, BimColumns.Name, BimColumns.Elevation,
            BimColumns.ElementCount, BimColumns.RoomCount,
        }));
        Assert.That(table.Rows, Has.Count.EqualTo(2));
    }

    [Test]
    public void Levels_AreOrderedByElevation()
    {
        var table = Node.SampleTable();
        Assert.That(table.ColumnCells(BimColumns.Name), Is.EqualTo(new[] { "Level 1", "Level 2" }));
        Assert.That(table.ColumnCells(BimColumns.Elevation), Is.EqualTo(new object[] { 0d, 3d }));
    }

    [Test]
    public void ElementCounts_MatchTheSampleModel()
    {
        var table = Node.SampleTable();
        // L1: 4 rooms + W1 + W2 + D1..D4 + WN1 + SC1; L2: 2 rooms + W3 + D5 + DU1 + LF1.
        Assert.That(table.ColumnCells(BimColumns.ElementCount), Is.EqualTo(new object[] { 12L, 6L }));
        Assert.That(table.ColumnCells(BimColumns.RoomCount), Is.EqualTo(new object[] { 4L, 2L }));
    }

    [Test]
    public void MissingFile_ThrowsWithTheKind()
        => Assert.That(() => Node.EvalTable([], ("path", @"C:\does\not\exist.bos")),
            Throws.TypeOf<FileNotFoundException>().With.Message.Contains(BimLevelsNode.Kind));
}
