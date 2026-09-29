using System.Globalization;
using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;

namespace Ara3D.BimOpenSchema.Federation.Tests;

/// <summary>Builds a correspondence Parquet from the plan's "Worked example" for the match
/// graph's storey rule (FederationExample's 12 storey rows) and checks FederationStore's studio
/// database against it, without running the match graph itself.</summary>
[TestFixture]
public sealed class FederationStoreTests
{
    private FilePath _unionDatabase;
    private BimData _union = null!;

    [OneTimeSetUp]
    public void BuildUnion()
    {
        _union = FederationExample.Union();
        _unionDatabase = TempPath(".duckdb");
        BosUnion.WriteDuckDb(_union, _unionDatabase);
    }

    [OneTimeTearDown]
    public void DeleteUnion()
        => File.Delete(_unionDatabase);

    [Test]
    public void FederatedStorey_MergesRowsAndTracksTheStructL1LowConfirmation()
    {
        var correspondence = TempPath(".parquet");
        var output = TempPath(".duckdb");
        try
        {
            var baseline = WorkedExampleRows(_union);
            WriteCorrespondenceParquet(correspondence, baseline);
            FederationStore.Build(null, _unionDatabase, correspondence, [], output);
            using (var conn = BosDuckDb.Open(output))
                Assert.That(conn.ScalarInt64($"SELECT count(*) FROM {FederationStore.Schema}.FederatedStorey"),
                    Is.EqualTo(9));

            WriteCorrespondenceParquet(correspondence, WithConfirmedStructL1Low(baseline));
            FederationStore.Build(null, _unionDatabase, correspondence, [], output);
            using (var conn = BosDuckDb.Open(output))
            {
                Assert.That(conn.ScalarInt64($"SELECT count(*) FROM {FederationStore.Schema}.FederatedStorey"),
                    Is.EqualTo(8));
                Assert.That(conn.ScalarInt64(
                        $"SELECT documents FROM {FederationStore.Schema}.FederatedStorey WHERE federated_storey_key = 'storey/0mm'"),
                    Is.EqualTo(2));
            }
        }
        finally
        {
            File.Delete(correspondence);
            File.Delete(output);
        }
    }

    [Test]
    public void FederatedStoreyOfEntity_MapsTheArchDoorAndTheElecLightFixture()
    {
        var correspondence = TempPath(".parquet");
        var output = TempPath(".duckdb");
        try
        {
            WriteCorrespondenceParquet(correspondence, WorkedExampleRows(_union));
            FederationStore.Build(null, _unionDatabase, correspondence, [], output);

            using var conn = BosDuckDb.Open(output);
            var door = conn.Query(
                $"SELECT federated_storey_key FROM {FederationStore.Schema}.FederatedStoreyOfEntity WHERE category = 'IFCDOOR'");
            Assert.That(door.Rows.Count, Is.EqualTo(1));
            Assert.That(door.Rows[0][0], Is.EqualTo("storey/0mm"));

            var light = conn.Query(
                $"SELECT federated_storey_key, federated_storey_status FROM {FederationStore.Schema}.FederatedStoreyOfEntity WHERE category = 'IFCLIGHTFIXTURE'");
            Assert.That(light.Rows.Count, Is.EqualTo(1));
            Assert.That(light.Rows[0][0], Is.EqualTo("storey/0mm#Elec"));
            Assert.That(light.Rows[0][1], Is.EqualTo("Conflict"));
        }
        finally
        {
            File.Delete(correspondence);
            File.Delete(output);
        }
    }

