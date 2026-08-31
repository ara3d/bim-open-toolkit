using Ara3D.DataFlowEngine.Expressions;
using static Ara3D.DataFlowEngine.Expressions.Tests.TestHelpers;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class EvaluatorTests
{
    [TestCase("2 + 3", 5L)]
    [TestCase("2 - 3", -1L)]
    [TestCase("2 * 3", 6L)]
    [TestCase("7 % 3", 1L)]
    [TestCase("-7 % 3", -1L)]
    [TestCase("7 % -3", 1L)]
    [TestCase("2 + 3 * 4", 14L)]
    [TestCase("(2 + 3) * 4", 20L)]
    [TestCase("-(2 + 3) * 4", -20L)]
    [TestCase("--5", 5L)]
    [TestCase("1 - 2 - 3", -4L)]
    [TestCase("i + 1", 4L)]
    [TestCase("[Fire Rating] * 2", 4L)]
    [TestCase("true ? 1 : 2", 1L)]
    [TestCase("false ? 1 : 2", 2L)]
    [TestCase("true ? 1 : false ? 2 : 3", 1L)]
    [TestCase("false ? 1 : true ? 2 : 3", 2L)]
    [TestCase("false ? 1 : false ? 2 : 3", 3L)]
    public void IntegerResults(string text, long expected)
        => Assert.That(Eval(text), Is.EqualTo(new IntegerScalar(expected)));

    [TestCase("7 / 2", 3.5)]
    [TestCase("1 / 2", 0.5)]
    [TestCase("6 / 3", 2.0)]
    [TestCase("1.5 + 2", 3.5)]
    [TestCase("2 * 1.5", 3.0)]
    [TestCase("1.5 - 0.5", 1.0)]
    [TestCase("-1.5", -1.5)]
    [TestCase("i + n", 5.5)]
    [TestCase("[Fire Rating] + 0.5", 2.5)]
    [TestCase("true ? 1 : 2.0", 1.0)]
    [TestCase("1e2 + 1", 101.0)]
    [TestCase("2.5e-1 * 4", 1.0)]
    public void NumberResults(string text, double expected)
        => Assert.That(Eval(text), Is.EqualTo(new NumberScalar(expected)));

    [Test]
    public void MixedConditionalWidensIntegerBranch()
        => Assert.That(Eval("false ? 1 : 2.5"), Is.EqualTo(new NumberScalar(2.5)));

    [Test]
    public void IntegerBranchTakenInNumberConditionalIsWidened()
        => Assert.That(Eval("true ? 1 : 2.5"), Is.EqualTo(new NumberScalar(1.0)));

    [TestCase("1 == 1", true)]
    [TestCase("1 == 2", false)]
    [TestCase("1 != 2", true)]
    [TestCase("1 == 1.0", true)]
    [TestCase("0.5 == 1 / 2", true)]
    [TestCase("1 < 2", true)]
    [TestCase("2 < 1", false)]
    [TestCase("1 <= 1", true)]
    [TestCase("1 >= 2", false)]
    [TestCase("2 > 1", true)]
    [TestCase("1 < 1.5", true)]
    [TestCase("3 < 3.5", true)]
    [TestCase("'a' < 'b'", true)]
    [TestCase("'b' < 'a'", false)]
    [TestCase("'a' <= 'a'", true)]
    [TestCase("'abc' < 'abd'", true)]
    [TestCase("'ab' < 'abc'", true)]
    [TestCase("'a' == 'a'", true)]
    [TestCase("'a' == 'A'", false)]
    [TestCase("'a' != 'b'", true)]
    [TestCase("true == true", true)]
    [TestCase("true != false", true)]
    [TestCase("true and true", true)]
    [TestCase("true and false", false)]
    [TestCase("false or true", true)]
    [TestCase("false or false", false)]
    [TestCase("not true", false)]
    [TestCase("not false", true)]
    [TestCase("not not true", true)]
    [TestCase("1 < 2 and 2 < 3", true)]
    [TestCase("1 < 2 == true", true)]
    [TestCase("not b == false", true)] // (not b) == false, i.e. false == false
    [TestCase("b ? 1 == 1 : false", true)]
    public void BooleanResults(string text, bool expected)
        => Assert.That(Eval(text), Is.EqualTo(new BooleanScalar(expected)));

    [TestCase("'a' & 'b'", "ab")]
    [TestCase("'a' & 'b' & 'c'", "abc")]
    [TestCase("1 & 2", "12")]
    [TestCase("'n = ' & 1 + 2", "n = 3")]
    [TestCase("true & '!'", "true!")]
    [TestCase("false & ''", "false")]
    [TestCase("1.5 & ''", "1.5")]
    [TestCase("t & '!'", "abc!")]
    [TestCase("'v' & 0.5", "v0.5")]
    [TestCase("true ? 'yes' : 'no'", "yes")]
    public void TextResults(string text, string expected)
        => Assert.That(Eval(text), Is.EqualTo(new TextScalar(expected)));

    [Test]
    public void CanonicalNumberTextIsShortestRoundTrip()
        => Assert.That(Eval("0.1 + 0.2 & ''"), Is.EqualTo(new TextScalar("0.30000000000000004")));

    [Test]
    public void DivisionByZeroFollowsIeee()
    {
        Assert.That(Eval("1 / 0"), Is.EqualTo(new NumberScalar(double.PositiveInfinity)));
        Assert.That(Eval("-1 / 0"), Is.EqualTo(new NumberScalar(double.NegativeInfinity)));
        Assert.That(((NumberScalar)Eval("0 / 0")!).Value, Is.NaN);
    }

    [Test]
    public void NaNIsNotEqualToItself()
    {
        Assert.That(Eval("0 / 0 == 0 / 0"), Is.EqualTo(new BooleanScalar(false)));
        Assert.That(Eval("0 / 0 != 0 / 0"), Is.EqualTo(new BooleanScalar(true)));
        Assert.That(Eval("0 / 0 < 1"), Is.EqualTo(new BooleanScalar(false)));
        Assert.That(Eval("0 / 0 >= 1"), Is.EqualTo(new BooleanScalar(false)));
    }

    [Test]
    public void NonFiniteCanonicalText()
    {
        Assert.That(Eval("1 / 0 & ''"), Is.EqualTo(new TextScalar("Infinity")));
        Assert.That(Eval("-1 / 0 & ''"), Is.EqualTo(new TextScalar("-Infinity")));
        Assert.That(Eval("0 / 0 & ''"), Is.EqualTo(new TextScalar("NaN")));
    }

    [Test]
    public void ModuloByZeroThrows()
        => Assert.That(() => Eval("1 % 0"), Throws.TypeOf<EvaluationException>().With.Message.Contains("Modulo by zero"));

    [TestCase("9223372036854775807 + 1")]
    [TestCase("-9223372036854775807 - 2")]
    [TestCase("9223372036854775807 * 2")]
    [TestCase("-(-9223372036854775807 - 1)")]
    public void IntegerOverflowThrows(string text)
        => Assert.That(() => Eval(text), Throws.TypeOf<EvaluationException>().With.Message.Contains("overflow"));

    [Test]
    public void MinIntegerModuloMinusOneIsZero()
        => Assert.That(Eval("(-9223372036854775807 - 1) % -1"), Is.EqualTo(new IntegerScalar(0)));

    [Test]
    public void NumberArithmeticNeverOverflows()
        => Assert.That(Eval("1e308 * 10"), Is.EqualTo(new NumberScalar(double.PositiveInfinity)));

    [Test]
    public void OnlySelectedConditionalBranchIsEvaluated()
    {
        // 1 % 0 would throw if evaluated; the false branch must be skipped.
        Assert.That(Eval("true ? 1 : 1 % 0"), Is.EqualTo(new IntegerScalar(1)));
        Assert.That(Eval("false ? 1 % 0 : 2"), Is.EqualTo(new IntegerScalar(2)));
    }

    [Test]
    public void AndOrDoNotShortCircuit()
        => Assert.That(() => Eval("false and 1 % 0 == 0"), Throws.TypeOf<EvaluationException>());

    [Test]
    public void EvalIsDeterministic()
    {
        var expr = CheckOk("(i + n) * 2 & ' ok'");
        var first = expr.Eval(Lookup);
        var second = expr.Eval(Lookup);
        Assert.That(second, Is.EqualTo(first));
        Assert.That(first, Is.EqualTo(new TextScalar("11 ok")));
    }
}
