using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Shared logic of the offset-producing nodes (view3d.spacing,
/// view3d.arrange): group indexing and offset/bounds column rewriting.</summary>
internal static class OffsetTables
{
    /// <summary>Per-row 0-based group index by sorted distinct canonical group text; -1 for null cells.</summary>
    public static int[] GroupIndices(this IDataTable table, int groupCol)
    {
        var n = table.RowCount();
        var distinct = new SortedSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < n; i++)
            if (TableOps.CanonicalText(table[groupCol, i]) is { } key)
                distinct.Add(key);

        var index = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var key in distinct)
            index.Add(key, index.Count);

        var result = new int[n];
        for (var i = 0; i < n; i++)
            result[i] = TableOps.CanonicalText(table[groupCol, i]) is { } key ? index[key] : -1;
        return result;
    }

    /// <summary>Adds the per-row deltas onto offsetX/Y/Z (creating them at the end, in x,y,z order,
    /// when absent) and shifts minX..maxZ by the same deltas when all six bounds columns exist.</summary>
    public static IDataTable ApplyOffsets(this IDataTable table, double[] dx, double[] dy, double[] dz)
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
