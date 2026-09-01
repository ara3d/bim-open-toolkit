using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;

namespace BimOpenFlow.PocParity.Tests;

/// <summary>
/// Replicates the PlatoFlow PoC's core workflows as graphs evaluated end-to-end
/// through the engine and the production node packs: select, enrich, aggregate,
/// check, color, export. Each test is one PoC pipeline; the kind mapping the
/// tests rely on is asserted in PocCoverageTests.
/// </summary>
[TestFixture]
public sealed class PocPipelineTests
{
    private static IDataTable Table(FlowTestSession session, string nodeId)
        => ((TableValue)session.Output(nodeId, "table")).Table;

    private static object? Cell(IDataTable table, string column, int row)
        => table[table.Columns.Single(c => c.Descriptor.Name == column).ColumnIndex, row];

    private static List<object?> Column(IDataTable table, string column)
        => Enumerable.Range(0, table.Rows.Count).Select(r => Cell(table, column, r)).ToList();

    /// <summary>PoC load.model → select.byType → view.table: SQL over the entity view.</summary>
    [Test]
    public void SelectByType_FiltersToWalls()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(Graph
            .Node("load", "bos.load", ("path", SampleModel.BosPath))
            .Node("walls", "bos.query", ("sql", "SELECT Name, GlobalId FROM t WHERE Type = 'BasicWall' ORDER BY Name"))
            .Connect("load.entities", "walls.table")
            .Build());

