namespace Ara3D.BimOpenSchema.BuildingModel;

// Physical structural and civil scopes support schedules and takeoffs. They do
// not constitute a structural analysis model or prove drainage performance.

/// <summary>The scheduling function of a structural member; its physical identity is independent of an analytical idealization.</summary>
public enum StructuralMemberRole
{
    /// <summary>A primarily beam-like framing member.</summary>
    Beam,
    /// <summary>A primarily column-like framing member.</summary>
    Column,
    /// <summary>A bracing member.</summary>
    Brace,
    /// <summary>A joist member.</summary>
    Joist,
    /// <summary>A roof rafter.</summary>
    Rafter,
    /// <summary>A purlin member.</summary>
    Purlin,
    /// <summary>A truss chord; the complete truss remains a different counting scope.</summary>
    TrussChord,
    /// <summary>A truss web member.</summary>
    TrussWeb,
    /// <summary>A structural member outside the listed roles.</summary>
    Other
}

/// <summary>One physical structural member occurrence, such as a beam, column or brace. Sharing one shape keeps steel, timber and concrete schedules comparable without inventing product classes.</summary>
/// <param name="Id">Snapshot-scoped member identity.</param>
/// <param name="Element">Shared physical identity, placement and geometry.</param>
/// <param name="Role">Structural scheduling role.</param>
/// <param name="Product">Reusable member specification or section product.</param>
/// <param name="Material">Primary structural material.</param>
/// <param name="MaterialGrade">Declared grade designation; not inferred from visual appearance.</param>
/// <param name="SectionDesignation">Section schedule designation, such as a rolled shape or timber section name.</param>
/// <param name="Storey">Primary scheduling level.</param>
/// <param name="AxisRepresentation">Geometric member reference axis, with its own coordinate frame.</param>
/// <param name="CutLength">Fabrication cut length when supplied.</param>
/// <param name="CenterlineLength">Selected reference-axis length; distinct from cut length and projected span.</param>
/// <param name="NetVolume">Selected physical material volume after stated deductions.</param>
/// <param name="Mass">Selected member mass under its declared material and measurement basis.</param>
/// <param name="FireProtection">Specified protection system or designation.</param>
/// <param name="Connections">Known physical connections and inventory completeness.</param>
public sealed record StructuralMember(
    SnapshotKey<StructuralMember> Id, ElementInfo Element,
    Fact<StructuralMemberRole> Role, Fact<ReferenceKey<ProductDefinition>> Product,
    Fact<ReferenceKey<Material>> Material, Fact<string> MaterialGrade,
    Fact<string> SectionDesignation, Fact<SnapshotKey<Storey>> Storey,
    Fact<SnapshotKey<GeometryRepresentation>> AxisRepresentation,
    Fact<Length> CutLength, Fact<Length> CenterlineLength,
    Fact<Volume> NetVolume, Fact<Mass> Mass, Fact<string> FireProtection,
    LinkSet<StructuralConnection> Connections);

/// <summary>The declared physical foundation form, independent of its analytical boundary conditions.</summary>
public enum FoundationRole
{
    /// <summary>An isolated spread footing.</summary>
    PadFooting,
    /// <summary>A continuous strip footing.</summary>
    StripFooting,
    /// <summary>A mat or raft foundation.</summary>
    Raft,
    /// <summary>One pile occurrence rather than an inferred pile group.</summary>
    Pile,
    /// <summary>A pile cap.</summary>
    PileCap,
    /// <summary>A foundation wall.</summary>
    FoundationWall,
    /// <summary>A foundation form outside this vocabulary.</summary>
    Other
}

/// <summary>One physical foundation occurrence at an explicit counting scope. Piles and pile caps are separate occurrences; group totals must not duplicate their material.</summary>
/// <param name="Id">Snapshot-scoped foundation identity.</param>
/// <param name="Element">Shared identity and geometry.</param>
/// <param name="Role">Declared foundation form.</param>
/// <param name="Material">Primary structural material.</param>
/// <param name="MaterialGrade">Specified material grade.</param>
/// <param name="Length">Scheduled plan length or pile length as explained by its measurement evidence.</param>
/// <param name="Width">Scheduled plan width.</param>
/// <param name="Depth">Scheduled construction depth; not an absolute ground elevation.</param>
/// <param name="NetVolume">Selected net material volume.</param>
/// <param name="BearingPressure">Specified allowable or design bearing pressure, whose role must be stated in evidence.</param>
/// <param name="SupportedMembers">Known supported physical members; completeness does not prove structural adequacy.</param>
/// <param name="Reinforcement">Known reinforcement groups belonging to this foundation.</param>
public sealed record Foundation(
    SnapshotKey<Foundation> Id, ElementInfo Element, Fact<FoundationRole> Role,
    Fact<ReferenceKey<Material>> Material, Fact<string> MaterialGrade,
    Fact<Length> Length, Fact<Length> Width, Fact<Length> Depth,
    Fact<Volume> NetVolume, Fact<Pressure> BearingPressure,
    LinkSet<StructuralMember> SupportedMembers, LinkSet<ReinforcementGroup> Reinforcement);

