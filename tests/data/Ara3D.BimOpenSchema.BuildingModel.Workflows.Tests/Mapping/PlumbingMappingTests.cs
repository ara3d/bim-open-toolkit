using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track F: pipes, fittings, valves, sanitary fixtures, fire protection terminals, pumps, drains and piping systems.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class PlumbingMappingTests
{
    private static readonly ImmutableArray<DomainMapping> Domains = [CoreMapping.Domain, PlumbingMapping.Domain];

    [Test]
    public void Maps_one_occurrence_per_plumbing_kind_with_a_resolved_system_reference_and_no_validation_findings()
    {
        var model = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels")
            .Entity(1, "room-a", "Room 1", "Rooms")
            .Entity(2, "system-a", "Domestic Cold Water 1", "Piping Systems")
            .Entity(3, "pipe-a", "Pipe 1", "Pipes")
            .Entity(4, "fitting-a", "Fitting 1", "Pipe Fittings")
            .Entity(5, "valve-a", "Valve 1", "IFCVALVE")
            .Entity(6, "fixture-a", "Fixture 1", "Plumbing Fixtures")
            .Entity(7, "sprinkler-a", "Sprinkler 1", "Sprinklers")
            .Entity(8, "pump-a", "Pump 1", "IFCPUMP")
            .Entity(9, "drain-a", "Drain 1", "IFCWASTETERMINAL")
            .Entity(10, "material-a", "Copper", "Materials")
            .Text(2, "System Classification", "Domestic Cold Water", group: "Mechanical")
            .Text(2, "System Name", "Domestic Cold Water 1", group: "Mechanical")
            .Text(3, "System Name", "Domestic Cold Water 1", group: "Mechanical").Text(3, "Size", "2\"").Number(3, "Outside Diameter", 60)
            .Number(3, "Inside Diameter", 55).Number(3, "Length", 4000).Number(3, "Wall Thickness", 3)
            .Number(3, "Insulation Thickness", 25, group: "Insulation").Reference(3, "Material", 10, group: "Mechanical")
            .Text(4, "System Name", "Domestic Cold Water 1", group: "Mechanical").Number(4, "Center Radius", 100)
            .Text(5, "System Name", "Domestic Cold Water 1", group: "Mechanical").Text(5, "Size", "1\"")
            .Reference(6, "Rvt:FamilyInstance:Room", 1).Number(6, "Sanitary Diameter", 100)
            .Text(7, "System Name", "Domestic Cold Water 1", group: "Mechanical").Reference(7, "Rvt:FamilyInstance:Room", 1)
            .Text(8, "System Name", "Domestic Cold Water 1", group: "Mechanical")
            .Text(9, "System Name", "Domestic Cold Water 1", group: "Mechanical").Reference(9, "Rvt:FamilyInstance:Room", 1)
            .Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), Domains);

        Assert.Multiple(() =>
        {
            Assert.That(p.PipeSegments, Has.Length.EqualTo(1));
            Assert.That(p.PipeFittings, Has.Length.EqualTo(1));
            Assert.That(p.Valves, Has.Length.EqualTo(1));
            Assert.That(p.SanitaryFixtures, Has.Length.EqualTo(1));
            Assert.That(p.FireProtectionTerminals, Has.Length.EqualTo(1));
            Assert.That(p.Pumps, Has.Length.EqualTo(1));
            Assert.That(p.Drains, Has.Length.EqualTo(1));
            Assert.That(p.ServiceSystems, Has.Length.EqualTo(1));
        });

        var system = p.ServiceSystems.Single();
        var pipe = p.PipeSegments.Single();
        Assert.That(pipe.SystemId, Is.TypeOf<Fact<SnapshotKey<ServiceSystem>>.Known>());
        Assert.That(((Fact<SnapshotKey<ServiceSystem>>.Known)pipe.SystemId).Value, Is.EqualTo(system.Id));
        Assert.That(((Fact<Length>.Known)pipe.CenterlineLength).Value.Metres, Is.EqualTo(4).Within(1e-9));
        Assert.That(((Fact<string>.Known)pipe.NominalSize).Value, Is.EqualTo("2\""));

        // The referenced "Materials" entity is never claimed by this fixture's domains, so the reference stays Invalid
        // rather than being guessed at, matching the kernel rule for Material lookups outside track H's table.
        Assert.That(pipe.MaterialId, Is.TypeOf<Fact<ReferenceKey<Material>>.Missing>());
        Assert.That(((Fact<ReferenceKey<Material>>.Missing)pipe.MaterialId).Reason, Is.EqualTo(Availability.Invalid));

        var fitting = p.PipeFittings.Single();
        Assert.That(fitting.SystemId, Is.TypeOf<Fact<SnapshotKey<ServiceSystem>>.Known>());

        var fixture = p.SanitaryFixtures.Single();
        Assert.That(fixture.SpaceId, Is.TypeOf<Fact<SnapshotKey<Space>>.Known>());
        Assert.That(((Fact<Length>.Known)fixture.WasteOutletDiameter).Value.Metres, Is.EqualTo(0.1).Within(1e-9));

        // A membership row backlinks the pipe segment to its resolved fluid system, the way CoreMapping links spaces to doors.
        Assert.That(p.SystemMemberships.Count(m => m.SystemId == system.Id && m.ObjectId == pipe.Element.ObjectId), Is.EqualTo(1));

        Assert.That(ProjectionValidation.Validate(p), Is.Empty);
    }

    [Test]
    public void Centerline_length_converts_under_the_revit_internal_policy_and_stays_unavailable_by_default()
    {
        var model = new MappingFixture().Entity(0, "pipe-a", "Pipe 1", "Pipes").Number(0, "Length", 10).Model();

        var internalUnits = BuildingMapper.Map(model, MappingFixture.Options(declared: false, storage: NumericStoragePolicy.RevitInternal), Domains);
        Assert.That(((Fact<Length>.Known)internalUnits.PipeSegments.Single().CenterlineLength).Value.Metres, Is.EqualTo(10 * 0.3048).Within(1e-9));

        var undeclared = BuildingMapper.Map(model, MappingFixture.Options(declared: false), Domains);
        Assert.That(undeclared.PipeSegments.Single().CenterlineLength, Is.TypeOf<Fact<Length>.Missing>());
    }

    [Test]
    public void Flow_and_pressure_stay_unavailable_because_the_kernel_does_not_convert_them()
    {
        var model = new MappingFixture().Entity(0, "pipe-a", "Pipe 1", "Pipes").Number(0, "Flow", 5, units: "GALLONS_PER_MINUTE", group: "Mechanical - Flow").Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), [PlumbingMapping.Domain]);
        Assert.That(p.PipeSegments.Single().DesignFlow, Is.TypeOf<Fact<FlowRate>.Missing>());
    }

    [Test]
    public void Trapped_flag_stored_outside_zero_or_one_is_invalid_not_missing()
    {
        var model = new MappingFixture().Entity(0, "drain-a", "Drain 1", "IFCWASTETERMINAL").Integer(0, "Trapped", 2).Model();
        var p = BuildingMapper.Map(model, MappingFixture.Options(), [PlumbingMapping.Domain]);
        Assert.That(((Fact<bool>.Missing)p.Drains.Single().IsTrapped).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Slope_is_known_only_when_the_descriptor_carries_no_explicit_units()
    {
        var dimensionless = new MappingFixture().Entity(0, "pipe-a", "Pipe 1", "Pipes").Number(0, "Slope", 0.02, units: "").Model();
        var known = BuildingMapper.Map(dimensionless, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), [PlumbingMapping.Domain])
            .PipeSegments.Single().Slope;
        Assert.That(((Fact<Ratio>.Known)known).Value.Value, Is.EqualTo(0.02).Within(1e-12));

        // Empty units is exactly what an IFC delivery carries, so a bare number is not a rise/run ratio until the
        // caller states what the source stores.
        var undeclared = BuildingMapper.Map(dimensionless, MappingFixture.Options(declared: false), [PlumbingMapping.Domain])
            .PipeSegments.Single().Slope;
        Assert.That(undeclared, Is.TypeOf<Fact<Ratio>.Missing>());

        var withUnits = new MappingFixture().Entity(0, "pipe-a", "Pipe 1", "Pipes").Number(0, "Slope", 1, units: "RISE_12_INCHES").Model();
        var unavailable = BuildingMapper.Map(withUnits, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal), [PlumbingMapping.Domain])
            .PipeSegments.Single().Slope;
        Assert.That(unavailable, Is.TypeOf<Fact<Ratio>.Missing>());
    }

    [Test]
    public void Service_system_discipline_only_matches_an_exact_service_discipline_member_name()
    {
        ServiceDiscipline Map(string classification)
        {
            var model = new MappingFixture().Entity(0, "system-a", "System 1", "Piping Systems")
                .Text(0, "System Classification", classification, group: "Mechanical").Model();
            return BuildingMapper.Map(model, MappingFixture.Options(), [PlumbingMapping.Domain]).ServiceSystems.Single().Discipline;
        }
        Assert.That(Map("Domestic Cold Water"), Is.EqualTo(ServiceDiscipline.DomesticColdWater));
        Assert.That(Map("Sanitary"), Is.EqualTo(ServiceDiscipline.Unknown), "Sanitary alone does not equal a ServiceDiscipline member name.");

        // A persisted name must identify the system, not the positional export row it happened to arrive in.
        var unnamed = new MappingFixture().Entity(0, "system-a", "", "Piping Systems").Model();
        var system = BuildingMapper.Map(unnamed, MappingFixture.Options(), [PlumbingMapping.Domain]).ServiceSystems.Single();
        Assert.That(system.Name, Is.EqualTo("System system-a"));
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_counts_match_the_source_inventory_and_raise_no_validation_findings_for_plumbing_tables()
    {
        SnowdonSource.Require();

        // ServiceSystem is a table this domain shares with track E's Hvac domain (Duct Systems also maps to it), so
        // the Piping Systems count is confirmed against this domain mapped alone rather than against the combined total.
        var isolated = BuildingMapper.Map(SnowdonSource.Model, SnowdonSource.Options(), [PlumbingMapping.Domain]);
        Assert.Multiple(() =>
        {
            Assert.That(isolated.PipeSegments, Has.Length.EqualTo(3051));
            Assert.That(isolated.PipeFittings, Has.Length.EqualTo(2651));
            Assert.That(isolated.SanitaryFixtures, Has.Length.EqualTo(328));
            Assert.That(isolated.ServiceSystems, Has.Length.EqualTo(40));
        });

        var p = SnowdonSource.Projection;
        Assert.That(ProjectionFindings.Validation(p, typeof(PipeSegment), typeof(PipeFitting), typeof(Valve), typeof(SanitaryFixture),
            typeof(FireProtectionTerminal), typeof(Pump), typeof(Drain), typeof(ServiceSystem), typeof(SystemMembership)), Is.Empty);

        // Membership joins on the exact "System Name" text both the pipe and the system carry: the source's
        // "System Type" parameter names the system type element, which is not a mapped occurrence.
        var rows = p.PipeSegments.Select(r => (Object: r.Element.ObjectId, r.SystemId))
            .Concat(p.PipeFittings.Select(r => (Object: r.Element.ObjectId, r.SystemId)))
            .Concat(p.Valves.Select(r => (Object: r.Element.ObjectId, r.SystemId)))
            .Concat(p.Pumps.Select(r => (Object: r.Element.ObjectId, r.SystemId)))
            .Concat(p.Drains.Select(r => (Object: r.Element.ObjectId, r.SystemId)))
            .Concat(p.FireProtectionTerminals.Select(r => (Object: r.Element.ObjectId, r.SystemId))).ToArray();
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
