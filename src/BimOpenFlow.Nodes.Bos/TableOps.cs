using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataTable;

namespace BimOpenFlow.Nodes.Bos;

/// <summary>Table helpers shared by the nodes: row selection, SQL-over-one-table,
/// and column lookup by name.</summary>
public static class TableOps
{
    public static IDataTable KeepRows(this IDataTable table, IReadOnlyList<int> rows, string name)
    {
        var builder = new DataTableBuilder(name);
        foreach (var c in table.Columns)
        {
            var values = new object?[rows.Count];
            for (var i = 0; i < rows.Count; i++)
                values[i] = c[rows[i]];
            builder.AddColumn(values, c.Descriptor.Name, c.Descriptor.Type);
        }
        return builder.Build();
    }

    /// <summary>Loads the table into an in-memory DuckDB as table "t" and runs one
    /// read-only query (validated by <see cref="BosDuckDbQueries.ReadOnlyQuery"/>).</summary>
    public static IDataTable QueryOver(this IDataTable table, string sql, string name)
    {
        var validated = BosDuckDbQueries.ReadOnlyQuery(sql);
        using var conn = BosDuckDb.OpenInMemory();
        conn.WriteTable(table, "t");
        return conn.Query(validated, name);
    }

    public static IDataColumn RequireColumn(this IDataTable table, string name, string kind)
        => table.Columns.FirstOrDefault(c =>
               string.Equals(c.Descriptor.Name, name, StringComparison.OrdinalIgnoreCase))
           ?? throw new ArgumentException($"{kind}: no column named '{name}'.");

    public static string QuoteIdentifier(this string name)
        => $"\"{name.Replace("\"", "\"\"")}\"";
}
