using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>Change classifications apply after identity reconciliation; an unresolved identity is not automatically an addition or deletion.</summary>
public enum ObjectChangeKind { Added, Removed, Modified, Unchanged, IdentityUnresolved }
/// <summary>Data quality priority for investigation, not an assessment of physical building safety.</summary>
public enum DataIssueSeverity { Information, Warning, Error }
/// <summary>The strength of a spatial finding. Bounding-box overlap is only a candidate and cannot establish a clash or overlap volume.</summary>
public enum SpatialConflictKind { BoundsCandidate, SurfaceIntersection, SolidOverlap, ClearanceViolation, ManualConfirmation }
/// <summary>Trace direction interpreted under an identified system medium and connection policy.</summary>
public enum ServiceTraceDirection { Upstream, Downstream, Both }
/// <summary>Reachability distinguishes positively established paths from inference and absence of sufficient evidence.</summary>
public enum Reachability { Unknown, Established, Inferred, NotReachableWithinCompleteScope }
/// <summary>The physical route segment; elevators require explicit scenario authorization and are not presumed suitable for egress.</summary>
public enum EgressSegmentKind { WithinSpace, Doorway, Corridor, Stair, Ramp, ExteriorPath, AuthorizedLift, Other }
/// <summary>Acoustic metrics must retain their evaluation method and frequency treatment; superficially similar ratings are not interchangeable.</summary>
public enum AcousticMetric { SoundPressureLevel, SoundReductionIndex, ReverberationTime, WeightedSoundReductionIndex, SoundTransmissionClass, ImpactInsulationClass, Other }

