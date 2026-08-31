using Ara3D.DataFlowEngine.Expressions;
using static Ara3D.DataFlowEngine.Expressions.Tests.TestHelpers;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class TypeCheckerTests
{
    [TestCase("1 + 2", ScalarType.Integer)]
    [TestCase("1 - 2", ScalarType.Integer)]
    [TestCase("1 * 2", ScalarType.Integer)]
    [TestCase("1 + 2.0", ScalarType.Number)]
    [TestCase("1.0 + 2", ScalarType.Number)]
    [TestCase("1.0 * 2.0", ScalarType.Number)]
    [TestCase("1 / 2", ScalarType.Number)]
    [TestCase("1.0 / 2.0", ScalarType.Number)]
    [TestCase("7 % 3", ScalarType.Integer)]
    [TestCase("-1", ScalarType.Integer)]
    [TestCase("-1.5", ScalarType.Number)]
    [TestCase("not true", ScalarType.Boolean)]
    [TestCase("1 & 2", ScalarType.Text)]
    [TestCase("'a' & true", ScalarType.Text)]
    [TestCase("1 == 2", ScalarType.Boolean)]
    [TestCase("1 == 2.0", ScalarType.Boolean)]
    [TestCase("'a' != 'b'", ScalarType.Boolean)]
    [TestCase("true == false", ScalarType.Boolean)]
    [TestCase("1 < 2", ScalarType.Boolean)]
    [TestCase("'a' < 'b'", ScalarType.Boolean)]
    [TestCase("true and false", ScalarType.Boolean)]
    [TestCase("true or false", ScalarType.Boolean)]
    [TestCase("true ? 1 : 2", ScalarType.Integer)]
    [TestCase("true ? 1 : 2.0", ScalarType.Number)]
    [TestCase("true ? 1.0 : 2", ScalarType.Number)]
    [TestCase("true ? 'a' : 'b'", ScalarType.Text)]
    [TestCase("i + 1", ScalarType.Integer)]
    [TestCase("i + n", ScalarType.Number)]
    [TestCase("[Fire Rating] + 0.5", ScalarType.Number)]
    public void ResultTypes(string text, ScalarType expected)
        => Assert.That(TypeOf(text), Is.EqualTo(expected));

    [TestCase("null")]
    [TestCase("null + null")]
    [TestCase("-null")]
    [TestCase("null % null")]
    [TestCase("true ? null : null")]
    public void StaticallyNullExpressionsHaveNoType(string text)
        => Assert.That(TypeOf(text), Is.Null);

    [TestCase("null + 1", ScalarType.Integer)]
    [TestCase("null + 1.5", ScalarType.Number)]
    [TestCase("null & 'a'", ScalarType.Text)]
    [TestCase("not null", ScalarType.Boolean)]
    [TestCase("null == 1", ScalarType.Boolean)]
    [TestCase("null and true", ScalarType.Boolean)]
    [TestCase("true ? null : 2", ScalarType.Integer)]
    [TestCase("true ? 2.0 : null", ScalarType.Number)]
    [TestCase("null ? 1 : 2", ScalarType.Integer)]
    [TestCase("null < 1", ScalarType.Boolean)]
    public void NullLiteralUnifiesWithAnything(string text, ScalarType expected)
        => Assert.That(TypeOf(text), Is.EqualTo(expected));

    [TestCase("1 + 'a'", "'+' requires numeric operands")]
    [TestCase("'a' - 1", "'-' requires numeric operands")]
    [TestCase("true * 2", "'*' requires numeric operands")]
    [TestCase("'a' / 2", "'/' requires numeric operands")]
    [TestCase("1.5 % 2", "'%' requires Integer operands")]
    [TestCase("1 % 2.0", "'%' requires Integer operands")]
    [TestCase("'a' % 'b'", "'%' requires Integer operands")]
    [TestCase("-'a'", "Unary '-' requires a numeric operand")]
    [TestCase("not 1", "'not' requires a Boolean operand")]
    [TestCase("1 == 'a'", "Cannot compare Integer and Text")]
    [TestCase("true == 1", "Cannot compare Boolean and Integer")]
    [TestCase("'a' != true", "Cannot compare Text and Boolean")]
    [TestCase("true < false", "Cannot order Boolean and Boolean")]
    [TestCase("'a' <= 1", "Cannot order Text and Integer")]
    [TestCase("null > true", "Cannot order")]
    [TestCase("1 and true", "'and' requires Boolean operands")]
    [TestCase("true or 'a'", "'or' requires Boolean operands")]
    [TestCase("1 ? 2 : 3", "condition must be Boolean")]
    [TestCase("true ? 1 : 'a'", "incompatible types Integer and Text")]
    [TestCase("true ? false : 1.5", "incompatible types Boolean and Number")]
    public void TypeErrors(string text, string messagePart)
        => Assert.That(FirstTypeError(text).Message, Does.Contain(messagePart));

    [Test]
    public void UnknownIdentifierIsATypeError()
        => Assert.That(FirstTypeError("nope + 1").Message, Does.Contain("Unknown identifier 'nope'"));

    [Test]
    public void UppercaseKeywordIsAnUnknownIdentifier()
        => Assert.That(FirstTypeError("TRUE").Message, Does.Contain("Unknown identifier 'TRUE'"));

    [Test]
    public void IdentifiersAreCaseSensitive()
        => Assert.That(FirstTypeError("I + 1").Message, Does.Contain("Unknown identifier 'I'"));

    [Test]
    public void ErrorsAreCollectedNotThrown()
    {
        var result = Expression.Parse("(1 + 'a') & (true and 2)").Check(Env);
        Assert.That(result.Success, Is.False);
        Assert.That(result.Errors, Has.Count.EqualTo(2));
    }

    [Test]
    public void TypeErrorPositionsAreOffsets()
    {
        var error = FirstTypeError("1 + 'a'");
        Assert.That(error.Position, Is.EqualTo(4));
    }

    [Test]
    public void EvalOnErrorsThrows()
    {
        var result = Expression.Parse("1 + 'a'").Check(Env);
        Assert.That(() => result.Eval(Lookup), Throws.InvalidOperationException);
    }

    [Test]
    public void ParseErrorsCarryThroughCheck()
    {
        var result = Expression.Parse("1 +").Check(Env);
        Assert.That(result.Success, Is.False);
        Assert.That(result.Errors, Has.Count.EqualTo(1));
    }

    [Test]
    public void CheckWithNoEnvironmentWorksForClosedExpressions()
        => Assert.That(Expression.Parse("1 + 2").Check().Success, Is.True);
}
