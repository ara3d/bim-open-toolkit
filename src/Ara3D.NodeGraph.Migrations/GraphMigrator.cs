using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Ara3D.NodeGraph.Migrations;

/// <summary>
/// Chains registered migrations to bring a graph document up to
/// GraphFormat.Version. Documents already current are returned unchanged;
/// migrated documents are re-serialized to canonical form.
/// </summary>
public sealed class GraphMigrator
{
    /// <summary>Production migrator: empty until the first breaking format change ships.</summary>
    public static readonly GraphMigrator Current = new(Array.Empty<IGraphMigration>());

    public IReadOnlyList<IGraphMigration> Migrations { get; }

    public GraphMigrator(IReadOnlyList<IGraphMigration> migrations)
        => Migrations = migrations;

    public string MigrateToCurrent(string documentJson)
    {
        var version = ReadFormatVersion(documentJson);
        if (version == GraphFormat.Version)
            return documentJson;
        if (ParseVersion(version) > ParseVersion(GraphFormat.Version))
            throw new FormatException(
                $"Document format version '{version}' is newer than the supported version '{GraphFormat.Version}'");

        var json = documentJson;
        for (var steps = 0; version != GraphFormat.Version; steps++)
        {
            if (steps >= Migrations.Count)
                throw new FormatException(
                    $"Migration chain from '{ReadFormatVersion(documentJson)}' does not reach '{GraphFormat.Version}'");
            var migration = FindFrom(version);
            json = migration.Migrate(json);
            version = migration.ToVersion;
        }
        return GraphDocumentIO.Parse(json).ToCanonicalJson();
    }

    private IGraphMigration FindFrom(string version)
        => Migrations.FirstOrDefault(m => m.FromVersion == version)
           ?? throw new FormatException(
               $"No migration registered from format version '{version}' toward '{GraphFormat.Version}'");

    private static string ReadFormatVersion(string documentJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(documentJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                throw new FormatException("Graph document must be a JSON object");
            if (!root.TryGetProperty("formatVersion", out var v))
                return GraphFormat.Version;
            return v.ValueKind == JsonValueKind.String
                ? v.GetString()!
                : throw new FormatException("formatVersion must be a string");
        }
        catch (JsonException e)
        {
            throw new FormatException($"Graph document is not valid JSON: {e.Message}", e);
        }
    }

    private static Version ParseVersion(string version)
    {
        try
        {
            return Version.Parse(version);
        }
        catch (Exception e) when (e is FormatException or ArgumentException or OverflowException)
        {
            throw new FormatException($"Invalid format version '{version}'", e);
        }
    }
}
