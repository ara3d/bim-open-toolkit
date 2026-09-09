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
        using var transaction = connection.BeginTransaction();
        foreach (var table in CoreSchema.Tables) CreateTable(connection, transaction, table);
        foreach (var table in CoreSchema.Tables) InsertRows(connection, transaction, table, Rows(projection, table.RecordType));
        transaction.Commit();
    }

    private static void CreateTable(DuckDBConnection connection, DuckDBTransaction transaction, CoreTable table)
    {
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = $"CREATE TABLE {Quote(table.Name)} ({string.Join(", ", ProjectionColumn.ForRecord(table.RecordType).Select(column => $"{Quote(column.Name)} {column.SqlType}"))})";
        command.ExecuteNonQuery();
    }

    private static void InsertRows(DuckDBConnection connection, DuckDBTransaction transaction, CoreTable table, IEnumerable<object> rows)
    {
        var columns = ProjectionColumn.ForRecord(table.RecordType);
        foreach (var row in rows)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            var values = columns.Select(column => column.Parameter(command, row)).ToArray();
            command.CommandText = $"INSERT INTO {Quote(table.Name)} ({string.Join(", ", columns.Select(column => Quote(column.Name)))}) VALUES ({string.Join(", ", values)})";
            command.ExecuteNonQuery();
        }
    }
    private static IEnumerable<object> Rows(BuildingProjection projection, Type type)
        => type == typeof(ModelSnapshot) ? [projection.Snapshot] : ProjectionTables.Rows(projection, type);

    private static string Quote(string identifier) => ProjectionColumn.Quote(identifier);
}
