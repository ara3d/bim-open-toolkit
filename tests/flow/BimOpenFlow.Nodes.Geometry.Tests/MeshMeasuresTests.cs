using Ara3D.DataFlowEngine.TestKit;
using Ara3D.Geometry;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class MeshMeasuresTests
{
    /// <summary>A unit cube of 12 triangles with outward, consistent winding.</summary>
    private static TriangleMesh3D UnitCube()
    {
        Point3D[] p =
        [
            new(0, 0, 0), new(1, 0, 0), new(1, 1, 0), new(0, 1, 0),
            new(0, 0, 1), new(1, 0, 1), new(1, 1, 1), new(0, 1, 1),
        ];
        Integer3[] faces =
        [
            (0, 2, 1), (0, 3, 2), // bottom (z = 0), normal -z
            (4, 5, 6), (4, 6, 7), // top, +z
            (0, 1, 5), (0, 5, 4), // front (y = 0), -y
            (3, 6, 2), (3, 7, 6), // back, +y
            (0, 4, 7), (0, 7, 3), // left (x = 0), -x
            (1, 2, 6), (1, 6, 5), // right, +x
        ];
        return new TriangleMesh3D(p, faces);
    }

    [Test]
    public void Unit_Cube_Has_Area_Six_And_Volume_One()
    {
        var m = MeshMeasures.Of(UnitCube(), System.Numerics.Matrix4x4.Identity);
        Assert.That(m.SurfaceArea, Is.EqualTo(6).Within(1e-9));
        Assert.That(m.MeshVolume, Is.EqualTo(1).Within(1e-9));
        Assert.That(m.TriangleCount, Is.EqualTo(12));
    }

    [Test]
    public void Placement_Scale_And_Translation_Apply_In_World_Space()
    {
        var transform = System.Numerics.Matrix4x4.CreateScale(2, 3, 4) * System.Numerics.Matrix4x4.CreateTranslation(100, 200, 300);
        var m = MeshMeasures.Of(UnitCube(), transform);
        Assert.That(m.SurfaceArea, Is.EqualTo(2 * (2 * 3 + 3 * 4 + 2 * 4)).Within(1e-6));
        Assert.That(m.MeshVolume, Is.EqualTo(24).Within(1e-6));
    }

    [Test]
    public void Site_Coordinates_Do_Not_Degrade_A_Small_Element()
    {
        var far = System.Numerics.Matrix4x4.CreateTranslation(1_000_000, 2_000_000, 500_000);
        var m = MeshMeasures.Of(UnitCube(), far);
        Assert.That(m.SurfaceArea, Is.EqualTo(6).Within(1e-6));
        Assert.That(m.MeshVolume, Is.EqualTo(1).Within(1e-6));
    }

    [Test]
    public void Open_Shell_Reports_Area_Only()
    {
        var quad = new TriangleMesh3D([new(0, 0, 0), new(2, 0, 0), new(2, 2, 0), new(0, 2, 0)], [(0, 1, 2), (0, 2, 3)]);
        var m = MeshMeasures.Of(quad, System.Numerics.Matrix4x4.Identity);
        Assert.That(m.SurfaceArea, Is.EqualTo(4).Within(1e-9));
        Assert.That(m.MeshVolume, Is.EqualTo(0).Within(1e-9));
    }

    [Test]
    public void Measures_Table_Has_One_Row_Per_Instance_With_Instance_Keys()
    {
        var geometry = new ModelGeometry([UnitCube()],
        [
            new(0, 0, System.Numerics.Matrix4x4.Identity, 42, "G42", "IFCWALL", default),
            new(1, 0, System.Numerics.Matrix4x4.CreateScale(2), 43, "G43", "IFCSLAB", default),
        ]);
        var table = geometry.ToMeasuresTable();
        Assert.That(table.ColumnNames(), Is.EqualTo(new[]
        {
            "instanceIndex", "meshId", "entityId", "globalId", "category", "surfaceArea", "meshVolume", "triangleCount",
        }));
        Assert.That(table.ColumnCells("entityId"), Is.EqualTo(new object[] { 42L, 43L }));
        Assert.That((double)table.Cell("meshVolume", 1)!, Is.EqualTo(8).Within(1e-6));
    }

    [Test]
    [Category("RequiresData")]
    public void Duplex_Measures_Are_Finite_And_Positive()
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        string? path = null;
        for (; dir != null && path == null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "data", ModelGeometryTests.Duplex)))
                path = Path.Combine(dir.FullName, "data", ModelGeometryTests.Duplex);
        if (path == null) Assert.Ignore("duplex.ifc not found under a 'data' folder.");
        var table = new MeasuresNode().EvalTable([], ("path", path!));
        Assert.That(table.Rows.Count, Is.GreaterThan(0));
        Assert.That(table.ColumnCells("surfaceArea").Cast<double>(), Has.All.GreaterThan(0).And.All.Matches<double>(double.IsFinite));
    }
}
