using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace Ara3D.DataFlowEngine.Tests;

/// <summary>
/// Stability vectors: expected hex computed independently (PowerShell SHA-256 over
/// the spec §1.1 byte encodings). Changing any of these is a breaking spec change.
/// </summary>
[TestFixture]
public class ValueHashTests
{
    [TestCase(true, "9dcf97a184f32623d11a73124ceb99a5709b083721e878a16d78f596718ba7b2")]
    [TestCase(false, "47dc540c94ceb704a23875c11273e16bb0b8a87aed84de911f2133568115f254")]
    public void Boolean_vectors(bool value, string expected)
        => Assert.That(ValueHash.Compute(new BooleanValue(value)), Is.EqualTo(expected));

    [TestCase(42L, "80c5bb8f2a32631a7092e6ec57abda04d87d20ece5aff2a30b0c4b105a151fe4")]
    [TestCase(-1L, "b2cf65b90288fa2b93e532214343121851bb8db63b059aeeb1188ca646b50a51")]
    public void Integer_vectors(long value, string expected)
        => Assert.That(ValueHash.Compute(new IntegerValue(value)), Is.EqualTo(expected));

    [TestCase(1.5, "d405a5caee3c2e7985d95c84835afbeb020e68fd7efe6ebbbd6550f95ce35fe0")]
    [TestCase(0.0, "dc4c8669df128318c5790c414c870cc76c585268552851e78d3ee8604dbec0e3")]
    public void Number_vectors(double value, string expected)
        => Assert.That(ValueHash.Compute(new NumberValue(value)), Is.EqualTo(expected));

    [Test]
    public void Nan_is_canonicalized()
    {
        const string expected = "7e262cb65c00a2e2ad9f86cd6c5f795e3757e15239ddbb5538f0a0ecd4c5a26c";
        var payloadNan = BitConverter.Int64BitsToDouble(unchecked((long)0xFFF8000000000123));
        Assert.That(ValueHash.Compute(new NumberValue(double.NaN)), Is.EqualTo(expected));
        Assert.That(ValueHash.Compute(new NumberValue(payloadNan)), Is.EqualTo(expected));
    }

    [Test]
    public void Negative_zero_is_distinct()
    {
        Assert.That(ValueHash.Compute(new NumberValue(-0.0)),
            Is.EqualTo("b8b532b10ed59357afcf425b51ad45eec612f60ec77251160fb5622adad62bca"));
        Assert.That(ValueHash.Compute(new NumberValue(-0.0)),
            Is.Not.EqualTo(ValueHash.Compute(new NumberValue(0.0))));
    }

    [TestCase("abc", "26cd7c5bfaa900a03482d07fcc86e9785003d7a843db2c672746880e1f67639b")]
    [TestCase("", "93e60f669b99ad3e3ee6284b139e57adfb419960f390858e46ea565bbf82d001")]
    [TestCase("héllo", "366dec1bc19146d594f5687d6d83a204ef69746e8ecd324cce550d4f4c06ab88")]
    public void Text_vectors(string value, string expected)
        => Assert.That(ValueHash.Compute(new TextValue(value)), Is.EqualTo(expected));

    [Test]
    public void Kinds_never_collide()
    {
        // Integer 1, Number 1.0, Text "1", Boolean true all differ.
        var hashes = new[]
        {
            ValueHash.Compute(new IntegerValue(1)),
            ValueHash.Compute(new NumberValue(1.0)),
            ValueHash.Compute(new TextValue("1")),
            ValueHash.Compute(new BooleanValue(true)),
        };
        Assert.That(hashes, Is.Unique);
    }

    [Test]
    public void Table_with_null_cell_vector()
    {
        var builder = new DataTableBuilder("t");
        builder.AddColumn(new long?[] { 1, null }, "a");
        Assert.That(ValueHash.Compute(new TableValue(builder.Build())),
            Is.EqualTo("6e95faec3167362d98498d346dec64a4361290d46c7b38253bdc7247a688300b"));
    }

    [Test]
    public void Two_column_table_vector()
    {
        var builder = new DataTableBuilder("t");
        builder.AddColumn(new long?[] { 1, 2 }, "a");
        builder.AddColumn(new[] { "x", null }, "b");
        Assert.That(ValueHash.Compute(new TableValue(builder.Build())),
            Is.EqualTo("216b0a6cc3dcb4245f08d872014f4adcf1fddd78410945fff47db203cb3a7433"));
    }

    [Test]
    public void Table_hash_ignores_table_name_and_construction()
    {
        var a = new DataTableBuilder("first");
        a.AddColumn(new long?[] { 7, 8 }, "col");
        var b = new DataTableBuilder("second");
        b.AddColumn(new long?[] { 7, 8 }, "col");
        Assert.That(ValueHash.Compute(new TableValue(a.Build())),
            Is.EqualTo(ValueHash.Compute(new TableValue(b.Build()))));
    }

    [Test]
    public void Integer_cell_width_does_not_matter()
    {
        var a = new DataTableBuilder("t");
        a.AddColumn(new int?[] { 5 }, "c");
        var b = new DataTableBuilder("t");
        b.AddColumn(new long?[] { 5 }, "c");
        Assert.That(ValueHash.Compute(new TableValue(a.Build())),
            Is.EqualTo(ValueHash.Compute(new TableValue(b.Build()))));
    }

    [Test]
    public void Column_order_matters()
    {
        var a = new DataTableBuilder("t");
        a.AddColumn(new long?[] { 1 }, "x");
        a.AddColumn(new long?[] { 2 }, "y");
        var b = new DataTableBuilder("t");
        b.AddColumn(new long?[] { 2 }, "y");
        b.AddColumn(new long?[] { 1 }, "x");
        Assert.That(ValueHash.Compute(new TableValue(a.Build())),
            Is.Not.EqualTo(ValueHash.Compute(new TableValue(b.Build()))));
    }
}