/// <summary>One physical connection assembly joining identified objects. This is fabrication and coordination data; a connection name does not establish analytical stiffness or capacity.</summary>
/// <param name="Id">Snapshot-scoped connection assembly identity.</param>
/// <param name="Element">Shared identity and physical placement.</param>
/// <param name="Product">Connection assembly specification.</param>
/// <param name="ConnectionRole">Declared role or detail type.</param>
/// <param name="PrimaryMember">Principal member, if the detail establishes one.</param>
/// <param name="ConnectedMembers">Members participating in the connection.</param>
/// <param name="OtherHost">Optional nonmember support, such as a foundation or wall.</param>
/// <param name="DetailReference">Drawing, detail or specification designation.</param>
/// <param name="BoltCount">Declared bolts in this assembly; not a count inferred from mesh instances.</param>
/// <param name="BoltDesignation">Scheduled bolt size and grade designation.</param>
/// <param name="WeldLength">Selected total specified weld length under the stated weld inclusion basis.</param>
/// <param name="InstallationMethod">Shop, field or other installation instruction when supplied.</param>
public sealed record StructuralConnection(
    SnapshotKey<StructuralConnection> Id, ElementInfo Element,
    Fact<ReferenceKey<ProductDefinition>> Product, Fact<string> ConnectionRole,
    Fact<SnapshotKey<StructuralMember>> PrimaryMember, LinkSet<StructuralMember> ConnectedMembers,
    Fact<ReferenceKey<BimObject>> OtherHost, Fact<string> DetailReference,
    Fact<int> BoltCount, Fact<string> BoltDesignation, Fact<Length> WeldLength,
    Fact<string> InstallationMethod);

/// <summary>One scheduled set of reinforcing bars sharing a bar mark and shape within one host. It is a group quantity: do not add individually represented constituent bars to it.</summary>
/// <param name="Id">Snapshot-scoped group identity.</param>
/// <param name="Element">Shared group identity and optional geometry.</param>
/// <param name="Host">Reinforced physical object.</param>
/// <param name="BarMark">Fabrication schedule designation.</param>
/// <param name="Material">Reinforcement material.</param>
/// <param name="Grade">Declared reinforcement grade.</param>
/// <param name="Diameter">Nominal bar diameter.</param>
/// <param name="BarCount">Number of bars represented by this group.</param>
/// <param name="ShapeCode">Bending schedule shape designation.</param>
/// <param name="IndividualCutLength">Cut length of one representative bar; variable-length groups require additional detail.</param>
/// <param name="TotalLength">Selected sum of group bar lengths.</param>
/// <param name="TotalMass">Selected group steel mass.</param>
/// <param name="Spacing">Declared center-to-center placement spacing where applicable.</param>
/// <param name="Cover">Specified clear cover to the reinforcement surface.</param>
public sealed record ReinforcementGroup(
    SnapshotKey<ReinforcementGroup> Id, ElementInfo Element,
    Fact<ReferenceKey<BimObject>> Host, Fact<string> BarMark,
    Fact<ReferenceKey<Material>> Material, Fact<string> Grade,
    Fact<Length> Diameter, Fact<int> BarCount, Fact<string> ShapeCode,
    Fact<Length> IndividualCutLength, Fact<Length> TotalLength,
    Fact<Mass> TotalMass, Fact<Length> Spacing, Fact<Length> Cover);

