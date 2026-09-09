using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track C: structural members, foundations, connections and reinforcement groups.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class StructureMappingTests
{
    // A minimal domain claiming "Materials" so Material-reference tests have a real Material row to resolve
    // against; the real category is mapped by track H (DefinitionsMapping), which is out of this track's fence
    // and is being written concurrently, so this test fixture stays self-contained rather than depending on it.
    private static readonly DomainMapping MaterialOnly = new("MaterialOnly", [new("Materials", "Material")], [], (k, e, _, b) =>
        b.Add(new Material(new(k.Identity(e.Id).Value), e.Name ?? "Material", MaterialClass.Unclassified,
            MappingKernel.Unknown<string>(), MappingKernel.Unknown<MassDensity>(), MappingKernel.Unknown<ThermalConductivity>(),
            MappingKernel.Unknown<SpecificHeatCapacity>(), MappingKernel.Unknown<Ratio>(), MappingKernel.Unknown<string>(),
            [k.IdentityEvidence(e.Id)])));

    private static BuildingProjection Map(MappingFixture fixture, MappingOptions? options = null)
        => BuildingMapper.Map(fixture.Model(), options ?? MappingFixture.Options(), [CoreMapping.Domain, MaterialOnly, StructureMapping.Domain]);

    private static MappingFixture BasicFixture() => new MappingFixture()
        .Entity(0, "level-a", "L1", "Levels")
        .Entity(1, "mat-a", "Steel", "Materials")
        .Entity(2, "beam-a", "Beam 1", "Structural Framing", typeId: 3)
        .Entity(3, "beam-type", "W10x49", "Structural Framing", isType: true)
        .Entity(4, "column-a", "Column 1", "Structural Columns")
        .Entity(5, "truss-a", "Truss 1", "Structural Trusses")
        .Entity(6, "footing-a", "Footing 1", "Structural Foundations")
        .Entity(7, "pile-a", "Pile 1", "IFCPILE")
        .Entity(8, "connection-a", "Connection 1", "Structural Connections")
        .Entity(9, "rebar-a", "Rebar 1", "Structural Rebar")
        .Reference(2, "Reference Level", 0).Reference(2, "Structural Material", 1)
        .Number(2, "Cut Length", 5, group: "Structural").Number(2, "Length", 6).Number(2, "Volume", 1.2)
        .Reference(4, "Base Level", 0)
        .Number(6, "Length", 2).Number(6, "Width", 1.5).Number(6, "Foundation Thickness", 0.5)
        .Number(9, "Bar Diameter", 0.02).Integer(9, "Quantity", 12, group: "Rebar Set")
        .Number(9, "Total Bar Length", 30).Number(9, "Spacing", 0.2, group: "Rebar Set");

    [Test]
    public void Counts_one_row_per_occurrence_and_validates_clean()
    {
        var p = Map(BasicFixture());
        Assert.Multiple(() =>
        {
            Assert.That(p.StructuralMembers, Has.Length.EqualTo(3), "Framing + Columns + Trusses");
            Assert.That(p.Foundations, Has.Length.EqualTo(2), "Structural Foundations + IFCPILE");
            Assert.That(p.StructuralConnections, Has.Length.EqualTo(1));
            Assert.That(p.ReinforcementGroups, Has.Length.EqualTo(1));
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
    }

    [Test]
    public void Role_is_fixed_by_category_and_otherwise_stays_unknown()
    {
        var p = Map(BasicFixture());
        var byName = p.StructuralMembers.ToDictionary(m => m.Element.Name!);
        Assert.That(((Fact<StructuralMemberRole>.Known)byName["Beam 1"].Role).Value, Is.EqualTo(StructuralMemberRole.Beam));
        Assert.That(((Fact<StructuralMemberRole>.Known)byName["Column 1"].Role).Value, Is.EqualTo(StructuralMemberRole.Column));
        Assert.That(byName["Truss 1"].Role, Is.TypeOf<Fact<StructuralMemberRole>.Missing>());
        Assert.That(p.Coverage.Single(c => c.EntityKind == "StructuralMember" && c.Field == "Role").Known, Is.EqualTo(2));

        var byFoundation = p.Foundations.ToDictionary(f => f.Element.Name!);
        Assert.That(byFoundation["Footing 1"].Role, Is.TypeOf<Fact<FoundationRole>.Missing>());
        Assert.That(((Fact<FoundationRole>.Known)byFoundation["Pile 1"].Role).Value, Is.EqualTo(FoundationRole.Pile));
    }

    [Test]
    public void Numeric_fields_require_the_revit_internal_policy_to_resolve()
    {
        var declared = Map(BasicFixture());
        var beam = declared.StructuralMembers.Single(m => m.Element.Name == "Beam 1");
        Assert.That(beam.CutLength, Is.TypeOf<Fact<Length>.Missing>(), "No canonical unit is established under the default policy.");

        var internalPolicy = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var internalBeam = internalPolicy.StructuralMembers.Single(m => m.Element.Name == "Beam 1");
        Assert.That(((Fact<Length>.Known)internalBeam.CutLength).Value.Metres, Is.EqualTo(5 * 0.3048).Within(1e-12));
        Assert.That(((Fact<Length>.Known)internalBeam.CenterlineLength).Value.Metres, Is.EqualTo(6 * 0.3048).Within(1e-12));

        var footing = internalPolicy.Foundations.Single(f => f.Element.Name == "Footing 1");
        Assert.That(((Fact<Length>.Known)footing.Length).Value.Metres, Is.EqualTo(2 * 0.3048).Within(1e-12));
        Assert.That(((Fact<Length>.Known)footing.Width).Value.Metres, Is.EqualTo(1.5 * 0.3048).Within(1e-12));
        Assert.That(((Fact<Length>.Known)footing.Depth).Value.Metres, Is.EqualTo(0.5 * 0.3048).Within(1e-12));

        var rebar = internalPolicy.ReinforcementGroups.Single();
        Assert.That(((Fact<Length>.Known)rebar.Diameter).Value.Metres, Is.EqualTo(0.02 * 0.3048).Within(1e-12));
        Assert.That(((Fact<int>.Known)rebar.BarCount).Value, Is.EqualTo(12));
        Assert.That(((Fact<Length>.Known)rebar.TotalLength).Value.Metres, Is.EqualTo(30 * 0.3048).Within(1e-12));
        Assert.That(((Fact<Length>.Known)rebar.Spacing).Value.Metres, Is.EqualTo(0.2 * 0.3048).Within(1e-12));
    }

    [Test]
    public void Generic_volume_is_never_treated_as_a_net_quantity()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var beam = p.StructuralMembers.Single(m => m.Element.Name == "Beam 1");
        Assert.That(beam.NetVolume, Is.TypeOf<Fact<Volume>.Missing>());
        Assert.That(beam.Mass, Is.TypeOf<Fact<Mass>.Missing>(), "Mass has no supported canonical unit under any current storage policy.");
        Assert.That(p.Diagnostics.Any(d => d.Code == "quantity.unspecified-basis" && d.Field == "NetVolume"), Is.True);
    }

    [Test]
    public void Material_reference_resolves_only_to_a_selected_material_occurrence()
    {
        var p = Map(BasicFixture());
        var beam = p.StructuralMembers.Single(m => m.Element.Name == "Beam 1");
        var material = p.Materials.Single();
        Assert.That(((Fact<ReferenceKey<Material>>.Known)beam.Material).Value, Is.EqualTo(material.Id));

        // Point the same alias at a Storey occurrence instead of a Material: an invalid, not a guessed, target.
        var wrongTarget = new MappingFixture()
            .Entity(0, "level-a", "L1", "Levels").Entity(1, "beam-b", "Beam 2", "Structural Framing")
            .Reference(1, "Structural Material", 0);
        var invalid = Map(wrongTarget);
        var beamWithBadMaterial = invalid.StructuralMembers.Single();
        Assert.That(((Fact<ReferenceKey<Material>>.Missing)beamWithBadMaterial.Material).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Projects_cleanly_through_validation_with_every_kind_present()
        => Assert.That(ProjectionValidation.Validate(Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal))), Is.Empty);

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_row_counts_match_the_source_inventory_and_stay_clean()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.StructuralMembers, Has.Length.EqualTo(942 + 74), "Structural Framing (942) + Structural Columns (74)");
            Assert.That(p.Foundations, Has.Length.EqualTo(90), "Structural Foundations");
            Assert.That(p.StructuralConnections, Has.Length.EqualTo(70), "Structural Connections");
            Assert.That(p.ReinforcementGroups, Has.Length.EqualTo(14), "Structural Rebar");
            var mine = p.Diagnostics.Where(d => d.Code.StartsWith("validation.") &&
                (d.Subject.StartsWith("StructuralMember/") || d.Subject.StartsWith("Foundation/")
                    || d.Subject.StartsWith("StructuralConnection/") || d.Subject.StartsWith("ReinforcementGroup/")));
            Assert.That(mine, Is.Empty);
        });
    }
}