    [Test]
    public void Build_OverATypedDatabase_LeavesItsMainTablesUnchanged()
    {
        var typed = TempPath(".duckdb");
        var correspondence = TempPath(".parquet");
        var output = TempPath(".duckdb");
        try
        {
            using (var conn = BosDuckDb.Open(typed))
                conn.Execute("CREATE TABLE storey AS SELECT * FROM (VALUES (1, 'Level 1'), (2, 'Level 2')) AS t(id, name)");

            WriteCorrespondenceParquet(correspondence, WorkedExampleRows(_union));
            FederationStore.Build(typed, _unionDatabase, correspondence, [], output);

            using var result = BosDuckDb.Open(output);
            Assert.That(result.GetTableNames(), Does.Contain("storey"));
            var rows = result.Query("SELECT id, name FROM storey ORDER BY id");
            Assert.That(rows.Rows.Count, Is.EqualTo(2));
            Assert.That(rows.Rows[0][1], Is.EqualTo("Level 1"));
            Assert.That(rows.Rows[1][1], Is.EqualTo("Level 2"));
        }
        finally
        {
            File.Delete(typed);
            File.Delete(correspondence);
            File.Delete(output);
        }
    }

    private sealed record StoreyRow(string Document, string Name, int EntityIndex, double? ElevationM,
        string CanonicalKey, string CanonicalName, string Status, string[] Conflicts, string[] Warnings);

    /// <summary>The plan's worked example for the storey rule: 12 storey correspondence rows over
    /// FederationExample, reproduced column by column from "docs/plans/snowdon-federation-build.md".</summary>
    private static IReadOnlyList<StoreyRow> WorkedExampleRows(BimData union)
    {
        double Feet(double v) => v * 0.3048;
        return new[]
        {
            new StoreyRow("Arch", "Parking", FindStorey(union, "Arch", "Parking"), Feet(-16.9167),
                "storey/-5156mm", "Parking", "Candidate", [], []),
            new StoreyRow("Struct", "Parking", FindStorey(union, "Struct", "Parking"), Feet(-16.9167),
                "storey/-5156mm", "Parking", "Candidate", [], []),
            new StoreyRow("Arch", "L1", FindStorey(union, "Arch", "L1"), Feet(0.0),
                "storey/0mm", "L1", "Candidate", [], []),
            new StoreyRow("Struct", "L1_Low", FindStorey(union, "Struct", "L1_Low"), Feet(0.0),
                "storey/0mm", "L1", "Candidate", ["name-differs"], []),
            new StoreyRow("Elec", "L1", FindStorey(union, "Elec", "L1"), Feet(-0.0417),
                "storey/0mm", "L1", "Candidate", ["elevation-offset"], []),
            new StoreyRow("Arch", "L2", FindStorey(union, "Arch", "L2"), Feet(8.0833),
                "storey/2464mm", "L2", "Candidate", [], []),
            new StoreyRow("Struct", "L2", FindStorey(union, "Struct", "L2"), Feet(8.0833),
                "storey/2464mm", "L2", "Candidate", [], []),
            new StoreyRow("Elec", "L2", FindStorey(union, "Elec", "L2"), Feet(8.0833),
                "storey/2464mm", "L2", "Candidate", [], ["global-id-in-other-cluster"]),
            new StoreyRow("Site", "Datum", FindStorey(union, "Site", "Datum"), -241.4016,
                "storey/-241402mm", "Datum", "Unmatched", [], ["global-id-in-other-cluster"]),
            new StoreyRow("Site", "Parapet", FindStorey(union, "Site", "Parapet"), 14.4536,
                "storey/14454mm", "Parapet", "Unmatched", ["name-in-other-cluster"], []),
            new StoreyRow("Arch", "Parapet", FindStorey(union, "Arch", "Parapet"), Feet(47.67),
                "storey/14530mm", "Parapet", "Unmatched", ["name-in-other-cluster"], []),
            new StoreyRow("Plumb", "P-L1", FindStorey(union, "Plumb", "P-L1"), null,
                "storey/unknown/Plumb/1", "P-L1", "Unmatched", ["length-unit-unknown"], []),
        };
    }

