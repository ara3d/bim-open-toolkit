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
        + "camera and wires it into bcf.issue, which turns it into a BCF viewpoint.",
        Schemas:
        [
            KindSchemas.Static("camera",
                [KindColumn.Plain("name", ColumnType.Text, nullable: false),
                 .. NumberColumns.Select(c => KindColumn.Plain(c, ColumnType.Number, nullable: false))]),
        ]);

    /// <summary>The numeric columns after <c>name</c>, in output order; each is the parameter of the same name.</summary>
    private static readonly string[] NumberColumns = ["posX", "posY", "posZ", "targetX", "targetY", "targetZ", "fov"];

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var builder = new DataTableBuilder("camera");
        builder.AddColumn(new[] { parameters.GetText("name", "default") }, "name");
        foreach (var column in NumberColumns)
            builder.AddColumn(new[] { parameters.GetNumber(column, column == "fov" ? 60 : 0) }, column);
        return [new TableValue(builder.Build())];
    }
}
