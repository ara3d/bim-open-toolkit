using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace BimOpenMcp.Ifc;

/// <summary>The MetricCatalog table: the analytics metric dictionary a model names in its
/// provenance set, so an agent can resolve a metric to its property set, property, unit, and
/// rollup rule without guessing from names. The dictionary is a CSV (for the NRC sample,
/// samples/nrc/nrc-metrics.csv) located by <c>Pset_NRCAnalyticsProvenance.MetricDictionaryURI</c>,
/// resolved against the IFC file's folder when relative. A model that names none, or names a
/// file that is not there, gets an empty table with the dictionary's columns, so a query on
/// MetricCatalog never fails for want of the table.</summary>
public static class IfcMetricCatalog
{
    public const string Table = "MetricCatalog";
    public const string ProvenanceSet = "Pset_NRCAnalyticsProvenance";
    public const string UriProperty = "MetricDictionaryURI";

    /// <summary>The columns of the empty table, in the dictionary's order.</summary>
    public const string EmptyColumns =
        "MetricId VARCHAR, Level VARCHAR, PropertySet VARCHAR, PropertyName VARCHAR, ValueType VARCHAR, "
        + "Unit VARCHAR, LifecycleStage VARCHAR, Rollup VARCHAR, Description VARCHAR, Decimals BIGINT";

    /// <summary>Creates MetricCatalog in the database built from <paramref name="ifc"/> and returns
    /// the dictionary it was read from, or null when it is empty.</summary>
    public static FilePath? Create(FilePath database, FilePath ifc)
    {
        using var conn = BosDuckDb.Open(database);
        var dictionary = Locate(conn, ifc);
        conn.Execute(dictionary is { } file
            ? $"CREATE OR REPLACE TABLE {Table} AS SELECT * FROM read_csv('{file.FullPath.Replace('\\', '/').Replace("'", "''")}')"
            : $"CREATE OR REPLACE TABLE {Table} ({EmptyColumns})");
        return dictionary;
    }

    /// <summary>The existing file the model's MetricDictionaryURI names, or null.</summary>
    private static FilePath? Locate(DuckDBConnection conn, FilePath ifc)
        => Uri(conn) is { } uri
           && Path.Combine(Path.GetDirectoryName(ifc.FullPath) ?? "", uri) is var path
           && File.Exists(path)
            ? new FilePath(Path.GetFullPath(path))
            : default(FilePath?);

    private static string? Uri(DuckDBConnection conn)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT Value FROM ParameterText WHERE ParameterGroup = '{ProvenanceSet}' "
                          + $"AND Name = '{UriProperty}' AND Value <> '' ORDER BY EntityIndex LIMIT 1";
        return cmd.ExecuteScalar() as string;
    }
}
