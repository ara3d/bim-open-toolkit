using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>Spatial join: assigns each point row (an element center) to the smallest
/// containing box row (a room), by axis-aligned containment.</summary>
public sealed class BimContainmentNode : IFlowNode
{
    public const string Kind = "bim.containment";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs:
        [
            new PortSpec("points", PortType.Table),
            new PortSpec("boxes", PortType.Table),
        ],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params:
        [
            new ParamSpec("x", ParamKind.Text, BimColumns.CenterX, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("y", ParamKind.Text, BimColumns.CenterY, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("z", ParamKind.Text, BimColumns.CenterZ, Suggest: SuggestSource.ColumnsOf("points")),
            new ParamSpec("key", ParamKind.Text, BimColumns.Name, Suggest: SuggestSource.ColumnsOf("boxes")),
            new ParamSpec("as", ParamKind.Text, "ContainedIn"),
            new ParamSpec("ignoreZ", ParamKind.Boolean, "false"),
        ],
        "Adds a column ('as') to the points table holding the 'key' of the smallest box row "
        + "whose MinX..MaxZ box contains the point (x, y, z); rows in no box get null. With "
        + "ignoreZ, containment is tested in plan (XY) only. Typical use: element centers from "
        + "bim.bounds against room boxes from bim.rooms, when the model has no room parameters.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track GEO");
}
