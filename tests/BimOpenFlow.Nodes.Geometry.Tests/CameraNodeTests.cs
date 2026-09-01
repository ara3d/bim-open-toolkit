using Ara3D.DataFlowEngine.TestKit;

namespace BimOpenFlow.Nodes.Geometry.Tests;

[TestFixture]
public sealed class CameraNodeTests
{
    [Test]
    public void OutputsOneRowWithConventionColumns()
    {
        var result = new CameraNode().EvalTable([],
            ("name", "overview"),
            ("posX", "1.5"), ("posY", "2"), ("posZ", "3"),
            ("targetX", "-1"), ("targetY", "0"), ("targetZ", "0.5"));

        Assert.That(result.Rows, Has.Count.EqualTo(1));
        Assert.That(result.ColumnNames(),
            Is.EqualTo(new[] { "name", "posX", "posY", "posZ", "targetX", "targetY", "targetZ" }));
        Assert.That(result.Cell("name", 0), Is.EqualTo("overview"));
        Assert.That(result.Cell("posX", 0), Is.EqualTo(1.5));
        Assert.That(result.Cell("targetZ", 0), Is.EqualTo(0.5));
    }

    [Test]
    public void Defaults_AreNamedDefaultAtOrigin()
    {
        var result = new CameraNode().EvalTable([]);

        Assert.That(result.Cell("name", 0), Is.EqualTo("default"));
        Assert.That(result.Cell("posX", 0), Is.EqualTo(0.0));
    }
}
