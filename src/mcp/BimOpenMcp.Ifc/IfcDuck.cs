using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace BimOpenMcp.Ifc;

public readonly record struct IfcColumn(string Name, string Type);

public readonly record struct IfcTableInfo(string Table, long RowCount, IReadOnlyList<IfcColumn> Columns);

/// <summary>A slice of a query result. <paramref name="Total"/> is the row count of the unpaged
/// query, so a caller can tell a complete answer from a truncated one without a second call.</summary>
public readonly record struct IfcQueryResult(
    long Total,
    int Skip,
    int Count,
    IReadOnlyList<string> Columns,
    IReadOnlyList<IReadOnlyList<object?>> Rows);

/// <summary>Read-only SQL over the DuckDB database derived from a model's BOS conversion.</summary>
public static class IfcDuck
{
    /// <summary>Adds the text views (EntityText, ParameterText, RelationText, StoreyOfEntity,
    /// StoreyOfElement). They are defined once, in <see cref="BosDuckDbViews"/>, so the MCP server
    /// and the flow graphs cannot drift into answering the same question two ways.</summary>
    public static void CreateViews(FilePath database)
        => BosDuckDbViews.CreateViews(database);

    public static IfcQueryResult Query(FilePath database, string sql, int skip, int take)
    {
        if (skip < 0)
            throw new ArgumentOutOfRangeException(nameof(skip), "skip cannot be negative.");
        if (take < 1)
            throw new ArgumentOutOfRangeException(nameof(take), "take must be at least 1.");

        var inner = ReadOnlyQuery(sql);
        using var conn = Connect(database);
        var total = Scalar(conn, $"SELECT count(*) FROM ({inner}) AS _q");
        var rows = Read(conn, $"SELECT * FROM ({inner}) AS _q LIMIT {take} OFFSET {skip}");
        return new IfcQueryResult(total, skip, rows.Rows.Count, rows.Columns, rows.Rows);
    }

    /// <summary>Writes the full, unpaged result of a query to a file. The format follows the
    /// output extension: <c>.parquet</c>, <c>.json</c>, anything else CSV with a header row.</summary>
    public static long Export(FilePath database, string sql, FilePath output)
    {
        var inner = ReadOnlyQuery(sql);
        var directory = Path.GetDirectoryName(output.FullPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);

        using var conn = Connect(database);
        var total = Scalar(conn, $"SELECT count(*) FROM ({inner}) AS _q");
        Execute(conn, $"COPY ({inner}) TO '{Escape(output.FullPath.Replace('\\', '/'))}' ({CopyOptions(output)})");
        return total;
    }

    public static IReadOnlyList<IfcTableInfo> Tables(FilePath database, string? only = null)
    {
        using var conn = Connect(database);
        var columns = Read(
            conn,
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            + "WHERE table_schema = 'main' ORDER BY table_name, ordinal_position");

        var grouped = new Dictionary<string, List<IfcColumn>>(StringComparer.OrdinalIgnoreCase);
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

            list.Add(new IfcColumn(row[1]?.ToString() ?? "", row[2]?.ToString() ?? ""));
        }

        if (only != null && order.Count == 0)
            throw new ArgumentException($"No table named '{only}'. Call ifc_table with no 'table' argument to list them.");

        var result = new IfcTableInfo[order.Count];
        for (var i = 0; i < result.Length; i++)
        {
            var name = order[i];
            result[i] = new IfcTableInfo(name, Scalar(conn, $"SELECT count(*) FROM \"{name}\""), grouped[name]);
        }

        return result;
    }

    /// <summary>Accepts a single read-only statement and returns it without its trailing semicolon.
    /// The database is a throwaway copy, but a query tool that can silently rewrite it would make
    /// every later answer in the session unexplainable.</summary>
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

    private static DuckDBConnection Connect(FilePath database)
    {
        var conn = new DuckDBConnection($"DataSource={database.FullPath}");
        conn.Open();
        return conn;
    }

    private static long Scalar(DuckDBConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return System.Convert.ToInt64(cmd.ExecuteScalar());
    }

    private static void Execute(DuckDBConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    private static (IReadOnlyList<string> Columns, IReadOnlyList<IReadOnlyList<object?>> Rows) Read(
        DuckDBConnection conn,
        string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        using var reader = cmd.ExecuteReader();

        var names = new string[reader.FieldCount];
        for (var i = 0; i < names.Length; i++)
            names[i] = reader.GetName(i);

        var rows = new List<IReadOnlyList<object?>>();
        while (reader.Read())
        {
            var row = new object?[names.Length];
            for (var i = 0; i < row.Length; i++)
                row[i] = reader.IsDBNull(i) ? null : Jsonable(reader.GetValue(i));
            rows.Add(row);
        }

        return (names, rows);
    }

    /// <summary>DuckDB hands back provider-specific values for several logical types; anything the
    /// JSON writer does not model natively is reported as its text form rather than as an object
    /// with the provider's internal field names.</summary>
    private static object? Jsonable(object value)
        => value switch
        {
            bool or string or byte or sbyte or short or ushort or int or uint
                or long or ulong or float or double or decimal or DateTime or Guid => value,
            byte[] bytes => $"{bytes.Length} bytes",
            _ => value.ToString(),
        };

    private static string Escape(string path)
        => path.Replace("'", "''");
}
