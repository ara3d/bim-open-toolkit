using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Immutable;
using System.Reflection;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>One outgoing reference from a row: the table it points into and the key it names. Snapshot is null for global keys.</summary>
public readonly record struct RowReference(Type Target, ReferenceKey<ModelSnapshot>? Snapshot, string Key);

/// <summary>Walks a core row's SnapshotKey, ReferenceKey, Fact, LinkSet, key-array and nested composite properties once per
/// record type and reports every reference it makes, so validation needs no per-table code. Impure because it reflects and
/// caches the per-type readers.</summary>
[Platonic.Impure]
public static class RowReferences
{
    private static readonly ConcurrentDictionary<Type, ImmutableArray<Func<object, IEnumerable<RowReference>>>> readers = new();

    /// <summary>References a row makes, excluding its own Id.</summary>
    public static IEnumerable<RowReference> Of(object row)
        => Readers(row.GetType()).SelectMany(read => read(row));

    internal static Func<object, (ReferenceKey<ModelSnapshot>? Snapshot, string Key)> KeyReader(Type keyType)
    {
        var value = keyType.GetProperty(nameof(ReferenceKey<object>.Value))!;
        var snapshot = keyType.GetProperty(nameof(SnapshotKey<object>.SnapshotId));
        return key => (snapshot is null ? null : (ReferenceKey<ModelSnapshot>)snapshot.GetValue(key)!, (string)value.GetValue(key)!);
    }

    internal static bool IsGeneric(Type type, Type definition) => type.IsGenericType && type.GetGenericTypeDefinition() == definition;

    private static bool IsKey(Type type) => IsGeneric(type, typeof(ReferenceKey<>)) || IsGeneric(type, typeof(SnapshotKey<>));

    // A domain record that is neither a table row nor a key, such as ElementInfo or SpatialContext.
    private static bool IsComposite(Type type)
        => type.IsClass && type != typeof(string) && type.Assembly == typeof(BimObject).Assembly && !ProjectionTables.IsCoreRecord(type);

    // A table row's own Id is its identity, not a reference; composites such as ElementInfo have no Id.
    private static ImmutableArray<Func<object, IEnumerable<RowReference>>> Readers(Type type)
        => readers.GetOrAdd(type, t => t.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .Where(p => p.Name != "Id" || !ProjectionTables.IsCoreRecord(t))
            .Select(Reader).Where(r => r is not null).Select(r => r!).ToImmutableArray());

    private static Func<object, IEnumerable<RowReference>>? Reader(PropertyInfo property)
    {
        var read = ValueReader(property.PropertyType);
        return read is null ? null : row => property.GetValue(row) is { } value ? read(value) : [];
    }

    private static Func<object, IEnumerable<RowReference>>? ValueReader(Type type)
    {
        if (IsKey(type))
        {
            var (target, key) = (type.GetGenericArguments()[0], KeyReader(type));
            return value => [Reference(target, key(value))];
        }
        if (IsGeneric(type, typeof(Fact<>)))
        {
            var inner = ValueReader(type.GetGenericArguments()[0]);
            if (inner is null) return null;
            var known = typeof(Fact<>.Known).MakeGenericType(type.GetGenericArguments()[0]);
            var value = known.GetProperty(nameof(Fact<object>.Known.Value))!;
            return fact => known.IsInstanceOfType(fact) ? inner(value.GetValue(fact)!) : [];
        }
        if (IsGeneric(type, typeof(LinkSet<>)))
        {
            var items = ValueReader(type.GetProperty(nameof(LinkSet<object>.Items))!.PropertyType)!;
            var property = type.GetProperty(nameof(LinkSet<object>.Items))!;
            return links => items(property.GetValue(links)!);
        }
        if (IsGeneric(type, typeof(ImmutableArray<>)) && IsKey(type.GetGenericArguments()[0]))
        {
            var item = ValueReader(type.GetGenericArguments()[0])!;
            var isDefault = type.GetProperty(nameof(ImmutableArray<object>.IsDefault))!;
            return array => (bool)isDefault.GetValue(array)! ? [] : ((IEnumerable)array).Cast<object>().SelectMany(item);
        }
        if (IsComposite(type))
        {
            var nested = Readers(type);
            return value => nested.SelectMany(read => read(value));
        }
        return null;
    }

    private static RowReference Reference(Type target, (ReferenceKey<ModelSnapshot>? Snapshot, string Key) key) => new(target, key.Snapshot, key.Key);
}
