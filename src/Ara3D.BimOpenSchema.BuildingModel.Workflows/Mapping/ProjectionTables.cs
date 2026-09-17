using System.Collections.Immutable;
using System.Reflection;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Snapshot-scoped identity and shared element data of one row in an element table.</summary>
public readonly record struct ElementRow(ReferenceKey<ModelSnapshot> Snapshot, string Key, ElementInfo Element);

/// <summary>One typed table of the projection: the core record it holds and how to read its rows without per-table code.
/// Snapshot is null for tables keyed by a global ReferenceKey.</summary>
public sealed record ProjectionTable(string Name, Type RecordType, Func<BuildingProjection, bool> IsPresent,
    Func<BuildingProjection, IReadOnlyList<object>> Rows, Func<object, string> Key,
    Func<object, ReferenceKey<ModelSnapshot>?> Snapshot, Func<object, ElementRow>? Element)
{
    public bool IsElement => Element is not null;
}

/// <summary>Reflects the projection's typed tables once, so writers and validators cover every core record automatically.
/// Impure only because it reflects; it holds no mutable state after type initialization.</summary>
[Platonic.Impure]
public static class ProjectionTables
{
    public static ImmutableArray<ProjectionTable> All { get; } = Discover();
    private static readonly ImmutableDictionary<Type, ProjectionTable> byType = All.ToImmutableDictionary(t => t.RecordType);

    /// <summary>True for a core record whose Id is a ReferenceKey or SnapshotKey of its own type.</summary>
    public static bool IsCoreRecord(Type type)
        => type.GetProperty("Id", BindingFlags.Instance | BindingFlags.Public)?.PropertyType is { IsGenericType: true } id
            && (id.GetGenericTypeDefinition() == typeof(ReferenceKey<>) || id.GetGenericTypeDefinition() == typeof(SnapshotKey<>))
            && id.GetGenericArguments()[0] == type;

    public static bool HasTable(Type recordType) => byType.ContainsKey(recordType);

    public static ProjectionTable Table(Type recordType)
        => byType.TryGetValue(recordType, out var table) ? table
            : throw new ArgumentException($"{recordType.Name} is not a projection table.", nameof(recordType));

    public static IReadOnlyList<object> Rows(BuildingProjection projection, Type recordType) => Table(recordType).Rows(projection);

    public static IEnumerable<(ProjectionTable Table, ElementRow Row)> ElementRows(BuildingProjection projection)
        => All.Where(t => t.IsElement).SelectMany(t => t.Rows(projection).Select(r => (t, t.Element!(r))));

    private static ImmutableArray<ProjectionTable> Discover()
        => typeof(BuildingProjection).GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Where(p => RowReferences.IsGeneric(p.PropertyType, typeof(ImmutableArray<>)) && IsCoreRecord(p.PropertyType.GetGenericArguments()[0]))
            .Select(p => Table(p, p.PropertyType.GetGenericArguments()[0]))
            .ToImmutableArray();

    private static ProjectionTable Table(PropertyInfo property, Type record)
    {
        var id = record.GetProperty("Id", BindingFlags.Instance | BindingFlags.Public)!;
        var snapshotScoped = RowReferences.IsGeneric(id.PropertyType, typeof(SnapshotKey<>));
        var key = RowReferences.KeyReader(id.PropertyType);
        return new(property.Name, record, IsPresent(property), Reader(property),
            row => key(id.GetValue(row)!).Key,
            row => snapshotScoped ? key(id.GetValue(row)!).Snapshot : null,
            ElementReader(record, id, snapshotScoped));
    }

    private static Func<BuildingProjection, bool> IsPresent(PropertyInfo property)
    {
        var isDefault = property.PropertyType.GetProperty(nameof(ImmutableArray<object>.IsDefault))!;
        return projection => property.GetValue(projection) is { } value && !(bool)isDefault.GetValue(value)!;
    }

    private static Func<BuildingProjection, IReadOnlyList<object>> Reader(PropertyInfo property)
    {
        var present = IsPresent(property);
        return projection => present(projection) ? (IReadOnlyList<object>)property.GetValue(projection)! : [];
    }

    private static Func<object, ElementRow>? ElementReader(Type record, PropertyInfo id, bool snapshotScoped)
    {
        var element = record.GetProperty("Element", BindingFlags.Instance | BindingFlags.Public);
        if (element?.PropertyType != typeof(ElementInfo) || !snapshotScoped) return null;
        var key = RowReferences.KeyReader(id.PropertyType);
        return row => { var (snapshot, local) = key(id.GetValue(row)!); return new(snapshot!.Value, local, (ElementInfo)element.GetValue(row)!); };
    }
}
