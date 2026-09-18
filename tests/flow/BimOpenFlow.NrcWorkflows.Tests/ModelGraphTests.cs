using System.Globalization;
using System.Text.RegularExpressions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.Geometry;
using BimOpenFlow.Relations;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The model-backed graphs in samples/nrc-analyses: each document validates against the
/// bim-profile registry plus the rel.* pack, evaluates green, and its answer node reproduces the
/// numbers the NRC paper published. Every asserted number cites
/// nrc-ifc-llm/poc/results/expected_answers.json, poc/data/nrc_analytics_storeys.csv, or the
/// committed copies of those files under samples/nrc.
/// The database comes from <see cref="Fixture"/>, built from samples/nrc/duplex-enriched.ifc.</summary>
[TestFixture]
public sealed class ModelGraphTests
{
    private const double Tolerance = 0.05;

    private static RelationRuntime Runtime => Fixture.Runtime;

    /// <summary>The document as the host seeds it: {SAMPLES} rewritten to samples/nrc.</summary>
    private static GraphDocument Document(string id)
        => SampleSeeding.RewritePaths(GraphDocumentIO.Load(NrcPaths.Graph(id)), NrcPaths.SamplesDir);

    /// <summary>Validates and evaluates the document, asserting that every node reached Ok.</summary>
    private static EvalSnapshot EvaluateGreen(GraphDocument doc, string id, NodeRegistry registry)
    {
        Assert.That(doc.Validate(registry), Is.Empty, id);
        var snapshot = doc.Evaluate(registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, id);
        return snapshot;
    }

    /// <summary>The rows of the answer node, whether it carries a Relation or an ordinary Table.</summary>
    private static IDataTable AnswerRows(EvalSnapshot snapshot, RelationRuntime runtime)
        => snapshot.Results["answer"].Outputs[0] switch
        {
            RelationValue relation => runtime.Materialize((Plan)relation.Payload!),
            TableValue table => table.Table,
            var other => throw new InvalidOperationException($"answer carries a {other.GetType().Name}"),
        };

    private static double Number(IDataTable table, string column, int row)
        => Convert.ToDouble(table.Cell(column, row));

    [Test]
    public void StoreyOfElement_MatchesTheStoreyCsv()
    {
        var runtime = Runtime;
        var snapshot = EvaluateGreen(Document("nrc-storey-of-element"), "nrc-storey-of-element",
            Fixture.Registry(runtime));
        var answer = AnswerRows(snapshot, runtime);

        // nrc_analytics_storeys.csv has four storey rows (the fifth, "Building", is the whole model),
        // here in descending embodied carbon, which is also the order of expected_answers.json Q8.
        Assert.That(answer.Rows, Has.Count.EqualTo(4));
        Assert.That(answer.ColumnCells("StoreyName"),
            Is.EqualTo(new object?[] { "Level 1", "Level 2", "T/FDN", "Roof" }));

        // nrc_analytics_storeys.csv columns Elements and EmbodiedCarbon_A1A3_kgCO2e, row by row.
        Assert.That(answer.ColumnCells("Elements"), Is.EqualTo(new object?[] { 103L, 93L, 14L, 8L }));
        Assert.That(Number(answer, "Embodied", 0), Is.EqualTo(49451.2).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 1), Is.EqualTo(48696.8).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 2), Is.EqualTo(11761.3).Within(Tolerance));
        Assert.That(Number(answer, "Embodied", 3), Is.EqualTo(5821.0).Within(Tolerance));
    }

    [Test]
    public void DcW1Verdicts_MatchTheDoorVerdictsCsv()
    {
        var runtime = Runtime;
        var snapshot = EvaluateGreen(Document("nrc-dc-w1-verdicts"), "nrc-dc-w1-verdicts",
            Fixture.Registry(runtime));
        var answer = AnswerRows(snapshot, runtime);

        // samples/nrc/door_verdicts.csv holds 14 DC-W1 rows, one per IFCDOOR, 8 pass and 6 fail;
        // docs/proposals/nrc-handoff-samples.md quotes the same split.
        var expected = DoorVerdicts();
        Assert.That(expected, Has.Count.EqualTo(14));
        Assert.That(answer.Rows, Has.Count.EqualTo(14));
        Assert.That(answer.ColumnCells("verdict").Count(v => Equals(v, "Pass")), Is.EqualTo(8));
        Assert.That(answer.ColumnCells("verdict").Count(v => Equals(v, "Fail")), Is.EqualTo(6));

        // Door by door, against the same file's globalId and verdict columns.
        Assert.That(answer.ColumnCells("globalId"), Is.EqualTo(expected.Keys.Order(StringComparer.Ordinal)));
        for (var row = 0; row < answer.Rows.Count; row++)
        {
            var globalId = (string)answer.Cell("globalId", row)!;
            Assert.That(answer.Cell("verdict", row), Is.EqualTo(expected[globalId].Verdict), globalId);
            Assert.That(Number(answer, "Width_mm", row),
                Is.EqualTo(expected[globalId].WidthMm).Within(Tolerance), globalId);
        }

        Assert.That(answer.ColumnCells("checkId"), Has.All.EqualTo("DC-W1"));

        // view3d.color runs downstream and outputs the coloured instance table, not the verdicts,
        // so "answer" is the check.rule node. Its colour columns still prove the join landed.
        var coloured = ((TableValue)snapshot.Results["coloured"].Outputs[0]).Table;
        Assert.That(coloured.ColumnNames(), Does.Contain("r").And.Contains("a"));
        // A door is placed as several meshes, so the rows are per mesh; the 14 doors are what matters.
        var doorRows = Enumerable.Range(0, coloured.Rows.Count)
            .Where(row => coloured.Cell("globalId", row) is string id && expected.ContainsKey(id))
            .ToList();
        Assert.That(doorRows.Select(row => coloured.Cell("globalId", row)).Distinct().Count(),
            Is.EqualTo(14), "every door should appear in the coloured instance table");
        Assert.That(doorRows.Select(row => coloured.Cell("r", row)),
            Has.None.EqualTo(ColorNode.Unmatched.R), "door instances should take a verdict colour");
    }

    /// <summary>One DC-W1 row of samples/nrc/door_verdicts.csv:
    /// "globalId","DC-W1",verdict,"IFCDOOR.OverallWidth attribute = 762mm; ...","citation".</summary>
    private static readonly Regex DcW1Row = new(
        """^"(?<id>[^"]*)","DC-W1",(?<verdict>\w+),"[^=]*= (?<width>[\d.]+)mm;""");

    /// <summary>The DC-W1 rows by globalId: the expected verdict in check.rule's spelling, and the
    /// width the evidence text quotes in millimetres.</summary>
    private static IReadOnlyDictionary<string, (string Verdict, double WidthMm)> DoorVerdicts()
        => File.ReadLines(Path.Combine(NrcPaths.SamplesDir, "door_verdicts.csv"))
            .Select(line => DcW1Row.Match(line))
            .Where(m => m.Success)
            .ToDictionary(
                m => m.Groups["id"].Value,
                m => (m.Groups["verdict"].Value == "pass" ? "Pass" : "Fail",
                    double.Parse(m.Groups["width"].Value, CultureInfo.InvariantCulture)));
}
