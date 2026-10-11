using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.buildSequence over the sample building and small inline tables: the
/// floor-by-floor cycle, the per-element finish dates, the trade map, and the error paths.
/// Sample building, 10-day tasks: Level 1 holds SC1 (Structure), W1 W2 WN1 (Envelope),
/// D1..D4 (Finishes); Level 2 holds W3 (Envelope), DU1 LF1 (MEP), D5 (Finishes).</summary>
[TestFixture]
public sealed class BimBuildSequenceNodeTests
{
    private static readonly BimBuildSequenceNode Node = new();

    private static IReadOnlyList<IDataTable> Schedule(FlowValue elements, params (string Name, string Value)[] ps)
        => Node.Eval(NodeTestHelpers.Ctx, [elements], NodeTestHelpers.Params(ps))
            .Select(v => ((TableValue)v).Table).ToList();

    private static IReadOnlyList<IDataTable> SampleSchedule(params (string Name, string Value)[] ps)
        => Schedule(new TableValue(new BimElementsNode().SampleTable()), ps);

    private static TableValue Elements(params (string Level, double Elevation, string Category)[] rows)
        => NodeTestHelpers.Table(
            (BimColumns.Level, typeof(string), rows.Select(r => (object?)r.Level).ToArray()),
            (BimColumns.Elevation, typeof(double), rows.Select(r => (object?)r.Elevation).ToArray()),
            (BimColumns.Category, typeof(string), rows.Select(r => (object?)r.Category).ToArray()));

    [Test]
    public void Tasks_HaveTheContractColumns()
        => Assert.That(SampleSchedule()[0].ColumnNames(), Is.EqualTo(new[]
        {
            "Task", "Storey", "Trade", "Start", "End", "DurationDays", "FinishWeek", "ElementCount", "Synthetic",
        }));

    [Test]
    public void SampleTasks_FollowTheFloorByFloorCycle()
    {
        var tasks = SampleSchedule()[0];
        Assert.That(tasks.ColumnCells("Task"), Is.EqualTo(new[]
        {
            "Level 1 - Structure", "Level 1 - Envelope", "Level 2 - Envelope",
            "Level 1 - Finishes", "Level 2 - MEP", "Level 2 - Finishes",
        }));
        Assert.That(tasks.ColumnCells("Start"), Is.EqualTo(new[]
            { "2027-01-04", "2027-01-14", "2027-01-24", "2027-01-24", "2027-02-03", "2027-02-13" }));
        Assert.That(tasks.ColumnCells("End"), Is.EqualTo(new[]
            { "2027-01-14", "2027-01-24", "2027-02-03", "2027-02-03", "2027-02-13", "2027-02-23" }));
        Assert.That(tasks.ColumnCells("FinishWeek"), Is.EqualTo(new object[] { 2L, 3L, 5L, 5L, 6L, 8L }));
        Assert.That(tasks.ColumnCells("ElementCount"), Is.EqualTo(new object[] { 1L, 3L, 1L, 4L, 2L, 1L }));
        Assert.That(tasks.ColumnCells("DurationDays"), Has.All.EqualTo(10L));
        Assert.That(tasks.ColumnCells("Synthetic"), Has.All.EqualTo(true));
    }

    [Test]
    public void SampleElements_CarryTheirTaskAndFinish()
    {
        var input = new BimElementsNode().SampleTable();
        var elements = SampleSchedule()[1];
        Assert.That(elements.Rows, Has.Count.EqualTo(input.Rows.Count));
        Assert.That(elements.ColumnNames(), Is.EqualTo(input.ColumnNames()
            .Concat(["Task", "Trade", "Finish", "FinishWeek", "Synthetic"])));
        var w3 = elements.ColumnCells(BimColumns.Name).ToList().IndexOf("W3");
        Assert.That(elements.Cell("Task", w3), Is.EqualTo("Level 2 - Envelope"));
        Assert.That(elements.Cell("Finish", w3), Is.EqualTo("2027-02-03"));
        Assert.That(elements.Cell("FinishWeek", w3), Is.EqualTo(5L));
        var office = elements.ColumnCells(BimColumns.Name).ToList().IndexOf("Office");
        Assert.That(elements.Cell("Task", office), Is.Null, "rooms belong to no trade");
        Assert.That(elements.Cell("Synthetic", office), Is.Null, "an unscheduled row carries no synthetic date");
        Assert.That(elements.Cell("Synthetic", w3), Is.EqualTo(true));
        Assert.That(elements.ColumnCells("Task").Count(t => t is not null), Is.EqualTo(12));
    }

