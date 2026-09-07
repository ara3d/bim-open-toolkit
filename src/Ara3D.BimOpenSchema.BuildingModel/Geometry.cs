using System.Collections.Immutable;

namespace Ara3D.BimOpenSchema.BuildingModel;

/// <summary>A point in metres in an explicitly referenced two-dimensional frame.</summary>
public readonly record struct Point2(double X, double Y);
/// <summary>A point in metres in an explicitly referenced three-dimensional frame.</summary>
public readonly record struct Point3(double X, double Y, double Z);
/// <summary>A direction/displacement in a declared frame; unit length is not implicit.</summary>
public readonly record struct Vector3(double X, double Y, double Z);
/// <summary>Axis-aligned 3D bounds in a declared frame. These support candidate filtering, not exact clashes or material volume.</summary>
public readonly record struct Bounds3(Point3 Min, Point3 Max);
/// <summary>Axis-aligned 2D bounds in a declared frame; projection basis is supplied by the representation.</summary>
public readonly record struct Bounds2(Point2 Min, Point2 Max);

/// <summary>A row-major homogeneous transform multiplying column vectors. All 16 values are explicit.</summary>
public readonly record struct Transform3(
    double M11, double M12, double M13, double M14,
    double M21, double M22, double M23, double M24,
    double M31, double M32, double M33, double M34,
    double M41, double M42, double M43, double M44);

/// <summary>A declared coordinate frame. Missing registration between source frames is not an identity transform.</summary>
public sealed record CoordinateFrame(
    SnapshotKey<CoordinateFrame> Id,
    string Name,
    int Dimension,
    string AxisConvention,
    Fact<SnapshotKey<CoordinateFrame>> Parent,
    Fact<Transform3> TransformToParent,
    Fact<string> HorizontalCrs,
    Fact<string> VerticalDatum,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>An occurrence placement in a frame, independent of geometry. Orientation may be unavailable while the anchor is known.</summary>
public sealed record Placement(
    SnapshotKey<CoordinateFrame> FrameId,
    Point3 Origin,
    Fact<Vector3> XAxis,
    Fact<Vector3> YAxis,
    Fact<Vector3> ZAxis);

public enum GeometryKind { Point, Curve, Footprint, Surface, Mesh, Solid, Bounds }
public enum GeometryPurpose { Visualization, Measurement, Navigation, SourceEvidence }

/// <summary>One addressable geometric representation of an object; payloads remain external to the domain row.</summary>
/// <param name="Id">Snapshot-scoped representation identity.</param>
/// <param name="ObjectId">Represented object, shared across its alternative representations.</param>
/// <param name="FrameId">Frame in which the resolved representation and its bounds are expressed.</param>
/// <param name="Kind">Representation form; a mesh does not automatically constitute a closed solid.</param>
/// <param name="Purpose">Intended use of this particular representation.</param>
/// <param name="Dimension">Declared geometric dimension, two or three.</param>
/// <param name="Resource">Opaque prepared resource locator, not an embedded mesh or an instruction to load it eagerly.</param>
/// <param name="Bounds">Resolved three-dimensional bounds in FrameId, after any instance transform.</param>
/// <param name="PlanBounds">Two-dimensional bounds in FrameId's XY plane when that projection is meaningful.</param>
/// <param name="Accuracy">Accuracy stated by the source or derivation, not inferred from polygon count.</param>
/// <param name="Prototype">Shared representation referenced by an instance; inapplicable for an independent payload.</param>
/// <param name="InstanceTransform">Transform from prototype coordinates into FrameId; unavailable is not an identity matrix.</param>
/// <param name="Evidence">Source or derivation supporting the representation and its measurements.</param>
public sealed record GeometryRepresentation(
    SnapshotKey<GeometryRepresentation> Id,
    ReferenceKey<BimObject> ObjectId,
    SnapshotKey<CoordinateFrame> FrameId,
    GeometryKind Kind,
    GeometryPurpose Purpose,
    int Dimension,
    string Resource,
    Fact<Bounds3> Bounds,
    Fact<Bounds2> PlanBounds,
    Fact<Length> Accuracy,
    Fact<SnapshotKey<GeometryRepresentation>> Prototype,
    Fact<Transform3> InstanceTransform,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>A required access/removal/operation region, distinct from the physical object geometry.</summary>
/// <remarks>A supplied clearance is not a universally applicable safety rule. Analysis must record the requirement and coordinate frame.</remarks>
public sealed record ServiceAccessEnvelope(
    SnapshotKey<ServiceAccessEnvelope> Id,
    ReferenceKey<BimObject> ObjectId,
    string Operation,
    Fact<SnapshotKey<GeometryRepresentation>> RequiredRegion,
    Fact<SnapshotKey<CoordinateFrame>> FrameId,
    Fact<Vector3> ApproachDirection,
    Fact<ReferenceKey<RequirementSet>> RequirementSetId,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);

/// <summary>Common routing geometry which concrete duct, pipe and cable models may reference without sharing engineering semantics.</summary>
public sealed record RouteSegment(
    SnapshotKey<RouteSegment> Id,
    ReferenceKey<BimObject> ObjectId,
    SnapshotKey<CoordinateFrame> FrameId,
    Fact<Point3> Start,
    Fact<Point3> End,
    Fact<Length> CenterlineLength,
    Fact<SnapshotKey<GeometryRepresentation>> Centerline,
    string SegmentationBasis,
    ImmutableArray<ReferenceKey<Evidence>> Evidence);
