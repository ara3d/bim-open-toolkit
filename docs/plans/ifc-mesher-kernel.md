# Track B: extract `Ara3D.MeshKernel` from `Ara3D.Ifc.Mesher`

Plan written 2026-10-11 by a planner agent for `ifc-mesher-accuracy.md`'s wave 2; parent roadmap `ifc-mesher-roadmap.md`. Workflow served: 3 (a picture of the model is only as good as its mesh). Track B changes no score; it makes the next change to the mesher cheaper. The measure is that every score stays exactly where it was, and that a kernel test count exists. Ticket: TKT-246.

**Corrections to the roadmap's Track B.** Earcut is already in the SDK (`deps/ara3d-sdk/src/Ara3D.Geometry/MeshAlgorithms/Earcut.cs`), so nothing about it moves. `Booleans` cannot be renamed `BooleanItems`: `CutOracleTests` and `BooleanTests` call it by name. The roadmap's "watertight after clip" invariant is false: the half-space clip leaves the cut open. The test-support library is TKT-223 and is left out of this plan.

## Acceptance criteria

- `src/data/Ara3D.MeshKernel` (net8.0) builds referencing only the SDK packages `Ara3D.Geometry` and `Ara3D.Models`; no reference to `Ara3D.Ifc.Entities`, `Ara3D.IfcTypes` or `Ara3D.IO.StepParser`.
- `git grep -n -i -w -E "ifc[a-z0-9_]*" -- src/data/Ara3D.MeshKernel tests/data/Ara3D.MeshKernel.Tests` prints nothing (code, comments, README).
- `tests/data/Ara3D.MeshKernel.Tests` references only the kernel and passes alone. Each chunk adds three to five tests on hand-built inputs.
- The mesher's fast tests pass with their source unchanged (the post-wave-1 baseline). Up to B12 the only diff under the two mesher test directories is the one `<Using>` line B0 adds to each test csproj. B13 edits call sites only.
- Comparison suite: the same pass and fail set as the baseline; `scorecard.json` differs only in its timestamp and is reverted, not committed.
- The mesher no longer holds the moved code: `MeshHelpers` holds only entity readers; `PolygonWithHoles.cs`, `Tolerance.cs`, `SweepRings.cs`, `MeshDedup.cs`, `SurfaceMap.cs`, `PlanarMap.cs`, `CylinderMap.cs`, `RevolutionMap.cs`, `BSplineSurfaceMap.cs` are gone from `Ara3D.Ifc.Mesher`.
- Kernel files under 200 lines; no mesher file grows.
- Out of scope: any behaviour change (defects go to tickets); TKT-223; moving the kernel to `ara3d-sdk`; curve sampling; the Platonic analyzers on the kernel.

## Design

### Layout and namespaces

One namespace, `Ara3D.MeshKernel`, across all folders. Kernel test namespace `Ara3D.MeshKernel.Tests`. The mesher project and both mesher test projects get `<Using Include="Ara3D.MeshKernel" />`, so callers inside the mesher compile unchanged.

```
src/data/Ara3D.MeshKernel/
  Ara3D.MeshKernel.csproj        net8.0, Nullable, TreatWarningsAsErrors; Ara3D.Geometry, Ara3D.Models
  README.md
  Tolerance.cs
  Polygons/      PolygonWithHoles.cs  Polylines.cs  CircleSamples.cs  RingTriangulation.cs
  Meshes/        MeshOps.cs  MeshMeasure.cs  Extrusion.cs  MeshDedup.cs
  Sweeps/        SweepRings.cs  ParallelTransport.cs  FrameSweep.cs  TubeMesh.cs  Revolve.cs
  SurfaceMaps/   SurfaceMap.cs  FacePlane.cs  PlanarMap.cs  CylinderMap.cs  RevolutionMap.cs  BSplineSurface.cs  BSplineSurfaceMap.cs
  BSpline/       BSplineKnots.cs  BSplineEvaluator.cs (B11)
  Clipping/      CutPlane.cs  HalfSpaceClip.cs  ConvexPlanes.cs  ConvexCarve.cs  RevealCaps.cs
tests/data/Ara3D.MeshKernel.Tests/
  Ara3D.MeshKernel.Tests.csproj  NUnit; references the kernel only
  TestShapes.cs                  unit square, square with hole, bow tie, box (edited by B1 and B2 only)
  <Topic>Tests.cs                one per chunk
```

