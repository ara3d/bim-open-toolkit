using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows;

// Wave contract R5. SourceId identifies a delivery; DocumentScope identifies the
// source document lineage when a caller has independently established it.
public enum NumericStoragePolicy { Unknown, DeclaredDescriptor, RevitInternal }
public sealed record MappingOptions(string SourceId, string ContentFingerprint,
    string DocumentScope, DateTimeOffset PreparedAt, bool NumericValuesUseDeclaredUnits = false,
    NumericStoragePolicy NumericStorage = NumericStoragePolicy.Unknown);

public sealed record MappingDiagnostic(string Code, string Subject, string Field, string Message);
public sealed record FieldCoverage(string EntityKind, string Field, int Total, int Known,
    int Missing, int Invalid, int Conflicting, int Inapplicable);

/// <summary>One typed table per core record. The positional tables predate R5; every other core record is an
/// init-only table that is empty unless a mapping domain fills it. ProjectionTables enumerates all of them.</summary>
public sealed record BuildingProjection(
    ModelSnapshot Snapshot,
    ImmutableArray<SourceRevision> SourceRevisions,
    ImmutableArray<SourceObject> SourceObjects,
    ImmutableArray<BimObject> Objects,
    ImmutableArray<Evidence> Evidence,
    ImmutableArray<Storey> Storeys,
    ImmutableArray<Space> Spaces,
    ImmutableArray<Door> Doors,
    ImmutableArray<Roof> Roofs,
    ImmutableArray<FinishSurface> Finishes,
    ImmutableArray<FieldCoverage> Coverage,
    ImmutableArray<MappingDiagnostic> Diagnostics,
    ImmutableArray<SourceDocument> Documents = default,
    ImmutableArray<InterpretationPolicy> Policies = default)
{
    public ImmutableArray<Wall> Walls { get; init; } = [];
    public ImmutableArray<Floor> Floors { get; init; } = [];
    public ImmutableArray<Ceiling> Ceilings { get; init; } = [];
    public ImmutableArray<Window> Windows { get; init; } = [];
    public ImmutableArray<Opening> Openings { get; init; } = [];
    public ImmutableArray<Stair> Stairs { get; init; } = [];
    public ImmutableArray<StairFlight> StairFlights { get; init; } = [];
    public ImmutableArray<Landing> Landings { get; init; } = [];
    public ImmutableArray<Ramp> Ramps { get; init; } = [];
    public ImmutableArray<VerticalTransport> VerticalTransports { get; init; } = [];
    public ImmutableArray<Railing> Railings { get; init; } = [];
    public ImmutableArray<FacadePanel> FacadePanels { get; init; } = [];
    public ImmutableArray<Furniture> FurnitureItems { get; init; } = [];
    public ImmutableArray<ElectricalPanel> ElectricalPanels { get; init; } = [];
    public ImmutableArray<ElectricalCircuit> ElectricalCircuits { get; init; } = [];
    public ImmutableArray<LightingFixture> LightingFixtures { get; init; } = [];
    public ImmutableArray<ElectricalDevice> ElectricalDevices { get; init; } = [];
    public ImmutableArray<CableSegment> CableSegments { get; init; } = [];
    public ImmutableArray<CableContainment> CableContainments { get; init; } = [];
    public ImmutableArray<ServiceSupport> ServiceSupports { get; init; } = [];
    public ImmutableArray<ServiceSupportAttachment> ServiceSupportAttachments { get; init; } = [];
    public ImmutableArray<ServicePenetration> ServicePenetrations { get; init; } = [];
    public ImmutableArray<PenetratingService> PenetratingServices { get; init; } = [];
    public ImmutableArray<CoordinateFrame> CoordinateFrames { get; init; } = [];
    public ImmutableArray<GeometryRepresentation> GeometryRepresentations { get; init; } = [];
    public ImmutableArray<RouteSegment> RouteSegments { get; init; } = [];
    public ImmutableArray<ObjectCorrespondence> ObjectCorrespondences { get; init; } = [];
    public ImmutableArray<PropertyConcept> PropertyConcepts { get; init; } = [];
    public ImmutableArray<PropertyObservation> PropertyObservations { get; init; } = [];
    public ImmutableArray<Classification> Classifications { get; init; } = [];
    public ImmutableArray<ClassificationAssignment> ClassificationAssignments { get; init; } = [];
    public ImmutableArray<Material> Materials { get; init; } = [];
    public ImmutableArray<ProductDefinition> ProductDefinitions { get; init; } = [];
    public ImmutableArray<AssemblyDefinition> AssemblyDefinitions { get; init; } = [];
    public ImmutableArray<QuantityScope> QuantityScopes { get; init; } = [];
    public ImmutableArray<QuantityObservation> QuantityObservations { get; init; } = [];
    public ImmutableArray<MaterialUse> MaterialUses { get; init; } = [];
    public ImmutableArray<ServiceSystem> ServiceSystems { get; init; } = [];
    public ImmutableArray<SystemMembership> SystemMemberships { get; init; } = [];
    public ImmutableArray<ServicePort> ServicePorts { get; init; } = [];
    public ImmutableArray<ServiceConnection> ServiceConnections { get; init; } = [];
    public ImmutableArray<DuctSegment> DuctSegments { get; init; } = [];
    public ImmutableArray<DuctFitting> DuctFittings { get; init; } = [];
    public ImmutableArray<AirTerminal> AirTerminals { get; init; } = [];
    public ImmutableArray<Damper> Dampers { get; init; } = [];
    public ImmutableArray<AirHandlingUnit> AirHandlingUnits { get; init; } = [];
    public ImmutableArray<Fan> Fans { get; init; } = [];
    public ImmutableArray<Pump> Pumps { get; init; } = [];
    public ImmutableArray<PipeSegment> PipeSegments { get; init; } = [];
    public ImmutableArray<PipeFitting> PipeFittings { get; init; } = [];
    public ImmutableArray<Valve> Valves { get; init; } = [];
    public ImmutableArray<SanitaryFixture> SanitaryFixtures { get; init; } = [];
    public ImmutableArray<ToiletSpecification> ToiletSpecifications { get; init; } = [];
    public ImmutableArray<Drain> Drains { get; init; } = [];
    public ImmutableArray<FireProtectionTerminal> FireProtectionTerminals { get; init; } = [];
    public ImmutableArray<Project> Projects { get; init; } = [];
    public ImmutableArray<Site> Sites { get; init; } = [];
    public ImmutableArray<Building> Buildings { get; init; } = [];
    public ImmutableArray<SpaceBoundary> SpaceBoundaries { get; init; } = [];
    public ImmutableArray<Zone> Zones { get; init; } = [];
    public ImmutableArray<ZoneMembership> ZoneMemberships { get; init; } = [];
    public ImmutableArray<StructuralMember> StructuralMembers { get; init; } = [];
    public ImmutableArray<Foundation> Foundations { get; init; } = [];
    public ImmutableArray<StructuralConnection> StructuralConnections { get; init; } = [];
    public ImmutableArray<ReinforcementGroup> ReinforcementGroups { get; init; } = [];
    public ImmutableArray<TerrainSurface> TerrainSurfaces { get; init; } = [];
    public ImmutableArray<EarthworkZone> EarthworkZones { get; init; } = [];
    public ImmutableArray<PavedArea> PavedAreas { get; init; } = [];
    public ImmutableArray<DrainageCatchment> DrainageCatchments { get; init; } = [];
    public ImmutableArray<PlantingArea> PlantingAreas { get; init; } = [];
    public ImmutableArray<LandscapeAsset> LandscapeAssets { get; init; } = [];
}

public enum WorkflowStatus { Supported, Partial, RequiresInput }
public sealed record WorkflowReport(string Id, string Title, WorkflowStatus Status,
    string Scope, ImmutableArray<string> Columns, ImmutableArray<ImmutableArray<string>> Rows,
    ImmutableArray<string> Findings);

public static class WorkflowReports
{
    public static WorkflowReport Missing(string id, string title, string scope, params string[] inputs)
        => new(id, title, WorkflowStatus.RequiresInput, scope, [], [], inputs.ToImmutableArray());
}
