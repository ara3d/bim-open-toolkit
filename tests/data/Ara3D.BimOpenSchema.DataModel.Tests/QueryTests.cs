using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure, TestFixture, Category("Feature.Properties"), Category("Size.Small"), Category("Stage.Stable"), Category("Source.Synthetic")]
public sealed class QueryTests
{
    [Test]
    public void SchedulesPreserveInheritedProvenanceAndUnitAwareQueries()
    {
        var model = Fixtures.Model();
        var height = ModelQueries.Property("Height", ParameterType.Number, "Dimensions", "mm");
        var fire = ModelQueries.Property("Fire rating", ParameterType.String, "Dimensions");
        var schedule = model.Schedule([2], [height, fire]);
        Assert.That(schedule[0].Cells[0].Values[0].NumberValue, Is.EqualTo(4000));
        Assert.That(schedule[0].Cells[1].Values[0].EntityId, Is.EqualTo(1));
        Assert.That(model.FindNumeric(height, 3500, 4500), Is.EqualTo(new[] { 2 }));
        Assert.That(model.FindText(fire, " o'brien "), Is.EqualTo(new[] { 1 }));
        Assert.That(model.FindText(fire, "o'brien", normalize: false), Is.Empty);
        Assert.That(model.MissingProperty([0, 1, 2], fire), Is.EqualTo(new[] { 0 }));
        Assert.That(model.SummarizeCategories(), Is.EqualTo(new[] { new CategorySummary(0, "Walls", 1, 1) }));
    }

    [Test]
    public void MissingSentinelsRemainDistinctFromInvalidReferencesAndLiteralNegativeIntegers()
    {
        var data = Fixtures.Data();
        data.Descriptors = [..data.Descriptors, new((StringIndex)0, (StringIndex)(-1), (StringIndex)(-1), ParameterType.Int)];
        data.Parameters = [new((EntityIndex)2, (DescriptorIndex)0, -1), new((EntityIndex)2, (DescriptorIndex)0, -2),
            new((EntityIndex)2, (DescriptorIndex)5, -1)];
        var model = Fixtures.Model(data);
        Assert.That(model.Tables.Properties[0].IsMissing, Is.True);
        Assert.That(model.Tables.Properties[0].IsValid, Is.True);
        Assert.That(model.Tables.Properties[1].IsValid, Is.False);
        Assert.That(model.Tables.Properties[2].IntegerValue, Is.EqualTo(-1));
        Assert.That(model.MissingProperty([2], model.Tables.Descriptors[0].Key), Is.EqualTo(new[] { 2 }));
    }

    [Test, Category("Feature.Validation")]
    public void NullSourceArraysAndGeometryColumnsProduceStructuredErrors()
    {
        var data = Fixtures.Data();
        data.Geometry.VertexX = null!;
        Assert.That(Fixtures.Model(data).Tables.Issues.Single().Code, Is.EqualTo("MissingGeometryColumn"));
        data.Parameters = null!;
        Assert.That(BimModelConverter.Convert(data).IsOk, Is.False);
    }
}