/// <summary>One terrain surface for a stated survey or design condition. Existing and proposed terrain are separate comparable surfaces; no implicit survey accuracy is assigned.</summary>
/// <param name="Id">Snapshot-scoped terrain surface identity.</param>
/// <param name="Element">Shared identity and spatial representations.</param>
/// <param name="Site">Associated site.</param>
/// <param name="Condition">Existing, proposed or other explicitly stated terrain condition.</param>
/// <param name="SurveyReference">Survey issue or design reference.</param>
/// <param name="SurfaceGeometry">Geometry used for terrain queries.</param>
/// <param name="HorizontalFootprintArea">Projected extent of the modeled surface.</param>
/// <param name="SurfaceArea">Actual terrain surface area under the selected tessellation or measurement basis.</param>
/// <param name="VerticalAccuracy">Reported vertical survey accuracy, not the floating-point precision of coordinates.</param>
/// <param name="MinimumElevation">Selected minimum vertical coordinate in ElevationFrame.</param>
/// <param name="MaximumElevation">Selected maximum vertical coordinate in ElevationFrame.</param>
/// <param name="ElevationFrame">Coordinate frame and vertical datum for the elevation extrema.</param>
public sealed record TerrainSurface(
    SnapshotKey<TerrainSurface> Id, ElementInfo Element,
    Fact<SnapshotKey<Site>> Site, Fact<string> Condition, Fact<string> SurveyReference,
    Fact<SnapshotKey<GeometryRepresentation>> SurfaceGeometry,
    Fact<Area> HorizontalFootprintArea, Fact<Area> SurfaceArea,
    Fact<Length> VerticalAccuracy, Fact<Length> MinimumElevation,
    Fact<Length> MaximumElevation, Fact<SnapshotKey<CoordinateFrame>> ElevationFrame);

/// <summary>One bounded earthwork comparison scope between explicitly selected before and after surfaces. Cut and fill remain separate; missing terrain cannot produce a zero balance.</summary>
/// <param name="Id">Snapshot-scoped earthwork zone identity.</param>
/// <param name="Element">Shared scope identity and boundary representation.</param>
/// <param name="Site">Associated site.</param>
/// <param name="ExistingSurface">Before surface used by the comparison.</param>
/// <param name="DesignSurface">After surface used by the comparison.</param>
/// <param name="SoilClassification">Declared soil or excavated material classification.</param>
/// <param name="CutVolume">Positive in-situ excavation volume under the comparison's declared basis.</param>
/// <param name="FillVolume">Positive in-place fill volume under the comparison's declared basis.</param>
/// <param name="BulkingFactor">Declared loose-volume divided by in-situ-volume ratio; unavailable means no transport-volume conversion.</param>
/// <param name="CompactionFactor">Declared compacted-volume divided by loose-volume ratio.</param>
/// <param name="MeasurementMethod">Method and tolerance explanation for the surface comparison.</param>
public sealed record EarthworkZone(
    SnapshotKey<EarthworkZone> Id, ElementInfo Element, Fact<SnapshotKey<Site>> Site,
    Fact<SnapshotKey<TerrainSurface>> ExistingSurface, Fact<SnapshotKey<TerrainSurface>> DesignSurface,
    Fact<string> SoilClassification, Fact<Volume> CutVolume, Fact<Volume> FillVolume,
    Fact<Ratio> BulkingFactor, Fact<Ratio> CompactionFactor, Fact<string> MeasurementMethod);

/// <summary>One bounded paving installation scope with a specified construction. Parking counts and transport routes belong to separate use or operational data.</summary>
/// <param name="Id">Snapshot-scoped paved area identity.</param>
/// <param name="Element">Shared identity and surface geometry.</param>
/// <param name="Site">Associated site.</param>
/// <param name="Use">Declared purpose such as pedestrian path, roadway or service apron.</param>
/// <param name="Assembly">Paving construction including layers where specified.</param>
/// <param name="NetSurfaceArea">Actual installed surface area after declared deductions.</param>
/// <param name="ProjectedArea">Horizontal plan projection used for civil area schedules.</param>
/// <param name="Thickness">Nominal overall construction thickness.</param>
/// <param name="IsPermeable">Declared permeable construction status; does not imply a validated infiltration rate.</param>
/// <param name="RepresentativeSlope">Representative surface inclination from horizontal.</param>
/// <param name="Catchments">Associated drainage catchments and mapping completeness.</param>
public sealed record PavedArea(
    SnapshotKey<PavedArea> Id, ElementInfo Element, Fact<SnapshotKey<Site>> Site,
    Fact<string> Use, Fact<ReferenceKey<AssemblyDefinition>> Assembly,
    Fact<Area> NetSurfaceArea, Fact<Area> ProjectedArea, Fact<Length> Thickness,
    Fact<bool> IsPermeable, Fact<Angle> RepresentativeSlope,
    LinkSet<DrainageCatchment> Catchments);

