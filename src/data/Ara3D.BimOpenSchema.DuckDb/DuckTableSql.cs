using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataTable;

namespace Ara3D.BimOpenSchema.DuckDb;

/// <summary>
/// The generated-SQL backbone shared by the table-transform node packs:
/// load flowing tables into an in-memory DuckDB, run one statement, read the
/// result back with date columns normalized to ISO-8601 text. Lives below the
/// packs because packs never reference each other.
/// </summary>
public static class DuckTableSql
{
    /// <summary>Runs one SQL statement over the given tables (each registered
    /// under its name) and returns the result, dates normalized to ISO text.</summary>
    public static IDataTable Run(IReadOnlyList<(string Name, IDataTable Table)> tables, string sql)
    {
        using var conn = BosDuckDb.OpenInMemory();
        foreach (var (name, table) in tables)
            conn.WriteTable(table, name);
        return conn.Query(sql, "result").NormalizeDatesToText();
    }

    /// <summary>Run over a single table registered as "t".</summary>
    public static IDataTable Run(IDataTable table, string sql)
        => Run([("t", table)], sql);

    /// <summary>Runs generated SQL, rethrowing engine failures with the node
    /// kind prefixed so every error a user sees names its node.</summary>
    public static IDataTable Run(string kind, IReadOnlyList<(string Name, IDataTable Table)> tables, string sql)
    {
        try
        {
            return Run(tables, sql);
        }
        catch (Exception e) when (e is not ArgumentException and not OperationCanceledException)
        {
            throw new ArgumentException($"{kind}: {e.Message}", e);
        }
    }

    /// <summary>Kind-prefixed run over a single table registered as "t".</summary>
    public static IDataTable Run(string kind, IDataTable table, string sql)
        => Run(kind, [("t", table)], sql);

    /// <summary>Escapes a name for use as a double-quoted SQL identifier.</summary>
    public static string QuoteIdent(string name)
        => "\"" + name.Replace("\"", "\"\"") + "\"";

    /// <summary>Escapes text for use inside a single-quoted SQL literal.</summary>
    public static string QuoteLiteral(string text)
        => "'" + text.Replace("'", "''") + "'";

    /// <summary>Extension sugar for QuoteIdent.</summary>
    public static string Ident(this string name)
        => QuoteIdent(name);

    /// <summary>Extension sugar for QuoteLiteral.</summary>
    public static string Literal(this string text)
        => QuoteLiteral(text);

    /// <summary>
    /// Tables on the wire carry only the five spec value kinds, so DuckDB
    /// DATE/TIME/TIMESTAMP columns become ISO-8601 text. Returns the input
    /// table unchanged when no such column exists.
    /// </summary>
    public static IDataTable NormalizeDatesToText(this IDataTable table)
    {
        if (!table.Columns.Any(c => IsDateLike(c.Descriptor.Type)))
            return table;
        var builder = new DataTableBuilder(table.Name);
        foreach (var column in table.Columns)
        {
            var dateLike = IsDateLike(column.Descriptor.Type);
            var cells = new object?[table.Rows.Count];
            for (var row = 0; row < cells.Length; row++)
            {
                var cell = table[column.ColumnIndex, row];
                cells[row] = dateLike ? IsoText(cell) : cell;
            }
            builder.AddColumn(cells, column.Descriptor.Name,
                dateLike ? typeof(string) : column.Descriptor.Type);
        }
        return builder.Build();
    }

    private static bool IsDateLike(Type type)
        => type == typeof(DateOnly) || type == typeof(DateTime)
           || type == typeof(TimeOnly) || type == typeof(DateTimeOffset);

    private static string? IsoText(object? cell)
        => cell switch
        {
            null => null,
            DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DateTime d => d.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
            TimeOnly t => t.ToString("HH:mm:ss", CultureInfo.InvariantCulture),
            DateTimeOffset d => d.ToString("yyyy-MM-ddTHH:mm:sszzz", CultureInfo.InvariantCulture),
            _ => cell.ToString(),
        };
}
