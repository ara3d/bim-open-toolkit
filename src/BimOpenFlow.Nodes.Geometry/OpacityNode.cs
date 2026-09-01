using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Sets the per-instance alpha column `a` (adding it, default 1, when absent).
/// Without an ids table every row gets the alpha. With one, rows whose join
/// column matches (scope "matched") or does not match (scope "others") get the
/// alpha; the rest keep their current value. The 3D pane honors `a` on its own:
/// 0 hides, values between 0 and 1 fade.
/// </summary>
public sealed class OpacityNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.opacity", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("ids", PortType.Table, Optional: true)],
        [new("instances", PortType.Table)],
        [
            new("alpha", ParamKind.Number, "0.25"),
            new("joinColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances")),
            new("scope", ParamKind.Enum, "matched", ["matched", "others"]),
        ],
        "Sets the alpha column of an instance table, for all rows or for rows matched against an ids table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
