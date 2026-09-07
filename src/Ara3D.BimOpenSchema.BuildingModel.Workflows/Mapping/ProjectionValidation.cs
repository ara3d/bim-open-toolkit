using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Referential and coverage checks at the projection boundary; it does not establish source completeness.</summary>
public static class ProjectionValidation
{
    public static ImmutableArray<MappingDiagnostic> Validate(BuildingProjection projection)
    {
        var findings = ImmutableArray.CreateBuilder<MappingDiagnostic>();
        var objects = projection.Objects.Select(o => o.Id).ToHashSet();
        var sources = projection.SourceObjects.Select(s => s.Id).ToHashSet();
        var evidence = projection.Evidence.Select(e => e.Id).ToHashSet();
        var revisions = projection.SourceRevisions.Select(r => r.Id).ToHashSet();
        var storeys = projection.Storeys.Select(s => s.Id).ToHashSet();
        var spaces = projection.Spaces.Select(s => s.Id).ToHashSet();
        var doors = projection.Doors.Select(s => s.Id).ToHashSet();
        var documents = projection.Documents.IsDefault ? [] : projection.Documents.Select(d => d.Id).ToHashSet();
        var policies = projection.Policies.IsDefault ? [] : projection.Policies.Select(d => d.Id).ToHashSet();
        void Check(bool valid, string code, string subject, string field, string message)
        { if (!valid) findings.Add(new(code, subject, field, message)); }
        void Element<T>(SnapshotKey<T> id, ElementInfo element)
        {
            Check(id.SnapshotId == projection.Snapshot.Id, "validation.snapshot", id.ToString(), "Id", "Domain row uses another snapshot.");
            Check(objects.Contains(element.ObjectId), "validation.object", id.ToString(), "ObjectId", "Domain identity does not resolve.");
            if (element.Location.PrimaryStorey is Fact<SnapshotKey<Storey>>.Known s)
                Check(storeys.Contains(s.Value), "validation.storey", id.ToString(), "PrimaryStorey", "Storey reference does not resolve in this snapshot.");
            foreach (var room in element.Location.Spaces.Items)
                Check(spaces.Contains(room), "validation.space", id.ToString(), "Spaces", "Space reference does not resolve in this snapshot.");
        }
        foreach (var s in projection.Storeys) { Element(s.Id, s.Element); foreach (var room in s.Spaces.Items) Check(spaces.Contains(room), "validation.space", s.Id.ToString(), "Spaces", "Storey space does not resolve."); }
        foreach (var s in projection.Spaces) { Element(s.Id, s.Element); foreach (var door in s.Doors.Items) Check(doors.Contains(door), "validation.door", s.Id.ToString(), "Doors", "Space door does not resolve."); }
        foreach (var d in projection.Doors) Element(d.Id, d.Element);
        foreach (var r in projection.Roofs) Element(r.Id, r.Element);
        foreach (var s in projection.SourceObjects) Check(revisions.Contains(s.SourceRevisionId), "validation.revision", s.Id.Value, "SourceRevisionId", "Source revision does not resolve.");
        foreach (var r in projection.SourceRevisions) Check(documents.Contains(r.DocumentId), "validation.document", r.Id.Value, "DocumentId", "Authoring document does not resolve.");
        foreach (var p in projection.Snapshot.Policies) Check(policies.Contains(p), "validation.policy", projection.Snapshot.Id.Value, "Policies", "Interpretation policy does not resolve.");
        foreach (var r in projection.Snapshot.Sources) Check(revisions.Contains(r), "validation.revision", projection.Snapshot.Id.Value, "Sources", "Snapshot revision does not resolve.");
        foreach (var o in projection.Objects)
        {
            foreach (var s in o.SourceIdentities) Check(sources.Contains(s), "validation.source", o.Id.Value, "SourceIdentities", "Source identity does not resolve.");
            foreach (var e in o.Evidence) Check(evidence.Contains(e), "validation.evidence", o.Id.Value, "Evidence", "Evidence does not resolve.");
        }
        foreach (var e in projection.Evidence)
        {
            foreach (var s in e.Sources) Check(sources.Contains(s), "validation.source", e.Id.Value, "Sources", "Evidence source does not resolve.");
            if (e.PolicyId is Fact<ReferenceKey<InterpretationPolicy>>.Known p)
                Check(policies.Contains(p.Value), "validation.policy", e.Id.Value, "PolicyId", "Evidence policy does not resolve.");
        }
        foreach (var c in projection.Coverage)
            Check(c.Total == c.Known + c.Missing + c.Invalid + c.Conflicting + c.Inapplicable && c.Total >= 0,
                "validation.coverage", c.EntityKind, c.Field, "Coverage partition does not equal its full denominator.");
        Check(objects.Count == projection.Objects.Length, "validation.duplicate-object", "Objects", "Id", "Object keys are duplicated.");
        Check(evidence.Count == projection.Evidence.Length, "validation.duplicate-evidence", "Evidence", "Id", "Evidence keys are duplicated.");
        return findings.ToImmutable();
    }
}
