using Ara3D.IO.StepParser;
using Ara3D.Step.Decode;
using Ara3D.Step.Entities;
using Ara3D.Utils;
using System.Diagnostics;
using System.Globalization;
using Ara3D.Step.CorpusHarness;
using Ara3D.Step.TrimBand;
using Ara3D.StepBrep;

// TKT-490: trim-band-measure <file.step> <out prefix> [--top N] [--reps R] [--kinds a,b] [--faces i,j] [--parallel]
// Meshes the file the host's way (the harness's timed path), takes the curved faces that took the CDT path, and on each
// runs today's MeshFace and the band path back to back R times, keeping the least time of each. Writes
// <prefix>.band.csv (one row per face) and prints a summary per surface kind.
var top = 400; var reps = 3; double? chordalArg = null; string[]? kinds = null; HashSet<int>? only = null; var parallel = true;
var rest = new List<string>();
for (var i = 0; i < args.Length; i++)
{
    switch (args[i])
    {
        case "--top": top = int.Parse(args[++i]); break;
        case "--reps": reps = int.Parse(args[++i]); break;
        case "--kinds": kinds = args[++i].Split(','); break;
        case "--faces": only = args[++i].Split(',').Select(int.Parse).ToHashSet(); break;
        case "--sequential": parallel = false; break;
        case "--chordal": chordalArg = double.Parse(args[++i], CultureInfo.InvariantCulture); break;
        default: rest.Add(args[i]); break;
    }
}
if (rest.Count != 2) { Console.Error.WriteLine("trim-band-measure <file.step> <out prefix> [--top N] [--reps R] [--kinds a,b] [--faces i,j]"); return 2; }
var (file, prefix) = (rest[0], rest[1]);
var inv = CultureInfo.InvariantCulture;

var m = new StepModel(new StepDocument(new FilePath(file))).DecodeRaw().PrepareModel().Model;
var timed = TimedMesh.RunModel(file, m, MeshPath.HostName, parallel, 0, 0, 0, TimedMesh.ChordalMillimetres);
var d = new EdgeDiscretizations(timed.EdgeRows.Select(e => e.Discretization).ToArray());
var options = Ara3D.Step.Mesher.Plato.StepPlatoMesher.Options(TimedMesh.ChordalMillimetres);
var c = options.Face;
var chordal = (double)c.SurfaceChordal;
var bound = chordal + (double)m.Tolerances.Length.Value;

var candidates = timed.FaceRows
    .Where(r => r.Path == "cdt" && r.Surface != "plane" && r.Exception == "" && r.Outcome.Mesh.Triangles.Count > 0)
    .Where(r => kinds is null || kinds.Contains(r.Surface))
    .Where(r => only is null || only.Contains(r.Index))
    .OrderByDescending(r => r.Ms).Take(top).ToArray();
foreach (var g in timed.FaceRows.GroupBy(r => (r.Surface, r.Path)).OrderByDescending(g => g.Count()))
    Console.WriteLine($"  {g.Key.Surface} {g.Key.Path}: {g.Count()} faces, {g.Sum(r => r.Ms):F0} ms");
Console.WriteLine($"{file}: {timed.Faces} faces, {timed.FaceRows.Count(r => r.Surface != "plane" && r.Path == "cdt")} curved cdt faces, measuring {candidates.Length}");

var dense = BandMesh.Lattice(6);
double Deviation(FaceMesh fm)
{
    var f = fm.Face;
    var s = m.SurfaceOf(f);
    var worst = 0.0;
    P At(int i) => P.Of(fm.Positions[(int)fm.LocalVertex[i].Value]);
    void Tri(int a, int b, int cc)
    {
        var pa = At(a); var pb = At(b); var pc = At(cc);
        var ua = fm.UvPoints[a]; var ub = fm.UvPoints[b]; var uc = fm.UvPoints[cc];
        foreach (var (x, y, z) in dense)
        {
            var uv = new UvCoordinate(x * (double)ua.U + y * (double)ub.U + z * (double)uc.U, x * (double)ua.V + y * (double)ub.V + z * (double)uc.V);
            worst = Math.Max(worst, P.DistanceToTriangle(P.Of(m.Geometry.Eval(s, uv)), pa, pb, pc));
        }
    }
    foreach (var t in fm.Triangles) Tri((int)t.A.Value, (int)t.B.Value, (int)t.C.Value);
    foreach (var q in fm.Quads)
    {
        int a = (int)q.A.Value, b = (int)q.B.Value, cc = (int)q.C.Value, dd = (int)q.D.Value;
        Tri(a, b, cc); Tri(a, cc, dd); Tri(a, b, dd); Tri(b, cc, dd);
    }
    return worst;
}
string Contract(FaceRow row)
{
    var check = ContractCheck.Of(m, [row], chordal, false);
    return check.Holds ? "holds" : string.Join('+', new[] { check.OverChordal > 0 ? "over-chordal" : "", check.WithFlipped > 0 ? "flipped" : "", check.WithDegenerate > 0 ? "degenerate" : "" }.Where(x => x != ""));
}

