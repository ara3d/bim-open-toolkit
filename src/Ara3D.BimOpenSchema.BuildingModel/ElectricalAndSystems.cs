namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>Practical electrical device families used by installers and facilities teams.</summary>
public enum ElectricalDeviceKind { Unknown, SocketOutlet, Switch, Isolator, JunctionBox, Sensor, Detector, Alarm, DataOutlet, AccessControlReader, Controller, Other }
/// <summary>Declared cable management product family.</summary>
public enum CableContainmentKind { Unknown, Conduit, Trunking, CableTray, CableLadder, Basket, Raceway, Other }
/// <summary>Declared structural support arrangement for building services.</summary>
public enum ServiceSupportKind { Unknown, Hanger, Trapeze, Bracket, Frame, Plinth, SeismicBrace, Other }

/// <summary>One electrical distribution panel occurrence, with board ratings separate from circuit loads.</summary>
/// <param name="Id">Panel row identity.</param><param name="Element">Shared occurrence identity, provenance, placement, and geometry.</param>
/// <param name="SpaceId">Assigned electrical room or space.</param><param name="PanelDesignation">Recorded panel designation used in circuit schedules.</param>
/// <param name="SupplyVoltage">Declared supply voltage, with line-to-line or line-to-neutral basis in evidence.</param><param name="PhaseCount">Declared number of phases.</param>
/// <param name="BusbarRating">Continuous busbar current rating.</param><param name="MainProtectionRating">Main protective device current rating.</param>
/// <param name="ShortCircuitRating">Declared short-circuit current withstand or assembly rating, with basis in evidence.</param><param name="AvailableWays">Total usable outgoing circuit positions, not an inferred spare count.</param>
/// <param name="EnclosureRating">Recorded ingress or enclosure classification.</param><param name="Circuits">Assigned outgoing circuits with completeness.</param>
/// <param name="IncomingPorts">Documented incoming electrical endpoints.</param><param name="RequiredWorkingClearance">Declared clear working distance; full directional working envelope belongs in geometry.</param>
public sealed record ElectricalPanel(SnapshotKey<ElectricalPanel> Id, ElementInfo Element,
    Fact<SnapshotKey<Space>> SpaceId, Fact<string> PanelDesignation, Fact<Voltage> SupplyVoltage,
    Fact<int> PhaseCount, Fact<ElectricCurrent> BusbarRating, Fact<ElectricCurrent> MainProtectionRating,
    Fact<ElectricCurrent> ShortCircuitRating, Fact<int> AvailableWays, Fact<string> EnclosureRating,
    LinkSet<ElectricalCircuit> Circuits, LinkSet<ServicePort> IncomingPorts, Fact<Length> RequiredWorkingClearance);

/// <summary>One logical outgoing electrical circuit. Circuit membership does not establish a physical cable route or continuity.</summary>
/// <param name="Id">Circuit row identity.</param><param name="PanelId">Supplying panel when resolved.</param><param name="Designation">Circuit designation within its panel.</param>
/// <param name="Purpose">Recorded service or load description.</param><param name="Voltage">Operating voltage with electrical basis in evidence.</param><param name="PoleCount">Number of protective device poles.</param>
/// <param name="ProtectionRating">Protective device current rating.</param><param name="ConnectedLoad">Sum of documented connected real power, before diversity.</param>
/// <param name="DemandLoad">Design real power after the evidenced demand method.</param><param name="PowerFactor">Declared load power factor, separate from diversity.</param>
/// <param name="IsEmergency">Whether assigned to emergency supply.</param><param name="ResidualCurrentProtection">Whether residual-current protection is documented.</param>
/// <param name="SystemId">Associated logical power system.</param><param name="Ports">Documented circuit endpoints and completeness.</param><param name="Evidence">Evidence for circuit identity and panel association.</param>
public sealed record ElectricalCircuit(SnapshotKey<ElectricalCircuit> Id, Fact<SnapshotKey<ElectricalPanel>> PanelId,
    string Designation, Fact<string> Purpose, Fact<Voltage> Voltage, Fact<int> PoleCount,
    Fact<ElectricCurrent> ProtectionRating, Fact<Power> ConnectedLoad, Fact<Power> DemandLoad,
    Fact<Ratio> PowerFactor, Fact<bool> IsEmergency, Fact<bool> ResidualCurrentProtection,
    Fact<SnapshotKey<ServiceSystem>> SystemId, LinkSet<ServicePort> Ports, ReferenceKey<Evidence> Evidence);

