using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The pack's one rule for optional text params: a present-but-blank value
/// falls back to the spec default, same as an absent one. (The engine does not
/// inject ParamSpec defaults into ParamValues.)</summary>
public static class BimParams
{
    public static string TextOr(this ParamValues parameters, string name, string @default)
        => parameters.GetText(name, @default) is { } t && !string.IsNullOrWhiteSpace(t) ? t : @default;
}
