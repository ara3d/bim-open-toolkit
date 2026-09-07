using System.Collections.Immutable;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel;

/// <summary>An immutable snapshot and reusable indices. Queries are safe to run concurrently.</summary>
public sealed record BimModel
{
    public ModelTables Tables { get; }
    public ModelGraph Graph { get; }
    public SpatialIndex Spatial { get; }
    private ImmutableDictionary<int, ImmutableArray<PropertyRow>> PropertiesByEntity { get; }
    private ImmutableDictionary<PropertyKey, ImmutableArray<PropertyRow>> PropertiesByKey { get; }
    private ImmutableDictionary<string, ImmutableArray<EntityRow>> EntitiesByCategory { get; }

    private BimModel(ModelTables tables)
    {
        Tables = tables;
        Graph = ModelGraph.Create(tables.Entities.Length, tables.Edges);
        Spatial = SpatialIndex.Create(tables.Geometry);
        PropertiesByEntity = tables.Properties.GroupBy(p => p.EntityId).ToImmutableDictionary(g => g.Key, g => g.ToImmutableArray());
        PropertiesByKey = tables.Properties.GroupBy(p => p.Key).ToImmutableDictionary(g => g.Key, g => g.ToImmutableArray());
        EntitiesByCategory = tables.Entities.GroupBy(e => TextNormalization.Key(e.Category))
            .ToImmutableDictionary(g => g.Key, g => g.ToImmutableArray());
    }

    public static BimModel Create(ModelTables tables)
    {
        ModelValidation.Validate(tables);
        return new(tables);
    }

    public Option<EntityRow> Entity(int id)
        => id >= 0 && id < Tables.Entities.Length ? Option.Some(Tables.Entities[id]) : default;

    public ImmutableArray<EntityRow> FindByCategory(string category)
        => EntitiesByCategory.GetValueOrDefault(TextNormalization.Key(category), []);

    public ImmutableArray<PropertyRow> FindByProperty(PropertyKey key)
        => PropertiesByKey.GetValueOrDefault(key, []);

    /// <summary>Instance values override type-chain values by full key. Duplicates at the winning level remain visible.</summary>
    public ImmutableArray<PropertyRow> PropertiesOf(int entityId, bool includeType = true)
    {
        if (entityId < 0 || entityId >= Tables.Entities.Length) return [];
        if (!includeType) return PropertiesByEntity.GetValueOrDefault(entityId, []);
        var rows = ImmutableArray.CreateBuilder<PropertyRow>();
        var visited = new HashSet<int>();
        var keys = new HashSet<PropertyKey>();
        int? current = entityId;
        while (current is { } id && visited.Add(id))
        {
            var properties = PropertiesByEntity.GetValueOrDefault(id, []);
            foreach (var p in properties) if (!keys.Contains(p.Key)) rows.Add(p);
            foreach (var p in properties) keys.Add(p.Key);
            current = Tables.Entities[id].TypeId;
        }
        return rows.ToImmutable();
    }
}
