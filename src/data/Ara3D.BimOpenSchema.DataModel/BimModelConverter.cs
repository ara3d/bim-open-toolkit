using System.Collections.Immutable;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel;

public static class BimModelConverter
{
    /// <summary>Creates a detached snapshot. Tolerant mode retains valid rows and diagnostics; strict mode rejects errors.</summary>
    public static Result<BimModel, ImmutableArray<IssueRow>> Convert(IBimData data, ConversionOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(data);
        options ??= new();
        ArgumentException.ThrowIfNullOrWhiteSpace(options.SourceId);
        if (data.Entities is null || data.Documents is null || data.Descriptors is null || data.Parameters is null ||
            data.Strings is null || data.Numbers is null || data.Points is null || data.Relations is null || data.Diagnostics is null)
            return Result<BimModel, ImmutableArray<IssueRow>>.Error([new(0, IssueSeverity.Error, "MissingTable", "Input", -1, null,
                "BOS arrays must be present; use empty arrays for missing tables.")]);
        var issues = new List<IssueRow>();
        var documents = Documents(data, issues);
        var entities = Entities(data, documents, options.SourceId, issues);
        var descriptors = SourceDecoder.Descriptors(data, issues);
        var properties = Properties(data, descriptors, options, issues);
        var edges = Edges(data, entities, properties, issues);
        var geometry = GeometryConversion.Convert(options.IncludeGeometry ? data.Geometry : null, entities.Length);
        foreach (var issue in geometry.Issues) issues.Add(issue with { Id = issues.Count });
        Diagnostics(data, issues);
        var tables = new ModelTables(new("1.0", options.SourceId, data.Manifest?.BimOpenSchemaVersion ?? "unknown",
            data.Manifest?.GeneratorApplication, NumericValuePolicy: options.NumericValuesUseDeclaredUnits
                ? "DeclaredUnitsExplicitlyConfirmed" : "PreserveStoredValues"), documents, entities, descriptors, properties, edges,
            geometry.Instances, geometry.Geometry, issues.ToImmutableArray());
        return options.Strict && issues.Exists(x => x.Severity == IssueSeverity.Error)
            ? Result<BimModel, ImmutableArray<IssueRow>>.Error(tables.Issues)
            : Result<BimModel, ImmutableArray<IssueRow>>.Ok(BimModel.Create(tables));
    }

    private static ImmutableArray<DocumentRow> Documents(IBimData data, List<IssueRow> issues)
    {
        var rows = ImmutableArray.CreateBuilder<DocumentRow>(data.Documents.Length);
        for (var i = 0; i < data.Documents.Length; i++)
        {
            var d = data.Documents[i];
            rows.Add(new(i, SourceDecoder.Text(data, (int)d.Title, "Documents", i, issues),
                SourceDecoder.Text(data, (int)d.Path, "Documents", i, issues)));
        }
        return rows.MoveToImmutable();
    }

    private static ImmutableArray<EntityRow> Entities(IBimData data, ImmutableArray<DocumentRow> documents,
        string sourceId, List<IssueRow> issues)
    {
        var rows = ImmutableArray.CreateBuilder<EntityRow>(data.Entities.Length);
        var types = new HashSet<int>();
        var categories = new HashSet<int>();
        var identities = new HashSet<(int?, long)>();
        foreach (var entity in data.Entities)
        {
            types.Add((int)entity.Type);
            categories.Add((int)entity.Category);
        }
        var names = new string?[data.Entities.Length];
        for (var i = 0; i < names.Length; i++) names[i] = SourceDecoder.Text(data, (int)data.Entities[i].Name, "Entities", i, issues);
        for (var i = 0; i < data.Entities.Length; i++)
        {
            var e = data.Entities[i];
            var document = SourceDecoder.Reference((int)e.Document, documents.Length, "Entities", i, issues);
            var category = SourceDecoder.Reference((int)e.Category, names.Length, "Entities", i, issues);
            var type = SourceDecoder.Reference((int)e.Type, names.Length, "Entities", i, issues);
            if (!identities.Add((document, e.LocalId)))
                SourceDecoder.AddIssue(issues, "DuplicateLocalIdentity", "Entities", i, i,
                    "Document and local ID are duplicated; snapshot row keys remain unique.", IssueSeverity.Warning);
            rows.Add(new(i, $"{Uri.EscapeDataString(sourceId)}/entity/{i}", e.LocalId,
                SourceDecoder.Text(data, (int)e.GlobalId, "Entities", i, issues), document,
                document.HasValue ? documents[document.Value].Title : null, names[i], category,
                category.HasValue ? names[category.Value] : null, type, type.HasValue ? names[type.Value] : null,
                types.Contains(i), categories.Contains(i)));
        }
        return rows.MoveToImmutable();
    }

