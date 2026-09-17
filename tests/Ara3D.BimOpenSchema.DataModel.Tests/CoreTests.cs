using Platonic;

namespace Ara3D.BimOpenSchema.DataModel.Tests;

[Impure, TestFixture, Category("Size.Small"), Category("Stage.Stable"), Category("Source.Synthetic")]
public sealed class CoreTests
{
    [Test, Category("Feature.Conversion")]
    public void SnapshotDetachesFromSourceAndDenormalizesEntityIdentity()
    {
        var data = Fixtures.Data();
        var model = Fixtures.Model(data);
        data.Strings[1] = "Mutated";
        data.Entities[2] = Fixtures.Entity(999);
        Assert.That(model.Tables.Entities[2], Is.EqualTo(new EntityRow(2, "model/entity/2", 102, null, 0,
            "Project", "Wall A", 0, "Walls", 1, "Wall type", false, false)));
        Assert.That(model.FindByCategory(" walls ").Select(e => e.Id), Is.EqualTo(new[] { 1, 2 }));
        Assert.That(model.Entity(-1).IsSome, Is.False);
    }

    [Test, Category("Feature.Properties")]
    public void EffectivePropertiesRespectFullKeyAndPreserveDuplicates()
    {
        var data = Fixtures.Data();
        data.Parameters = [..data.Parameters, new((EntityIndex)2, (DescriptorIndex)0, 0)];
        var model = Fixtures.Model(data);
        var effective = model.PropertiesOf(2);
        Assert.That(effective.Count(p => p.Key.Name == "HEIGHT" && p.Key.Units == "mm"), Is.EqualTo(2));
        Assert.That(effective.Single(p => p.Key.Name == "FIRE RATING").TextValue, Is.EqualTo("O'Brien"));
        Assert.That(effective.Single(p => p.Key.Units == "m").NumberValue, Is.EqualTo(3));
        Assert.That(effective.Single(p => p.PointValue.HasValue).PointValue, Is.EqualTo(new Point3(1, 2, 3)));
        Assert.That(model.Tables.Issues.Any(i => i.Code == "DuplicateProperty"), Is.True);
        Assert.That(model.FindByProperty(model.Tables.Descriptors[0].Key).Length, Is.EqualTo(3));
    }

    [Test, Category("Feature.Properties")]
    public void UnitsAreExplicitAndCultureIndependent()
    {
        var source = Fixtures.Data();
        Assert.That(Fixtures.Model(source).Tables.Properties[0].CanonicalNumber, Is.Null);
        var converted = Fixtures.Model(source, new(NumericValuesUseDeclaredUnits: true));
        Assert.That(converted.Tables.Properties[0].CanonicalNumber, Is.EqualTo(3));
        Assert.That(converted.Tables.Properties[0].NumberValue, Is.EqualTo(3000));
        Assert.That(converted.Tables.Properties[0].CanonicalUnits, Is.EqualTo("m"));
        Assert.That(TextNormalization.Key("  Ｈｅｉｇｈｔ\u00a0\t A "), Is.EqualTo("HEIGHT A"));
    }

    [Test, Category("Feature.Validation")]
    public void DirtyReferencesAreReportedAndStrictModeRejects()
    {
        var data = Fixtures.Data();
        data.Parameters = [..data.Parameters, new((EntityIndex)99, (DescriptorIndex)0, 0),
            new((EntityIndex)2, (DescriptorIndex)99, 0), new((EntityIndex)2, (DescriptorIndex)0, 99)];
        data.Relations = [new((EntityIndex)99, (EntityIndex)2, RelationType.PartOf)];
        var model = Fixtures.Model(data);
        Assert.That(model.Tables.Properties.Length, Is.EqualTo(6));
        Assert.That(model.Tables.Properties[^1].IsValid, Is.False);
        Assert.That(model.Tables.Properties[^1].RawValue, Is.EqualTo(99));
        Assert.That(model.Tables.Issues.Count(i => i.Severity == IssueSeverity.Error), Is.EqualTo(4));
        Assert.That(BimModelConverter.Convert(data, new(Strict: true)).IsOk, Is.False);
    }

    [Test, Category("Feature.Graph")]
    public void CyclesDirectionDepthAndSymmetricConnectivityHaveDeterministicSemantics()
    {
        var data = Fixtures.Data();
        data.Relations = [new((EntityIndex)0, (EntityIndex)1, RelationType.PartOf), new((EntityIndex)1, (EntityIndex)2, RelationType.PartOf),
            new((EntityIndex)2, (EntityIndex)0, RelationType.PartOf), new((EntityIndex)0, (EntityIndex)2, RelationType.ConnectsTo)];
        var graph = Fixtures.Model(data).Graph;
        Assert.That(graph.Reachable(0, "PartOf"), Is.EqualTo(new[] { 1, 2 }));
        Assert.That(graph.Reachable(0, "PartOf", maxDepth: 1), Is.EqualTo(new[] { 1 }));
        Assert.That(graph.Neighbors(0, "PartOf", GraphDirection.Incoming), Is.EqualTo(new[] { 2 }));
        Assert.That(graph.Neighbors(2, "ConnectsTo"), Is.EqualTo(new[] { 0 }));
        Assert.That(graph.ShortestPath(0, 2, "PartOf"), Is.EqualTo(new[] { 0, 1, 2 }));
        Assert.That(graph.ShortestPath(1, 1), Is.EqualTo(new[] { 1 }));
        Assert.That(graph.ShortestPath(1, 0, "Absent"), Is.Empty);
    }

    [Test, Category("Feature.Properties")]
    public void TypeCyclesTerminateAndInvalidValuesRemainDistinctFromZero()
    {
        var data = Fixtures.Data();
        data.Entities[1] = data.Entities[1] with { Type = (EntityIndex)2 };
        data.Numbers = [float.NaN, 0, 3];
        var model = Fixtures.Model(data);
        Assert.That(model.PropertiesOf(2).Length, Is.EqualTo(4));
        Assert.That(model.Tables.Properties[0].IsValid, Is.False);
        Assert.That(model.Tables.Properties[2].NumberValue, Is.EqualTo(0));
    }
}