        Assert.That(Column(Table(session, "walls"), "Name"),
            Is.EqualTo(new[] { "Wall-001", "Wall-002", "Wall-003" }));
    }

    /// <summary>PoC select.byLevel: SQL over the parameter view.</summary>
    [Test]
    public void SelectByLevel_FindsLevelOneElements()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(Graph
            .Node("load", "bos.load", ("path", SampleModel.BosPath))
            .Node("level", "bos.query", ("sql", "SELECT EntityIndex FROM t WHERE Name = 'Level' AND Value = 'L1'"))
            .Connect("load.parameters", "level.table")
            .Build());

        Assert.That(Table(session, "level").Rows, Has.Count.EqualTo(3), "Wall-001, Wall-002, Door-001");
    }

    /// <summary>PoC select.byParameter → compute.expr → group.by: heights from the
    /// parameter view, filtered, derived, and aggregated.</summary>
    [Test]
    public void FilterDeriveAggregate_OverModelHeights()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(HeightsPipeline("Height > 2.2"));

        var derived = Table(session, "derive");
        Assert.That(Column(derived, "Doubled"), Is.EqualTo(new[] { 5.0, 6.0 }));

        var stats = Table(session, "stats");
        Assert.That(stats.Rows, Has.Count.EqualTo(1));
        Assert.That(Cell(stats, "n", 0), Is.EqualTo(2));
        Assert.That(Cell(stats, "avgHeight", 0), Is.EqualTo(2.75));
    }

    /// <summary>PoC check.rule: verdicts including null → InfoNotAvailable.</summary>
    [Test]
    public void CheckRule_ProducesVerdictsWithInfoNotAvailable()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(Graph
            .Node("heights", "test.table", ("name", "heights"))
            .Node("check", "check.rule",
                ("checkId", "HEIGHT-01"), ("title", "Minimum clear height"),
                ("citation", "IBC 1208.2"), ("expr", "Height >= 2.4"))
            .Connect("heights.table", "check.in")
            .Build());

        var verdicts = ((TableValue)session.Output("check", "out")).Table;
        Assert.That(Column(verdicts, "verdict"),
            Is.EqualTo(new[] { "Pass", "Pass", "Fail", "Fail", "InfoNotAvailable" }));
        Assert.That(Column(verdicts, "checkId"), Has.All.EqualTo("HEIGHT-01"));
    }

    /// <summary>PoC viz.colorBy/viz.colormap: color columns joined onto instances,
    /// and isolate as the ids-driven counterpart of PoC selection viz.</summary>
    [Test]
    public void ColorAndIsolate_ProduceViewTables()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(Graph
            .Node("instances", "test.table", ("name", "instances"))
            .Node("heights", "test.table", ("name", "heights"))
            .Node("wallIds", "test.table", ("name", "wallIds"))
            .Node("color", "view3d.color",
                ("joinColumn", "GlobalId"), ("valueColumn", "Height"), ("colorMap", "redgreen"))
            .Node("isolate", "view3d.isolate", ("joinColumn", "GlobalId"))
            .Connect("instances.table", "color.instances")
            .Connect("heights.table", "color.values")
            .Connect("color.instances", "isolate.instances")
            .Connect("wallIds.table", "isolate.ids")
            .Build());

        var colored = ((TableValue)session.Output("color", "instances")).Table;
        Assert.That(colored.Rows, Has.Count.EqualTo(4));
        foreach (var channel in new[] { "r", "g", "b", "a" })
            Assert.That(colored.Columns.Select(c => c.Descriptor.Name), Does.Contain(channel));

        var isolated = ((TableValue)session.Output("isolate", "instances")).Table;
        Assert.That(Column(isolated, "GlobalId"), Is.EqualTo(new[] { "guid-wall-1", "guid-wall-3" }));
    }

    /// <summary>PoC sink.exportCsv: effect nodes wait for a Run — inputs are computed
    /// and captured, nothing is written, and downstream nodes are Unavailable.</summary>
    [Test]
    public void ExportCsv_IsGatedBehindRun()
    {
        var path = SampleModel.ScratchPath("export.csv");
        var session = ParityCatalog.NewSession();
        session.Evaluate(Graph
            .Node("heights", "test.table", ("name", "heights"))
            .Node("export", "sink.exportCsv", ("path", path))
            .Node("after", "table.sort", ("by", "path"))
            .Connect("heights.table", "export.in")
            .Connect("export.out", "after.table")
            .Build());

        var export = session.Result("export");
        Assert.That(export.Status, Is.EqualTo(NodeStatus.EffectPending));
        Assert.That(export.ExecutionCount, Is.Zero);
        Assert.That(((TableValue)export.EffectInputs[0]).Table.Rows, Has.Count.EqualTo(5));
        Assert.That(File.Exists(path), Is.False, "nothing may be written outside a Run");

        var after = session.Result("after");
        Assert.That(after.Status, Is.EqualTo(NodeStatus.Unavailable));
        Assert.That(after.BlockingNodeId, Is.EqualTo("export"));
    }

    /// <summary>The PoC's live-editing loop: changing one param re-executes only the
    /// nodes downstream of it; the model load and query stay memoized.</summary>
    [Test]
    public void EditingAParameter_ReevaluatesOnlyDownstream()
    {
        var session = ParityCatalog.NewSession();
        session.Evaluate(HeightsPipeline("Height > 2.2"));
        session.Evaluate(doc => doc.SetParam("filter", "expr", "Height > 2.9"));

        session.AssertExecutionCount("load", 1);
        session.AssertExecutionCount("heights", 1);
        session.AssertExecutionCount("filter", 2);
        session.AssertExecutionCount("stats", 2);
        Assert.That(Cell(Table(session, "stats"), "n", 0), Is.EqualTo(1), "only Wall-002 is over 2.9");
    }

    /// <summary>load → query (heights as numbers) → filter → derive → aggregate.</summary>
    private static GraphDocument HeightsPipeline(string filterExpr)
        => Graph
            .Node("load", "bos.load", ("path", SampleModel.BosPath))
            .Node("heights", "bos.query",
                ("sql", "SELECT EntityIndex, CAST(Value AS DOUBLE) AS Height FROM t WHERE Name = 'Height' ORDER BY EntityIndex"))
            .Node("filter", "table.filter", ("expr", filterExpr))
            .Node("derive", "table.derive", ("name", "Doubled"), ("expr", "Height * 2"))
            .Node("stats", "table.aggregate",
                ("groupBy", ""), ("aggregates", "count(Height) as n, avg(Height) as avgHeight"))
            .Connect("load.parameters", "heights.table")
            .Connect("heights.table", "filter.table")
            .Connect("filter.table", "derive.table")
            .Connect("derive.table", "stats.table")
            .Build();
}
