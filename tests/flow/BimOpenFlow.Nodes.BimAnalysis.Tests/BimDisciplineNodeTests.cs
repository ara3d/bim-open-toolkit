using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.discipline: built-in exact/prefix/IFC classification, overrides,
/// custom column, and the error paths.</summary>
[TestFixture]
public sealed class BimDisciplineNodeTests
{
    private static FlowValue Categories(params object?[] cells)
        => NodeTestHelpers.Table(("Category", typeof(string), cells));

    [Test]
    public void ExactMatches_Classify()
    {
        var result = new BimDisciplineNode().EvalTable([Categories("Walls", "Ducts", "Sprinklers")]);
        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "Category", "Discipline" }));
        Assert.That(result.ColumnCells("Discipline"),
            Is.EqualTo(new[] { "Architecture", "Mechanical", "FireProtection" }));
        Assert.That(result.ColumnCells("Category"), Is.EqualTo(new[] { "Walls", "Ducts", "Sprinklers" }));
    }

    [Test]
    public void PrefixRules_Classify()
        => Assert.That(new BimDisciplineNode()
                .EvalTable([Categories("Structural Framing", "Cable Trays", "Curtain Panels")])
                .ColumnCells("Discipline"),
            Is.EqualTo(new[] { "Structure", "Electrical", "Architecture" }));

    [Test]
    public void IfcClassNames_Classify()
        => Assert.That(new BimDisciplineNode()
                .EvalTable([Categories("IfcBeam", "IfcPipeSegment")])
                .ColumnCells("Discipline"),
            Is.EqualTo(new[] { "Structure", "Plumbing" }));

    [Test]
    public void NullAndUnknown_GetGeneral()
        => Assert.That(new BimDisciplineNode()
                .EvalTable([Categories(null, "Frobnicators")])
                .ColumnCells("Discipline"),
            Is.EqualTo(new[] { "General", "General" }));

    [Test]
    public void Overrides_WinOverBuiltIns()
        => Assert.That(new BimDisciplineNode()
                .EvalTable([Categories("Walls", "Doors")],
                    ("overrides", "{\"Walls\":\"Structure\"}"))
                .ColumnCells("Discipline"),
            Is.EqualTo(new[] { "Structure", "Architecture" }));

    [Test]
    public void CustomColumnParam_ReadsThatColumn()
    {
        var table = NodeTestHelpers.Table(("Cat", typeof(string), ["Pipes"]));
        Assert.That(new BimDisciplineNode().EvalTable([table], ("column", "Cat"))
            .ColumnCells("Discipline"), Is.EqualTo(new[] { "Plumbing" }));
    }

    [Test]
    public void MalformedOverrides_Throws()
        => Assert.That(
            () => new BimDisciplineNode().EvalTable([Categories("Walls")], ("overrides", "{not json")),
            Throws.ArgumentException.With.Message.Contains("bim.discipline"));

    [Test]
    public void ExistingDisciplineColumn_Throws()
    {
        var table = NodeTestHelpers.Table(
            ("Category", typeof(string), ["Walls"]),
            ("Discipline", typeof(string), ["x"]));
        Assert.That(() => new BimDisciplineNode().EvalTable([table]),
            Throws.ArgumentException.With.Message.Contains("bim.discipline"));
    }

    [Test]
    public void SampleModelCategories_Classify()
        => Assert.That(new BimDisciplineNode()
                .EvalTable([Categories("Rooms", "Ducts", "Structural Columns", "Lighting Fixtures")])
                .ColumnCells("Discipline"),
            Is.EqualTo(new[] { "Architecture", "Mechanical", "Structure", "Electrical" }));
}
