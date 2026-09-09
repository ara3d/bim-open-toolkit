using Ara3D.BimOpenSchema.BuildingModel.Workflows;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.IO;
using DuckDB.NET.Data;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.DuckDb;

/// <summary>Replaceable output boundary for a populated core-model projection.</summary>
public interface IBuildingProjectionWriter
{
    void Write(BuildingProjection projection, string destinationPath);
}

/// <summary>Writes the typed 83-table core schema and the populated projection rows to DuckDB.</summary>
[Impure]
public sealed class DuckDbProjectionWriter : IBuildingProjectionWriter
{
    public void Write(BuildingProjection projection, string destinationPath)
    {
        ArgumentNullException.ThrowIfNull(projection);
        ArgumentException.ThrowIfNullOrWhiteSpace(destinationPath);
        ProjectionStore.Validate(projection);
        if (File.Exists(destinationPath)) throw new IOException($"DuckDB destination already exists: {destinationPath}");
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(destinationPath))!);

        using var connection = new DuckDBConnection($"DataSource={destinationPath}");
        connection.Open();
        CreateTables(connection);
        foreach (var table in CoreSchema.Tables) WriteRows(connection, table, Rows(projection, table.RecordType));
    }

    private static void CreateTables(DuckDBConnection connection)
    {
        using var transaction = connection.BeginTransaction();
        foreach (var table in CoreSchema.Tables)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = $"CREATE TABLE {Quote(table.Name)} ({string.Join(", ", ProjectionColumn.ForRecord(table.RecordType).Select(column => $"{Quote(column.Name)} {column.SqlType}"))})";
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    // The appender writes column vectors directly and costs about a fiftieth of the equivalent INSERT text,
    // so SQL is kept only for the tables holding struct columns the appender cannot express.
    private static void WriteRows(DuckDBConnection connection, CoreTable table, IReadOnlyList<object> rows)
    {
        if (rows.Count == 0) return;
        var columns = ProjectionColumn.ForRecord(table.RecordType);
        var appends = columns.Select(column => ProjectionColumn.Appender(column.Type)).ToArray();
        if (appends.All(append => append is not null)) AppendRows(connection, table, columns, appends!, rows);
        else InsertRows(connection, table, columns, rows);
    }

    private static void AppendRows(DuckDBConnection connection, CoreTable table, ProjectionColumn[] columns,
        Action<IDuckDBAppenderRow, object?>[] appends, IReadOnlyList<object> rows)
    {
        using var appender = connection.CreateAppender(table.Name);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = appender.CreateRow();
            for (var column = 0; column < columns.Length; column++) appends[column](row, columns[column].Read(rows[i]));
            row.EndRow();
        }
    }

    // Planning cost per statement grows faster than the tuple count, so batches are small; 64 measured fastest.
    private const int RowsPerStatement = 64;

    private static void InsertRows(DuckDBConnection connection, CoreTable table, ProjectionColumn[] columns, IReadOnlyList<object> rows)
    {
        using var transaction = connection.BeginTransaction();
        var names = string.Join(", ", columns.Select(column => Quote(column.Name)));
        foreach (var batch in rows.Chunk(RowsPerStatement))
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            var tuples = batch.Select(row => "(" + string.Join(", ", columns.Select(column => column.Parameter(command, row))) + ")");
            command.CommandText = $"INSERT INTO {Quote(table.Name)} ({names}) VALUES {string.Join(", ", tuples)}";
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    private static IReadOnlyList<object> Rows(BuildingProjection projection, Type type)
        => type == typeof(ModelSnapshot) ? [projection.Snapshot] : ProjectionTables.Rows(projection, type);

    private static string Quote(string identifier) => ProjectionColumn.Quote(identifier);
}
