namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>Engineering purpose of a service system; purpose does not establish physical connectivity.</summary>
public enum ServiceDiscipline { Unknown, SupplyAir, ReturnAir, ExhaustAir, OutsideAir, HeatingWater, ChilledWater, DomesticColdWater, DomesticHotWater, SanitaryDrainage, StormDrainage, FireSuppression, FuelGas, ElectricalPower, Lighting, Communications, Controls, Other }
/// <summary>Shape of the clear internal flow section. Insulation is specified separately.</summary>
public enum FlowSectionShape { Unknown, Circular, Rectangular, Oval, Other }
/// <summary>Direction relative to the owning component, from a documented engineering assertion.</summary>
public enum PortFlowDirection { Unknown, Inlet, Outlet, Bidirectional, NoFlow }
/// <summary>Strength of a connection assertion. An inferred path must remain distinguishable from a supplied or verified connection.</summary>
public enum ConnectionBasis { Unresolved, SourceDeclared, Verified, Inferred }
/// <summary>Declared function of a fitting; not inferred from its mesh.</summary>
public enum FittingFunction { Unknown, Bend, Tee, Cross, Reducer, Transition, Cap, Coupling, Union, Other }
/// <summary>Declared damper duty. Fire and smoke ratings remain separate facts.</summary>
public enum DamperFunction { Unknown, VolumeControl, Fire, Smoke, CombinationFireSmoke, Backdraft, Isolation }
/// <summary>Declared valve duty; valve actuation is specified independently.</summary>
public enum ValveFunction { Unknown, Isolation, Check, Balancing, PressureReducing, PressureRelief, Mixing, Control, Drain, Other }
/// <summary>Common building sanitary fixture families. Flush details belong to ToiletSpecification.</summary>
public enum SanitaryFixtureKind { Unknown, Toilet, Urinal, Washbasin, Sink, Shower, Bath, Bidet, DrinkingFountain, Other }
/// <summary>Declared operation of a toilet flush mechanism.</summary>
public enum FlushOperation { Unknown, GravityCistern, PressureAssistedCistern, FlushValve, Vacuum, Waterless, Other }
/// <summary>Water collection purpose of a drain, independent of its downstream system.</summary>
public enum DrainKind { Unknown, Floor, Roof, Channel, Gully, Cleanout, Sump, Other }
/// <summary>Fire suppression endpoint family; detection devices are ElectricalDevice rows.</summary>
public enum FireProtectionTerminalKind { Unknown, Sprinkler, HoseReel, Hydrant, StandpipeOutlet, WaterMistNozzle, Other }

/// <summary>One named service network in a model snapshot. Membership is recorded separately and is not evidence of a continuous path.</summary>
/// <param name="Id">Snapshot-scoped identity of this network.</param>
/// <param name="Name">Display name, which is not a unique identifier.</param>
/// <param name="Discipline">Declared engineering purpose.</param>
/// <param name="Medium">Transported fluid, air, electricity, or signal, when recorded.</param>
/// <param name="DesignFlow">Declared total design volumetric flow; unavailable for non-fluid networks.</param>
/// <param name="DesignTemperature">Declared design medium temperature in SI units.</param>
/// <param name="DesignPressure">Declared design operating pressure, not a pressure-rating substitute.</param>
/// <param name="ServedSpaces">Spaces served and completeness of that association list.</param>
/// <param name="Ports">Documented system ports and completeness of their enumeration.</param>
/// <param name="Evidence">Evidence for the system identification and discipline.</param>
public sealed record ServiceSystem(SnapshotKey<ServiceSystem> Id, string Name, ServiceDiscipline Discipline,
    Fact<string> Medium, Fact<FlowRate> DesignFlow, Fact<Temperature> DesignTemperature,
    Fact<Pressure> DesignPressure, LinkSet<Space> ServedSpaces, LinkSet<ServicePort> Ports,
    ReferenceKey<Evidence> Evidence);

