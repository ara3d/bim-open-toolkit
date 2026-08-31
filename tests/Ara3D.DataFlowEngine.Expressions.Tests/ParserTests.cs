using Ara3D.DataFlowEngine.Expressions;
using Ara3D.DataFlowEngine.Expressions.Parsing;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

[TestFixture]
public class ParserTests
{
    private static Expr ParseOk(string text)
    {
        var errors = new List<ExprError>();
        var expr = Parser.Parse(text, errors);
        Assert.That(errors, Is.Empty, text);
        Assert.That(expr, Is.Not.Null, text);
        return expr!;
    }

    private static ExprError ParseError(string text)
    {
        var errors = new List<ExprError>();
        var expr = Parser.Parse(text, errors);
        Assert.That(expr, Is.Null, text);
        Assert.That(errors, Is.Not.Empty, text);
        return errors[0];
    }

    [TestCase("42", "42")]
    [TestCase("0", "0")]
    [TestCase("9223372036854775807", "9223372036854775807")]
    [TestCase("1.5", "1.5")]
    [TestCase("0.25", "0.25")]
    [TestCase("1e3", "1000")]
    [TestCase("1E3", "1000")]
    [TestCase("2.5e-2", "0.025")]
    [TestCase("1e+2", "100")]
    [TestCase("true", "true")]
    [TestCase("false", "false")]
    [TestCase("null", "null")]
    public void Literals(string text, string expected)
        => Assert.That(ParseOk(text).Render(), Is.EqualTo(expected));

    [Test]
    public void IntegerWithoutDotOrExponentIsIntegerLiteral()
        => Assert.That(ParseOk("42"), Is.InstanceOf<IntegerLiteral>());

    [TestCase("1.0")]
    [TestCase("1e2")]
    public void DotOrExponentMakesNumberLiteral(string text)
        => Assert.That(ParseOk(text), Is.InstanceOf<NumberLiteral>());