/// <summary>One installed or planned luminaire assembly, independently of the number of internal lamps or light-source representations.</summary>
/// <param name="Id">Luminaire row identity.</param><param name="Element">Shared occurrence information.</param><param name="SpaceId">Assigned space.</param><param name="CircuitId">Assigned supply circuit.</param>
/// <param name="FixtureStyle">Recorded luminaire style or schedule type.</param><param name="InputPower">Rated total electrical input of the assembly.</param>
/// <param name="LuminousFluxLumens">Rated delivered luminous flux in lumens, with test conditions in evidence.</param><param name="CorrelatedColorTemperatureKelvin">Specified correlated color temperature in kelvin.</param>
/// <param name="ColorRenderingIndex">Specified color rendering index under the named method in evidence.</param><param name="Mounting">Recorded mounting arrangement.</param>
/// <param name="IsEmergency">Whether emergency lighting operation is specified.</param><param name="EmergencyDuration">Specified autonomous emergency operating duration.</param>
/// <param name="ControlProtocol">Recorded dimming or control interface.</param><param name="Ports">Supply and control endpoints.</param>
public sealed record LightingFixture(SnapshotKey<LightingFixture> Id, ElementInfo Element,
    Fact<SnapshotKey<Space>> SpaceId, Fact<SnapshotKey<ElectricalCircuit>> CircuitId, Fact<string> FixtureStyle,
    Fact<Power> InputPower, Fact<double> LuminousFluxLumens, Fact<double> CorrelatedColorTemperatureKelvin,
    Fact<double> ColorRenderingIndex, Fact<string> Mounting, Fact<bool> IsEmergency,
    Fact<DurationValue> EmergencyDuration, Fact<string> ControlProtocol, LinkSet<ServicePort> Ports);

/// <summary>One electrical or electronic endpoint device for power, controls, communications, or life safety schedules.</summary>
/// <param name="Id">Device row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Recognizable device family.</param><param name="SpaceId">Assigned space.</param>
/// <param name="CircuitId">Associated supply circuit, when applicable.</param><param name="RatedVoltage">Declared operating voltage.</param><param name="RatedCurrent">Declared device current rating.</param>
/// <param name="InputPower">Declared real power input.</param><param name="MountingHeight">Mounting height above local finished floor using the mounting datum described in evidence.</param>
/// <param name="EnclosureRating">Recorded environmental enclosure rating.</param><param name="GangCount">Number of gangs or device positions when applicable.</param>
/// <param name="Protocol">Recorded communications or control protocol.</param><param name="Ports">Power and signal endpoints.</param>
public sealed record ElectricalDevice(SnapshotKey<ElectricalDevice> Id, ElementInfo Element, ElectricalDeviceKind Kind,
    Fact<SnapshotKey<Space>> SpaceId, Fact<SnapshotKey<ElectricalCircuit>> CircuitId, Fact<Voltage> RatedVoltage,
    Fact<ElectricCurrent> RatedCurrent, Fact<Power> InputPower, Fact<Length> MountingHeight,
    Fact<string> EnclosureRating, Fact<int> GangCount, Fact<string> Protocol, LinkSet<ServicePort> Ports);

/// <summary>One modeled cable run between terminations or explicit modeled breaks. Procurement length may include allowances that geometric route length excludes.</summary>
/// <param name="Id">Cable row identity.</param><param name="Element">Shared occurrence information.</param><param name="CircuitId">Assigned circuit when resolved.</param>
/// <param name="CableDesignation">Recorded cable construction and standard designation.</param><param name="ConductorCount">Number of conductors, with protective and spare inclusion basis in evidence.</param>
/// <param name="ConductorArea">Nominal cross-sectional area of each equal-sized conductor in square metres; unequal-core constructions require their product specification.</param>
/// <param name="ConductorMaterialId">Conductor material.</param><param name="OutsideDiameter">Overall cable diameter.</param><param name="RouteLength">Developed modeled route length.</param>
/// <param name="ProcurementLength">Specified purchasing length including documented allowances.</param><param name="RatedVoltage">Declared voltage rating.</param>
/// <param name="FirePerformanceClass">Recorded cable fire performance classification and scheme in evidence.</param><param name="Containment">Assigned containment runs and completeness.</param><param name="Ports">Termination endpoints.</param>
public sealed record CableSegment(SnapshotKey<CableSegment> Id, ElementInfo Element,
    Fact<SnapshotKey<ElectricalCircuit>> CircuitId, Fact<string> CableDesignation, Fact<int> ConductorCount,
    Fact<Area> ConductorArea, Fact<ReferenceKey<Material>> ConductorMaterialId, Fact<Length> OutsideDiameter,
    Fact<Length> RouteLength, Fact<Length> ProcurementLength, Fact<Voltage> RatedVoltage,
    Fact<string> FirePerformanceClass, LinkSet<CableContainment> Containment, LinkSet<ServicePort> Ports);

/// <summary>One cable containment run between fittings or modeled breaks, for route coordination, takeoff, and capacity review.</summary>
/// <param name="Id">Containment row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Containment product family.</param>
/// <param name="MaterialId">Containment material.</param><param name="ClearWidth">Internal usable width.</param><param name="ClearHeight">Internal usable height.</param>
/// <param name="ClearDiameter">Internal diameter for circular containment.</param><param name="CenterlineLength">Developed run length excluding separately counted fittings.</param>
/// <param name="HasCover">Whether a cover is specified.</param><param name="PermittedFillRatio">Permitted fill ratio under the requirement identified in evidence.</param>
/// <param name="CalculatedFillRatio">Calculated occupied fraction with its method and included cables identified in evidence.</param><param name="Supports">Assigned support occurrences and completeness.</param>
/// <param name="Ports">Route connection endpoints.</param>
public sealed record CableContainment(SnapshotKey<CableContainment> Id, ElementInfo Element, CableContainmentKind Kind,
    Fact<ReferenceKey<Material>> MaterialId, Fact<Length> ClearWidth, Fact<Length> ClearHeight,
    Fact<Length> ClearDiameter, Fact<Length> CenterlineLength, Fact<bool> HasCover,
    Fact<Ratio> PermittedFillRatio, Fact<Ratio> CalculatedFillRatio, LinkSet<ServiceSupport> Supports,
    LinkSet<ServicePort> Ports);