    private static ImmutableArray<PropertyRow> Properties(IBimData data, ImmutableArray<DescriptorRow> descriptors,
        ConversionOptions options, List<IssueRow> issues)
    {
        var rows = ImmutableArray.CreateBuilder<PropertyRow>();
        var keys = new HashSet<(int, PropertyKey)>();
        for (var i = 0; i < data.Parameters.Length; i++)
        {
            var p = data.Parameters[i];
            var entity = SourceDecoder.Reference((int)p.Entity, data.Entities.Length, "Parameters", i, issues, false);
            var descriptor = SourceDecoder.Reference((int)p.Descriptor, descriptors.Length, "Parameters", i, issues, false);
            if (!entity.HasValue || !descriptor.HasValue) continue;
            var row = SourceDecoder.Property(data, i, descriptors[descriptor.Value], options, issues);
            if (!keys.Add((row.EntityId, row.Key)))
                SourceDecoder.AddIssue(issues, "DuplicateProperty", "Parameters", i, row.EntityId,
                    "Multiple values share the normalized property key; all values are retained.", IssueSeverity.Warning);
            rows.Add(row);
        }
        return rows.ToImmutable();
    }

    private static ImmutableArray<EdgeRow> Edges(IBimData data, ImmutableArray<EntityRow> entities,
        ImmutableArray<PropertyRow> properties, List<IssueRow> issues)
    {
        var rows = ImmutableArray.CreateBuilder<EdgeRow>();
        var seen = new HashSet<(int, int, RelationType)>();
        for (var i = 0; i < data.Relations.Length; i++)
        {
            var r = data.Relations[i];
            var a = SourceDecoder.Reference((int)r.EntityA, entities.Length, "Relations", i, issues, false);
            var b = SourceDecoder.Reference((int)r.EntityB, entities.Length, "Relations", i, issues, false);
            if (!a.HasValue || !b.HasValue) continue;
            if (!Enum.IsDefined(r.RelationType))
                SourceDecoder.AddIssue(issues, "UnknownRelationType", "Relations", i, a, $"Unknown kind {(int)r.RelationType}.");
            if (!seen.Add((a.Value, b.Value, r.RelationType)))
                SourceDecoder.AddIssue(issues, "DuplicateRelation", "Relations", i, a,
                    "Duplicate edge retained for provenance; traversals visit nodes once.", IssueSeverity.Warning);
            rows.Add(new(rows.Count, a.Value, b.Value, r.RelationType.ToString(), EdgeOrigin.Relation, i));
        }
        foreach (var entity in entities)
        {
            if (entity.TypeId is { } type) rows.Add(new(rows.Count, entity.Id, type, "IsOfType", EdgeOrigin.Type, entity.Id));
            if (entity.CategoryId is { } category) rows.Add(new(rows.Count, entity.Id, category, "InCategory", EdgeOrigin.Category, entity.Id));
        }
        foreach (var property in properties)
            if (property.ReferenceEntityId is { } target)
                rows.Add(new(rows.Count, property.EntityId, target, "PropertyReference", EdgeOrigin.Property, property.Id));
        return rows.ToImmutable();
    }

    private static void Diagnostics(IBimData data, List<IssueRow> issues)
    {
        for (var i = 0; i < data.Diagnostics.Length; i++)
        {
            var d = data.Diagnostics[i];
            var entity = SourceDecoder.Reference((int)d.Entity, data.Entities.Length, "Diagnostics", i, issues);
            SourceDecoder.Reference((int)d.Document, data.Documents.Length, "Diagnostics", i, issues);
            var message = SourceDecoder.Text(data, (int)d.Message, "Diagnostics", i, issues) ?? "";
            SourceDecoder.AddIssue(issues, $"Source.{d.Type}", "Diagnostics", i, entity, message,
                d.Type is DiagnosticType.ExporterError or DiagnosticType.RevitError ? IssueSeverity.Error :
                d.Type == DiagnosticType.ExporterInfo ? IssueSeverity.Info : IssueSeverity.Warning);
        }
    }
}
