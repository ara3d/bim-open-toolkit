namespace Ara3D.BimOpenSchema.BuildingModel;

// Places provide the human navigation structure used by schedules, work packages,
// space programs and portfolio queries. Membership is explicit: a missing link is
// never replaced by an inferred containment relationship or a zero elevation.

/// <summary>One project in a prepared snapshot. A project may federate many source files and buildings; it is not a source document.</summary>
/// <param name="Id">Snapshot-scoped project row identity.</param>
/// <param name="Element">Shared project identity, naming, placement and provenance.</param>
/// <param name="ProjectNumber">Owner or designer project number, independent of internal identity.</param>
/// <param name="Description">Human description of the project scope.</param>
/// <param name="OwnerName">Named owner when supplied; not inferred from file ownership.</param>
/// <param name="Phase">Reported design or delivery phase, without imposing one firm's phase vocabulary.</param>
/// <param name="OriginFrame">Coordinate frame used for project-relative spatial queries.</param>
/// <param name="Sites">Known sites and completeness of that inventory.</param>
/// <param name="Buildings">Known buildings across the federation and inventory completeness.</param>
public sealed record Project(
    SnapshotKey<Project> Id,
    ElementInfo Element,
    Fact<string> ProjectNumber,
    Fact<string> Description,
    Fact<string> OwnerName,
    Fact<string> Phase,
    Fact<SnapshotKey<CoordinateFrame>> OriginFrame,
    LinkSet<Site> Sites,
    LinkSet<Building> Buildings);

/// <summary>One site or campus extent. Supports civil work, landscaping and building grouping without treating a postal address as spatial geometry.</summary>
/// <param name="Id">Snapshot-scoped site identity.</param>
/// <param name="Element">Shared identity and spatial representation.</param>
/// <param name="Project">Project to which the site belongs.</param>
/// <param name="Address">Reported postal address; formatting remains source-specific.</param>
/// <param name="ParcelIdentifier">Jurisdictional parcel identifier, when known.</param>
/// <param name="LandArea">Declared site land area, not a geometry bounding-box area.</param>
/// <param name="SiteFrame">Frame for civil coordinates and site elevations.</param>
/// <param name="Buildings">Buildings placed on this site, with inventory completeness.</param>
/// <param name="TerrainSurfaces">Terrain representations associated with this site.</param>
public sealed record Site(
    SnapshotKey<Site> Id,
    ElementInfo Element,
    Fact<SnapshotKey<Project>> Project,
    Fact<string> Address,
    Fact<string> ParcelIdentifier,
    Fact<Area> LandArea,
    Fact<SnapshotKey<CoordinateFrame>> SiteFrame,
    LinkSet<Building> Buildings,
    LinkSet<TerrainSurface> TerrainSurfaces);

/// <summary>One building occurrence, independently identifiable across federated files. Areas carry a declared measurement standard to support defensible portfolio comparisons.</summary>
/// <param name="Id">Snapshot-scoped building identity.</param>
/// <param name="Element">Shared identity, name, spatial placement and evidence.</param>
/// <param name="Project">Owning project.</param>
/// <param name="Site">Site association when established.</param>
/// <param name="BuildingNumber">Human building designation.</param>
/// <param name="PrimaryUse">Reported primary use; mixed uses belong on spaces or zones.</param>
/// <param name="GrossFloorArea">Selected gross floor area under AreaMeasurementStandard.</param>
/// <param name="AreaMeasurementStandard">Named rule or standard for the selected building area.</param>
/// <param name="CompletionYear">Reported calendar completion year; unknown is not year zero.</param>
/// <param name="Storeys">Known storeys and inventory completeness.</param>
/// <param name="Spaces">Known spaces, including spaces whose storey association is unresolved.</param>
public sealed record Building(
    SnapshotKey<Building> Id,
    ElementInfo Element,
    Fact<SnapshotKey<Project>> Project,
    Fact<SnapshotKey<Site>> Site,
    Fact<string> BuildingNumber,
    Fact<string> PrimaryUse,
    Fact<Area> GrossFloorArea,
    Fact<string> AreaMeasurementStandard,
    Fact<int> CompletionYear,
    LinkSet<Storey> Storeys,
    LinkSet<Space> Spaces);

/// <summary>The meaning of a level datum; names alone do not establish whether an elevation is structural or finished.</summary>
public enum StoreyDatumKind
{
    /// <summary>A finished walking surface datum.</summary>
    FinishedFloor,
    /// <summary>A structural slab or framing datum.</summary>
    Structural,
    /// <summary>A general reference plane rather than a measured floor surface.</summary>
    Reference,
    /// <summary>A supplied datum meaning outside the listed conventions.</summary>
    Other
}

