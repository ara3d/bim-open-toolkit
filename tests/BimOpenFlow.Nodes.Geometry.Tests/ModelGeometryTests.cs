using Ara3D.Utils;
using static BimOpenFlow.Nodes.Geometry.Tests.TestSupport;

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
        var result = OutputTable(new InstancesNode(), [], Params(("path", path)));

        Assert.That(result.Rows, Has.Count.GreaterThan(0));
        Assert.That(ColumnNames(result), Is.EqualTo(new[]
        {
            "instanceIndex", "meshId", "entityId", "globalId", "category",
            "minX", "minY", "minZ", "maxX", "maxY", "maxZ",
        }));
        Assert.That(Cell(result, "category", 0), Is.Not.Empty);
        Assert.That(double.IsFinite((double)Cell(result, "minX", 0)), Is.True);
    }
}
