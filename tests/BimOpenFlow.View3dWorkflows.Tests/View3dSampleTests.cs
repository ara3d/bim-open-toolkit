using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using BimOpenFlow.Nodes.Bos;
using BimOpenFlow.Nodes.Geometry;

namespace BimOpenFlow.View3dWorkflows.Tests;

// TODO: register this project in BimOpenToolkit.sln once the concurrent BimAnalysis wave's
// solution edits land (the sln is mid-edit by that wave; run it via the csproj path meanwhile).

/// <summary>
/// Every committed view3d sample (samples/view3d-analyses/*.json) parses,
/// validates against the Bos + Geometry packs, and evaluates all-green over
/// data/duplex.ifc ({DATA} rewritten to the repo data directory). One shared
/// session per fixture: the meshed model is cached process-wide, so the IFC
/// is meshed once for all samples.
/// </summary>
[TestFixture]
public sealed class View3dSampleTests
{
    private static readonly NodeRegistry Registry = NodeRegistry.Combine(BosNodes.All, GeometryNodes.All);

    public static IEnumerable<TestCaseData> SampleFiles
        => Directory.EnumerateFiles(AnalysesDir, "*.json")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetArgDisplayNames(Path.GetFileNameWithoutExtension(f)));

    [Test]
    public void ThereAreSampleAnalyses()
        => Assert.That(SampleFiles.Count(), Is.GreaterThanOrEqualTo(6));

    [TestCaseSource(nameof(SampleFiles))]
    public void ParsesAndValidates(string file)
    {
        var doc = Load(file);
        Assert.That(doc.Nodes, Is.Not.Empty);
        Assert.That(doc.Validate(Registry), Is.Empty);
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void Evaluates_EveryNodeOk(string file)
    {
        var snapshot = Evaluate(file).Snapshot;
        var failed = snapshot.Results
            .Where(r => r.Value.Status != NodeStatus.Ok)
            .Select(r => $"{r.Key}: {r.Value.Status} {r.Value.Error}")
            .ToList();
        Assert.That(failed, Is.Empty, $"Nodes not Ok in {Path.GetFileName(file)}");
    }

    [Test]
    public void ColorByCategory_AppendsColorColumns()
    {
        var table = OutputTable(Evaluate(Sample("color-by-category")), "colored", "instances");
        Assert.That(table.Columns.Select(c => c.Descriptor.Name),
            Is.SupersetOf(new[] { "r", "g", "b", "a" }));
        Assert.That(table.Rows.Count, Is.GreaterThan(0));
    }

    [Test]
    public void MassingBoxes_OneBoxPerCategory()
    {
        var session = Evaluate(Sample("massing-boxes"));
        var boxes = OutputTable(session,"boxes", "boxes");
        var instances = OutputTable(session,"inst", "instances");
        var categories = Enumerable.Range(0, instances.Rows.Count)
            .Select(r => instances[CategoryColumn(instances), r]?.ToString())
            .Distinct().Count();
        Assert.That(boxes.Rows.Count, Is.EqualTo(categories));
    }

    [Test]
    public void VoxelDensity_EmitsColoredVoxels()
    {
        var table = OutputTable(Evaluate(Sample("voxel-density")), "colored", "instances");
        Assert.That(table.Rows.Count, Is.GreaterThan(0));
        Assert.That(table.Columns.Select(c => c.Descriptor.Name),
            Is.SupersetOf(new[] { "voxelId", "count", "r", "g", "b", "a" }));
    }

    [Test]
    public void DecimateOverview_ReducesInstanceCount()
    {
        var session = Evaluate(Sample("decimate-overview"));
        var all = OutputTable(session,"inst", "instances").Rows.Count;
        var kept = OutputTable(session,"big", "instances").Rows.Count;
        Assert.That(kept, Is.GreaterThan(0));
        Assert.That(kept, Is.LessThan(all));
    }

    private static int CategoryColumn(IDataTable table)
        => table.Columns.Single(c => c.Descriptor.Name == "category").ColumnIndex;

    private static string AnalysesDir
        => Path.Combine(RepoRoot, "samples", "view3d-analyses");

    private static string Sample(string id)
        => Path.Combine(AnalysesDir, id + ".json");

    private static string RepoRoot { get; } = FindRepoRoot();

    private static string FindRepoRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
            if (Directory.Exists(Path.Combine(dir.FullName, "samples", "view3d-analyses")))
                return dir.FullName;
        throw new DirectoryNotFoundException(
            $"No samples/view3d-analyses directory found above '{AppContext.BaseDirectory}'.");
    }

    /// <summary>Loads the document with {DATA} rewritten to the repo data directory.</summary>
    private static GraphDocument Load(string file)
    {
        var data = Path.Combine(RepoRoot, "data").Replace('\\', '/');
        var temp = Path.Combine(Path.GetTempPath(), "bof-view3d-samples",
            Guid.NewGuid().ToString("N") + ".json");
        Directory.CreateDirectory(Path.GetDirectoryName(temp)!);
        File.WriteAllText(temp, File.ReadAllText(file).Replace("{DATA}", data));
        try
        {
            return GraphDocumentIO.Load(temp);
        }
        finally
        {
            File.Delete(temp);
        }
    }

    private static FlowTestSession Evaluate(string file)
    {
        var session = new FlowTestSession(Registry);
        session.Evaluate(Load(file));
        return session;
    }

    private static IDataTable OutputTable(FlowTestSession session, string nodeId, string port)
        => ((TableValue)session.Output(nodeId, port)).Table;
}
