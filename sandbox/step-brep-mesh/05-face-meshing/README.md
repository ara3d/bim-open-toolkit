# Layer 05: face meshing

This layer turns one face of a B-rep into a mesh of that face. It takes the face, the shared
polylines of its edges (layer 04), and the meshing criteria, and returns a `FaceMesh` or, when the
edges are too coarse for the face's parameter space, refinement requests for those edges. Layer 06
assembles the face meshes; layer 08 runs the loop that refines the requested edges and meshes the
faces again.

The design is written against [VOCABULARY.md](../VOCABULARY.md) revision 2 and against the names
layers 00 to 04 export as they stood on 2026-10-17 (listed under "Names used from layers 00 to 04").
Algorithms were deferred by the design pass, every one with a contract in `face-meshing.spec.plato`; implementation chunk A gave six of them bodies (see "Implementation, chunk A"). Chunk B gave `CompletePeriodicRegion`, `QuadSidesOf`, `QuadGrid` and `MatchingFloors` their bodies, and replaced the bodies of `TriangulateRegion` and `RefineToSurface` (see "Implementation, chunk B"). Still bodiless: `ExpandedPoles` and `CutWholePeriods`, the pole segments and the whole-period cuts of `CompletePeriodicRegion` (chunk C).

## Files

| File | Holds |
|---|---|
| `uv-regions.types.plato` | `UvPointSource`, `UvLoop`, `UvRegion`, `UvSample`, `FaceChart`, `QuadSides` |
| `face-meshing.types.plato` | `FaceMeshingCriteria`, `UvTriangulation`, `FaceMesh`, `QuadGridOutcome`, `FaceMeshOutcome` |
| `uv-regions.library.plato` | library `UvRegions`: sources, coedge samples, the projection-versus-pcurve rule, `LoopToUv`, `Unwrap`, `AddMissingSeamsAndPoles`, the chart and tolerances, signed areas, `OrientRegion`, `RegionOf`, windings, collapsed lines, simplicity and containment, seam cuts, the region's refinement requests, four-sided regions |
| `face-meshing.library.plato` | library `FaceMeshing`: preconditions (`IsDiscretizedFace`), criteria, `TriangulateRegion`, `RefineToSurface`, element measures, `Lift`, the surface measures, quads and `QuadGridIfRectangular`, outcomes, `MeshFace` |
| `uv-delaunay.library.plato` | library `UvDelaunay` (chunk B): the neighbour table, Lawson's constrained flips (`FlipPass`, `Delaunayed`, with the in-circle test `IsFlippableCdt`), and the refinement tests (`TriangleNeedsRefinement`, `NeedsRefinement`, `KnownGood`), shared by `TriangulateRegion` and `RefineToSurface` |
| `triangulation-cdt.library.plato` | library `TriangulationCdt` (TKT-343): `InCircle`, `InCircleOf`, `IsFlippableCdt`, `TriangulateRegionCdt` |
| `triangulation-refine.library.plato` | library `TriangulationRefine` (TKT-343): `RefineToSurfaceByInsertion`, its surface and angle passes, off-centres |
| `triangulation-requests.library.plato` | library `TriangulationRequests` (TKT-343): `QualitySegmentRequestsCdt`, not wired (it adds boundary segments; waits for an angle bound in `FaceMeshingCriteria`) |
| `triangulation.laws.plato` | library `TriangulationLaws` (TKT-343): 16 laws of the two functions over six sample models |
| `face-meshing.laws.plato` | library `FaceMeshingLaws`: 46 laws and their guards |
| `face-meshing.spec.plato` | invariants of 7 types, contracts of 15 functions (chunk B added `ExpandedPoles` and `CutWholePeriods`), 3 theorems |

The contract names one library block, `FaceMeshing`, for this layer. The layer is large enough that
the region half has its own block, `UvRegions`; `FaceMeshing` keeps the contract's name and the entry
point.

## The objects

**The parameter manifold.** A surface is a map `S` from its natural parameter domain to space. Along
a periodic direction (the angle of a cylinder, cone, sphere, or torus) the parameter lives on a
circle, so the domain is a subset of the plane, of a cylinder `R x S1`, or of a torus `S1 x S1`.
Call it `M`. It is the quotient of the plane by the lattice of periods, and the quotient map
`pi: R^2 -> M` is a covering map.

**A face** is `S(Omega)` for a region `Omega` of `M`. `Omega` is bounded by the images of the face's
loops, and the face lies to the left of each loop as traversed, seen from the face normal.

**Loops into parameter space.** Each loop is a closed polygon in space whose vertices are the shared
edge samples. `LoopToUv` maps each sample to `M`, by inverse evaluation on the surface or through a
pcurve (the rule is below). It is the only place a 3D point becomes a parameter point, and
`Law_LoopPointLiftsToSharedPoint` checks that `S` maps each one back within the length tolerance.

**Unwrapping is lifting through the covering map.** A loop in `M` lifts to a path in the plane:
`Unwrap` replaces each point by the copy nearest its predecessor, except on a model seam, where the
left rule below picks the copy. The path closes when the loop winds zero times around each periodic
direction. A circle around a cylinder winds once, so its lift ends one period from where it began
(`Winding`, `UWinding`, `VWinding`).

**The two uses of a model seam lie on opposite copies, by the left rule.** In the chart
`(s u, v)` (below), the face lies to the left of every coedge as traversed
(research/STEP-BREP-MODEL.md section 4.3), so the other bank of a seam use lies to its left: the use
traversed with increasing `v` sits on the copy at the larger chart `u`, the one traversed with
decreasing `v` on the smaller. `Unwrap` applies this to the second use of every seam segment
(`AreTwinSteps`, `FollowsLeftRule`), and `Law_SeamUsesOnOppositeCopies` states it. Continuity would
decide it only when something between the two uses winds around the period, as the circles of a
cylinder do. When the uses meet at a pole or an apex nothing does: a sphere bounded by one seam, or a
cone bounded by its base circle and a seam to its apex, would put both uses on one copy, a zero-width
slit that no refinement clears.

**A closed direction is a periodic one here.** Layer 00's `Periodicity` has a third case,
`Closed(Period)`: the formula does not wrap, but the range's two ends are one point, as on a clamped
B-spline surface that a CAD system wraps into a cylinder (STEP has no periodic B-spline surface).
Every function of this layer that reasons about seams (`StepBelowHalfPeriod`, `Winding`, `Unwrap`,
`AddMissingSeamsAndPoles`, the left rule) treats `Closed` exactly like `Periodic`; layer 01's `Eval`
moves a closed parameter into its range before evaluating. Without it, a seam's samples on such a face
would have two nearest copies, the loop would zig-zag, and a band between two closed B-spline edges
would get no cut.

