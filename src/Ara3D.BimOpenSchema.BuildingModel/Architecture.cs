namespace Ara3D.BimOpenSchema.BuildingModel;

// Architectural occurrences are recognizable scheduling and coordination units.
// Assembly and product definitions supply reusable specifications. Quantities
// remain explicit facts: dimensions do not silently produce certified takeoffs.

/// <summary>One wall occurrence at a declared construction scope. Room-facing finishes are separate surfaces, so a wall between two rooms remains one wall.</summary>
/// <param name="Id">Snapshot-scoped wall row identity.</param>
/// <param name="Element">Shared object identity and spatial evidence.</param>
/// <param name="Assembly">Specified wall construction.</param>
/// <param name="BaseStorey">Scheduling base level; not a constraint on vertical extent.</param>
/// <param name="TopStorey">Referenced upper level when the model supplies one.</param>
/// <param name="Length">Selected wall reference-path length; curved walls require an explicit measurement basis in its evidence.</param>
/// <param name="Height">Selected height; varying profiles remain in geometry.</param>
/// <param name="Thickness">Nominal overall construction thickness.</param>
/// <param name="IsLoadBearing">Reported structural function, independently of material or thickness.</param>
/// <param name="IsExterior">Reported exterior enclosure function.</param>
/// <param name="FireResistance">Declared rated duration; a rating alone does not establish an approved assembly.</param>
/// <param name="Openings">Hosted openings and inventory completeness.</param>
/// <param name="FinishSurfaces">Distinct finish faces or installation patches.</param>
public sealed record Wall(
    SnapshotKey<Wall> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    Fact<SnapshotKey<Storey>> BaseStorey,
    Fact<SnapshotKey<Storey>> TopStorey,
    Fact<Length> Length, Fact<Length> Height, Fact<Length> Thickness,
    Fact<bool> IsLoadBearing, Fact<bool> IsExterior,
    Fact<DurationValue> FireResistance,
    LinkSet<Opening> Openings, LinkSet<FinishSurface> FinishSurfaces);

/// <summary>One floor construction occurrence, including a structural slab when that is its role. Finish installations are separate surfaces and must not duplicate the slab's material quantity.</summary>
/// <param name="Id">Snapshot-scoped floor identity.</param>
/// <param name="Element">Shared identity and spatial context.</param>
/// <param name="Assembly">Construction specification.</param>
/// <param name="Storey">Primary scheduling level.</param>
/// <param name="IsStructural">Reported structural function; do not infer from the word floor.</param>
/// <param name="Thickness">Nominal construction thickness.</param>
/// <param name="GrossPlanArea">Horizontal projected area before the declared opening deductions.</param>
/// <param name="NetPlanArea">Horizontal projected area after the declared deductions.</param>
/// <param name="NetVolume">Selected construction volume after deductions under its evidence basis.</param>
/// <param name="Slope">Representative inclination from horizontal, when meaningful.</param>
/// <param name="Openings">Hosted openings and inventory completeness.</param>
/// <param name="FinishSurfaces">Distinct top, underside or edge finishes.</param>
public sealed record Floor(
    SnapshotKey<Floor> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly, Fact<SnapshotKey<Storey>> Storey,
    Fact<bool> IsStructural, Fact<Length> Thickness,
    Fact<Area> GrossPlanArea, Fact<Area> NetPlanArea, Fact<Volume> NetVolume,
    Fact<Angle> Slope, LinkSet<Opening> Openings, LinkSet<FinishSurface> FinishSurfaces);

/// <summary>One roof occurrence or explicitly partitioned roof construction scope. True sloped surface area and horizontal projection are separate facts for roofing, drainage and carbon workflows.</summary>
/// <param name="Id">Snapshot-scoped roof identity.</param>
/// <param name="Element">Shared identity and geometric representations.</param>
/// <param name="Assembly">Roof construction specification.</param>
/// <param name="Storey">Primary scheduling level.</param>
/// <param name="NetSurfaceArea">True construction surface area after declared deductions, not projected area.</param>
/// <param name="ProjectedArea">Horizontal projected area under its stated measurement basis.</param>
/// <param name="RepresentativeSlope">Inclination from horizontal; unavailable when no single slope meaningfully describes the roof.</param>
/// <param name="EdgeLength">Measured boundary length under an explicit edge inclusion rule.</param>
/// <param name="ThermalTransmittance">Declared whole-assembly U-value; not inferred from material names.</param>
/// <param name="NetSurfaceQuantity">Selected underlying measurement for traceable takeoff and duplicate prevention.</param>
/// <param name="Openings">Skylight and other hosted openings.</param>
/// <param name="FinishSurfaces">Roof finish installation surfaces.</param>
public sealed record Roof(
    SnapshotKey<Roof> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly, Fact<SnapshotKey<Storey>> Storey,
    Fact<Area> NetSurfaceArea, Fact<Area> ProjectedArea,
    Fact<Angle> RepresentativeSlope, Fact<Length> EdgeLength,
    Fact<ThermalTransmittance> ThermalTransmittance,
    Fact<SnapshotKey<QuantityObservation>> NetSurfaceQuantity,
    LinkSet<Opening> Openings, LinkSet<FinishSurface> FinishSurfaces);

