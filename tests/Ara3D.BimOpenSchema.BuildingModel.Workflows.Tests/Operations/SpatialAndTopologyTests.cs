using Ara3D.BimOpenSchema.BuildingModel;
using Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;
using Platonic;
using static Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations.Examples;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.Operations;

[Impure, TestFixture, Category("Source.Synthetic"), Category("Size.Small")]
public sealed class SpatialAndTopologyTests
{
    private static TraceRequest Network() => new(Key<ServicePort>("a"), [Port("a"), Port("b"), Port("c"), Port("d")],
        [Edge("ab", "a", "b"), Edge("bc", "b", "c"), Edge("ca", "c", "a"), Edge("bd", "b", "d")], Completeness.Complete, false, 20);

    [Test]
    public void DirectedTraversalTerminatesOnCyclesAndRecordsPathEvidence()
    {
        var result = OperationsWorkflows.Trace(Network());
        Assert.That(result.Visits.Select(v => v.Port.Value), Is.EquivalentTo(new[] { "a", "b", "c", "d" }));
        Assert.That(result.Visits.Single(v => v.Port.Value == "d").Predecessor, Is.TypeOf<Fact<SnapshotKey<ServicePort>>.Known>());
        Assert.That(Value(result.Visits.Single(v => v.Port.Value == "d").Predecessor).Value, Is.EqualTo("b"));
        Assert.That(result.Visits.Single(v => v.Port.Value == "d").Evidence, Does.Contain(Ref<Evidence>("direction-fixture")));
        Assert.That(result.Coverage, Is.EqualTo(Completeness.Complete));
        Assert.That(result.Truncated, Is.False);
    }

    [Test]
    public void UnknownDirectionAndIncompleteExportCannotProveIsolation()
    {
        var request = Network() with { Connections = [Edge("ab", "a", "b", DirectedConnection.Unknown)], TopologyCoverage = Completeness.Partial };
        var result = OperationsWorkflows.Trace(request);
        Assert.That(result.Visits.Select(v => v.Port.Value), Is.EqualTo(new[] { "a" }));
        Assert.That(result.Coverage, Is.EqualTo(Completeness.Partial));
        Assert.That(result.UnresolvedBoundaries.Length, Is.EqualTo(2));
    }

    [Test]
    public void ReverseDirectionClosedConnectionsAndInferredPolicyAreRespected()
    {
        var edge = Edge("ab", "a", "b");
        var request = Network() with { Connections = [edge with { Direction = DirectedConnection.BToA }] };
        Assert.That(OperationsWorkflows.Trace(request).Visits.Length, Is.EqualTo(1));
        request = request with { Connections = [edge with { Connection = edge.Connection with { IsOperational = Known(false) } }] };
        Assert.That(OperationsWorkflows.Trace(request).Visits.Length, Is.EqualTo(1));
        request = request with { Connections = [edge with { Connection = edge.Connection with { Basis = ConnectionBasis.Inferred } }] };
        Assert.That(OperationsWorkflows.Trace(request).Visits.Length, Is.EqualTo(1));
        var inferred = OperationsWorkflows.Trace(request with { IncludeInferred = true });
        Assert.That(inferred.Visits.Length, Is.EqualTo(2));
        Assert.That(inferred.Visits[1].PathIncludesInference, Is.True);
    }

    [Test]
    public void PortLimitSignalsTruncationWithoutInventingMissingVisits()
    {
        var result = OperationsWorkflows.Trace(Network() with { MaximumPorts = 2 });
        Assert.That(result.Visits.Select(v => v.Port.Value), Is.EqualTo(new[] { "a", "b" }));
        Assert.That(result.Truncated, Is.True);
        Assert.That(result.Coverage, Is.EqualTo(Completeness.Partial));
    }

