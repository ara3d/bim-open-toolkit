using Ara3D.Step.CorpusHarness;
using Ara3D.StepBrep;
using Boolean = Ara3D.StepBrep.Boolean;

namespace Ara3D.Step.TrimBand;

/// <summary>What the trim-band path did on one face (TKT-490): the grid's counts, the band's share of points, the
/// combined triangulation (band triangles, interior quads or their split triangles) and its lifted mesh, or the reason
/// it stood aside.</summary>
public sealed record BandResult(
    string Status, int Nu, int Nv, int InteriorCells, int BandCells, int OutsideCells, int BoundaryPoints, int RingPoints,
    int RefinementPoints, int InteriorNodes, int Quads, int CellTriangles, int BandTriangles, int Halvings, double SizingMs,
    double ClassifyMs, double CdtMs, double RefineMs, double CombineMs, double LiftMs, UvTriangulation? Triangulation,
    FaceMesh? Mesh, bool Watertight, double AreaGap)
{
    public static BandResult Aside(string status) => new(status, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, null, false, 0);
    public int Elements => Quads + CellTriangles + BandTriangles;
    public int Points => Triangulation?.Points.Count ?? 0;
    /// <summary>The share of the mesh's points that the band triangulation holds (boundary, ring and refinement points).</summary>
    public double BandShare => Points == 0 ? 0 : (double)(BoundaryPoints + RingPoints + RefinementPoints) / Points;
}

/// <summary>The trim-band mesher as a measurement: a structured grid in natural parameters sized so that a cell's
/// lifted quad, under both diagonal splits, stays within the chordal bound (a sampled test, since no closed-form or
/// derivative sizing has landed), cells wholly inside the region at least a margin from its boundary kept as quads,
/// and the library's own CDT and refinement run on the rest (the band) with the interior cells' rings as extra holes,
/// so the band's triangles share the ring nodes with the quads.</summary>
public static class BandMesh
{
    /// <summary>The margin, in cells, that an interior cell keeps from every boundary segment, so no ring node sits
    /// within a sliver of the boundary.</summary>
    public const double MarginCells = 0.25;

    public const int MaxHalvings = 14;
    public const int MaxCellsPerAxis = 2048;

