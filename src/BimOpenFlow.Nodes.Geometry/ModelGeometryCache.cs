using System.Collections.Concurrent;
using System.Security.Cryptography;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry;

/// <summary>
/// Process-wide cache of loaded model geometry, keyed by file content hash so a
/// re-saved identical file hits the cache and an edited file misses it.
/// </summary>
public static class ModelGeometryCache
{
    // TODO: unbounded cache; add eviction when the host manages many models.
    private static readonly ConcurrentDictionary<string, ModelGeometry> Cache = new();

    public static ModelGeometry Load(FilePath path)
        => Cache.GetOrAdd(ContentHash(path), _ => ModelGeometry.Load(path));

    public static string ContentHash(FilePath path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream));
    }
}
