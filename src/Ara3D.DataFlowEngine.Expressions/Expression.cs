using Ara3D.DataFlowEngine.Expressions.Evaluation;
using Ara3D.DataFlowEngine.Expressions.Parsing;
using Ara3D.DataFlowEngine.Expressions.Typing;

namespace Ara3D.DataFlowEngine.Expressions;

/// <summary>
/// The pipeline facade: Expression.Parse(text).Check(environment).Eval(lookup).
/// Parse and type errors are collected with character offsets, never thrown.
/// </summary>
public static class Expression
{
    public static ParsedExpression Parse(string text)
    {
        var errors = new List<ExprError>();
        var root = Parser.Parse(text, errors);
        return new ParsedExpression(text, root, errors);
    }

    internal static readonly IReadOnlyDictionary<string, ScalarType> EmptyEnvironment
        = new Dictionary<string, ScalarType>();
}

public sealed record ParsedExpression(string Text, Expr? Root, IReadOnlyList<ExprError> Errors)
{
    public bool Success => Root != null && Errors.Count == 0;

    /// <summary>
    /// Type-checks against the environment (identifier name to scalar type).
    /// Parse errors carry through; type errors are collected, not thrown.
    /// </summary>
    public CheckedExpression Check(IReadOnlyDictionary<string, ScalarType>? environment = null)
    {
        if (!Success)
            return new CheckedExpression(null, Errors);
        var errors = new List<ExprError>();
        var typed = TypeChecker.Check(Root!, environment ?? Expression.EmptyEnvironment, errors);
        return new CheckedExpression(errors.Count == 0 ? typed : null, errors);
    }
}

public sealed record CheckedExpression(TypedExpr? Root, IReadOnlyList<ExprError> Errors)
{
    public bool Success => Root != null && Errors.Count == 0;

    /// <summary>The static result type; null when the result is statically null.</summary>
    public ScalarType? Type => Root?.Type;

    /// <summary>
    /// Evaluates with the given identifier resolver (name to value-or-null).
    /// Throws InvalidOperationException when the expression has errors.
    /// </summary>
    public Scalar? Eval(Func<string, Scalar?>? lookup = null)
        => Success
            ? Root!.Eval(lookup ?? (_ => null))
            : throw new InvalidOperationException(
                "Cannot evaluate an expression with errors: " + string.Join("; ", Errors));
}