    public static BandResult Run(BrepModel m, BrepFaceIndex f, EdgeDiscretizations d, FaceMeshingCriteria c)
    {
        var r = m.RegionOf(f, d, c);
        var chart = m.ChartOf(f, r);
        var s = m.SurfaceOf(f);
        var chordal = (double)c.SurfaceChordal;
        double scaleU = (double)chart.ScaleU, scaleV = (double)chart.ScaleV;
        var loops = new List<UvLoop> { r.Outer };
        loops.AddRange(r.Holes);
        var boundaryPoints = loops.Sum(l => l.Points.Count);
        var outerSign = Math.Sign(SignedAreaUv(r.Outer));
        if (outerSign == 0)
            return BandResult.Aside("outer-zero-area");

        // The bounding box of the region in natural parameters.
        double u0 = double.MaxValue, v0 = double.MaxValue, u1 = double.MinValue, v1 = double.MinValue;
        foreach (var l in loops)
            foreach (var p in l.Points)
            {
                double u = (double)p.U, v = (double)p.V;
                u0 = Math.Min(u0, u); u1 = Math.Max(u1, u); v0 = Math.Min(v0, v); v1 = Math.Max(v1, v);
            }
        double width = u1 - u0, height = v1 - v0;
        if (!(width > 0) || !(height > 0))
            return BandResult.Aside("flat-box");

        // Cell sizing: one chart length h, halved until a sample of cells over the box passes the sampled chordal
        // test under both diagonal splits.
        var sizing = Clock.Time(() =>
        {
            var h = Math.Max(width * scaleU, height * scaleV);
            var halvings = 0;
            while (halvings < MaxHalvings)
            {
                double hu = h / scaleU, hv = h / scaleV;
                if (SampledCellsOk(m, s, u0, v0, width, height, hu, hv, chordal))
                    break;
                h /= 2;
                halvings++;
            }
            return (h, halvings);
        });
        var (hChart, halvings) = sizing.Item1;
        double huCell = hChart / scaleU, hvCell = hChart / scaleV;
        var nu = Math.Max(1, (int)Math.Ceiling(width / huCell));
        var nv = Math.Max(1, (int)Math.Ceiling(height / hvCell));
        if (nu > MaxCellsPerAxis || nv > MaxCellsPerAxis)
            return BandResult.Aside($"too-many-cells {nu}x{nv}");
        double hu = width / nu, hv = height / nv;

        // Classification: 0 outside, 1 band, 2 interior.
        var classify = Clock.Time(() => Classify(loops, u0, v0, hu, hv, nu, nv, r));
        var state = classify.Item1;
        int interior = 0, band = 0, outside = 0;
        foreach (var st in state)
            if (st == 2) interior++; else if (st == 1) band++; else outside++;
        if (interior == 0)
            return BandResult.Aside("no-interior-cells") with { Nu = nu, Nv = nv, BandCells = band, OutsideCells = outside, Halvings = halvings, SizingMs = sizing.Item2, ClassifyMs = classify.Item2, BoundaryPoints = boundaryPoints };

        // Rings: the directed boundary of the interior cells, interior on the left (counter-clockwise in uv).
        var rings = TraceRings(state, nu, nv);
        var ringNode = new Dictionary<int, int>();
        var ringLoops = new List<UvLoop>();
        var ringPointIndex = boundaryPoints;
        foreach (var ring in rings)
        {
            var nodes = outerSign > 0 ? Enumerable.Reverse(ring).ToArray() : ring.ToArray();
            var pts = new UvCoordinate[nodes.Length];
            var srcs = new UvPointSource[nodes.Length];
            for (var k = 0; k < nodes.Length; k++)
            {
                ringNode[nodes[k]] = ringPointIndex + k;
                pts[k] = NodeUv(nodes[k], nu, u0, v0, hu, hv);
                srcs[k] = UvPointSource.Interior();
            }
            ringPointIndex += nodes.Length;
            ringLoops.Add(new UvLoop(pts, srcs));
        }
        var holes = r.Holes.Concat(ringLoops).ToArray();
        var bandRegion = new UvRegion(r.Outer, holes);
        if (!(bool)m.IsSimpleUnderItsTolerance(f, bandRegion))
            return BandResult.Aside("band-not-simple") with { Nu = nu, Nv = nv, InteriorCells = interior, BandCells = band, OutsideCells = outside, Halvings = halvings, BoundaryPoints = boundaryPoints, RingPoints = ringPointIndex - boundaryPoints };

        var cdt = Clock.Time(() => bandRegion.TriangulateRegionCdtIndexed(chart));
        var refined = Clock.Time(() => m.RefineToSurfaceV1(f, bandRegion, chart, cdt.Item1, c));
        var bandTri = refined.Item1;
        var refinementPoints = bandTri.Points.Count - ringPointIndex;

        // Combine: the band's points, then the interior nodes that are on no ring; quads per interior cell, kept when
        // the library keeps them, else the library's split.
        var combine = Clock.Time(() =>
        {
            var points = new List<UvCoordinate>(bandTri.Points);
            var sources = new List<UvPointSource>(bandTri.Sources);
            var nodeIndex = new Dictionary<int, int>(ringNode);
            var quads = new List<QuadFace>();
            var tris = new List<TriangleFace>(bandTri.Triangles);
            var cellTriangles = 0;
            int Node(int i, int j)
            {
                var id = j * (nu + 1) + i;
                if (nodeIndex.TryGetValue(id, out var idx))
                    return idx;
                idx = points.Count;
                points.Add(NodeUv(id, nu, u0, v0, hu, hv));
                sources.Add(UvPointSource.Interior());
                nodeIndex[id] = idx;
                return idx;
            }
            for (var j = 0; j < nv; j++)
                for (var i = 0; i < nu; i++)
                {
                    if (state[j * nu + i] != 2) continue;
                    var corners = outerSign > 0
                        ? new[] { Node(i, j), Node(i + 1, j), Node(i + 1, j + 1), Node(i, j + 1) }
                        : new[] { Node(i, j), Node(i, j + 1), Node(i + 1, j + 1), Node(i + 1, j) };
                    var v = corners.Select(k => new VertexIndex(k)).ToArray();
                    var ps = corners.Select(k => m.Geometry.Eval(s, points[k])).ToArray();
                    if ((bool)ps.IsKeptQuad(c))
                        quads.Add(new QuadFace(v[0], v[1], v[2], v[3]));
                    else
                    {
                        var split = v.CellTriangles(ps);
                        tris.AddRange(split);
                        cellTriangles += split.Count;
                    }
                }
            var interiorNodes = points.Count - bandTri.Points.Count;
            return (new UvTriangulation(points, sources, tris, quads), interiorNodes, cellTriangles);
        });
        var (tri, interiorNodes, cellTris) = combine.Item1;
        var lift = Clock.Time(() => m.Lift(f, d, tri));
        var (watertight, areaGap) = Watertight(r, tri, outerSign);
        return new("ok", nu, nv, interior, band, outside, boundaryPoints, ringPointIndex - boundaryPoints, refinementPoints, interiorNodes,
            tri.Quads.Count, cellTris, bandTri.Triangles.Count, halvings, sizing.Item2, classify.Item2, cdt.Item2, refined.Item2, combine.Item2,
            lift.Item2, tri, lift.Item1, watertight, areaGap);
    }

