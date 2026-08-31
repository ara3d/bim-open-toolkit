using Ara3D.DataFlowEngine.Expressions;
using static Ara3D.DataFlowEngine.Expressions.Tests.TestHelpers;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class BuiltinTests
{
    [TestCase("abs(5)", 5L)]
    [TestCase("abs(-5)", 5L)]
    [TestCase("abs(0)", 0L)]
    [TestCase("min(1, 2)", 1L)]
    [TestCase("min(2, 1)", 1L)]
    [TestCase("max(1, 2)", 2L)]
    [TestCase("min(3, 1, 2)", 1L)]
    [TestCase("max(1, 3, 2)", 3L)]
    [TestCase("min(-1, 1)", -1L)]
    [TestCase("len('abc')", 3L)]
    [TestCase("len('')", 0L)]
    [TestCase("len('a\\nb')", 3L)]
    [TestCase("len(t)", 3L)]
    public void IntegerBuiltins(string text, long expected)
        => Assert.That(Eval(text), Is.EqualTo(new IntegerScalar(expected)));

    [Test]
    public void LenCountsCodePointsNotUtf16Units()
        => Assert.That(Eval("len('a\U0001F600b')"), Is.EqualTo(new IntegerScalar(3L)));

    [TestCase("abs(-1.5)", 1.5)]
    [TestCase("abs(1.5)", 1.5)]
    [TestCase("min(1.5, 2)", 1.5)]
    [TestCase("max(1, 2.5)", 2.5)]
    [TestCase("min(1, 2.5, 0.5)", 0.5)]
    [TestCase("round(1.4)", 1.0)]
    [TestCase("round(1.5)", 2.0)]
    [TestCase("round(2.5)", 3.0)]
    [TestCase("round(-2.5)", -3.0)]
    [TestCase("round(1.25, 1)", 1.3)]
    [TestCase("round(1.234, 2)", 1.23)]
    [TestCase("round(5)", 5.0)]
    [TestCase("floor(1.7)", 1.0)]
    [TestCase("floor(-1.2)", -2.0)]
    [TestCase("floor(3)", 3.0)]
    [TestCase("ceil(1.2)", 2.0)]
    [TestCase("ceil(-1.7)", -1.0)]
    [TestCase("ceil(3)", 3.0)]
    public void NumberBuiltins(string text, double expected)
        => Assert.That(Eval(text), Is.EqualTo(new NumberScalar(expected)));

    [TestCase("lower('AbC')", "abc")]
    [TestCase("upper('AbC')", "ABC")]
    [TestCase("lower('ABC123')", "abc123")]
    [TestCase("upper(t)", "ABC")]
    public void TextBuiltins(string text, string expected)
        => Assert.That(Eval(text), Is.EqualTo(new TextScalar(expected)));

    [TestCase("contains('firewall', 'wall')", true)]
    [TestCase("contains('firewall', 'WALL')", false)]
    [TestCase("contains('abc', '')", true)]
    [TestCase("contains('', 'a')", false)]
    [TestCase("startswith('IfcWall', 'Ifc')", true)]
    [TestCase("startswith('IfcWall', 'ifc')", false)]
    [TestCase("startswith('abc', '')", true)]
    [TestCase("endswith('IfcWall', 'Wall')", true)]
    [TestCase("endswith('IfcWall', 'wall')", false)]
    [TestCase("endswith('abc', '')", true)]
    public void PredicateBuiltins(string text, bool expected)
        => Assert.That(Eval(text), Is.EqualTo(new BooleanScalar(expected)));

    [TestCase("abs(1)", ScalarType.Integer)]
    [TestCase("abs(1.0)", ScalarType.Number)]
    [TestCase("min(1, 2)", ScalarType.Integer)]
    [TestCase("min(1, 2.0)", ScalarType.Number)]
    [TestCase("max(i, i)", ScalarType.Integer)]
    [TestCase("max(i, n)", ScalarType.Number)]
    [TestCase("round(1.5)", ScalarType.Number)]
    [TestCase("round(1)", ScalarType.Number)]
    [TestCase("floor(1)", ScalarType.Number)]
    [TestCase("ceil(1)", ScalarType.Number)]
    [TestCase("len('a')", ScalarType.Integer)]
    [TestCase("lower('A')", ScalarType.Text)]
    [TestCase("upper('a')", ScalarType.Text)]
    [TestCase("contains('a', 'b')", ScalarType.Boolean)]
    [TestCase("coalesce(1, 2)", ScalarType.Integer)]
    [TestCase("coalesce(1.0, 2)", ScalarType.Number)]
    [TestCase("coalesce('a', 'b')", ScalarType.Text)]
    public void BuiltinResultTypes(string text, ScalarType expected)
        => Assert.That(TypeOf(text), Is.EqualTo(expected));

    [Test]
    public void AbsOfMinIntegerThrows()
        => Assert.That(() => Eval("abs(-9223372036854775807 - 1)"), Throws.TypeOf<EvaluationException>().With.Message.Contains("overflow"));

    [Test]
    public void RoundDigitsOutOfRangeThrows()
    {
        Assert.That(() => Eval("round(1.5, 16)"), Throws.TypeOf<EvaluationException>());
        Assert.That(() => Eval("round(1.5, -1)"), Throws.TypeOf<EvaluationException>());
    }

    [Test]
    public void MinMaxPropagateNaN()
    {
        Assert.That(((NumberScalar)Eval("min(0 / 0, 1)")!).Value, Is.NaN);
        Assert.That(((NumberScalar)Eval("max(1, 0 / 0)")!).Value, Is.NaN);
    }

    [TestCase("abs()", "expects 1 argument")]
    [TestCase("abs(1, 2)", "expects 1 argument")]
    [TestCase("min(1)", "expects at least 2")]
    [TestCase("max(1)", "expects at least 2")]
    [TestCase("round()", "expects 1 to 2")]
    [TestCase("round(1.5, 2, 3)", "expects 1 to 2")]
    [TestCase("len()", "expects 1 argument")]
    [TestCase("len('a', 'b')", "expects 1 argument")]
    [TestCase("contains('a')", "expects 2 arguments")]
    public void ArityErrors(string text, string messagePart)
        => Assert.That(FirstTypeError(text).Message, Does.Contain(messagePart));

    [TestCase("abs('a')", "numeric argument")]
    [TestCase("min('a', 1)", "numeric argument")]
    [TestCase("min(1, true)", "numeric argument")]
    [TestCase("round('a')", "numeric argument")]
    [TestCase("round(1.5, 'a')", "Integer digits argument")]
    [TestCase("round(1.5, 2.0)", "Integer digits argument")]
    [TestCase("floor('a')", "numeric argument")]
    [TestCase("len(1)", "Text argument")]
    [TestCase("lower(1)", "Text argument")]
    [TestCase("upper(true)", "Text argument")]
    [TestCase("contains('a', 1)", "Text argument")]
    [TestCase("startswith(1, 'a')", "Text argument")]
    [TestCase("endswith('a', true)", "Text argument")]
    public void ArgumentTypeErrors(string text, string messagePart)
        => Assert.That(FirstTypeError(text).Message, Does.Contain(messagePart));

    [Test]
    public void UnknownFunctionIsATypeError()
        => Assert.That(FirstTypeError("nope(1)").Message, Does.Contain("Unknown function 'nope'"));

    [Test]
    public void BuiltinNamesAreCaseSensitive()
        => Assert.That(FirstTypeError("ABS(1)").Message, Does.Contain("Unknown function 'ABS'"));

    [Test]
    public void ColumnMayShadowABuiltinName()
    {
        var env = new Dictionary<string, ScalarType> { ["len"] = ScalarType.Integer };
        var result = Expression.Parse("len + 1").Check(env);
        Assert.That(result.Success, Is.True);
        Assert.That(result.Eval(_ => new IntegerScalar(4)), Is.EqualTo(new IntegerScalar(5)));
    }
}
