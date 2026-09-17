using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;
using static BimOpenFlow.Nodes.Geometry.Tests.GeometryTestData;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class ColorNodeTests
{
    private const double Tolerance = 1e-9;
    private static readonly ColorNode Node = new();

    private static (string Name, string Value)[] ColorParams(string map = "viridis")
        => [("joinColumn", "entityId"), ("valueColumn", "score"), ("colorMap", map)];

    private static (double R, double G, double B, double A) RowColor(IDataTable table, int row)
        => ((double)table.Cell("r", row)!, (double)table.Cell("g", row)!,
            (double)table.Cell("b", row)!, (double)table.Cell("a", row)!);

    [Test]
    public void NumericGradient_EndpointRowsGetEndpointColors()
    {
        var values = Table(
            ("entityId", new long[] { 1, 2, 3 }),
            ("score", new double[] { 0, 5, 10 }));

        var result = Node.EvalTable([Instances(1, 2, 3), values], ColorParams());

        var low = RowColor(result, 0);
        var mid = RowColor(result, 1);
        var high = RowColor(result, 2);
        Assert.That(low.R, Is.EqualTo(ColorMaps.ViridisStops[0].R).Within(Tolerance));
        Assert.That(mid.G, Is.EqualTo(ColorMaps.ViridisStops[2].G).Within(Tolerance));
        Assert.That(high.B, Is.EqualTo(ColorMaps.ViridisStops[^1].B).Within(Tolerance));
        Assert.That(low.A, Is.EqualTo(1));
    }

    [Test]
    public void RedGreen_LowIsRedHighIsGreen()
    {
        var values = Table(
            ("entityId", new long[] { 1, 2 }),
            ("score", new double[] { 0, 1 }));

        var result = Node.EvalTable([Instances(1, 2), values], ColorParams("redgreen"));

        Assert.That(RowColor(result, 0).R, Is.EqualTo(ColorMaps.RedGreenStops[0].R).Within(Tolerance));
        Assert.That(RowColor(result, 1).G, Is.EqualTo(ColorMaps.RedGreenStops[^1].G).Within(Tolerance));
    }

    [Test]
    public void UnmatchedRows_GetGray()
    {
        var values = Table(
            ("entityId", new long[] { 1 }),
            ("score", new double[] { 3 }));

        var result = Node.EvalTable([Instances(1, 99), values], ColorParams());

        var (r, g, b, a) = RowColor(result, 1);
        Assert.That((r, g, b, a), Is.EqualTo((0.5, 0.5, 0.5, 1.0)));
    }

    [Test]
    public void Categorical_StableUnderRowReordering()
    {
        var values = Table(
            ("entityId", new long[] { 1, 2, 3 }),
            ("score", new[] { "Wall", "Door", "Slab" }));
        var permuted = Table(
            ("entityId", new long[] { 3, 1, 2 }),
            ("score", new[] { "Slab", "Wall", "Door" }));

        var a = Node.EvalTable([Instances(1, 2, 3), values], ColorParams("category10"));
        var b = Node.EvalTable([Instances(1, 2, 3), permuted], ColorParams("category10"));

        for (var row = 0; row < 3; row++)
            Assert.That(RowColor(a, row), Is.EqualTo(RowColor(b, row)));
    }

    [Test]
    public void TextValues_WithGradientMap_WarnsAndUsesCategorical()
    {
        var values = Table(
            ("entityId", new long[] { 1, 2 }),
            ("score", new[] { "A", "B" }));

        var (result, warnings) = Node.EvalWithWarnings([Instances(1, 2), values], ColorParams());

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(RowColor(result, 0).R, Is.EqualTo(ColorMaps.Category10[0].R).Within(Tolerance));
        Assert.That(RowColor(result, 1).R, Is.EqualTo(ColorMaps.Category10[1].R).Within(Tolerance));
    }

    [Test]
    public void Output_PreservesOriginalColumnsAndAppendsRgba()
    {
        var values = Table(
            ("entityId", new long[] { 1 }),
            ("score", new double[] { 1 }));

        var result = Node.EvalTable([Instances(1), values], ColorParams());

        Assert.That(result.ColumnNames(), Is.EqualTo(new[] { "instanceIndex", "entityId", "r", "g", "b", "a" }));
        Assert.That(result.Cell("entityId", 0), Is.EqualTo(1L));
    }
}
