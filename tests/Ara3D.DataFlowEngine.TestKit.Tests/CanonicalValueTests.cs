using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit.Tests;

[TestFixture]
public class CanonicalValueTests
{
    [Test]
    public void Parses_each_scalar_canonical_form()
    {
        Assert.That(CanonicalValue.Parse(ValueKind.Boolean, "true"), Is.EqualTo(new BooleanValue(true)));
        Assert.That(CanonicalValue.Parse(ValueKind.Integer, "-9223372036854775808"),
            Is.EqualTo(new IntegerValue(long.MinValue)));
        Assert.That(CanonicalValue.Parse(ValueKind.Number, "0.1"), Is.EqualTo(new NumberValue(0.1)));
        Assert.That(CanonicalValue.Parse(ValueKind.Number, "1E+21"), Is.EqualTo(new NumberValue(1e21)));
        Assert.That(CanonicalValue.Parse(ValueKind.Text, " as-is "), Is.EqualTo(new TextValue(" as-is ")));
    }

    [Test]
    public void Rejects_non_canonical_boolean_and_table()
    {
        Assert.Throws<FormatException>(() => CanonicalValue.Parse(ValueKind.Boolean, "True"));
        Assert.Throws<NotSupportedException>(() => CanonicalValue.Parse(ValueKind.Table, "{}"));
    }
}
