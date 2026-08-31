using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.DuckDb;

/// <summary>Connection primitives for DuckDB databases over BIM Open Schema data.</summary>
public static class BosDuckDb
{
    public static DuckDBConnection OpenInMemory()
        => Open(":memory:");

    public static DuckDBConnection Open(FilePath database)
        => Open(database.FullPath);

    private static DuckDBConnection Open(string dataSource)
    {
        var conn = new DuckDBConnection($"DataSource={dataSource}");
        conn.Open();
        return conn;
    }

    /// <summary>Writes every BOS table (Entities, Strings, Parameters, ...) into the connection.
    /// Rows are appended in source array order, so <c>rowid</c> equals the BOS index — the
    /// invariant the text views join on.</summary>
    public static void LoadBimData(this DuckDBConnection conn, IBimData data)
    {
        foreach (var table in data.ToDataSet().Tables)
            conn.WriteTable(table, table.Name);
    }

    /// <summary>An in-memory database holding the BOS tables plus the text views, ready to query.</summary>
    public static DuckDBConnection ToDuckDb(this IBimData data)
    {
        var conn = OpenInMemory();
        conn.LoadBimData(data);
        conn.CreateViews();
        return conn;
    }

    public static void Execute(this DuckDBConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    public static long ScalarInt64(this DuckDBConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return Convert.ToInt64(cmd.ExecuteScalar());
    }
}
