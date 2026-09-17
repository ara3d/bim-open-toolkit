using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

public sealed record ModelMetadata(string SchemaVersion, string SourceId, string SourceSchemaVersion,
    string? Generator, string GeometryUnits = "m", string NumericValuePolicy = "PreserveStoredValues");

public sealed record DocumentRow(int Id, string? Title, string? Path);

public sealed record EntityRow(int Id, string Key, long LocalId, string? GlobalId, int? DocumentId,
    string? DocumentTitle, string? Name, int? CategoryId, string? Category, int? TypeId, string? Type,
    bool IsType, bool IsCategory);

/// <summary>Identity includes normalized name, group, units and value kind; same-name fields remain distinct.</summary>
public readonly record struct PropertyKey(string Name, string Group, string Units, ParameterType Kind);

public sealed record DescriptorRow(int Id, string? Name, string? Group, string? Units,
    ParameterType Kind, PropertyKey Key);

/// <summary>One typed value is populated for a valid, nonmissing row. Missing and invalid values remain distinct from zero.</summary>
public sealed record PropertyRow(int Id, int EntityId, int DescriptorId, string? Name, string? Group,
    string? Units, PropertyKey Key, bool IsValid, int RawValue, long? IntegerValue = null,
    double? NumberValue = null, string? TextValue = null, int? ReferenceEntityId = null,
    Point3? PointValue = null, double? CanonicalNumber = null, string? CanonicalUnits = null, bool IsMissing = false);

public enum EdgeOrigin { Relation, Type, Category, Property }
public sealed record EdgeRow(int Id, int SourceId, int TargetId, string Kind, EdgeOrigin Origin, int SourceRowId);

public enum IssueSeverity { Info, Warning, Error }
public sealed record IssueRow(int Id, IssueSeverity Severity, string Code, string Table,
    int SourceRowId, int? EntityId, string Message);

/// <summary>Bounds enclose transformed mesh vertices, not a solid; bounds volume is not material quantity.</summary>
public sealed record GeometryRow(int EntityId, Bounds3 Bounds, int InstanceCount, long TriangleCount,
    int HiddenInstanceCount);

public sealed record InstanceRow(int Id, int EntityId, int MeshId, int? MaterialId,
    bool IsHidden, Bounds3 Bounds, long TriangleCount);

public sealed record ModelTables(ModelMetadata Metadata, ImmutableArray<DocumentRow> Documents,
    ImmutableArray<EntityRow> Entities, ImmutableArray<DescriptorRow> Descriptors,
    ImmutableArray<PropertyRow> Properties, ImmutableArray<EdgeRow> Edges,
    ImmutableArray<InstanceRow> Instances, ImmutableArray<GeometryRow> Geometry,
    ImmutableArray<IssueRow> Issues);

public sealed record ConversionOptions(string SourceId = "model", bool Strict = false,
    bool IncludeGeometry = true, bool NumericValuesUseDeclaredUnits = false);
