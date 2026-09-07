using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Tests;

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
}
