using System.Globalization;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>Small table helpers shared by the view3d nodes: column lookup, canonical cell text, row selection.</summary>
internal static class TableOps
{
    public static int ColumnIndex(this IDataTable table, string name)
    {
        for (var i = 0; i < table.Columns.Count; i++)
            if (string.Equals(table.Columns[i].Descriptor.Name, name, StringComparison.OrdinalIgnoreCase))
                return i;
        return -1;
    }

    public static int RequireColumn(this IDataTable table, string name)
        => table.ColumnIndex(name) is var i && i >= 0
            ? i
            : throw new ArgumentException($"Table '{table.Name}' has no column '{name}'");

    public static int RowCount(this IDataTable table)
        => table.Columns.Count == 0 ? 0 : table.Columns[0].Count;

    /// <summary>The canonical-text key set of an ids table, read from its column named
    /// like the join column, or its first column when absent (the ids-join convention
    /// shared by view3d.isolate, view3d.hide, and view3d.opacity).</summary>
    public static HashSet<string> IdKeys(this IDataTable ids, string joinName)
    {
        var column = ids.ColumnIndex(joinName) is var found && found >= 0 ? found : 0;
        var keys = new HashSet<string>();
        if (ids.Columns.Count > 0)
            for (var i = 0; i < ids.RowCount(); i++)
                if (CanonicalText(ids[column, i]) is { } key)
                    keys.Add(key);
        return keys;
    }

    /// <summary>Canonical invariant text of a cell, matching the expression language's conventions
    /// (integers plain, doubles round-trip, booleans true/false); null for absent values.</summary>
    public static string? CanonicalText(object? value)
        => value switch
        {
            null => null,
            string s => s,
            bool b => b ? "true" : "false",
            float f => ((double)f).ToString("R", CultureInfo.InvariantCulture),
            double d => d.ToString("R", CultureInfo.InvariantCulture),
            sbyte or byte or short or ushort or int or uint or long or ulong or decimal
                => ((IFormattable)value).ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString(),
        };

    public static double? CellNumber(object? value)
        => value switch
        {
            sbyte or byte or short or ushort or int or uint or long or ulong or float or double or decimal
                => Convert.ToDouble(value, CultureInfo.InvariantCulture),
            _ => null,
        };

    public static bool IsNumeric(this IDataColumn column)
        => IsNumericType(column.Descriptor.Type);

    private static bool IsNumericType(Type t)
        => t == typeof(double) || t == typeof(float) || t == typeof(long) || t == typeof(int)
        || t == typeof(short) || t == typeof(sbyte) || t == typeof(byte) || t == typeof(ushort)
        || t == typeof(uint) || t == typeof(ulong) || t == typeof(decimal);

    /// <summary>Materializes a column (optionally a row subset) into a typed array.</summary>
    public static Array ToTypedArray(this IDataColumn column, IReadOnlyList<int>? rows = null)
    {
        var count = rows?.Count ?? column.Count;
        var array = Array.CreateInstance(column.Descriptor.Type, count);
        for (var i = 0; i < count; i++)
            array.SetValue(column[rows is null ? i : rows[i]], i);
        return array;
    }

    public static void AddColumns(this DataTableBuilder builder, IDataTable table, IReadOnlyList<int>? rows = null)
    {
        foreach (var column in table.Columns)
            builder.AddColumn(column.ToTypedArray(rows), column.Descriptor.Name, column.Descriptor.Type);
    }

    public static IDataTable SelectRows(this IDataTable table, IReadOnlyList<int> rows, string name)
    {
        var builder = new DataTableBuilder(name);
        builder.AddColumns(table, rows);
        return builder.Build();
    }
}
