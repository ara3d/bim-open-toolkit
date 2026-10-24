namespace PlaneSweep;

/// <summary>The gate checks of a triangulation of a region (the layer 5 gate laws: every boundary segment a side once
/// in its direction, every other side shared by two triangles opposite ways, every triangle positive, areas summing
/// to the region's, the count n + 2h - 2) and its quality measures (minimum angle, slivers under the harness's
/// 1e-9 measure, the smallest altitude).</summary>
public sealed record Quality(int Triangles, double MinAngleDeg, int Slivers, double MinAltitude, double AreaSum)
{
    public static Quality Of(double[] xs, double[] ys, int[] tris)
    {
        var minAngle = double.MaxValue;
        var minAlt = double.MaxValue;
        var slivers = 0;
        double area = 0;
        for (var t = 0; t < tris.Length; t += 3)
        {
            int a = tris[t], b = tris[t + 1], c = tris[t + 2];
            var twice = (xs[b] - xs[a]) * (ys[c] - ys[a]) - (xs[c] - xs[a]) * (ys[b] - ys[a]);
            area += twice / 2;
            var lab = Math.Sqrt((xs[b] - xs[a]) * (xs[b] - xs[a]) + (ys[b] - ys[a]) * (ys[b] - ys[a]));
            var lbc = Math.Sqrt((xs[c] - xs[b]) * (xs[c] - xs[b]) + (ys[c] - ys[b]) * (ys[c] - ys[b]));
            var lca = Math.Sqrt((xs[a] - xs[c]) * (xs[a] - xs[c]) + (ys[a] - ys[c]) * (ys[a] - ys[c]));
            var longest = Math.Max(lab, Math.Max(lbc, lca));
            if (Math.Abs(twice) <= 1e-9 * longest * longest) slivers++;
            if (longest > 0) minAlt = Math.Min(minAlt, Math.Abs(twice) / longest);
            minAngle = Math.Min(minAngle, Math.Min(Angle(lab, lca, lbc), Math.Min(Angle(lab, lbc, lca), Angle(lbc, lca, lab))));
        }
        return new(tris.Length / 3, tris.Length == 0 ? 0 : minAngle * 180 / Math.PI, slivers, tris.Length == 0 ? 0 : minAlt, area);
    }

    /// <summary>The angle between sides p and q opposite side r.</summary>
    static double Angle(double p, double q, double r)
    {
        if (p <= 0 || q <= 0) return 0;
        var c = (p * p + q * q - r * r) / (2 * p * q);
        return Math.Acos(Math.Clamp(c, -1, 1));
    }
}

public static class Gate
{
    /// <summary>The region's signed area in the chart (loops as given), by the shoelace formula.</summary>
    public static double RegionArea(double[] xs, double[] ys, int[] next)
    {
        double twice = 0;
        for (var i = 0; i < xs.Length; i++)
            if (next[i] >= 0)
                twice += xs[i] * ys[next[i]] - xs[next[i]] * ys[i];
        return twice / 2;
    }

    /// <summary>Empty when the triangulation passes every gate check; else the first check it fails.</summary>
    public static string Check(double[] xs, double[] ys, int[] next, int[] tris, int loopsOfThreeOrMore)
    {
        var n = xs.Length;
        var directed = new Dictionary<long, int>();
        for (var t = 0; t < tris.Length; t += 3)
        {
            int a = tris[t], b = tris[t + 1], c = tris[t + 2];
            var twice = (xs[b] - xs[a]) * (ys[c] - ys[a]) - (xs[c] - xs[a]) * (ys[b] - ys[a]);
            if (!(twice > 0)) return "non-positive triangle";
            foreach (var (p, q) in new[] { (a, b), (b, c), (c, a) })
            {
                var key = (long)p * n + q;
                directed[key] = directed.GetValueOrDefault(key) + 1;
                if (directed[key] > 1) return "a directed side used twice";
            }
        }
        var boundary = new HashSet<long>();
        for (var i = 0; i < n; i++)
            if (next[i] >= 0)
            {
                boundary.Add((long)i * n + next[i]);
                if (!directed.ContainsKey((long)i * n + next[i])) return "a boundary segment is not a side";
                if (directed.ContainsKey((long)next[i] * n + i)) return "a boundary segment is a side reversed";
            }
        foreach (var key in directed.Keys)
        {
            if (boundary.Contains(key)) continue;
            long p = key / n, q = key % n;
            if (!directed.ContainsKey(q * n + p)) return "an interior side is not shared";
        }
        var expected = n + 2 * loopsOfThreeOrMore - 2;
        if (tris.Length / 3 != expected) return $"count {tris.Length / 3} not {expected}";
        var area = RegionArea(xs, ys, next);
        var sum = Quality.Of(xs, ys, tris).AreaSum;
        if (Math.Abs(sum - area) > 1e-9 * Math.Max(Math.Abs(area), 1e-300)) return $"area {sum} not {area}";
        return "";
    }
}