/// <summary>One assertion that an object participates in one service system. A member may participate in several systems; membership does not connect its ports.</summary>
/// <param name="Id">Identity of this membership assertion.</param>
/// <param name="SystemId">Network to which the object belongs in this snapshot.</param>
/// <param name="ObjectId">Stable identity of the participating object.</param>
/// <param name="Role">Recorded participation role, such as source, terminal, distribution, or control.</param>
/// <param name="Evidence">Evidence supporting the association.</param>
public sealed record SystemMembership(SnapshotKey<SystemMembership> Id, SnapshotKey<ServiceSystem> SystemId,
    ReferenceKey<BimObject> ObjectId, Fact<string> Role, ReferenceKey<Evidence> Evidence);

/// <summary>One physical or logical connection endpoint on one object. Missing port data leaves connectivity unknown.</summary>
/// <param name="Id">Identity of the endpoint within this snapshot.</param>
/// <param name="OwnerId">Stable identity of the component owning this endpoint.</param>
/// <param name="Name">Recorded endpoint name or designation.</param>
/// <param name="Discipline">Service carried by the endpoint.</param>
/// <param name="Direction">Documented direction relative to the owner, independently of connection ordering.</param>
/// <param name="Placement">Endpoint location and orientation with an explicit coordinate frame.</param>
/// <param name="SectionShape">Declared connection section shape.</param>
/// <param name="Diameter">Circular clear connection diameter.</param>
/// <param name="Width">Rectangular or oval connection width.</param>
/// <param name="Height">Rectangular or oval connection height.</param>
/// <param name="ConnectionStandard">Recorded flange, thread, connector, or interface designation.</param>
/// <param name="Evidence">Evidence identifying this endpoint.</param>
public sealed record ServicePort(SnapshotKey<ServicePort> Id, ReferenceKey<BimObject> OwnerId,
    Fact<string> Name, ServiceDiscipline Discipline, Fact<PortFlowDirection> Direction,
    Fact<Placement> Placement, Fact<FlowSectionShape> SectionShape, Fact<Length> Diameter,
    Fact<Length> Width, Fact<Length> Height, Fact<string> ConnectionStandard, ReferenceKey<Evidence> Evidence);

/// <summary>One documented physical or logical connection between two ports. Geometric proximity is insufficient to create this row; endpoint ordering implies no flow direction.</summary>
/// <param name="Id">Identity of the asserted connection.</param>
/// <param name="PortAId">First endpoint, in the same snapshot as the connection.</param>
/// <param name="PortBId">Second distinct endpoint in that snapshot.</param>
/// <param name="Basis">Whether connectivity is source-declared, independently verified, inferred or unresolved; traversal policy must choose which assertions it accepts.</param>
/// <param name="ConnectionKind">Recorded physical or logical connection kind.</param>
/// <param name="IsOperational">Whether the connection is available for operation in the described state.</param>
/// <param name="Evidence">Evidence for connectivity; inferred connections must disclose their inference.</param>
public sealed record ServiceConnection(SnapshotKey<ServiceConnection> Id, SnapshotKey<ServicePort> PortAId,
    SnapshotKey<ServicePort> PortBId, ConnectionBasis Basis, Fact<string> ConnectionKind, Fact<bool> IsOperational,
    ReferenceKey<Evidence> Evidence);

/// <summary>One installed or planned duct run between fittings or modeled breaks, counted once independently of its representations.</summary>
/// <param name="Id">Identity of the segment row.</param><param name="Element">Shared occurrence identity, provenance, placement, and geometry.</param>
/// <param name="SystemId">Associated air system when resolved.</param><param name="Shape">Clear internal flow section shape.</param>
/// <param name="Width">Internal section width.</param><param name="Height">Internal section height.</param><param name="Diameter">Internal circular diameter.</param>
/// <param name="CenterlineLength">Developed centerline length, excluding neighboring fitting lengths.</param><param name="SheetMaterialId">Duct shell material.</param>
/// <param name="InsulationThickness">External insulation thickness, separate from the clear flow section.</param><param name="LiningThickness">Internal acoustic or thermal lining thickness.</param>
/// <param name="DesignFlow">Design volumetric air flow.</param><param name="PressureClass">Specified duct pressure class designation.</param><param name="Ports">Connection endpoints and completeness.</param>
public sealed record DuctSegment(SnapshotKey<DuctSegment> Id, ElementInfo Element,
    Fact<SnapshotKey<ServiceSystem>> SystemId, Fact<FlowSectionShape> Shape, Fact<Length> Width,
    Fact<Length> Height, Fact<Length> Diameter, Fact<Length> CenterlineLength,
    Fact<ReferenceKey<Material>> SheetMaterialId, Fact<Length> InsulationThickness,
    Fact<Length> LiningThickness, Fact<FlowRate> DesignFlow, Fact<string> PressureClass, LinkSet<ServicePort> Ports);