    static UvCoordinate NodeUv(int id, int nu, double u0, double v0, double hu, double hv)
    {
        int i = id % (nu + 1), j = id / (nu + 1);
        return new UvCoordinate(u0 + i * hu, v0 + j * hv);
    }

    public static double SignedAreaUv(UvLoop l)
    {
        double a = 0;
        var n = l.Points.Count;
        for (var k = 0; k < n; k++)
        {
            var p = l.Points[k];
            var q = l.Points[(k + 1) % n];
            a += (double)p.U * (double)q.V - (double)q.U * (double)p.V;
        }
        return a / 2;
    }

    /// <summary>The barycentric sample lattice at level n: (n + 1)(n + 2) / 2 points.</summary>
    public static (double A, double B, double C)[] Lattice(int n)
    {
        var list = new List<(double, double, double)>();
        for (var i = 0; i <= n; i++)
            for (var j = 0; i + j <= n; j++)
                list.Add(((double)i / n, (double)j / n, (double)(n - i - j) / n));
        return list.ToArray();
    }

    static readonly (double A, double B, double C)[] SizingSamples = Lattice(4);

    /// <summary>Whether the cell with low corner (cu, cv) and sides (hu, hv) lifts within the bound under both splits.</summary>
    public static bool CellOk(BrepModel m, SurfaceIndex s, double cu, double cv, double hu, double hv, double chordal)
    {
        var uv = new[] { (cu, cv), (cu + hu, cv), (cu + hu, cv + hv), (cu, cv + hv) };
        var p = uv.Select(q => P.Of(m.Geometry.Eval(s, new UvCoordinate(q.Item1, q.Item2)))).ToArray();
        return TriangleOk(m, s, uv[0], uv[1], uv[2], p[0], p[1], p[2], chordal) && TriangleOk(m, s, uv[0], uv[2], uv[3], p[0], p[2], p[3], chordal)
            && TriangleOk(m, s, uv[0], uv[1], uv[3], p[0], p[1], p[3], chordal) && TriangleOk(m, s, uv[1], uv[2], uv[3], p[1], p[2], p[3], chordal);
    }

