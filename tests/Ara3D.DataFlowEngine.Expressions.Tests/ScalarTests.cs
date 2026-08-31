using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.Expressions;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class ScalarTests
{
    [Test]
    public void FlowValueRoundTrip()
    {
        Scalar[] scalars =
        [
            new BooleanScalar(true),
            new IntegerScalar(-42),
            new NumberScalar(1.5),
            new TextScalar("abc"),
        ];
        foreach (var scalar in scalars)
            Assert.That(scalar.ToFlowValue().ToScalar(), Is.EqualTo(scalar));
    }

    [Test]
    public void ToFlowValueKinds()
    {
        Assert.That(new BooleanScalar(true).ToFlowValue(), Is.EqualTo(new BooleanValue(true)));
        Assert.That(new IntegerScalar(7).ToFlowValue(), Is.EqualTo(new IntegerValue(7)));
        Assert.That(new NumberScalar(2.5).ToFlowValue(), Is.EqualTo(new NumberValue(2.5)));
        Assert.That(new TextScalar("x").ToFlowValue(), Is.EqualTo(new TextValue("x")));
    }

    [Test]
    public void TableFlowValueIsNotAScalar()
        => Assert.That(() => new TableValue(null!).ToScalar(), Throws.ArgumentException);

    [TestCase(true, "true")]
    [TestCase(false, "false")]
    public void BooleanCanonicalText(bool value, string expected)
        => Assert.That(new BooleanScalar(value).ToCanonicalText(), Is.EqualTo(expected));

    [TestCase(0L, "0")]
    [TestCase(-5L, "-5")]
    [TestCase(long.MaxValue, "9223372036854775807")]
    [TestCase(long.MinValue, "-9223372036854775808")]
    public void IntegerCanonicalText(long value, string expected)
        => Assert.That(new IntegerScalar(value).ToCanonicalText(), Is.EqualTo(expected));

    [TestCase(1.5, "1.5")]
    [TestCase(0.5, "0.5")]
    [TestCase(-0.25, "-0.25")]
    [TestCase(1e300, "1E+300")]
    [TestCase(double.NaN, "NaN")]
    [TestCase(double.PositiveInfinity, "Infinity")]
    [TestCase(double.NegativeInfinity, "-Infinity")]
    public void NumberCanonicalTextIsInvariantRoundTrip(double value, string expected)
        => Assert.That(new NumberScalar(value).ToCanonicalText(), Is.EqualTo(expected));

    [Test]
    public void ScalarTypeMapsToValueKindAndBack()
    {
        foreach (var type in Enum.GetValues<ScalarType>())
            Assert.That(type.ToValueKind().ToScalarType(), Is.EqualTo(type));
    }

    [Test]
    public void TableValueKindIsNotAScalarType()
        => Assert.That(() => ValueKind.Table.ToScalarType(), Throws.ArgumentException);
}
