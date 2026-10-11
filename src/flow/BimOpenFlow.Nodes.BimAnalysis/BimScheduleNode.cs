using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Stub from the viz-demos contract commit; its track replaces this file.</summary>
public sealed class BimScheduleNode : IFlowNode
{
    public const string Kind = "bim.schedule";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [],
        "A synthetic construction sequence over levels and trades (stub; track E fills it).");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException(Kind);
}