/// <summary>One ceiling construction occurrence. A suspended ceiling can serve several spaces and is not identical to its room-facing finish patches.</summary>
/// <param name="Id">Snapshot-scoped ceiling identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Assembly">Ceiling construction specification.</param>
/// <param name="Storey">Primary scheduling level.</param>
/// <param name="Spaces">Spaces served by the ceiling and association completeness.</param>
/// <param name="IsSuspended">Reported suspended construction status.</param>
/// <param name="NetArea">Selected installation area with deductions recorded in evidence.</param>
/// <param name="Thickness">Nominal overall ceiling construction thickness.</param>
/// <param name="PlenumDepth">Representative service void depth, not guaranteed clearance everywhere.</param>
/// <param name="FireResistance">Declared rated duration.</param>
/// <param name="FinishSurfaces">Exposed finish patches.</param>
public sealed record Ceiling(
    SnapshotKey<Ceiling> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly, Fact<SnapshotKey<Storey>> Storey,
    LinkSet<Space> Spaces, Fact<bool> IsSuspended, Fact<Area> NetArea,
    Fact<Length> Thickness, Fact<Length> PlenumDepth,
    Fact<DurationValue> FireResistance, LinkSet<FinishSurface> FinishSurfaces);

/// <summary>The operating mechanism of a complete door assembly; a subtype alone does not establish accessibility or egress suitability.</summary>
public enum DoorOperation
{
    /// <summary>Leaves rotate on hinges or pivots.</summary>
    Swinging,
    /// <summary>Leaves translate along a track.</summary>
    Sliding,
    /// <summary>Leaves fold together.</summary>
    Folding,
    /// <summary>Leaves revolve about a central axis.</summary>
    Revolving,
    /// <summary>A curtain or leaf rises overhead.</summary>
    Overhead,
    /// <summary>A supplied mechanism outside this vocabulary.</summary>
    Other
}

/// <summary>One door assembly occurrence, including its leaves and frame as one scheduling unit. Leaf count is explicit; multiple geometric pieces do not become multiple doors.</summary>
/// <param name="Id">Snapshot-scoped door assembly identity.</param>
/// <param name="Element">Shared identity, mark and placement.</param>
/// <param name="Product">Specified door assembly product or type.</param>
/// <param name="Opening">Host opening; it can be unknown before placement.</param>
/// <param name="AdjacentSpaces">Spaces adjoining the opening; membership is undirected and grants no travel permission.</param>
/// <param name="Operation">Operating mechanism.</param>
/// <param name="LeafCount">Number of leaves in this counted assembly.</param>
/// <param name="NominalWidth">Scheduled assembly width; distinct from unobstructed clear passage width.</param>
/// <param name="NominalHeight">Scheduled assembly height.</param>
/// <param name="ClearWidth">Declared usable passage width under the operating configuration described in evidence.</param>
/// <param name="ClearHeight">Declared usable passage height.</param>
/// <param name="FireResistance">Declared tested or specified rating duration, not an audit result.</param>
/// <param name="IsSmokeControl">Reported smoke-control property with its source evidence.</param>
/// <param name="HardwareSet">Hardware schedule or set designation.</param>
/// <param name="IsAccessible">Supplied accessibility assertion; never inferred solely from width.</param>
public sealed record Door(
    SnapshotKey<Door> Id, ElementInfo Element,
    Fact<ReferenceKey<ProductDefinition>> Product, Fact<SnapshotKey<Opening>> Opening,
    LinkSet<Space> AdjacentSpaces, Fact<DoorOperation> Operation, Fact<int> LeafCount,
    Fact<Length> NominalWidth, Fact<Length> NominalHeight,
    Fact<Length> ClearWidth, Fact<Length> ClearHeight,
    Fact<DurationValue> FireResistance, Fact<bool> IsSmokeControl,
    Fact<string> HardwareSet, Fact<bool> IsAccessible);

