using Ara3D.BimOpenSchema.DataModel;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests;

/// <summary>Wave R5 track B: stairs, flights, landings, ramps, railings, vertical transport and furniture.</summary>
[Platonic.Impure, Category("Size.Small"), Category("Source.Synthetic")]
public sealed class CirculationMappingTests
{
    // DefinitionsMapping (track H) is included, alongside the stable Core domain, so the Product/Assembly facts this
    // domain records through k.Product/k.Assembly resolve to real rows instead of dangling. Both are complete,
    // registered domains outside this track's fence, not in-flight scaffolding.
    private static BuildingProjection Map(MappingFixture fixture, MappingOptions? options = null)
        => BuildingMapper.Map(fixture.Model(), options ?? MappingFixture.Options(), [CoreMapping.Domain, DefinitionsMapping.Domain, CirculationMapping.Domain]);

    private static MappingFixture BasicFixture() => new MappingFixture()
        .Entity(0, "level-a", "L1", "Levels").Entity(1, "level-b", "L2", "Levels").Entity(2, "room-a", "Room 1", "Rooms")
        .Entity(3, "stair-a", "Stair 1", "Stairs", typeId: 4).Entity(4, "stair-type", "Assembled Stair", "Stairs", isType: true)
        .Entity(5, "run-a", "Run 1", "Runs").Entity(6, "landing-a", "Landing 1", "Landings").Entity(7, "ramp-a", "Ramp 1", "Ramps")
        .Entity(8, "railing-a", "Railing 1", "Railings", typeId: 9).Entity(9, "railing-type", "Guard Type", "Railings", isType: true)
        .Entity(10, "lift-a", "Elevator 1", "IFCTRANSPORTELEMENT")
        .Entity(11, "desk-a", "Desk 1", "Furniture", typeId: 12).Entity(12, "desk-type", "Desk Type", "Furniture", isType: true)
        .Reference(3, "Base Level", 0).Reference(3, "Top Level", 1).Number(3, "Desired Stair Height", 10)
        .Reference(5, "Stair", 3).Integer(5, "Actual Number of Risers", 12)
        .Number(5, "Actual Riser Height", 0.5833).Number(5, "Actual Tread Depth", 0.9167).Number(5, "Actual Run Width", 3.5)
        .Reference(6, "Stair", 3)
        .Number(7, "Width", 4).Number(7, "Ramp Max Slope (1/x)", 12, units: "GENERAL")
        .Reference(8, "Host", 3).Number(8, "Length", 20).Number(8, "Railing Height", 3.5, group: "Construction")
        .Text(8, "Finish", "Painted", group: "Materials and Finishes")
        .Reference(11, "Space", 2).Number(11, "Width", 0.8).Number(11, "Depth", 0.6).Number(11, "Height", 0.75)
        .Integer(11, "Chairs", 4, group: "Construction").Text(11, "Finish", "Oak", group: "Materials and Finishes");

