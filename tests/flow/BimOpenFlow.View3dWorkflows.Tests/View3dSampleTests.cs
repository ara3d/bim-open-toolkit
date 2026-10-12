using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.DataTable;
using Ara3D.NodeGraph;
using BimOpenFlow.Nodes.Bos;
using BimOpenFlow.Nodes.TableOps;
using BimOpenFlow.Nodes.Geometry;
using BimOpenFlow.Nodes.Spatial;
using BimOpenFlow.Nodes.Viz;
using BimOpenFlow.Nodes.Value;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.View3dWorkflows.Tests;

/// <summary>
/// Every committed view3d sample (samples/view3d-analyses/*.json) parses,
/// validates against the Bos, TableOps, Geometry, Spatial, Viz and Value packs, and evaluates all-green
/// over the committed samples/nrc/duplex-base.ifc ({SAMPLES} rewritten to samples/nrc). One shared
/// session per fixture: the meshed model is cached process-wide, so the IFC
/// is meshed once for all samples.
/// </summary>
[TestFixture]
public sealed class View3dSampleTests
{
    private static readonly NodeRegistry Registry = NodeRegistry.Combine(BosNodes.All, TableOpsNodes.All, GeometryNodes.All, SpatialNodes.All, VizNodes.All, ValueNodes.All);

    public static IEnumerable<TestCaseData> SampleFiles
        => Directory.EnumerateFiles(AnalysesDir, "*.json")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetArgDisplayNames(Path.GetFileNameWithoutExtension(f)));

    [Test]
    public void ThereAreSampleAnalyses()
        => Assert.That(SampleFiles.Count(), Is.GreaterThanOrEqualTo(6));

    [Test]
    public void SnowdonToolkitGraph_ComposesEveryRecipeWithoutReadingPrivateModelBytes()
    {
        var path = RepoPaths.Samples("snowdon-analyses", "snowdon-toolkit.json");
        var doc = Load(path);
        Assert.That(doc.Validate(Registry), Is.Empty);
        var session = Evaluate(path);
        Assert.That(session.Snapshot.Results.Values.All(r => r.Status == NodeStatus.Ok), Is.True);
        var plan = OutputTable(session, "plan", "view");
        Assert.That(plan.Rows.Count, Is.EqualTo(4));
        Assert.That(plan[0, 0], Is.EqualTo("scene"));
        Assert.That(plan[0, 3], Is.EqualTo("projection"));
    }

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
        var kept = OutputTable(session,"largest", "instances").Rows.Count;
        Assert.That(kept, Is.GreaterThan(0));
        Assert.That(kept, Is.LessThan(all));
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void DeclaresAModelInputAndANote(string file)
    {
        var doc = Load(file);
        Assert.That(doc.Inputs.Select(i => i.Name), Does.Contain("model"));
        Assert.That(doc.Nodes.Any(n => n.Id == "about" && n.Kind == "view.note"), Is.True);
    }

    [Test]
    public void SharedColorLegend_ScaleClampsNothingAndBarsHaveDistinctLabels()
    {
        var session = Evaluate(Sample("shared-color-legend"));
        var legend = OutputTable(session, "scale", "legend");
        var roles = Column(legend, "role").Select(v => v?.ToString()).ToList();
        Assert.That(roles, Has.None.EqualTo("above").And.None.EqualTo("below"));
        var bars = Column(OutputTable(session, "chart", "table"), "element").Select(v => v?.ToString()).ToList();
        Assert.That(bars, Has.Count.EqualTo(20));
        Assert.That(bars, Is.Unique);
        Assert.That(bars, Has.None.StartsWith("IFCSPACE"));
    }

    [Test]
    public void GhostContext_KeepsEveryWallClassOpaque()
    {
        var session = Evaluate(Sample("ghost-context"));
        var walls = Column(OutputTable(session, "walls", "table"), "category").Select(v => v?.ToString()).Distinct();
        Assert.That(walls, Is.EquivalentTo(new[] { "IFCWALL", "IFCWALLSTANDARDCASE" }));
    }

    [Test]
    public void ClashCandidates_CountsOnlyOverlappingSolids()
    {
        var session = Evaluate(Sample("clash-candidates"));
        Assert.That(Column(OutputTable(session, "clashes", "table"), "OverlapVolume").Select(Convert.ToDouble),
            Has.All.GreaterThan(0.0));
        Assert.That(Column(OutputTable(session, "solids", "table"), "category").Select(v => v?.ToString()),
            Has.None.EqualTo("IFCSPACE").And.None.EqualTo("IFCOPENINGELEMENT"));
    }

    [Test]
    public void ColorByCategory_FoldsCategoriesIntoAtMostTenGroups()
    {
        var groups = Column(OutputTable(Evaluate(Sample("color-by-category")), "groups", "table"), "group")
            .Select(v => v?.ToString()).Distinct().ToList();
        Assert.That(groups, Has.Count.InRange(1, 10));
    }

    [Test]
    public void MassingBoxes_ColoursEachBoxByLabel()
    {
        var table = OutputTable(Evaluate(Sample("massing-boxes")), "colored", "instances");
        Assert.That(table.Columns.Select(c => c.Descriptor.Name),
            Is.SupersetOf(new[] { "label", "r", "g", "b", "a" }));
    }

    private static IEnumerable<object?> Column(IDataTable table, string name)
    {
        var col = table.Columns.Single(c => c.Descriptor.Name == name).ColumnIndex;
        return Enumerable.Range(0, table.Rows.Count).Select(r => table[col, r]);
    }

    private static int CategoryColumn(IDataTable table)
        => table.Columns.Single(c => c.Descriptor.Name == "category").ColumnIndex;

    private static string AnalysesDir
        => RepoPaths.Samples("view3d-analyses");

    private static string Sample(string id)
        => Path.Combine(AnalysesDir, id + ".json");

    /// <summary>Loads the document with {SAMPLES} rewritten to samples/nrc, as BimSampleSeeding does.</summary>
    private static GraphDocument Load(string file)
    {
        var nrc = RepoPaths.Samples("nrc").Replace('\\', '/');
        var temp = Path.Combine(Path.GetTempPath(), "bof-view3d-samples",
            Guid.NewGuid().ToString("N") + ".json");
        Directory.CreateDirectory(Path.GetDirectoryName(temp)!);
        File.WriteAllText(temp, File.ReadAllText(file).Replace("{SAMPLES}", nrc));
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
