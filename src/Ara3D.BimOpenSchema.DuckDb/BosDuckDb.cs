using Ara3D.BimOpenSchema.IO;
using Ara3D.DataTable;
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

    /// <summary>Writes every BOS table into the connection. Rows are appended in source array
    /// order, so <c>rowid</c> equals the BOS index — the invariant the text views join on.
    /// Columns are written explicitly rather than through <c>IBimData.ToDataSet()</c>, so enum
    /// columns hold their numeric values regardless of how the SDK's ToDataTable encodes enums.
    /// The view SQL assumes numeric values.</summary>
    // NOTE: .bos files written while ParameterType had the Bool = Int alias (before 2026-08-31)
    // carry ValueType codes shifted +1 for values >= 1; parquet-derived databases built from
    // those files mislabel typed values. Re-export the .bos file to fix.
    public static void LoadBimData(this DuckDBConnection conn, IBimData data)
    {
        conn.WriteBosTable("Strings",
            ("Strings", typeof(string), Col(data.Strings, s => s)));
        conn.WriteBosTable("Numbers",
            ("Numbers", typeof(float), Col(data.Numbers, n => n)));
        conn.WriteBosTable("Documents",
            ("Title", typeof(int), Col(data.Documents, d => (int)d.Title)),
            ("Path", typeof(int), Col(data.Documents, d => (int)d.Path)));
        conn.WriteBosTable("Entities",
            ("LocalId", typeof(long), Col(data.Entities, e => e.LocalId)),
            ("GlobalId", typeof(int), Col(data.Entities, e => (int)e.GlobalId)),
            ("Document", typeof(int), Col(data.Entities, e => (int)e.Document)),
            ("Name", typeof(int), Col(data.Entities, e => (int)e.Name)),
            ("Category", typeof(int), Col(data.Entities, e => (int)e.Category)),
            ("Type", typeof(int), Col(data.Entities, e => (int)e.Type)));
        conn.WriteBosTable("Descriptors",
            ("Name", typeof(int), Col(data.Descriptors, d => (int)d.Name)),
            ("Units", typeof(int), Col(data.Descriptors, d => (int)d.Units)),
            ("Group", typeof(int), Col(data.Descriptors, d => (int)d.Group)),
            ("Type", typeof(int), Col(data.Descriptors, d => (int)d.Type)));
        conn.WriteBosTable("Parameters",
            ("Entity", typeof(int), Col(data.Parameters, p => (int)p.Entity)),
            ("Descriptor", typeof(int), Col(data.Parameters, p => (int)p.Descriptor)),
            ("Value", typeof(int), Col(data.Parameters, p => p.Value)));
        conn.WriteBosTable("Relations",
            ("EntityA", typeof(int), Col(data.Relations, r => (int)r.EntityA)),
            ("EntityB", typeof(int), Col(data.Relations, r => (int)r.EntityB)),
            ("RelationType", typeof(int), Col(data.Relations, r => (int)r.RelationType)));
        conn.WriteBosTable("Points",
            ("X", typeof(float), Col(data.Points, p => p.X)),
            ("Y", typeof(float), Col(data.Points, p => p.Y)),
            ("Z", typeof(float), Col(data.Points, p => p.Z)));
        conn.WriteBosTable("Diagnostics",
            ("Type", typeof(int), Col(data.Diagnostics, d => (int)d.Type)),
            ("Document", typeof(int), Col(data.Diagnostics, d => (int)d.Document)),
            ("Entity", typeof(int), Col(data.Diagnostics, d => (int)d.Entity)),
            ("Message", typeof(int), Col(data.Diagnostics, d => (int)d.Message)));
    }

    private static object[] Col<T>(IReadOnlyList<T> items, Func<T, object> value)
    {
        var r = new object[items.Count];
        for (var i = 0; i < r.Length; i++)
            r[i] = value(items[i]);
        return r;
    }

    private static void WriteBosTable(
        this DuckDBConnection conn,
        string name,
        params (string Name, Type Type, object[] Values)[] columns)
    {
        var builder = new DataTableBuilder(name);
        foreach (var (colName, type, values) in columns)
            builder.AddColumn(values, colName, type);
        conn.WriteTable(builder.Build(), name);
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
