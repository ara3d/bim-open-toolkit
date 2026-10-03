using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
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
/// samples/nrc/README.md (218 elements, 5 storey rows) and RollupGraphTests (2,441 property
/// writes); the nine categories cite expected_answers.json Q5.</summary>
[TestFixture]
public sealed class FigureGraphTests
{
    private static readonly NodeRegistry Registry = StudioComposition.BimPacks();

    /// <summary>nrc-color-operational-carbon is the one "colour by an analytics column" flow (the
    /// review's merge of nrc-color-category and nrc-color-embodied-carbon into it); a figure for
    /// another column sets `answer`'s valueColumn/colorMap the way the walkthrough does.</summary>
    private static IDataTable Answer(string id, IReadOnlyDictionary<string, string>? paramOverrides = null)
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
        return ((TableValue)snapshot.Results["answer"].Outputs[0]).Table;
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
        // excludes it (its total is stated in the title instead); see PROJECT.md's "honest
        // absence" principle and, more directly, that a total plotted as a peer distorts the
        // axis and shrinks the real storeys to slivers.
        var chart = Answer("nrc-storey-carbon-chart");
        Assert.Multiple(() =>
        {
            Assert.That(chart.ColumnNames(), Is.EqualTo(new[]
                { "Container", "EmbodiedCarbon_A1A3_kgCO2e", "OperationalCarbon_kgCO2e_per_year" }));
            Assert.That(chart.Rows, Has.Count.EqualTo(4), "the four storeys only, no Building row");
            Assert.That(chart.ColumnCells("Container"), Has.None.EqualTo("Building"));
            Assert.That(chart.Cell("Container", 0), Is.EqualTo("Level 1"), "Level 1 at 49451.2 before Level 2 at 48696.8");
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
        Assert.Multiple(() =>
        {
            Assert.That(values, Has.Count.EqualTo(2441), "2,441 property values were written");
            Assert.That(values.Select(r => (r.EntityId, r.PsetName, r.ParamName)),
                Is.EquivalentTo(written.Select(r => (r.EntityId, r.PsetName, r.ParamName))));
        });
    }
}
