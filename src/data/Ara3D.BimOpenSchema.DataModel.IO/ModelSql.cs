using System.Globalization;
using DuckDB.NET.Data;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.IO;

[Impure]
public static class ModelSql
{
    /// <summary>Creates a new set of tables atomically. Existing table names cause rollback rather than data loss.</summary>
    public static void WriteDuckDb(BimModel model, DuckDBConnection connection)
    {
        using var transaction = connection.BeginTransaction();
        foreach (var table in model.ToRelationalTables())
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = CreateTable(table);
            command.ExecuteNonQuery();
            using var appender = connection.CreateAppender(table.Name);
            for (var i = 0; i < table.RowCount; i++)
            {
                var row = appender.CreateRow();
                foreach (var value in table.ReadRow(i)) Append(row, value);
                row.EndRow();
            }
        }
        transaction.Commit();
    }

    /// <summary>Portable SQL for DuckDB and SQLite. Streaming output; text is quoted, never interpreted as SQL.</summary>
    public static void WriteSql(BimModel model, TextWriter destination)
    {
        destination.WriteLine("BEGIN TRANSACTION;");
        foreach (var table in model.ToRelationalTables())
        {
            destination.WriteLine(CreateTable(table));
            for (var i = 0; i < table.RowCount; i++)
                destination.WriteLine($"INSERT INTO {Quote(table.Name)} VALUES ({string.Join(",", table.ReadRow(i).Select(Literal))});");
        }
        destination.WriteLine("COMMIT;");
    }

    public static string CreateTable(RelationalTable table)
        => $"CREATE TABLE {Quote(table.Name)} ({string.Join(",", table.Columns.Select(c =>
            $"{Quote(c.Name)} {SqlType(c.Kind)}{(c.PrimaryKey ? " PRIMARY KEY" : c.Nullable ? "" : " NOT NULL")}"))});";

    private static string Quote(string name) => "\"" + name.Replace("\"", "\"\"") + "\"";
    private static string SqlType(ColumnKind kind) => kind switch
    {
        ColumnKind.Integer => "INTEGER", ColumnKind.Int64 => "BIGINT", ColumnKind.Number => "DOUBLE",
        ColumnKind.Boolean => "BOOLEAN", ColumnKind.Text => "VARCHAR", _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };
    private static string Literal(object? value) => value switch
    {
        null => "NULL", string s => "'" + s.Replace("'", "''") + "'", bool b => b ? "TRUE" : "FALSE",
        int i => i.ToString(CultureInfo.InvariantCulture), long l => l.ToString(CultureInfo.InvariantCulture),
        double d when double.IsFinite(d) => d.ToString("R", CultureInfo.InvariantCulture),
        _ => throw new ArgumentException("Unsupported SQL value.")
    };
    private static void Append(IDuckDBAppenderRow row, object? value)
    {
        switch (value)
        {
            case null: row.AppendNullValue(); break;
            case int i: row.AppendValue(i); break;
            case long l: row.AppendValue(l); break;
            case double d: row.AppendValue(d); break;
            case string s: row.AppendValue(s); break;
            case bool b: row.AppendValue(b); break;
            default: throw new ArgumentException("Unsupported SQL value.");
        }
    }
}
