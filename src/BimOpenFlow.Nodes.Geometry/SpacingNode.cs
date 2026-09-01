using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Spreads groups of instances apart along one axis ("explode by column"):
/// groups are the sorted distinct canonical values of the group column, and
/// group i is offset by i * spacing. Offsets accumulate onto existing
/// offsetX/Y/Z columns (so spacing nodes chain) and the bounds columns are
/// shifted by the same amount. Rows with a null group value are left in place.
/// </summary>
public sealed class SpacingNode : IFlowNode
{
    public NodeSpec Spec { get; } = new(
        "view3d.spacing", 1, NodeCapability.Pure,
        [new("instances", PortType.Table)],
        [new("instances", PortType.Table)],
        [
            new("groupColumn", ParamKind.Text, Suggest: SuggestSource.ColumnsOf("instances")),
            new("axis", ParamKind.Enum, "x", ["x", "y", "z"]),
            new("spacing", ParamKind.Number, "10"),
        ],
        "Offsets each group of instances along an axis by its group index times the spacing.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
    {
        var table = ((TableValue)inputs[0]).Table;
        var groupCol = table.RequireColumn(parameters.GetText("groupColumn"));
        var axis = parameters.GetText("axis", "x");
        var spacing = parameters.GetNumber("spacing", 10);

        var n = table.RowCount();
        var groups = table.GroupIndices(groupCol);
        var dx = new double[n];
        var dy = new double[n];
        var dz = new double[n];
        var target = axis == "y" ? dy : axis == "z" ? dz : dx;
        for (var i = 0; i < n; i++)
            if (groups[i] >= 0)
                target[i] = groups[i] * spacing;

        return [new TableValue(table.ApplyOffsets(dx, dy, dz))];
    }
}
