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
            new("fov", ParamKind.Number, "60"),
        ],
        "A named camera as a one-row table: position, look-at target, and the vertical field of view "
        + "in degrees (fov, default 60). The 3D pane's Comment button adds one holding the current "
        + "camera and wires it into bcf.issue, which turns it into a BCF viewpoint.");

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
        builder.AddColumn(new[] { parameters.GetNumber("fov", 60) }, "fov");
        return [new TableValue(builder.Build())];
    }
}
