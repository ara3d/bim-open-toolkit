using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Thins an instance table to the visually significant rows: drops rows whose
/// bounds diagonal is under minDiagonal, then keeps the ceil(keepFraction * n)
/// largest remaining rows by bounds volume (ties resolved by row order).
/// Kept rows preserve their original order. This is instance thinning —
/// triangle counts per mesh are untouched.
/// </summary>
public sealed class DecimateNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.decimate", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("instances", PortType.Table)],
        [
            new("keepFraction", ParamKind.Number, "0.25"),
            new("minDiagonal", ParamKind.Number, "0"),
        ],
        "Keeps only the largest instances: a minimum bounds diagonal, then the top fraction by volume.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
