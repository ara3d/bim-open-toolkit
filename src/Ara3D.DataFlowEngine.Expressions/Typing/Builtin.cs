namespace Ara3D.DataFlowEngine.Expressions.Typing;

public enum Builtin
{
    Abs,
    Min,
    Max,
    Round,
    Floor,
    Ceil,
    Len,
    Lower,
    Upper,
    Contains,
    StartsWith,
    EndsWith,
    Coalesce,
}

public static class Builtins
{
    /// <summary>Builtin names are lowercase and case-sensitive; null for unknown names.</summary>
    public static Builtin? FromName(string name)
        => name switch
        {
            "abs" => Builtin.Abs,
            "min" => Builtin.Min,
            "max" => Builtin.Max,
            "round" => Builtin.Round,
            "floor" => Builtin.Floor,
            "ceil" => Builtin.Ceil,
            "len" => Builtin.Len,
            "lower" => Builtin.Lower,
            "upper" => Builtin.Upper,
            "contains" => Builtin.Contains,
            "startswith" => Builtin.StartsWith,
            "endswith" => Builtin.EndsWith,
            "coalesce" => Builtin.Coalesce,
            _ => null,
        };
}
