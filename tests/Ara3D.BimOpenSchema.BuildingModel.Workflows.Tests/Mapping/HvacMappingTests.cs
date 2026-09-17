using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track E: ducts, fittings, air terminals, dampers, air handling units, fans and air systems.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class HvacMappingTests
{
    private static readonly ImmutableArray<DomainMapping> Domains = [HvacMapping.Domain];

    [Test]
    public void Maps_one_occurrence_per_hvac_kind_with_a_resolved_system_reference_and_no_validation_findings()
    {
        var model = new MappingFixture()
            .Entity(0, "system-a", "Mechanical Supply Air 1", "Duct Systems")
            .Entity(1, "duct-a", "Duct 1", "Ducts")
            .Entity(2, "fitting-a", "Fitting 1", "Duct Fittings")
            .Entity(3, "terminal-a", "Terminal 1", "Air Terminals")
            .Entity(4, "damper-a", "Damper 1", "IFCDAMPER")
            .Entity(5, "fan-a", "Fan 1", "IFCFAN")
            .Entity(6, "ahu-a", "AHU 1", "IFCUNITARYEQUIPMENT")
            .Text(0, "System Classification", "Supply Air", group: "Mechanical")
            .Text(0, "System Name", "Mechanical Supply Air 1", group: "Mechanical")
            .Text(1, "System Name", "Mechanical Supply Air 1", group: "Mechanical")
            .Number(1, "Diameter", 300, group: "Dimensions")
            .Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), Domains);

        Assert.Multiple(() =>
        {
            Assert.That(p.ServiceSystems, Has.Length.EqualTo(1));
            Assert.That(p.DuctSegments, Has.Length.EqualTo(1));
            Assert.That(p.DuctFittings, Has.Length.EqualTo(1));
            Assert.That(p.AirTerminals, Has.Length.EqualTo(1));
            Assert.That(p.Dampers, Has.Length.EqualTo(1));
            Assert.That(p.Fans, Has.Length.EqualTo(1));
            Assert.That(p.AirHandlingUnits, Has.Length.EqualTo(1));
        });

        var system = p.ServiceSystems.Single();
        Assert.That(system.Discipline, Is.EqualTo(ServiceDiscipline.SupplyAir), "Text equals the enum member name once spaces are removed.");

        var duct = p.DuctSegments.Single();
        Assert.That(duct.SystemId, Is.TypeOf<Fact<SnapshotKey<ServiceSystem>>.Known>());
        Assert.That(((Fact<SnapshotKey<ServiceSystem>>.Known)duct.SystemId).Value, Is.EqualTo(system.Id));

        var membership = p.SystemMemberships.Single();
        Assert.That(membership.SystemId, Is.EqualTo(system.Id));
        Assert.That(membership.ObjectId, Is.EqualTo(duct.Element.ObjectId));

        Assert.That(ProjectionValidation.Validate(p), Is.Empty);
    }

    [Test]
    public void Diameter_converts_under_the_revit_internal_policy_and_stays_unavailable_by_default()
    {
        var model = new MappingFixture().Entity(0, "duct-a", "Duct 1", "Ducts").Number(0, "Diameter", 2).Model();

        var internalUnits = BuildingMapper.Map(model, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), Domains);
        Assert.That(((Fact<Length>.Known)internalUnits.DuctSegments.Single().Diameter).Value.Metres, Is.EqualTo(2 * 0.3048).Within(1e-9));

        var undeclared = BuildingMapper.Map(model, MappingFixture.Options(declared: false), Domains);
        Assert.That(undeclared.DuctSegments.Single().Diameter, Is.TypeOf<Fact<Length>.Missing>());
    }

    [Test]
    public void Negative_diameter_is_reported_invalid_rather_than_missing()
    {
        var model = new MappingFixture().Entity(0, "duct-a", "Duct 1", "Ducts").Number(0, "Diameter", -2).Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), Domains);
        Assert.That(((Fact<Length>.Missing)p.DuctSegments.Single().Diameter).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Flow_stays_unavailable_because_the_kernel_does_not_convert_it()
    {
        var model = new MappingFixture().Entity(0, "duct-a", "Duct 1", "Ducts").Number(0, "Flow", 5, group: "Mechanical - Flow").Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), Domains);
        Assert.That(p.DuctSegments.Single().DesignFlow, Is.TypeOf<Fact<FlowRate>.Missing>());
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_counts_match_the_source_inventory_and_raise_no_validation_findings_for_hvac_tables()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.DuctSegments, Has.Length.EqualTo(1234 + 31));
            Assert.That(p.DuctFittings, Has.Length.EqualTo(1147));
            Assert.That(p.AirTerminals, Has.Length.EqualTo(540));
        });

        // Duct Systems (179) share the ServiceSystem table with track F's Piping Systems, so the exact system count
        // is asserted against a projection mapped with only this domain registered.
        var isolated = BuildingMapper.Map(SnowdonSource.Model, SnowdonSource.Options(), Domains);
        Assert.That(isolated.ServiceSystems, Has.Length.EqualTo(179));

        Assert.That(ProjectionFindings.Validation(p, typeof(DuctSegment), typeof(DuctFitting), typeof(AirTerminal), typeof(Damper),
            typeof(Fan), typeof(AirHandlingUnit), typeof(ServiceSystem), typeof(SystemMembership)), Is.Empty);

        // The source's "System Type" parameter names the system type, not the system occurrence, so membership is
        // joined on the exact "System Name" text both sides carry. No system reference may be reported as invalid.
        var rows = p.DuctSegments.Select(r => (Object: r.Element.ObjectId, r.SystemId))
            .Concat(p.DuctFittings.Select(r => (Object: r.Element.ObjectId, r.SystemId)))
            .Concat(p.AirTerminals.Select(r => (Object: r.Element.ObjectId, r.SystemId))).ToArray();
        var matched = rows.Where(x => x.SystemId is Fact<SnapshotKey<ServiceSystem>>.Known).Select(x => x.Object).ToHashSet();
        var all = rows.Select(x => x.Object).ToHashSet();
        Assert.Multiple(() =>
        {
            Assert.That(matched, Is.Not.Empty);
            Assert.That(p.SystemMemberships.Count(m => all.Contains(m.ObjectId)), Is.EqualTo(matched.Count));
            Assert.That(p.Diagnostics.Count(d => d.Code == "field.invalid" && d.Field == "SystemId"), Is.Zero);
        });
    }
}
