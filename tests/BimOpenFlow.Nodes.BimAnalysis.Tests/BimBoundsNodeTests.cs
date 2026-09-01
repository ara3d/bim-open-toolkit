using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.bounds against the frozen sample model: row selection (only
/// elements with bounds), column order, and the derived measures.</summary>
[TestFixture]
public sealed class BimBoundsNodeTests
{
    private const double Tolerance = 1e-4;

    [Test]
    public void Sample_Has18RowsInColumnOrder()
    {
        var t = new BimBoundsNode().SampleTable();
        Assert.That(t.Rows, Has.Count.EqualTo(18));
        Assert.That(t.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.EntityIndex, BimColumns.Name, BimColumns.Category, BimColumns.Level,
            BimColumns.MinX, BimColumns.MinY, BimColumns.MinZ,
            BimColumns.MaxX, BimColumns.MaxY, BimColumns.MaxZ,
            BimColumns.SizeX, BimColumns.SizeY, BimColumns.SizeZ,
            BimColumns.CenterX, BimColumns.CenterY, BimColumns.CenterZ,
            BimColumns.FootprintArea, BimColumns.Volume, BimColumns.Diagonal,
        }));
    }

    [Test]
    public void Levels_HaveNoBounds_AndAreExcluded()
    {
        var names = new BimBoundsNode().SampleTable().ColumnCells(BimColumns.Name);
        Assert.That(names, Has.None.EqualTo("Level 1"));
        Assert.That(names, Has.None.EqualTo("Level 2"));
        Assert.That(names, Has.Some.EqualTo("WN1"));
        Assert.That(names, Has.Some.EqualTo("SC1"));
        Assert.That(names, Has.Some.EqualTo("DU1"));
        Assert.That(names, Has.Some.EqualTo("LF1"));
    }

    [Test]
    public void OfficeRow_HasDerivedMeasures()
    {
        var t = new BimBoundsNode().SampleTable();
        var row = t.ColumnCells(BimColumns.Name).ToList().IndexOf("Office");
        Assert.That(row, Is.GreaterThanOrEqualTo(0));
        Assert.That(t.Cell(BimColumns.EntityIndex, row), Is.TypeOf<long>());
        Assert.That(t.Cell(BimColumns.Category, row), Is.EqualTo("Rooms"));
        Assert.That(t.Cell(BimColumns.Level, row), Is.EqualTo("Level 1"));

        void C(string column, double expected)
            => Assert.That((double)t.Cell(column, row)!, Is.EqualTo(expected).Within(Tolerance), column);

        C(BimColumns.MinX, 0);
        C(BimColumns.MinY, 0);
        C(BimColumns.MinZ, 0);
        C(BimColumns.MaxX, 5);
        C(BimColumns.MaxY, 4);
        C(BimColumns.MaxZ, 3);
        C(BimColumns.SizeX, 5);
        C(BimColumns.SizeY, 4);
        C(BimColumns.SizeZ, 3);
        C(BimColumns.CenterX, 2.5);
        C(BimColumns.CenterY, 2);
        C(BimColumns.CenterZ, 1.5);
        C(BimColumns.FootprintArea, 20);
        C(BimColumns.Volume, 60);
        C(BimColumns.Diagonal, Math.Sqrt(50));
    }

    [Test]
    public void MissingFile_Throws()
        => Assert.That(
            () => new BimBoundsNode().EvalTable([], ("path", @"Z:\no\such\file.bos")),
            Throws.InstanceOf<FileNotFoundException>().With.Message.Contains(BimBoundsNode.Kind));
}