/// <summary>One physical service support assembly, counted once even when it supports several trades. Supported objects are associated in ServiceSupportAttachment.</summary>
/// <param name="Id">Support row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Support arrangement.</param>
/// <param name="HostId">Stable identity of the structure or other host receiving the support.</param><param name="MaterialId">Principal support material.</param>
/// <param name="Span">Declared support span.</param><param name="DropLength">Vertical drop from host to supported level.</param><param name="AnchorCount">Number of anchors in this assembly.</param>
/// <param name="AnchorDesignation">Specified anchor product or schedule designation.</param><param name="SeismicRestraintRequired">Whether seismic restraint is required, without claiming compliance.</param>
/// <param name="Attachments">Documented object attachments and completeness.</param>
public sealed record ServiceSupport(SnapshotKey<ServiceSupport> Id, ElementInfo Element, ServiceSupportKind Kind,
    Fact<ReferenceKey<BimObject>> HostId, Fact<ReferenceKey<Material>> MaterialId, Fact<Length> Span,
    Fact<Length> DropLength, Fact<int> AnchorCount, Fact<string> AnchorDesignation,
    Fact<bool> SeismicRestraintRequired, LinkSet<ServiceSupportAttachment> Attachments);

/// <summary>One association of a support assembly with one supported object. This is an association row, not another physical support.</summary>
/// <param name="Id">Attachment association identity.</param><param name="SupportId">Supporting assembly.</param><param name="SupportedObjectId">Supported service component.</param>
/// <param name="AttachmentMethod">Recorded clamp, cradle, fastener, or other connection method.</param><param name="Evidence">Evidence supporting this association.</param>
public sealed record ServiceSupportAttachment(SnapshotKey<ServiceSupportAttachment> Id, SnapshotKey<ServiceSupport> SupportId,
    ReferenceKey<BimObject> SupportedObjectId, Fact<string> AttachmentMethod, ReferenceKey<Evidence> Evidence);

/// <summary>One service crossing through a building barrier, associated with an opening and possibly several services. Firestop requirements and installed evidence are separate.</summary>
/// <param name="Id">Crossing row identity.</param><param name="Element">Shared occurrence information identifying the crossing assembly.</param><param name="OpeningId">Building opening through which services pass.</param>
/// <param name="BarrierId">Stable identity of the penetrated wall, floor, roof, or other barrier.</param><param name="SleeveMaterialId">Sleeve material when a sleeve is documented.</param>
/// <param name="SleeveLength">Sleeve length through the barrier.</param><param name="AnnularGap">Specified annular gap; variable gaps require a detailed representation.</param>
/// <param name="RequiredFireResistance">Required resistance duration from an identified requirement.</param><param name="InstalledFirestopSystem">Recorded installed firestop system designation, not a compliance verdict.</param>
/// <param name="RequiresSmokeSeal">Whether a smoke seal is required.</param><param name="RequiresWaterSeal">Whether a water seal is required.</param>
/// <param name="Services">Documented service-object crossings and completeness.</param><param name="InspectionReference">Reference to the relevant inspection or installation evidence.</param>
public sealed record ServicePenetration(SnapshotKey<ServicePenetration> Id, ElementInfo Element,
    Fact<SnapshotKey<Opening>> OpeningId, Fact<ReferenceKey<BimObject>> BarrierId,
    Fact<ReferenceKey<Material>> SleeveMaterialId, Fact<Length> SleeveLength, Fact<Length> AnnularGap,
    Fact<DurationValue> RequiredFireResistance, Fact<string> InstalledFirestopSystem,
    Fact<bool> RequiresSmokeSeal, Fact<bool> RequiresWaterSeal, LinkSet<PenetratingService> Services,
    Fact<ReferenceKey<Evidence>> InspectionReference);

/// <summary>One association between a barrier crossing and a service component passing through it; several services can share one crossing.</summary>
/// <param name="Id">Association identity.</param><param name="PenetrationId">Barrier crossing assembly.</param><param name="ServiceObjectId">Stable identity of the passing service component.</param>
/// <param name="InsulationContinues">Whether the service insulation continues through this crossing.</param><param name="Evidence">Evidence supporting the crossing association.</param>
public sealed record PenetratingService(SnapshotKey<PenetratingService> Id, SnapshotKey<ServicePenetration> PenetrationId,
    ReferenceKey<BimObject> ServiceObjectId, Fact<bool> InsulationContinues, ReferenceKey<Evidence> Evidence);
