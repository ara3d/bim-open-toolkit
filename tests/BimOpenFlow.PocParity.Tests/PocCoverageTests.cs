namespace BimOpenFlow.PocParity.Tests;

/// <summary>
/// The living parity map from the PlatoFlow PoC node vocabulary
/// (platoflow/web/src/flow/defs-*.ts) to the production packs. Replaced kinds
/// must exist in the combined registry; everything else needs an explicit
/// reason. When a gap is closed, this map must be updated — that is the point.
/// </summary>
[TestFixture]
public sealed class PocCoverageTests
{
    /// <summary>PoC kind → the production kinds that cover it.</summary>
    private static readonly IReadOnlyDictionary<string, string[]> Replaced = new Dictionary<string, string[]>
    {
        ["load.model"] = ["bos.load"],
        ["select.byType"] = ["bos.query"],
        ["select.byLevel"] = ["bos.query"],
        ["select.byParameter"] = ["bos.query", "table.filter"],
        ["table.sql"] = ["bos.query"],
        ["table.fromScene"] = ["bos.load"],
        ["table.filter"] = ["table.filter"],
        ["table.sort"] = ["table.sort"],
        ["table.aggregate"] = ["table.aggregate"],
        ["table.count"] = ["table.aggregate"],
        ["table.stats"] = ["table.aggregate"],
        ["compute.expr"] = ["table.derive"],
        ["group.by"] = ["table.aggregate"],
        ["check.rule"] = ["check.rule"],
        ["viz.colorBy"] = ["view3d.color"],
        ["viz.colormap"] = ["view3d.color"],
        ["sink.exportCsv"] = ["sink.exportCsv"],
        ["sink.writePset"] = ["sink.writePsets"],
    };

    /// <summary>PoC kind → why no production node covers it (yet).</summary>
    private static readonly IReadOnlyDictionary<string, string> NotReplaced = new Dictionary<string, string>
    {
        ["data.csv"] = "gap: no CSV source node yet (core node set design pending)",
        ["attach.column"] = "gap: no two-table join node yet (needs the DuckDB/SQL node set)",
        ["table.ask"] = "gap: generated-SQL node pending the SQL node set design",
        ["select.union"] = "gap: set-algebra nodes not yet designed",
        ["select.intersect"] = "gap: set-algebra nodes not yet designed",
        ["select.subtract"] = "gap: set-algebra nodes not yet designed",
        ["select.invert"] = "gap: set-algebra nodes not yet designed",
        ["select.checklist"] = "gap: set-algebra nodes not yet designed",
        ["chart.bar"] = "gap: chart nodes pending the visualization node set design",
        ["viz.boxes"] = "gap: bounding-box viz pending the visualization node set design",
        ["viz.explode"] = "dropped: out of V1 scope per the UX proposal",
        ["view.scene"] = "dissolved: viewing is a pane concern, not a node",
        ["view.table"] = "dissolved: viewing is a pane concern, not a node",
        ["sink.table"] = "dissolved: viewing is a pane concern, not a node",
        ["table.columns"] = "dissolved: schema display is an inspector-pane concern",
        ["graph.sub"] = "dropped: subgraphs deferred past V1 per the UX proposal",
    };

    /// <summary>The complete PoC vocabulary, from the defs-*.ts files.</summary>
    private static readonly string[] PocKinds =
    [
        "attach.column", "chart.bar", "check.rule", "compute.expr", "data.csv",
        "graph.sub", "group.by", "load.model", "select.byLevel", "select.byParameter",
        "select.byType", "select.checklist", "select.intersect", "select.invert",
        "select.subtract", "select.union", "sink.exportCsv", "sink.table",
        "sink.writePset", "table.aggregate", "table.ask", "table.columns",
        "table.count", "table.filter", "table.fromScene", "table.sort", "table.sql",
        "table.stats", "view.scene", "view.table", "viz.boxes", "viz.colorBy",
        "viz.colormap", "viz.explode",
    ];

    [Test]
    public void EveryPocKind_IsEitherReplacedOrAccountedFor()
        => Assert.That(Replaced.Keys.Concat(NotReplaced.Keys), Is.EquivalentTo(PocKinds));

    [Test]
    public void EveryReplacementKind_ExistsInTheCombinedRegistry()
    {
        var missing = Replaced
            .SelectMany(pair => pair.Value.Select(kind => (Poc: pair.Key, Kind: kind)))
            .Where(m => ParityCatalog.Registry.Find(m.Kind, 1) == null)
            .ToList();
        Assert.That(missing, Is.Empty,
            "replacement kinds must be registered: " + string.Join(", ", missing));
    }

    [Test]
    public void NoKindIs_BothReplacedAndNotReplaced()
        => Assert.That(Replaced.Keys.Intersect(NotReplaced.Keys), Is.Empty);
}
