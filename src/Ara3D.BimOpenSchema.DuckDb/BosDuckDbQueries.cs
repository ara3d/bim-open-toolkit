using Ara3D.DataTable;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.DuckDb;

public readonly record struct BosColumnInfo(string Name, string Type);

public readonly record struct BosTableInfo(string Table, long RowCount, IReadOnlyList<BosColumnInfo> Columns);

/// <summary>A slice of a query result. <see cref="Total"/> is the row count of the unpaged
/// query, so a caller can tell a complete answer from a truncated one without a second call.</summary>
public readonly record struct BosQueryPage(long Total, int Skip, IDataTable Table);

/// <summary>Read-only SQL over a DuckDB database derived from a BOS dataset.</summary>
public static class BosDuckDbQueries
{
    /// <summary>Runs any SQL and materializes the full result.</summary>
    // TODO: Ara3D.BimOpenSchema.IO's DuckDbUtils.ReadTable is this function restricted to
    // "SELECT * FROM table"; consolidate there once that project can depend on this one.
    public static IDataTable Query(this DuckDBConnection conn, string sql, string name = "Query")
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        using var reader = cmd.ExecuteReader();

        var fieldCount = reader.FieldCount;
        var names = new string[fieldCount];
        var types = new Type[fieldCount];
        var values = new List<object>[fieldCount];
        for (var i = 0; i < fieldCount; i++)
        {
            names[i] = reader.GetName(i);
            types[i] = reader.GetFieldType(i);
            values[i] = [];
        }

        while (reader.Read())
            for (var i = 0; i < fieldCount; i++)
                values[i].Add(reader.IsDBNull(i) ? null! : reader.GetValue(i));

        var builder = new DataTableBuilder(name);
        for (var i = 0; i < fieldCount; i++)
            builder.AddColumn(values[i].ToArray(), names[i], types[i]);
        return builder.Build();
    }

    /// <summary>Runs a validated read-only query and returns one page of it plus the unpaged total.</summary>
    public static BosQueryPage QueryPage(this DuckDBConnection conn, string sql, int skip, int take)
    {
        if (skip < 0)
            throw new ArgumentOutOfRangeException(nameof(skip), "skip cannot be negative.");
        if (take < 1)
            throw new ArgumentOutOfRangeException(nameof(take), "take must be at least 1.");

        var inner = ReadOnlyQuery(sql);
        var total = conn.ScalarInt64($"SELECT count(*) FROM ({inner}) AS _q");
        var table = conn.Query($"SELECT * FROM ({inner}) AS _q LIMIT {take} OFFSET {skip}");
        return new(total, skip, table);
    }

    /// <summary>Writes the full, unpaged result of a query to a file. The format follows the
    /// output extension: <c>.parquet</c>, <c>.json</c>, anything else CSV with a header row.</summary>
    public static long Export(this DuckDBConnection conn, string sql, FilePath output)
    {
        var inner = ReadOnlyQuery(sql);
        var directory = Path.GetDirectoryName(output.FullPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        var total = conn.ScalarInt64($"SELECT count(*) FROM ({inner}) AS _q");
        conn.Execute($"COPY ({inner}) TO '{Escape(output.FullPath.Replace('\\', '/'))}' ({CopyOptions(output)})");
        return total;
    }

    public static IReadOnlyList<BosTableInfo> GetTableInfo(this DuckDBConnection conn, string? only = null)
    {
        var columns = conn.Query(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            + "WHERE table_schema = 'main' ORDER BY table_name, ordinal_position");

        var grouped = new Dictionary<string, List<BosColumnInfo>>(StringComparer.OrdinalIgnoreCase);
        var order = new List<string>();
        foreach (var row in columns.Rows)
        {
            var table = row[0]?.ToString() ?? "";
            if (only != null && !table.Equals(only, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!grouped.TryGetValue(table, out var list))
            {
                grouped[table] = list = [];
                order.Add(table);
            }

            list.Add(new BosColumnInfo(row[1]?.ToString() ?? "", row[2]?.ToString() ?? ""));
        }

        if (only != null && order.Count == 0)
            throw new ArgumentException($"No table named '{only}'.");

        var result = new BosTableInfo[order.Count];
        for (var i = 0; i < result.Length; i++)
        {
            var name = order[i];
            result[i] = new BosTableInfo(name, conn.ScalarInt64($"SELECT count(*) FROM \"{name}\""), grouped[name]);
        }

        return result;
    }

    /// <summary>Accepts a single read-only statement and returns it without its trailing semicolon.
    /// A query surface that can silently rewrite the database would make every later answer
    /// unexplainable.</summary>
    public static string ReadOnlyQuery(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
            throw new ArgumentException("A SQL query is required.", nameof(sql));

        var trimmed = sql.Trim().TrimEnd(';').Trim();
        if (trimmed.Contains(';'))
            throw new ArgumentException("Only one statement is allowed per query.", nameof(sql));

        if (!StartsWithWord(trimmed, "select") && !StartsWithWord(trimmed, "with"))
            throw new ArgumentException("Only SELECT and WITH queries are allowed.", nameof(sql));

        return trimmed;
    }

    private static bool StartsWithWord(string text, string word)
        => text.StartsWith(word, StringComparison.OrdinalIgnoreCase)
           && (text.Length == word.Length || !char.IsLetterOrDigit(text[word.Length]));

    private static string CopyOptions(FilePath output)
        => Path.GetExtension(output.FullPath).ToLowerInvariant() switch
        {
            ".parquet" => "FORMAT PARQUET",
            ".json" => "FORMAT JSON",
            _ => "FORMAT CSV, HEADER",
        };

    private static string Escape(string path)
        => path.Replace("'", "''");
}
