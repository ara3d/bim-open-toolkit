using Ara3D.IfcLoader;
using Ara3D.Utils;

namespace Ara3D.Ifc.Tests;

/// <summary>The IFC to Model3D conversion emits only drawable instances: every transform
/// component finite and every mesh index valid. web-ifc yields zero-vertex meshes whose
/// transform holds +Infinity for Duplex; one such instance used to break every consumer of
/// the transform table ("Invalid BFAST transform" in the 3D pane).</summary>
[TestFixture]
public sealed class IfcToModelTests
{
    [Test]
    public void Duplex_EveryInstanceIsFiniteAndReferencesAMesh()
    {
        TestData.RequireTestKit();
        using var file = new IfcFile(new FilePath(TestData.DuplexIfc), includeGeometry: true);
        var model = file.ToModel3D((0, 0, 0));

        Assert.That(model.Instances, Is.Not.Empty);
        var badTransforms = model.Instances
            .Select((instance, index) => (instance, index))
            .Where(p => !Finite(p.instance.Column0) || !Finite(p.instance.Column1) || !Finite(p.instance.Column2))
            .Select(p => p.index)
            .ToList();
        var badMeshes = model.Instances
            .Select((instance, index) => (instance, index))
            .Where(p => p.instance.MeshIndex < 0 || p.instance.MeshIndex >= model.Meshes.Count)
            .Select(p => p.index)
            .ToList();
        Assert.Multiple(() =>
        {
            Assert.That(badTransforms, Is.Empty, "instances with a non-finite transform");
            Assert.That(badMeshes, Is.Empty, "instances whose mesh index is out of range");
            Assert.That(model.Meshes.All(m => m.Points.Count > 0), Is.True, "every emitted mesh has vertices");
        });
    }

    private static bool Finite(Ara3D.Geometry.Vector4 v)
        => float.IsFinite(v.X) && float.IsFinite(v.Y) && float.IsFinite(v.Z) && float.IsFinite(v.W);
}
