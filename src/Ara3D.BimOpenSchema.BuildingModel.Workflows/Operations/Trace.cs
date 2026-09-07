using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

public enum DirectedConnection { Unknown, AToB, BToA, Both }
/// <summary>Direction is an explicit supplied assertion. Port ordering and geometric proximity never establish flow.</summary>
public sealed record DirectedServiceConnection(ServiceConnection Connection, DirectedConnection Direction,
    ReferenceKey<Evidence> DirectionEvidence);
public sealed record TraceRequest(SnapshotKey<ServicePort> Start, ImmutableArray<ServicePort> Ports,
    ImmutableArray<DirectedServiceConnection> Connections, Completeness TopologyCoverage, bool IncludeInferred, int MaximumPorts);
public sealed record TraceVisit(SnapshotKey<ServicePort> Port, ReferenceKey<BimObject> Object,
    Fact<SnapshotKey<ServicePort>> Predecessor, Fact<SnapshotKey<ServiceConnection>> Connection,
    Fact<ConnectionBasis> Basis, bool PathIncludesInference, ImmutableArray<ReferenceKey<Evidence>> Evidence);
public sealed record TraceResult(ImmutableArray<TraceVisit> Visits, bool Truncated, Completeness Coverage,
    ImmutableArray<string> UnresolvedBoundaries);

public static partial class OperationsWorkflows
{
    /// <summary>Reachability over supplied directed edges, including explicitly supplied internal component paths; no hydraulic simulation.</summary>
    public static TraceResult Trace(TraceRequest request)
    {
        Require(request.MaximumPorts > 0, "Maximum ports must be positive.");
        Require(request.TopologyCoverage is Completeness.Complete or Completeness.Partial or Completeness.NotObserved,
            "Topology coverage must be Complete, Partial or NotObserved.");
        var ports = request.Ports.ToDictionary(p => p.Id);
        Require(ports.ContainsKey(request.Start), "Start port missing.");
        foreach (var port in request.Ports) SameSnapshot(port.Id, request.Start.SnapshotId);
        Require(request.Connections.Select(c => c.Connection.Id).Distinct().Count() == request.Connections.Length, "Duplicate connection identity.");
        foreach (var edge in request.Connections)
        {
            SameSnapshot(edge.Connection.Id, request.Start.SnapshotId);
            Require(ports.ContainsKey(edge.Connection.PortAId) && ports.ContainsKey(edge.Connection.PortBId), "Connection has unresolved endpoint.");
            Require(edge.Connection.PortAId != edge.Connection.PortBId, "Self connection is invalid.");
            Require(Enum.IsDefined(edge.Connection.Basis), "Invalid connection evidence basis.");
            Require(ports[edge.Connection.PortAId].Discipline == ports[edge.Connection.PortBId].Discipline, "Connection crosses service disciplines.");
            Require(Enum.IsDefined(edge.Direction), "Unknown direction code.");
            if (edge.Direction != DirectedConnection.Unknown) Require(!string.IsNullOrWhiteSpace(edge.DirectionEvidence.Value), "Direction evidence required.");
        }
        var adjacency = request.Connections.SelectMany(c => new[] { (Port: c.Connection.PortAId, Edge: c), (Port: c.Connection.PortBId, Edge: c) }).ToLookup(x => x.Port, x => x.Edge);
        var visited = new HashSet<SnapshotKey<ServicePort>> { request.Start };
        var inferredPaths = new HashSet<SnapshotKey<ServicePort>>();
        var queue = new Queue<SnapshotKey<ServicePort>>();
        queue.Enqueue(request.Start);
        var result = ImmutableArray.CreateBuilder<TraceVisit>();
        result.Add(new(request.Start, ports[request.Start].OwnerId, Fact<SnapshotKey<ServicePort>>.Inapplicable("Start port."),
            Fact<SnapshotKey<ServiceConnection>>.Inapplicable("Start port."), Fact<ConnectionBasis>.Inapplicable("Start port."), false, [ports[request.Start].Evidence]));
        var unresolved = ImmutableArray.CreateBuilder<string>();
        var truncated = false;
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var directed in adjacency[current].OrderBy(e => e.Connection.Id.Value, StringComparer.Ordinal))
            {
                var edge = directed.Connection;
                if (edge.IsOperational is Fact<bool>.Known { Value: false }) continue;
                if (edge.IsOperational is not Fact<bool>.Known || directed.Direction == DirectedConnection.Unknown ||
                    edge.Basis == ConnectionBasis.Unresolved || (edge.Basis == ConnectionBasis.Inferred && !request.IncludeInferred))
                { unresolved.Add($"{edge.Id}: state, direction or accepted connection evidence unavailable."); continue; }
                var fromA = current == edge.PortAId;
                if ((fromA && directed.Direction == DirectedConnection.BToA) || (!fromA && directed.Direction == DirectedConnection.AToB)) continue;
                var next = fromA ? edge.PortBId : edge.PortAId;
                if (visited.Contains(next)) continue;
                if (visited.Count >= request.MaximumPorts) { truncated = true; continue; }
                visited.Add(next);
                queue.Enqueue(next);
                var inferred = edge.Basis == ConnectionBasis.Inferred || inferredPaths.Contains(current);
                if (inferred) inferredPaths.Add(next);
                result.Add(new(next, ports[next].OwnerId, Derived(current, [edge.Evidence]), Derived(edge.Id, [edge.Evidence]),
                    Derived(edge.Basis, [edge.Evidence]), inferred, [edge.Evidence, directed.DirectionEvidence]));
            }
        }
        if (request.TopologyCoverage != Completeness.Complete) unresolved.Add("Supplied topology is incomplete; omitted connections may change reachability.");
        if (truncated) unresolved.Add("Port limit reached; reachable set is truncated.");
        return new(result.ToImmutable(), truncated, unresolved.Count == 0 ? Completeness.Complete : Completeness.Partial,
            unresolved.Distinct().ToImmutableArray());
    }
}