    static bool TriangleOk(BrepModel m, SurfaceIndex s, (double, double) a, (double, double) b, (double, double) cc, P pa, P pb, P pc, double chordal)
    {
        foreach (var (x, y, z) in SizingSamples)
        {
            var uv = new UvCoordinate(x * a.Item1 + y * b.Item1 + z * cc.Item1, x * a.Item2 + y * b.Item2 + z * cc.Item2);
            var q = P.Of(m.Geometry.Eval(s, uv));
            if (P.DistanceToTriangle(q, pa, pb, pc) > chordal)
                return false;
        }
        return true;
    }

    /// <summary>Cells of the box at a 7 by 7 spread of positions, each tested with CellOk.</summary>
    static bool SampledCellsOk(BrepModel m, SurfaceIndex s, double u0, double v0, double width, double height, double hu, double hv, double chordal)
    {
        const int n = 7;
        for (var a = 0; a < n; a++)
            for (var b = 0; b < n; b++)
            {
                var cu = u0 + (width - hu) * a / (n - 1);
                var cv = v0 + (height - hv) * b / (n - 1);
                if (hu >= width) cu = u0;
                if (hv >= height) cv = v0;
                if (!CellOk(m, s, cu, cv, Math.Min(hu, width), Math.Min(hv, height), chordal))
                    return false;
            }
        return true;
    }

    /// <summary>0 outside, 1 band, 2 interior, per cell in row order.</summary>
    static byte[] Classify(List<UvLoop> loops, double u0, double v0, double hu, double hv, int nu, int nv, UvRegion r)
    {
        var state = new byte[nu * nv];
        var touched = new bool[nu * nv];
        double mu = MarginCells * hu, mv = MarginCells * hv;
        var segments = new List<(double au, double av, double bu, double bv)>();
        foreach (var l in loops)
        {
            var n = l.Points.Count;
            for (var k = 0; k < n; k++)
            {
                var p = l.Points[k];
                var q = l.Points[(k + 1) % n];
                segments.Add(((double)p.U, (double)p.V, (double)q.U, (double)q.V));
            }
        }
        // Every cell a segment comes within the margin of is band.
        foreach (var (au, av, bu, bv) in segments)
        {
            var i0 = Math.Clamp((int)Math.Floor((Math.Min(au, bu) - mu - u0) / hu), 0, nu - 1);
            var i1 = Math.Clamp((int)Math.Floor((Math.Max(au, bu) + mu - u0) / hu), 0, nu - 1);
            var j0 = Math.Clamp((int)Math.Floor((Math.Min(av, bv) - mv - v0) / hv), 0, nv - 1);
            var j1 = Math.Clamp((int)Math.Floor((Math.Max(av, bv) + mv - v0) / hv), 0, nv - 1);
            for (var j = j0; j <= j1; j++)
                for (var i = i0; i <= i1; i++)
                {
                    if (touched[j * nu + i]) continue;
                    var cl = u0 + i * hu - mu; var cr = cl + hu + 2 * mu;
                    var cb = v0 + j * hv - mv; var ct = cb + hv + 2 * mv;
                    if (SegmentMeetsBox(au, av, bu, bv, cl, cb, cr, ct))
                        touched[j * nu + i] = true;
                }
        }
        // Parity along each row of cell centres for the untouched cells.
        var crossings = new List<double>();
        for (var j = 0; j < nv; j++)
        {
            var vc = v0 + (j + 0.5) * hv;
            crossings.Clear();
            foreach (var (au, av, bu, bv) in segments)
                if ((av <= vc) != (bv <= vc))
                    crossings.Add(au + (vc - av) / (bv - av) * (bu - au));
            crossings.Sort();
            var k = 0;
            for (var i = 0; i < nu; i++)
            {
                var uc = u0 + (i + 0.5) * hu;
                while (k < crossings.Count && crossings[k] < uc) k++;
                state[j * nu + i] = touched[j * nu + i] ? (byte)1 : (k % 2 == 1 ? (byte)2 : (byte)0);
            }
        }
        // Keyholes: from each hole's leftmost point to the box's left edge, no interior cell, so no interior
        // component rings a hole and every band component reaches the outer boundary.
        foreach (var hole in r.Holes)
        {
            var left = hole.Points.MinBy(p => (double)p.U);
            var i1 = Math.Clamp((int)Math.Floor(((double)left.U - u0) / hu), 0, nu - 1);
            var j = Math.Clamp((int)Math.Floor(((double)left.V - v0) / hv), 0, nv - 1);
            for (var i = 0; i <= i1; i++)
                if (state[j * nu + i] == 2) state[j * nu + i] = 1;
        }
        // No two interior cells touching only at a corner (a pinched ring).
        bool changed = true;
        while (changed)
        {
            changed = false;
            for (var j = 0; j + 1 < nv; j++)
                for (var i = 0; i + 1 < nu; i++)
                {
                    int a = j * nu + i, b = a + 1, cc = a + nu, dd = cc + 1;
                    if (state[a] == 2 && state[dd] == 2 && state[b] != 2 && state[cc] != 2) { state[a] = 1; changed = true; }
                    else if (state[b] == 2 && state[cc] == 2 && state[a] != 2 && state[dd] != 2) { state[b] = 1; changed = true; }
                }
        }
        return state;
    }

