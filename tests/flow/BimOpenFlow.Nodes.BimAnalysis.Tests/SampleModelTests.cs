using Ara3D.BimOpenSchema;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Nodes.BimAnalysis.Tests;

/// <summary>The sample model round-trips through the .bos parquet zip and the
/// BimModel lookups see what BimSampleModel put in. Every other fixture-based
/// assertion in this project builds on these facts.</summary>
[TestFixture]
public sealed class SampleModelTests
{
    [Test]
    public void SampleBos_LoadsIntoBimModel()
    {
        var model = BimModel.Get(BimAnalysisTestHelpers.SampleBosPath, "test");
        Assert.That(model.Objects.Entities, Is.Not.Empty);
    }

    [Test]
    public void InstanceElements_ExcludeCategoriesAndTypes()
    {
        var model = BimModel.Get(BimAnalysisTestHelpers.SampleBosPath, "test");
        var elements = model.InstanceElements().ToList();
        // 2 levels + 6 rooms + 3 walls + 5 doors + 1 window + 1 column + 1 duct + 1 light
        Assert.That(elements, Has.Count.EqualTo(20));
        Assert.That(elements.Select(e => e.Name), Does.Not.Contain("Basic Wall 200mm"));
        Assert.That(elements.Select(e => e.Name), Does.Not.Contain("Rooms"));
    }

    [Test]
    public void Rooms_HaveLevelsAndNumbers()
    {
        var model = BimModel.Get(BimAnalysisTestHelpers.SampleBosPath, "test");
        var rooms = model.ElementsInCategories("Rooms,Spaces").ToList();
        Assert.That(rooms, Has.Count.EqualTo(6));
        var office = rooms.Single(r => r.Name == "Office");
        Assert.That(office.LevelName, Is.EqualTo("Level 1"));
        Assert.That(office.GetParameterAsString(CommonRevitParameters.RoomNumber), Is.EqualTo("101"));
    }

    [Test]
    public void PointParameters_RoundTrip()
    {
        var model = BimModel.Get(BimAnalysisTestHelpers.SampleBosPath, "test");
        var office = model.ElementsInCategories("Rooms").Single(r => r.Name == "Office");
        var bounds = model.GetBounds(office.Index);
        Assert.That(bounds, Is.Not.Null);
        Assert.That(bounds!.Value.Min.X, Is.EqualTo(0));
        Assert.That(bounds.Value.Max, Is.EqualTo(new Point(5, 4, 3)));
    }
}