**A seam cut chooses a fundamental domain.** When loops wind, `Omega` does not embed in the plane.
Cutting `M` along an arc from one winding loop to another (or to a pole) gives a region that does,
and the two banks of the cut become two sides of a planar polygon. The two copies differ by one
period, so they are identified by a lattice translation. A model seam edge is such a cut that the
file already provides. `AddMissingSeamsAndPoles` adds the cut when the file has none: a cylinder band
between two circles, a hemisphere bounded by its equator, a whole sphere or torus.

**A pole is a point blown up into a segment.** At a sphere's pole or a cone's apex, `S` collapses a
whole iso-line `{v = c}` to one point (layer 01's `CollapsedAt`). In parameter space the point
becomes the segment of that line between the parameter where the boundary arrives and the one where
it leaves, as in polar coordinates. All points of the segment are one 3D vertex. The segment lies on
a side of the domain for a sphere and inside the domain for a cone, where it bounds the face's region;
`Pole(Side, Index)` names the side of the face's parameter box.

So a face is the image under `S` of a planar polygon with holes, `P`, modulo an equivalence `~`
that glues the two copies of each seam point and collapses each pole segment. `UvRegion` is `P` with
the source of every boundary point; `IdentifiedSources` is `~`.

**The triangulation** is a constrained planar subdivision of `P` whose vertices include every
boundary point, unchanged, and possibly interior points. **Lifting** composes it with `S`: each
corner goes to its 3D vertex, the elements become flat triangles and quads, and the complex is
`T / ~`. Elements with two corners on one pole segment collapse and are dropped; the test is
combinatorial (two corners with identified sources, `IsCollapsedElement`), the same relation that
numbers the local vertices, so an element is dropped exactly when it loses a corner.

**Orientation.** Work in the chart `chi(u, v) = (s u, v)` with `s` = layer 02's `FaceNormalSign`,
the sign of the face normal against `PartialU x PartialV` (the face's `SameSense`, times -1 on the
inner part of a degenerate torus). Then a small triangle positive in `chi` lifts to a triangle whose
normal `(b - a) x (c - a)` is a positive multiple of the face normal, to first order, and elements
keep their corner order from parameter space to space. First order is not enough for a sliver: on
the unit sphere the parameter triangle `(0, 0.5)`, `(0.2, 0.5)`, `(0.1, 0.5001)` is positive in the
chart, yet lifts 117 degrees off the face normal, because its height is below the sagitta of its long
edge. So the lifted sign is enforced, not derived: refinement splits an element that folds when
lifted (`Law_ElementLiftsFacingFaceNormal`), a quad grid with a folded element is not used
(`GridUnlessFolded`), and `MeshFace` ensures `Law_ElementFacesFaceNormal`.

## Decisions and reasons

**Projection first, a pcurve only when unambiguous.** Pcurves are absent from most files
(research/STEP-BREP-MODEL.md section 6.4). The points of a coedge are layer 04's `ImagePoints` of
the edge in the image `ImageInFace` chooses, so the polygon layer 04 certifies is the one this layer
triangulates. `ImageInFace` reads an edge's samples from a pcurve
when the edge's curve carries exactly one pcurve on the face's surface (layer 02's `PcurvesOnFace`)
and the edge is not a seam of the face; otherwise it projects. A seam's two pcurves lie on the same
surface, and the file does not record which use takes which; the left rule in `Unwrap` assigns the
two copies. On the pcurve route the parameter is found by one-dimensional inverse evaluation on
the pcurve lifted through the surface (layer 01's `ClosestParameter` on a `PcurveIndex`), which is
robust where surface projection is not. `Law_PcurveAgreesWithProjection` states that the two routes
give the same parameters up to whole periods, within the parameter tolerance at the point, except on
a collapsed line, where one parameter is free.

**Synthetic seams and poles belong here.** They are not model topology and must not reach provenance
as edges (research/MESHING-REQUIREMENTS.md recommendation 21). `SeamCut` and `Pole` points are face
interior vertices in 3D: layer 06 numbers them as such, through `MeshVertexProvenance.OnFace`.

**Poles come from collapsed lines, not from `DegenerateSides`.** A cone's apex is inside its
domain (both nappes are in the domain), so layer 01's `DegenerateSides` does not report it. The
layer uses `CollapsedAt` for both parameters and tests points with `IsOnCollapsedLine`.

**Anisotropy: a face-wide scaled chart for decisions, 3D for acceptance.** On a cylinder of radius
500 mm, u is in radians and v in millimetres, so a triangle that is equilateral in natural
parameters is 500 times longer around the axis than along it. `FaceChart` scales u and v by the
face's mean surface speeds (`MeanSpeed`: the mean of `|PartialU|` and `|PartialV|`, the square roots
of the first fundamental form's `E` and `G`, over three iso-lines of twenty steps, as OpenCascade
does). That is exact on planes and cylinders and close on cones; the constrained Delaunay
triangulation and refinement's insertion decisions work there. No acceptance test depends on the
chart: chordal deviation, normal deviation, and winding are measured in 3D. The first fundamental
form enters in one more place: tolerances. The region's tolerance is layer 00's `UvToleranceAt` at
the chart's speeds, floored per direction by its kind (layer 01's `UvFloorOf`: the angle floor in
radians for an angle parameter, the length floor otherwise) (`RegionTolerance`); a point's tolerance is layer 01's `UvToleranceAt` at the
local speeds (`PointTolerance`). A metric (Riemannian) triangulation for B-spline faces is left for a
later version.

**`SurfaceAngular` is the normal turn along an element edge.** OpenCascade (`AngleInterior`) and ACIS
(`SPANORMALTOL`) bound the angle between the surface normals at the two ends of an element edge.
This layer adopts that definition: for every *surface edge* of an element, the angle between the
face normals stored at its two ends is at most `SurfaceAngular`
(`Law_SurfaceEdgeNormalTurnWithinSurfaceAngular`, `EdgeNormalTurn`). A surface edge is an element edge
that is not a segment of a model edge's discretization (layer 04's angular criterion bounds those,
and the boundary is locked) and does not lie along one collapsed line. The turn does not bound the
element-normal test that the root README states: the flat normal of a sliver need not lie in the cone
of its corner normals. The unit-sphere sliver `(0, 0.5)`, `(0.2, 0.5)`, `(0.1, 0.5001)` turns by at
most 0.175 rad along its edges, yet its flat normal is 2.05 rad from the face normal at its centroid,
and it lies 3.8e-3 from the sphere. So `Law_ElementNormalAgreesWithSurface` is a second criterion with
the same tolerance, not a consequence, and refinement enforces both. Against the per-corner definition of
research/MESHING-REQUIREMENTS.md section 2.3 (element normal against surface normal at a corner),
the turn is about `sqrt(3)` times larger for equilateral triangles on a sphere and exactly twice for a
cylinder strip, so a value copied from OpenCascade or ACIS means the same here. Parasolid's
`surface_plane_ang` sums two such corner angles, about the turn for a strip.

