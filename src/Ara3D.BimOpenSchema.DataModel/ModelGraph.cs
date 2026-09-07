using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

public enum GraphDirection { Outgoing, Incoming, Both }

public sealed record ModelGraph
{
    private int EntityCount { get; }
    private ImmutableDictionary<int, ImmutableArray<EdgeRow>> Outgoing { get; }
    private ImmutableDictionary<int, ImmutableArray<EdgeRow>> Incoming { get; }

    private ModelGraph(int entityCount, IReadOnlyList<EdgeRow> edges)
    {
        EntityCount = entityCount;
        Outgoing = edges.GroupBy(e => e.SourceId).ToImmutableDictionary(g => g.Key, g => g.ToImmutableArray());
        Incoming = edges.GroupBy(e => e.TargetId).ToImmutableDictionary(g => g.Key, g => g.ToImmutableArray());
    }

    internal static ModelGraph Create(int entityCount, IReadOnlyList<EdgeRow> edges)
        => new(entityCount, edges);

    /// <summary>ConnectsTo is symmetric even when only one source edge was exported.</summary>
    public ImmutableArray<int> Neighbors(int entityId, string? kind = null, GraphDirection direction = GraphDirection.Outgoing)
    {
        if (!Enum.IsDefined(direction)) throw new ArgumentOutOfRangeException(nameof(direction));
        var ids = new HashSet<int>();
        foreach (var edge in Outgoing.GetValueOrDefault(entityId, []))
            if ((kind is null || edge.Kind == kind) && (direction != GraphDirection.Incoming || edge.Kind == "ConnectsTo"))
                ids.Add(edge.TargetId);
        foreach (var edge in Incoming.GetValueOrDefault(entityId, []))
            if ((kind is null || edge.Kind == kind) && (direction != GraphDirection.Outgoing || edge.Kind == "ConnectsTo"))
                ids.Add(edge.SourceId);
        return ids.Order().ToImmutableArray();
    }

    /// <summary>Breadth-first traversal excludes the seed and visits each node once, including on cyclic graphs.</summary>
    public ImmutableArray<int> Reachable(int entityId, string? kind = null,
        GraphDirection direction = GraphDirection.Outgoing, int maxDepth = int.MaxValue)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(maxDepth);
        if (entityId < 0 || entityId >= EntityCount) return [];
        var visited = new HashSet<int> { entityId };
        var queue = new Queue<(int Id, int Depth)>();
        var result = ImmutableArray.CreateBuilder<int>();
        queue.Enqueue((entityId, 0));
        while (queue.TryDequeue(out var item))
        {
            if (item.Depth >= maxDepth) continue;
            foreach (var next in Neighbors(item.Id, kind, direction))
                if (visited.Add(next))
                {
                    result.Add(next);
                    queue.Enqueue((next, item.Depth + 1));
                }
        }
        return result.ToImmutable();
    }

    public ImmutableArray<int> ShortestPath(int start, int end, string? kind = null,
        GraphDirection direction = GraphDirection.Outgoing)
    {
        if (start < 0 || start >= EntityCount || end < 0 || end >= EntityCount) return [];
        var parents = new Dictionary<int, int> { [start] = start };
        var queue = new Queue<int>();
        queue.Enqueue(start);
        while (queue.TryDequeue(out var current))
        {
            if (current == end)
            {
                var path = new List<int> { end };
                while (current != start) { current = parents[current]; path.Add(current); }
                path.Reverse();
                return path.ToImmutableArray();
            }
            foreach (var next in Neighbors(current, kind, direction))
                if (parents.TryAdd(next, current)) queue.Enqueue(next);
        }
        return [];
    }
}
