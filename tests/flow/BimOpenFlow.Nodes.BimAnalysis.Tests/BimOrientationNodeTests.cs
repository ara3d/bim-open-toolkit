using Ara3D.BimOpenSchema;
using Ara3D.Utils;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>bim.orientation against the frozen sample model. With the walls and the
/// window, the plan extent is X -0.1..9, Y -0.1..8, so the centre is (4.45, 3.95).</summary>
[TestFixture]
public sealed class BimOrientationNodeTests
{
    private const double Tolerance = 1e-4;
    private static readonly BimOrientationNode Node = new();

    private static int RowOf(Ara3D.DataTable.IDataTable t, string name)
        => t.ColumnCells(BimColumns.Name).ToList().IndexOf(name);

    [Test]
    public void Sample_HasEveryBoundedElement_InColumnOrder()
    {
        var t = Node.SampleTable();
        Assert.That(t.Rows, Has.Count.EqualTo(18));
        Assert.That(t.ColumnNames(), Is.EqualTo(new[]
        {
            BimColumns.EntityIndex, BimColumns.GlobalId, BimColumns.Name, BimColumns.Category, BimColumns.Level,
            BimColumns.CenterX, BimColumns.CenterY,
            BimOrientationNode.Bearing, BimOrientationNode.Sector, BimOrientationNode.Direction,
            BimColumns.Distance, BimOrientationNode.Facing, BimOrientationNode.FacingArea,
        }));
    }

    [Test]
    public void Categories_FilterRows()
    {
        var t = Node.SampleTable(("categories", "Walls,Windows"));
        Assert.That(t.ColumnCells(BimColumns.Name), Is.EquivalentTo(new[] { "W1", "W2", "W3", "WN1" }));
    }

    [TestCase("W1", 179.2747, 4L, "S", 3.9503, "S", 27.0)]
    [TestCase("W2", 270.6437, 6L, "W", 4.4503, "W", 24.0)]
    [TestCase("WN1", 205.0963, 5L, "SW", 4.3617, "S", 1.8)]
    public void WallsAndWindow_HaveBearingDirectionAndFacing(
        string name, double bearing, long sector, string direction, double distance, string facing, double area)
    {
        var t = Node.SampleTable(("categories", "Walls,Windows"));
        var row = RowOf(t, name);
        Assert.That((double)t.Cell(BimOrientationNode.Bearing, row)!, Is.EqualTo(bearing).Within(Tolerance));
        Assert.That(t.Cell(BimOrientationNode.Sector, row), Is.EqualTo(sector));
        Assert.That(t.Cell(BimOrientationNode.Direction, row), Is.EqualTo(direction));
        Assert.That((double)t.Cell(BimColumns.Distance, row)!, Is.EqualTo(distance).Within(Tolerance));
        Assert.That(t.Cell(BimOrientationNode.Facing, row), Is.EqualTo(facing));
        Assert.That((double)t.Cell(BimOrientationNode.FacingArea, row)!, Is.EqualTo(area).Within(Tolerance));
        Assert.That(t.Cell(BimColumns.Level, row), Is.EqualTo("Level 1"));
        Assert.That(t.Cell(BimColumns.GlobalId, row), Does.StartWith("GUID-"));
    }

    [Test]
    public void Directions_AreTheEightPointCompass()
        => Assert.That(
            Node.SampleTable().ColumnCells(BimOrientationNode.Direction).Distinct(),
            Is.SubsetOf(BimOrientationNode.Compass));

    [TestCase(0.0, 0)]
    [TestCase(22.4999, 0)]
    [TestCase(22.5, 1)]
    [TestCase(67.5, 2)]
    [TestCase(180.0, 4)]
    [TestCase(337.4999, 7)]
    [TestCase(337.5, 0)]
    [TestCase(359.9999999, 0)]
    public void Sectors_SplitAtTheHalfPoints_ClockwiseSliceWinsABoundary(double bearing, int sector)
        => Assert.That(BimOrientationNode.SectorOf(bearing), Is.EqualTo(sector));

    [TestCase(2.0, 2.0, 0.0, 1.0, "N")]
    [TestCase(2.0, 2.0, 5.0, -1.0, "S")]
    [TestCase(1.0, 2.0, 0.0, 1.0, "E")]
    [TestCase(1.0, 2.0, -0.5, 1.0, "W")]
    public void SquareBox_FacesNorthOrSouth_ElseTheLongFaceDecides(
        double sizeX, double sizeY, double dx, double dy, string facing)
        => Assert.That(BimOrientationNode.FacingOf(sizeX, sizeY, dx, dy), Is.EqualTo(facing));