using var csv = new StreamWriter(prefix + ".band.csv");
csv.WriteLine("face,surface,loops,edges,boundary_points,today_triangles,today_ms,band_ms,speedup,status,nu,nv,interior_cells,band_cells,outside_cells,ring_points,refinement_points,interior_nodes,band_share,quads,cell_triangles,band_triangles,elements,element_ratio,today_deviation,band_deviation,today_contract,band_contract,watertight,area_gap,halvings,sizing_ms,classify_ms,cdt_ms,refine_ms,combine_ms,lift_ms");
var rows = new List<(string Surface, string Status, double TodayMs, double BandMs, int TodayTriangles, int Elements, double TodayDev, double BandDev, bool Ok)>();
foreach (var row in candidates)
{
    var f = new BrepFaceIndex(row.Index);
    double todayMs = double.MaxValue, bandMs = double.MaxValue;
    FaceMeshOutcome today = default; BandResult? band = null; string error = "";
    try
    {
        m.MeshFace(f, d, c); BandMesh.Run(m, f, d, c);
        for (var k = 0; k < reps; k++)
        {
            var t0 = Stopwatch.GetTimestamp();
            today = m.MeshFace(f, d, c);
            todayMs = Math.Min(todayMs, Clock.Since(t0));
            var t1 = Stopwatch.GetTimestamp();
            band = BandMesh.Run(m, f, d, c);
            bandMs = Math.Min(bandMs, Clock.Since(t1));
        }
    }
    catch (Exception ex)
    {
        error = ex.GetType().Name + ": " + ex.Message.Replace('\n', ' ').Replace(',', ';');
    }
    if (band is null)
    {
        csv.WriteLine($"{row.Index},{row.Surface},{row.Loops},{row.Edges},,{row.Triangles},,,,threw {error}");
        rows.Add((row.Surface, "threw", 0, 0, row.Triangles, 0, 0, 0, false));
        continue;
    }
    var todayDev = Deviation(today.Mesh);
    var bandDev = band.Mesh is null ? double.NaN : Deviation(band.Mesh.Value);
    var todayContract = Contract(row);
    var bandContract = band.Mesh is null ? "" : Contract(row with { Outcome = new FaceMeshOutcome(band.Mesh.Value, Array.Empty<EdgeRefinementRequest>(), Array.Empty<Diagnostic>()) });
    var ok = band.Status == "ok" && band.Watertight && bandContract == "holds";
    csv.WriteLine(string.Join(',',
        row.Index, row.Surface, row.Loops, row.Edges, band.BoundaryPoints, today.Mesh.Triangles.Count, todayMs.ToString("F3", inv), bandMs.ToString("F3", inv),
        (todayMs / bandMs).ToString("F2", inv), band.Status, band.Nu, band.Nv, band.InteriorCells, band.BandCells, band.OutsideCells, band.RingPoints,
        band.RefinementPoints, band.InteriorNodes, band.BandShare.ToString("F3", inv), band.Quads, band.CellTriangles, band.BandTriangles, band.Elements,
        ((double)band.Elements / Math.Max(1, today.Mesh.Triangles.Count)).ToString("F2", inv), todayDev.ToString("G5", inv), bandDev.ToString("G5", inv),
        todayContract, bandContract, band.Watertight, band.AreaGap.ToString("G3", inv), band.Halvings, band.SizingMs.ToString("F3", inv),
        band.ClassifyMs.ToString("F3", inv), band.CdtMs.ToString("F3", inv), band.RefineMs.ToString("F3", inv), band.CombineMs.ToString("F3", inv), band.LiftMs.ToString("F3", inv)));
    rows.Add((row.Surface, band.Status, todayMs, bandMs, today.Mesh.Triangles.Count, band.Elements, todayDev, bandDev, ok));
}

Console.WriteLine($"bound {bound:F4} (chordal {chordal:F4})");
Console.WriteLine("surface,faces,ok,aside,today_ms,band_ms,speedup_ok_faces,today_triangles,band_elements,ratio,worst_today_dev,worst_band_dev");
foreach (var g in rows.GroupBy(r => r.Surface).OrderByDescending(g => g.Sum(r => r.TodayMs)))
{
    var okRows = g.Where(r => r.Ok).ToArray();
    Console.WriteLine(string.Join(',', g.Key, g.Count(), okRows.Length, g.Count(r => r.Status != "ok"),
        g.Sum(r => r.TodayMs).ToString("F1", inv), g.Sum(r => r.BandMs).ToString("F1", inv),
        okRows.Length == 0 ? "" : (okRows.Sum(r => r.TodayMs) / okRows.Sum(r => r.BandMs)).ToString("F2", inv),
        okRows.Sum(r => r.TodayTriangles), okRows.Sum(r => r.Elements),
        okRows.Length == 0 ? "" : ((double)okRows.Sum(r => r.Elements) / Math.Max(1, okRows.Sum(r => r.TodayTriangles))).ToString("F2", inv),
        g.Max(r => r.TodayDev).ToString("G4", inv), okRows.Length == 0 ? "" : okRows.Max(r => r.BandDev).ToString("G4", inv)));
}
foreach (var g in rows.Where(r => r.Status != "ok").GroupBy(r => r.Status.Split(' ')[0]))
    Console.WriteLine($"aside {g.Key}: {g.Count()}");
return 0;
