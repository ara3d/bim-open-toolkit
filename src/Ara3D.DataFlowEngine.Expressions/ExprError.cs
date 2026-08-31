namespace Ara3D.DataFlowEngine.Expressions;

/// <summary>A parse or type error at a character offset in the expression text.</summary>
public readonly record struct ExprError(int Position, string Message)
{
    public override string ToString()
        => $"{Message} (at {Position})";
}