/// <summary>One scheduled window unit, including its frame and glazing. Curtain-wall panels are separate occurrences and must not be counted again as windows without a declared scope rule.</summary>
/// <param name="Id">Snapshot-scoped window unit identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Product">Specified window unit type.</param>
/// <param name="Opening">Host opening when established.</param>
/// <param name="Spaces">Spaces associated with the window.</param>
/// <param name="Width">Nominal overall unit width.</param>
/// <param name="Height">Nominal overall unit height.</param>
/// <param name="GlazedArea">Selected transparent glazing area, excluding frame under the stated basis.</param>
/// <param name="IsOperable">Whether the unit has an operable portion.</param>
/// <param name="OperationDescription">Opening mechanism or operable configuration.</param>
/// <param name="ThermalTransmittance">Declared whole-window U-value.</param>
/// <param name="SolarHeatGainCoefficient">Dimensionless declared solar heat gain coefficient, conventionally zero to one.</param>
/// <param name="VisibleTransmittance">Dimensionless declared visible-light transmittance, conventionally zero to one.</param>
/// <param name="GlazingSpecification">Specification designation sufficient to find the glazing requirements.</param>
public sealed record Window(
    SnapshotKey<Window> Id, ElementInfo Element,
    Fact<ReferenceKey<ProductDefinition>> Product, Fact<SnapshotKey<Opening>> Opening,
    LinkSet<Space> Spaces, Fact<Length> Width, Fact<Length> Height, Fact<Area> GlazedArea,
    Fact<bool> IsOperable, Fact<string> OperationDescription,
    Fact<ThermalTransmittance> ThermalTransmittance,
    Fact<Ratio> SolarHeatGainCoefficient, Fact<Ratio> VisibleTransmittance,
    Fact<string> GlazingSpecification);

/// <summary>One intentionally modeled void or opening through a host. It can exist without a door, window or installed service and is not itself a physical material quantity.</summary>
/// <param name="Id">Snapshot-scoped opening identity.</param>
/// <param name="Element">Shared opening identity and spatial representation.</param>
/// <param name="Host">Global identity of the wall, floor, roof or other host; resolve within this snapshot.</param>
/// <param name="Purpose">Supplied purpose, such as doorway, service penetration or unfilled aperture.</param>
/// <param name="Width">Opening width under the specified geometric basis.</param>
/// <param name="Height">Opening height under the specified geometric basis.</param>
/// <param name="Depth">Through-host depth where meaningful.</param>
/// <param name="Area">Cross-section area; do not infer rectangular area for irregular openings.</param>
/// <param name="AdjacentSpaces">Adjacent spaces, without imposing a two-room requirement.</param>
/// <param name="Doors">Door assemblies occupying this opening.</param>
/// <param name="Windows">Window units occupying this opening.</param>
public sealed record Opening(
    SnapshotKey<Opening> Id, ElementInfo Element,
    Fact<ReferenceKey<BimObject>> Host, Fact<string> Purpose,
    Fact<Length> Width, Fact<Length> Height, Fact<Length> Depth, Fact<Area> Area,
    LinkSet<Space> AdjacentSpaces, LinkSet<Door> Doors, LinkSet<Window> Windows);

/// <summary>One stair assembly connecting named levels. Flight and landing inventory can remain incomplete; this row alone is insufficient to certify an egress route.</summary>
/// <param name="Id">Snapshot-scoped stair identity.</param>
/// <param name="Element">Shared identity and spatial representations.</param>
/// <param name="Assembly">Stair construction specification.</param>
/// <param name="LowerStorey">Lower connected level under the declared vertical frame.</param>
/// <param name="UpperStorey">Upper connected level.</param>
/// <param name="MinimumClearWidth">Selected minimum usable width across the assembly, if assessed.</param>
/// <param name="TotalRise">Total vertical rise between connected walking surfaces.</param>
/// <param name="IsExternal">Reported external location.</param>
/// <param name="Flights">Flight inventory and completeness.</param>
/// <param name="Landings">Landing inventory and completeness.</param>
/// <param name="Railings">Associated guarding or handrail assemblies.</param>
public sealed record Stair(
    SnapshotKey<Stair> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    Fact<SnapshotKey<Storey>> LowerStorey, Fact<SnapshotKey<Storey>> UpperStorey,
    Fact<Length> MinimumClearWidth, Fact<Length> TotalRise, Fact<bool> IsExternal,
    LinkSet<StairFlight> Flights, LinkSet<Landing> Landings, LinkSet<Railing> Railings);

