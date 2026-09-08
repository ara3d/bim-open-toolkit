using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;
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

/// <summary>Writes the direct 83-table core schema and the populated projection rows to DuckDB.</summary>
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
        command.CommandText = $"CREATE TABLE {Quote(table.Name)} ({string.Join(", ", table.Columns.Select(column => $"{Quote(column.Name)} {SqlType(column.ValueType)}"))})";
        command.ExecuteNonQuery();
    }

    private static void InsertRows(DuckDBConnection connection, DuckDBTransaction transaction, CoreTable table, IEnumerable<object> rows)
    {
        foreach (var row in rows)
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = $"INSERT INTO {Quote(table.Name)} ({string.Join(", ", table.Columns.Select(column => Quote(column.Name)))}) VALUES ({string.Join(", ", table.Columns.Select((_, index) => "$p" + index))})";
            foreach (var (column, index) in table.Columns.Select((column, index) => (column, index)))
                command.Parameters.Add(new DuckDBParameter("p" + index,
                    SqlValue(table.RecordType.GetProperty(ToPascalCase(column.Name))!.GetValue(row), column.ValueType)));
            command.ExecuteNonQuery();
        }
    }

    private static IEnumerable<object> Rows(BuildingProjection projection, Type type)
        => type == typeof(ModelSnapshot) ? [projection.Snapshot] :
            type == typeof(SourceRevision) ? projection.SourceRevisions :
            type == typeof(SourceObject) ? projection.SourceObjects :
            type == typeof(BimObject) ? projection.Objects :
            type == typeof(Evidence) ? projection.Evidence :
            type == typeof(Storey) ? projection.Storeys :
            type == typeof(Space) ? projection.Spaces :
            type == typeof(Door) ? projection.Doors :
            type == typeof(Roof) ? projection.Roofs :
            type == typeof(FinishSurface) ? projection.Finishes :
            type == typeof(SourceDocument) ? projection.Documents :
            type == typeof(InterpretationPolicy) ? projection.Policies : [];

    private static string SqlType(Type type)
    {
        if (IsKey(type)) return "VARCHAR";
        var valueType = Nullable.GetUnderlyingType(type) ?? type;
        if (valueType == typeof(string) || valueType.IsEnum) return "VARCHAR";
        if (valueType == typeof(bool)) return "BOOLEAN";
        if (valueType == typeof(int)) return "INTEGER";
        if (valueType == typeof(long)) return "BIGINT";
        if (valueType == typeof(double) || valueType == typeof(float)) return "DOUBLE";
        if (valueType == typeof(decimal)) return "DECIMAL(38, 10)";
        if (valueType == typeof(DateOnly)) return "DATE";
        if (valueType == typeof(DateTimeOffset)) return "TIMESTAMPTZ";
        return "JSON";
    }

    private static object SqlValue(object? value, Type type)
    {
        if (value is null) return DBNull.Value;
        if (IsKey(type)) return value.ToString()!;
        var valueType = Nullable.GetUnderlyingType(type) ?? type;
        if (valueType.IsEnum) return value.ToString()!;
        if (valueType == typeof(string) || valueType == typeof(bool) || valueType == typeof(int) || valueType == typeof(long) ||
            valueType == typeof(double) || valueType == typeof(float) || valueType == typeof(decimal) ||
            valueType == typeof(DateOnly) || valueType == typeof(DateTimeOffset)) return value;
        return JsonSerializer.Serialize(value, ProjectionStore.Options());
    }

    private static bool IsKey(Type type) => type.IsGenericType &&
        (type.GetGenericTypeDefinition() == typeof(ReferenceKey<>) || type.GetGenericTypeDefinition() == typeof(SnapshotKey<>));

    private static string Quote(string identifier) => '"' + identifier.Replace("\"", "\"\"") + '"';

    private static string ToPascalCase(string name)
        => string.Concat(name.Split('_').Select(part => char.ToUpperInvariant(part[0]) + part[1..]));
}