    [Test]
    public void Unscheduled_Rows_AreCountedInOneWarning()
    {
        var (_, warnings) = Node.EvalWithWarnings([Elements(("L1", 0, "Walls"), ("L1", 0, "Rooms"))]);
        Assert.That(warnings, Is.EqualTo(new[] { "bim.buildSequence: 1 of 2 rows have no storey or no trade and are not scheduled." }));
    }

    [Test]
    public void MissingElevationColumn_WarnsAndOrdersStoreysByName()
    {
        var (tasks, warnings) = Node.EvalWithWarnings(
            [Elements(("Basement", -3, "Walls"), ("Attic", 6, "Walls"))], ("elevationColumn", "Height"));
        Assert.That(warnings, Is.EqualTo(new[] { "bim.buildSequence: column 'Height' not found; storeys are ordered by name." }));
        Assert.That(tasks.ColumnCells("Storey"), Is.EqualTo(new[] { "Attic", "Basement" }), "by name, not by Elevation");
    }

    [Test]
    public void TradesOverlapByOneStorey()
    {
        var tasks = Schedule(Elements(
            ("Upper", 3, "Walls"), ("Lower", 0, "IFCCOLUMN"), ("Upper", 3, "IfcBeam"), ("Lower", 0, "IFCWALLSTANDARDCASE")),
            ("daysPerTask", "7"), ("start", "2027-03-01"))[0];
        Assert.That(tasks.ColumnCells("Task"), Is.EqualTo(new[]
            { "Lower - Structure", "Upper - Structure", "Lower - Envelope", "Upper - Envelope" }));
        Assert.That(tasks.ColumnCells("Start"), Is.EqualTo(new[]
            { "2027-03-01", "2027-03-08", "2027-03-08", "2027-03-15" }));
    }

    [Test]
    public void FinishWeek_IsTheWeekOfTheLastWorkingDay_NotOfTheExclusiveEnd()
    {
        var schedule = Schedule(Elements(("L1", 0, "Walls")), ("daysPerTask", "7"), ("start", "2027-03-01"));
        Assert.That(schedule[0].Cell("End", 0), Is.EqualTo("2027-03-08"));
        Assert.That(schedule[0].Cell("FinishWeek", 0), Is.EqualTo(1L));
        Assert.That(schedule[1].Cell("Finish", 0), Is.EqualTo("2027-03-08"));
        Assert.That(schedule[1].Cell("FinishWeek", 0), Is.EqualTo(1L));
    }

    [Test]
    public void TradeOrder_AndOverrides_AndDisciplineNames()
    {
        var tasks = Schedule(Elements(("L1", 0, "Mechanical"), ("L1", 0, "Structure"), ("L1", 0, "Frobnicators")),
            ("trades", "MEP, Structure, Fitout"), ("overrides", "{\"Frobnicators\":\"Fitout\"}"))[0];
        Assert.That(tasks.ColumnCells("Trade"), Is.EqualTo(new[] { "MEP", "Structure", "Fitout" }));
    }

    [Test]
    public void SameInput_SameSchedule()
    {
        var a = SampleSchedule();
        var b = SampleSchedule();
        foreach (var column in a[0].ColumnNames())
            Assert.That(b[0].ColumnCells(column), Is.EqualTo(a[0].ColumnCells(column)), column);
    }

    [Test]
    public void OverrideToAnUnknownTrade_Throws()
        => Assert.That(() => Schedule(Elements(("L1", 0, "Walls")), ("overrides", "{\"Walls\":\"Masonry\"}")),
            Throws.ArgumentException.With.Message.Contains("Masonry"));

    [Test]
    public void NonPositiveDays_Throws()
        => Assert.That(() => Schedule(Elements(("L1", 0, "Walls")), ("daysPerTask", "0")),
            Throws.ArgumentException.With.Message.Contains("daysPerTask"));

    [Test]
    public void StartWithATime_SchedulesFromItsDate()
        => Assert.That(Schedule(Elements(("L1", 0, "Walls")), ("start", "2027-03-01T15:30:00"))[0].Cell("Start", 0),
            Is.EqualTo("2027-03-01"));

    [Test]
    public void BadStart_Throws()
        => Assert.That(() => Schedule(Elements(("L1", 0, "Walls")), ("start", "March 1")),
            Throws.ArgumentException.With.Message.Contains("'start'"));

    [Test]
    public void ExistingTaskColumn_Throws()
    {
        var table = NodeTestHelpers.Table(
            (BimColumns.Level, typeof(string), ["L1"]),
            (BimColumns.Category, typeof(string), ["Walls"]),
            ("Task", typeof(string), ["x"]));
        Assert.That(() => Schedule(table), Throws.ArgumentException.With.Message.Contains("'Task'"));
    }
}
