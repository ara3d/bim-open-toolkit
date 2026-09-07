using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

public sealed record ScheduleCell(PropertyKey Key, ImmutableArray<PropertyRow> Values);
public sealed record ScheduleRow(EntityRow Entity, ImmutableArray<ScheduleCell> Cells);
public sealed record CategorySummary(int? DocumentId, string? Category, int EntityCount, int EntitiesWithGeometry);

public static class ModelQueries
{
    public static PropertyKey Property(string name, ParameterType kind, string group = "", string units = "")
        => new(TextNormalization.Key(name), TextNormalization.Key(group), TextNormalization.UnitKey(units), kind);

    /// <summary>Queries explicitly stored values. The key fixes value type and unit, preventing mixed-unit comparisons.</summary>
    public static ImmutableArray<int> FindNumeric(this BimModel model, PropertyKey key, double min, double max)
    {
        if (!double.IsFinite(min) || !double.IsFinite(max) || min > max) throw new ArgumentOutOfRangeException(nameof(min));
        return model.FindByProperty(key).Where(p => p.IsValid && !p.IsMissing &&
            (p.NumberValue ?? p.IntegerValue) is { } value && value >= min && value <= max)
            .Select(p => p.EntityId).Distinct().Order().ToImmutableArray();
    }

    public static ImmutableArray<int> FindText(this BimModel model, PropertyKey key, string value, bool normalize = true)
    {
        var match = normalize ? TextNormalization.Key(value) : value;
        return model.FindByProperty(key).Where(p => p.IsValid && p.TextValue is { } text &&
            (normalize ? TextNormalization.Key(text) : text) == match).Select(p => p.EntityId).Distinct().Order().ToImmutableArray();
    }

    /// <summary>A schedule keeps duplicate cells and inherited value provenance rather than choosing an arbitrary winner.</summary>
    public static ImmutableArray<ScheduleRow> Schedule(this BimModel model, IReadOnlyList<int> entityIds,
        IReadOnlyList<PropertyKey> columns, bool includeType = true)
    {
        var result = ImmutableArray.CreateBuilder<ScheduleRow>(entityIds.Count);
        foreach (var id in entityIds)
        {
            if (id < 0 || id >= model.Tables.Entities.Length) throw new ArgumentOutOfRangeException(nameof(entityIds));
            var properties = model.PropertiesOf(id, includeType).ToLookup(p => p.Key);
            result.Add(new(model.Tables.Entities[id], columns.Select(k => new ScheduleCell(k, properties[k].ToImmutableArray())).ToImmutableArray()));
        }
        return result.MoveToImmutable();
    }

    public static ImmutableArray<int> MissingProperty(this BimModel model, IReadOnlyList<int> entityIds, PropertyKey key)
    {
        var result = ImmutableArray.CreateBuilder<int>();
        foreach (var id in entityIds)
        {
            if (id < 0 || id >= model.Tables.Entities.Length) throw new ArgumentOutOfRangeException(nameof(entityIds));
            if (!model.PropertiesOf(id).Any(p => p.Key == key && p.IsValid && !p.IsMissing &&
                (p.Key.Kind != ParameterType.String || !string.IsNullOrWhiteSpace(p.TextValue)))) result.Add(id);
        }
        return result.ToImmutable();
    }

    public static ImmutableArray<CategorySummary> SummarizeCategories(this BimModel model)
    {
        var geometric = model.Tables.Geometry.Select(g => g.EntityId).ToHashSet();
        return model.Tables.Entities.Where(e => !e.IsCategory && !e.IsType).GroupBy(e => (e.DocumentId, e.Category))
            .Select(g => new CategorySummary(g.Key.DocumentId, g.Key.Category, g.Count(), g.Count(e => geometric.Contains(e.Id))))
            .OrderBy(r => r.DocumentId).ThenBy(r => r.Category, StringComparer.Ordinal).ToImmutableArray();
    }
}