/// <summary>One duct fitting occurrence. Individual branch dimensions are read from its ports rather than flattened into a two-ended fitting assumption.</summary>
/// <param name="Id">Fitting row identity.</param><param name="Element">Shared physical occurrence information.</param><param name="SystemId">Associated air system.</param>
/// <param name="Function">Declared fitting purpose.</param><param name="MaterialId">Shell material.</param><param name="BendAngle">Declared bend deflection angle.</param>
/// <param name="CenterlineRadius">Bend centerline radius.</param><param name="HasTurningVanes">Whether turning vanes are documented.</param>
/// <param name="InsulationThickness">External insulation thickness.</param><param name="Ports">All branch connection endpoints and completeness.</param>
public sealed record DuctFitting(SnapshotKey<DuctFitting> Id, ElementInfo Element,
    Fact<SnapshotKey<ServiceSystem>> SystemId, FittingFunction Function, Fact<ReferenceKey<Material>> MaterialId,
    Fact<Angle> BendAngle, Fact<Length> CenterlineRadius, Fact<bool> HasTurningVanes,
    Fact<Length> InsulationThickness, LinkSet<ServicePort> Ports);

/// <summary>One air discharge or intake terminal, useful for space air-flow and ceiling coordination schedules.</summary>
/// <param name="Id">Terminal row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Associated air system.</param>
/// <param name="SpaceId">Space served, which need not equal the terminal placement space.</param><param name="TerminalStyle">Recorded grille, diffuser, register, or other style.</param>
/// <param name="DesignFlow">Design volumetric flow.</param><param name="FaceWidth">Visible face width.</param><param name="FaceHeight">Visible face height.</param>
/// <param name="NeckDiameter">Circular neck diameter when applicable.</param><param name="SoundPowerLevel">Declared acoustic sound power level with evidence of its test conditions.</param>
/// <param name="Finish">Specified exposed finish.</param><param name="Ports">Connection endpoints.</param>
public sealed record AirTerminal(SnapshotKey<AirTerminal> Id, ElementInfo Element,
    Fact<SnapshotKey<ServiceSystem>> SystemId, Fact<SnapshotKey<Space>> SpaceId, Fact<string> TerminalStyle,
    Fact<FlowRate> DesignFlow, Fact<Length> FaceWidth, Fact<Length> FaceHeight, Fact<Length> NeckDiameter,
    Fact<SoundLevel> SoundPowerLevel, Fact<string> Finish, LinkSet<ServicePort> Ports);

/// <summary>One air-control or isolation damper assembly, with independent fire, smoke, and access facts.</summary>
/// <param name="Id">Damper row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Air system.</param>
/// <param name="Function">Declared duty.</param><param name="Actuation">Manual, electric, pneumatic, or recorded actuator description.</param>
/// <param name="FailPosition">Documented failure position.</param><param name="FireResistance">Declared tested fire resistance duration; unknown is not zero.</param>
/// <param name="SmokeLeakageClass">Recorded smoke leakage classification.</param><param name="AccessRequired">Whether inspection or maintenance access is specified.</param>
/// <param name="Ports">Connection endpoints.</param>
public sealed record Damper(SnapshotKey<Damper> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    DamperFunction Function, Fact<string> Actuation, Fact<string> FailPosition, Fact<DurationValue> FireResistance,
    Fact<string> SmokeLeakageClass, Fact<bool> AccessRequired, LinkSet<ServicePort> Ports);