/// <summary>One named building level. Elevation is a coordinate along the declared frame's vertical axis, not an implicit world Z or a height above sea level.</summary>
/// <param name="Id">Snapshot-scoped storey identity.</param>
/// <param name="Element">Shared identity and spatial context.</param>
/// <param name="Building">Building containing this level.</param>
/// <param name="Number">Human floor or level designation; may be nonnumeric.</param>
/// <param name="SortOrder">Explicit presentation order; do not parse Number to infer it.</param>
/// <param name="Elevation">Signed vertical coordinate in ElevationFrame, expressed as a length.</param>
/// <param name="ElevationFrame">Frame and datum for Elevation.</param>
/// <param name="DatumKind">Meaning of the elevation plane.</param>
/// <param name="FloorToFloorHeight">Declared separation to the next intended floor datum; not necessarily the next row in sort order.</param>
/// <param name="Spaces">Associated spaces and association completeness.</param>
public sealed record Storey(
    SnapshotKey<Storey> Id,
    ElementInfo Element,
    Fact<SnapshotKey<Building>> Building,
    Fact<string> Number,
    Fact<int> SortOrder,
    Fact<Length> Elevation,
    Fact<SnapshotKey<CoordinateFrame>> ElevationFrame,
    Fact<StoreyDatumKind> DatumKind,
    Fact<Length> FloorToFloorHeight,
    LinkSet<Space> Spaces);

/// <summary>The observed modeling or enclosure state of a space, independently of whether it is occupied.</summary>
public enum SpaceEnclosureKind
{
    /// <summary>Boundaries define an enclosed space according to the supplied evidence.</summary>
    Enclosed,
    /// <summary>An intentionally open space such as an open office zone or terrace.</summary>
    Open,
    /// <summary>A scheduled space exists without an established enclosure.</summary>
    ScheduledOnly,
    /// <summary>Boundaries exist but do not yet establish a closed region.</summary>
    IncompleteBoundary
}

/// <summary>One bounded or explicitly scheduled space occurrence, including rooms and outdoor usable spaces. A space can exist before geometry, finishes or services are known.</summary>
/// <param name="Id">Snapshot-scoped space identity.</param>
/// <param name="Element">Shared identity, name, location and representations.</param>
/// <param name="Number">Room or space number; not a uniqueness guarantee.</param>
/// <param name="Building">Building association when established.</param>
/// <param name="Storey">Primary scheduling storey; a multilevel space need not be geometrically confined to it.</param>
/// <param name="Use">Activity or functional use, such as office, washroom or plant room.</param>
/// <param name="Department">Reported department or tenant assignment.</param>
/// <param name="Enclosure">Observed enclosure or scheduling state.</param>
/// <param name="NetFloorArea">Selected usable floor area under AreaMeasurementStandard.</param>
/// <param name="AreaMeasurementStandard">Rule used to define the selected net floor area.</param>
/// <param name="ClearHeight">Selected clear occupied height; variable height requires geometric investigation.</param>
/// <param name="NetVolume">Selected enclosed air volume, not a bounding-box volume.</param>
/// <param name="DesignOccupancy">Declared design occupant count; not a computed code-compliant capacity.</param>
/// <param name="BoundaryRepresentation">Selected space enclosure geometry, independently of whether finish installations are modeled.</param>
/// <param name="Boundaries">Directed boundary patches and their host or adjacency evidence; independent of finish installation inventory.</param>
/// <param name="FinishSurfaces">Associated finish installation scopes and completeness; finishes are not the entire space boundary model.</param>
/// <param name="Doors">Associated doors; membership does not establish permitted egress direction.</param>
public sealed record Space(
    SnapshotKey<Space> Id,
    ElementInfo Element,
    Fact<string> Number,
    Fact<SnapshotKey<Building>> Building,
    Fact<SnapshotKey<Storey>> Storey,
    Fact<string> Use,
    Fact<string> Department,
    Fact<SpaceEnclosureKind> Enclosure,
    Fact<Area> NetFloorArea,
    Fact<string> AreaMeasurementStandard,
    Fact<Length> ClearHeight,
    Fact<Volume> NetVolume,
    Fact<int> DesignOccupancy,
    Fact<SnapshotKey<GeometryRepresentation>> BoundaryRepresentation,
    LinkSet<SpaceBoundary> Boundaries,
    LinkSet<FinishSurface> FinishSurfaces,
    LinkSet<Door> Doors);

