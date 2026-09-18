using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using BimOpenFlow.Host;
using BimOpenFlow.Nodes.Geometry;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The graphs behind the NRC paper's figures: three 3D colourings of duplex-enriched.ifc
/// from the elements CSV, the per-storey carbon bar chart, and the table of written property
/// values. Each evaluates green with the bim-profile registry and its answer node carries what
/// the figure shows. Row counts cite samples/nrc/README.md (218 elements, 5 storey rows, 2438
/// property writes); the nine categories cite expected_answers.json Q5.</summary>
[TestFixture]
public sealed class FigureGraphTests
{
    private static readonly NodeRegistry Registry = HostComposition.AllPacks();

    private static IDataTable Answer(string id)
    {
        var doc = SampleSeeding.RewritePaths(GraphDocumentIO.Load(NrcPaths.Graph(id)), NrcPaths.SamplesDir);
        Assert.That(doc.Validate(Registry), Is.Empty, id);
        var snapshot = doc.Evaluate(Registry);
        Assert.That(snapshot.Results.Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}"), Is.Empty, id);
        return ((TableValue)snapshot.Results["answer"].Outputs[0]).Table;
    }

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
    [TestCase("nrc-color-operational-carbon", 216)]
    [TestCase("nrc-color-embodied-carbon", 215)]
    public void GradientColouring_ColoursEveryElementWithAValue_AndLeavesTheRestGrey(string id, int colouredElements)
    {
        var coloured = Answer(id);
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
        var coloured = Answer("nrc-color-category");
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
    public void StoreyCarbonChart_HasOneBarPerContainer_SortedByEmbodiedCarbon()
    {
        var chart = Answer("nrc-storey-carbon-chart");
        Assert.Multiple(() =>
        {
            Assert.That(chart.ColumnNames(), Is.EqualTo(new[]
                { "Container", "EmbodiedCarbon_A1A3_kgCO2e", "OperationalCarbon_kgCO2e_per_year" }));
            Assert.That(chart.Rows, Has.Count.EqualTo(5), "four storeys and the Building row");
            Assert.That(chart.Cell("Container", 0), Is.EqualTo("Building"), "the building total sorts first");
            Assert.That(chart.Cell("Container", 1), Is.EqualTo("Level 1"), "Level 1 at 49451.2 before Level 2 at 48696.8");
        });
    }

    [Test]
    public void PropertyValuesTable_ListsEveryWrittenValue()
    {
        var values = Answer("nrc-property-values");
        Assert.Multiple(() =>
        {
            Assert.That(values.Rows, Has.Count.EqualTo(2438), "2,438 property values were written");
            Assert.That(values.ColumnNames(), Is.EqualTo(new[] { "entityId", "psetName", "paramName", "valueType", "paramValue" }));
        });
    }
}