    /// <summary>Liang-Barsky: whether the segment meets the closed box.</summary>
    static bool SegmentMeetsBox(double au, double av, double bu, double bv, double l, double b, double rr, double t)
    {
        double t0 = 0, t1 = 1, du = bu - au, dv = bv - av;
        bool Clip(double p, double q)
        {
            if (p == 0) return q >= 0;
            var x = q / p;
            if (p < 0) { if (x > t1) return false; if (x > t0) t0 = x; }
            else { if (x < t0) return false; if (x < t1) t1 = x; }
            return true;
        }
        return Clip(-du, au - l) && Clip(du, rr - au) && Clip(-dv, av - b) && Clip(dv, t - av);
    }

    /// <summary>The rings of the interior cells: node ids in order, interior on the left.</summary>
    static List<List<int>> TraceRings(byte[] state, int nu, int nv)
    {
        var next = new Dictionary<int, int>();
        bool Interior(int i, int j) => i >= 0 && j >= 0 && i < nu && j < nv && state[j * nu + i] == 2;
        int Id(int i, int j) => j * (nu + 1) + i;
        for (var j = 0; j < nv; j++)
            for (var i = 0; i < nu; i++)
            {
                if (!Interior(i, j)) continue;
                if (!Interior(i, j - 1)) next[Id(i, j)] = Id(i + 1, j);
                if (!Interior(i + 1, j)) next[Id(i + 1, j)] = Id(i + 1, j + 1);
                if (!Interior(i, j + 1)) next[Id(i + 1, j + 1)] = Id(i, j + 1);
                if (!Interior(i - 1, j)) next[Id(i, j + 1)] = Id(i, j);
            }
        var rings = new List<List<int>>();
        var seen = new HashSet<int>();
        foreach (var start in next.Keys.Order())
        {
            if (seen.Contains(start)) continue;
            var ring = new List<int>();
            var n = start;
            while (seen.Add(n))
            {
                ring.Add(n);
                n = next[n];
            }
            if (n != start) throw new InvalidOperationException("ring tracing did not close");
            rings.Add(ring);
        }
        return rings;
    }

