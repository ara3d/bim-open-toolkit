namespace PlaneSweep;

/// <summary>A sweep-line triangulation of a region given by its boundary loops (the region on the left of every
/// directed segment: the outer loop counter-clockwise, holes clockwise). Partition into y-monotone pieces by the
/// plane sweep of de Berg et al. chapter 3 (diagonals from split and merge vertices), then the stack triangulation of
/// each piece. Holes need no bridges: their edges take part in the sweep like any other. Written with arrays and
/// integer loops so it ports to Plato as it stands. Returns null, with a reason, on an input it does not handle; the
/// caller then falls back.</summary>
public static class Sweep
{
    const int Start = 0, End = 1, Split = 2, Merge = 3, Regular = 4;

    /// <summary>Vertex a is above b: larger y, or the same y and smaller x.</summary>
    static bool Above(double[] xs, double[] ys, int a, int b)
        => ys[a] > ys[b] || (ys[a] == ys[b] && xs[a] < xs[b]);

    static double Cross(double ax, double ay, double bx, double by) => ax * by - ay * bx;

    /// <summary>The x of edge e (from e to next[e]) at height y, exact at its endpoints; a horizontal edge answers
    /// its right end.</summary>
    static double XAt(double[] xs, double[] ys, int[] next, int e, double y)
    {
        int a = e, b = next[e];
        if (ys[a] == ys[b]) return Math.Max(xs[a], xs[b]);
        if (y == ys[a]) return xs[a];
        if (y == ys[b]) return xs[b];
        var t = (y - ys[a]) / (ys[b] - ys[a]);
        return xs[a] + t * (xs[b] - xs[a]);
    }

