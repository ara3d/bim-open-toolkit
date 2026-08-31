using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Emits a one-row camera table (the view-table convention the 3D pane consumes; see README.md).</summary>
public sealed class CameraNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.camera", 1, NodeCapability.Pure,
        [],
        [new("camera", PortType.Table)],
        [
            new("name", ParamKind.Text, "default"),
            new("posX", ParamKind.Number, "0"),
            new("posY", ParamKind.Number, "0"),
            new("posZ", ParamKind.Number, "0"),
            new("targetX", ParamKind.Number, "0"),
            new("targetY", ParamKind.Number, "0"),
            new("targetZ", ParamKind.Number, "0"),
        ],
        "A named camera as a one-row table: position and look-at target.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var builder = new DataTableBuilder("camera");
        builder.AddColumn(new[] { parameters.GetText("name", "default") }, "name");
        builder.AddColumn(new[] { parameters.GetNumber("posX") }, "posX");
        builder.AddColumn(new[] { parameters.GetNumber("posY") }, "posY");
        builder.AddColumn(new[] { parameters.GetNumber("posZ") }, "posZ");
        builder.AddColumn(new[] { parameters.GetNumber("targetX") }, "targetX");
        builder.AddColumn(new[] { parameters.GetNumber("targetY") }, "targetY");
        builder.AddColumn(new[] { parameters.GetNumber("targetZ") }, "targetZ");
        return [new TableValue(builder.Build())];
    }
}