    private static IReadOnlyList<StoreyRow> WithConfirmedStructL1Low(IReadOnlyList<StoreyRow> rows)
        => rows.Select(r => r.Document == "Struct" && r.Name == "L1_Low" ? r with { Status = "Confirmed" } : r).ToList();

    private static int FindStorey(BimData union, string document, string name)
    {
        var documentIndex = FindDocumentIndex(union, document);
        for (var i = 0; i < union.Entities.Length; i++)
        {
            var entity = union.Entities[i];
            if ((int)entity.Document != documentIndex || union.Strings[(int)entity.Name] != name)
                continue;
            var category = union.Entities[(int)entity.Category];
            if (union.Strings[(int)category.Name] == "IFCBUILDINGSTOREY")
                return i;
        }
        throw new InvalidOperationException($"No storey named '{name}' in document '{document}'.");
    }

    private static int FindDocumentIndex(BimData union, string title)
    {
        for (var d = 0; d < union.Documents.Length; d++)
            if (union.Strings[(int)union.Documents[d].Title] == title)
                return d;
        throw new InvalidOperationException($"No document named '{title}'.");
    }

    /// <summary>Writes the correspondence schema with the contract's column names and types
    /// (docs/plans/snowdon-federation-build.md, "Correspondence table"), filled in for the
    /// storey rows given.</summary>
    private static void WriteCorrespondenceParquet(FilePath path, IReadOnlyList<StoreyRow> rows)
    {
        using var conn = BosDuckDb.OpenInMemory();
        conn.Execute("""
            CREATE TABLE correspondence (
                concept VARCHAR, rule VARCHAR, rule_version INTEGER, rule_parameters VARCHAR,
                source_document VARCHAR, source_entity_index BIGINT, source_local_id BIGINT,
                source_global_id VARCHAR, source_name VARCHAR, canonical_key VARCHAR, canonical_name VARCHAR,
                target_entity_index BIGINT, rule_status VARCHAR, status VARCHAR,
                conflicts VARCHAR[], warnings VARCHAR[],
                elevation_source DOUBLE, length_unit VARCHAR, elevation_m DOUBLE, elevation_delta_mm DOUBLE,
                name_agrees BOOLEAN, global_id_shared BOOLEAN, cluster_documents INTEGER, axis_copies INTEGER,
                claimed_room_number VARCHAR, room_name_agrees BOOLEAN,
                decided_by VARCHAR, decided_at VARCHAR, decision_note VARCHAR
            )
            """);
        foreach (var row in rows)
            conn.Execute($"""
                INSERT INTO correspondence
                    (concept, rule, rule_version, rule_parameters, source_document, source_entity_index,
                     source_name, canonical_key, canonical_name, rule_status, status, conflicts, warnings,
                     elevation_m)
                VALUES ('storey', 'storey-by-elevation', 1,
                    'tolerance=0.05 ft (0.01524 m); offset-threshold=0.5 mm',
                    {row.Document.Literal()}, {row.EntityIndex}, {row.Name.Literal()},
                    {row.CanonicalKey.Literal()}, {row.CanonicalName.Literal()},
                    {row.Status.Literal()}, {row.Status.Literal()},
                    {ArrayLiteral(row.Conflicts)}, {ArrayLiteral(row.Warnings)},
                    {ElevationLiteral(row.ElevationM)})
                """);
        conn.Export("SELECT * FROM correspondence", path);
    }

    private static string ArrayLiteral(IReadOnlyList<string> items)
        => items.Count == 0
            ? "CAST([] AS VARCHAR[])"
            : "[" + string.Join(", ", items.Select(i => i.Literal())) + "]";

    private static string ElevationLiteral(double? value)
        => value.HasValue ? value.Value.ToString("R", CultureInfo.InvariantCulture) : "NULL";

    private static FilePath TempPath(string extension)
        => new(Path.Combine(Path.GetTempPath(), $"federation-store-{Guid.NewGuid():N}{extension}"));
}
