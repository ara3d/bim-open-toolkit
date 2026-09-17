using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Referential and coverage checks at the projection boundary for every table; it does not establish source completeness.</summary>
public static class ProjectionValidation
{
    public static ImmutableArray<MappingDiagnostic> Validate(BuildingProjection projection)
    {
        var findings = ImmutableArray.CreateBuilder<MappingDiagnostic>();
        void Check(bool valid, string code, string subject, string field, string message)
        { if (!valid) findings.Add(new(code, subject, field, message)); }

        var keys = ProjectionTables.All.ToDictionary(t => t.RecordType, t => t.Rows(projection).Select(t.Key).ToHashSet(StringComparer.Ordinal));
        var documents = keys[typeof(SourceDocument)];
        var policies = keys[typeof(InterpretationPolicy)];
        var revisions = keys[typeof(SourceRevision)];
        foreach (var table in ProjectionTables.All)
        {
            var rows = table.Rows(projection);
            Check(keys[table.RecordType].Count == rows.Count, "validation.duplicate-" + table.RecordType.Name.ToLowerInvariant(), table.Name, "Id", $"{table.Name} keys are duplicated.");
            foreach (var row in rows)
            {
                var subject = table.Name + "/" + table.Key(row);
                Check(table.Snapshot(row) is not { } snapshot || snapshot == projection.Snapshot.Id, "validation.snapshot", subject, "Id", "Domain row uses another snapshot.");
                foreach (var reference in RowReferences.Of(row))
                    Check((reference.Snapshot is null || reference.Snapshot == projection.Snapshot.Id)
                        && keys.TryGetValue(reference.Target, out var targets) && targets.Contains(reference.Key),
                        "validation.reference", subject, reference.Target.Name, $"{reference.Target.Name} reference {reference.Key} does not resolve in this snapshot.");
            }
        }
        foreach (var (table, row) in ProjectionTables.ElementRows(projection))
            Check(keys[typeof(BimObject)].Contains(row.Element.ObjectId.Value), "validation.object", table.Name + "/" + row.Key, "ObjectId", "Domain identity does not resolve.");
        foreach (var p in projection.Snapshot.Policies) Check(policies.Contains(p.Value), "validation.policy", projection.Snapshot.Id.Value, "Policies", "Interpretation policy does not resolve.");
        foreach (var r in projection.Snapshot.Sources) Check(revisions.Contains(r.Value), "validation.revision", projection.Snapshot.Id.Value, "Sources", "Snapshot revision does not resolve.");
        foreach (var r in projection.SourceRevisions) Check(documents.Contains(r.DocumentId.Value), "validation.document", r.Id.Value, "DocumentId", "Authoring document does not resolve.");
        foreach (var c in projection.Coverage)
            Check(c.Total == c.Known + c.Missing + c.Invalid + c.Conflicting + c.Inapplicable && c.Total >= 0,
                "validation.coverage", c.EntityKind, c.Field, "Coverage partition does not equal its full denominator.");
        return findings.ToImmutable();
    }
}
