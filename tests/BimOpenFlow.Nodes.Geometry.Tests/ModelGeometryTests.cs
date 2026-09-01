using Ara3D.DataFlowEngine.TestKit;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry.Tests;

/// <summary>Exercises meshing against a real model. Skipped (not failed) when the
/// sample data folder is absent, so the suite still runs on a bare checkout.</summary>
[TestFixture]
[Category("RequiresData")]
public sealed class ModelGeometryTests
{
    public const string Duplex = "duplex.ifc";

    private static string RequirePath(string fileName)
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "data", fileName);
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }

        Assert.Ignore($"Sample model {fileName} not found under a 'data' folder.");
        return "";
    }

    [Test]
    public void Duplex_LoadsInstancesWithFiniteBounds()
    {
        var geometry = ModelGeometryCache.Load(new FilePath(RequirePath(Duplex)));

        Assert.That(geometry.Instances, Is.Not.Empty);
        Assert.That(geometry.Meshes, Is.Not.Empty);
        foreach (var inst in geometry.Instances)
        {
            Assert.That(inst.MeshId, Is.InRange(0, geometry.Meshes.Count - 1));
            Assert.That(float.IsFinite(inst.Bounds.Min.X) && float.IsFinite(inst.Bounds.Max.Z), Is.True);
            Assert.That((float)inst.Bounds.Min.X, Is.LessThanOrEqualTo((float)inst.Bounds.Max.X));
        }
    }

    [Test]
    public void Duplex_InstancesNode_ProducesConventionTable()
    {
        var path = RequirePath(Duplex);
        var result = new InstancesNode().EvalTable([], ("path", path));

        Assert.That(result.Rows, Has.Count.GreaterThan(0));
        Assert.That(result.ColumnNames(), Is.EqualTo(new[]
        {
            "instanceIndex", "meshId", "entityId", "globalId", "category",
            "minX", "minY", "minZ", "maxX", "maxY", "maxZ",
        }));
        Assert.That(result.Cell("category", 0), Is.Not.Empty);
        Assert.That(double.IsFinite((double)result.Cell("minX", 0)!), Is.True);
    }
}