/// <summary>One uninterrupted run of stair steps. Uniform nominal tread and riser values do not prove the absence of individual deviations.</summary>
/// <param name="Id">Snapshot-scoped flight identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Stair">Parent stair assembly.</param>
/// <param name="Sequence">Supplied ordering in the assembly; not an implied connectivity edge.</param>
/// <param name="LowerLanding">Landing at the lower end, if separately represented.</param>
/// <param name="UpperLanding">Landing at the upper end, if separately represented.</param>
/// <param name="RiserCount">Number of risers in the run.</param>
/// <param name="NominalRiserHeight">Declared typical vertical step height.</param>
/// <param name="NominalTreadGoing">Declared horizontal going measured on the stated walking line.</param>
/// <param name="MinimumClearWidth">Selected minimum usable flight width.</param>
/// <param name="MinimumHeadroom">Selected minimum headroom under an explicitly documented assessment basis.</param>
public sealed record StairFlight(
    SnapshotKey<StairFlight> Id, ElementInfo Element,
    Fact<SnapshotKey<Stair>> Stair, Fact<int> Sequence,
    Fact<SnapshotKey<Landing>> LowerLanding, Fact<SnapshotKey<Landing>> UpperLanding,
    Fact<int> RiserCount, Fact<Length> NominalRiserHeight,
    Fact<Length> NominalTreadGoing, Fact<Length> MinimumClearWidth,
    Fact<Length> MinimumHeadroom);

/// <summary>One stair or ramp landing occurrence, or explicitly bounded landing region. An integral slab can share object identity with another facet; quantities must choose one scope.</summary>
/// <param name="Id">Snapshot-scoped landing identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Stair">Associated stair assembly.</param>
/// <param name="Ramp">Associated ramp assembly; a landing serving only a stair may mark this relation NotApplicable.</param>
/// <param name="Storey">Associated scheduling level, if one exists at this elevation.</param>
/// <param name="ClearWidth">Selected usable landing width.</param>
/// <param name="ClearDepth">Selected usable depth in the travel direction stated in evidence.</param>
/// <param name="NetArea">Usable landing area under its selected measurement basis.</param>
/// <param name="Assembly">Landing construction specification.</param>
/// <param name="Railings">Associated guard or handrail assemblies.</param>
public sealed record Landing(
    SnapshotKey<Landing> Id, ElementInfo Element,
    Fact<SnapshotKey<Stair>> Stair, Fact<SnapshotKey<Ramp>> Ramp, Fact<SnapshotKey<Storey>> Storey,
    Fact<Length> ClearWidth, Fact<Length> ClearDepth, Fact<Area> NetArea,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly, LinkSet<Railing> Railings);

/// <summary>One ramp assembly or explicitly bounded ramp run connecting walking surfaces. Slope and clear width support review; they do not by themselves establish an accessible or permitted egress route.</summary>
/// <param name="Id">Snapshot-scoped ramp identity.</param>
/// <param name="Element">Shared identity and path/surface representations.</param>
/// <param name="Assembly">Ramp construction specification.</param>
/// <param name="LowerStorey">Lower connected scheduling level, when applicable.</param>
/// <param name="UpperStorey">Upper connected scheduling level; a within-storey ramp may share the lower level.</param>
/// <param name="Rise">Positive vertical rise between the specified endpoints.</param>
/// <param name="HorizontalRun">Horizontal projection of the selected travel path; excludes landings unless its evidence explicitly includes them.</param>
/// <param name="MaximumLongitudinalSlope">Selected maximum rise/run ratio along the travel path, not an angle and not necessarily the average Rise/HorizontalRun.</param>
/// <param name="MaximumCrossSlope">Selected maximum transverse rise/run ratio.</param>
/// <param name="MinimumClearWidth">Selected minimum usable width between obstructions.</param>
/// <param name="Landings">Associated intermediate and end landings, with inventory completeness.</param>
/// <param name="Railings">Known handrail or guard assemblies.</param>
/// <param name="AccessibilityStatement">Supplied accessibility designation or assessment reference with evidence; unknown dimensions must not become an automatic compliance pass.</param>
public sealed record Ramp(
    SnapshotKey<Ramp> Id, ElementInfo Element,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    Fact<SnapshotKey<Storey>> LowerStorey, Fact<SnapshotKey<Storey>> UpperStorey,
    Fact<Length> Rise, Fact<Length> HorizontalRun,
    Fact<Ratio> MaximumLongitudinalSlope, Fact<Ratio> MaximumCrossSlope,
    Fact<Length> MinimumClearWidth,
    LinkSet<Landing> Landings, LinkSet<Railing> Railings,
    Fact<string> AccessibilityStatement);