/// <summary>The physical interpretation of a space boundary patch. Virtual boundaries may divide an open plan without any physical host.</summary>
public enum SpaceBoundaryKind
{
    /// <summary>A boundary associated with a physical construction or surface.</summary>
    Physical,
    /// <summary>An intentional mathematical or scheduling division without a physical separating construction.</summary>
    Virtual,
    /// <summary>A boundary interpretation outside the listed conventions.</summary>
    Other
}

/// <summary>One directed patch of one space's boundary. Two spaces facing the same wall have distinct boundary rows; these describe enclosure and adjacency, not extra walls or installed finishes.</summary>
/// <param name="Id">Snapshot-scoped boundary assertion identity.</param>
/// <param name="Space">Space whose enclosure this patch describes.</param>
/// <param name="Kind">Physical or virtual meaning of the boundary.</param>
/// <param name="Host">Global identity of the separating wall, floor, ceiling or other object; a virtual boundary may have no applicable host.</param>
/// <param name="HostFaceIdentifier">Stable host-side or face designation when established, enabling reconciliation with finish scopes.</param>
/// <param name="AdjacentSpace">Space across the patch when established. NotApplicable may describe an exterior boundary; an unknown association does not prove exterior exposure.</param>
/// <param name="IsExterior">Explicit exterior exposure assertion; not inferred from the absence of AdjacentSpace.</param>
/// <param name="OppositeBoundary">Matching directed patch on the other space, where the relationship has been established.</param>
/// <param name="Area">Selected actual boundary patch area with deduction and segmentation basis in its evidence; not a finish takeoff.</param>
/// <param name="Geometry">Selected patch geometry with a declared coordinate frame.</param>
/// <param name="Evidence">Provenance of boundary identity and membership. Individual facts retain their own evidence.</param>
public sealed record SpaceBoundary(
    SnapshotKey<SpaceBoundary> Id,
    SnapshotKey<Space> Space,
    Fact<SpaceBoundaryKind> Kind,
    Fact<ReferenceKey<BimObject>> Host,
    Fact<string> HostFaceIdentifier,
    Fact<SnapshotKey<Space>> AdjacentSpace,
    Fact<bool> IsExterior,
    Fact<SnapshotKey<SpaceBoundary>> OppositeBoundary,
    Fact<Area> Area,
    Fact<SnapshotKey<GeometryRepresentation>> Geometry,
    ReferenceKey<Evidence> Evidence);

/// <summary>One named grouping for a stated purpose, such as a department, tenant, fire compartment or HVAC zone. Zones may overlap; membership is not a place hierarchy.</summary>
/// <param name="Id">Snapshot-scoped zone identity.</param>
/// <param name="Element">Shared identity, name and optional spatial representation.</param>
/// <param name="Purpose">Explicit grouping purpose, retaining the originating discipline's vocabulary.</param>
/// <param name="Building">Primary building scope, when applicable.</param>
/// <param name="Description">Human explanation of membership intent.</param>
/// <param name="RequirementSet">Requirements governing the zone, when supplied.</param>
/// <param name="Memberships">Membership assertions and their completeness.</param>
public sealed record Zone(
    SnapshotKey<Zone> Id,
    ElementInfo Element,
    Fact<string> Purpose,
    Fact<SnapshotKey<Building>> Building,
    Fact<string> Description,
    Fact<ReferenceKey<RequirementSet>> RequirementSet,
    LinkSet<ZoneMembership> Memberships);

/// <summary>One membership assertion connecting a zone to an object in this snapshot. An object may belong to multiple zones for different purposes; never sum overlapping zone totals without an allocation rule.</summary>
/// <param name="Id">Snapshot-scoped membership identity.</param>
/// <param name="Zone">Zone receiving the member.</param>
/// <param name="Member">Global object identity; resolution must use this row's snapshot.</param>
/// <param name="MembershipBasis">Declared, spatially derived or manually assigned basis in human-readable terms.</param>
/// <param name="AllocationFraction">Optional fraction allocated to the zone under an explicit counting policy; absence does not mean one.</param>
/// <param name="Evidence">Provenance of the membership assertion.</param>
public sealed record ZoneMembership(
    SnapshotKey<ZoneMembership> Id,
    SnapshotKey<Zone> Zone,
    ReferenceKey<BimObject> Member,
    Fact<string> MembershipBasis,
    Fact<Ratio> AllocationFraction,
    ReferenceKey<Evidence> Evidence);
