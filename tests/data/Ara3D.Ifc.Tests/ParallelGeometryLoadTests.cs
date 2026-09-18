using Ara3D.IfcLoader;
using Ara3D.Utils;

namespace Ara3D.Ifc.Tests;

/// <summary>web-ifc is not safe to drive from two threads at once; the loader serializes
/// native parsing and mesh reads behind <see cref="WebIfcDll.Gate"/>. Without the gate this
/// test took the process down with an access violation on the host.</summary>
[TestFixture]
public static class ParallelGeometryLoadTests
{
    [Test]
    [Category("Slow")]
    public static void TwoGeometryLoadsAtOnce_BothComplete()
    {
        var path = new FilePath(TestData.DuplexIfc);
        if (!path.Exists())
            Assert.Ignore($"{path} not present; run data/get-test-data.ps1");
        var counts = Enumerable.Range(0, 2)
            .AsParallel()
            .WithDegreeOfParallelism(2)
            .Select(_ =>
            {
                using var file = IfcFile.Load(path, includeGeometry: true);
                return file.ToModel3D().Meshes.Count;
            })
            .ToList();
        Assert.That(counts, Has.All.GreaterThan(0));
        Assert.That(counts[0], Is.EqualTo(counts[1]));
    }
}
