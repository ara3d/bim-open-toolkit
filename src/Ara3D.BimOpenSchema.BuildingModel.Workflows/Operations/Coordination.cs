using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations;

/// <summary>Direct registration from source frame into the selected analysis frame; no implicit identity for another frame.</summary>
public sealed record FrameRegistration(SnapshotKey<CoordinateFrame> From, SnapshotKey<CoordinateFrame> To,
    Transform3 Transform, ReferenceKey<Evidence> Evidence);
public sealed record CoordinationRequest(SnapshotKey<CoordinateFrame> Frame,
    ImmutableArray<GeometryRepresentation> Obstacles, ImmutableArray<GeometryRepresentation> RequiredRegions,
    ImmutableArray<ServiceAccessEnvelope> Envelopes, ImmutableArray<FrameRegistration> Registrations,
    ImmutableArray<PenetratingService> PenetrationMemberships, Length Tolerance);
public sealed record AccessCandidate(SnapshotKey<ServiceAccessEnvelope> Envelope,
    ReferenceKey<BimObject> Obstacle, SnapshotKey<GeometryRepresentation> Representation,
    SnapshotKey<CoordinateFrame> Frame, Length Tolerance, string Basis,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
public sealed record SharedPenetration(SnapshotKey<ServicePenetration> Penetration,
    ImmutableArray<ReferenceKey<BimObject>> Services);
public sealed record CoordinationResult(ImmutableArray<AccessCandidate> Candidates,
    ImmutableArray<SharedPenetration> Penetrations, ImmutableArray<string> Unresolved,
    string ConclusionLimit);

public static partial class OperationsWorkflows
{
    /// <summary>Transform already resolved representation bounds once, then return broad-phase candidates only.</summary>
    public static CoordinationResult Coordinate(CoordinationRequest request)
    {
        Require(double.IsFinite(request.Tolerance.Metres) && request.Tolerance.Metres >= 0, "Invalid spatial tolerance.");
        Require(request.Obstacles.Select(g => g.ObjectId).Distinct().Count() == request.Obstacles.Length,
            "Select one resolved representation per obstacle; competing representations require a selection policy.");
        var geometries = request.RequiredRegions.ToDictionary(g => g.Id);
        var registrations = request.Registrations.ToDictionary(r => r.From);
        foreach (var registration in request.Registrations)
        {
            SameSnapshot(registration.From, request.Frame.SnapshotId);
            Require(registration.To == request.Frame && !string.IsNullOrWhiteSpace(registration.Evidence.Value), "Registration must have evidence and target the selected analysis frame.");
            ValidateTransform(registration.Transform);
        }
        var unresolved = ImmutableArray.CreateBuilder<string>();
        var candidates = ImmutableArray.CreateBuilder<AccessCandidate>();
        foreach (var envelope in request.Envelopes)
        {
            SameSnapshot(envelope.Id, request.Frame.SnapshotId);
            if (envelope.RequiredRegion is not Fact<SnapshotKey<GeometryRepresentation>>.Known selected || !geometries.TryGetValue(selected.Value, out var region))
            { unresolved.Add($"{envelope.Id}: required region unavailable."); continue; }
            if (envelope.FrameId is not Fact<SnapshotKey<CoordinateFrame>>.Known frame || frame.Value != region.FrameId)
            { unresolved.Add($"{envelope.Id}: envelope frame is unavailable or disagrees with the selected region."); continue; }
            var required = RegisteredBounds(region, request.Frame, registrations);
            if (required is not Fact<Bounds3>.Known box) { unresolved.Add($"{envelope.Id}: bounds or frame registration unavailable."); continue; }
            foreach (var obstacle in request.Obstacles.Where(o => o.ObjectId != envelope.ObjectId))
            {
                var bounds = RegisteredBounds(obstacle, request.Frame, registrations);
                if (bounds is not Fact<Bounds3>.Known other) { unresolved.Add($"{obstacle.Id}: bounds or frame registration unavailable."); continue; }
                if (Overlaps(box.Value, other.Value, request.Tolerance.Metres))
                    candidates.Add(new(envelope.Id, obstacle.ObjectId, obstacle.Id, request.Frame, request.Tolerance,
                        "BoundsCandidate: enclosing axis-aligned bounds after registration; solid overlap and adequate clearance untested.",
                        envelope.Evidence.AddRange(box.Evidence).AddRange(other.Evidence).Distinct().ToImmutableArray()));
            }
        }
        foreach (var membership in request.PenetrationMemberships)
        {
            SameSnapshot(membership.Id, request.Frame.SnapshotId);
            SameSnapshot(membership.PenetrationId, request.Frame.SnapshotId);
        }
        Require(request.PenetrationMemberships.GroupBy(m => m.Id).All(g => g.All(m => m.PenetrationId == g.First().PenetrationId &&
            m.ServiceObjectId == g.First().ServiceObjectId && SameFact(m.InsulationContinues, g.First().InsulationContinues) && m.Evidence == g.First().Evidence)),
            "Conflicting penetration membership identity.");
        var penetrations = request.PenetrationMemberships.GroupBy(p => p.PenetrationId).OrderBy(g => g.Key.Value, StringComparer.Ordinal)
            .Select(g => new SharedPenetration(g.Key, g.Select(p => p.ServiceObjectId).Distinct().OrderBy(p => p.Value, StringComparer.Ordinal).ToImmutableArray())).ToImmutableArray();
        return new(candidates.ToImmutable(), penetrations, unresolved.Distinct().ToImmutableArray(),
            "Count one assembly per penetration identity; memberships are supplied assertions. Bounds candidates do not establish exact interference or clearance compliance.");
    }

    private static Fact<Bounds3> RegisteredBounds(GeometryRepresentation representation, SnapshotKey<CoordinateFrame> target,
        IReadOnlyDictionary<SnapshotKey<CoordinateFrame>, FrameRegistration> registrations)
    {
        SameSnapshot(representation.Id, target.SnapshotId);
        SameSnapshot(representation.FrameId, target.SnapshotId);
        Require(representation.Dimension == 3, "Access bounds require a three-dimensional representation.");
        if (representation.Bounds is not Fact<Bounds3>.Known b) return Fact<Bounds3>.Unknown("Bounds unavailable.");
        ValidateBounds(b.Value);
        if (representation.FrameId == target) return b;
        if (!registrations.TryGetValue(representation.FrameId, out var registration)) return Fact<Bounds3>.Unknown("Registration unavailable.");
        var bounds = b.Value;
        var points = new[] { bounds.Min.X, bounds.Max.X }.SelectMany(x => new[] { bounds.Min.Y, bounds.Max.Y }
            .SelectMany(y => new[] { bounds.Min.Z, bounds.Max.Z }.Select(z => Transform(new Point3(x, y, z), registration.Transform)))).ToArray();
        var transformed = new Bounds3(new(points.Min(p => p.X), points.Min(p => p.Y), points.Min(p => p.Z)),
            new(points.Max(p => p.X), points.Max(p => p.Y), points.Max(p => p.Z)));
        ValidateBounds(transformed);
        return Derived(transformed, b.Evidence.Add(registration.Evidence));
    }

    private static Point3 Transform(Point3 p, Transform3 t)
        => new(t.M11 * p.X + t.M12 * p.Y + t.M13 * p.Z + t.M14,
            t.M21 * p.X + t.M22 * p.Y + t.M23 * p.Z + t.M24,
            t.M31 * p.X + t.M32 * p.Y + t.M33 * p.Z + t.M34);

    private static void ValidateBounds(Bounds3 b)
        => Require(new[] { b.Min.X, b.Min.Y, b.Min.Z, b.Max.X, b.Max.Y, b.Max.Z }.All(double.IsFinite) &&
            b.Min.X <= b.Max.X && b.Min.Y <= b.Max.Y && b.Min.Z <= b.Max.Z, "Bounds must be finite and ordered.");

    private static void ValidateTransform(Transform3 t)
    {
        Require(new[] { t.M11, t.M12, t.M13, t.M14, t.M21, t.M22, t.M23, t.M24, t.M31, t.M32, t.M33, t.M34 }.All(double.IsFinite)
            && t.M41 == 0 && t.M42 == 0 && t.M43 == 0 && t.M44 == 1, "Only finite affine registrations supported.");
        var determinant = t.M11 * (t.M22 * t.M33 - t.M23 * t.M32) - t.M12 * (t.M21 * t.M33 - t.M23 * t.M31) + t.M13 * (t.M21 * t.M32 - t.M22 * t.M31);
        Require(double.IsFinite(determinant) && Math.Abs(determinant) > 1e-12, "Registration must be nonsingular.");
    }

    private static bool Overlaps(Bounds3 a, Bounds3 b, double tolerance)
        => a.Min.X <= b.Max.X + tolerance && a.Max.X + tolerance >= b.Min.X &&
           a.Min.Y <= b.Max.Y + tolerance && a.Max.Y + tolerance >= b.Min.Y &&
           a.Min.Z <= b.Max.Z + tolerance && a.Max.Z + tolerance >= b.Min.Z;
}