/// <summary>One contributing drainage area under a stated scenario. Catchment identity does not itself prove hydraulic connectivity or adequate capacity.</summary>
/// <param name="Id">Snapshot-scoped catchment identity.</param>
/// <param name="Element">Shared scope identity and boundary geometry.</param>
/// <param name="Site">Associated site.</param>
/// <param name="Scenario">Named design condition or event reference.</param>
/// <param name="ProjectedArea">Horizontal contributing area; do not substitute sloped surface area silently.</param>
/// <param name="RunoffCoefficient">Declared dimensionless coefficient under the supplied method.</param>
/// <param name="DesignOutflow">Selected design discharge; evidence must identify method and event.</param>
/// <param name="ReceivingObject">Drain, channel, watercourse or other receiving object's global identity, resolved in this snapshot.</param>
/// <param name="TimeOfConcentration">Declared or derived travel duration under its stated method.</param>
/// <param name="CalculationReference">External design calculation or rule reference.</param>
public sealed record DrainageCatchment(
    SnapshotKey<DrainageCatchment> Id, ElementInfo Element, Fact<SnapshotKey<Site>> Site,
    Fact<string> Scenario, Fact<Area> ProjectedArea, Fact<Ratio> RunoffCoefficient,
    Fact<FlowRate> DesignOutflow, Fact<ReferenceKey<BimObject>> ReceivingObject,
    Fact<DurationValue> TimeOfConcentration, Fact<string> CalculationReference);

/// <summary>One bounded planting installation scope, useful for landscape takeoffs, maintenance and ecological reporting. Individual trees are separately countable assets when modeled.</summary>
/// <param name="Id">Snapshot-scoped planting area identity.</param>
/// <param name="Element">Shared identity and planting boundary geometry.</param>
/// <param name="Site">Associated site.</param>
/// <param name="PlantingSpecification">Mix, planting schedule or specification designation.</param>
/// <param name="PlantingUse">Declared planting function, such as meadow, bed, lawn or habitat.</param>
/// <param name="NetArea">Selected planted surface area under its stated measurement basis.</param>
/// <param name="SoilDepth">Specified growing-medium depth.</param>
/// <param name="SoilVolume">Selected growing-medium volume; variable depth prevents naive area multiplication.</param>
/// <param name="IrrigationMethod">Specified irrigation approach.</param>
/// <param name="MaintenanceRegime">Named maintenance specification or regime.</param>
/// <param name="IndividualAssets">Separately represented plants or landscape assets; inventory completeness is explicit.</param>
public sealed record PlantingArea(
    SnapshotKey<PlantingArea> Id, ElementInfo Element, Fact<SnapshotKey<Site>> Site,
    Fact<string> PlantingSpecification, Fact<string> PlantingUse,
    Fact<Area> NetArea, Fact<Length> SoilDepth, Fact<Volume> SoilVolume,
    Fact<string> IrrigationMethod, Fact<string> MaintenanceRegime,
    LinkSet<LandscapeAsset> IndividualAssets);

/// <summary>One individually scheduled landscape asset, such as a tree, shrub, site furnishing or landscape feature. Role-specific facts may be not applicable rather than unknown.</summary>
/// <param name="Id">Snapshot-scoped landscape asset identity.</param>
/// <param name="Element">Shared identity and placement.</param>
/// <param name="Site">Associated site.</param>
/// <param name="PlantingArea">Associated planting scope when applicable.</param>
/// <param name="Role">Human role such as tree, shrub, bench, bollard or water feature.</param>
/// <param name="Product">Product specification for manufactured assets.</param>
/// <param name="BotanicalName">Botanical identification for living plant assets.</param>
/// <param name="CommonName">Common plant name when supplied.</param>
/// <param name="InstallationHeight">Scheduled plant or asset height at installation.</param>
/// <param name="MatureSpread">Expected mature plant spread under the referenced specification.</param>
/// <param name="TrunkDiameter">Measured or specified trunk diameter with measurement height in its evidence.</param>
/// <param name="Condition">Reported condition or retained/proposed designation.</param>
/// <param name="MaintenanceReference">Maintenance instruction or schedule reference.</param>
public sealed record LandscapeAsset(
    SnapshotKey<LandscapeAsset> Id, ElementInfo Element,
    Fact<SnapshotKey<Site>> Site, Fact<SnapshotKey<PlantingArea>> PlantingArea,
    Fact<string> Role, Fact<ReferenceKey<ProductDefinition>> Product,
    Fact<string> BotanicalName, Fact<string> CommonName,
    Fact<Length> InstallationHeight, Fact<Length> MatureSpread,
    Fact<Length> TrunkDiameter, Fact<string> Condition, Fact<string> MaintenanceReference);
