using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using static Ara3D.DataFlowEngine.TestKit.NodeTestHelpers;

namespace BimOpenFlow.Nodes.Geometry.Tests;

/// <summary>view3d.label over in-memory instance and values tables; no graph.</summary>
[TestFixture]
public sealed class LabelNodeTests
{
    private static readonly LabelNode Node = new();

    /// <summary>Three instances: entity 1 has two boxes, entity 2 one; storeys S1, S1, S2.</summary>
    private static TableValue Instances()
        => Table(
            ("entityId", new long[] { 1, 1, 2 }),
            ("storey", new[] { "S1", "S1", "S2" }),
            ("minX", new double[] { 0, 4, 10 }), ("minY", new double[] { 0, 2, 0 }), ("minZ", new double[] { 0, 1, 3 }),
            ("maxX", new double[] { 2, 6, 12 }), ("maxY", new double[] { 2, 4, 2 }), ("maxZ", new double[] { 3, 5, 4 }));

    private static IDataTable Eval(IReadOnlyList<FlowValue> inputs, params (string, string)[] ps)
        => Node.EvalTable(inputs, ps);

    [Test]
    public void OneLabelPerEntity_OnFirstRow_AnchoredOverTheUnionBox()
    {
        var values = Table(("entityId", new long[] { 1, 2 }), ("width", new double[] { 900, 800 }));

        var result = Eval([Instances(), values], ("format", "W {width}"));

        Assert.Multiple(() =>
        {
            Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "W 900", null, "W 800" }));
            // Union of entity 1: x 0..6, y 0..4, z 0..5. Top centre: (3, 2, 5).
            Assert.That(new[] { result.Cell("labelX", 0), result.Cell("labelY", 0), result.Cell("labelZ", 0) },
                Is.EqualTo(new object?[] { 3.0, 2.0, 5.0 }));
            Assert.That(result.Cell("labelX", 1), Is.Null);
            Assert.That(result.Cell("labelZ", 2), Is.EqualTo(4.0));
            Assert.That(result.ColumnNames().Take(8), Is.EqualTo(Instances().Table.ColumnNames()));
        });
    }

    [Test]
    public void GroupColumn_OneLabelPerGroup_ReadsFirstValuesRow()
    {
        var values = Table(("entityId", new long[] { 1, 2 }), ("carbon", new double[] { 12.34, 99 }));

        var result = Eval([Instances(), values], ("format", "{carbon:0.0} kg"), ("groupColumn", "storey"));

        Assert.Multiple(() =>
        {
            Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "12.3 kg", null, "99.0 kg" }));
            Assert.That(result.Cell("labelX", 0), Is.EqualTo(3.0));
            Assert.That(result.Cell("labelZ", 0), Is.EqualTo(5.0));
        });
    }

    [Test]
    public void GroupColumn_MayBeAColumnOfTheValuesTable()
    {
        var values = Table(("entityId", new long[] { 1, 2 }), ("zone", new[] { "A", "A" }), ("n", new long[] { 7, 8 }));

        var result = Eval([Instances(), values], ("format", "{n}"), ("groupColumn", "zone"));

        Assert.Multiple(() =>
        {
            Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "7", null, null }));
            // Union of all three boxes: x 0..12, y 0..4, z top 5.
            Assert.That(new[] { result.Cell("labelX", 0), result.Cell("labelY", 0), result.Cell("labelZ", 0) },
                Is.EqualTo(new object?[] { 6.0, 2.0, 5.0 }));
        });
    }

    [Test]
    public void NullPlaceholderValue_GetsNoLabel()
    {
        var values = Table(("entityId", typeof(long), [1L, 2L]), ("width", typeof(double), [null, 800.0]));

        var result = Eval([Instances(), values], ("format", "W {width}"));

        Assert.Multiple(() =>
        {
            Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { null, null, "W 800" }));
            Assert.That(result.Cell("labelX", 0), Is.Null);
        });
    }

    [Test]
    public void EntityWithNoValuesRow_GetsNoLabel()
    {
        var values = Table(("entityId", new long[] { 2 }), ("width", new double[] { 800 }));

        var result = Eval([Instances(), values], ("format", "{width}"));

        Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { null, null, "800" }));
    }

    [Test]
    public void MissingPlaceholderColumn_ThrowsNamingItAndListingColumns()
    {
        var values = Table(("entityId", new long[] { 1 }), ("width", new double[] { 900 }));

        var ex = Assert.Throws<ArgumentException>(() => Eval([Instances(), values], ("format", "{height} mm")))!;

        Assert.Multiple(() =>
        {
            Assert.That(ex.Message, Does.Contain("'{height}'"));
            Assert.That(ex.Message, Does.Contain("entityId, width"));
        });
    }

    [Test]
    public void PastTheLimit_RestGetNoLabel_AndTheNodeWarnsOnce()
    {
        var values = Table(("entityId", new long[] { 1, 2 }), ("width", new double[] { 900, 800 }));

        var (result, warnings) = Node.EvalWithWarnings([Instances(), values], ("format", "{width}"), ("limit", "1"));

        Assert.Multiple(() =>
        {
            Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "900", null, null }));
            Assert.That(warnings, Has.Count.EqualTo(1));
            Assert.That(warnings[0], Does.Contain("1 labels dropped").And.Contain("limit of 1"));
        });
    }

    [Test]
    public void IntegerJoinColumn_JoinsTextIds()
    {
        var values = Table(("entityId", new[] { "1", "2" }), ("name", new[] { "Door A", "Door B" }));

        var result = Eval([Instances(), values], ("format", "{name}"));

        Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "Door A", null, "Door B" }));
    }

    [Test]
    public void NumericFormatString_UsesInvariantCulture()
    {
        var values = Table(("entityId", new long[] { 1 }), ("x", new[] { 1234.5678 }));

        var result = Eval([Instances(), values], ("format", "{x:#,##0.00} {{kg}}"));

        Assert.That(result.Cell("label", 0), Is.EqualTo("1,234.57 {kg}"));
    }

    [Test]
    public void WithoutValues_PlaceholdersReadTheInstanceTable()
    {
        var result = Eval([Instances(), MissingValue.Instance], ("format", "{storey}"));

        Assert.That(result.ColumnCells("label"), Is.EqualTo(new object?[] { "S1", null, "S2" }));
    }

    [Test]
    public void InferredSchema_IsTheInputPlusFourColumns()
    {
        var input = SchemaResult.Of(new Column("entityId", ColumnType.Integer));
        var result = Node.Infer("instances", [new SchemaInput(PortType.Table, true, input), new SchemaInput(PortType.Table, false, null)],
            Params(("format", "x")), null!);

        Assert.That(result.Schema!.Columns.Select(c => (c.Name, c.Type)), Is.EqualTo(new[]
        {
            ("entityId", ColumnType.Integer), ("label", ColumnType.Text), ("labelX", ColumnType.Number),
            ("labelY", ColumnType.Number), ("labelZ", ColumnType.Number),
        }));
    }
}
