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
        var groups = GroupIndices(table, groupCol, n);
        var dx = new double[n];
        var dy = new double[n];
        var dz = new double[n];
        var target = axis == "y" ? dy : axis == "z" ? dz : dx;
        for (var i = 0; i < n; i++)
            if (groups[i] >= 0)
                target[i] = groups[i] * spacing;

        return [new TableValue(ApplyOffsets(table, dx, dy, dz))];
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

    // TODO: dedupe ApplyOffsets/Shifted/DeltaFor/GroupIndices with ArrangeNode into a shared helper (supervisor refactor step).

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