/// <summary>The scheduled service role of a vertical transport installation. Roles do not authorize emergency travel.</summary>
public enum VerticalTransportRole
{
    /// <summary>A passenger lift or elevator.</summary>
    PassengerLift,
    /// <summary>A goods or freight lift.</summary>
    GoodsLift,
    /// <summary>A platform lift.</summary>
    PlatformLift,
    /// <summary>An escalator.</summary>
    Escalator,
    /// <summary>A vertical transport installation outside the listed roles.</summary>
    Other
}

/// <summary>One installed or scheduled lift, escalator or platform-lift assembly. Served storeys express service reach; they do not grant egress or evacuation authorization.</summary>
/// <param name="Id">Snapshot-scoped installation identity.</param>
/// <param name="Element">Shared identity, name and spatial representations.</param>
/// <param name="Role">Service role of the installation.</param>
/// <param name="Product">Specified equipment product or type.</param>
/// <param name="ServedStoreys">Known served levels and service inventory completeness; operational restrictions remain separate evidence.</param>
/// <param name="RatedLoad">Declared carried mass capacity, in kilograms through the Mass wrapper; not a design structural load force.</param>
/// <param name="RatedPeople">Declared simultaneous passenger capacity when applicable; not escalator passengers per hour.</param>
/// <param name="VerticalTravel">Total vertical rise between installation endpoints.</param>
/// <param name="CarClearWidth">Usable car or platform width; NotApplicable for an escalator.</param>
/// <param name="CarClearDepth">Usable car or platform depth; NotApplicable for an escalator.</param>
/// <param name="DoorClearWidth">Selected nominal or minimum landing-door clear width, with its aggregation basis in evidence.</param>
/// <param name="DoorClearHeight">Selected landing-door clear height under its declared basis.</param>
/// <param name="LandingDoors">Separately scheduled landing-door assemblies, with completeness.</param>
/// <param name="AccessibilityStatement">Supplied accessible-service designation or assessment reference; not inferred from capacity or dimensions.</param>
public sealed record VerticalTransport(
    SnapshotKey<VerticalTransport> Id, ElementInfo Element,
    Fact<VerticalTransportRole> Role, Fact<ReferenceKey<ProductDefinition>> Product,
    LinkSet<Storey> ServedStoreys, Fact<Mass> RatedLoad, Fact<int> RatedPeople,
    Fact<Length> VerticalTravel, Fact<Length> CarClearWidth, Fact<Length> CarClearDepth,
    Fact<Length> DoorClearWidth, Fact<Length> DoorClearHeight,
    LinkSet<Door> LandingDoors, Fact<string> AccessibilityStatement);

/// <summary>One railing or handrail assembly along a declared path, useful for fabrication, safety review and linear takeoff.</summary>
/// <param name="Id">Snapshot-scoped railing identity.</param>
/// <param name="Element">Shared identity and path representation.</param>
/// <param name="Product">Specified assembly type.</param>
/// <param name="Host">Host stair, landing, floor or other object.</param>
/// <param name="Role">Declared function, such as guard, handrail or combined assembly.</param>
/// <param name="PathLength">Selected centerline/path quantity, not straight-line end distance.</param>
/// <param name="Height">Declared height above the reference walking surface.</param>
/// <param name="MaximumClearOpening">Selected maximum clear opening between members when assessed.</param>
/// <param name="Material">Primary material when one material meaningfully describes the assembly.</param>
/// <param name="Finish">Specified exposed finish designation.</param>
public sealed record Railing(
    SnapshotKey<Railing> Id, ElementInfo Element,
    Fact<ReferenceKey<ProductDefinition>> Product, Fact<ReferenceKey<BimObject>> Host,
    Fact<string> Role, Fact<Length> PathLength, Fact<Length> Height,
    Fact<Length> MaximumClearOpening, Fact<ReferenceKey<Material>> Material,
    Fact<string> Finish);