**Chordal deviation is measured by projection.** `SurfaceDistance(p)` is the distance from `p` to
the surface point that inverse evaluation returns, which is never less than the true distance; a bound
on it therefore bounds the truth whatever the quality of the projection, and it does not depend on
the parameterization, so elements at a pole are measured like any other. `ElementDeviation` takes the
largest over the midpoints of the element's surface edges and the mean of its corners
(OpenCascade's sample points), and `Law_ElementDeviationWithinSurfaceChordal` bounds it by
`SurfaceChordal` plus the length tolerance, since the corners themselves may lie that far off the
surface. Model-edge segments are excluded as they are from the angular law.

**The boundary is locked, and refinement can stop short.** Refinement adds points strictly inside
the region and never adds, moves, or removes a boundary point (`Law_TriangulationKeepsBoundary`).
It stops when a new point would lie within `MinLength` of an existing one, so `MeshFace` promises the
surface criteria for every element except those with an edge shorter than twice `MinLength`.

**Blocking and advisory requests.** A region whose boundary segments come closer than the region's
tolerance cannot be triangulated validly. `MeshFace` then returns `LoopSelfIntersects` requests for
the edges whose segments collide, an error diagnostic per request, and an empty mesh; when only
synthetic segments collide, one face error and no request. A segment whose straight
parameter-space chord strays from its 3D chord (`TooCoarseInParameterSpace`, layer 04's
`UvChordDeviation` repeated as a backstop) and a quad count mismatch (`QuadCountMismatch`) leave a
valid triangle mesh, so those requests are advisory and come with the mesh (`IsBlocking`). A refinement
request asks for a third of the edge's current largest sagitta (OpenCascade divides by three), so each
round asks for strictly finer; a count request carries the wanted count in layer 04's `Segments`.

**Orientation is normalized once.** `OrientRegion` reverses any loop whose signed area in the chart
has the wrong sign (outer positive, holes negative); the point set does not change. On a surface that
is not closed, a reversal marks a defective file and `MeshFace` reports it (`FACE-LOOP-REVERSED`).
On a sphere or torus the loop direction is what chooses which side of a winding loop is the face, so
`AddMissingSeamsAndPoles` reads it before any reversal.

**A vertex loop inside a face is a point hole.** It removes no area and becomes a corner of every
triangulation (`Law_EveryPointIsACorner`), so the model vertex appears in the mesh and the Euler
characteristic is unchanged. A vertex loop on a collapsed line becomes the pole segment instead.
A vertex loop whose vertex another bound of the face already reaches, or that repeats an earlier
vertex loop, is skipped (`MeshedBounds`, `IsRedundantVertexLoop`), as layer 02's `ReducedCounts`
drops it: on a sphere whose seam runs between two poles that also carry vertex loops, expanding them
would lay a second pole segment over the seam loop's own, and the region would never be simple.

**Quads are optional.** `PreferQuads` false gives triangles only (`Law_NoQuadsUnlessPreferred`).
With it true, `QuadGridIfRectangular` builds a structured grid when the outer loop is four-sided
with no holes, each side one coedge, seam use, seam cut, or pole segment, and opposite sides have
equal segment counts. Interior nodes come from transfinite interpolation of the sides; a quad that is
not planar within `SurfaceChordal` or not strictly convex is split. Unequal counts give triangles this
round and advisory requests whose `Segments` is the opposite side's count (`MatchingFloors`). Rows
touching a pole segment become triangles.

**Poly loops are not meshed in version 1.** A poly loop's points have no kernel vertex or edge, so
`UvPointSource` and `MeshVertexProvenance` have no case for them. `MeshFace` returns an empty mesh
with the error `FACE-POLY-LOOP`. The decoder can give such faces line edges instead.

## Laws

Severity per SPEC-DSL.md section 4: E is Error; W/E is a Warning below ten times the tolerance and an
Error above; "test" marks a law about the library's own functions, run on witnesses.

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_LoopPointLiftsToSharedPoint` | a loop point from a vertex or an edge sample lifts to that shared point | `Tolerances.Length` | W/E |
| `Law_LoopToUvCountMatchesDiscretization` | `LoopToUv` gives the sum over coedges of (discretization count - 1) points; 1 for a vertex loop | exact | test |
| `Law_PcurveAgreesWithProjection` | where the pcurve is read, pcurve and projection agree up to periods, off collapsed lines | parameter tolerance at the point | W/E |
| `Law_UnwrapKeepsSources` | `Unwrap` keeps every source in order | exact | test |
| `Law_UnwrapMovesByWholePeriods` | `Unwrap` moves points off collapsed lines by whole periods only | parameter tolerance at the point | test |
| `Law_UnwrappedStepBelowHalfPeriod` | consecutive unwrapped points are closer than half a period per periodic direction, except across a step touching a collapsed line | exact | E |
| `Law_SeamUsesOnOppositeCopies` | the twin copy of a seam-use point lies one period away and to the left of the use in the chart | parameter tolerance at the point; exact sign | E |
| `Law_RegionLoopClosesInPlane` | every loop of the region winds zero times in u and in v | exact | E |
| `Law_UvRegionWindingPositive` | the outer loop has positive signed area in the chart | exact sign | E |
| `Law_UvHoleWindingNegative` | every hole that is not a point hole has negative signed area in the chart | exact sign | E |
| `Law_RegionSegmentsSeparated` | any two boundary segments are farther apart than the tolerance; neighbours do not fold back | region tolerance | E |
| `Law_HoleInsideOuter` | every hole of a simple region lies inside the outer loop | exact, given separation | E |
| `Law_SeamCutCopiesRunOpposite` | the two copies of a seam cut are traversed in opposite orders | exact | E |
| `Law_MeshedFaceHasSimpleRegion` | a face `MeshFace` meshes has a simple region | region tolerance | test |
| `Law_TriangulationCornersInRange` | every element corner names a point | exact | E |
| `Law_TriangulationKeepsBoundary` | the first `BoundaryCount` points and sources are the region's, unchanged | exact by construction | E |
| `Law_TriangulationAddsOnlyInteriorPoints` | every later point is `Interior` and strictly inside | region tolerance | E |
| `Law_EveryPointIsACorner` | every point is a corner of some element | exact | E |
| `Law_BoundarySegmentIsElementSide` | every boundary segment of the region is a side of exactly one element, in the boundary's direction, and of none reversed | exact | E |
| `Law_InteriorSideIsShared` | every element side that is not a boundary segment is a side of exactly two elements, traversed opposite ways | exact | E |
| `Law_ElementPositiveInChart` | every element has positive signed area in the chart | exact sign | E |
| `Law_ElementAreasSumToRegionArea` | element areas sum to the region's area | `AreaTolerance` of the region tolerance | E |
| `Law_ElementLiftsFacingFaceNormal` | every element not collapsed at a pole, lifted through the surface, winds counter-clockwise about the face normal | exact sign | E |
| `Law_ElementSpansBelowHalfPeriod` | no element spans half a period | exact | E |
| `Law_LiftKeepsPoints` | `Lift` keeps the parameter points and sources | exact by construction | E |
| `Law_LocalVertexInRange` | every point's local vertex exists | exact | E |
| `Law_LocalVertexSurjective` | every local vertex is some point's | exact | E |
| `Law_LocalVertexFibresAreIdentifications` | two points share a vertex exactly when their sources are identified | exact | E |
| `Law_SharedPositionIsCopied` | a vertex or edge-sample point sits exactly at the shared point | exact by construction | E |
| `Law_ProvenanceMatchesSource` | provenance is the vertex, the edge and sample parameter, or the face | exact by construction | E |
| `Law_PointNormalIsFaceNormal` | a stored normal off collapsed lines is the face normal, by `AngleBetweenDirections` | `ResolutionAt(1)` (rounding) | E |
| `Law_DroppedElementsArePoleCollapsed` | elements dropped = triangles with two corners of identified sources | exact | E |
| `Law_CollapsedQuadsBecomeTriangles` | quads lost = quads with two corners of identified sources | exact | E |
| `Law_ElementFacesFaceNormal` | every element winds counter-clockwise about the face normal | exact sign | E |
| `Law_ElementNormalAgreesWithSurface` | element normal within `SurfaceAngular` of the face normal at its parameter centroid, off collapsed lines | `SurfaceAngular` | W/E |
| `Law_SurfaceEdgeNormalTurnWithinSurfaceAngular` | the normal turns by at most `SurfaceAngular` along every surface edge | `SurfaceAngular` | W/E |
| `Law_ElementDeviationWithinSurfaceChordal` | surface-edge midpoints and the corner mean lie within the bound of the surface | `SurfaceChordal + Tolerances.Length` | W/E |
| `Law_SurfaceWithinSurfaceChordalOfElement` | the surface points at an element's parameter centroid and surface-edge parameter midpoints lie within the bound of the flat element | `SurfaceChordal + Tolerances.Length` | W/E |
| `Law_QuadPlanarWithinSurfaceChordal` | no quad corner lies farther than the bound from its mid-plane | `SurfaceChordal` | W/E |
| `Law_QuadConvex` | every quad is strictly convex | exact sign | E |
| `Law_NoQuadsUnlessPreferred` | `PreferQuads` false gives no quads | exact | test |
| `Law_BlockingRequestMeansEmptyMesh` | a blocking request comes with an empty mesh | exact | E |
| `Law_RequestHasDiagnostic` | a request comes with at least one diagnostic | exact | E |
| `Law_EmptyMeshIsExplained` | an empty mesh with no request comes with an error diagnostic | exact | E |
| `Law_RequestsNameFaceEdges` | every request of `MeshFace`'s outcome names an edge the face cites | exact | test |
| `Law_MeshFaceReadsOnlyFaceEdges` | discretization sets that agree on the face's edges give the same outcome, bit for bit | exact | test |

Theorems in the spec: `SharedEdgePositionsAgree` (two faces hold bitwise equal positions for a shared sample, so
assembly needs no welding), `DroppedTrianglesArePoleSegments` (the dropped count equals the number of
boundary segments on collapsed lines), `ElementsTileRegion` (every point strictly inside the region
lies in an element; a theorem once `Law_BoundarySegmentIsElementSide` and
`Law_InteriorSideIsShared` hold, and false without them). The conjecture
`NormalTurnBoundsCentroidDeviation` was dropped as false (the sliver above is its counterexample).

The catalogue entry `Law_FaceFlipReversesWinding` (research/VALIDATION-MATH.md section 8) is not
adopted: on a sphere or torus, flipping `SameSense` without reversing the loops selects the other
side of a winding loop, so the face itself changes. The statement holds with the loops reversed too,
which is layer 08's `Law_ShellReversalNegatesVolume`.

## Names used from layers 00 to 04

Beyond the fixed contract, the layer calls these, as declared on 2026-10-17:

- Layer 00: `UvTolerance`, `UvToleranceAt(t, floor, speedU, speedV, d)`, `SameParameter` (curve-domain
  and surface-domain forms), `IsUSide`, `OppositeSide`, `SamplePlan`, `Periodicity.Closed`,
  `IsOnFace(p, f)`, `AngleBetweenDirections`, `ResolutionAt`, `Identical(Diagnostic, Diagnostic)`.
- Layer 01: `UvFloorOf(g, s, tol)`, `PcurvesOf` (through layer 02),
  `CollapsedAt`, `UvToleranceAt(g, s, uv, tol)`, `SurfaceParameter`,
  `DomainAlong`, `Coordinate`, `Along`, `IsEveryIndexInRange`, `LimitNormal(g, s, uv)` (named in
  `Lift`'s contract).
- Layer 02: `FaceNormalSign`, `FirstVertexAlongCurve`, `LastVertexAlongCurve`, `IsSeamEdgeOf`,
  `PcurvesOnFace(m, e, f)`, `LoopCoedges`, `VertexLoopVertexOf`, `IsPolyLoop`, `IsFaceIntact`,
  `IsLoopIntact`, `IsEdgeIntact`, `IsVertexInRange`, `IsEdgeInRange`, `CoedgeRunsForwardOnCurve`.
- Layer 04: `Sagitta`, `UvChordDeviation`, `DiscretizationPlan`, `IsWellFormed(DiscretizationCriteria)`,
  `EdgeRefinementRequest.Segments`, `EdgeImage`, `ImagePoints`, `SameDiscretization`.
- The stdlib: `UnsignedDistanceToTriangle`, `ShoelaceArea`, `Corresponds`.

`DegenerateSides` is not used (see "Poles come from collapsed lines").

## What is left open

1. **Interior collapsed lines.** A revolution profile that touches its axis inside the face, or an
   interior collapsed row of a B-spline net, collapses a line that crosses the region. Version 1 does
   not cut the region there; `AddMissingSeamsAndPoles` has no outcome through which to diagnose it.
   Either the region type gains a diagnostic, or `MeshFace` checks `CollapsedAt` against the region
   first.
2. **Seam pcurves.** Both uses of a seam are projected and placed on their copies by the left rule.
   A later version can read the two pcurves instead and assign them by the same rule.
3. **The region tolerance near a pole.** The chart's mean speed over-estimates the speed near a pole,
   which makes the region's tolerance smaller there. A smaller tolerance passes the test "farther
   than the tolerance" more often, so separation is judged leniently there, not strictly: two
   segments near a pole may pass while closer in 3D than the length tolerance. A per-segment
   tolerance would be exact and costs a surface derivative per segment.
4. **Exact predicates.** The orientation laws compare floating shoelace areas with zero. The
   triangulator must use robust predicates; whether the laws should too is a question for layer 07.
5. **Seeded projection.** `LoopToUv` takes its points from layer 04's `ImagePoints`, which seeds each
   projection or pcurve inversion from the previous point; on a self-overlapping surface a seeded and
   an unseeded inversion may pick different roots.
6. **Who builds `SegmentFloors`.** Layer 08 does: its `RaisedFloors` turns count requests into floors
   for layer 04's `Discretize`. The convergence statement of review C11 (counts reach the maximum of
   each equality class within the number of edges in it) belongs there, beside `MaxRefinementRounds`.
7. **Poly loops**, above.
8. **Witnesses.** The laws run over layer 07's witnesses (cylinder with one seam, sphere with two
   poles, torus with two seams, cone with an apex); this layer defines none.

## Implementation notes

| Step | Algorithm family | Cost (n boundary points, N mesh points) |
|---|---|---|
| `LoopToUv` | Newton projection seeded by the previous sample; closed form on analytic surfaces | O(n) evaluations |
| `Unwrap` | one scan, nearest periodic copy; the second use of each seam segment by the left rule (its twin found through a hash on the source) | O(n) |
| `AddMissingSeamsAndPoles` | window shift, pole-segment insertion, one straight cut per winding direction, outer loop by containment | O(n + L^2) for L loops |
| simplicity (`IsSimpleRegion`) | sweep line; the definition is all pairs | O(n log n); O(n^2) as written |
| `TriangulateRegion` | designed: constrained Delaunay (CDT library, Triangle `-p`), even-odd hole removal, Shewchuk predicates. Built (chunk B): ear clipping, then Lawson's constrained flips with a floating angle-sum test | designed O(n log n); built O(n^2) clipping, then O(n log n) per flip pass |
| `RefineToSurface` | designed: seeds per surface kind, then Delaunay insertion of the worst sample point. Built (chunk B): longest-interior-edge bisection of failing elements, Lawson's flips after each pass; boundary locked, `MinLength` stop | each pass O(T log T); only changed triangles are tested again |
| `Lift` | union-find over identified sources (hash on the source) | O(N alpha(N)) |
| `QuadGrid` | transfinite interpolation; per-quad warp and convexity | O(N) |

Seeding by surface kind (research/MESHING-REQUIREMENTS.md section 4.7): none on planes and
cylinders (rulings are straight), rows from the slant on cones, rows and columns at 0.7 of the closed-
form step on spheres, steps from both radii on tori, knot lines on B-splines. Normalize parameters to
the face's box before triangulating; large values degrade the predicates.

Implement surface kinds in this order, each adding one difficulty: plane (holes, no seams); cylinder
(seam, anisotropy, structured quads); cone (apex on an interior collapsed line); sphere (two poles);
torus (two seams, whole-period regions); revolution and extrusion; B-spline (adaptive refinement,
knots); offset and rectangular-trimmed last.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `RegionOf(m, f, d)` | `RegionOf(m, f, d, c: FaceMeshingCriteria)` | Synthetic seam-cut and pole points are boundary points: they are sampled once, under the criteria, because refinement may not add boundary points later |
| `Lift(m, f, t)` | `Lift(m, f, d, t)` | Shared positions are copied from the discretization, never re-evaluated, so both faces of an edge hold bitwise the same point; `OnEdge` provenance needs the sample's curve parameter |
| `FaceMeshOutcome`: requests mean an empty mesh | only a blocking request (`LoopSelfIntersects`, `IsBlocking`) means an empty mesh; `TooCoarseInParameterSpace` and `QuadCountMismatch` come with a valid triangle mesh | Withholding a valid mesh for an advisory request would leave a hole in the model when the round limit is reached |
| `FaceMeshingCriteria.SurfaceAngular`: element normal against surface normal (root README) | the normal turn along a surface edge (OpenCascade `AngleInterior`, ACIS `SPANORMALTOL`); the element-normal test kept as a law with the same tolerance | Values copied between kernels then mean the same; the stated relation makes the README's test a consequence |
| `UvPointSource.FromEdge(Edge, Index)` | Index is 1 to count - 2; end samples are `FromVertex` | Each sample has one source; the count law is exact |
| `UvPointSource.Pole(Side, Index)`: a domain side | the side of the face's parameter box along a collapsed iso-line (a cone apex lies inside the domain) | Layer 01 places the apex inside the cone's domain |
| (unspecified signatures) | `LoopToUv(m, f, b: FaceBound, d)`, `Unwrap(m, f, l)`, `AddMissingSeamsAndPoles(m, f, loops, c)`, `OrientRegion(m, f, r)`, `TriangulateRegion(r, chart: FaceChart)`, `RefineToSurface(m, f, r, chart, t, c)`, `QuadGridIfRectangular(m, f, d, r, c): QuadGridOutcome` | Each takes what its contract needs |
| (new, proposed) | types `UvSample`, `CoedgeUvRoute`, `FaceChart`, `QuadSides`, `QuadGridOutcome`; library block `UvRegions` beside `FaceMeshing`; functions `ChooseUvRoute`, `PcurveUv`, `ChartOf`, `MeanSpeed`, `RegionTolerance`, `UnorientedRegionOf`, `IdentifiedSources`, `IsOnCollapsedLine`, `QuadSidesOf`, `QuadGrid`, `MatchingFloors`, `IsBlocking`, `SharedPosition`, `ProvenanceOfSource`, `ElementDeviation`, `EdgeNormalTurn`, `WindingSign` | Named in the laws and contracts above |
| layer 06 `IsOnFace(p: MeshVertexProvenance, f)` | this layer's `IsFaceInteriorProvenance` deleted; layer 00's `IsOnFace` used | Layer 00 now declares it beside `MeshVertexProvenance` (FIX-WAVE) |
| `Unwrap`: every point by continuity | the second use of every seam segment by the left rule, every other point by continuity; ensures `Law_SeamUsesOnOppositeCopies` | Continuity puts both uses on one copy when they meet at a pole or an apex (review F1) |
| `AddMissingSeamsAndPoles`: requires every step below half a period | requires `IsUnwrappedStep` (a step touching a collapsed line may jump) and the left rule; ensures the left rule on its loops; pole segments run from the arriving to the leaving free parameter, windings counted after | The free parameter at a pole passes from one seam copy to the other |
| `AddMissingSeamsAndPoles(m, f, loops, c)`: one loop per bound | one loop per bound of `MeshedBounds(m, f)` | Layer 02's vertex-loop reduction (review C6) |
| theorem `ChartWindingIsFaceWinding` | dropped; `RefineToSurface` ensures `Law_ElementLiftsFacingFaceNormal`, `QuadGridIfRectangular` gives no grid when an element folds (`GridUnlessFolded`); new `ElementUvCentroid(t, k)`, `LiftedVectorArea`, `LiftsFacingFaceNormal` | The theorem is false for slivers (review H5) |
| `IsPoleCollapsed(m, f, t, k)`, `PoleCollapsedTriangleCount`, `PoleCollapsedQuadCount`, `ShareCollapsedLine`: corners on one collapsed line | `IsCollapsedElement(t, k)`, `CollapsedTriangleCount(t)`, `CollapsedQuadCount(t)`: two corners with identified sources; `IsSurfaceEdge` compares local vertices; `ShareCollapsedLine` removed | The drop test agrees with Lift's identification (review M7) |
| conjecture `ElementsTileRegion` | a theorem, assuming the region is simple and the two side laws; `TriangulateRegion`, `RefineToSurface`, `QuadGrid` ensure `Law_BoundarySegmentIsElementSide` and `Law_InteriorSideIsShared`; new `LoopOffset`, `LoopOfBoundaryPoint`, `NextBoundaryPoint`, `IsBoundarySegment`, `ElementHasSide`, `SideCount` | Keeping the boundary points does not make a tiling (review M5, H6); layer 08's watertightness theorem no longer rests on a conjecture |
| `IsDiscretizedFace`, `IsDiscretizedBound`, `HasSample` in `FaceMeshingLaws` | in `FaceMeshing`, same signatures | `MeshFace`'s precondition, which layer 08 evaluates, is a definition of the layer, not a law guard (layer 08 finding 3) |
| `StepBelowHalfPeriod`, `Winding`: Aperiodic and Periodic | a `Closed` arm, treated as `Periodic` | Layer 00's new periodicity case (review C1, T1) |
| `MeshFace` ensures | also `Law_RequestsNameFaceEdges` and `Law_MeshFaceReadsOnlyFaceEdges`; new `AgreeOnFaceEdges`, `SameFaceMesh`, `SameFaceMeshOutcome` (layer 08 declared the last two with the same bodies; they belong with the types here, and layer 08's copies should go) | Layer 08's refinement loop rests on both properties (layer 08 finding 4) |
| `RegionTolerance`: one model-wide parameter floor | the floor of each direction's kind, from layer 01's `UvFloorOf`, passed to layer 00's `UvToleranceAt` | Layer 00 split `Tolerances.Parameter` into `LengthParameter` and `AngleParameter` (review C2) |
| `MeshFace` ensures chordal from mesh to surface only | also from surface to mesh: `Law_SurfaceWithinSurfaceChordalOfElement`, with `FlatElementDistance` and `ElementCoverageGap` | The other half of the Hausdorff distance (review M6) |
| type `CoedgeUvRoute`, `ChooseUvRoute`, `PcurveUv`, `UvOfPoint` | deleted; `ImageInFace(m, f, e): EdgeImage` (layer 04's type) and layer 04's `ImagePoints` draw every coedge; `RoutesAgree` becomes `ImageAgreesWithProjection` | One image function for layers 04 and 05 (review C5) |
| (new) | `Law_SeamUsesOnOppositeCopies`, `AreSeamNeighbours`, `IsEndVertexSource`, `AreTwinSteps`, `IsOnePeriodAway`, `IsLeftOfStep`, `FollowsLeftRule`, `IsUnwrappedStep`; `StepBelowHalfPeriodAt` removed | The left rule and its law (review M8) |

## Fix wave, 2026-10-17

Findings from `reviews/MATH-REVIEW-layers-0-6.md`, the lower-layer findings of layers 07 and 08, and
`reviews/FIX-WAVE.md`, one commit each.

Applied:

- F1, M8: seam uses placed by the left rule of research/STEP-BREP-MODEL.md 4.3, not by continuity;
  `Law_SeamUsesOnOppositeCopies`; a step touching a collapsed line is exempt from the half-period
  law; pole segments from the arriving to the leaving free parameter. The seamed sphere and the
  seamed cone now close in the plane.
- H5: `ChartWindingIsFaceWinding` dropped as false (the unit-sphere sliver above); its conclusion
  is enforced by refinement and by the quad grid's fold check (`Law_ElementLiftsFacingFaceNormal`).
  The review's alternative, a shape hypothesis such as `kappa_max * l_max < sin(theta_min)`, was
  not taken: it needs a curvature bound no layer computes, and its constant is unproven.
- H7: conjecture `NormalTurnBoundsCentroidDeviation` dropped as refuted; the unit-sphere sliver
  (turns at most 0.175 rad, flat normal 2.05 rad off) is recorded as its counterexample in the spec
  and in "SurfaceAngular is the normal turn"; refinement enforces the centroid test on its own.
- M7: an element is dropped exactly when two of its corners have identified sources (one local
  vertex), not by a distance test against a collapsed line.
- M5, H6: `Law_BoundarySegmentIsElementSide` and `Law_InteriorSideIsShared` added and ensured by
  the three triangulating functions; `ElementsTileRegion` is now a theorem with them among its
  assumptions, and `DroppedTrianglesArePoleSegments` states the one it used silently.
- Layer 08 finding 3: `IsDiscretizedFace` (with `IsDiscretizedBound` and `HasSample`, which it
  calls) moved from the laws block into `FaceMeshing`.
- C1, T1 (FIX-WAVE "Closed directions"): `StepBelowHalfPeriod` and `Winding` gain the `Closed`
  arm, the same as `Periodic`; every seam function inherits it.
- C10, layer 07 finding 2: `IsFaceInteriorProvenance` deleted; `ProvenanceAgrees` uses layer 00's
  `IsOnFace`.
- Layer 08 finding 4: `MeshFace` ensures that every request names an edge the face cites
  (`Law_RequestsNameFaceEdges`) and that it reads only those edges' discretizations
  (`Law_MeshFaceReadsOnlyFaceEdges`). `SameFaceMesh` and `SameFaceMeshOutcome` are declared here,
  beside their types; layer 08's identical copies are left for its fixer to delete.
- C2, FIX-WAVE `Tolerances.Parameter` split: `RegionTolerance` passes layer 01's per-kind floors
  (`UvFloorOf`) to layer 00's `UvToleranceAt`; `PointTolerance` inherits them through layer 01.
- F7: `Law_PointNormalIsFaceNormal` measures with `AngleBetweenDirections` against the rounding
  bound `ResolutionAt(1)`, not the arc cosine against the file's angle tolerance.
- M6: coverage from the surface to the mesh, `Law_SurfaceWithinSurfaceChordalOfElement`, ensured by
  `MeshFace` with the same `MinLength` escape as the other surface criteria.
- C5: coedge points come from layer 04's `ImagePoints` (the one image function), in the image
  `ImageInFace` chooses; `CoedgeUvRoute` and its functions are deleted.
- F12 (first item): open item 3 corrected; a smaller region tolerance near a pole judges
  separation leniently, not strictly.
- C6: the region skips a vertex loop that layer 02's `ReducedCounts` drops (`MeshedBounds`), so
  sphere B meshes.

Skipped, with reasons:

- T5 (`ProjectNear` keeps the seed's coordinate at a pole): layer 01's function. If it lands, the
  free-parameter rules in `Unwrap` and `ImagePoints` can go; nothing here depends on it.
- T7 (exact deviation oracles on planes, cylinders, spheres): `ElementDeviation` by projection is
  already an upper bound, so the law is sound; closed forms are an implementation choice and layer
  07's oracles.
- C11's convergence theorem: the floors are raised by layer 08 (`RaisedFloors`), so the theorem is
  layer 08's (open item 6 now names the owner).
- F2's removal of the sign epsilon from this layer: layers 01 to 03 kept `FaceNormalSign` as the one
  sign (layer 02 rests it on layer 01's epsilon and the placement's handedness); this layer reads it
  unchanged, and only `FaceChart`'s comment was wrong (fixed with H5).

## Gate

PLATO-PRIMER.md section E.3, run 2026-10-17 from the scratch copy of `tools/PlatoGate`:

- This folder alone: halts at symbol resolution on the names of layers 00 to 04, as expected while
  they are written separately.
- This folder with stubs of those names: PASS, 0 errors; the only findings are two LINT003 Info lines
  on `UvSample.Point` and `UvSample.Source`, which are read inside lambdas the linter does not follow.
- This folder with layers 00 to 04 as they stood, and again with 03 and 06 added: PASS, 0 errors in
  scope.
- Fix wave, 2026-10-17, after the last layer-5 change: the nine layer folders from `origin/main`
  with this folder live, `PASS: 0 error(s) in scope; 6600 functions type-checked`. Each finding was
  gated before its commit, against the other layers as committed at the time.

## Name review, 2026-10-17

The name-and-dependency review after the fix wave (VOCABULARY.md revision 3) changed this layer as follows.

- Deleted `IsRedundantVertexLoop(m, f, k)`, a copy of layer 2's with the same signature and meaning; `MeshedBounds` is now layer 2's `KeptBounds` mapped to the bounds.
- Took `ScaledBy(c: FaceMeshingCriteria, factor)` from layer 8, where it stood in (`belongs-in: 05-face-meshing`), into the Criteria section.

## Implementation, chunk A

TKT-314, 2026-10-17. Six bodies, each from its contract in `face-meshing.spec.plato`:

| Body | Derived from | Scope in chunk A |
|---|---|---|
| `Unwrap` | contract `Unwrap` and its note: first point wrapped; a seam use whose twin step is placed takes the twin end's copy a period away with the twin to its left (the test of `FollowsLeftRule`); otherwise `NearestUnwrapped`; a collapsed-line point takes its neighbour's free parameter | general; exercised only on planes in chunk A |
| `AddMissingSeamsAndPoles` | contract `AddMissingSeamsAndPoles`, the plain case: a surface with no seam direction and no collapsed line keeps its loops, the outer chosen by containment (`OuterByContainment`). Every other face calls `CompletePeriodicRegion`, a new bodiless function holding windings, pole segments and synthetic seam cuts | planes; cylinders, cones, spheres and tori throw until chunks B and C |
| `MeanSpeed` | contract `MeanSpeed`: mean of the partial's length at 21 points on each of three iso-lines across the region's box, collapsed-line samples skipped, floored at the length tolerance over the box extent | general |
| `TriangulateRegion` | contract `TriangulateRegion`, which keeps the boundary, needs positive chart areas, every point a corner, boundary segments as sides, interior sides shared, no quads. Ear clipping in the chart (not the constrained Delaunay triangulation the design names; the contract does not require the Delaunay property): holes bridged at a visible vertex, a vertex an ear when its chart area is positive and no other ring point is in the closed triangle, point holes inserted by splitting their triangle; a collinear vertex is never an ear, so collinear boundary points stay corners | general; quality not optimized |
| `RefineToSurface` | contract `RefineToSurface`: a plane needs no interior point; otherwise up to twelve passes splitting every triangle that exceeds `SurfaceChordal` at its centroid, `SurfaceAngular` between corner normals, or folds, at its parameter centroid, unless the new point is within `MinLength` of a corner. Centroid splits do not shorten sides, so curved faces need chunk B's edge insertion with flips | planes exact; curved faces not to the criteria |
| `Lift` | contract `Lift`: local vertices the classes of `IdentifiedSources` (layer 0's `ClassRoots`), numbered by first appearance; `SharedPosition` of the first member; `FaceNormalAt`, or `LimitNormal` on a collapsed line; provenance of the first member; collapsed triangles dropped, a quad losing one corner made a triangle | general (`LimitNormal` is layer 1's, still deferred, chunk C) |

Law results, provisional: on the unit box every face meshes to two triangles from its four
boundary points, and the assembled mesh is closed and consistently oriented (layer 8's results in
its README).

## Implementation, chunk B

TKT-324, 2026-10-18, each body from its contract in `face-meshing.spec.plato`:

| Body | Derived from | Scope in chunk B |
|---|---|---|
| `CompletePeriodicRegion` | contract `AddMissingSeamsAndPoles` beyond the plain case, in three steps. Pole segments: `WithPoleSegments`, which leaves the loops of a surface with no collapsed line unchanged and otherwise calls `ExpandedPoles`, a new bodiless function (chunk C). The synthetic seam cut: when exactly two loops wind once round one direction in opposite senses (a band), `JoinedByCut` joins them into one loop along a straight parameter segment between their two boundary points nearest in 3D, sampled once under the criteria (`CutSegmentCount`: equal steps, the least count whose every step has its parameter midpoint within `SurfaceChordal` of its chord, a normal turn within `SurfaceAngular` and a chord within the length limit, never a step below the effective minimum length); its far copy carries `SeamCut(far side, k)` for k up, its near copy `SeamCut(near side, k)` for k down. Any other arrangement of winding loops calls `CutWholePeriods`, a new bodiless function (chunk C: a whole torus). The outer: the loop of largest absolute area, every other loop moved by the first whole-period shift that puts its first point inside it (`OuterByArea`, `ShiftedInside`) | cylinders: the seamed face, the sector patch, and the band between two circles; cones, spheres and tori reach the two chunk C functions |
| `TriangulateRegion` | contract `TriangulateRegion` and its deferred note: chunk A's ear clipping, then Lawson's flips (`UvDelaunay.Delaunayed`): an edge that is not a boundary segment is flipped while its quadrilateral is strictly convex in the chart and the two angles opposite it sum to more than pi + 1e-9, so cocircular points (a cylinder's rectangles) never flip back and forth. Flips change no point and keep every boundary segment, so the contract's ensures carry over from the ear clipping; the result is the constrained Delaunay triangulation in the chart (F-52 item 1) | general |
| `RefineToSurface` | contract `RefineToSurface` and its deferred note: on a curved face, up to forty passes; each splits every element failing `TriangleNeedsRefinement` (the surface laws' tests on the lifted element with unwidened bounds: side midpoints, corner mean and parameter centroid within `SurfaceChordal` both ways, normal turn along sides and element normal within `SurfaceAngular`, no fold) at the parameter midpoint of its longest side that is not a boundary segment, with the triangle across it, or at its centroid when every side is one, unless the point would land within the effective minimum length of a corner or within the region tolerance of the boundary; each pass ends with Lawson's flips. Side bisection shortens sides, which centroid splits did not (F-52 item 2). A triangle that met the criteria is not tested again while unchanged | general; the stop at `MinLength` is the contract's escape |
| `QuadSidesOf` | contract `QuadSidesOf` and its deferred note: one walk of the outer loop, each step classed as a run along u or v within the region tolerance (`StepClass`); corners where the class changes; four-sided when every step is a run, there are four corners, and each side's interior points lie on one carrier (`SideIsOneCarrier`, `SameCarrier`) | general |
| `QuadGrid` | contract `QuadGrid` and its deferred note: transfinite (Coons) interpolation of the four side polylines at uniform parameters (`GridNodePoint`), border nodes the region's own points (`GridNodeIndex`); a cell kept as a quad when its lifted corners are planar within `SurfaceChordal` and strictly convex (`IsKeptQuad`), else two triangles on the diagonal with the larger minimum angle (`CellTriangles`). `QuadWarp` and `IsConvexQuad` now call the position forms `QuadWarpOf` and `IsConvexQuadOf` | rows at a pole are left to `Lift`'s collapse (chunk C) |
| `MatchingFloors` | contract `MatchingFloors` and its deferred note: per pair of opposite sides with unequal counts, the edge of the side with fewer segments (`SideEdge`: the face edge whose discretization segment is the side's first) floored at the other's count; seams, cuts and poles have no edge | general |

Probe (interpreter, cpu64, chordal 0.01, 15 degrees) on the seamed unit cylinder, the quarter sector and
the seamless band (the seamed cylinder without its seam edge): every region is simple, every loop closes
in the plane, the outer loop winds positive, the cut's copies run opposite, and every point lifts to its
shared point. The seamed and the band regions both have 50 boundary points (two circles of 24 segments;
the band's cut is one ruling, so it has no interior point); the sector patch has 14.

Decision F-54 (2026-10-18): the laws over a value the library makes take the producer's inputs.
`Law_UvRegionWindingPositive` and `Law_HoleInsideOuter` take `RegionOf`'s inputs under
`CanRegion`. `Law_TriangulationCornersInRange`, `Law_EveryPointIsACorner` and
`Law_LiftKeepsPoints` take `FaceTriangulation`'s under `CanTriangulateFace`.
`Law_LocalVertexInRange`, `Law_LocalVertexSurjective`, `Law_ProvenanceMatchesSource`,
`Law_BlockingRequestMeansEmptyMesh` and `Law_RequestHasDiagnostic` take `MeshFace`'s under
`CanMeshFace`. Each claim keeps its body as a predicate of the same name without `Law_`, which the
contracts and layer 7's checks apply. `FaceTriangulation` (with `FaceQuadGrid`) moved here from
layer 7, and `MeshedOutcome` builds its triangulation through it. `Law_UnwrapMovesByWholePeriods`
and `Law_UnwrappedStepBelowHalfPeriod` already took `Unwrap`'s inputs; they now guard its
precondition, a source per point. Under the runner the face laws hold vacuously unless a generated
discretization fits the face; layer 7's checks and the step B probes apply them to real meshes.
