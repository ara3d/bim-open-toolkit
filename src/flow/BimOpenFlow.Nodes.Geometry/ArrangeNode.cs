using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;

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
    {
        var table = ((TableValue)inputs[0]).Table;
        var groupCol = table.RequireColumn(parameters.GetText("groupColumn"));
        var gap = parameters.GetNumber("gap", 5);
        var minXCol = table.RequireColumn("minX");
        var minYCol = table.RequireColumn("minY");
        table.RequireColumn("minZ");
        var maxXCol = table.RequireColumn("maxX");
        var maxYCol = table.RequireColumn("maxY");
        table.RequireColumn("maxZ");

        var n = table.RowCount();
        var groups = table.GroupIndices(groupCol);
        var groupCount = 0;
        foreach (var g in groups)
            groupCount = Math.Max(groupCount, g + 1);

        var dx = new double[n];
        var dy = new double[n];
        if (groupCount > 0)
        {
            var gMinX = Filled(groupCount, double.MaxValue);
            var gMinY = Filled(groupCount, double.MaxValue);
            var gMaxX = Filled(groupCount, double.MinValue);
            var gMaxY = Filled(groupCount, double.MinValue);
            for (var i = 0; i < n; i++)
            {
                var g = groups[i];
                if (g < 0)
                    continue;
                gMinX[g] = Math.Min(gMinX[g], Number(table, minXCol, i));
                gMinY[g] = Math.Min(gMinY[g], Number(table, minYCol, i));
                gMaxX[g] = Math.Max(gMaxX[g], Number(table, maxXCol, i));
                gMaxY[g] = Math.Max(gMaxY[g], Number(table, maxYCol, i));
            }

            var extentX = 0.0;
            var extentY = 0.0;
            for (var g = 0; g < groupCount; g++)
            {
                extentX = Math.Max(extentX, gMaxX[g] - gMinX[g]);
                extentY = Math.Max(extentY, gMaxY[g] - gMinY[g]);
            }
            var cellW = extentX + gap;
            var cellH = extentY + gap;
            var cols = (int)Math.Ceiling(Math.Sqrt(groupCount));

            for (var i = 0; i < n; i++)
            {
                var g = groups[i];
                if (g < 0)
                    continue;
                dx[i] = g % cols * cellW - gMinX[g];
                dy[i] = g / cols * cellH - gMinY[g];
            }
        }

        return [new TableValue(table.ApplyOffsets(dx, dy, new double[n]))];
    }

    private static double Number(IDataTable table, int col, int row)
        => TableOps.CellNumber(table[col, row]) ?? 0;

    private static double[] Filled(int count, double value)
    {
        var result = new double[count];
        Array.Fill(result, value);
        return result;
    }

}
