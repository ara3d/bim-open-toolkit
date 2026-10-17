using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Relations;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.Geometry;
using BimOpenFlow.Studio;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The graphs behind the NRC paper's figures: nrc-color-operational-carbon (one "colour
/// by an analytics column" flow, its valueColumn/colorMap set per figure for embodied carbon and
/// category, as the walkthrough does; it absorbed nrc-color-category and
/// nrc-color-embodied-carbon) over duplex-enriched.ifc and the elements CSV, the per-storey carbon
/// bar chart, and the table of written property values. Each evaluates green with the bim-profile
/// registry and its answer node carries what the figure shows. Row counts cite
/// samples/nrc/README.md (218 elements, 5 storey rows) and RollupGraphTests (2,469 property
/// writes); the nine categories cite expected_answers.json Q5.</summary>
[TestFixture]
public sealed class FigureGraphTests
{
    private static readonly NodeRegistry Registry = StudioComposition.BimPacks();

    /// <summary>nrc-color-operational-carbon is the one "colour by an analytics column" flow (the
    /// review's merge of nrc-color-category and nrc-color-embodied-carbon into it); a figure for
    /// another column sets `answer`'s valueColumn/colorMap the way the walkthrough does.</summary>
    private static IDataTable Answer(string id, IReadOnlyDictionary<string, string>? paramOverrides = null)
        => Table(id, "answer", paramOverrides);

