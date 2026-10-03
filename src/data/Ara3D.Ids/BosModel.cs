using Ara3D.BimOpenSchema.IO;
using DuckDB.NET.Data;

namespace Ara3D.Ids;

/// <summary>What the evaluator reads from a BOS database once per IDS: the classes present, the
/// project's length unit, and whether IFC data types were recorded beside the tables.</summary>
internal sealed record BosModel(
    DuckDBConnection Connection,
    IReadOnlyList<string> Categories,
    double? LengthToMetre,
    bool HasDataTypes)
{
    public static BosModel Read(DuckDBConnection conn)
        => new(
            conn,
            conn.Strings("SELECT DISTINCT Category FROM EntityText WHERE Category IS NOT NULL ORDER BY 1"),
            conn.Strings($"SELECT Value FROM ParameterText WHERE Name = '{IfcLengthUnit.ScaleParameter}' LIMIT 1")
                .Select(v => double.TryParse(v, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : (double?)null)
                .FirstOrDefault(),
            conn.Strings($"SELECT table_name FROM information_schema.tables WHERE table_name = '{IfcDataTypes.TableName}'").Count > 0);

    /// <summary>The entities of the given classes, or every entity with a GlobalId when
    /// <paramref name="categories"/> is null, each with all of its parameters.</summary>
    public IReadOnlyList<BosEntity> Entities(IReadOnlyList<string>? categories)
    {
        var filter = categories is null
            ? "t.GlobalId IS NOT NULL AND t.GlobalId <> ''"
            : categories.Count == 0 ? "FALSE" : $"t.Category IN ({string.Join(", ", categories.Select(Quote))})";
        var values = Values(filter);
        var entities = new List<BosEntity>();
        using var cmd = Connection.CreateCommand();
        cmd.CommandText = $"""
            SELECT t.EntityIndex, coalesce(t.GlobalId, ''), coalesce(t.Name, ''), t.Category, e.Type >= 0
            FROM EntityText t JOIN Entities e ON e.rowid = t.EntityIndex
            WHERE {filter}
            ORDER BY t.EntityIndex
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var index = Convert.ToInt64(reader.GetValue(0));
            entities.Add(new(index, reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4),
                values.TryGetValue(index, out var list) ? list : []));
        }

        return entities;
    }

    private Dictionary<long, List<BosValue>> Values(string filter)
    {
        var dataType = HasDataTypes ? "d.DataType" : "NULL";
        var join = HasDataTypes
            ? $"LEFT JOIN {IfcDataTypes.TableName} d ON d.StepId = t.StepId AND d.ParameterGroup = p.ParameterGroup AND d.Name = p.Name"
            : "";
        var values = new Dictionary<long, List<BosValue>>();
        using var cmd = Connection.CreateCommand();
        cmd.CommandText = $"""
            SELECT p.EntityIndex, coalesce(p.ParameterGroup, ''), coalesce(p.Name, ''), coalesce(p.ValueType, ''), coalesce(p.Value, ''), {dataType}
            FROM ParameterText p JOIN EntityText t ON t.EntityIndex = p.EntityIndex
            {join}
            WHERE {filter}
            """;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            var index = Convert.ToInt64(reader.GetValue(0));
            if (!values.TryGetValue(index, out var list))
                values[index] = list = [];
            list.Add(new(reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5)));
        }

        return values;
    }

    private static string Quote(string text)
        => $"'{text.Replace("'", "''")}'";
}

internal static class DuckDbReading
{
    public static IReadOnlyList<string> Strings(this DuckDBConnection conn, string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        using var reader = cmd.ExecuteReader();
        var result = new List<string>();
        while (reader.Read())
            if (!reader.IsDBNull(0))
                result.Add(Convert.ToString(reader.GetValue(0), System.Globalization.CultureInfo.InvariantCulture) ?? "");
        return result;
    }
}
