using System.Collections.Concurrent;
using System.Security.Cryptography;
using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>A loaded .bos file with the lookups the analysis nodes need. The object
/// model stringifies Point parameters, so point-typed values (bounds, locations) are
/// indexed here straight from the raw data. Instances are immutable once built and
/// cached per file content hash (the BosLoadNode pattern), so re-evaluations of
/// unchanged content never reload.</summary>
public sealed class BimModel
{
    private static readonly ConcurrentDictionary<string, BimModel> Cache = new();

    public IBimData Data { get; }
    public BimObjectModel Objects { get; }
    private readonly Dictionary<(EntityIndex, string), Point> _points;

    private BimModel(IBimData data)
    {
        Data = data;
        Objects = new BimObjectModel(data, computeParametersAndRelations: true);
        _points = new();
        foreach (var p in data.Parameters)
        {
            var d = data.Get(p.Descriptor);
            if (d is { Type: ParameterType.Point } desc && p.Value >= 0)
                _points[(p.Entity, data.Get(desc.Name))] = data.Get((PointIndex)p.Value);
        }
    }

    public static BimModel Get(string path, string kind)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException($"{kind}: file not found: {path}", path);
        return Cache.GetOrAdd(ContentHash(path), _ => Load(path));
    }

    private static BimModel Load(string path)
        => new(new FilePath(path).ReadBimDataFromParquetZip());

    private static string ContentHash(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }

    public bool TryGetPoint(EntityIndex entity, string paramName, out Point point)
        => _points.TryGetValue((entity, paramName), out point);

    /// <summary>The axis-aligned bounds from the Rvt:Element:Bounds parameters, or
    /// null when either endpoint is absent.</summary>
    public (Point Min, Point Max)? GetBounds(EntityIndex entity)
        => TryGetPoint(entity, CommonRevitParameters.ElementBoundsMin, out var min)
           && TryGetPoint(entity, CommonRevitParameters.ElementBoundsMax, out var max)
            ? (min, max)
            : null;

    /// <summary>The instance elements: not a category, not a type, and carrying a
    /// real category (filters out the pseudo entities like boundaries and connectors
    /// whose category names start with "__").</summary>
    public IEnumerable<EntityModel> InstanceElements()
        => Objects.Entities.Where(e =>
            e.IsNotTypeOrCategory && e.Category is { Length: > 0 } c && !c.StartsWith("__"));

    /// <summary>Elements whose category name is in the given comma-separated list
    /// (case-insensitive).</summary>
    public IEnumerable<EntityModel> ElementsInCategories(string categories)
    {
        var set = new HashSet<string>(categories.SplitNames(), StringComparer.OrdinalIgnoreCase);
        return InstanceElements().Where(e => set.Contains(e.Category));
    }
}