/// <summary>One air handling unit assembly. Its contained components can have separate identities; their capacities must not be added again to the assembly capacity.</summary>
/// <param name="Id">Unit row identity.</param><param name="Element">Shared occurrence information.</param><param name="Systems">Associated air and hydronic systems with completeness.</param>
/// <param name="SupplyFlow">Rated supply volumetric flow.</param><param name="OutsideAirFlow">Rated outside-air volumetric flow.</param>
/// <param name="HeatingCapacity">Declared heating capacity.</param><param name="CoolingCapacity">Declared cooling capacity.</param><param name="ElectricalInput">Declared electrical input power.</param>
/// <param name="ExternalStaticPressure">Rated available external static pressure.</param><param name="FilterClass">Specified filtration classification.</param>
/// <param name="HeatRecoveryEfficiency">Declared heat recovery ratio under stated evidence conditions.</param><param name="DryMass">Mass without operational fluids.</param>
/// <param name="MaintenanceClearance">Required service clearance distance; directional envelopes belong in geometry.</param><param name="Ports">Documented fluid and air endpoints.</param>
public sealed record AirHandlingUnit(SnapshotKey<AirHandlingUnit> Id, ElementInfo Element, LinkSet<ServiceSystem> Systems,
    Fact<FlowRate> SupplyFlow, Fact<FlowRate> OutsideAirFlow, Fact<Power> HeatingCapacity,
    Fact<Power> CoolingCapacity, Fact<Power> ElectricalInput, Fact<Pressure> ExternalStaticPressure,
    Fact<string> FilterClass, Fact<Ratio> HeatRecoveryEfficiency, Fact<Mass> DryMass,
    Fact<Length> MaintenanceClearance, LinkSet<ServicePort> Ports);

/// <summary>One fan occurrence, whether standalone or part of an identified assembly.</summary>
/// <param name="Id">Fan row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Air system.</param>
/// <param name="FanType">Recorded fan configuration.</param><param name="DesignFlow">Duty-point volumetric flow.</param><param name="PressureRise">Duty-point pressure rise.</param>
/// <param name="ElectricalInput">Duty-point electrical input.</param><param name="Efficiency">Duty-point efficiency ratio with a stated efficiency basis in evidence.</param>
/// <param name="VariableSpeed">Whether variable speed operation is specified.</param><param name="SoundPowerLevel">Declared acoustic sound power.</param><param name="Ports">Endpoints.</param>
public sealed record Fan(SnapshotKey<Fan> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    Fact<string> FanType, Fact<FlowRate> DesignFlow, Fact<Pressure> PressureRise,
    Fact<Power> ElectricalInput, Fact<Ratio> Efficiency, Fact<bool> VariableSpeed,
    Fact<SoundLevel> SoundPowerLevel, LinkSet<ServicePort> Ports);

/// <summary>One pump occurrence with a declared operating duty point, not a complete performance curve.</summary>
/// <param name="Id">Pump row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Fluid system.</param>
/// <param name="PumpType">Recorded pump configuration.</param><param name="DesignFlow">Duty-point volumetric flow.</param><param name="PressureRise">Duty-point pressure rise.</param>
/// <param name="ElectricalInput">Duty-point electrical input.</param><param name="Efficiency">Declared duty-point efficiency and its basis in evidence.</param>
/// <param name="VariableSpeed">Whether variable speed operation is specified.</param><param name="DutyRole">Recorded duty, standby, or assist role.</param><param name="Ports">Endpoints.</param>
public sealed record Pump(SnapshotKey<Pump> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    Fact<string> PumpType, Fact<FlowRate> DesignFlow, Fact<Pressure> PressureRise, Fact<Power> ElectricalInput,
    Fact<Ratio> Efficiency, Fact<bool> VariableSpeed, Fact<string> DutyRole, LinkSet<ServicePort> Ports);

