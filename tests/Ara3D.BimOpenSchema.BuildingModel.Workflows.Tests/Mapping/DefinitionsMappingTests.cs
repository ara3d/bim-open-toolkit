using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track H: materials, product definitions and assembly definitions. See WAVE-R5.md.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class DefinitionsMappingTests
{
    private static BuildingProjection Map(MappingFixture fixture, MappingOptions? options = null)
        => BuildingMapper.Map(fixture.Model(), options ?? MappingFixture.Options(), [CoreMapping.Domain, DefinitionsMapping.Domain]);

    // Two door types (one with a valid material reference, one pointing at a non-Material occurrence) and one
    // roof type exercise Product/Assembly definitions; two materials exercise the class-name match.
    private static MappingFixture BasicFixture() => new MappingFixture()
        .Entity(0, "mat-concrete", "Concrete", "Materials")
        .Entity(1, "mat-generic", "Generic Material", "Materials")
        .Entity(2, "door-type-good", "Acme Door 1", "Doors", isType: true)
        .Entity(3, "door-a", "Door A", "Doors", typeId: 2)
        .Entity(4, "door-type-bad", "Bad Door", "Doors", isType: true)
        .Entity(5, "door-b", "Door B", "Doors", typeId: 4)
        .Entity(6, "roof-type", "EPDM Roof", "Roofs", isType: true)
        .Entity(7, "roof-a", "Roof A", "Roofs", typeId: 6)
        .Text(0, "Rvt:Material:Class", "Concrete", group: "RevitAPI")
        .Text(1, "Rvt:Material:Class", "Generic", group: "RevitAPI")
        .Text(2, "Manufacturer", "Acme").Text(2, "Type Mark", "TM1").Text(2, "Model", "X100")
        .Reference(2, "Material", 0, group: "Materials and Finishes")
        .Reference(4, "Material", 3, group: "Materials and Finishes")
        .Text(6, "Fire Rating", "2 HR");

    [Test]
    public void Material_class_matches_exactly_and_falls_back_to_unclassified_otherwise()
    {
        var p = Map(BasicFixture());
        var byName = p.Materials.ToDictionary(m => m.Name);
        Assert.Multiple(() =>
        {
            Assert.That(byName["Concrete"].Class, Is.EqualTo(MaterialClass.Concrete));
            Assert.That(byName["Generic Material"].Class, Is.EqualTo(MaterialClass.Unclassified));
            Assert.That(byName["Concrete"].Density, Is.TypeOf<Fact<MassDensity>.Missing>(), "Density has no canonical unit under any storage policy.");
            Assert.That(byName["Concrete"].ThermalConductivity, Is.TypeOf<Fact<ThermalConductivity>.Missing>());
        });
    }

    [Test]
    public void Door_type_becomes_a_product_definition_with_manufacturer_model_and_principal_material()
    {
        var p = Map(BasicFixture());
        Assert.That(p.ProductDefinitions, Has.Length.EqualTo(2));
        var good = p.ProductDefinitions.Single(d => d.Name == "Acme Door 1");
        var concrete = p.Materials.Single(m => m.Name == "Concrete");
        Assert.Multiple(() =>
        {
            Assert.That(((Fact<string>.Known)good.Manufacturer).Value, Is.EqualTo("Acme"));
            Assert.That(((Fact<string>.Known)good.ProductCode).Value, Is.EqualTo("TM1"));
            Assert.That(((Fact<string>.Known)good.ModelNumber).Value, Is.EqualTo("X100"));
            Assert.That(((Fact<ReferenceKey<Material>>.Known)good.PrincipalMaterial).Value, Is.EqualTo(concrete.Id));
        });
    }

    [Test]
    public void Definition_field_coverage_is_counted_under_the_definition_kind_not_the_type_bucket()
    {
        var p = Map(BasicFixture());
        Assert.Multiple(() =>
        {
            Assert.That(p.Coverage.Single(c => c.EntityKind == nameof(ProductDefinition) && c.Field == "Manufacturer").Known, Is.EqualTo(1));
            Assert.That(p.Coverage.Any(c => c.EntityKind == nameof(AssemblyDefinition) && c.Field == "FireResistance"), Is.True);
        });
    }

    [Test]
    public void Principal_material_reference_to_a_non_material_occurrence_is_invalid_not_guessed()
    {
        var p = Map(BasicFixture());
        var bad = p.ProductDefinitions.Single(d => d.Name == "Bad Door");
        Assert.That(((Fact<ReferenceKey<Material>>.Missing)bad.PrincipalMaterial).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Roof_type_becomes_an_assembly_definition_with_kind_and_fire_rating()
    {
        var p = Map(BasicFixture());
        var roof = p.AssemblyDefinitions.Single();
        Assert.Multiple(() =>
        {
            Assert.That(roof.Name, Is.EqualTo("EPDM Roof"));
            Assert.That(roof.Kind, Is.EqualTo(AssemblyKind.Roof));
            Assert.That(((Fact<DurationValue>.Known)roof.FireResistance).Value.Value.TotalMinutes, Is.EqualTo(120));
            Assert.That(roof.Layers, Is.Empty);
            Assert.That(roof.LayerCompleteness, Is.EqualTo(Completeness.NotObserved));
        });
    }

    [Test]
    public void Every_product_and_assembly_reference_resolves_to_a_row_and_validation_is_clean()
    {
        var p = Map(BasicFixture());
        var productKeys = p.ProductDefinitions.Select(d => d.Id.Value).ToHashSet();
        var assemblyKeys = p.AssemblyDefinitions.Select(d => d.Id.Value).ToHashSet();
        var references = ProjectionTables.All.SelectMany(t => t.Rows(p)).SelectMany(RowReferences.Of).ToArray();
        Assert.Multiple(() =>
        {
            foreach (var reference in references.Where(r => r.Target == typeof(ProductDefinition)))
                Assert.That(productKeys, Does.Contain(reference.Key));
            foreach (var reference in references.Where(r => r.Target == typeof(AssemblyDefinition)))
                Assert.That(assemblyKeys, Does.Contain(reference.Key));
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_materials_and_definitions_cover_every_referenced_type_and_stay_clean()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        var productKeys = p.ProductDefinitions.Select(d => d.Id.Value).ToHashSet();
        var assemblyKeys = p.AssemblyDefinitions.Select(d => d.Id.Value).ToHashSet();
        var references = ProjectionTables.All.SelectMany(t => t.Rows(p)).SelectMany(RowReferences.Of).ToArray();
        Assert.Multiple(() =>
        {
            Assert.That(p.Materials, Has.Length.EqualTo(753));
            Assert.That(p.ProductDefinitions, Is.Not.Empty);
            Assert.That(p.AssemblyDefinitions, Is.Not.Empty);
            Assert.That(references.Where(r => r.Target == typeof(ProductDefinition)).Select(r => r.Key).Distinct(), Is.SubsetOf(productKeys));
            Assert.That(references.Where(r => r.Target == typeof(AssemblyDefinition)).Select(r => r.Key).Distinct(), Is.SubsetOf(assemblyKeys));
            Assert.That(ProjectionFindings.Validation(p, typeof(Material), typeof(ProductDefinition), typeof(AssemblyDefinition)), Is.Empty);
        });
    }
}
