using System.Collections;
using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

/// <summary>Accumulates typed rows during one mapping call. Apply is the single place that knows every table of the
/// projection, so adding a table means adding one line here and one property on BuildingProjection.</summary>
[Platonic.TrustedMutableKernel]
public sealed class ProjectionBuilder
{
    private readonly Dictionary<Type, IList> tables = [];

    public int Count => tables.Values.Sum(list => list.Count);

    public void Add<T>(T row) where T : class => List<T>().Add(row);

    public ImmutableArray<T> Rows<T>() where T : class => [.. List<T>()];

    /// <summary>Rewrites every row of one table, for back-links that need the other tables to be complete.</summary>
    public void Update<T>(Func<T, T> update) where T : class
    {
        var list = List<T>();
        for (var i = 0; i < list.Count; i++) list[i] = update(list[i]);
    }

    private List<T> List<T>() where T : class
    {
        if (tables.TryGetValue(typeof(T), out var existing)) return (List<T>)existing;
        ProjectionTables.Table(typeof(T));
        var created = new List<T>();
        tables[typeof(T)] = created;
        return created;
    }

    public BuildingProjection Apply(BuildingProjection projection) => projection with
    {
        Storeys = Rows<Storey>(), Spaces = Rows<Space>(), Doors = Rows<Door>(), Roofs = Rows<Roof>(), Finishes = Rows<FinishSurface>(),
        Walls = Rows<Wall>(), Floors = Rows<Floor>(), Ceilings = Rows<Ceiling>(), Windows = Rows<Window>(), Openings = Rows<Opening>(),
        Stairs = Rows<Stair>(), StairFlights = Rows<StairFlight>(), Landings = Rows<Landing>(), Ramps = Rows<Ramp>(),
        VerticalTransports = Rows<VerticalTransport>(), Railings = Rows<Railing>(), FacadePanels = Rows<FacadePanel>(), FurnitureItems = Rows<Furniture>(),
        ElectricalPanels = Rows<ElectricalPanel>(), ElectricalCircuits = Rows<ElectricalCircuit>(), LightingFixtures = Rows<LightingFixture>(),
        ElectricalDevices = Rows<ElectricalDevice>(), CableSegments = Rows<CableSegment>(), CableContainments = Rows<CableContainment>(),
        ServiceSupports = Rows<ServiceSupport>(), ServiceSupportAttachments = Rows<ServiceSupportAttachment>(),
        ServicePenetrations = Rows<ServicePenetration>(), PenetratingServices = Rows<PenetratingService>(),
        CoordinateFrames = Rows<CoordinateFrame>(), GeometryRepresentations = Rows<GeometryRepresentation>(), RouteSegments = Rows<RouteSegment>(),
        ObjectCorrespondences = Rows<ObjectCorrespondence>(), PropertyConcepts = Rows<PropertyConcept>(), PropertyObservations = Rows<PropertyObservation>(),
        Classifications = Rows<Classification>(), ClassificationAssignments = Rows<ClassificationAssignment>(),
        Materials = Rows<Material>(), ProductDefinitions = Rows<ProductDefinition>(), AssemblyDefinitions = Rows<AssemblyDefinition>(),
        QuantityScopes = Rows<QuantityScope>(), QuantityObservations = Rows<QuantityObservation>(), MaterialUses = Rows<MaterialUse>(),
        ServiceSystems = Rows<ServiceSystem>(), SystemMemberships = Rows<SystemMembership>(), ServicePorts = Rows<ServicePort>(),
        ServiceConnections = Rows<ServiceConnection>(), DuctSegments = Rows<DuctSegment>(), DuctFittings = Rows<DuctFitting>(),
        AirTerminals = Rows<AirTerminal>(), Dampers = Rows<Damper>(), AirHandlingUnits = Rows<AirHandlingUnit>(), Fans = Rows<Fan>(), Pumps = Rows<Pump>(),
        PipeSegments = Rows<PipeSegment>(), PipeFittings = Rows<PipeFitting>(), Valves = Rows<Valve>(), SanitaryFixtures = Rows<SanitaryFixture>(),
        ToiletSpecifications = Rows<ToiletSpecification>(), Drains = Rows<Drain>(), FireProtectionTerminals = Rows<FireProtectionTerminal>(),
        Projects = Rows<Project>(), Sites = Rows<Site>(), Buildings = Rows<Building>(), SpaceBoundaries = Rows<SpaceBoundary>(),
        Zones = Rows<Zone>(), ZoneMemberships = Rows<ZoneMembership>(), StructuralMembers = Rows<StructuralMember>(), Foundations = Rows<Foundation>(),
        StructuralConnections = Rows<StructuralConnection>(), ReinforcementGroups = Rows<ReinforcementGroup>(), TerrainSurfaces = Rows<TerrainSurface>(),
        EarthworkZones = Rows<EarthworkZone>(), PavedAreas = Rows<PavedArea>(), DrainageCatchments = Rows<DrainageCatchment>(),
        PlantingAreas = Rows<PlantingArea>(), LandscapeAssets = Rows<LandscapeAsset>()
    };
}
