using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The end-to-end demos in samples/showcase-analyses, each over samples/nrc: CSV into a
/// chart (both profiles), a BOS file into the relation pack and a chart, and the IFC-derived
/// DuckDB into verdicts, a coloured 3D view, a chart, and an HTML report. Numbers cite
/// nrc-ifc-llm/poc/results/expected_answers.json (Q5) and samples/nrc/door_verdicts.csv.</summary>
[TestFixture]
public sealed class ShowcaseGraphTests
{
    private static readonly string[] Ids = ["csv-to-chart", "bos-to-relations", "ifc-to-verdicts-and-chart"];

    private static string ShowcaseDir
        => Path.Combine(NrcPaths.Root, "samples", "showcase-analyses");

    private static GraphDocument Document(string id)
        => SampleSeeding.RewritePaths(GraphDocumentIO.Load(Path.Combine(ShowcaseDir, id + ".json")), NrcPaths.SamplesDir);

    /// <summary>The Duplex BOS file the bim host prepares in the background; built here once.</summary>
    private static readonly Lazy<string> DuplexBos = new(() =>
    {
        var bos = Path.Combine(Fixture.DatabaseDir, SampleSeeding.NrcBosFileName);
        Ara3D.Ifc.DuckDb.IfcDuckDbBuild.SaveBos(new FilePath(NrcPaths.Ifc), new FilePath(bos));
        return bos;
    });

    private static EvalSnapshot EvaluateGreen(GraphDocument doc, string id, NodeRegistry registry)
    {
        Assert.That(doc.Validate(registry), Is.Empty, id);
        return AssertGreen(new EvalSession(registry).SetDocument(doc), id);
    }

    /// <summary>A standing pass with the named effect nodes pending, then the engine Run over the
    /// same session with every node Ok; returns the run snapshot.</summary>
    private static EvalSnapshot RunGreen(GraphDocument doc, string id, NodeRegistry registry, params string[] effectNodes)
    {
        Assert.That(doc.Validate(registry), Is.Empty, id);
        var session = new EvalSession(registry);
        AssertGreen(session.SetDocument(doc), id, effectNodes);
        return AssertGreen(session.Run(), id);
    }

    private static EvalSnapshot AssertGreen(EvalSnapshot snapshot, string id, params string[] pendingEffects)
    {
        Assert.That(snapshot.Results
            .Where(r => r.Value.Status != (pendingEffects.Contains(r.Key) ? NodeStatus.EffectPending : NodeStatus.Ok))
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, id);
        return snapshot;
    }

    private static IDataTable Table(EvalSnapshot snapshot, string nodeId)
        => ((TableValue)snapshot.Results[nodeId].Outputs[0]).Table;

    private static GraphDocument WithParam(GraphDocument doc, string nodeId, string name, string value)
        => doc with
        {
            Values = doc.Values.ToDictionary(
                node => node.Key,
                node => node.Key != nodeId
                    ? node.Value
                    : (IReadOnlyDictionary<string, string>)node.Value.ToDictionary(
                        p => p.Key, p => p.Key == name ? value : p.Value)),
        };

    [Test]
    public void EveryShowcaseGraph_IsListedHere()
        => Assert.That(Directory.EnumerateFiles(ShowcaseDir, "*.json").Select(Path.GetFileNameWithoutExtension),
            Is.EquivalentTo(Ids));

    [Test]
    public void CsvToChart_RunsInBothProfiles_AndRanksWallFirst()
    {
        var doc = Document("csv-to-chart");
        var runtime = RelationRuntime.FromRoots([NrcPaths.SamplesDir]);
        foreach (var registry in new[] { HostComposition.TablePacks(runtime), HostComposition.AllPacks(runtime) })
        {
            var chart = Table(EvaluateGreen(doc, "csv-to-chart", registry), "answer");
            Assert.Multiple(() =>
            {
                Assert.That(chart.Rows, Has.Count.EqualTo(9), "Q5: nine categories");
                Assert.That(chart.ColumnNames(), Is.EqualTo(new[] { "Category", "Total" }), "the chart projects label then value");
                Assert.That(chart.Cell("Category", 0), Is.EqualTo("Wall"));
                Assert.That(Convert.ToDouble(chart.Cell("Total", 0)), Is.EqualTo(22854.1).Within(0.05), "Q5: Wall first");
            });
        }
    }

    [Test]
    public void BosToRelations_CountsDuplexEntitiesPerCategory()
    {
        var doc = WithParam(Document("bos-to-relations"), "model", "path", DuplexBos.Value.Replace('\\', '/'));
        var chart = Table(EvaluateGreen(doc, "bos-to-relations", Fixture.Registry(Fixture.Runtime)), "answer");
        var doors = Enumerable.Range(0, chart.Rows.Count).First(r => Equals(chart.Cell("Category", r), "IFCDOOR"));
        Assert.Multiple(() =>
        {
            Assert.That(chart.ColumnNames(), Is.EqualTo(new[] { "Category", "Elements" }));
            Assert.That(Convert.ToInt64(chart.Cell("Elements", doors)), Is.EqualTo(14), "door_verdicts.csv lists 14 doors");
            Assert.That(chart.Rows.Count, Is.GreaterThan(10), "Duplex has more than ten entity categories");
        });
    }

    [Test]
    public void IfcToVerdictsAndChart_ColoursDoors_CountsVerdicts_AndWritesTheReport()
    {
        var reportDir = Path.Combine(Path.GetTempPath(), "bof-showcase-report", Guid.NewGuid().ToString("N"));
        var reportPath = Path.Combine(reportDir, "dc-w1-verdicts.html");
        var doc = WithParam(Document("ifc-to-verdicts-and-chart"), "report", "path", reportPath.Replace('\\', '/'));
        var registry = Fixture.Registry(Fixture.Runtime);
        var snapshot = RunGreen(doc, "ifc-to-verdicts-and-chart", registry, "report");
        var verdicts = Table(snapshot, "answer");
        var chart = Table(snapshot, "chart");
        var coloured = Table(snapshot, "coloured");
        var report = Table(snapshot, "report");
        try
        {
            Assert.Multiple(() =>
            {
                Assert.That(verdicts.Rows, Has.Count.EqualTo(14), "14 doors");
                Assert.That(chart.ColumnNames(), Is.EqualTo(new[] { "verdict", "Doors" }));
                Assert.That(chart.Rows, Has.Count.EqualTo(2), "Pass and Fail");
                Assert.That(chart.Cell("verdict", 0), Is.EqualTo("Pass"), "sorted desc by count: 8 Pass before 6 Fail");
                Assert.That(Convert.ToInt64(chart.Cell("Doors", 0)), Is.EqualTo(8));
                Assert.That(Convert.ToInt64(chart.Cell("Doors", 1)), Is.EqualTo(6));
                Assert.That(coloured.ColumnNames(), Is.SupersetOf(new[] { "r", "g", "b", "a" }), "view3d.color appends a colour per instance");
                Assert.That(coloured.Rows, Is.Not.Empty);
                Assert.That(File.Exists(reportPath), Is.True, "sink.report wrote the file when run");
                Assert.That(File.ReadAllText(reportPath), Does.Contain("DC-W1 door width verdicts").And.Contain("Pass"));
                Assert.That(Convert.ToInt64(report.Cell("rowCount", 0)), Is.EqualTo(14));
            });
        }
        finally
        {
            try { Directory.Delete(reportDir, recursive: true); } catch (IOException) { }
        }
    }
}
