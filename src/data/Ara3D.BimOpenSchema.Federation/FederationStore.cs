using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.Federation;

/// <summary>Builds the studio database (C11's three federated graphs, and the nine typed graphs
/// read the copy of <c>typedDatabase</c> unchanged). It never recomputes federation logic itself:
/// <see cref="FederationViews"/> holds the one SQL definition of the merge rule and both views
/// that read it.</summary>
public static class FederationStore
{
    public const string Schema = "federation";

    private const string StoreyOfEntitySelect = """
        SELECT entity_index, storey_index, depth
        FROM (
            SELECT EntityIndex AS entity_index, StoreyIndex AS storey_index, Depth AS depth,
                   row_number() OVER (PARTITION BY EntityIndex ORDER BY Depth ASC, StoreyIndex ASC) AS rn
            FROM {0}
        )
        WHERE rn = 1
        """;

    /// <summary>Writes <paramref name="output"/>: a copy of <paramref name="typedDatabase"/> (or
    /// an empty database when null) plus schema "federation" holding source_entity,
    /// source_storey_of_entity, correspondence, provenance, and the three views.</summary>
    public static void Build(FilePath? typedDatabase, FilePath unionDatabase, FilePath correspondence,
        IReadOnlyList<KeyValuePair<string, string>> provenance, FilePath output)
    {
        var directory = Path.GetDirectoryName(output.FullPath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);
        if (File.Exists(output))
            File.Delete(output);
        if (typedDatabase != null)
            File.Copy(typedDatabase.Value, output);

        using var conn = BosDuckDb.Open(output);
        conn.Execute($"CREATE SCHEMA {Schema}");

        conn.Execute($"ATTACH {unionDatabase.FullPath.Replace('\\', '/').Literal()} AS u (READ_ONLY)");
        var detached = false;
        try
        {
            WriteSourceEntity(conn);
            detached = WriteSourceStoreyOfEntity(conn, unionDatabase);
        }
        finally
        {
            if (!detached)
                conn.Execute("DETACH u");
        }

        WriteCorrespondence(conn, correspondence);
        WriteProvenance(conn, provenance);

        conn.Execute(FederationViews.StoreyMembershipSql);
        conn.Execute(FederationViews.FederatedStoreySql);
        conn.Execute(FederationViews.FederatedStoreyOfEntitySql);
    }

    /// <summary>Every real union entity (StepId >= 0), with its document title, its GlobalId
    /// (empty for entities that carry none, such as grid axes), and its Other/Category ("Rooms",
    /// "Areas", "Spaces", ...) parameter when it has one. Filtering on StepId rather than GlobalId
    /// excludes only the type/category placeholder entities BimDataBuilder adds for
    /// Entities.Category (StepId -1) — those never carry a GlobalId and are not real BIM objects
    /// — while keeping every converted instance, matching what StoreyMembership and
    /// FederatedStoreyOfEntity need to see (doors, light fixtures, ... not only GlobalId-bearing
    /// rooms and storeys).</summary>
    private static void WriteSourceEntity(DuckDBConnection conn)
        => conn.Execute($"""
            CREATE TABLE {Schema}.source_entity AS
            SELECT e.rowid AS entity_index, ds.Strings AS document, et.StepId AS step_id,
                   et.GlobalId AS global_id, et.Name AS name, et.Category AS category,
                   rc.Value AS revit_category
            FROM u.Entities e
            JOIN u.EntityText et ON et.EntityIndex = e.rowid
            JOIN u.Documents d ON d.rowid = e.Document
            JOIN u.Strings ds ON ds.rowid = d.Title
            LEFT JOIN u.ParameterText rc
                ON rc.EntityIndex = e.rowid AND rc.ParameterGroup = 'Other' AND rc.Name = 'Category'
            WHERE et.StepId >= 0
            """);

    /// <summary>One row per entity, taken from u.StoreyOfEntity with the minimum depth then the
    /// minimum storey index. Some DuckDB versions cannot bind a recursive-CTE view's unqualified
    /// table references through an ATTACHed alias; when that query fails, the same rows are read
    /// over a second, direct connection to the union database and written in. Returns true when
    /// it took that fallback, which detaches "u" as part of it (a second, non-read-only
    /// connection to the same file cannot open while "u" still holds it).</summary>
    private static bool WriteSourceStoreyOfEntity(DuckDBConnection conn, FilePath unionDatabase)
    {
        try
        {
            conn.Execute($"CREATE TABLE {Schema}.source_storey_of_entity AS "
                + string.Format(StoreyOfEntitySelect, "u.StoreyOfEntity"));
            return false;
        }
        catch (Exception)
        {
            conn.Execute("DETACH u");
            using var direct = BosDuckDb.Open(unionDatabase);
            var rows = direct.Query(string.Format(StoreyOfEntitySelect, "StoreyOfEntity"), "source_storey_of_entity");
            const string staging = "_federation_source_storey_of_entity";
            conn.WriteTable(rows, staging);
            conn.Execute($"CREATE TABLE {Schema}.source_storey_of_entity AS SELECT * FROM {staging.Ident()}");
            conn.Execute($"DROP TABLE {staging.Ident()}");
            return true;
        }
    }

    private static void WriteCorrespondence(DuckDBConnection conn, FilePath correspondence)
        => conn.Execute($"CREATE TABLE {Schema}.correspondence AS "
            + $"SELECT * FROM read_parquet({correspondence.FullPath.Replace('\\', '/').Literal()})");

    private static void WriteProvenance(DuckDBConnection conn, IReadOnlyList<KeyValuePair<string, string>> provenance)
    {
        conn.Execute($"CREATE TABLE {Schema}.provenance (key VARCHAR, value VARCHAR)");
        foreach (var entry in provenance)
            conn.Execute($"INSERT INTO {Schema}.provenance VALUES ({entry.Key.Literal()}, {entry.Value.Literal()})");
    }
}
