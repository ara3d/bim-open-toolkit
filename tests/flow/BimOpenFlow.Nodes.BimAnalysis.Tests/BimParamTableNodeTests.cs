using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimParamTableNodeTests
{
    private static readonly BimParamTableNode Node = new();

    private const string RoomAndBoundsParams =
        "Rvt:Room:Number,Rvt:Room:Volume,Rvt:Element:Bounds.Min,Rvt:Element:Level";

    [Test]
    public void RequestedParameters_BecomeTypedColumns()
    {
        var table = Node.SampleTable(("parameters", RoomAndBoundsParams));
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            "EntityIndex", "Name", "Category",
            "Number", "Volume", "Bounds.Min.X", "Bounds.Min.Y", "Bounds.Min.Z", "Level",
        }));
        Type ColumnType(string name) => table.Columns.Single(c => c.Descriptor.Name == name).Descriptor.Type;
        Assert.That(ColumnType("Number"), Is.EqualTo(typeof(string)));
        Assert.That(ColumnType("Volume"), Is.EqualTo(typeof(double)));
        Assert.That(ColumnType("Bounds.Min.X"), Is.EqualTo(typeof(double)));
        Assert.That(ColumnType("Level"), Is.EqualTo(typeof(string)));
    }

    [Test]
    public void OfficeRow_HasTypedValues()
    {
        var table = Node.SampleTable(("parameters", RoomAndBoundsParams));
        var row = table.ColumnCells("Name").ToList().IndexOf("Office");
        Assert.That(row, Is.GreaterThanOrEqualTo(0));
        Assert.That(table.Cell("Number", row), Is.EqualTo("101"));
        Assert.That((double)table.Cell("Volume", row)!, Is.EqualTo(60).Within(1e-4));
        Assert.That((double)table.Cell("Bounds.Min.X", row)!, Is.EqualTo(0).Within(1e-4));
        Assert.That(table.Cell("Level", row), Is.EqualTo("Level 1"));
    }

    [Test]
    public void WallRow_HasNullRoomNumber()
    {
        var table = Node.SampleTable(("parameters", RoomAndBoundsParams));
        var row = table.ColumnCells("Name").ToList().IndexOf("W1");
        Assert.That(row, Is.GreaterThanOrEqualTo(0));
        Assert.That(table.Cell("Number", row), Is.Null);
    }

    [Test]
    public void UnknownParameter_WarnsAndYieldsNullColumn()
    {
        var (table, warnings) = Node.EvalWithWarnings([],
            ("path", BimAnalysisTestHelpers.SampleBosPath),
            ("parameters", "Rvt:Room:Number,Bogus:Not:There"));
        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(warnings[0], Does.Contain("Bogus:Not:There"));
        Assert.That(table.ColumnNames(), Does.Contain("There"));
        Assert.That(table.ColumnCells("There"), Is.All.Null);
    }

    [Test]
    public void EmptyParameterList_Throws()
    {
        var ex = Assert.Throws<ArgumentException>(() => Node.SampleTable(("parameters", " , ")));
        Assert.That(ex!.Message, Does.Contain(BimParamTableNode.Kind));
    }
}
