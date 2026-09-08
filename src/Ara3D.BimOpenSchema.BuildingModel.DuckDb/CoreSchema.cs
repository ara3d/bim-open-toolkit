using System.Collections.Immutable;
using System.Reflection;
using Platonic;

namespace Ara3D.BimOpenSchema.BuildingModel.DuckDb;

/// <summary>One direct core-record property exposed as a database column.</summary>
public sealed record CoreColumn(string Name, Type ValueType);

/// <summary>One core record table, independent of a particular database provider.</summary>
public sealed record CoreTable(string Name, Type RecordType, ImmutableArray<CoreColumn> Columns);

/// <summary>Discovers the canonical direct table and column contract from the core-model assembly.</summary>
[Impure]
public static class CoreSchema
{
    public static ImmutableArray<CoreTable> Tables { get; } = Discover();

    private static ImmutableArray<CoreTable> Discover()
        => typeof(BimObject).Assembly.GetExportedTypes()
            .Where(IsCoreTable)
            .OrderBy(type => TableName(type), StringComparer.Ordinal)
            .Select(type => new CoreTable(TableName(type), type,
                type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
                    .OrderBy(property => property.MetadataToken)
                    .Select(property => new CoreColumn(ColumnName(property.Name), property.PropertyType))
                    .ToImmutableArray()))
            .ToImmutableArray();

    private static bool IsCoreTable(Type type)
    {
        var id = type.GetProperty("Id", BindingFlags.Instance | BindingFlags.Public);
        return id is not null && id.PropertyType.IsGenericType &&
            id.PropertyType.GetGenericTypeDefinition() is var definition &&
            (definition == typeof(ReferenceKey<>) || definition == typeof(SnapshotKey<>)) &&
            id.PropertyType.GetGenericArguments()[0] == type;
    }

    internal static string TableName(Type type) => SnakeCase(type.Name);
    internal static string ColumnName(string name) => SnakeCase(name);

    private static string SnakeCase(string value)
        => string.Concat(value.Select((character, index) => index > 0 && char.IsUpper(character)
            ? "_" + char.ToLowerInvariant(character) : char.ToLowerInvariant(character).ToString()));
}
