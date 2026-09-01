using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Lays groups of instances out side by side in a square grid on the XY plane
/// (a parts-catalog view). Groups are the sorted distinct canonical values of
/// the group column; every cell is the largest group footprint plus the gap,
/// and each group is moved so its bounds minimum lands at its cell origin.
/// Z is left unchanged. Offsets accumulate onto existing offsetX/Y/Z columns
/// and bounds columns are shifted to match. Null-group rows stay in place.
/// </summary>
public sealed class ArrangeNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.arrange", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("instances", PortType.Table)],
        [
            new("groupColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances")),
            new("gap", ParamKind.Number, "5"),
        ],
        "Arranges each group of instances into its own cell of a ground-plane grid.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException();
}