    [Test]
    public void UnknownOperationalStateAndDanglingEndpointAreNotTraversed()
    {
        var edge = Edge("ab", "a", "b");
        var request = Network() with { Connections = [edge with { Connection = edge.Connection with { IsOperational = Unknown<bool>() } }] };
        Assert.That(OperationsWorkflows.Trace(request).Visits.Length, Is.EqualTo(1));
        Assert.That(OperationsWorkflows.Trace(request).Coverage, Is.EqualTo(Completeness.Partial));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Trace(request with { Ports = [Port("a")] }));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Trace(request with { TopologyCoverage = (Completeness)999 }));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Trace(request with { Connections = [edge with { Connection = edge.Connection with { Basis = (ConnectionBasis)999 } }] }));
    }

    [Test]
    public void DisconnectedPortsOnSameOwnerAreNeverImplicitlyConnected()
    {
        var a = Port("a");
        var b = Port("b") with { OwnerId = a.OwnerId };
        var result = OperationsWorkflows.Trace(new(a.Id, [a, b], [], Completeness.Complete, false, 20));
        Assert.That(result.Visits.Length, Is.EqualTo(1));
    }

    private static CoordinationRequest Spatial() => new(Key<CoordinateFrame>("common"),
        [Examples.Geometry("obstacle", "local", new(new(0, 0, 0), new(1, 2, 1)))],
        [Examples.Geometry("region", "common", new(new(8, 0, 0), new(10, 1, 1)))], [Envelope()],
        [new(Key<CoordinateFrame>("local"), Key<CoordinateFrame>("common"),
            new(0, -1, 0, 10, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), Ref<Evidence>("registration"))], [], new(0));

    [Test]
    public void RotatedTranslatedBoundsYieldOnlyAnEvidencedCandidate()
    {
        // Rotated [0,1]x[0,2] box translated +10 X becomes [8,10]x[0,1].
        var result = OperationsWorkflows.Coordinate(Spatial());
        Assert.That(result.Candidates.Length, Is.EqualTo(1));
        Assert.That(result.Candidates[0].Obstacle, Is.EqualTo(Ref<BimObject>("obstacle")));
        Assert.That(result.Candidates[0].Basis, Does.StartWith("BoundsCandidate:"));
        Assert.That(result.Candidates[0].Evidence, Does.Contain(Ref<Evidence>("registration")));
        Assert.That(result.ConclusionLimit, Does.Contain("do not establish exact interference"));
        Assert.That(result.Unresolved, Is.Empty);
    }

    [Test]
    public void MissingFrameRegistrationBlocksSpatialConclusion()
    {
        var result = OperationsWorkflows.Coordinate(Spatial() with { Registrations = [] });
        Assert.That(result.Candidates, Is.Empty);
        Assert.That(result.Unresolved.Single(), Does.Contain("registration unavailable"));
    }

    [Test]
    public void DuplicateGeometrySelectionAndSingularTransformsAreRejected()
    {
        var request = Spatial();
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Coordinate(request with { Obstacles = [request.Obstacles[0], request.Obstacles[0] with { Id = Key<GeometryRepresentation>("duplicate") }] }));
        Assert.Throws<ArgumentException>(() => OperationsWorkflows.Coordinate(request with { Registrations = [request.Registrations[0] with { Transform = default }] }));
    }

    [Test]
    public void MultipleServicesAndRepeatedMembershipsCountOnePenetrationAssembly()
    {
        var first = new PenetratingService(Key<PenetratingService>("pipe"), Key<ServicePenetration>("opening"), Ref<BimObject>("pipe"), Unknown<bool>(), Ref<Evidence>("fixture"));
        var second = first with { Id = Key<PenetratingService>("duct"), ServiceObjectId = Ref<BimObject>("duct") };
        var result = OperationsWorkflows.Coordinate(Spatial() with { PenetrationMemberships = [first, first, second] });
        Assert.That(result.Penetrations.Length, Is.EqualTo(1));
        Assert.That(result.Penetrations[0].Services.Length, Is.EqualTo(2));
    }
}