/// <summary>One pipe run between fittings or modeled breaks. Nominal size labels are retained independently of physical dimensions.</summary>
/// <param name="Id">Segment row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Associated fluid system.</param>
/// <param name="NominalSize">Recorded nominal size designation, including its size convention.</param><param name="OutsideDiameter">Measured or specified external pipe diameter.</param>
/// <param name="InsideDiameter">Clear internal diameter.</param><param name="CenterlineLength">Developed centerline length excluding neighboring fitting lengths.</param>
/// <param name="MaterialId">Pipe material.</param><param name="WallThickness">Pipe wall thickness, not insulation.</param><param name="InsulationThickness">External insulation thickness.</param>
/// <param name="Slope">Rise divided by horizontal run in the documented direction; its evidence identifies that direction.</param>
/// <param name="DesignFlow">Design volumetric flow.</param><param name="PressureRating">Declared pressure rating at the conditions identified by evidence.</param><param name="Ports">Endpoints.</param>
public sealed record PipeSegment(SnapshotKey<PipeSegment> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    Fact<string> NominalSize, Fact<Length> OutsideDiameter, Fact<Length> InsideDiameter,
    Fact<Length> CenterlineLength, Fact<ReferenceKey<Material>> MaterialId, Fact<Length> WallThickness,
    Fact<Length> InsulationThickness, Fact<Ratio> Slope, Fact<FlowRate> DesignFlow,
    Fact<Pressure> PressureRating, LinkSet<ServicePort> Ports);

/// <summary>One pipe fitting. Branch sizes and connection standards belong to its individual ports.</summary>
/// <param name="Id">Fitting row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Associated fluid system.</param>
/// <param name="Function">Declared fitting purpose.</param><param name="MaterialId">Fitting material.</param><param name="BendAngle">Declared bend deflection.</param>
/// <param name="CenterlineRadius">Bend centerline radius.</param><param name="PressureRating">Declared pressure rating under evidenced conditions.</param><param name="Ports">All branch endpoints.</param>
public sealed record PipeFitting(SnapshotKey<PipeFitting> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    FittingFunction Function, Fact<ReferenceKey<Material>> MaterialId, Fact<Angle> BendAngle,
    Fact<Length> CenterlineRadius, Fact<Pressure> PressureRating, LinkSet<ServicePort> Ports);

/// <summary>One valve assembly, preserving function, operating state, and fail position as distinct concepts.</summary>
/// <param name="Id">Valve row identity.</param><param name="Element">Shared occurrence information.</param><param name="SystemId">Associated fluid system.</param>
/// <param name="Function">Declared valve duty.</param><param name="NominalSize">Recorded nominal size designation.</param><param name="MaterialId">Body material.</param>
/// <param name="Actuation">Recorded actuation type.</param><param name="NormalPosition">Specified normal operating position.</param><param name="FailPosition">Specified failure position.</param>
/// <param name="PressureRating">Pressure rating under evidenced conditions.</param><param name="SetPressure">Configured operating or relief set pressure when applicable.</param><param name="Ports">Endpoints.</param>
public sealed record Valve(SnapshotKey<Valve> Id, ElementInfo Element, Fact<SnapshotKey<ServiceSystem>> SystemId,
    ValveFunction Function, Fact<string> NominalSize, Fact<ReferenceKey<Material>> MaterialId,
    Fact<string> Actuation, Fact<string> NormalPosition, Fact<string> FailPosition,
    Fact<Pressure> PressureRating, Fact<Pressure> SetPressure, LinkSet<ServicePort> Ports);

/// <summary>One sanitary fixture occurrence for plumbing procurement, room schedules, and accessibility review. A classification is not proof of compliance.</summary>
/// <param name="Id">Fixture row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Recognizable fixture family.</param>
/// <param name="SpaceId">Assigned room or space.</param><param name="Mounting">Recorded floor, wall, counter, or other mounting arrangement.</param>
/// <param name="RimHeight">Specified rim elevation above the local finished floor.</param><param name="ColdWaterDemand">Design cold-water demand, with demand method in evidence.</param>
/// <param name="HotWaterDemand">Design hot-water demand.</param><param name="WasteOutletDiameter">Waste outlet connection diameter.</param>
/// <param name="AccessibilityDesignation">Declared accessibility designation, requiring a separate assessment for compliance.</param><param name="Finish">Specified exposed finish.</param><param name="Ports">Water, waste, vent, or other documented endpoints.</param>
public sealed record SanitaryFixture(SnapshotKey<SanitaryFixture> Id, ElementInfo Element, SanitaryFixtureKind Kind,
    Fact<SnapshotKey<Space>> SpaceId, Fact<string> Mounting, Fact<Length> RimHeight,
    Fact<FlowRate> ColdWaterDemand, Fact<FlowRate> HotWaterDemand, Fact<Length> WasteOutletDiameter,
    Fact<string> AccessibilityDesignation, Fact<string> Finish, LinkSet<ServicePort> Ports);

