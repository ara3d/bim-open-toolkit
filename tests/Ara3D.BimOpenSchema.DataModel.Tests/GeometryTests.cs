using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure, TestFixture, Category("Feature.Geometry"), Category("Size.Small"), Category("Stage.Stable"), Category("Source.Synthetic")]
public sealed class GeometryTests
{
    [Test]
    public void WorldBoundsUseMetersAndScaleBeforeRotateBeforeTranslate()
    {
        var data = Fixtures.Data();
        var g = data.Geometry;
        var model = Fixtures.Model(data);
        Assert.That(model.Tables.Geometry[0].Bounds, Is.EqualTo(new Bounds3(new(10, 20, 30), new(12, 23, 30))));
        g.TransformQZ = [(float)Math.Sqrt(0.5)]; g.TransformQW = [(float)Math.Sqrt(0.5)]; g.TransformSX = [-2];
        model = Fixtures.Model(data);
        var bounds = model.Tables.Geometry[0].Bounds;
        Assert.That(bounds.Min.X, Is.EqualTo(7).Within(0.000001));
        Assert.That(bounds.Min.Y, Is.EqualTo(18).Within(0.000001));
        Assert.That(bounds.Max.X, Is.EqualTo(10).Within(0.000001));
        Assert.That(bounds.Max.Y, Is.EqualTo(20).Within(0.000001));
        Assert.That(model.Tables.Geometry[0].TriangleCount, Is.EqualTo(1));
    }

    [Test]
    public void RepeatedInstancesAggregateAndHiddenGeometryIsAccountedFor()
    {
        var data = Fixtures.Data();
        data.Geometry.InstanceEntityIndex = [2, 2]; data.Geometry.InstanceMeshIndex = [0, 0];
        data.Geometry.InstanceTransformIndex = [0, 0]; data.Geometry.InstanceFlags = [0, 1];
        var row = Fixtures.Model(data).Tables.Geometry[0];
        Assert.That(row.InstanceCount, Is.EqualTo(2));
        Assert.That(row.HiddenInstanceCount, Is.EqualTo(1));
        Assert.That(row.TriangleCount, Is.EqualTo(2));
    }

    [Test]
    public void InvalidMeshAndMissingTransformsDoNotProduceInventedGeometry()
    {
        var data = Fixtures.Data();
        data.Geometry.IndexBuffer = [0, 1, 99];
        var model = Fixtures.Model(data);
        Assert.That(model.Tables.Geometry, Is.Empty);
        Assert.That(model.Tables.Issues.Any(i => i.Code == "InvalidMesh"), Is.True);
        data.Geometry = Fixtures.Geometry();
        data.Geometry.TransformQW = [0];
        model = Fixtures.Model(data);
        Assert.That(model.Tables.Geometry, Is.Empty);
        Assert.That(model.Tables.Issues.Single().Code, Is.EqualTo("InvalidTransform"));
    }

    [Test]
    public void SpatialIndexMatchesBruteForceAcrossGeneratedQueries()
    {
        var random = new Random(42);
        var rows = new GeometryRow[1000];
        for (var i = 0; i < rows.Length; i++)
        {
            var x = random.NextDouble() * 100; var y = random.NextDouble() * 100; var z = random.NextDouble() * 100;
            rows[i] = new(i, new(new(x, y, z), new(x + 5, y + 3, z + 1)), 1, 1, 0);
        }
        var index = SpatialIndex.Create(rows);
        for (var i = 0; i < 100; i++)
        {
            var point = new Point3(random.NextDouble() * 100, random.NextDouble() * 100, random.NextDouble() * 100);
            var bounds = new Bounds3(point, new(point.X + 10, point.Y + 10, point.Z + 10));
            Assert.That(index.Intersect(bounds), Is.EqualTo(rows.Where(r => r.Bounds.Intersects(bounds)).Select(r => r.EntityId)));
            Assert.That(index.WithinDistance(point, 10), Is.EqualTo(rows.Where(r => r.Bounds.DistanceTo(point) <= 10).Select(r => r.EntityId)));
        }
        Assert.Throws<ArgumentException>(() => index.Intersect(new(new(2, 0, 0), new(1, 0, 0))));
        Assert.Throws<ArgumentOutOfRangeException>(() => index.WithinDistance(new(0, 0, 0), -1));
    }

    [Test]
    public void TouchingBoundsAndZeroDistanceAreInclusive()
    {
        var bounds = new Bounds3(new(0, 0, 0), new(1, 1, 1));
        Assert.That(bounds.Intersects(new(new(1, 1, 1), new(2, 2, 2))), Is.True);
        Assert.That(bounds.DistanceTo(new(1, 1, 1)), Is.Zero);
        Assert.That(bounds.DistanceTo(new(2, 1, 1)), Is.EqualTo(1));
        Assert.That(bounds.Volume, Is.EqualTo(1));
        Assert.That(bounds.Contains(new Point3(0.5, 0.5, 0.5)), Is.True);
    }
}