    [TestCase("'abc'", "abc")]
    [TestCase("\"abc\"", "abc")]
    [TestCase("''", "")]
    [TestCase(@"'a\nb'", "a\nb")]
    [TestCase(@"'a\tb'", "a\tb")]
    [TestCase(@"'a\\b'", "a\\b")]
    [TestCase(@"'a\'b'", "a'b")]
    [TestCase(@"'a\""b'", "a\"b")]
    [TestCase(@"""a\""b""", "a\"b")]
    [TestCase("'it''s'", "it")] // adjacent quotes are not an escape; parse stops after 'it' -- see TrailingGarbage
    public void TextLiterals(string text, string expected)
    {
        var errors = new List<ExprError>();
        var expr = Parser.Parse(text, errors);
        if (expr is TextLiteral t)
            Assert.That(t.Value, Is.EqualTo(expected));
        else
            Assert.That(errors, Is.Not.Empty);
    }

    [TestCase("x", "x")]
    [TestCase("_x1", "_x1")]
    [TestCase("[Fire Rating]", "Fire Rating")]
    [TestCase("[Weird]]Name]", "Weird]Name")]
    [TestCase("[and]", "and")]
    [TestCase("[123]", "123")]
    public void Identifiers(string text, string name)
        => Assert.That(((Identifier)ParseOk(text)).Name, Is.EqualTo(name));

    [Test]
    public void KeywordsAreCaseSensitive_UppercaseIsIdentifier()
    {
        Assert.That(ParseOk("True"), Is.InstanceOf<Identifier>());
        Assert.That(ParseOk("NULL"), Is.InstanceOf<Identifier>());
        Assert.That(ParseOk("And"), Is.InstanceOf<Identifier>());
    }

    [TestCase("2 + 3 * 4", "(+ 2 (* 3 4))")]
    [TestCase("(2 + 3) * 4", "(* (+ 2 3) 4)")]
    [TestCase("2 * 3 % 4 / 5", "(/ (% (* 2 3) 4) 5)")]
    [TestCase("1 - 2 - 3", "(- (- 1 2) 3)")]
    [TestCase("1 + 2 - 3", "(- (+ 1 2) 3)")]
    [TestCase("-2 * 3", "(* (neg 2) 3)")]
    [TestCase("-(2 + 3) * 4", "(* (neg (+ 2 3)) 4)")]
    [TestCase("--1", "(neg (neg 1))")]
    [TestCase("not not true", "(not (not true))")]
    [TestCase("1 + 2 & 3 + 4", "(& (+ 1 2) (+ 3 4))")]
    [TestCase("'a' & 'b' & 'c'", "(& (& 'a' 'b') 'c')")]
    [TestCase("a & b == c", "(== (& a b) c)")]
    [TestCase("1 < 2 == true", "(== (< 1 2) true)")]
    [TestCase("a < b < c", "(< (< a b) c)")]
    [TestCase("not a == b", "(== (not a) b)")]
    [TestCase("a == b and c != d", "(and (== a b) (!= c d))")]
    [TestCase("a and b or c and d", "(or (and a b) (and c d))")]
    [TestCase("a or b or c", "(or (or a b) c)")]
    [TestCase("a ? b : c", "(if a b c)")]
    [TestCase("a ? b : c ? d : e", "(if a b (if c d e))")]
    [TestCase("a ? b ? c : d : e", "(if a (if b c d) e)")]
    [TestCase("a or b ? c : d", "(if (or a b) c d)")]
    [TestCase("1 <= 2", "(<= 1 2)")]
    [TestCase("1 >= 2", "(>= 1 2)")]
    [TestCase("1 > 2", "(> 1 2)")]
    [TestCase("1 != 2", "(!= 1 2)")]
    public void PrecedenceAndAssociativity(string text, string expected)
        => Assert.That(ParseOk(text).Render(), Is.EqualTo(expected));

    [TestCase("abs(1)", "(abs 1)")]
    [TestCase("min(1, 2)", "(min 1 2)")]
    [TestCase("coalesce(a, b, c)", "(coalesce a b c)")]
    [TestCase("round(1.5, 2)", "(round 1.5 2)")]
    [TestCase("f()", "(f)")]
    [TestCase("len('a') + 1", "(+ (len 'a') 1)")]
    [TestCase("min(1 + 2, a ? 3 : 4)", "(min (+ 1 2) (if a 3 4))")]
    public void Calls(string text, string expected)
        => Assert.That(ParseOk(text).Render(), Is.EqualTo(expected));

    [Test]
    public void QuotedIdentifierIsNeverACall()
        => Assert.That(ParseError("[len]('a')").Message, Does.Contain("Unexpected token"));

    [Test]
    public void BuiltinNamesAreNotReserved()
        => Assert.That(ParseOk("len + 1").Render(), Is.EqualTo("(+ len 1)"));

    [TestCase("1 +", 3)]
    [TestCase("(1", 2)]
    [TestCase("+ 1", 0)]
    [TestCase("a ? b", 5)]
    [TestCase("min(1, ", 7)]
    [TestCase("min(1, 2", 8)]
    public void SyntaxErrorPositions(string text, int position)
        => Assert.That(ParseError(text).Position, Is.EqualTo(position));

    [TestCase("1 2")]
    [TestCase("1 : 2")]
    [TestCase("a b")]
    public void TrailingGarbage(string text)
        => Assert.That(ParseError(text).Message, Does.Contain("Unexpected token"));

    [Test]
    public void UnterminatedText()
        => Assert.That(ParseError("'abc").Message, Does.Contain("Unterminated text"));

    [Test]
    public void UnterminatedBracket()
        => Assert.That(ParseError("[abc").Message, Does.Contain("Unterminated bracketed"));

    [Test]
    public void EmptyBracket()
        => Assert.That(ParseError("[]").Message, Does.Contain("Empty bracketed"));

    [Test]
    public void InvalidEscape()
        => Assert.That(ParseError(@"'a\qb'").Message, Does.Contain("Invalid escape"));

    [Test]
    public void UnexpectedCharacter()
    {
        var error = ParseError("1 @ 2");
        Assert.That(error.Message, Does.Contain("Unexpected character '@'"));
        Assert.That(error.Position, Is.EqualTo(2));
    }

    [Test]
    public void SingleEqualsIsError()
        => Assert.That(ParseError("a = b").Message, Does.Contain("Unexpected character '='"));

    [Test]
    public void IntegerOverflowIsLexicalError()
        => Assert.That(ParseError("9223372036854775808").Message, Does.Contain("out of range"));

    [Test]
    public void EmptyInputIsError()
        => Assert.That(ParseError("").Message, Does.Contain("Expected an expression"));

    [Test]
    public void WhitespaceOnlyIsError()
        => Assert.That(ParseError("  \t\r\n ").Message, Does.Contain("Expected an expression"));

    [Test]
    public void TrailingDotIsNotConsumedByNumber()
        => Assert.That(ParseError("1.").Message, Does.Contain("Unexpected character '.'"));

    [Test]
    public void LeadingDotIsError()
        => Assert.That(ParseError(".5").Message, Does.Contain("Unexpected character '.'"));

    [Test]
    public void PositionsAreCharacterOffsets()
    {
        var expr = (Binary)ParseOk("12 + 34");
        Assert.That(expr.Position, Is.EqualTo(3));
        Assert.That(expr.Left.Position, Is.EqualTo(0));
        Assert.That(expr.Right.Position, Is.EqualTo(5));
    }
}