/// <summary>One optional toilet-specific field group per sanitary fixture in a snapshot. This row enriches the fixture and never adds another countable occurrence.</summary>
/// <param name="Id">Specification row identity.</param><param name="FixtureId">Toilet fixture occurrence receiving these facts.</param><param name="FlushOperation">Declared flush mechanism.</param>
/// <param name="FullFlushVolume">Water volume per full flush.</param><param name="ReducedFlushVolume">Water volume per reduced flush when available.</param>
/// <param name="IsDualFlush">Whether two user-selectable flush volumes are provided.</param><param name="OutletOrientation">Recorded horizontal, vertical, or other waste outlet arrangement.</param>
/// <param name="TrapwayDiameter">Declared internal trapway diameter.</param><param name="Evidence">Evidence associating this specification with the fixture.</param>
public sealed record ToiletSpecification(SnapshotKey<ToiletSpecification> Id, SnapshotKey<SanitaryFixture> FixtureId,
    Fact<FlushOperation> FlushOperation, Fact<Volume> FullFlushVolume, Fact<Volume> ReducedFlushVolume,
    Fact<bool> IsDualFlush, Fact<string> OutletOrientation, Fact<Length> TrapwayDiameter,
    ReferenceKey<Evidence> Evidence);

/// <summary>One drainage inlet or access fitting. Roof coverage and hydraulic capacity are explicit facts, not bounding-box derivatives.</summary>
/// <param name="Id">Drain row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Drain purpose.</param><param name="SystemId">Drainage system.</param>
/// <param name="SpaceId">Assigned space when applicable.</param><param name="OutletDiameter">Drain outlet diameter.</param><param name="DesignFlow">Declared design hydraulic capacity.</param>
/// <param name="CatchmentArea">Assigned contributing catchment area, with its allocation method in evidence.</param><param name="InvertElevation">Outlet invert elevation in the element placement frame.</param>
/// <param name="IsTrapped">Whether a trap is documented.</param><param name="GrateMaterialId">Exposed grate material when present.</param><param name="Ports">Connection endpoints.</param>
public sealed record Drain(SnapshotKey<Drain> Id, ElementInfo Element, DrainKind Kind,
    Fact<SnapshotKey<ServiceSystem>> SystemId, Fact<SnapshotKey<Space>> SpaceId, Fact<Length> OutletDiameter,
    Fact<FlowRate> DesignFlow, Fact<Area> CatchmentArea, Fact<Length> InvertElevation,
    Fact<bool> IsTrapped, Fact<ReferenceKey<Material>> GrateMaterialId, LinkSet<ServicePort> Ports);

/// <summary>One fire suppression terminal. Coverage and hydraulic facts support review but do not themselves certify compliance.</summary>
/// <param name="Id">Terminal row identity.</param><param name="Element">Shared occurrence information.</param><param name="Kind">Terminal family.</param><param name="SystemId">Suppression network.</param>
/// <param name="SpaceId">Assigned protected space.</param><param name="DesignFlow">Declared design discharge flow.</param><param name="RequiredPressure">Required operating pressure at the terminal.</param>
/// <param name="ActivationTemperature">Thermal activation temperature when applicable.</param><param name="CoverageArea">Declared design coverage area under evidenced conditions.</param>
/// <param name="Orientation">Recorded upright, pendent, sidewall, or other orientation.</param><param name="Ports">Connection endpoints.</param>
public sealed record FireProtectionTerminal(SnapshotKey<FireProtectionTerminal> Id, ElementInfo Element,
    FireProtectionTerminalKind Kind, Fact<SnapshotKey<ServiceSystem>> SystemId, Fact<SnapshotKey<Space>> SpaceId,
    Fact<FlowRate> DesignFlow, Fact<Pressure> RequiredPressure, Fact<Temperature> ActivationTemperature,
    Fact<Area> CoverageArea, Fact<string> Orientation, LinkSet<ServicePort> Ports);