    /// <summary>Whether every element edge is shared by two elements except the region's boundary segments, each used
    /// once, and the gap between the elements' total signed uv area and the region's.</summary>
    static (bool, double) Watertight(UvRegion r, UvTriangulation t, int outerSign)
    {
        var use = new Dictionary<(int, int), int>();
        void Add(int a, int b)
        {
            var key = a < b ? (a, b) : (b, a);
            use[key] = use.GetValueOrDefault(key) + 1;
        }
        double area = 0;
        double Cross(UvCoordinate a, UvCoordinate b, UvCoordinate c)
            => ((double)b.U - (double)a.U) * ((double)c.V - (double)a.V) - ((double)c.U - (double)a.U) * ((double)b.V - (double)a.V);
        var ok = true;
        foreach (var tr in t.Triangles)
        {
            int a = (int)tr.A.Value, b = (int)tr.B.Value, c = (int)tr.C.Value;
            Add(a, b); Add(b, c); Add(c, a);
            var s = Cross(t.Points[a], t.Points[b], t.Points[c]) / 2;
            if (s * outerSign <= 0) ok = false;
            area += s;
        }
        foreach (var q in t.Quads)
        {
            int a = (int)q.A.Value, b = (int)q.B.Value, c = (int)q.C.Value, d = (int)q.D.Value;
            Add(a, b); Add(b, c); Add(c, d); Add(d, a);
            var s = (Cross(t.Points[a], t.Points[b], t.Points[c]) + Cross(t.Points[a], t.Points[c], t.Points[d])) / 2;
            if (s * outerSign <= 0) ok = false;
            area += s;
        }
        var boundary = new HashSet<(int, int)>();
        var offset = 0;
        double regionArea = 0;
        foreach (var l in new[] { r.Outer }.Concat(r.Holes))
        {
            var n = l.Points.Count;
            for (var k = 0; k < n; k++)
            {
                int a = offset + k, b = offset + (k + 1) % n;
                boundary.Add(a < b ? (a, b) : (b, a));
            }
            regionArea += SignedAreaUv(l);
            offset += n;
        }
        foreach (var (key, count) in use)
            if (count != (boundary.Contains(key) ? 1 : 2)) ok = false;
        foreach (var key in boundary)
            if (!use.ContainsKey(key)) ok = false;
        var gap = Math.Abs(area - regionArea) / Math.Max(Math.Abs(regionArea), 1e-300);
        return (ok && gap < 1e-9, gap);
    }
}

/// <summary>A 3D point in doubles with the closest-point-on-triangle distance (Ericson, Real-Time Collision Detection 5.1.5).</summary>
public readonly record struct P(double X, double Y, double Z)
{
    public static P Of(Point3D p) => new((double)p.X, (double)p.Y, (double)p.Z);
    public static P operator -(P a, P b) => new(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
    public static P operator +(P a, P b) => new(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
    public static P operator *(P a, double s) => new(a.X * s, a.Y * s, a.Z * s);
    public static double Dot(P a, P b) => a.X * b.X + a.Y * b.Y + a.Z * b.Z;
    public static P Cross(P a, P b) => new(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X);
    public double Length => Math.Sqrt(Dot(this, this));

    public static double DistanceToTriangle(P p, P a, P b, P c)
    {
        var ab = b - a; var ac = c - a; var ap = p - a;
        double d1 = Dot(ab, ap), d2 = Dot(ac, ap);
        if (d1 <= 0 && d2 <= 0) return (p - a).Length;
        var bp = p - b;
        double d3 = Dot(ab, bp), d4 = Dot(ac, bp);
        if (d3 >= 0 && d4 <= d3) return (p - b).Length;
        var vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { var v = d1 / (d1 - d3); return (p - (a + ab * v)).Length; }
        var cp = p - c;
        double d5 = Dot(ab, cp), d6 = Dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) return (p - c).Length;
        var vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) { var w = d2 / (d2 - d6); return (p - (a + ac * w)).Length; }
        var va = d3 * d6 - d5 * d4;
        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { var w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return (p - (b + (c - b) * w)).Length; }
        var denom = 1 / (va + vb + vc);
        var v2 = vb * denom; var w2 = vc * denom;
        return (p - (a + ab * v2 + ac * w2)).Length;
    }
}
