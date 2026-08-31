using Ara3D.DataFlowEngine.Expressions;

namespace Ara3D.DataFlowEngine.Expressions.Tests;

public static class TestHelpers
{
    /// <summary>Standard environment: i/n/t/b typed columns, ni is a null Integer cell.</summary>
    public static readonly IReadOnlyDictionary<string, ScalarType> Env = new Dictionary<string, ScalarType>
    {
        ["i"] = ScalarType.Integer,
        ["n"] = ScalarType.Number,
        ["t"] = ScalarType.Text,
        ["b"] = ScalarType.Boolean,
        ["ni"] = ScalarType.Integer,
        ["nt"] = ScalarType.Text,
        ["Fire Rating"] = ScalarType.Integer,
    };

    public static Scalar? Lookup(string name)
        => name switch
        {
            "i" => new IntegerScalar(3),
            "n" => new NumberScalar(2.5),
            "t" => new TextScalar("abc"),
            "b" => new BooleanScalar(true),
            "ni" => null,
            "nt" => null,
            "Fire Rating" => new IntegerScalar(2),
            _ => null,
        };

    public static CheckedExpression CheckOk(string text)
    {
        var result = Expression.Parse(text).Check(Env);
        Assert.That(result.Errors, Is.Empty, text);
        Assert.That(result.Success, Is.True, text);
        return result;
    }

    public static Scalar? Eval(string text)
        => CheckOk(text).Eval(Lookup);

    public static ScalarType? TypeOf(string text)
        => CheckOk(text).Type;

    public static ExprError FirstTypeError(string text)
    {
        var parsed = Expression.Parse(text);
        Assert.That(parsed.Success, Is.True, $"expected a clean parse for: {text}");
        var result = parsed.Check(Env);
        Assert.That(result.Success, Is.False, $"expected a type error for: {text}");
        return result.Errors[0];
    }
}
