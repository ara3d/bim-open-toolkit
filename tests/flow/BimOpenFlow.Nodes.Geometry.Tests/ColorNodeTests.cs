using Ara3D.DataFlowEngine.Abstractions;
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

    private static (IDataTable Instances, IDataTable Legend, IReadOnlyList<string> Warnings) EvalWithLegend(
        IReadOnlyList<FlowValue> inputs, params (string Name, string Value)[] ps)
    {
        var ctx = new FakeEvalContext();
        var outputs = Node.Eval(ctx, inputs, Params(ps));
        return (((TableValue)outputs[0]).Table, ((TableValue)outputs[1]).Table, ctx.Warnings);
    }

    private static int RoleRow(IDataTable legend, string role)
        => legend.ColumnCells("role").Select((cell, i) => ((string)cell!, i)).Single(x => x.Item1 == role).i;

    [Test]
    public void ManualDomain_ClampsValuesAboveItAndReportsLegend()
    {
        var values = Table(
            ("entityId", typeof(long), new object?[] { 1L, 2L, 3L, 4L, 5L }),
            ("meshVolume", typeof(double), new object?[] { 0.2, 0.5, 1.4, 3.0, null }));

        var (result, legend, warnings) = EvalWithLegend(
            [Instances(1, 2, 3, 4, 5), values],
            ("joinColumn", "entityId"), ("valueColumn", "meshVolume"), ("colorMap", "viridis"),
            ("auto", "false"), ("min", "0"), ("max", "1"));

        // meshVolume: entityId 3 -> 1.4, entityId 4 -> 3.0; both lie above the manual domain 0..1.
        Assert.That(RowColor(result, 2).R, Is.EqualTo(ColorMaps.ViridisStops[^1].R).Within(Tolerance));
        Assert.That(RowColor(result, 3).G, Is.EqualTo(ColorMaps.ViridisStops[^1].G).Within(Tolerance));

        var stopValues = legend.ColumnCells("role").Select((cell, i) => ((string)cell!, i))
            .Where(x => x.Item1 == "stop").Select(x => (double)legend.Cell("value", x.i)!).ToList();
        Assert.That(stopValues, Is.EqualTo(new[] { 0.0, 0.25, 0.5, 0.75, 1.0 }));

        Assert.That(legend.Cell("count", RoleRow(legend, "above")), Is.EqualTo(2L));
        Assert.That(legend.Cell("count", RoleRow(legend, "missing")), Is.EqualTo(1L));
        Assert.That(legend.ColumnCells("role"), Has.No.Member("below"));

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(warnings[0], Does.Contain("2 of 5"));
        Assert.That(warnings[0], Does.Contain("(0 below, 2 above)"));
    }

    [Test]
    public void MinNotLessThanMax_FallsBackToDataRangeAndReportsAutoDomain()
    {
        var values = Table(
            ("entityId", typeof(long), new object?[] { 1L, 2L, 3L }),
            ("score", typeof(double), new object?[] { 1.0, 2.0, 3.0 }));

        var (_, legend, warnings) = EvalWithLegend(
            [Instances(1, 2, 3), values],
            ("joinColumn", "entityId"), ("valueColumn", "score"), ("colorMap", "viridis"),
            ("auto", "false"), ("min", "5"), ("max", "5"));

        Assert.That(warnings, Has.Count.EqualTo(1));
        Assert.That(legend.Cell("domain", 0), Is.EqualTo("auto"));

        var stopValues = legend.ColumnCells("role").Select((cell, i) => ((string)cell!, i))
            .Where(x => x.Item1 == "stop").Select(x => (double)legend.Cell("value", x.i)!).ToList();
        Assert.That(stopValues.First(), Is.EqualTo(1.0));
        Assert.That(stopValues.Last(), Is.EqualTo(3.0));
    }

    [Test]
    public void ScaleInput_ColoursThroughItAndPassesTheLegendThroughUnchanged()
    {
        var values = Table(
            ("entityId", typeof(long), new object?[] { 1L, 2L, 3L }),
            ("score", typeof(double), new object?[] { 0.0, 5.0, 10.0 }));

        var scale = ColorScale.Build(values.Table, values.Table.ColumnIndex("score"), "viridis",
            auto: true, min: 0, max: 1, Ctx, "test.scale");
        var scaleTable = scale.ToTable();

        var (result, legend, warnings) = EvalWithLegend(
            [Instances(1, 2, 3), values, new TableValue(scaleTable)],
            ("joinColumn", "entityId"), ("valueColumn", ""), ("colorMap", "viridis"),
            ("auto", "true"), ("min", "0"), ("max", "1"));

        Assert.That(warnings, Is.Empty);
        Assert.That(legend.RowCount(), Is.EqualTo(scaleTable.RowCount()));
        foreach (var column in new[] { "column", "domain", "role", "label", "value", "r", "g", "b", "count" })
            Assert.That(legend.ColumnCells(column), Is.EqualTo(scaleTable.ColumnCells(column)), $"column '{column}'");

        Assert.That(RowColor(result, 0).R, Is.EqualTo(ColorMaps.ViridisStops[0].R).Within(Tolerance));
        Assert.That(RowColor(result, 2).B, Is.EqualTo(ColorMaps.ViridisStops[^1].B).Within(Tolerance));
    }
}
