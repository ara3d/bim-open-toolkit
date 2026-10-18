using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

[TestFixture]
public sealed class BimSelectionNodeTests
{
    private static readonly BimSelectionNode Node = new();

    [Test]
    public void Ids_BecomeOneGlobalIdRowEach_DroppingBlanksAndRepeats()
    {
        var table = Node.EvalTable([], ("ids", "a,b,,a"));
        Assert.That(table.ColumnNames(), Is.EqualTo(new[] { "GlobalId" }));
        Assert.That(table.ColumnCells("GlobalId"), Is.EqualTo(new object?[] { "a", "b" }));
    }

    [Test]
    public void IdsWithSpaces_AreTrimmed()
        => Assert.That(Node.EvalTable([], ("ids", " a , b ")).ColumnCells("GlobalId"), Is.EqualTo(new object?[] { "a", "b" }));

    [Test]
    public void NoIds_GivesAnEmptyTableWithTheColumn()
    {
        var table = Node.EvalTable([]);
        Assert.That(table.ColumnNames(), Is.EqualTo(new[] { "GlobalId" }));
        Assert.That(table.Rows, Is.Empty);
    }
}
