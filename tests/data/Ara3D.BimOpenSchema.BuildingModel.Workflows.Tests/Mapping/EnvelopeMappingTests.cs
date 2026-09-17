using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track A: walls, floors, ceilings, windows, openings and facade panels.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class EnvelopeMappingTests
{
    private static readonly ImmutableArray<DomainMapping> Domains = [CoreMapping.Domain, EnvelopeMapping.Domain, DefinitionsMapping.Domain];

    [Test]
    public void Maps_one_occurrence_per_envelope_kind_with_a_resolved_reference_and_no_validation_findings()
    {
        var model = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels")
            .Entity(1, "wall-a", "Wall 1", "Walls", typeId: 2).Entity(2, "wall-type", "Basic Wall", "Walls", isType: true)
            .Entity(3, "floor-a", "Floor 1", "Floors")
            .Entity(4, "ceiling-a", "Ceiling 1", "Ceilings")
            .Entity(5, "window-a", "Window 1", "Windows", typeId: 6).Entity(6, "window-type", "Casement", "Windows", isType: true)
            .Entity(7, "opening-a", "Opening 1", "Shaft Openings")
            .Entity(8, "panel-a", "Panel 1", "Curtain Panels", typeId: 9).Entity(9, "panel-type", "Glazed", "Curtain Panels", isType: true)
            .Reference(1, "Base Constraint", 0).Reference(1, "Top Constraint", 0)
            .Number(1, "Length", 4000).Number(1, "Unconnected Height", 3000, group: "Constraints").Number(2, "Width", 300, group: "Construction")
            .Integer(1, "Structural", 1, group: "Structural").Integer(1, "Function", 1, group: "Construction")
            .Reference(3, "Level", 0).Number(3, "Thickness", 200).Integer(3, "Structural", 1, group: "Structural")
            .Reference(4, "Level", 0).Number(4, "Thickness", 15, group: "Construction")
            .Reference(5, "Level", 0).Number(6, "Width", 900).Number(6, "Height", 1200)
            .Number(7, "Unconnected Height", 2100, group: "Constraints")
            .Reference(8, "Host Id", 1, group: "Other").Number(8, "Width", 600).Number(8, "Height", 600).Number(9, "Thickness", 25)
            .Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), Domains);

        Assert.Multiple(() =>
        {
            Assert.That(p.Walls, Has.Length.EqualTo(1));
            Assert.That(p.Floors, Has.Length.EqualTo(1));
            Assert.That(p.Ceilings, Has.Length.EqualTo(1));
            Assert.That(p.Windows, Has.Length.EqualTo(1));
            Assert.That(p.Openings, Has.Length.EqualTo(1));
            Assert.That(p.FacadePanels, Has.Length.EqualTo(1));
        });

        var wall = p.Walls.Single();
        Assert.That(((Fact<Length>.Known)wall.Length).Value.Metres, Is.EqualTo(4).Within(1e-9));
        Assert.That(((Fact<Length>.Known)wall.Thickness).Value.Metres, Is.EqualTo(0.3).Within(1e-9));
        Assert.That(wall.BaseStorey, Is.TypeOf<Fact<SnapshotKey<Storey>>.Known>());
        Assert.That(((Fact<bool>.Known)wall.IsExterior).Value, Is.True);

        var panel = p.FacadePanels.Single();
        Assert.That(panel.Host, Is.TypeOf<Fact<ReferenceKey<BimObject>>.Known>());
        Assert.That(((Fact<ReferenceKey<BimObject>>.Known)panel.Host).Value, Is.EqualTo(wall.Element.ObjectId));

        Assert.That(ProjectionValidation.Validate(p), Is.Empty);
    }

    [Test]
    public void Wall_function_code_derives_is_exterior_only_from_the_documented_values()
    {
        Fact<bool> IsExterior(int functionCode)
        {
            var model = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Entity(1, "wall-a", "Wall 1", "Walls")
                .Reference(1, "Base Constraint", 0).Integer(1, "Function", functionCode, group: "Construction").Model();
            return BuildingMapper.Map(model, MappingFixture.Options(), Domains).Walls.Single().IsExterior;
        }
        Assert.That(((Fact<bool>.Known)IsExterior(1)).Value, Is.True, "Code 1 is documented as Exterior.");
        Assert.That(((Fact<bool>.Known)IsExterior(0)).Value, Is.False, "Code 0 is documented as Interior.");
        Assert.That(IsExterior(2), Is.TypeOf<Fact<bool>.Missing>(), "Code 2 (Foundation) is soil facing; it reports neither exterior nor interior.");
        Assert.That(IsExterior(4), Is.TypeOf<Fact<bool>.Missing>(), "Code 4 (Soffit) reports neither exterior nor interior.");
        Assert.That(IsExterior(9), Is.TypeOf<Fact<bool>.Missing>(), "Code 9 is outside the documented WallFunction values.");
    }

    [Test]
    public void Length_converts_under_the_revit_internal_policy_and_stays_unavailable_by_default()
    {
        var model = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Entity(1, "wall-a", "Wall 1", "Walls")
            .Reference(1, "Base Constraint", 0).Number(1, "Length", 10).Model();

        var internalUnits = BuildingMapper.Map(model, MappingFixture.Options(declared: false, storage: NumericStoragePolicy.RevitInternal), Domains);
        Assert.That(((Fact<Length>.Known)internalUnits.Walls.Single().Length).Value.Metres, Is.EqualTo(10 * 0.3048).Within(1e-9));

        var undeclared = BuildingMapper.Map(model, MappingFixture.Options(declared: false), Domains);
        Assert.That(undeclared.Walls.Single().Length, Is.TypeOf<Fact<Length>.Missing>());
    }

    [Test]
    public void Ifc_step_boolean_text_is_read_exactly_and_anything_else_is_invalid()
    {
        Fact<bool> LoadBearing(string stored)
        {
            var model = new MappingFixture().Entity(0, "wall-a", "Wall 1", "IFCWALL")
                .Text(0, "Structural", stored, group: "Pset_WallCommon").Model();
            return BuildingMapper.Map(model, MappingFixture.Options(), Domains).Walls.Single().IsLoadBearing;
        }
        Assert.That(((Fact<bool>.Known)LoadBearing(".T.")).Value, Is.True);
        Assert.That(((Fact<bool>.Known)LoadBearing(".F.")).Value, Is.False);
        Assert.That(((Fact<bool>.Known)LoadBearing("True")).Value, Is.True);
        Assert.That(((Fact<bool>.Missing)LoadBearing(".Maybe.")).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Invalid_structural_flag_is_distinct_from_missing()
    {
        var model = new MappingFixture().Entity(0, "level-a", "Level 1", "Levels").Entity(1, "wall-a", "Wall 1", "Walls")
            .Reference(1, "Base Constraint", 0).Integer(1, "Structural", 2, group: "Structural").Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), Domains);
        Assert.That(((Fact<bool>.Missing)p.Walls.Single().IsLoadBearing).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Generic_area_and_volume_do_not_establish_net_or_gross_quantities()
    {
        var model = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels").Entity(1, "floor-a", "Floor 1", "Floors")
            .Reference(1, "Level", 0).Number(1, "Area", 50, "m2").Number(1, "Volume", 10, "m3").Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), Domains);
        var floor = p.Floors.Single();
        Assert.That(floor.GrossPlanArea, Is.TypeOf<Fact<Area>.Missing>());
        Assert.That(floor.NetPlanArea, Is.TypeOf<Fact<Area>.Missing>());
        Assert.That(floor.NetVolume, Is.TypeOf<Fact<Volume>.Missing>());
        Assert.That(p.Diagnostics.Count(d => d.Code == "quantity.unspecified-basis" && d.Field == "Area"), Is.EqualTo(1));
        Assert.That(p.Diagnostics.Count(d => d.Code == "quantity.unspecified-basis" && d.Field == "Volume"), Is.EqualTo(1));
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_counts_match_the_source_inventory_and_raise_no_validation_findings_for_envelope_tables()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.Walls, Has.Length.EqualTo(1277));
            Assert.That(p.Windows, Has.Length.EqualTo(174));
            Assert.That(p.Floors, Has.Length.EqualTo(228));
            Assert.That(p.Ceilings, Has.Length.EqualTo(68));
            Assert.That(p.FacadePanels, Has.Length.EqualTo(681));
            Assert.That(p.Openings, Has.Length.EqualTo(19));
        });
        Assert.That(ProjectionFindings.Validation(p, typeof(Wall), typeof(Floor), typeof(Ceiling), typeof(Window), typeof(Opening), typeof(FacadePanel)), Is.Empty);
    }
}