    /// <summary>Evaluates the graph green and returns the first output table of one node.</summary>
    private static IDataTable Table(string id, string nodeId, IReadOnlyDictionary<string, string>? paramOverrides = null)
    {
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(NrcPaths.Graph(id)), NrcPaths.SamplesDir);
        if (paramOverrides is not null)
            doc = doc with
            {
                Values = doc.Values.ToDictionary(
                    node => node.Key,
                    node => node.Key != "answer"
                        ? node.Value
                        : (IReadOnlyDictionary<string, string>)node.Value.ToDictionary(
                            p => p.Key, p => paramOverrides.TryGetValue(p.Key, out var v) ? v : p.Value)),
            };
        Assert.That(doc.Validate(Registry), Is.Empty, id);
        var snapshot = doc.Evaluate(Registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, id);
        return ((TableValue)snapshot.Results[nodeId].Outputs[0]).Table;
    }

    private static readonly IReadOnlyDictionary<string, string> EmbodiedCarbonColumn = new Dictionary<string, string>
        { ["valueColumn"] = "EmbodiedCarbon_A1A3_kgCO2e", ["colorMap"] = "viridis" };

    private static readonly IReadOnlyDictionary<string, string> CategoryColumn = new Dictionary<string, string>
        { ["valueColumn"] = "Category", ["colorMap"] = "category10" };

    private static bool IsUnmatched(IDataTable coloured, int row)
        => Convert.ToDouble(coloured.Cell("r", row)) == ColorNode.Unmatched.R
           && Convert.ToDouble(coloured.Cell("g", row)) == ColorNode.Unmatched.G
           && Convert.ToDouble(coloured.Cell("b", row)) == ColorNode.Unmatched.B;

    /// <summary>Distinct GlobalIds whose instances received a colour from the value table.</summary>
    private static HashSet<string> ColouredElements(IDataTable coloured)
        => Enumerable.Range(0, coloured.Rows.Count)
            .Where(row => !IsUnmatched(coloured, row))
            .Select(row => (string)coloured.Cell("globalId", row)!)
            .ToHashSet(StringComparer.Ordinal);

    /// <summary>Of the 218 analysed elements, 216 have a mesh in the converted geometry (two are
    /// placed without one), and the roof has no embodied-carbon value, so the embodied gradient
    /// colours one fewer: its absence is visible as grey, which is the paper's Q7 point.</summary>
    [TestCase(null, 216)]
    [TestCase("EmbodiedCarbon_A1A3_kgCO2e", 215)]
    public void GradientColouring_ColoursEveryElementWithAValue_AndLeavesTheRestGrey(string? column, int colouredElements)
    {
        const string id = "nrc-color-operational-carbon";
        var coloured = Answer(id, column is null ? null : EmbodiedCarbonColumn);
        Assert.Multiple(() =>
        {
            Assert.That(coloured.ColumnNames(), Is.SupersetOf(new[] { "globalId", "r", "g", "b", "a" }));
            Assert.That(ColouredElements(coloured), Has.Count.EqualTo(colouredElements));
            Assert.That(Enumerable.Range(0, coloured.Rows.Count).Count(row => IsUnmatched(coloured, row)),
                Is.GreaterThan(0), "unanalysed instances (openings, spaces) stay grey");
        });
    }

    /// <summary>nrc-color-zone-eui colours each space by the intensity stored on its zone, read back from the
    /// enriched file through ZoneOfSpace: the 20 spaces of the four zones take four colours, and the roof
    /// space R301 and every non-space instance stay grey.</summary>
    [Test]
    public void ZoneColouring_ColoursTheTwentyZonedSpacesInFourColours_AndLeavesTheRestGrey()
    {
        // The graph reads the zone values through relations, so it needs the relation runtime's sources.
        var snapshot = ModelGraphTests.EvaluateGreen(
            ModelGraphTests.Document("nrc-color-zone-eui"), "nrc-color-zone-eui", Fixture.Registry(Fixture.Runtime));
        var coloured = ((TableValue)snapshot.Results["answer"].Outputs[0]).Table;
        var colouredRows = Enumerable.Range(0, coloured.Rows.Count).Where(row => !IsUnmatched(coloured, row)).ToList();
        var palette = colouredRows
            .Select(row => (coloured.Cell("r", row), coloured.Cell("g", row), coloured.Cell("b", row)))
            .Distinct()
            .Count();
        var zoned = ZonedSpaceIds();
        Assert.Multiple(() =>
        {
            Assert.That(coloured.ColumnNames(), Is.SupersetOf(new[] { "globalId", "r", "g", "b", "a" }));
            Assert.That(ColouredElements(coloured), Is.EquivalentTo(zoned), "exactly the 20 spaces that are in a zone");
            Assert.That(zoned, Has.Count.EqualTo(20));
            Assert.That(palette, Is.EqualTo(4), "one colour for each of the four zone intensities");
            Assert.That(Enumerable.Range(0, coloured.Rows.Count).Count(row => IsUnmatched(coloured, row)),
                Is.GreaterThan(0), "the roof space and the building elements stay grey");
        });
    }

    private static HashSet<string> ZonedSpaceIds()
    {
        var zones = Fixture.Runtime.Materialize(Plans.Csv("nrc", "nrc-zones.csv"));
        return Enumerable.Range(0, zones.Rows.Count).Select(r => (string)zones.Cell("SpaceGlobalId", r)!)
            .ToHashSet(StringComparer.Ordinal);
    }

    [Test]
    public void CategoryColouring_UsesOneColourPerCategory()
    {
        var coloured = Answer("nrc-color-operational-carbon", CategoryColumn);
        var palette = Enumerable.Range(0, coloured.Rows.Count)
            .Where(row => !IsUnmatched(coloured, row))
            .Select(row => (coloured.Cell("r", row), coloured.Cell("g", row), coloured.Cell("b", row)))
            .Distinct()
            .Count();
        Assert.Multiple(() =>
        {
            Assert.That(ColouredElements(coloured), Has.Count.EqualTo(216), "every analysed element with a mesh");
            Assert.That(palette, Is.EqualTo(9), "Q5: nine categories, each with its own colour");
        });
    }

    [Test]
    public void StoreyCarbonChart_HasOneBarPerStorey_SortedByEmbodiedCarbon()
    {
        // The Building row is the sum of the four storeys, not a fifth storey, so the chart
        // excludes it (buildingTotal shows it instead): a total plotted as a peer distorts the
        // axis and shrinks the real storeys to slivers. table.rename gives the two series the
        // readable names the legend shows.
        var chart = Answer("nrc-storey-carbon-chart");
        Assert.Multiple(() =>
        {
            Assert.That(chart.ColumnNames(), Is.EqualTo(new[]
                { "Container", "Embodied A1-A3 (kgCO2e)", "Operational (kgCO2e/yr)" }));
            Assert.That(chart.Rows, Has.Count.EqualTo(4), "the four storeys only, no Building row");
            Assert.That(chart.ColumnCells("Container"), Has.None.EqualTo("Building"));
            Assert.That(chart.Cell("Container", 0), Is.EqualTo("Level 1"), "Level 1 at 49451.2 before Level 2 at 48696.8");
        });
    }

    /// <summary>The building total comes from the CSV's Building row, not from a number typed
    /// into the chart title: nrc_analytics_storeys.csv gives 115,730.3 kgCO2e embodied and
    /// 37,196.2 kgCO2e/yr operational (expected_answers.json Q1 for the latter).</summary>
    [Test]
    public void StoreyCarbonChart_BuildingTotalIsATable()
    {
        var total = Table("nrc-storey-carbon-chart", "buildingTotal");
        Assert.Multiple(() =>
        {
            Assert.That(total.Rows, Has.Count.EqualTo(1));
            Assert.That(total.Cell("Container", 0), Is.EqualTo("Building"));
            Assert.That(Convert.ToDouble(total.Cell("Embodied A1-A3 (kgCO2e)", 0)), Is.EqualTo(115730.3).Within(0.05));
            Assert.That(Convert.ToDouble(total.Cell("Operational (kgCO2e/yr)", 0)), Is.EqualTo(37196.2).Within(0.05));
        });
    }

    /// <summary>Figure 4 reads the values back from duplex-enriched.ifc: one row for each row the
    /// graphs nrc-element-psets and nrc-rollup handed the writer, on the same entity and set.</summary>
    [Test]
    public void PropertyValuesTable_ReadsBackEveryWrittenValue()
    {
        const string id = "nrc-property-values";
        var runtime = Fixture.Runtime;
        var values = RollupGraphTests.PsetRow.All(ModelGraphTests.AnswerRows(
            ModelGraphTests.EvaluateGreen(ModelGraphTests.Document(id), id, Fixture.Registry(runtime)), runtime));
        var written = RollupGraphTests.Answer("nrc-element-psets").Concat(RollupGraphTests.Answer("nrc-rollup"));
        var zoneValues = values.Where(r => r.PsetName == "NRC_ZoneSummary").ToList();
        var others = values.Where(r => r.PsetName != "NRC_ZoneSummary").ToList();
        Assert.Multiple(() =>
        {
            Assert.That(others, Has.Count.EqualTo(2441), "2,441 element, storey, building and project values");
            Assert.That(others.Select(r => (r.EntityId, r.PsetName, r.ParamName)),
                Is.EquivalentTo(written.Select(r => (r.EntityId, r.PsetName, r.ParamName))));
            Assert.That(zoneValues, Has.Count.EqualTo(28), "7 values on each of the 4 zones");
        });
    }
}
