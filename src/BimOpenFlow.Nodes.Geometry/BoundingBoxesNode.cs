using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Converts an instance table into a boxes table (see README.md): one box per
/// row, or with a group column, one union box per sorted distinct group value.
/// The label column holds the group value (group mode) or the row's globalId,
/// falling back to instanceIndex (per-row mode). Color columns r,g,b,a are
/// carried through when all four are present (group mode: first row's color).
/// </summary>
public sealed class BoundingBoxesNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.boundingBoxes", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("boxes", PortType.Table)],
        [new("groupColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances"))],
        "Emits the axis-aligned bounding boxes of instances, per row or unioned per group.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
