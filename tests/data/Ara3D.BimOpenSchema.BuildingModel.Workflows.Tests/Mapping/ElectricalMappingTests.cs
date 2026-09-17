using System.Collections.Immutable;
using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track G: panels, circuits, lighting, devices, cables and containment. See WAVE-R5.md.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class ElectricalMappingTests
{
    private static readonly ImmutableArray<DomainMapping> Domains = [CoreMapping.Domain, ElectricalMapping.Domain];

    private static BuildingProjection Map(MappingFixture fixture, MappingOptions? options = null)
        => BuildingMapper.Map(fixture.Model(), options ?? MappingFixture.Options(), Domains);

    [Test]
    public void Maps_every_kind_with_expected_counts_kinds_and_links_and_validates()
    {
        var fixture = new MappingFixture()
            .Entity(0, "level-a", "Level 1", "Levels")
            .Entity(1, "room-a", "Room A", "Rooms").Entity(2, "room-b", "Room B", "Rooms")
            .Entity(3, "circuit-a", "ElectricalSystem", "Electrical Circuits")
            .Entity(4, "fixture-a", "Downlight", "Lighting Fixtures")
            .Entity(5, "device-a", "Data Outlet", "Data Devices")
            .Entity(6, "device-b", "Duplex", "IFCOUTLET")
            .Entity(7, "wire-a", "Wire", "Wires")
            .Entity(8, "conduit-a", "EMT", "Conduits")
            .Entity(9, "tray-a", "Tray", "Cable Trays")
            .Entity(10, "carrier-a", "Carrier", "IFCCABLECARRIERSEGMENT")
            .Entity(11, "panel-a", "Board", "IFCELECTRICDISTRIBUTIONBOARD")
            .Text(1, "Number", "101").Text(2, "Number", "102")
            .Text(3, "Circuit Number", "12", group: "Electrical - Loads")
            .Text(3, "Load Name", "Lighting Panel A", group: "Electrical - Loads")
            .Integer(3, "Number of Poles", 2, group: "Electrical - Loads")
            .Reference(4, "Room", 1).Reference(4, "Circuit", 3)
            .Reference(5, "Room", 1).Reference(5, "Room", 2)
            .Number(8, "Inside Diameter", 0.02, "m", group: "Dimensions")
            .Number(9, "Inside Diameter", 0.3, "m", group: "Dimensions");

        var p = Map(fixture);

        Assert.Multiple(() =>
        {
            Assert.That(p.ElectricalCircuits, Has.Length.EqualTo(1));
            Assert.That(p.LightingFixtures, Has.Length.EqualTo(1));
            Assert.That(p.ElectricalDevices, Has.Length.EqualTo(2));
            Assert.That(p.CableSegments, Has.Length.EqualTo(1));
            Assert.That(p.CableContainments, Has.Length.EqualTo(3));
            Assert.That(p.ElectricalPanels, Has.Length.EqualTo(1));

            var circuit = p.ElectricalCircuits[0];
            Assert.That(circuit.Designation, Is.EqualTo("12"));
            Assert.That(((Fact<string>.Known)circuit.Purpose).Value, Is.EqualTo("Lighting Panel A"));
            Assert.That(((Fact<int>.Known)circuit.PoleCount).Value, Is.EqualTo(2));
            Assert.That(circuit.PanelId, Is.TypeOf<Fact<SnapshotKey<ElectricalPanel>>.Missing>());

            var lighting = p.LightingFixtures[0];
            Assert.That(((Fact<SnapshotKey<Space>>.Known)lighting.SpaceId).Value, Is.EqualTo(p.Spaces.Single(s => s.Number is Fact<string>.Known { Value: "101" }).Id));
            Assert.That(((Fact<SnapshotKey<ElectricalCircuit>>.Known)lighting.CircuitId).Value, Is.EqualTo(circuit.Id));

            var dataOutlet = p.ElectricalDevices.Single(d => d.Kind == ElectricalDeviceKind.DataOutlet);
            Assert.That(dataOutlet.SpaceId, Is.TypeOf<Fact<SnapshotKey<Space>>.Missing>());
            var socketOutlet = p.ElectricalDevices.Single(d => d.Kind == ElectricalDeviceKind.SocketOutlet);
            Assert.That(socketOutlet.SpaceId, Is.TypeOf<Fact<SnapshotKey<Space>>.Missing>());
            Assert.That(p.Diagnostics.Any(d => d.Code == "field.ambiguous-space" && d.Field == "SpaceId" && d.Message.Contains("Multiple")), Is.True);
            Assert.That(p.Diagnostics.Any(d => d.Code == "field.ambiguous-space" && d.Field == "SpaceId" && d.Message.Contains("No room")), Is.True);

            var conduit = p.CableContainments.Single(c => c.Kind == CableContainmentKind.Conduit);
            Assert.That(conduit.ClearWidth, Is.TypeOf<Fact<Length>.Missing>());
            Assert.That(((Fact<Length>.Missing)conduit.ClearWidth).Reason, Is.EqualTo(Availability.NotApplicable));
            var tray = p.CableContainments.Single(c => c.Kind == CableContainmentKind.CableTray);
            Assert.That(((Fact<Length>.Missing)tray.ClearWidth).Reason, Is.EqualTo(Availability.NotObserved));
            Assert.That(p.CableContainments.Single(c => c.Kind == CableContainmentKind.Unknown), Is.Not.Null);

            Assert.That(p.ElectricalPanels[0].Circuits.Items, Is.Empty);
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
    }

    [TestCase("7", null, "7")]
    [TestCase(null, "Named System", "Named System")]
    [TestCase(null, null, "Circuit 0")]
    public void Designation_falls_back_from_circuit_number_to_name_to_generated_id(string? number, string? name, string expected)
    {
        var fixture = new MappingFixture().Entity(0, "circuit-a", name!, "Electrical Circuits");
        if (number is not null) fixture.Text(0, "Circuit Number", number, group: "Electrical - Loads");
        var p = Map(fixture);
        Assert.That(p.ElectricalCircuits.Single().Designation, Is.EqualTo(expected));
    }

    [Test]
    public void Conductor_and_supply_facts_stay_unavailable_because_their_units_are_not_carried_by_the_kernel()
    {
        var fixture = new MappingFixture().Entity(0, "circuit-a", "Panel A-1", "Electrical Circuits")
            .Number(0, "Voltage", 277, "VOLTS", group: "Electrical - Loads")
            .Number(0, "Rating", 20, "AMPERES", group: "Electrical - Loads")
            .Number(0, "Apparent Power", 1500, "VOLT_AMPERES", group: "Electrical - Loads");
        var p = Map(fixture, MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var circuit = p.ElectricalCircuits.Single();
        Assert.That(circuit.Voltage, Is.TypeOf<Fact<Voltage>.Missing>());
        Assert.That(circuit.ProtectionRating, Is.TypeOf<Fact<ElectricCurrent>.Missing>());
        Assert.That(circuit.ConnectedLoad, Is.TypeOf<Fact<Power>.Missing>());
    }

    [Test]
    public void Clear_diameter_converts_under_the_revit_internal_policy_but_stays_unavailable_under_the_default_policy()
    {
        var fixture = () => new MappingFixture().Entity(0, "conduit-a", "EMT", "Conduits").Number(0, "Inside Diameter", 0.1, "ft", group: "Dimensions");
        var trusted = Map(fixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        Assert.That(((Fact<Length>.Known)trusted.CableContainments.Single().ClearDiameter).Value.Metres, Is.EqualTo(0.1 * 0.3048).Within(1e-12));

        var untrusted = Map(fixture(), MappingFixture.Options(declared: false));
        var missing = (Fact<Length>.Missing)untrusted.CableContainments.Single().ClearDiameter;
        Assert.That(missing.Reason, Is.EqualTo(Availability.NotObserved));
    }

    [Test]
    public void Reference_field_resolves_a_lighting_fixture_to_its_mapped_circuit()
    {
        var fixture = new MappingFixture().Entity(0, "circuit-a", "Panel A-1", "Electrical Circuits")
            .Entity(1, "fixture-a", "Downlight", "Lighting Fixtures").Reference(1, "Circuit", 0);
        var p = Map(fixture);
        var circuit = p.ElectricalCircuits.Single();
        Assert.That(((Fact<SnapshotKey<ElectricalCircuit>>.Known)p.LightingFixtures.Single().CircuitId).Value, Is.EqualTo(circuit.Id));
    }

    [Test]
    public void Pole_count_outside_the_int_range_is_reported_invalid_not_missing()
    {
        var fixture = new MappingFixture().Entity(0, "circuit-a", "Panel A-1", "Electrical Circuits")
            .Integer(0, "Number of Poles", 5_000_000_000, group: "Electrical - Loads");
        var p = Map(fixture);
        Assert.That(((Fact<int>.Missing)p.ElectricalCircuits.Single().PoleCount).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Conflicting_load_name_values_remain_distinct_and_unresolved()
    {
        var fixture = new MappingFixture().Entity(0, "circuit-a", "Panel A-1", "Electrical Circuits")
            .Text(0, "Load Name", "Receptacles", group: "Electrical - Loads").Text(0, "Load Name", "Lighting", group: "Electrical - Loads");
        var p = Map(fixture);
        var purpose = (Fact<string>.Missing)p.ElectricalCircuits.Single().Purpose;
        Assert.That(purpose.Reason, Is.EqualTo(Availability.Conflicting));
        Assert.That(p.Coverage.Single(c => c.EntityKind == "ElectricalCircuit" && c.Field == "Purpose").Conflicting, Is.EqualTo(1));
    }

    [Test]
    [Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_counts_match_the_source_inventory_and_validation_reports_no_finding_for_electrical_tables()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.ElectricalCircuits, Has.Length.EqualTo(447));
            Assert.That(p.LightingFixtures, Has.Length.EqualTo(1035));
            Assert.That(p.ElectricalDevices, Has.Length.EqualTo(538 + 196 + 52));
            Assert.That(p.CableSegments, Has.Length.EqualTo(436));
            Assert.That(p.CableContainments, Has.Length.EqualTo(530));
        });
        Assert.That(ProjectionFindings.Validation(p, typeof(ElectricalPanel), typeof(ElectricalCircuit), typeof(LightingFixture),
            typeof(ElectricalDevice), typeof(CableSegment), typeof(CableContainment)), Is.Empty);
    }
}
