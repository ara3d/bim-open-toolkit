using System.Diagnostics;
using System.Globalization;
using Ara3D.IO.StepParser;
using Ara3D.Step.Decode;
using Ara3D.Step.Entities;
using Ara3D.Step.Mesher;
using Ara3D.Step.Mesher.Plato;
using Ara3D.StepBrep;
using Ara3D.Utils;
using PlaneSweep;

// plane-sweep <file.step> <out.csv> [--all]
// Times, for every plane face meshed by triangles, the stages of the plane path (region, chart, collisions, grid
// test, CDT, lift, and MeshFace whole) and the sweep triangulation on the same chart points, with the gate checks
// and the quality measures of both. One row per face; a summary at the end.
if (args[0] == "--replay")
{
    // --replay <dump.txt>: run the sweep on a dumped face with tracing.
    var lines = File.ReadAllLines(args[1]);
    var rn = lines.Length;
    var rx = new double[rn]; var ry = new double[rn]; var rnext = new int[rn];
    for (var k = 0; k < rn; k++)
    {
        var parts = lines[k].Split(' ');
        rx[k] = double.Parse(parts[0], CultureInfo.InvariantCulture);
        ry[k] = double.Parse(parts[1], CultureInfo.InvariantCulture);
        rnext[k] = int.Parse(parts[2]);
    }
    var tris = Sweep.Triangulate(rx, ry, rnext, out var rwhy, out var rdiag, Console.Out);
    Console.WriteLine(tris is null ? $"FAILED: {rwhy}" : $"ok: {tris.Length / 3} triangles, {rdiag} diagonals, gate '{Gate.Check(rx, ry, rnext, tris, 0)}'");
    return;
}
var file = args[0];
var outCsv = args[1];
var dumpDir = Environment.GetEnvironmentVariable("PLANESWEEP_DUMP");
var chordal = new StepMeshingOptions().ChordalMillimetres;
var sw = Stopwatch.StartNew();
var model = new StepModel(new StepDocument(new FilePath(file)));
var raw = model.DecodeRaw();
var m = raw.PrepareModel().Model;
Console.Error.WriteLine($"loaded {Path.GetFileName(file)}: {m.Faces.Count} faces, {m.Edges.Count} edges in {sw.ElapsedMilliseconds} ms");
var options = StepPlatoMesher.Options(chordal);
var criteria = options.Face;
var tables = StepPlatoTables.Of(m);
var edgeRows = new EdgeDiscretization[m.Edges.Count];
Parallel.For(0, m.Edges.Count, i =>
{
    var e = new BrepEdgeIndex(i);
    try { edgeRows[i] = tables.Discretized(m, e, criteria.Discretization); }
    catch { edgeRows[i] = e.Undiscretized(); }
});
var d = new EdgeDiscretizations(edgeRows);
var tolLength = (double)m.Tolerances.Length.Value;

const int Reps = 3;
static double Ms(long start) => Stopwatch.GetElapsedTime(start).TotalMilliseconds;

var rows = new List<string>();
var header = "face,loops,points,holes3,regionMs,chartMs,collideMs,gridMs,cdtMs,liftMs,meshFaceMs,cdtTris,cdtMinAngle,cdtSlivers,cdtMinAlt,cdtGate,sweepMs,sweepTotalMs,sweepTris,sweepMinAngle,sweepSlivers,sweepMinAlt,sweepGate,sweepWhy,diagonals,flipsAfterSweepMs,tolLength,seedMs,flippedSlivers,flippedMinAngle,flippedGate";
double sumCdt = 0, sumSweep = 0, sumMeshFace = 0;
int faces = 0, fallbacks = 0, gateFails = 0;
var ci = CultureInfo.InvariantCulture;

