using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.Expressions;

/// <summary>The scalar subset of the Abstractions ValueKind lattice.</summary>
public enum ScalarType
{
    Boolean,
    Integer,
    Number,
    Text,
}

public static class ScalarTypeExtensions
{
    public static bool IsNumeric(this ScalarType type)
        => type is ScalarType.Integer or ScalarType.Number;

    public static ValueKind ToValueKind(this ScalarType type)
        => type switch
        {
            ScalarType.Boolean => ValueKind.Boolean,
            ScalarType.Integer => ValueKind.Integer,
            ScalarType.Number => ValueKind.Number,
            ScalarType.Text => ValueKind.Text,
            _ => throw new ArgumentOutOfRangeException(nameof(type)),
        };

    public static ScalarType ToScalarType(this ValueKind kind)
        => kind switch
        {
            ValueKind.Boolean => ScalarType.Boolean,
            ValueKind.Integer => ScalarType.Integer,
            ValueKind.Number => ScalarType.Number,
            ValueKind.Text => ScalarType.Text,
            _ => throw new ArgumentException($"ValueKind {kind} is not a scalar", nameof(kind)),
        };
}
