namespace Ara3D.BimOpenSchema.DataModel;

internal static class ModelValidation
{
    internal static void Validate(ModelTables tables)
    {
        ArgumentNullException.ThrowIfNull(tables);
        ArgumentNullException.ThrowIfNull(tables.Metadata);
        Require(tables.Metadata.SchemaVersion == "1.0", "Unsupported data model schema version.");
        Require(!string.IsNullOrWhiteSpace(tables.Metadata.SourceId), "Source ID is required.");
        Require(!tables.Documents.IsDefault && !tables.Entities.IsDefault && !tables.Descriptors.IsDefault &&
            !tables.Properties.IsDefault && !tables.Edges.IsDefault && !tables.Instances.IsDefault &&
            !tables.Geometry.IsDefault && !tables.Issues.IsDefault, "All tables must be present.");
        var count = tables.Entities.Length;
        bool Entity(int id) => id >= 0 && id < count;
        bool Optional(int? id, int length) => id is null || id >= 0 && id < length;
        for (var i = 0; i < tables.Documents.Length; i++) Require(tables.Documents[i]?.Id == i, "Document IDs must equal row indices.");
        for (var i = 0; i < count; i++)
        {
            var e = tables.Entities[i];
            Require(e is not null && e.Id == i && !string.IsNullOrWhiteSpace(e.Key) && Optional(e.DocumentId, tables.Documents.Length) &&
                Optional(e.TypeId, count) && Optional(e.CategoryId, count), "Invalid entity identity or reference.");
        }
        Require(tables.Entities.Select(e => e.Key).Distinct().Count() == count, "Entity keys must be unique.");
        for (var i = 0; i < tables.Descriptors.Length; i++) Require(tables.Descriptors[i]?.Id == i, "Descriptor IDs must equal row indices.");
        var propertyIds = new HashSet<int>();
        foreach (var p in tables.Properties)
        {
            Require(p is not null && p.Id >= 0 && propertyIds.Add(p.Id) && Entity(p.EntityId) &&
                p.DescriptorId >= 0 && p.DescriptorId < tables.Descriptors.Length && Optional(p.ReferenceEntityId, count) &&
                (p.NumberValue is null || double.IsFinite(p.NumberValue.Value)) &&
                (p.CanonicalNumber is null || double.IsFinite(p.CanonicalNumber.Value)) &&
                (p.PointValue is null || p.PointValue.Value.IsFinite), "Invalid property value or reference.");
            Require(p!.Key == tables.Descriptors[p.DescriptorId].Key && ValidPayload(p), "Property key or typed payload contradicts its descriptor.");
        }
        var edgeIds = new HashSet<int>();
        foreach (var e in tables.Edges)
            Require(e is not null && e.Id >= 0 && edgeIds.Add(e.Id) && Entity(e.SourceId) && Entity(e.TargetId), "Invalid edge identity or reference.");
        var instanceIds = new HashSet<int>();
        foreach (var instance in tables.Instances)
            Require(instance is not null && instanceIds.Add(instance.Id) && Entity(instance.EntityId) && instance.Bounds.IsValid,
                "Invalid instance identity, bounds or reference.");
        var geometryIds = new HashSet<int>();
        foreach (var geometry in tables.Geometry)
            Require(geometry is not null && geometryIds.Add(geometry.EntityId) && Entity(geometry.EntityId) && geometry.Bounds.IsValid &&
                double.IsFinite(geometry.Bounds.Volume) && geometry.InstanceCount > 0 && geometry.TriangleCount >= 0 &&
                geometry.HiddenInstanceCount >= 0 && geometry.HiddenInstanceCount <= geometry.InstanceCount,
                "Invalid geometry bounds or reference.");
        for (var i = 0; i < tables.Issues.Length; i++)
            Require(tables.Issues[i] is { } issue && issue.Id == i && Optional(issue.EntityId, count), "Invalid issue identity or reference.");
    }

    private static bool ValidPayload(PropertyRow p)
    {
        var populated = (p.IntegerValue.HasValue ? 1 : 0) + (p.NumberValue.HasValue ? 1 : 0) +
            (p.TextValue is not null ? 1 : 0) + (p.ReferenceEntityId.HasValue ? 1 : 0) + (p.PointValue.HasValue ? 1 : 0);
        if (p.IsMissing || !p.IsValid) return populated == 0 && !(p.IsMissing && !p.IsValid);
        return populated == 1 && (p.Key.Kind switch
        {
            ParameterType.Int => p.IntegerValue.HasValue, ParameterType.Number => p.NumberValue.HasValue,
            ParameterType.String => p.TextValue is not null, ParameterType.Entity => p.ReferenceEntityId.HasValue,
            ParameterType.Point => p.PointValue.HasValue, _ => false
        });
    }

    private static void Require(bool valid, string message)
    {
        if (!valid) throw new ArgumentException(message);
    }
}