for (var pass = 0; pass < 2; pass++)
{
    // Pass 0 warms the JIT on every face; pass 1 records.
    for (var i = 0; i < m.Faces.Count; i++)
    {
        var f = new BrepFaceIndex(i);
        if (!(bool)m.IsPlaneFace(f)) continue;
        if (!(bool)tables.IsDiscretized(m, f, d)) continue;
        try
        {
            var t0 = Stopwatch.GetTimestamp();
            var whole = m.MeshFace(f, d, criteria);
            var meshFaceMs = Ms(t0);
            if (whole.Mesh.Quads.Count > 0 || whole.Mesh.Triangles.Count == 0) continue;
            t0 = Stopwatch.GetTimestamp();
            var dom = m.SurfaceDomainOf(f);
            var rawRegion = m.UnorientedRegionOfIn(f, dom, d, criteria);
            var r = m.OrientRegion(f, rawRegion);
            var regionMs = Ms(t0);
            t0 = Stopwatch.GetTimestamp();
            var chart = m.ChartOf(f, r);
            var chartMs = Ms(t0);
            t0 = Stopwatch.GetTimestamp();
            var tol = m.RegionToleranceIn(f, dom, chart);
            var flags = r.CollidingSegments(tol);
            var collideMs = Ms(t0);
            if (Enumerable.Any(flags, x => (bool)x)) continue;
            t0 = Stopwatch.GetTimestamp();
            var grid = m.FaceQuadGridIn(f, d, r, tol, criteria);
            var gridMs = Ms(t0);
            // The CDT and its seed, best of Reps runs each (the machine is shared).
            var cdt = r.TriangulateRegionCdt(chart);
            var cdtMs = double.MaxValue;
            for (var rep = 0; rep < Reps; rep++) { t0 = Stopwatch.GetTimestamp(); cdt = r.TriangulateRegionCdt(chart); cdtMs = Math.Min(cdtMs, Ms(t0)); }
            var chartPtsAll = new Point2D[r.BoundaryPoints().Count];
            for (var k = 0; k < chartPtsAll.Length; k++) chartPtsAll[k] = chart.ChartPoint(r.BoundaryPoints()[k]);
            var seedMs = double.MaxValue;
            for (var rep = 0; rep < Reps; rep++) { t0 = Stopwatch.GetTimestamp(); r.CdtSeedOfRegionOverCopies(chartPtsAll); seedMs = Math.Min(seedMs, Ms(t0)); }
            t0 = Stopwatch.GetTimestamp();
            var lifted = m.Lift(f, d, cdt);
            var liftMs = Ms(t0);

            // The same input the CDT takes: the boundary points in the chart and the next table.
            var pts = r.BoundaryPoints();
            var n = pts.Count;
            var xs = new double[n];
            var ys = new double[n];
            for (var k = 0; k < n; k++)
            {
                var p = chart.ChartPoint(pts[k]);
                xs[k] = (double)p.X;
                ys[k] = (double)p.Y;
            }
            var nextTable = r.NextBoundaryTable();
            var next = new int[n];
            for (var k = 0; k < n; k++) next[k] = (int)nextTable[k];
            var holes3 = 0;
            foreach (var h in r.Holes) if (h.Points.Count >= 3) holes3++;

            var cdtTris = new int[cdt.Triangles.Count * 3];
            for (var k = 0; k < cdt.Triangles.Count; k++)
            {
                cdtTris[3 * k] = (int)cdt.Triangles[k].A.Value;
                cdtTris[3 * k + 1] = (int)cdt.Triangles[k].B.Value;
                cdtTris[3 * k + 2] = (int)cdt.Triangles[k].C.Value;
            }
            var cdtQ = Quality.Of(xs, ys, cdtTris);
            var cdtGate = Gate.Check(xs, ys, next, cdtTris, holes3);

            var sweepTris = Sweep.Triangulate(xs, ys, next, out var why, out var diagonals);
            var sweepMs = double.MaxValue;
            for (var rep = 0; rep < Reps; rep++) { t0 = Stopwatch.GetTimestamp(); Sweep.Triangulate(xs, ys, next, out _, out _); sweepMs = Math.Min(sweepMs, Ms(t0)); }
            t0 = Stopwatch.GetTimestamp();
            var sweepGate = sweepTris is null ? "fallback" : Gate.Check(xs, ys, next, sweepTris, holes3);
            var sweepTotalMs = Ms(t0);
            var sweepQ = sweepTris is null ? new Quality(0, 0, 0, 0, 0) : Quality.Of(xs, ys, sweepTris);
            double flipsMs = 0;
            var flippedQ = new Quality(0, 0, 0, 0, 0);
            var flippedGate = "";
            if (sweepTris is not null && sweepGate == "")
            {
                var seed = new TriangleFace[sweepTris.Length / 3];
                for (var k = 0; k < seed.Length; k++)
                    seed[k] = new TriangleFace(new VertexIndex(sweepTris[3 * k]), new VertexIndex(sweepTris[3 * k + 1]), new VertexIndex(sweepTris[3 * k + 2]));
                var chartPts = new Point2D[n];
                for (var k = 0; k < n; k++) chartPts[k] = chart.ChartPoint(pts[k]);
                var flipped = nextTable.DelaunayedIndexed(chartPts, seed);
                flipsMs = double.MaxValue;
                for (var rep = 0; rep < Reps; rep++) { t0 = Stopwatch.GetTimestamp(); nextTable.DelaunayedIndexed(chartPts, seed); flipsMs = Math.Min(flipsMs, Ms(t0)); }
                var ft = new int[flipped.Count * 3];
                for (var k = 0; k < flipped.Count; k++) { ft[3 * k] = (int)flipped[k].A.Value; ft[3 * k + 1] = (int)flipped[k].B.Value; ft[3 * k + 2] = (int)flipped[k].C.Value; }
                flippedQ = Quality.Of(xs, ys, ft);
                flippedGate = Gate.Check(xs, ys, next, ft, holes3);
            }
            if (pass == 0) continue;
            if (dumpDir is not null && (sweepTris is null || sweepGate != ""))
                File.WriteAllLines(Path.Combine(dumpDir, $"{Path.GetFileNameWithoutExtension(file)}-{i}.txt"),
                    Enumerable.Range(0, n).Select(k => $"{xs[k].ToString("R", ci)} {ys[k].ToString("R", ci)} {next[k]}"));
            faces++;
            sumCdt += cdtMs; sumSweep += sweepTotalMs; sumMeshFace += meshFaceMs;
            if (sweepTris is null) fallbacks++;
            else if (sweepGate != "") gateFails++;
            rows.Add(string.Join(',', new[]
            {
                i.ToString(), m.Faces[i].Bounds.Count.ToString(), n.ToString(), holes3.ToString(),
                regionMs.ToString("F3", ci), chartMs.ToString("F3", ci), collideMs.ToString("F3", ci), gridMs.ToString("F3", ci),
                cdtMs.ToString("F3", ci), liftMs.ToString("F3", ci), meshFaceMs.ToString("F3", ci),
                cdtQ.Triangles.ToString(), cdtQ.MinAngleDeg.ToString("G4", ci), cdtQ.Slivers.ToString(), cdtQ.MinAltitude.ToString("G4", ci), Quote(cdtGate),
                sweepMs.ToString("F3", ci), sweepTotalMs.ToString("F3", ci),
                sweepQ.Triangles.ToString(), sweepQ.MinAngleDeg.ToString("G4", ci), sweepQ.Slivers.ToString(), sweepQ.MinAltitude.ToString("G4", ci), Quote(sweepGate), Quote(why),
                diagonals.ToString(), flipsMs.ToString("F3", ci), tolLength.ToString("G4", ci),
                seedMs.ToString("F3", ci), flippedQ.Slivers.ToString(), flippedQ.MinAngleDeg.ToString("G4", ci), Quote(flippedGate),
            }));
        }
        catch (Exception ex)
        {
            if (pass == 1) rows.Add($"{i},,,,,,,,,,,,,,,threw,,,,,,,threw,{Quote(ex.GetType().Name + ": " + ex.Message)},,,");
        }
    }
}
File.WriteAllLines(outCsv, new[] { header }.Concat(rows));
Console.WriteLine($"{Path.GetFileName(file)}: plane triangle faces {faces}, cdt {sumCdt:F1} ms, sweep+gate {sumSweep:F1} ms, meshface {sumMeshFace:F1} ms, fallbacks {fallbacks}, gate fails {gateFails}");

static string Quote(string s) => "\"" + s.Replace("\"", "'") + "\"";