    [Test]
    public void Counts_one_row_per_kind_and_validates_clean()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        Assert.Multiple(() =>
        {
            Assert.That(p.Stairs, Has.Length.EqualTo(1));
            Assert.That(p.StairFlights, Has.Length.EqualTo(1));
            Assert.That(p.Landings, Has.Length.EqualTo(1));
            Assert.That(p.Ramps, Has.Length.EqualTo(1));
            Assert.That(p.Railings, Has.Length.EqualTo(1));
            Assert.That(p.VerticalTransports, Has.Length.EqualTo(1));
            Assert.That(p.FurnitureItems, Has.Length.EqualTo(1));
            Assert.That(ProjectionValidation.Validate(p), Is.Empty);
        });
    }

    [Test]
    public void Numeric_fields_require_the_revit_internal_policy_to_resolve()
    {
        var undeclared = Map(BasicFixture(), MappingFixture.Options(declared: false));
        var flight = undeclared.StairFlights.Single();
        Assert.That(flight.NominalRiserHeight, Is.TypeOf<Fact<Length>.Missing>(), "No canonical unit is established when no storage policy is asserted.");

        var internalPolicy = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var internalFlight = internalPolicy.StairFlights.Single();
        Assert.That(((Fact<Length>.Known)internalFlight.NominalRiserHeight).Value.Metres, Is.EqualTo(0.5833 * 0.3048).Within(1e-9));
        Assert.That(((Fact<Length>.Known)internalFlight.NominalTreadGoing).Value.Metres, Is.EqualTo(0.9167 * 0.3048).Within(1e-9));
        Assert.That(((Fact<Length>.Known)internalFlight.MinimumClearWidth).Value.Metres, Is.EqualTo(3.5 * 0.3048).Within(1e-9));
        Assert.That(((Fact<int>.Known)internalFlight.RiserCount).Value, Is.EqualTo(12), "Integer fields do not depend on the numeric storage policy.");

        var stair = internalPolicy.Stairs.Single();
        Assert.That(((Fact<Length>.Known)stair.TotalRise).Value.Metres, Is.EqualTo(10 * 0.3048).Within(1e-9));
    }

    [Test]
    public void Stair_reference_resolves_and_backlinks_flights_landings_and_railings()
    {
        var p = Map(BasicFixture());
        var stair = p.Stairs.Single();
        var flight = p.StairFlights.Single();
        var landing = p.Landings.Single();
        var railing = p.Railings.Single();

        Assert.That(((Fact<SnapshotKey<Stair>>.Known)flight.Stair).Value, Is.EqualTo(stair.Id));
        Assert.That(((Fact<SnapshotKey<Stair>>.Known)landing.Stair).Value, Is.EqualTo(stair.Id));
        Assert.That(((Fact<ReferenceKey<BimObject>>.Known)railing.Host).Value, Is.EqualTo(stair.Element.ObjectId));

        Assert.That(stair.Flights.Items, Is.EqualTo(new[] { flight.Id }));
        Assert.That(stair.Landings.Items, Is.EqualTo(new[] { landing.Id }));
        Assert.That(stair.Railings.Items, Is.EqualTo(new[] { railing.Id }));
    }

    [Test]
    public void A_reference_pointed_at_the_wrong_kind_is_invalid_not_guessed()
    {
        // "Stair" aimed at a Level occurrence instead of a Stair: an invalid target, not a silently accepted one.
        var wrongTarget = new MappingFixture()
            .Entity(0, "level-a", "L1", "Levels").Entity(1, "run-b", "Run 2", "Runs")
            .Reference(1, "Stair", 0);
        var p = Map(wrongTarget);
        var flight = p.StairFlights.Single();
        Assert.That(((Fact<SnapshotKey<Stair>>.Missing)flight.Stair).Reason, Is.EqualTo(Availability.Invalid));
    }

    [Test]
    public void Ramp_slope_stays_unavailable_and_is_diagnosed_rather_than_inverted()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var ramp = p.Ramps.Single();
        Assert.That(ramp.MaximumLongitudinalSlope, Is.TypeOf<Fact<Ratio>.Missing>());
        Assert.That(((Fact<Length>.Known)ramp.MinimumClearWidth).Value.Metres, Is.EqualTo(4 * 0.3048).Within(1e-9));
        Assert.That(p.Diagnostics.Any(d => d.Code == "quantity.unspecified-basis" && d.Field == "MaximumLongitudinalSlope"), Is.True);
    }

    [Test]
    public void Furniture_resolves_its_space_product_and_seat_count()
    {
        var p = Map(BasicFixture(), MappingFixture.Options(storage: NumericStoragePolicy.RevitInternal));
        var desk = p.FurnitureItems.Single();
        var room = p.Spaces.Single();
        Assert.That(((Fact<SnapshotKey<Space>>.Known)desk.Space).Value, Is.EqualTo(room.Id));
        Assert.That(desk.Product, Is.TypeOf<Fact<ReferenceKey<ProductDefinition>>.Known>());
        Assert.That(((Fact<int>.Known)desk.SeatCount).Value, Is.EqualTo(4));
        Assert.That(((Fact<string>.Known)desk.Finish).Value, Is.EqualTo("Oak"));
    }

    [Test]
    public void Vertical_transport_role_is_never_inferred_from_the_category()
    {
        var p = Map(BasicFixture());
        Assert.That(p.VerticalTransports.Single().Role, Is.EqualTo(MappingKernel.Unknown<VerticalTransportRole>()));
    }

    [Test, Category("Size.Large"), Category("Source.Snowdon")]
    public void Snowdon_row_counts_match_the_source_inventory_and_stay_clean()
    {
        SnowdonSource.Require();
        var p = SnowdonSource.Projection;
        Assert.Multiple(() =>
        {
            Assert.That(p.Stairs, Has.Length.EqualTo(27 + 3), "Stairs (27) + Multistory Stairs (3)");
            Assert.That(p.StairFlights, Has.Length.EqualTo(43), "Runs");
            Assert.That(p.Landings, Has.Length.EqualTo(17), "Landings");
            Assert.That(p.Ramps, Has.Length.EqualTo(2), "Ramps");
            Assert.That(p.Railings, Has.Length.EqualTo(133 + 121 + 93), "Railings + Handrails + Top Rails");
            Assert.That(p.FurnitureItems, Has.Length.EqualTo(168 + 177), "Furniture + Casework");
            Assert.That(ProjectionFindings.Validation(p, typeof(Stair), typeof(StairFlight), typeof(Landing), typeof(Ramp),
                typeof(Railing), typeof(VerticalTransport), typeof(Furniture)), Is.Empty);
        });
    }
}
