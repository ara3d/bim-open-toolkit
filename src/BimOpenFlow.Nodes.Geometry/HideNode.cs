using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Removes the instance rows whose join column matches any id in the ids table
/// (the inverse of view3d.isolate). The ids table uses its column of the same
/// name, or its first column when absent.
/// </summary>
public sealed class HideNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.hide", 1, NodeCapability.Pure,
        [new("instances", PortType.Table), new("ids", PortType.Table)],
        [new("instances", PortType.Table)],
        [new("joinColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances"))],
        "Removes the instance rows whose join column value appears in the ids table.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
