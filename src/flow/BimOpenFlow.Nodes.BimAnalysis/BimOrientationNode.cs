using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Stub from the viz-demos contract commit; its track replaces this file.</summary>
public sealed class BimOrientationNode : IFlowNode
{
    public const string Kind = "bim.orientation";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [],
        "Facade bearing of each element relative to the building centre (stub; track D fills it).");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException(Kind);
}
