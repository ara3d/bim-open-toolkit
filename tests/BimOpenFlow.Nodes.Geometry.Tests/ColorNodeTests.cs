using Ara3D.DataFlowEngine.Abstractions;
using static BimOpenFlow.Nodes.Geometry.Tests.TestSupport;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class ColorNodeTests
{
    private const double Tolerance = 1e-9;
    private static readonly ColorNode Node = new();

    private static ParamValues ColorParams(string map = "viridis")
        => Params(("joinColumn", "entityId"), ("valueColumn", "score"), ("colorMap", map));

    [Test]
    public void NumericGradient_EndpointRowsGetEndpointColors()
    {
        var instances = Instances(1, 2, 3);
        var values = Table("scores",
            ("entityId", new long[] { 1, 2, 3 }),
            ("score", new double[] { 0, 5, 10 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams());

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
        var instances = Instances(1, 2);
        var values = Table("scores",
            ("entityId", new long[] { 1, 2 }),
            ("score", new double[] { 0, 1 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams("redgreen"));

        Assert.That(RowColor(result, 0).R, Is.EqualTo(ColorMaps.RedGreenStops[0].R).Within(Tolerance));
        Assert.That(RowColor(result, 1).G, Is.EqualTo(ColorMaps.RedGreenStops[^1].G).Within(Tolerance));
    }

    [Test]
    public void UnmatchedRows_GetGray()
    {
        var instances = Instances(1, 99);
        var values = Table("scores",
            ("entityId", new long[] { 1 }),
            ("score", new double[] { 3 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams());

        var (r, g, b, a) = RowColor(result, 1);
        Assert.That((r, g, b, a), Is.EqualTo((0.5, 0.5, 0.5, 1.0)));
    }

    [Test]
    public void Categorical_StableUnderRowReordering()
    {
        var instances = Instances(1, 2, 3);
        var values = Table("cats",
            ("entityId", new long[] { 1, 2, 3 }),
            ("score", new[] { "Wall", "Door", "Slab" }));
        var permuted = Table("cats",
            ("entityId", new long[] { 3, 1, 2 }),
            ("score", new[] { "Slab", "Wall", "Door" }));

        var a = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams("category10"));
        var b = OutputTable(Node, [new TableValue(instances), new TableValue(permuted)], ColorParams("category10"));

        for (var row = 0; row < 3; row++)
            Assert.That(RowColor(a, row), Is.EqualTo(RowColor(b, row)));
    }

    [Test]
    public void TextValues_WithGradientMap_WarnsAndUsesCategorical()
    {
        var instances = Instances(1, 2);
        var values = Table("cats",
            ("entityId", new long[] { 1, 2 }),
            ("score", new[] { "A", "B" }));

        var context = new TestEvalContext();
        var result = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams(), context);

        Assert.That(context.Warnings, Has.Count.EqualTo(1));
        Assert.That(RowColor(result, 0).R, Is.EqualTo(ColorMaps.Category10[0].R).Within(Tolerance));
        Assert.That(RowColor(result, 1).R, Is.EqualTo(ColorMaps.Category10[1].R).Within(Tolerance));
    }

    [Test]
    public void Output_PreservesOriginalColumnsAndAppendsRgba()
    {
        var instances = Instances(1);
        var values = Table("scores",
            ("entityId", new long[] { 1 }),
            ("score", new double[] { 1 }));

        var result = OutputTable(Node, [new TableValue(instances), new TableValue(values)], ColorParams());

        Assert.That(ColumnNames(result), Is.EqualTo(new[] { "instanceIndex", "entityId", "r", "g", "b", "a" }));
        Assert.That(Cell(result, "entityId", 0), Is.EqualTo(1L));
    }
}