    public static int[]? Triangulate(double[] xs, double[] ys, int[] next, out string why, out int diagonalCount, TextWriter? log = null)
    {
        why = "";
        diagonalCount = 0;
        var n = xs.Length;
        var prev = new int[n];
        Array.Fill(prev, -1);
        for (var i = 0; i < n; i++)
        {
            if (next[i] < 0 || next[i] == i || prev[next[i]] >= 0) { why = "loop under three points or broken chain"; return null; }
            prev[next[i]] = i;
        }
        for (var i = 0; i < n; i++)
            if (next[next[i]] == i) { why = "two-point loop"; return null; }

        // Events: vertices from top to bottom.
        var order = new int[n];
        for (var i = 0; i < n; i++) order[i] = i;
        Array.Sort(order, (a, b) => a == b ? 0 : (Above(xs, ys, a, b) ? -1 : 1));
        for (var k = 1; k < n; k++)
            if (xs[order[k]] == xs[order[k - 1]] && ys[order[k]] == ys[order[k - 1]]) { why = "coincident points"; return null; }

        var kind = new int[n];
        for (var v = 0; v < n; v++)
        {
            int u = prev[v], w = next[v];
            var turn = Cross(xs[v] - xs[u], ys[v] - ys[u], xs[w] - xs[v], ys[w] - ys[v]);
            var bothBelow = Above(xs, ys, v, u) && Above(xs, ys, v, w);
            var bothAbove = Above(xs, ys, u, v) && Above(xs, ys, w, v);
            kind[v] = bothBelow ? (turn > 0 ? Start : Split) : (bothAbove ? (turn > 0 ? End : Merge) : Regular);
        }
        if (log is not null)
            for (var k = 0; k < n; k++)
                log.WriteLine($"event {k}: v{order[k]} ({xs[order[k]]}, {ys[order[k]]}) kind {kind[order[k]]} prev {prev[order[k]]} next {next[order[k]]}");

        // The status: the downward edges crossing the sweep line, by x; helper per edge.
        var status = new List<int>();
        var helper = new int[n];
        var diagA = new List<int>();
        var diagB = new List<int>();
        var seen = new HashSet<long>();
        void Diagonal(int a, int b)
        {
            var key = a < b ? (long)a * n + b : (long)b * n + a;
            if (a == b || !seen.Add(key)) return;
            log?.WriteLine($"diagonal v{a} - v{b}");
            diagA.Add(a); diagB.Add(b);
        }
        bool failed = false;
        // The position of the rightmost status edge strictly left of (x, y); -1 when none. An edge at x exactly is a
        // vertex on an edge, which this triangulator does not handle.
        int LeftOf(double x, double y)
        {
            int lo = 0, hi = status.Count;
            while (lo < hi)
            {
                var mid = (lo + hi) / 2;
                var ex = XAt(xs, ys, next, status[mid], y);
                if (ex < x) lo = mid + 1;
                else { if (ex == x) failed = true; hi = mid; }
            }
            return lo - 1;
        }
        void Insert(int e)
        {
            var at = LeftOf(xs[e], ys[e]) + 1;
            status.Insert(at, e);
        }
        void Delete(int e)
        {
            var at = status.IndexOf(e);
            if (at < 0) { failed = true; return; }
            status.RemoveAt(at);
        }
        for (var k = 0; k < n && !failed; k++)
        {
            var v = order[k];
            int ein = prev[v], eout = v;
            switch (kind[v])
            {
                case Start:
                    helper[eout] = v; Insert(eout);
                    break;
                case End:
                    if (kind[helper[ein]] == Merge) Diagonal(v, helper[ein]);
                    Delete(ein);
                    break;
                case Split:
                {
                    var j = LeftOf(xs[v], ys[v]);
                    if (j < 0) { failed = true; break; }
                    Diagonal(v, helper[status[j]]);
                    helper[status[j]] = v;
                    helper[eout] = v; Insert(eout);
                    break;
                }
                case Merge:
                {
                    if (kind[helper[ein]] == Merge) Diagonal(v, helper[ein]);
                    Delete(ein);
                    var j = LeftOf(xs[v], ys[v]);
                    if (j < 0) { failed = true; break; }
                    if (kind[helper[status[j]]] == Merge) Diagonal(v, helper[status[j]]);
                    helper[status[j]] = v;
                    break;
                }
                default:
                {
                    // Interior to the right of v when the chain goes down through v.
                    if (Above(xs, ys, ein, v))
                    {
                        if (kind[helper[ein]] == Merge) Diagonal(v, helper[ein]);
                        Delete(ein);
                        helper[eout] = v; Insert(eout);
                    }
                    else
                    {
                        var j = LeftOf(xs[v], ys[v]);
                        if (j < 0) { failed = true; break; }
                        if (kind[helper[status[j]]] == Merge) Diagonal(v, helper[status[j]]);
                        helper[status[j]] = v;
                    }
                    break;
                }
            }
        }
        if (failed) { why = "sweep: a vertex on an edge, or no edge to its left"; return null; }
        diagonalCount = diagA.Count;

        // Half-edges: 0..n-1 the boundary segments, then two per diagonal.
        var m = n + 2 * diagA.Count;
        var from = new int[m];
        var to = new int[m];
        for (var i = 0; i < n; i++) { from[i] = i; to[i] = next[i]; }
        for (var d = 0; d < diagA.Count; d++)
        {
            from[n + 2 * d] = diagA[d]; to[n + 2 * d] = diagB[d];
            from[n + 2 * d + 1] = diagB[d]; to[n + 2 * d + 1] = diagA[d];
        }
        // Out-half-edges per vertex, as a CSR table.
        var degree = new int[n + 1];
        for (var h = 0; h < m; h++) degree[from[h] + 1]++;
        for (var i = 0; i < n; i++) degree[i + 1] += degree[i];
        var outs = new int[m];
        var fill = new int[n];
        Array.Copy(degree, fill, n);
        for (var h = 0; h < m; h++) outs[fill[from[h]]++] = h;

        // Faces: walk each half-edge's left face; at a vertex take the out-half-edge with the least clockwise turn
        // from the reversed incoming direction.
        var visited = new bool[m];
        var tris = new List<int>();
        var poly = new List<int>();
        for (var h0 = 0; h0 < m; h0++)
        {
            if (visited[h0]) continue;
            poly.Clear();
            var h = h0;
            var steps = 0;
            while (!visited[h] && steps <= m)
            {
                visited[h] = true;
                poly.Add(from[h]);
                var t = to[h];
                var rx = xs[from[h]] - xs[t];
                var ry = ys[from[h]] - ys[t];
                var best = -1;
                var bestTurn = double.MaxValue;
                for (var k = degree[t]; k < degree[t + 1]; k++)
                {
                    var o = outs[k];
                    var dx = xs[to[o]] - xs[t];
                    var dy = ys[to[o]] - ys[t];
                    // Clockwise turn from (rx, ry) to (dx, dy), in (0, 2 pi]; the twin (turn 0) is last.
                    var ccw = Math.Atan2(Cross(rx, ry, dx, dy), rx * dx + ry * dy);
                    var cw = -ccw;
                    if (cw <= 1e-15) cw += 2 * Math.PI;
                    if (cw < bestTurn) { bestTurn = cw; best = o; }
                }
                if (best < 0) { why = "face walk: dead end"; return null; }
                h = best;
                steps++;
            }
            log?.WriteLine($"face from h{h0}: {string.Join(" ", poly.Select(v => "v" + v))}{(h != h0 ? " (ran into h" + h + ")" : "")}");
            if (h != h0) { why = "face walk: did not close"; return null; }
            if (!TriangulateMonotone(xs, ys, poly, tris)) { why = "piece not monotone"; return null; }
        }
        return tris.ToArray();
    }