/// <summary>One replaceable or scheduled facade infill panel occurrence. Panels retain individual identity for procurement and replacement without creating a class for every cladding product.</summary>
/// <param name="Id">Snapshot-scoped panel identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Host">Facade assembly or host object.</param>
/// <param name="Product">Panel product/type specification.</param>
/// <param name="PanelRole">Reported role, such as vision glazing, spandrel or opaque cladding.</param>
/// <param name="Width">Nominal scheduled width.</param>
/// <param name="Height">Nominal scheduled height.</param>
/// <param name="NetArea">Selected installed face area, not projected building elevation area.</param>
/// <param name="Thickness">Nominal overall panel thickness.</param>
/// <param name="ThermalTransmittance">Declared panel U-value under its stated testing basis.</param>
/// <param name="IsOperable">Whether the panel can open.</param>
public sealed record FacadePanel(
    SnapshotKey<FacadePanel> Id, ElementInfo Element,
    Fact<ReferenceKey<BimObject>> Host, Fact<ReferenceKey<ProductDefinition>> Product,
    Fact<string> PanelRole, Fact<Length> Width, Fact<Length> Height,
    Fact<Area> NetArea, Fact<Length> Thickness,
    Fact<ThermalTransmittance> ThermalTransmittance, Fact<bool> IsOperable);

/// <summary>One nonoverlapping finish installation scope on one physical host face. Separate room allocations do not create extra installed surface; the face identity and scope prevent double counting.</summary>
/// <param name="Id">Snapshot-scoped finish scope identity.</param>
/// <param name="Element">Shared identity and optional surface geometry.</param>
/// <param name="Host">Underlying physical wall, floor, ceiling, roof or other object.</param>
/// <param name="HostFaceIdentifier">Stable face/side designation within the host, when established.</param>
/// <param name="ScopeIdentifier">Partition identifier within that face; duplicate geometry representations do not create a new scope.</param>
/// <param name="Spaces">Spaces facing or served by the finish. An empty incomplete set preserves unassigned finishes.</param>
/// <param name="SurfaceRole">Human role such as wall face, floor finish, ceiling face or skirting.</param>
/// <param name="Assembly">Layered finish specification when applicable.</param>
/// <param name="Material">Selected finish material when a single material is meaningful.</param>
/// <param name="FinishCode">Schedule finish code.</param>
/// <param name="NetArea">Selected installation area with deductions documented in evidence.</param>
/// <param name="Perimeter">Selected installation boundary length for edge work.</param>
/// <param name="Thickness">Specified finish thickness.</param>
/// <param name="Quantity">Underlying area measurement used by the selected takeoff.</param>
public sealed record FinishSurface(
    SnapshotKey<FinishSurface> Id, ElementInfo Element,
    Fact<ReferenceKey<BimObject>> Host, Fact<string> HostFaceIdentifier,
    Fact<string> ScopeIdentifier, LinkSet<Space> Spaces, Fact<string> SurfaceRole,
    Fact<ReferenceKey<AssemblyDefinition>> Assembly, Fact<ReferenceKey<Material>> Material,
    Fact<string> FinishCode, Fact<Area> NetArea, Fact<Length> Perimeter,
    Fact<Length> Thickness, Fact<SnapshotKey<QuantityObservation>> Quantity);

/// <summary>One furniture item or explicitly scheduled furniture assembly, useful for room fitout, procurement and moves. A type definition or seat count is not an additional physical occurrence.</summary>
/// <param name="Id">Snapshot-scoped furniture identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Product">Furniture product/type specification.</param>
/// <param name="Space">Primary assigned room or space.</param>
/// <param name="FurnitureRole">Functional role such as desk, chair, storage or fixed casework.</param>
/// <param name="IsFixed">Reported fixed installation status.</param>
/// <param name="Width">Nominal product width.</param>
/// <param name="Depth">Nominal product depth.</param>
/// <param name="Height">Nominal product height.</param>
/// <param name="SeatCount">Declared seating capacity of this item when applicable.</param>
/// <param name="Finish">Scheduled finish designation.</param>
public sealed record Furniture(
    SnapshotKey<Furniture> Id, ElementInfo Element,
    Fact<ReferenceKey<ProductDefinition>> Product, Fact<SnapshotKey<Space>> Space,
    Fact<string> FurnitureRole, Fact<bool> IsFixed,
    Fact<Length> Width, Fact<Length> Depth, Fact<Length> Height,
    Fact<int> SeatCount, Fact<string> Finish);
