using Ara3D.BimOpenSchema;
using Ara3D.DataTable;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// A column whose name is a registered column kind (ColumnKinds in bim-open-data, listed in
/// docs/columns.md) must hold that kind's scalar type. Run over every table every sample
/// graph produces, so a node pack that drifts from the registry fails here (TKT-206).
/// </summary>
[TestFixture]
public sealed class ColumnKindTypeTests
{
    public static IEnumerable<TestCaseData> Cases => SampleFlowsTests.Cases;

    [TestCaseSource(nameof(Cases))]
    public void ColumnsOfRegisteredKinds_HoldTheKindsType(string profile, string id)
    {
        var mismatches = SampleFlowsFixture.Snapshot(profile, id).Results
            .SelectMany(r => r.Value.Outputs.OfType<TableValue>().SelectMany(t => Mismatches(r.Key, t.Table)))
            .Distinct()
            .ToList();
        Assert.That(mismatches, Is.Empty, $"{profile}/{id}: column(s) whose type differs from their registered kind");
    }

    [TestCase(typeof(bool), ExpectedResult = ColumnScalarType.Boolean)]
    [TestCase(typeof(int), ExpectedResult = ColumnScalarType.Integer)]
    [TestCase(typeof(long?), ExpectedResult = ColumnScalarType.Integer)]
    [TestCase(typeof(double), ExpectedResult = ColumnScalarType.Number)]
    [TestCase(typeof(string), ExpectedResult = ColumnScalarType.Text)]
    [TestCase(typeof(DateOnly), ExpectedResult = ColumnScalarType.Date)]
    [TestCase(typeof(DateTime), ExpectedResult = ColumnScalarType.Timestamp)]
    public ColumnScalarType? ScalarTypeOf_MapsClrTypes(Type clr)
        => ScalarTypeOf(clr);

    [Test]
    public void ScalarTypeOf_LeavesUnknownTypesUnjudged()
        => Assert.That(ScalarTypeOf(typeof(object)), Is.Null);

    private static IEnumerable<string> Mismatches(string nodeId, IDataTable table)
        => table.Columns
            .Select(c => (c.Descriptor.Name, Clr: c.Descriptor.Type, Kind: ExactKind(c.Descriptor.Name)))
            .Where(c => c.Kind is not null && ScalarTypeOf(c.Clr) is { } actual && actual != c.Kind.Type)
            .Select(c => $"{nodeId}: '{c.Name}' is {c.Clr.Name} ({ScalarTypeOf(c.Clr)}), kind {c.Kind!.Name} is {c.Kind.Type}");

    // Exact case. The generic packs emit a lowercase numeric "value" column (chart, scale, colour,
    // answer); ColumnKinds.Find ignores case for readers and would match it to the ParameterText
    // view's Text kind Value.
    private static ColumnKind? ExactKind(string name)
        => ColumnKinds.Find(name) is { } kind && kind.Name == name ? kind : null;

    private static ColumnScalarType? ScalarTypeOf(Type clr)
    {
        var t = Nullable.GetUnderlyingType(clr) ?? clr;
        if (t == typeof(bool))
            return ColumnScalarType.Boolean;
        if (t == typeof(sbyte) || t == typeof(byte) || t == typeof(short) || t == typeof(ushort)
            || t == typeof(int) || t == typeof(uint) || t == typeof(long))
            return ColumnScalarType.Integer;
        if (t == typeof(float) || t == typeof(double) || t == typeof(decimal))
            return ColumnScalarType.Number;
        if (t == typeof(string) || t == typeof(char))
            return ColumnScalarType.Text;
        if (t == typeof(DateOnly))
            return ColumnScalarType.Date;
        if (t == typeof(DateTime) || t == typeof(DateTimeOffset))
            return ColumnScalarType.Timestamp;
        return null;
    }
}