New mapping files in the mesher: `FaceSurfaceMaps.cs` (reads a face's surface entity, returns a kernel map) and `BSplineSurfaceReader.cs` (reads control grid, weights, knots into a `BSplineSurface`).

**Name rule.** No kernel type shares a name with a type in `Ara3D.Geometry`, `Ara3D.Models` or `Ara3D.Ifc.Mesher`. The SDK has `Plane`, `Ring`, `Tube`, `Circle`, `Arc`; the kernel uses `CutPlane`, `TubeMesh`, `CircleSamples`. On an ambiguity in a test file, rename the kernel type, never edit the test.

**Moved code keeps its body.** A move changes only namespace, visibility (internal to public), and comments naming IFC, web-ifc, or model files. New signatures appear only where a mixed file splits.

### Value types (`readonly record struct`)

| Type | Replaces | Used by |
|---|---|---|
| `CutPlane(Vector3 Point, Vector3 Normal)`, `SignedDistance(p) => Dot(p - Point, Normal)` | `OpeningCarver`'s private `Plane` (now `BooleanPlane.Plane` after C2); the point/normal pairs in `Booleans` | clip, carve |
| `HalfSpace(CutPlane Plane, bool KeepPositive)` | the three `ClipTriangle` parameters | `HalfSpaceClip` |
| `BoundedHalfSpace(HalfSpace HalfSpace, Frame3D Position, IReadOnlyList<Vector2> Boundary)` | the polygonal-bounded half-space's locals | `HalfSpaceClip` |
| `PlaneSplit(IReadOnlyList<Vector3> Inside, IReadOnlyList<Vector3> Outside)` | the `SplitPolygon` tuple | `ConvexPlanes`, `ConvexCarve`, `RevealCaps` |
| `DiskRadii(float Outer, float Inner)` | the `radius, innerRadius` pair | `TubeMesh` |
| `FaceTriangulation(IReadOnlyList<Triangle2D> Triangles, string? DropReason)` | the `out tris, out dropReason` pair | `RingTriangulation` |
| `FacePlane` (already a record struct) | moves as is | surface maps |

The SDK's `Ray3D` serves as the revolve axis and `Line3D` as the straight tube's axis. `BSplineSurface` is a `sealed record` because it carries the control net.

### Signatures (not compiled; the chunk that adds each type compiles it)

```csharp
namespace Ara3D.MeshKernel;
public static class Tolerance { public const float Eps = 1e-6f; }                                   // B0
public sealed class PolygonWithHoles { /* public surface unchanged */ }                              // B1
public static class MeshOps { Merge(IReadOnlyList<TriangleMesh3D>); Transform(TriangleMesh3D, Matrix4x4) /* flips winding under negative determinant */; LinearDeterminant(Matrix4x4); } // B2
public static class MeshMeasure { Bounds(TriangleMesh3D); SignedVolume(TriangleMesh3D); }           // B2
public static class Extrusion { Solid(PolygonWithHoles, Frame3D, Vector3); Ribbon(IReadOnlyList<Point3D>, Vector3); } // B2, B6
public static class MeshDedup { /* GetOrAddMesh unchanged */ }  public static class SweepRings { /* Connect unchanged */ } // B3
public static class CircleSamples { Ring(float radius, int segments); Arc(Vector2 center, float radius, float start, float end, int segments); } // B4
public abstract class SurfaceMap { ProjectRing(IReadOnlyList<Vector3>); Unproject(Vector2); }       // B5
public readonly record struct FacePlane(Vector3 Origin, Vector3 Normal, Vector3 U, Vector3 V) { static OfRing(ring); /* OfTriangle, Newell, FromFrame, Project, Unproject */ }
public sealed class PlanarMap(FacePlane) : SurfaceMap;  public sealed class CylinderMap(Frame3D, float radius) : SurfaceMap { static DensifyUvRing(...); }
public sealed class RevolutionMap : SurfaceMap { static RevolutionMap? Build(Ray3D axis, IReadOnlyList<Vector3> meridian); }
public sealed record BSplineSurface(control points, weights, UKnots, VKnots, UDegree, VDegree);     // knots already expanded
public sealed class BSplineSurfaceMap : SurfaceMap { static BSplineSurfaceMap? Build(BSplineSurface); }
public static class BSplineKnots { Expand(IReadOnlyList<double> knots, IReadOnlyList<double> multiplicities); }
public readonly record struct DiskRadii(float Outer, float Inner);                                   // B6
public static class ParallelTransport { Frames(IReadOnlyList<Vector3> path); }
public static class FrameSweep { Along(IReadOnlyList<Vector2> profile, IReadOnlyList<Frame3D> frames); }
public static class TubeMesh { Straight(Line3D axis, DiskRadii radii, int segments); }
public static class Revolve { Solid(PolygonWithHoles, Frame3D, Ray3D axis, float angle, int segments); }
public static class Polylines { DropRepeats(points, toleranceSquared) 2D/3D; DropClosure(points, toleranceSquared) 2D/3D; } // B7
public readonly record struct FaceTriangulation(IReadOnlyList<Triangle2D> Triangles, string? DropReason); // B8
public static class RingTriangulation { const double MaxAreaDeviation = 0.01; Triangulate(outer, holes); }
public readonly record struct CutPlane(Vector3 Point, Vector3 Normal);  HalfSpace(CutPlane, bool KeepPositive);  BoundedHalfSpace(HalfSpace, Frame3D, IReadOnlyList<Vector2>); // B9
public static class HalfSpaceClip { Clip(TriangleMesh3D, HalfSpace); Clip(TriangleMesh3D, BoundedHalfSpace); }
public readonly record struct PlaneSplit(Inside, Outside);                                           // B10
public static class ConvexPlanes { IReadOnlyList<CutPlane>? Derive(TriangleMesh3D); PlaneSplit Split(polygon, CutPlane, float eps); }
public static class RevealCaps { Build(TriangleMesh3D prism, IReadOnlyList<CutPlane> hostPlanes); }
public static class ConvexCarve { Carve(TriangleMesh3D host, IReadOnlyList<TriangleMesh3D> prisms); } // unchanged host when degenerate, non-convex, disjoint
```

Where a moved function returns `List<T>` and its caller mutates the result, the new signature returns `IReadOnlyList<T>` and the caller copies once per ring.

### Every mesher file, classified

Kernel, moves whole: `Tolerance.cs`, `PolygonWithHoles.cs`, `SweepRings.cs`, `MeshDedup.cs`.

Mixed, split (stays in the mesher / moves to the kernel):

| File | Stays | Moves |
|---|---|---|
| `MeshHelpers.cs` | entity readers | `Merge`, `Transform`, `LinearDeterminant`, `GetBounds`, `SignedVolume`, `BuildExtrusionWithHoles` and helpers |
| `Booleans.cs`, `BooleanPlane.cs` | entity and context reading; agreement rule; `ResolveClipPlane`; `InferExtrusionClipDistance`; `TryGetExtrudedSolid`; `ReadHalfSpacePlane` | the per-triangle loops, `ClipTriangle`, `SignedDistance`, `LerpPlane`, `EmitClippedPolygon`, `FaceNormalDot`, `AddPoint`, `PointInPolygon` |
| `OpeningCarver.cs` | `CollectVoidRelations`, `BuildOpeningWorldSolids` | both `CarveConvex`, `CarveSingle`, `BuildReveal`, `DeriveConvexPlanes`, `SplitPolygon`, `TriangleOverlapsBox`, `Min`, `Max` |
| `SurfaceMap.cs` | `Resolve` (to `FaceSurfaceMaps`) | the abstract class |
| `PlanarMap.cs` | `TryFromFaceSurface`, `PlaneContainmentTolerance`, plane readers (to `FaceSurfaceMaps`) | `FacePlane`, `PlanarMap` |
| `CylinderMap.cs`, `RevolutionMap.cs` | `TryBuild`, `EvaluateMeridianCurve3D` | the rest |
| `BSplineSurfaceMap.cs` | `TryBuild`, `Build(ctx, …)`, `ReadControlGrid`, `ReadWeightGrid` (to `BSplineSurfaceReader`) | constructor, `ProjectRing`, `Unproject`, `Eval`, `FindSpan`, `BasisFuns`, validity checks; `ExpandKnots` to `BSplineKnots` |
| `FaceSetBuilder.cs` | the weld loop with `Quantize3`, `RecordFaceDiagnostics` | `TryTriangulateFaceRing`, `TryTriangulateConvexQuad`, `SignedArea2`, `MaxFaceAreaDeviation`, `DedupeConsecutive` |
| `FaceBounds.cs` | the rest | `DedupeConsecutive3D` |
| `CurveEvaluator.cs`, `CompositeCurves.cs` | the rest | `SanitizeRingPoints`, `SanitizeOpenPathPoints`, `SanitizeOpenPathPoints3D` |
| `ProfilePoints.cs` | `ApplyPosition` | `SampleCircle`, `AddArc`, `SimplifyPolygon` |
| `SweptDisks.cs`, `DirectrixSweeps.cs` | entity reading | `BuildStraightSweptDisk` and helpers, `SampleCircleProfile`, `BuildParallelTransportFrames`, the band loop (one function, `FrameSweep.Along`) |
| `Revolutions.cs` | entity reading, axis resolution, segment count | rotation loop, `RotatePoints`, end caps |
| `SweptSolids.cs` | the rest | `BuildExtrudedRibbon` |

IFC-free code that stays this track (extension points): `Conics.cs`, `PolyCurves.cs`, `TrimmedCurves.cs` (curve sampling, after TKT-243); composite-profile containment in `SweptSolids.cs` (and a `PointInPolygon` differing from `Booleans`' by `+1e-12f`); `Placements.FrameFromOriginXZ`, `BasisMatrix`; `IfcModelStats.cs` (only its `SignedVolume` duplicate switches to `MeshMeasure` in B2).

Mapping, stays whole: `AggregatedVoidHosts`, `BSplineCurves`, `BasicProfiles`, `Brep`, `Conics`, `Diagnostics`, `GeometryCoverage`, `GeometryDispatcher`, `GeometryPartCollector`, `IfcMesher`, `IfcMeshingResult`, `IfcModelStats`, `MeshingContext`, `ModelAssembler`, `Placements`, `PolyCurves`, `ProfileBuilder`, `SteelProfiles`, `StyleResolver`, `Tessellated`, `TrimmedCurves`, `Units`.

### `MeshHelpers` split

Kernel `MeshOps` (`Merge`, `Transform`, `LinearDeterminant`), `MeshMeasure` (`Bounds`, `SignedVolume`), `Extrusion` (`Solid`, `Ribbon`). Mesher `MeshHelpers` keeps the entity readers and, from B2 to B13, one-line forwarders for `GetBounds`, `SignedVolume`, `Transform`, `Merge`, `LinearDeterminant` (the five members tests and wave-1 files call). B14 renames what is left to `EntityReader`.

### Rules while other builders are in flight

- Before deleting a name, `git grep` the working tree (which includes other agents' uncommitted edits). If a file in another fence uses it, keep a forwarder and list it under Planned debt.
- A compile error in a file outside the chunk's fence means another agent is mid-edit: wait and rebuild, report after three tries, never edit that file. Likewise for file-lock errors from two agents building the same project.

## Shared files (supervisor only)

`BimOpenData.sln`; the mesher csproj (`ProjectReference` to the kernel, `<Using Include="Ara3D.MeshKernel" />`); both mesher test csprojs (`<Using>` only); the kernel csproj after B0; READMEs (kernel, mesher layout table, `src/data/README.md`); `GeometryCoverage.cs`; in the toolkit, `BimOpenToolkit.sln` and the `deps.json` pin.

## Considered and rejected

- **The SDK's `Ara3D.Geometry.Plane` instead of `CutPlane`.** `Dot(n, p) + d` rounds differently from `Dot(p - point, n)`; golden meshes could shift in the last bits. Would change if a behaviour-changing chunk re-baselines the goldens.
- **The SDK's `MeshPlaneClip.ClipBelow/ClipAbove` for the clip.** Epsilon 1e-5 against 1e-6, no welding, a fan instead of the normal-preserving diagonal. Would change if a Track C item scores both on the quick files and the SDK's is no worse.
- **Rename `Booleans` to `BooleanItems`.** Tests call it by name. Joins B14 if Q1 is yes.
- **A `Ring` type wrapping `IReadOnlyList<Vector2>`.** Name collides with the SDK; a struct over a list compares by reference. Would change if rings need an invariant carried in the type.
- **A `SampleDensity(CircleSegments, ArcSegments)` type in kernel signatures.** No kernel function takes both. Would change when adaptive sampling adds a chord tolerance (likely after TKT-243).
- **Import `Platonic.props` (purity analyzers).** They forbid plain and abstract classes and mutable fields; `PolygonWithHoles`, `SurfaceMap`, `CylinderMap`, `RevolutionMap` would need rewriting. The kernel takes `TreatWarningsAsErrors` alone.
- **Keep moved types in namespace `Ara3D.Ifc.Mesher` inside the kernel assembly.** The namespace would name IFC.
- **No forwarders, switch every caller inside each chunk.** Callers include in-flight files and about 25 test files.
- **Move curve sampling now.** TKT-243's evaluator just landed; one curve-sampling API designed with it beats two.
- **Put the kernel in `ara3d-sdk` now.** The roadmap's open question 1 for the owner.

## Planned debt

| Entry | Payoff |
|---|---|
| Five forwarders on `MeshHelpers`, from B2 | B12, B13; a ticket if Q1 is no |
| Two B-spline span/basis implementations (`BSplineSurfaceMap`, `BSplineEvaluator`) and two knot expansions | B11; a ticket if they cannot merge byte for byte |
| `MeshHelpers` names entity readers | B14, or a ticket |

## Extension points

A curve-sampling module in the kernel; pure surface maps (`ProjectFace(outer, holes)` returning every ring at once, since `CylinderMap` and `RevolutionMap` set a reference angle on the first `ProjectRing`); one point-in-polygon; a kernel `ModelStats`; kernel invariants through `GeometryOracles/` after TKT-223. Track D's D2 should start after B8 so its fences name kernel paths.

## Findings to file as tickets

1. The solid straight swept disk has no start cap: `SweptDisks.cs` calls `AddFanCapFaces(faces, 0, segments, reverse: true)`, passing vertex 0 as the centre and `segments` as the ring start, so the start ring stays open when there is no inner radius. From reading the code, not seen on a file.
2. `IfcModelStats.Transform` does not reverse winding under a negative determinant while `MeshHelpers.Transform` does, so `IfcMeshingResult.SignedVolume` counts a mirrored instance with its sign flipped. From reading the code.
3. For D2: `Booleans.AddPoint` welds by scanning every output point, quadratic in the clipped mesh's size.

## Open questions (defaults in force)

- Q1. May B13 edit test files mechanically (`MeshHelpers.X` to `MeshOps.X` or `MeshMeasure.X`, no assertion changes)? Default yes, as its own chunk after review.
- Q2. Does `<Using Include="Ara3D.MeshKernel" />` in the test csprojs count as tests unchanged? Default yes.
- Q3. One ticket for the track? Default yes: TKT-246 on every B commit.
- Q4. File findings 1 and 2 now? Default yes.

## Chunks

`K/` is `src/data/Ara3D.MeshKernel/`, `KT/` is `tests/data/Ara3D.MeshKernel.Tests/`, `M/` is `src/data/Ara3D.Ifc.Mesher/`, all under `deps/bim-open-data/`.

Checks for every chunk: build `tests/data/Ara3D.IfcMeshingComparison` and `src/mcp/BimOpenMcp.Ifc`; `dotnet test` the kernel tests; the mesher fast tests at the baseline count; with `ARA3D_IFC_TEST_DIRS` set, `--filter "Category=IfcMesherParity|FullyQualifiedName~ScoreQuickComparisonFiles"` with the same pass and fail set and `scorecard.json` reverted; the IFC-word `git grep` empty; up to B12 no diff under the mesher test directories; kernel files under 200 lines.

| Chunk | After | Fence | Kernel tests (hand-built inputs) | Done |
|---|---|---|---|---|
| B0 (supervisor) | none | `K/Ara3D.MeshKernel.csproj`, `K/Tolerance.cs`, `KT/Ara3D.MeshKernel.Tests.csproj`, `KT/ToleranceTests.cs`, `M/Tolerance.cs` (deleted), the mesher csproj, both mesher test csprojs, `BimOpenData.sln` | `Eps == 1e-6f` | both projects in the solution; mesher tests at baseline |
| B1 | B0 | `M/PolygonWithHoles.cs` (deleted), `K/Polygons/PolygonWithHoles.cs`, TestShapes, `KT/PolygonWithHolesTests.cs` | clockwise unit square becomes counter-clockwise, area 1, 2 triangles; 2×2 square with centred 1×1 hole: hole clockwise, area 3, 8 triangles; triangular hole resampled to 4, 8 triangles; bow tie self-intersects, square does not; `CleanRing` of a ring with a doubled first point and a closing point gives 4 points | the type is only in the kernel |
| B2 | B1 | `M/MeshHelpers.cs`, `M/SweptSolids.cs`, `M/IfcModelStats.cs`, `K/Meshes/MeshOps.cs`, `MeshMeasure.cs`, `Extrusion.cs`, TestShapes (adds `Box`), `KT/ExtrusionTests.cs`, `KT/MeshOpsTests.cs` | unit box: 8 points, 12 triangles, volume 1 ± 1e-6, bounds (0,0,0)–(1,1,1); square-with-hole box: 16 points, 32 triangles, volume 3, every edge shared by two triangles; box mirrored in x: determinant −1, volume still +1; merge of two boxes: 16 points, 24 triangles, volume 2; bounds of an empty mesh is `Bounds3D.Empty` | `MeshHelpers` holds entity readers plus 5 forwarders; `SweptSolids` calls `Extrusion.Solid` |
| B3 | B0 | `M/SweepRings.cs`, `M/MeshDedup.cs` (deleted), `K/Sweeps/SweepRings.cs`, `K/Meshes/MeshDedup.cs`, `KT/MeshDedupTests.cs`, `KT/SweepRingsTests.cs` | the same quad twice in scope 0 gives one index; in scopes 1 and 2 gives two; a quad and its translate give two; `Connect` of two 4-point rings gives 8 points, 8 triangles, the first (0, 1, 5) | names and signatures unchanged |
| B4 | B0 | `M/ProfilePoints.cs`, `M/BasicProfiles.cs`, `M/SteelProfiles.cs`, `M/SweptDisks.cs`, `K/Polygons/CircleSamples.cs`, `KT/CircleSamplesTests.cs` | `Ring(1,4)` is (1,0),(0,1),(−1,0),(0,−1) within 1e-6; `Ring(2,32)`: 32 points at distance 2; `Arc((1,1),1,0,π/2,4)`: 5 points from (2,1) to (1,2); `Ring(r,0)` empty | one circle sampler |
| B5 | B0 | `M/SurfaceMap.cs`, `PlanarMap.cs`, `CylinderMap.cs`, `RevolutionMap.cs`, `BSplineSurfaceMap.cs` (deleted), `M/FaceSurfaceMaps.cs`, `M/BSplineSurfaceReader.cs`, `M/FaceSetBuilder.cs`, `K/SurfaceMaps/*`, `K/BSpline/BSplineKnots.cs`, `KT/SurfaceMapTests.cs` | `FacePlane.OfRing` of a square at z = 2: normal ±Z, round trip within 1e-6; collinear ring gives UnitZ; `CylinderMap` radius 2: u steps by π with no 2π jump; `RevolutionMap.Build` round trip of (0,1,0.5) within 1e-5; degree-1 2×2 net centre unprojects to the bilinear centre | the mapping half reads only |
| B6 | B2, B3, B4 | `M/DirectrixSweeps.cs`, `M/SweptDisks.cs`, `M/Revolutions.cs`, `M/SweptSolids.cs`, `K/Sweeps/ParallelTransport.cs`, `FrameSweep.cs`, `TubeMesh.cs`, `Revolve.cs`, `K/Meshes/Extrusion.cs`, `KT/SweepTests.cs` | straight 3-point path: equal frames; L path: last Z = +X; `TubeMesh.Straight` length 1, radii (1, 0.5), 16 segments: 64 points, 128 triangles, closed, volume ≈ 2.296 ± 1e-3; square [1,2]×[0,1] revolved about Y, 32 segments: volume ≈ 9.364 ± 1e-3, no caps; `Ribbon` of 3 points: 6 points, 4 triangles | one band loop for directrix sweeps and curved disks |
| B7 | B4, B5 | `M/CurveEvaluator.cs`, `CompositeCurves.cs`, `PolyCurves.cs`, `FaceBounds.cs`, `FaceSetBuilder.cs`, `FaceSurfaceMaps.cs`, `ProfilePoints.cs`, `SteelProfiles.cs`, `K/Polygons/Polylines.cs`, `KT/PolylinesTests.cs` | `DropRepeats` of [(0,0),(0,0),(1,0),(1,0),(1,1)] gives 3 points; `DropClosure` removes one closing point only; tolerances 1e-12 and 1e-10 distinguished | six dedupe copies become one; each caller passes its old constant |
| B8 | B7 | `M/FaceSetBuilder.cs`, `K/Polygons/RingTriangulation.cs`, `KT/RingTriangulationTests.cs` | unit square: 2 triangles, no reason; convex 1 × 1e-5 quad: 2 triangles via the thin-quad path; area below `Eps`: "triangulation failed"; 2×2 square with congruent hole: 8 triangles; a folded ring: reason starts "area off by" | `FaceSetBuilder` under 150 lines |
| B9 | C4 committed, B2 | `M/Booleans*.cs`, `K/Clipping/CutPlane.cs`, `HalfSpaceClip.cs`, `KT/HalfSpaceClipTests.cs` | unit box clipped at z = 0.5 keeping negative: z in 0..0.5; plane at z = 2 keeping negative: unchanged; keeping positive: 0 triangles; bounded by [5,6]²: unchanged; bounded by [−1,2]²: same as the plain clip | `Booleans` keeps its name and entry points and calls the kernel |
| B10 | B9, not with D3 | `M/OpeningCarver.cs`, `ModelAssembler.cs`, `AggregatedVoidHosts.cs`, `K/Clipping/ConvexPlanes.cs`, `ConvexCarve.cs`, `RevealCaps.cs`, `KT/ConvexCarveTests.cs` | 4×4×1 slab minus a centred 1×1×3 prism: no centroid inside, reveal area 4 ± 1e-4; disjoint prism: unchanged; L prism: unchanged, `Derive` null; `Derive(unit box)`: 6 outward normals | `OpeningCarver` keeps only void relations and opening solids |
| B11 | C1 committed, B5 | `M/BSplineEvaluator.cs` (deleted), `M/BSplineCurves.cs`, `K/BSpline/*`, `K/SurfaceMaps/BSplineSurfaceMap.cs`, `KT/BSplineTests.cs` | `Expand([0,1],[2,2])` gives [0,0,1,1]; rational quarter circle at t = 0.5 on the unit circle within 1e-4; degree-1 net centre through the shared basis | one span and basis implementation if byte-identical; otherwise a ticket |
| B12 | B6, B9, B10, not with D3 | each `M/*.cs` that calls a forwarder | none | `git grep -E "MeshHelpers\.(Merge\|Transform\|GetBounds\|SignedVolume\|LinearDeterminant)" -- src` empty |
| B13 | B12; Q1 yes; TKT-223 not in flight | `M/MeshHelpers.cs`, test call sites | none | forwarders deleted; test count unchanged |
| B14 (optional) | B13 | `MeshHelpers` call sites | none | renamed `EntityReader`, or a ticket |
| B15 (supervisor) | B11, B13 | `K/README.md`, `M/README.md`, `src/data/README.md`, toolkit `BimOpenToolkit.sln`, `deps.json` | none | kernel README has no IFC word; toolkit pin updated |

Order: B0; then B1, B3, B4, B5 in parallel, B2 after B1; then B6 (after B2, B3, B4) and B7 (after B4, B5); then B8. After wave 1: B9 and B11 in parallel, then B10, B12, B13, B14, B15.

## Build log

| Chunk | Commit | Result |
|---|---|---|
| B0 | bim-open-data 59f2949 | Ara3D.MeshKernel and its test project; Tolerance moved; global using in mesher and both test projects; 152/152 fast tests |
| B3 | bim-open-data 4ab0818 | SweepRings and MeshDedup moved; 4 kernel tests; MeshDedup inlines GetBounds until B2 |
| B5 | bim-open-data 017ca5d | SurfaceMap family and BSplineKnots moved; FaceSurfaceMaps and BSplineSurfaceReader keep the entity reading; 8 kernel tests; no forwarders |
| B4 | bim-open-data 08e6475, 16ccbb3 | CircleSamples.Ring and Arc replace two identical copies and AddArc; 4 kernel tests |
| B1 | bim-open-data 4bf322c | PolygonWithHoles moved (partial class with RingBandTriangulation.cs); 5 kernel tests, bow-tie one ignored: the SDK self-intersection sweep never fires (TKT filed) |
| B2 | bim-open-data eeefb1d | MeshOps, MeshMeasure, Extrusion in the kernel; MeshHelpers keeps readers and 5 forwarders; 29 kernel tests |
