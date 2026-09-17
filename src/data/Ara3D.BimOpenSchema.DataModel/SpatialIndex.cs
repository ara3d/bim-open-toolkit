using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.DataModel;

/// <summary>Median-split BVH over entity AABBs. Results are candidates, not exact mesh clashes or clearances.</summary>
public sealed record SpatialIndex
{
    private sealed record Node(Bounds3 Bounds, Node? Left, Node? Right, ImmutableArray<GeometryRow> Items);
    private Node? Root { get; }
    private SpatialIndex(Node? root) => Root = root;

    public static SpatialIndex Create(IReadOnlyList<GeometryRow> geometry)
    {
        ArgumentNullException.ThrowIfNull(geometry);
        var rows = geometry.ToArray();
        foreach (var row in rows)
            if (!row.Bounds.IsValid) throw new ArgumentException("Spatial bounds must be finite and ordered.", nameof(geometry));
        return new(rows.Length == 0 ? null : Build(rows, 0, rows.Length));
    }

    private static Node Build(GeometryRow[] rows, int offset, int count)
    {
        var bounds = rows[offset].Bounds;
        for (var i = offset + 1; i < offset + count; i++) bounds = bounds.Union(rows[i].Bounds);
        if (count <= 8) return new(bounds, null, null, rows.AsSpan(offset, count).ToArray().ToImmutableArray());
        var size = bounds.Size;
        var axis = size.X >= size.Y && size.X >= size.Z ? 0 : size.Y >= size.Z ? 1 : 2;
        double Coordinate(GeometryRow row) => axis == 0 ? row.Bounds.Center.X : axis == 1 ? row.Bounds.Center.Y : row.Bounds.Center.Z;
        Array.Sort(rows, offset, count, Comparer<GeometryRow>.Create((a, b) => Coordinate(a).CompareTo(Coordinate(b))));
        var leftCount = count / 2;
        return new(bounds, Build(rows, offset, leftCount), Build(rows, offset + leftCount, count - leftCount), []);
    }

    public ImmutableArray<int> Intersect(Bounds3 bounds)
    {
        if (!bounds.IsValid) throw new ArgumentException("Query bounds must be finite and ordered.", nameof(bounds));
        return Query(b => b.Intersects(bounds));
    }

    public ImmutableArray<int> WithinDistance(Point3 point, double distance)
    {
        if (!point.IsFinite || !double.IsFinite(distance) || distance < 0) throw new ArgumentOutOfRangeException(nameof(distance));
        return Query(b => b.DistanceTo(point) <= distance);
    }

    private ImmutableArray<int> Query(Func<Bounds3, bool> intersects)
    {
        if (Root is null) return [];
        var stack = new Stack<Node>();
        var result = new List<int>();
        stack.Push(Root);
        while (stack.TryPop(out var node))
        {
            if (!intersects(node.Bounds)) continue;
            foreach (var row in node.Items) if (intersects(row.Bounds)) result.Add(row.EntityId);
            if (node.Left is { } left) stack.Push(left);
            if (node.Right is { } right) stack.Push(right);
        }
        result.Sort();
        return result.ToImmutableArray();
    }
}