/// <summary>One object's comparison between two model snapshots. Field changes, geometry changes and identity uncertainty are reported separately.</summary>
/// <remarks><c>BaselineSnapshotId</c>: The comparison's earlier snapshot, distinct from Id.SnapshotId, which identifies the result snapshot.</remarks>
/// <remarks><c>ChangedFields</c>: Human-readable domain field paths; source row offsets alone do not constitute a meaningful change.</remarks>
public sealed record ObjectChange(
    SnapshotKey<ObjectChange> Id,
    ReferenceKey<BimObject> ObjectId,
    ReferenceKey<ModelSnapshot> BaselineSnapshotId,
    ReferenceKey<ModelSnapshot> ComparedSnapshotId,
    ObjectChangeKind Kind,
    ImmutableArray<string> ChangedFields,
    Fact<bool> GeometryChanged,
    Fact<bool> PlacementChanged,
    string ComparisonAndIdentityPolicy,
    Completeness ComparedCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One actionable data-quality observation for a subject or dataset. Export omission, conflicting values and invalid values remain distinct issues.</summary>
public sealed record DataIssue(
    SnapshotKey<DataIssue> Id,
    Fact<ReferenceKey<BimObject>> SubjectId,
    string Code,
    string DomainField,
    DataIssueSeverity Severity,
    string Description,
    ImmutableArray<string> AffectedWorkflows,
    Fact<string> SuggestedResolution,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One spatial pair finding in one scenario and evaluation method. The pair's ordering is canonicalized by policy to avoid duplicate A/B and B/A rows.</summary>
/// <remarks><c>IntersectionVolume</c>: Cubic metres from a valid solid intersection only; unavailable for bounds candidates or open meshes.</remarks>
/// <remarks><c>Separation</c>: Metres between evaluated surfaces under the declared distance method; negative penetration needs an explicit signed-distance method.</remarks>
public sealed record SpatialConflict(
    SnapshotKey<SpatialConflict> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    ReferenceKey<BimObject> FirstObjectId,
    ReferenceKey<BimObject> SecondObjectId,
    Fact<SnapshotKey<GeometryRepresentation>> FirstRepresentationId,
    Fact<SnapshotKey<GeometryRepresentation>> SecondRepresentationId,
    SpatialConflictKind Kind,
    string MethodAndVersion,
    Length Tolerance,
    Fact<Length> Separation,
    Fact<Length> RequiredClearance,
    Fact<Volume> IntersectionVolume,
    Fact<Point3> Location,
    Fact<SnapshotKey<CoordinateFrame>> FrameId,
    Completeness GeometryCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One scoped service trace request and its summary. Reached ports are separate ServiceTraceMember rows, avoiding a giant inline graph.</summary>
/// <remarks><c>TopologyCoverage</c>: Missing exported connections yield partial or not-observed coverage, never proof that the physical network is disconnected.</remarks>
/// <remarks><c>ScopeDescription</c>: Defines system, buildings, media, accepted connection evidence and traversal limits.</remarks>
public sealed record ServiceTraceResult(
    SnapshotKey<ServiceTraceResult> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    SnapshotKey<ServicePort> StartPortId,
    Fact<SnapshotKey<ServiceSystem>> SystemId,
    ServiceTraceDirection Direction,
    string Medium,
    string ScopeDescription,
    string ConnectionAndTraversalPolicy,
    long EstablishedReachablePortCount,
    long InferredReachablePortCount,
    Completeness TopologyCoverage,
    bool Truncated,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One evaluated port per trace; predecessor links retain a path explanation without copying the whole path into each row.</summary>
/// <remarks><c>HopCount</c>: Number of traversed connections under the trace policy, unavailable for unreachable or unresolved destinations.</remarks>
public sealed record ServiceTraceMember(
    SnapshotKey<ServiceTraceMember> Id,
    SnapshotKey<ServiceTraceResult> TraceId,
    SnapshotKey<ServicePort> PortId,
    Reachability Reachability,
    Fact<long> HopCount,
    Fact<SnapshotKey<ServicePort>> PredecessorPortId,
    Fact<SnapshotKey<ServiceConnection>> ViaConnectionId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One explicit egress-analysis input scope for one scenario and requirement set, not a claim that the building is compliant.</summary>
/// <remarks><c>OccupantCount</c>: Design or observed count under OccupancyBasis; unavailable counts are not zero occupants.</remarks>
/// <remarks><c>AccessibleRouteRequired</c>: Explicit scenario assumption; unknown does not mean accessibility is unnecessary.</remarks>
public sealed record EgressStudy(
    SnapshotKey<EgressStudy> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    ReferenceKey<RequirementSet> RequirementSetId,
    SnapshotKey<Space> OriginSpaceId,
    Fact<long> OccupantCount,
    string OccupancyBasis,
    Fact<bool> AccessibleRouteRequired,
    string HazardAndAvailabilityAssumptions,
    string WalkableGeometryAndConnectivityPolicy,
    Completeness InputCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One candidate or established route from an origin space to an identified destination in a study. Ordered steps are separate EgressRouteStep rows.</summary>
/// <remarks><c>TravelDistance</c>: Metres along the evaluated walkable path; centroid distance and bounding-box distance are insufficient substitutes.</remarks>
/// <remarks><c>MinimumClearWidth</c>: Minimum available clear width over the evaluated route, not a nominal door or corridor type width.</remarks>
public sealed record EgressRoute(
    SnapshotKey<EgressRoute> Id,
    SnapshotKey<EgressStudy> StudyId,
    ReferenceKey<BimObject> DestinationId,
    Reachability Reachability,
    Fact<Length> TravelDistance,
    Fact<Length> MinimumClearWidth,
    Fact<DurationValue> TravelTime,
    long StepCount,
    string RoutingMethodAndVersion,
    Completeness RouteCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One ordered, directed segment of an egress route. Ordinal is zero-based and must be unique within RouteId.</summary>
public sealed record EgressRouteStep(
    SnapshotKey<EgressRouteStep> Id,
    SnapshotKey<EgressRoute> RouteId,
    int Ordinal,
    EgressSegmentKind Kind,
    ReferenceKey<BimObject> TraversedObjectId,
    Fact<SnapshotKey<Space>> FromSpaceId,
    Fact<SnapshotKey<Space>> ToSpaceId,
    Fact<Length> TravelDistance,
    Fact<Length> ClearWidth,
    Fact<Ratio> Gradient,
    Fact<SnapshotKey<GeometryRepresentation>> PathRepresentationId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One requirement-specific egress conclusion for a study and optional route. The model stores justified assessments and does not implement safety certification.</summary>
/// <remarks><c>Outcome</c>: Pass requires adequate evidence for this requirement's full evaluation scope. No route found with incomplete topology means Unknown.</remarks>
public sealed record EgressAssessment(
    SnapshotKey<EgressAssessment> Id,
    SnapshotKey<EgressStudy> StudyId,
    Fact<SnapshotKey<EgressRoute>> RouteId,
    ReferenceKey<Requirement> RequirementId,
    AssessmentOutcome Outcome,
    Completeness InputCoverage,
    Fact<Length> AllowedTravelDistance,
    Fact<Length> RequiredClearWidth,
    string EvaluationMethodAndVersion,
    string Reason,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One acoustic evaluation for a space or separating object, method, scenario and metric. Frequency bands are separate rows.</summary>
/// <remarks><c>MetricUnit</c>: Explicit unit or rating convention, such as dB, seconds or STC rating; a generic decibel number cannot represent every acoustic metric.</remarks>
/// <remarks><c>SingleNumberValue</c>: Only the method's reported single-number result. Do not derive it by averaging band decibels.</remarks>
public sealed record AcousticResult(
    SnapshotKey<AcousticResult> Id,
    ReferenceKey<AnalysisScenario> ScenarioId,
    ReferenceKey<BimObject> SubjectId,
    Fact<SnapshotKey<Space>> SourceSpaceId,
    Fact<SnapshotKey<Space>> ReceiverSpaceId,
    AcousticMetric Metric,
    string MetricUnit,
    Fact<decimal> SingleNumberValue,
    string MethodAndVersion,
    string ExcitationOccupancyAndBoundaryAssumptions,
    Completeness InputCoverage,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>One octave, third-octave or other explicitly defined frequency band for an acoustic result; Value uses the parent result's metric unit.</summary>
public sealed record AcousticBandResult(
    SnapshotKey<AcousticBandResult> Id,
    SnapshotKey<AcousticResult> ResultId,
    decimal CentreFrequencyHertz,
    decimal LowerFrequencyHertz,
    decimal UpperFrequencyHertz,
    Fact<decimal> Value,
    string BandDefinition,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