    /// <summary>The stack triangulation of a y-monotone polygon given counter-clockwise; appends positive triangles
    /// to tris (zero-area ones are dropped). False when the polygon is not monotone (a chain turns back).</summary>
    static bool TriangulateMonotone(double[] xs, double[] ys, List<int> poly, List<int> tris)
    {
        var m = poly.Count;
        if (m < 3) return m == 0;
        var top = 0;
        for (var i = 1; i < m; i++) if (Above(xs, ys, poly[i], poly[top])) top = i;
        var bottom = 0;
        for (var i = 1; i < m; i++) if (Above(xs, ys, poly[bottom], poly[i])) bottom = i;
        // Left chain: top forward to bottom; right chain: top backward to bottom. Merge by height.
        var u = new int[m];
        var left = new bool[m];
        int l = (top + 1) % m, r = (top + m - 1) % m, k = 0;
        u[k] = poly[top]; left[k] = true; k++;
        while (l != bottom || r != bottom)
        {
            bool takeLeft;
            if (l == bottom) takeLeft = false;
            else if (r == bottom) takeLeft = true;
            else takeLeft = Above(xs, ys, poly[l], poly[r]);
            if (takeLeft)
            {
                if (k > 0 && !Above(xs, ys, u[k - 1], poly[l]) && u[k - 1] != poly[l]) return false;
                u[k] = poly[l]; left[k] = true; k++; l = (l + 1) % m;
            }
            else
            {
                if (k > 0 && !Above(xs, ys, u[k - 1], poly[r]) && u[k - 1] != poly[r]) return false;
                u[k] = poly[r]; left[k] = false; k++; r = (r + m - 1) % m;
            }
        }
        u[k] = poly[bottom]; left[k] = true; k++;
        if (k != m) return false;
        void Emit(int a, int b, int c)
        {
            var area = Cross(xs[b] - xs[a], ys[b] - ys[a], xs[c] - xs[a], ys[c] - ys[a]);
            if (area > 0) { tris.Add(a); tris.Add(b); tris.Add(c); }
            else if (area < 0) { tris.Add(a); tris.Add(c); tris.Add(b); }
        }
        var stack = new int[m];
        var stackLeft = new bool[m];
        var sp = 0;
        stack[sp] = u[0]; stackLeft[sp] = left[0]; sp++;
        stack[sp] = u[1]; stackLeft[sp] = left[1]; sp++;
        for (var j = 2; j < m - 1; j++)
        {
            if (left[j] != stackLeft[sp - 1])
            {
                for (var s = sp - 1; s > 0; s--) Emit(u[j], stack[s], stack[s - 1]);
                sp = 0;
                stack[sp] = u[j - 1]; stackLeft[sp] = left[j - 1]; sp++;
                stack[sp] = u[j]; stackLeft[sp] = left[j]; sp++;
            }
            else
            {
                var last = stack[--sp];
                while (sp > 0)
                {
                    var below = stack[sp - 1];
                    var area = Cross(xs[last] - xs[below], ys[last] - ys[below], xs[u[j]] - xs[below], ys[u[j]] - ys[below]);
                    var inside = left[j] ? area > 0 : area < 0;
                    if (!inside) break;
                    Emit(u[j], last, below);
                    last = below;
                    sp--;
                }
                stack[sp] = last; stackLeft[sp] = left[j]; sp++;
                stack[sp] = u[j]; stackLeft[sp] = left[j]; sp++;
            }
        }
        for (var s = sp - 1; s > 0; s--) Emit(u[m - 1], stack[s], stack[s - 1]);
        return true;
    }
}
