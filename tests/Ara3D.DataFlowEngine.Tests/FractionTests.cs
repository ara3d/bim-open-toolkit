using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public sealed class FractionTests
{
    [TestCase(-.01)]
    [TestCase(1.01)]
    [TestCase(double.NaN)]
    [TestCase(double.PositiveInfinity)]
    public void FractionRejectsInvalidValues(double value)
        => Assert.Throws<ArgumentOutOfRangeException>(() => new Fraction(value));

    [TestCase(-1)]
    [TestCase(101)]
    [TestCase(double.NaN)]
    public void PercentRejectsInvalidValues(double value)
        => Assert.Throws<ArgumentOutOfRangeException>(() => new Percent(value));

    [Test]
    public void PercentConvertsToFractionOnce()
    {
        Assert.That(new Percent(25).ToFraction().Value, Is.EqualTo(.25));
        Assert.That(new Fraction(.25).ToPercent().Value, Is.EqualTo(25));
        Assert.That(new Fraction(0).Value, Is.Zero);
        Assert.That(new Fraction(1).Value, Is.EqualTo(1));
    }

    [Test]
    public void TypedParametersValidateEvenWhenNodeReadsPlainNumbers()
    {
        var parameters = new ParamValues(new Dictionary<string,string>{{"opacity","2"}});
        Assert.Throws<ArgumentOutOfRangeException>(() => parameters.Validate([new("opacity",ParamKind.Fraction,"1")]));
    }

    [TestCase(ParamKind.Fraction, "-0.1")]
    [TestCase(ParamKind.Fraction, "1.1")]
    [TestCase(ParamKind.Percent, "101")]
    [TestCase(ParamKind.Percent, "Infinity")]
    public void MissingValuesCannotBypassInvalidTypedDefaults(ParamKind kind, string value)
        => Assert.Throws<ArgumentOutOfRangeException>(() => ParamValues.Empty.Validate([new("value", kind, value)]));

    [TestCase(ParamKind.Fraction, "0")]
    [TestCase(ParamKind.Fraction, "1")]
    [TestCase(ParamKind.Percent, "0")]
    [TestCase(ParamKind.Percent, "100")]
    public void InclusiveTypedBoundariesAreValid(ParamKind kind, string value)
        => Assert.DoesNotThrow(() => ParamValues.Empty.Validate([new("value", kind, value)]));
}
