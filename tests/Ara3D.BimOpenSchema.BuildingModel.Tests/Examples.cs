using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

// Small synthetic examples deliberately contain missing data. They are construction
// helpers for tests, not defaults that the production importer is allowed to assume.
internal static class Examples
{
    public static ReferenceKey<T> Ref<T>(string id) => new(id);
    public static SnapshotKey<T> Key<T>(string id, string snapshot = "issued-01") => new(Ref<ModelSnapshot>(snapshot), id);
    public static Fact<T> Known<T>(T value) => new Fact<T>.Known(value, Assurance.Observed, []);
    public static Fact<T> Unknown<T>() => Fact<T>.Unknown("Not supplied by this example's source.");
    public static LinkSet<T> Links<T>(params SnapshotKey<T>[] items) => new(items.ToImmutableArray(), Completeness.Complete, []);

    public static ElementInfo Element(string id, string? name = null) => new(
        Ref<BimObject>(id), name, null, LifecycleState.Planned,
        new(Unknown<SnapshotKey<Building>>(), Unknown<SnapshotKey<Storey>>(),
            LinkSet<Storey>.Unknown(), LinkSet<Space>.Unknown(), LinkSet<Zone>.Unknown()),
        Unknown<Placement>(), LinkSet<GeometryRepresentation>.Unknown(), []);

    public static Roof Roof(string id, Fact<Area> netArea, Fact<Area> projectedArea) => new(
        Key<Roof>(id), Element(id), Unknown<ReferenceKey<AssemblyDefinition>>(), Unknown<SnapshotKey<Storey>>(),
        netArea, projectedArea, Unknown<Angle>(), Unknown<Length>(), Unknown<ThermalTransmittance>(),
        Unknown<SnapshotKey<QuantityObservation>>(), LinkSet<Opening>.Unknown(), LinkSet<FinishSurface>.Unknown());

    public static FinishSurface Finish(string id, string host, string face, double area, LinkSet<Space> spaces) => new(
        Key<FinishSurface>(id), Element(id), Known(Ref<BimObject>(host)), Known(face), Known(id), spaces, Known("Wall face"),
        Unknown<ReferenceKey<AssemblyDefinition>>(), Unknown<ReferenceKey<Material>>(), Known("P-01"), Known(new Area(area)),
        Unknown<Length>(), Unknown<Length>(), Unknown<SnapshotKey<QuantityObservation>>());

    public static EstimateLine PricedLine() => new(
        Key<EstimateLine>("roof-install"), Key<WorkPackage>("roofing"), Ref<AnalysisScenario>("bid-base"),
        Unknown<SnapshotKey<QuantityObservation>>(), "Install membrane", "roof-membrane-install", Known(125m), QuantityUnit.SquareMetre,
        Known(new Ratio(0.1)), Known(Ref<RateItem>("membrane-rate")), Known(new Money(20m, "CAD")),
        Known(new Money(2750m, "CAD")), PricingState.Priced, "125 m2 × 1.10 × CAD 20; round to cents", []);

    public static EstimateSummary Estimate() => new(
        Key<EstimateSummary>("roof-bid"), Key<WorkPackage>("roofing"), Ref<AnalysisScenario>("bid-base"),
        "roof-membrane-install", "CAD", Known(new Money(2750m, "CAD")), Known(new Money(2750m, "CAD")),
        1, 0, 0, Completeness.Complete, "One selected contribution per installation scope", []);

    public static Assessment Assessment(AssessmentOutcome outcome, Completeness coverage) => new(
        Key<Assessment>("door-width"), Ref<BimObject>("door-01"), Ref<Requirement>("owner-door-width-v1"),
        Ref<AnalysisScenario>("access-review"), outcome, coverage, "Synthetic width review", "Explicit owner criterion v1",
        Unknown<DateTimeOffset>(), []);

    public static SpatialConflict BoundsCandidate() => new(
        Key<SpatialConflict>("pair-01"), Ref<AnalysisScenario>("coordination"), Ref<BimObject>("duct-01"), Ref<BimObject>("beam-01"),
        Unknown<SnapshotKey<GeometryRepresentation>>(), Unknown<SnapshotKey<GeometryRepresentation>>(),
        SpatialConflictKind.BoundsCandidate, "AABB screen v1", new Length(0.001), Unknown<Length>(), Unknown<Length>(),
        Unknown<Volume>(), Unknown<Point3>(), Unknown<SnapshotKey<CoordinateFrame>>(), Completeness.Partial, []);

    public static ServiceTraceResult Trace(Completeness coverage, bool truncated = false) => new(
        Key<ServiceTraceResult>("trace-01"), Ref<AnalysisScenario>("maintenance-shutdown"), Key<ServicePort>("supply"),
        Unknown<SnapshotKey<ServiceSystem>>(), ServiceTraceDirection.Downstream, "Cold water", "Building A only",
        "Declared and verified connections only", 1, 0, coverage, truncated, []);

    public static ServiceTraceMember TraceMember(Reachability reachability) => new(
        Key<ServiceTraceMember>("member-01"), Key<ServiceTraceResult>("trace-01"), Key<ServicePort>("basin-supply"),
        reachability, Unknown<long>(), Unknown<SnapshotKey<ServicePort>>(), Unknown<SnapshotKey<ServiceConnection>>(), []);
}
