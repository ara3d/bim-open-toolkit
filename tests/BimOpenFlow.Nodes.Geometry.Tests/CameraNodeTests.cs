using static BimOpenFlow.Nodes.Geometry.Tests.TestSupport;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class CameraNodeTests
{
    [Test]
    public void OutputsOneRowWithConventionColumns()
    {
        var result = OutputTable(new CameraNode(), [], Params(
            ("name", "overview"),
            ("posX", "1.5"), ("posY", "2"), ("posZ", "3"),
            ("targetX", "-1"), ("targetY", "0"), ("targetZ", "0.5")));

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(ColumnNames(result),
            Is.EqualTo(new[] { "name", "posX", "posY", "posZ", "targetX", "targetY", "targetZ" }));
        Assert.That(Cell(result, "name", 0), Is.EqualTo("overview"));
        Assert.That(Cell(result, "posX", 0), Is.EqualTo(1.5));
        Assert.That(Cell(result, "targetZ", 0), Is.EqualTo(0.5));
    }

    [Test]
    public void Defaults_AreNamedDefaultAtOrigin()
    {
        var result = OutputTable(new CameraNode(), [], TestSupport.Params());

        Assert.That(Cell(result, "name", 0), Is.EqualTo("default"));
        Assert.That(Cell(result, "posX", 0), Is.EqualTo(0.0));
    }
}