    [Test]
    public void ElementWithoutBoundsParameters_TakesItsBoxFromGeometry()
    {
        var t = Node.EvalTable([], ("path", WriteSampleWithLevel1Geometry()), ("categories", "Levels"));
        Assert.That(t.ColumnCells(BimColumns.Name), Is.EqualTo(new[] { "Level 1" }));
        Assert.That((double)t.Cell(BimColumns.CenterX, 0)!, Is.EqualTo(9.5).Within(Tolerance));
        Assert.That((double)t.Cell(BimColumns.CenterY, 0)!, Is.EqualTo(21).Within(Tolerance));
        Assert.That((double)t.Cell(BimOrientationNode.FacingArea, 0)!, Is.EqualTo(2).Within(Tolerance));
    }

    [Test]
    public void ElementAtThePlanCentre_HasNoBearingOrSide()
    {
        var t = Node.SampleTable(("categories", "Windows"));
        Assert.That(t.ColumnCells(BimColumns.Name), Is.EqualTo(new[] { "WN1" }), "the only row sets the centre");
        Assert.That((double)t.Cell(BimColumns.Distance, 0)!, Is.EqualTo(0).Within(Tolerance));
        Assert.That(t.Cell(BimOrientationNode.Bearing, 0), Is.Null);
        Assert.That(t.Cell(BimOrientationNode.Sector, 0), Is.Null);
        Assert.That(t.Cell(BimOrientationNode.Direction, 0), Is.Null);
        Assert.That(t.Cell(BimOrientationNode.Facing, 0), Is.Null);
        Assert.That((double)t.Cell(BimOrientationNode.FacingArea, 0)!, Is.EqualTo(1.8).Within(Tolerance));
    }

    [Test]
    public void MissingFile_Throws()
        => Assert.That(
            () => Node.EvalTable([], ("path", @"Z:\no\such\file.bos")),
            Throws.InstanceOf<FileNotFoundException>().With.Message.Contains(BimOrientationNode.Kind));

    /// <summary>The sample model plus one instance of a unit cube on Level 1, scaled 2 in X,
    /// turned 90 degrees about Z, and moved to (10, 20, 0): world box X 9..10, Y 20..22, Z 0..1.</summary>
    private static string WriteSampleWithLevel1Geometry()
    {
        var levels = new BimElementsNode().SampleTable();
        var level1 = (int)(long)levels.Cell(BimColumns.EntityIndex, RowOf(levels, "Level 1"))!;
        var data = BimSampleModel.Build();
        const int u = (int)BimGeometry.VertexMultiplier;
        var turn = System.Numerics.Quaternion.CreateFromAxisAngle(System.Numerics.Vector3.UnitZ, MathF.PI / 2);
        data.Geometry = new BimGeometry
        {
            InstanceEntityIndex = [level1],
            InstanceMaterialIndex = [0],
            InstanceMeshIndex = [0],
            InstanceTransformIndex = [0],
            InstanceFlags = [0],
            VertexX = [0, u, 0, u, 0, u, 0, u],
            VertexY = [0, 0, u, u, 0, 0, u, u],
            VertexZ = [0, 0, 0, 0, u, u, u, u],
            IndexBuffer = [0, 1, 2],
            MeshVertexOffset = [0],
            MeshIndexOffset = [0],
            MaterialRed = [200], MaterialGreen = [200], MaterialBlue = [200],
            MaterialAlpha = [255], MaterialRoughness = [128], MaterialMetallic = [0],
            TransformTX = [10], TransformTY = [20], TransformTZ = [0],
            TransformQX = [turn.X], TransformQY = [turn.Y], TransformQZ = [turn.Z], TransformQW = [turn.W],
            TransformSX = [2], TransformSY = [1], TransformSZ = [1],
        };
        var path = Path.Combine(Path.GetTempPath(), "bimopenflow-bimanalysis-tests", $"geometry-{Guid.NewGuid():N}.bos");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        Ara3D.BimOpenSchema.IO.ParquetUtils.WriteToParquetZip(data, new FilePath(path));
        return path;
    }
}
