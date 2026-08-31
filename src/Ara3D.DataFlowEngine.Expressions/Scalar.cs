using System.Globalization;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.Expressions;

/// <summary>
/// A runtime scalar value. Null (absent) is represented by a C# null reference,
/// so evaluation results are typed as <c>Scalar?</c>.
/// </summary>
public abstract record Scalar
{
    public abstract ScalarType Type { get; }

    /// <summary>Canonical invariant text form, as used by the '&amp;' operator.</summary>
    public abstract string ToCanonicalText();
}

public sealed record BooleanScalar(bool Value) : Scalar
{
    public override ScalarType Type => ScalarType.Boolean;
    public override string ToCanonicalText() => Value ? "true" : "false";
}

public sealed record IntegerScalar(long Value) : Scalar
{
    public override ScalarType Type => ScalarType.Integer;
    public override string ToCanonicalText() => Value.ToString(CultureInfo.InvariantCulture);
}

public sealed record NumberScalar(double Value) : Scalar
{
    public override ScalarType Type => ScalarType.Number;
    public override string ToCanonicalText() => Value.ToString("R", CultureInfo.InvariantCulture);
}

public sealed record TextScalar(string Value) : Scalar
{
    public override ScalarType Type => ScalarType.Text;
    public override string ToCanonicalText() => Value;
}

public static class ScalarConverters
{
    public static Scalar ToScalar(this FlowValue value)
        => value switch
        {
            BooleanValue b => new BooleanScalar(b.Value),
            IntegerValue i => new IntegerScalar(i.Value),
            NumberValue n => new NumberScalar(n.Value),
            TextValue t => new TextScalar(t.Value),
            _ => throw new ArgumentException($"FlowValue of kind {value.Kind} is not a scalar", nameof(value)),
        };

    public static FlowValue ToFlowValue(this Scalar scalar)
        => scalar switch
        {
            BooleanScalar b => new BooleanValue(b.Value),
            IntegerScalar i => new IntegerValue(i.Value),
            NumberScalar n => new NumberValue(n.Value),
            TextScalar t => new TextValue(t.Value),
            _ => throw new ArgumentException($"Unknown scalar {scalar.GetType().Name}", nameof(scalar)),
        };
}
