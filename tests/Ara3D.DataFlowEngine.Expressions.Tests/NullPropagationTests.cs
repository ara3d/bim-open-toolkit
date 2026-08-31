using Ara3D.DataFlowEngine.Expressions;
using static Ara3D.DataFlowEngine.Expressions.Tests.TestHelpers;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class NullPropagationTests
{
    [TestCase("null")]
    [TestCase("null + 1")]
    [TestCase("1 + null")]
    [TestCase("null - 1")]
    [TestCase("null * 2")]
    [TestCase("null / 2")]
    [TestCase("2 / null")]
    [TestCase("null % 2")]
    [TestCase("null % 0")] // null propagates before the divisor is inspected
    [TestCase("-null")]
    [TestCase("not null")]
    [TestCase("null & 'a'")]
    [TestCase("'a' & null")]
    [TestCase("null == 1")]
    [TestCase("1 == null")]
    [TestCase("null == null")]
    [TestCase("null != 1")]
    [TestCase("null < 1")]
    [TestCase("null <= null")]
    [TestCase("null and true")]
    [TestCase("true and null")]
    [TestCase("false and null")] // no three-valued logic: null, not false
    [TestCase("null or true")]
    [TestCase("true or null")]
    [TestCase("null ? 1 : 2")]
    public void NullOperandYieldsNull(string text)
        => Assert.That(Eval(text), Is.Null);

    [TestCase("ni + 1")]
    [TestCase("i + ni")]
    [TestCase("ni * i")]
    [TestCase("ni == 5")]
    [TestCase("ni == ni")]
    [TestCase("nt & 'x'")]
    [TestCase("len(nt)")]
    [TestCase("abs(ni)")]
    [TestCase("min(i, ni)")]
    [TestCase("b ? ni : i")]
    public void NullEnvironmentValuePropagates(string text)
        => Assert.That(Eval(text), Is.Null);

    [Test]
    public void NullConditionSkipsBothBranches()
        => Assert.That(Eval("null ? 1 % 0 : 1 % 0"), Is.Null);

    [TestCase("coalesce(null, 2)", 2L)]
    [TestCase("coalesce(2, null)", 2L)]
    [TestCase("coalesce(1, 2)", 1L)]
    [TestCase("coalesce(null, null, 3)", 3L)]
    [TestCase("coalesce(ni, 7)", 7L)]
    [TestCase("coalesce(ni, ni, i)", 3L)]
    [TestCase("coalesce(ni, 0) + 1", 1L)]
    public void CoalesceReturnsFirstNonNull(string text, long expected)
        => Assert.That(Eval(text), Is.EqualTo(new IntegerScalar(expected)));

    [Test]
    public void CoalesceOfAllNullsIsNull()
        => Assert.That(Eval("coalesce(null, null)"), Is.Null);

    [Test]
    public void CoalesceStopsAtFirstNonNull()
        => Assert.That(Eval("coalesce(1, 1 % 0)"), Is.EqualTo(new IntegerScalar(1)));

    [Test]
    public void CoalesceWidensToUnifiedType()
    {
        Assert.That(TypeOf("coalesce(1, 2.5)"), Is.EqualTo(ScalarType.Number));
        Assert.That(Eval("coalesce(1, 2.5)"), Is.EqualTo(new NumberScalar(1.0)));
        Assert.That(Eval("coalesce(ni, 2.5)"), Is.EqualTo(new NumberScalar(2.5)));
        Assert.That(Eval("coalesce(null, i, 2.5)"), Is.EqualTo(new NumberScalar(3.0)));
    }

    [Test]
    public void CoalesceTypeMismatchIsTypeError()
        => Assert.That(FirstTypeError("coalesce(1, 'a')").Message, Does.Contain("incompatible"));

    [Test]
    public void CoalesceRequiresTwoArguments()
        => Assert.That(FirstTypeError("coalesce(1)").Message, Does.Contain("at least 2"));

    [Test]
    public void NullPropagatesThroughBuiltins()
    {
        Assert.That(Eval("round(null)"), Is.Null);
        Assert.That(Eval("round(1.5, null)"), Is.Null);
        Assert.That(Eval("contains('a', null)"), Is.Null);
        Assert.That(Eval("upper(null)"), Is.Null);
        Assert.That(Eval("max(null, 5)"), Is.Null);
    }

    [Test]
    public void NestedNullPropagation()
        => Assert.That(Eval("(1 + null) * 2 == 4 ? 'a' : 'b'"), Is.Null);
}
