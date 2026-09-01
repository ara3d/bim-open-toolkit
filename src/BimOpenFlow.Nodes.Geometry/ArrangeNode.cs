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
        var groups = GroupIndices(table, groupCol, n);
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

        return [new TableValue(ApplyOffsets(table, dx, dy, new double[n]))];
    }

    private static double Number(IDataTable table, int col, int row)
        => TableOps.CellNumber(table[col, row]) ?? 0;

    private static double[] Filled(int count, double value)
    {
        var result = new double[count];
        Array.Fill(result, value);
        return result;
    }

    /// <summary>Per-row 0-based group index by sorted distinct canonical group text; -1 for null cells.</summary>
    private static int[] GroupIndices(IDataTable table, int groupCol, int rowCount)
    {
        var distinct = new SortedSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < rowCount; i++)
            if (TableOps.CanonicalText(table[groupCol, i]) is { } key)
                distinct.Add(key);

        var index = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var key in distinct)
            index.Add(key, index.Count);

        var result = new int[rowCount];
        for (var i = 0; i < rowCount; i++)
            result[i] = TableOps.CanonicalText(table[groupCol, i]) is { } key ? index[key] : -1;
        return result;
    }

    // TODO: dedupe ApplyOffsets/Shifted/DeltaFor/GroupIndices with SpacingNode into a shared helper (supervisor refactor step).

    /// <summary>Adds the per-row deltas onto offsetX/Y/Z (creating them at the end, in x,y,z order,
    /// when absent) and shifts minX..maxZ by the same deltas when all six bounds columns exist.</summary>
    private static IDataTable ApplyOffsets(IDataTable table, double[] dx, double[] dy, double[] dz)
    {
        (string Name, double[] Delta)[] offsets = [("offsetX", dx), ("offsetY", dy), ("offsetZ", dz)];
        (string Name, double[] Delta)[] bounds =
            [("minX", dx), ("minY", dy), ("minZ", dz), ("maxX", dx), ("maxY", dy), ("maxZ", dz)];
        var shiftBounds = true;
        foreach (var (name, _) in bounds)
            shiftBounds &= table.ColumnIndex(name) >= 0;

        var builder = new DataTableBuilder(table.Name);
        foreach (var column in table.Columns)
        {
            var name = column.Descriptor.Name;
            var delta = DeltaFor(offsets, name) ?? (shiftBounds ? DeltaFor(bounds, name) : null);
            if (delta is null)
                builder.AddColumn(column.ToTypedArray(), name, column.Descriptor.Type);
            else
                builder.AddColumn(Shifted(column, delta), name);
        }
        foreach (var (name, delta) in offsets)
            if (table.ColumnIndex(name) < 0)
                builder.AddColumn(delta, name);
        return builder.Build();
    }

    private static double[]? DeltaFor((string Name, double[] Delta)[] pairs, string name)
    {
        foreach (var (n, d) in pairs)
            if (string.Equals(n, name, StringComparison.OrdinalIgnoreCase))
                return d;
        return null;
    }

    private static double[] Shifted(IDataColumn column, double[] delta)
    {
        var result = new double[delta.Length];
        for (var i = 0; i < delta.Length; i++)
            result[i] = (TableOps.CellNumber(column[i]) ?? 0) + delta[i];
        return result;
    }
}
