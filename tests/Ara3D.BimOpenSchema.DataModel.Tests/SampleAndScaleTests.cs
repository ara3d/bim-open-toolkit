using System.Diagnostics;
using Ara3D.BimOpenSchema.DataModel.IO;
using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure, TestFixture, Category("Stage.Stable")]
public sealed class SampleAndScaleTests
{
    public static IReadOnlyList<string> SampleNames() => ["rstadvancedsampleproject.bos", "rac_basic_sample_project-2025.bos",
        "racadvancedsampleproject.bos", "rmeadvancedsampleproject.bos", "rmebasicsampleproject.bos", "Technicalschoolcurrentm.bos",
        "Snowdon Towers Sample Architectural.bos", "snowdon-opt-geo.bos", "Snowdon-v2.bos", "サンプル意匠.bos",
        "07-004003-4200000004-AED-ARC-MDL-000001_RVT_B.bos", "Autodesk_Hospital_Metric_Architectural_Central.bos",
        "BIM_Projekt_Golden_Nugget-Architektur_und_Ingenieurbau.bos", "DRBT-NEWHOSP-AR-Central-2025.bos", "UHS-NHH_Combined_2025.bos"];

    [TestCaseSource(nameof(SampleNames)), Category("Source.LocalSample"), Category("Size.Large"), Category("Feature.Conversion")]
    public void LocalSamplesHaveReferentiallyValidQueryableSnapshots(string name)
    {
        var directory = Environment.GetEnvironmentVariable("BOS_SAMPLE_DIRECTORY");
        if (string.IsNullOrWhiteSpace(directory)) Assert.Ignore("Set BOS_SAMPLE_DIRECTORY to run local samples.");
        var path = Path.Combine(directory!, name);
        if (!File.Exists(path)) Assert.Ignore($"Sample not found: {path}");
        var timer = Stopwatch.StartNew();
        TestContext.Progress.WriteLine($"Loading {name}");
        var before = GC.GetTotalAllocatedBytes();
        var result = BimModelIO.LoadBos(path);
        var model = result.Match(m => m, issues => throw new AssertionException(string.Join("; ", issues.Select(i => i.Message))));
        var tables = model.Tables;
        TestContext.Progress.WriteLine($"{name}: entities={tables.Entities.Length}, properties={tables.Properties.Length}, instances={tables.Instances.Length}, " +
            $"geometry={tables.Geometry.Length}, issues={tables.Issues.Length}, elapsed={timer.Elapsed.TotalSeconds:F2}s, allocated={(GC.GetTotalAllocatedBytes() - before) / 1048576}MiB; " +
            string.Join(",", tables.Issues.GroupBy(i => i.Code).Select(g => $"{g.Key}={g.Count()}")));
        Assert.That(tables.Properties.All(p => p.EntityId < tables.Entities.Length), Is.True);
        Assert.That(tables.Edges.All(e => e.SourceId < tables.Entities.Length && e.TargetId < tables.Entities.Length), Is.True);
        if (name == "snowdon-opt-geo.bos") Assert.That(tables.Issues.Any(i => i.Code == "InvalidGeometryInstance"), Is.True);
        else Assert.That(tables.Entities.Length, Is.GreaterThan(0));
        foreach (var row in tables.Geometry.Take(10)) Assert.That(model.Spatial.Intersect(row.Bounds), Does.Contain(row.EntityId));
    }

    [Test, Category("Source.Synthetic"), Category("Size.Large"), Category("Feature.Graph"), Category("Feature.Properties")]
    public void HundredThousandEntityChainUsesIndexedQueries()
    {
        const int count = 100000;
        var data = new BimData { Strings = ["Value"], Documents = [new((StringIndex)(-1), (StringIndex)(-1))],
            Entities = new Entity[count], Parameters = new Parameter[count], Relations = new EntityRelation[count - 1],
            Descriptors = [new((StringIndex)0, (StringIndex)(-1), (StringIndex)(-1), ParameterType.Int)] };
        for (var i = 0; i < count; i++)
        {
            data.Entities[i] = Fixtures.Entity(i);
            data.Parameters[i] = new((EntityIndex)i, (DescriptorIndex)0, i);
            if (i > 0) data.Relations[i - 1] = new((EntityIndex)(i - 1), (EntityIndex)i, RelationType.PartOf);
        }
        var timer = Stopwatch.StartNew();
        var model = Fixtures.Model(data);
        Assert.That(model.Graph.Reachable(0, "PartOf").Length, Is.EqualTo(count - 1));
        Assert.That(model.Graph.ShortestPath(0, count - 1, "PartOf").Length, Is.EqualTo(count));
        for (var i = 0; i < count; i += 100) Assert.That(model.PropertiesOf(i)[0].IntegerValue, Is.EqualTo(i));
        Assert.That(model.Tables.Issues, Is.Empty);
        TestContext.Progress.WriteLine($"100k conversion + graph traversal + queries: {timer.Elapsed.TotalSeconds:F2}s");
    }
}
