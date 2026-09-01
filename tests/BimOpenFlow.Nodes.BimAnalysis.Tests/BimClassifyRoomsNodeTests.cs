using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.classifyRooms: built-in ruleset, rule ordering, custom rules and
/// output column, and the error paths.</summary>
[TestFixture]
public sealed class BimClassifyRoomsNodeTests
{
    private static FlowValue Names(params object?[] cells)
        => NodeTestHelpers.Table(("Name", typeof(string), cells));

    [Test]
    public void BuiltInRules_Classify()
    {
        var result = new BimClassifyRoomsNode().EvalTable([Names(
            "Office", "Corridor", "WC", "Kitchen", "Meeting Room",
            "Master Bedroom", "Storage 2", "Atrium", null)]);
        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "Name", "RoomClass" }));
        Assert.That(result.ColumnCells("RoomClass"), Is.EqualTo(new[]
        {
            "Office", "Circulation", "Sanitary", "Kitchen", "Meeting",
            "Residential", "Storage", "Other", "Other",
        }));
    }

    [Test]
    public void FirstMatchingRule_Wins()
        => Assert.That(new BimClassifyRoomsNode()
                .EvalTable([Names("Office Storage")])
                .ColumnCells("RoomClass"),
            Is.EqualTo(new[] { "Office" }), "matches both Office and Storage; Office is first");

    [Test]
    public void CustomRules_ReplaceBuiltIns()
    {
        var result = new BimClassifyRoomsNode().EvalTable([Names("Office", "Corridor")],
            ("rules", "[{\"class\":\"Work\",\"pattern\":\"office\"}]"));
        Assert.That(result.ColumnCells("RoomClass"), Is.EqualTo(new[] { "Work", "Other" }),
            "built-in Circulation rule is gone");
    }

    [Test]
    public void CustomAsParam_NamesTheColumn()
    {
        var result = new BimClassifyRoomsNode().EvalTable([Names("Office")], ("as", "Kind"));
        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "Name", "Kind" }));
        Assert.That(result.Cell("Kind", 0), Is.EqualTo("Office"));
    }

    [Test]
    public void CustomColumnParam_ReadsThatColumn()
    {
        var table = NodeTestHelpers.Table(("RoomName", typeof(string), ["Stair 1"]));
        Assert.That(new BimClassifyRoomsNode().EvalTable([table], ("column", "RoomName"))
            .ColumnCells("RoomClass"), Is.EqualTo(new[] { "Stair" }));
    }

    [Test]
    public void InvalidRegex_Throws()
        => Assert.That(
            () => new BimClassifyRoomsNode().EvalTable([Names("Office")],
                ("rules", "[{\"class\":\"Bad\",\"pattern\":\"(unclosed\"}]")),
            Throws.ArgumentException.With.Message.Contains("bim.classifyRooms")
                .And.Message.Contains("(unclosed"));

    [Test]
    public void ExistingRoomClassColumn_Throws()
    {
        var table = NodeTestHelpers.Table(
            ("Name", typeof(string), ["Office"]),
            ("RoomClass", typeof(string), ["x"]));
        Assert.That(() => new BimClassifyRoomsNode().EvalTable([table]),
            Throws.ArgumentException.With.Message.Contains("bim.classifyRooms"));
    }

    [Test]
    public void SampleModelRoomNames_Classify()
        => Assert.That(new BimClassifyRoomsNode()
                .EvalTable([Names("Office", "Corridor", "Kitchen", "WC", "Meeting Room")])
                .ColumnCells("RoomClass"),
            Is.EqualTo(new[] { "Office", "Circulation", "Kitchen", "Sanitary", "Meeting" }));
}
