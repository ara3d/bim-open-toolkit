# Layer 4: edge discretization

Library block `EdgeDiscretizing`, laws in `EdgeDiscretizingLaws`. Written 2026-10-17 against
[VOCABULARY.md](../VOCABULARY.md) revision 2, while layers 0 to 2 were being written; the names this
layer uses from them are listed at the end.

This layer turns every model edge into one polyline, under chordal, angular, and length criteria,
and states the rules both faces of the edge rely on when they consume it. It owns one principle:
**one discretization per model edge, consumed by both adjacent faces**, one of them through
`Reversed`, so the mesh is closed along every edge by construction rather than by welding.

| File | Holds |
|---|---|
| `discretization.types.plato` | `Limit`, `DiscretizationCriteria`, `SegmentFloors`, `EdgeDiscretization`, `EdgeDiscretizations`, `EdgeImage`, `RefinementReason`, `EdgeRefinementRequest` |
| `discretization.library.plato` | criteria, edge facts, count floors, closed forms for arcs, segment measures, parameter-space images, `Discretize`, `DiscretizeAll`, `Undiscretized`, `Reversed`, `AlongCoedge`, `SameDiscretization`, `IsRefinable`, `MeetsCriteria`, `SegmentMeetsCriteria`, `RefineEdge`, `Refine` |
| `discretization.laws.plato` | 36 laws: shape, agreement with the model, criteria, counts, images, reversal and sharing, monotonicity and refinement, arcs |
| `termination-discretize.library.plato` | the bounded `Discretize` and `RefineEdge` (`DiscretizeBounded`, `RefineEdgeBounded`, the searched raise, the image tests over a set of images, `IsOffSurface`) and `DiscretizationFindings` |
| `termination.laws.plato` | 9 laws: the discretization returns on an edge off its face's surface, within `SegmentBound`, and reports it |
| `discretization.spec.plato` | type invariants, contracts of the 6 functions the design pass deferred and 4 constructors, 6 theorems. Since chunk B, `SagittaByHullBound` (the non-closed-form half of `Sagitta`, chunk F) is the one still bodiless |

## The objects

**Edge domain and canonical direction.** An edge `e` has a curve `C` and a domain `[a, b]` in the
curve's own parameter (`EdgeDomain(m, e).Range`), with `a < b`. A closed edge spans a full period;
a degenerate edge is one whose image `C([a, b])` lies within the model's `LengthTolerance` of its
start vertex (a pole, a cone apex; layer 2's `IsDegenerateEdge`). A closed edge (layer 2's
`IsClosedEdge`, one vertex at both ends) that is not degenerate is `IsClosedRegularEdge`. On a
`Closed` curve (a clamped B-spline whose ends meet) an edge may cross the join; `PointOnEdge`
wraps the parameter into the curve's range before evaluating. The canonical direction is the curve's increasing parameter, whatever
the edge's `SameSense`; the vertex at `a` is `DomainStartVertex` (the edge's `Start` when
`SameSense`, its `End` otherwise).

**Discretization.** A discretization of `e` is a partition `a = t_0 < t_1 < ... < t_n = b` of the
domain together with its image `P_i`, where `P_i = C(t_i)` for `0 < i < n` and `P_0`, `P_n` are
the vertex points, copied (a vertex may sit up to `LengthTolerance` from the curve's end, so the
end points are the vertices and not evaluations). Segment `i` is the chord `[P_i, P_{i+1}]` together
with the arc `C([t_i, t_{i+1}])` it replaces. `Reversed` lists the same data backwards; a value is
canonical when its parameters increase (`RunsAlongCurve`). Every value has strictly monotone
parameters and equal counts; every stored or freshly computed value is canonical.

**Seeds.** `EdgeSeeds(m, e)` are the parameters every discretization must contain: the domain ends,
and every polyline vertex, composite-segment joint, distinct B-spline knot, and (on a `Closed`
curve) copy of the join inside the domain, merged within the curve's per-point parameter tolerance
(layer 1's `ParameterToleranceAt`, whose floor is the length or the angle floor by the parameter's
kind). Every point where the curve may fail to be tangent-continuous
is a seed, so between consecutive seeds the curve is smooth.

**Sagitta.** The sagitta of segment `i` is the Hausdorff distance between the chord and the arc. For
a convex arc turning less than half a turn it equals the largest distance from the arc to the
chord's line, `R (1 - cos(theta / 2))` on a circle of radius `R` with central angle `theta`.
`Sagitta(m, e, t0, t1)` is the exact quantity, certified: closed form for lines, circles,
ellipses; for every other curve the largest control-point distance from the chord per Bezier span,
polynomial or rational (positive weights put a span in its control hull, and distance to a segment
is convex), subdivided until within the length tolerance. `Discretize` promises it
(`Law_CertifiedSagittaWithinChordal`). `SampledSagitta(m, d, plan, i)` evaluates the curve at the
plan's interior samples `t_i + f (t_{i+1} - t_i)`, `f = j / (n - 1)` for a plan of `n` samples
counting both ends (layer 0's `SamplePlan`), and takes the largest distance to the chord: a lower
bound of the exact sagitta, what validation can measure on any polyline. `DiscretizationPlan`
(five samples: the ends, the quarter points, and the midpoint) catches the inflection that a
midpoint-only test misses (research/MESHING-REQUIREMENTS.md 3.5).

**Angles.** Two quantities, equal to the central angle `theta` per segment on a uniformly split
circle, which is what OpenCascade's `Angle`, Parasolid's `curve_chord_ang`, and gmsh's curvature
sizing all reduce to:

- the *turning angle* `tau_i` at interior point `i`, the angle between consecutive chords
  (`TurningAngle(d, i)`);
- the *tangent deviation* `delta_i` of segment `i`, the largest angle between its chord and the
  curve's tangent over the open interval `(t_i, t_{i+1})` (`TangentDeviation`, sampled at interior
  points only, so never at a seed, where the tangent may jump). It is `theta / 2` on a circle.

`Angular` bounds `tau` at every joint that is not a seed, and `2 delta` on every segment. The second
bound is what gives a single-segment edge, and the end segments of any edge, an angular criterion at
all. At a joint that is not a seed the curve is tangent-continuous, so `tau_i <= delta_{i-1} +
delta_i` by the triangle inequality for angles: the turning-angle law follows from the
tangent-deviation law (theorem `TurningAngleBoundedByTangentDeviation`) and is checked anyway.

**Parameter-space image.** Each face that uses the edge draws the polyline in its surface's natural
parameters (`EdgeImage`: the face and the pcurve of the edge on its surface, or none). The image
points are the pcurve at its own parameter nearest `P_i` when the curve is `OnSurface` with a
pcurve there (a pcurve agrees with its curve as a point set, not by parameter), and otherwise
`Project(g, s, P_i)`; each is unwrapped to within half a period of the previous point (a `Closed`
direction counts as periodic), with a pole point's free parameter taken from its neighbour
(`ImagePoints`). It is computed over the canonical order, so the image of `Reversed(d)` is the
image reversed, bit for bit, and it is the one image function face meshing draws its loops with. The face joins consecutive image
points by straight segments; the *image deviation* of segment `i` is the largest distance from the
3D chord to the surface evaluated along that straight parameter-space segment (`UvChordDeviation`,
OpenCascade's test, research/MESHING-REQUIREMENTS.md 3.7).

**Floors.** Two different kinds. The *length floor* `MinLength` stops refinement: a segment is split
for a criterion only when both halves would be at least `MinLength` long, and a segment that cannot
be split that way is *at the floor* (`IsAtLengthFloor`), which exempts it from the criteria and is
reported. *Count floors* (`MinimumSegmentCount`) are structural and beat `MinLength`: the caller's
`SegmentFloors`, `max(3, MinSegments)` for a closed edge that is not degenerate, 2 for an edge in a two-edge loop (else the
loop is a digon), and `ceil(TotalTurning / (2 pi / 3))` so that no chord spans a third of a turn,
where an element of a periodic face could fold. A degenerate edge has exactly one segment.

**Effective criteria.** The criteria record is model-independent; the model enters once:
`EffectiveChordal = max(Chordal, LengthTolerance)`, `EffectiveMinLength = max(MinLength,
LengthTolerance)`, `EffectiveAngular = min(Angular, a third of a turn)`.

## Decisions and their reasons

1. **One polyline per edge, oriented in exactly one place.** `DiscretizeAll` stores the canonical
   polyline of every edge; `AlongCoedge(m, d, bound, coedge)` is the only function that orients one
   for a face, returning `d` or `Reversed(d)` by `CoedgeRunsForwardOnCurve`. Two uses that run in
   opposite directions therefore read bit-identical points in opposite orders
   (`Law_OppositeUsesSeeReversedPoints`, theorem `SharedPolylineClosesEveryEdge`). The existing IFC
   mesher let each face re-sample its edges and cracked along shared edges
   (research/EXISTING-MESHER-LESSONS.md lesson 11); here that cannot happen.

2. **Symmetry by a canonical direction, not by rounding.** Discretizing an edge and reversing the
   arrays must equal discretizing the reversed edge exactly. Three mechanisms, in order of strength:
   - *A canonical direction.* Discretization always runs in the curve's increasing parameter.
     Reversing an edge (ends swapped, `SameSense` flipped, citations flipped: `WithEdgeReversed`)
     changes nothing `Discretize` reads, so the arrays are bit-identical
     (`Law_EdgeReversalLeavesDiscretization`). Faces get the other direction only by `Reversed`,
     which copies.
   - *Subdivision at parameter midpoints*, and uniform splits computed from one end, so the result
     is a function of the partition, not of a marching direction (curvature marching, OpenCascade's
     `GCPnts_TangentialDeflection`, depends on its direction).
   - *Criteria evaluated symmetrically.* The sample fractions `j / (k + 1)` are symmetric about one
     half, the sagitta is a distance to the unoriented chord, the turning angle depends on points
     only, and the tangent deviation orients the tangent with the segment. So a curve whose
     parameterization is reflected (a duplicated edge from another exporter) yields the same point
     set up to rounding. That case is not exact and no law claims it.

3. **The two-space criterion.** The criteria are met along the 3D curve and along each image:
   `Discretize` reads the edge's faces and pcurves (layers 1 and 2, allowed by the dependency rule)
   and refines until the mapped straight image segment stays within the chordal bound of the 3D
   chord (`Law_ImageChordWithinChordal`). The test is measured in 3D, against the same `Chordal`,
   because a parameter-space length means nothing across surfaces whose metrics differ by orders of
   magnitude (a cylinder of radius 500 mm has `u` in radians and `v` in millimetres). The image
   points map onto the surface within twice the `LengthTolerance` of the polyline points
   (`Law_ImagePointReevaluates`), also measured in 3D; no law compares parameter-space points
   with one scalar. Faces whose loops still cross after this return requests, and
   `Refine` answers them (decision 7).

4. **What `Angular` means.** The turning angle between consecutive segments, as the brief and
   OpenCascade define it, made to cover end segments and single-segment edges through the tangent
   deviation (`Angular / 2` per segment). On circles both agree with every kernel studied. Capped at
   a third of a turn.

5. **Termination.** Every split made for a criterion leaves two chords of at least `MinLength`; the
   chords of an inscribed polyline sum to at most the arc length `L`; so there are at most
   `L / MinLength` such segments, plus fewer than the seed count of unsplit seed spans, plus fewer
   than the count floor of floor splits (theorem `DiscretizeTerminates`). The conic path never goes
   past its length cap or its floor. Without `MinLength`, refinement near a pole, a cusp, or nearly
   coincident knots need not stop.

6. **Every criterion is widened by the model's own tolerance.** A criterion exceeded by less than
   the file's uncertainty is met: `Chordal + LengthTolerance` (which also covers end points that sit
   up to the tolerance off the curve, research/MESHING-REQUIREMENTS.md 3.9), `Angular +
   AngleTolerance`, `MaxLength + LengthTolerance`, `MinLength - LengthTolerance`. The image laws
   allow twice the `LengthTolerance`: once for the pcurve's agreement with the curve, once for an end
   point's distance from the curve. A law that compares this layer's arithmetic with itself (the
   closed-form arc count) takes its slack from layer 0's `ResolutionAt`, never from a file
   tolerance. No literal epsilon appears in a law. Angles are measured by `atan2(|u x v|, u . v)`
   (`AngleOrZero`), which resolves small angles where the arc cosine reads up to 3e-8 rad.

7. **Exact equality only on copies.** End points (copied from vertices), seeds (copied into the
   parameters), reversal, and refinement (old parameters kept) are compared with `==`. Every computed
   comparison names a tolerance.

8. **Refinement continues; it does not restart.** `RefineEdge` keeps every old parameter and bisects
   further, so `Refine` never coarsens an edge (`Law_RefineNeverCoarsens`) and leaves unrequested
   edges bit-identical (`Law_RefineKeepsUnrequestedEdges`). Requests on one edge combine: the
   smallest `Chordal`, the largest `Segments`. A degenerate edge keeps its one segment.

9. **Monotonicity in the chordal bound.** On the bisection path the seeds do not depend on the
   bound and every test that fails at a looser bound fails at a tighter one, so the partitions nest
   (research/VALIDATION-MATH.md 6.3). On the conic path the count is the least count at or above the
   closed form for which the image criteria hold; a tighter bound starts the search no lower, so it
   ends no lower, even though uniform partitions of different counts do not nest. Hence
   `Law_TighterChordalNeverFewerPoints`, stated for the point count.

10. **Model laws and library laws.** As in research/VALIDATION-MATH.md section 8: model laws take a
    discretization as data, so validation can check any polyline against the criteria it claims;
    `Discretize` promises them for its results. Library laws call this layer's functions and run on
    witnesses. Laws over `BrepModel` or a discretization are never reached by the random-instance
    runner (PLATO-PRIMER.md B.2); `Law_ArcCriteriaCountMeetsChordal` is the one over scalars and
    small records, though it still takes a `DiscretizationCriteria`, whose `Limit` field the runner
    cannot construct.

## Laws

Severity per SPEC-DSL.md section 4: Error for structural laws, W/E for a geometric criterion
(Warning below ten times the criterion, Error above), Info for quality, "test" for a library law.
"Floor" means the law is exempt on a segment the refinement floor stopped.

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_ParameterCountEqualsPointCount` | one parameter per point | exact | Error |
| `Law_EmptyOrAtLeastTwoParameters` | at least two samples, or none (`Undiscretized`) | exact | Error |
| `Law_UndiscretizedExactlyWhenUnusable` | an entry of `DiscretizeAll` is empty exactly when `CanDiscretize` rejects its edge | exact | Error |
| `Law_ParametersStrictlyMonotone` | consecutive parameters move in the array's direction | exact | Error |
| `Law_ParametersStrictlyIncreasing` | consecutive parameters increase (canonical values) | exact | Error |
| `Law_LowestParameterIsDomainStart` | the lowest parameter is the domain start | exact (copied) | Error |
| `Law_HighestParameterIsDomainEnd` | the highest parameter is the domain end | exact (copied) | Error |
| `Law_PointsLieOnCurve` | `P_i` is within the tolerance of `C(t_i)` | `LengthTolerance` | Error |
| `Law_DomainStartPointIsVertex` | the point at the domain start is the domain-start vertex | exact (copied) | Error |
| `Law_DomainEndPointIsVertex` | the point at the domain end is the domain-end vertex | exact (copied) | Error |
| `Law_SeedsAreSampled` | every seed is a parameter | exact (copied) | Error |
| `Law_DegenerateEdgeHasOneSegment` | a degenerate edge has two parameters | exact | Error |
| `Law_SagittaWithinChordal` | sampled sagitta at most the effective chordal bound, or floor | `Chordal + LengthTolerance` | W/E |
| `Law_CertifiedSagittaWithinChordal` | the certified exact sagitta (`Sagitta`) at most the effective chordal bound, or floor | `Chordal + LengthTolerance` | test |
| `Law_TangentDeviationWithinHalfAngular` | chord within half the angular bound of every sampled tangent, or floor | `Angular / 2 + AngleTolerance` | W/E |
| `Law_TurningAngleWithinAngular` | turning angle at a non-seed joint at most the angular bound, or floor | `Angular + AngleTolerance` | W/E |
| `Law_SegmentWithinMaxLength` | every chord within the length limit, or floor | `MaxLength + LengthTolerance` | W/E |
| `Law_ShortSegmentIsForced` | a chord under `MinLength` is a whole seed span or the count is at its floor | `MinLength - LengthTolerance` | Info |
| `Law_ClosedEdgeHasMinSegments` | a closed edge that is not degenerate has at least `max(3, MinSegments)` segments | exact | Error |
| `Law_SegmentFloorMet` | the count is at least `MinimumSegmentCount` | exact | Error |
| `Law_ImageHasOnePointPerPoint` | an image has one point per polyline point | exact | Error |
| `Law_ImagePointReevaluates` | the surface at image point `i` is `P_i` | `2 LengthTolerance` | W/E |
| `Law_ImageStepsAreUnwrapped` | consecutive image points are within half a period | exact | Error |
| `Law_ImageChordWithinChordal` | the mapped straight image segment is within the chordal bound of the chord, or floor | `Chordal + 2 LengthTolerance` | W/E |
| `Law_ReversedIsInvolution` | reversing twice gives the same arrays | exact | test |
| `Law_ReversedReversesParameters` | parameter `i` becomes parameter `n - i` | exact | test |
| `Law_ReversedReversesPoints` | point `i` becomes point `n - i` | exact | test |
| `Law_OppositeUsesSeeReversedPoints` | opposite uses of an edge read the same points in opposite orders | exact | test |
| `Law_EdgeReversalLeavesDiscretization` | reversing the edge in the model leaves its discretization bit-identical | exact | test |
| `Law_TighterChordalNeverFewerPoints` | a tighter chordal bound never gives fewer points | exact | test |
| `Law_RefineKeepsUnrequestedEdges` | unrequested edges are bit-identical after `Refine` | exact | test |
| `Law_RefineNeverCoarsens` | every old parameter of a requested edge survives `Refine` | exact | test |
| `Law_RefineMeetsRequestedSegments` | a requested count is met (degenerate edges excepted) | exact | test |
| `Law_DiscretizationsIndexedByEdge` | entry `i` is the discretization of edge `i` | exact | Error |
| `Law_DiscretizationsCoverEdges` | one entry per edge | exact | Error |
| `Law_ArcCriteriaCountMeetsChordal` | the closed-form arc count meets the chordal bound | `ResolutionAt(radius)` (rounding) | test |

## Diagnostic codes

`DiscretizationFindings` (in `termination-discretize.library.plato`, TKT-346) reports what the bounded
`Discretize` and `RefineEdge` saw; layer 8's `LoopReport` adds them to a run's report. Both are
Warnings located at the edge (`Provenance.KernelEdge`).

| Code | Measure | When |
|---|---|---|
| `DISCRETIZE-EDGE-OFF-SURFACE` | the largest distance of an edge point from the surface of a face that uses it | the gap exceeds the chordal bound, so no refinement meets that face's image chord test; the image is left out of the edge's refinement |
| `DISCRETIZE-NOT-CONVERGED` | the number of failing segments | refinement stopped at the minimum segment length with a criterion still failing |

## Left open

- **Simplicity of a face's parameter-space polygon.** The image criterion bounds how far each
  straight image segment strays, measured in 3D; it does not prove that a face whose exact loops are
  simple gets a simple polygon, because the surface metric can collapse (poles) or the loops can
  pass closer than the chordal bound. The feedback loop (`LoopSelfIntersects` requests, `Refine`,
  a bounded number of rounds in layer 8) handles what remains. Layer 5 owns the region types and
  can state the conjecture with its own predicates.
- **Irregular parameterizations.** A zero derivative inside a span (coincident B-spline control
  points) makes a sampled tangent deviation read 0 there (`AngleOrZero`). The turning-angle theorem
  states regularity as a hypothesis; such a point is not a seed, so `Law_TurningAngleWithinAngular`
  can fail on a correct discretization of a cusp, and validation reports it.
- **Distinct-point floor for loops.** Only two-edge loops get a structural floor. A loop of three
  edges one of which is degenerate can still have two distinct 3D points; no case is known in STEP
  practice, but none is ruled out.
- **Edges with an empty domain** fail `CanDiscretize`; `DiscretizeAll` gives them the empty entry
  `Undiscretized`, and validation reports them.

## Implementation notes

- **Algorithm family.** Seeds first. Lines, circles, and ellipses: closed-form uniform split
  (`ArcSegmentCount`; for an ellipse with semi-axes `a > b`, radius `a` for the chordal and length
  bounds, the angular bound scaled by `b / a`, radius `b` for the length cap: the worst points of a
  uniform split in its parameter are the ends of the major axis), then raised one segment at a time
  until the image criteria hold. Everything else: adaptive bisection at parameter midpoints inside
  each seed span, the sagitta tested by the control-hull certificate on every Bezier span,
  polynomial or rational (research/MESHING-REQUIREMENTS.md 3.2, research/VALIDATION-MATH.md 6.3),
  the angles by the plan's samples; every split leaves both halves at least `MinLength`; then the
  image test on each segment; then count-floor splits of the segment longest in parameter. Never
  curvature marching (decision 2).
- **Cost.** A curved edge of sweep `T` and radius `R` gets about `T sqrt(R / (8 d))` segments for
  chordal bound `d`: the count grows as `d^(-1/2)` (research/VALIDATION-MATH.md 6.1), and as
  `T / Angular` for small radii. Each candidate segment costs `k` curve evaluations (`k = 3`), plus
  `k` surface evaluations per image (two images for an ordinary edge), plus one `Project` per point
  for an image without a pcurve. Edges are independent, so `DiscretizeAll` parallelizes without
  coordination. `FacesOfEdge` and `IsInTwoEdgeLoop` are quadratic as written; an implementation
  builds the edge-to-face and edge-to-loop-size tables once per model.
- **The angular criterion is not optional.** Area converges only when normals do (the Schwarz
  lantern, research/VALIDATION-MATH.md 6.2); a chordal bound alone lets boundary chords of small
  features turn through large angles.

## Names used from layers 0 to 2

Fixed names: `Tolerances` (`Length`, `Angle` and their `Value`), `Periodicity`
(`Aperiodic`, `Periodic`, `Closed`), `Wrap(d: CurveDomain, t)`, `NearestUnwrapped`, `ResolutionAt`, `CurveDomain` (`Range`, `Periodicity`), `SurfaceDomain` (`U`, `V`),
`CurveIndex`, `Curve2DIndex`, `PcurveIndex`, `SurfaceIndex`, `BrepVertexIndex`, `BrepEdgeIndex`,
`BrepLoopIndex`, `BrepFaceIndex`; `GeometrySet` (`Curves`, `Curves2D`, `Pcurves`, `Surfaces`),
`Pcurve` (`Surface`, `Curve`), `Domain(g, s)`, `Eval(g, c, t)`, `Eval(g, s, uv)`, `Derivative(g, c,
t)`, `Project(g, s, p)` (in the spec); `BrepModel` and all nine fields, `BrepEdge`, `BrepVertex`,
`BrepLoop` (`EdgeLoop`, `VertexLoop`, `PolyLoop`), `BrepFace` (`Surface`, `Bounds`), `FaceBound`
(`Loop`), `Coedge`, `EdgeOrientation`, `IsVertexInRange`, `IsEdgeInRange`, `IsFaceInRange`,
`EdgeDomain`, `CoedgeRunsForwardOnCurve(m, bound: FaceBound, coedge: Coedge)`, `Law_IndicesInRange(m)`,
`SamplePlan { Count }` (both ends counted). From layer 1: `PcurvesOf(g, c)`, `Eval(g, c: Curve2DIndex,
t)`, `Eval(g, p: PcurveIndex, t)`, `Domain(g, p: PcurveIndex)`, `ClosestParameter(g, p: PcurveIndex,
q)`, `ParameterToleranceAt(g, c, t, tol)` (spec). From layer 2: `IsClosedEdge`, `IsDegenerateEdge`,
`CoedgeCount`, `CitesEdge`, `LoopUsesEdge`, `FaceUsesEdge`, `FacesOfEdge(m, e)`, `Opposite`,
`SwappedEnds`, `WithUsesFlipped`, `WithEdgeReversed`.

Assumed of layer 2: `EdgeDomain(m, e).Range` is increasing in the curve's parameter and does not
depend on the edge's `SameSense` (the edge-reversal laws rely on it).

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `EdgeRefinementRequest { Edge; Reason; Chordal }` | adds `Segments: Integer` (0 when not about counts) | a `QuadCountMismatch` request must carry the count it needs, and `Refine` takes no floors |
| `EdgeDiscretization`: parameters strictly increasing | every value strictly monotone; canonical values (results of `Discretize`, entries of `EdgeDiscretizations`) strictly increasing | `Reversed` reverses both arrays, so its result decreases; SPEC-DSL.md's example spec lists `Reversed` as a constructor beside the increasing invariant, which cannot both hold |
| `Sagitta(m, e, t0, t1)` | kept as the exact Hausdorff sagitta (deferred); new `SampledSagitta(m, d, plan, i)` for the laws | the brief asks for a sampled law with a sample plan; the exact value has no general closed form |
| `TurningAngle(...)` | `TurningAngle(d, i): Angle`; new `TangentDeviation(m, d, plan, i): Angle` | fixes the signature; the second covers end segments and single-segment edges |
| `Angular` (unspecified) | the turning angle at non-seed joints, and twice the tangent deviation per segment, capped at a third of a turn | research/MESHING-REQUIREMENTS.md finding 3 and recommendation 3; one meaning that agrees with every kernel on circles |
| (new) | `EdgeImage { Face; Pcurve }`, `EdgeImages`, `ImagePoints`, `UvChordDeviation` | the two-space criterion needs a named parameter space per face and pcurve |
| (new) | `SegmentCount`, `SegmentLength(d, i)`, `MinimumSegmentCount`, `ArcSegmentCount`, `EdgeSeeds`, `TotalTurning`, `CanDiscretize`, `RefineEdge`, `AlongCoedge`, `WithChordal`, `NoFloors`, `DefaultCriteria` | helpers the laws and the pipeline need |
| (lower layers lacked them) | declared here first with `// belongs-in`, now owned by layers 1 and 2 and deleted here (fix wave) | the contract fixed no topology queries over loops, no pcurve accessor, no 2D curve evaluation |
| `DiscretizeAll` requires every edge to pass `CanDiscretize` | total: `Undiscretized(e)` for a rejected edge; invariant `Law_EmptyOrAtLeastTwoParameters` (was `Law_AtLeastTwoParameters`); new `IsDiscretized`, `Law_UndiscretizedExactlyWhenUnusable` | the pipeline repeated the guard (08 finding 2) |
| `IsRefinable(m, ds)` in the laws block | `IsRefinable(m, ds, requests, c)` in `EdgeDiscretizing`, asking only of requested entries | `Refine` reads only those (08 finding 2) |
| `SameDiscretization` in the laws block | in `EdgeDiscretizing`, same signature | the pipeline needs it as a definition (08 finding 3) |
| `Law_ImageFollowsPcurve`, `PcurveGap`, `UvGap`, `PeriodicGap` | deleted | vacuous, and a Euclidean norm over mixed units (review F9) |
| `ImagePoints`: pcurve at `t_i` | pcurve at its own parameter nearest `P_i`; exact under reversal; the one image function face meshing uses | review C5 |
| `SamplePlan.Count` as interior samples | both ends counted; `DiscretizationPlan` is `SamplePlan(5)` | review C8 |
| (new) | `IsClosedRegularEdge`, `MeetsCriteria`, `Law_CertifiedSagittaWithinChordal`, theorem `CountRequestsReachTheirCount` | review C4, T2, C11 |

Two corrections to the shared documents, found while gating: PLATO-PRIMER.md A.2 says the compiler
derives per-field setters (`c.WithRadius(2.0)`); the front end does not (`Could not find symbol
WithStart`), and the stdlib declares its setters by hand (`WithNext` in
`triangulation.library.plato`). And SPEC-DSL.md's example writes `m.EdgeDomain(e).Start`, where
`CurveDomain` has the field `Range`, so the fixed spelling is `m.EdgeDomain(e).Range.Start`.

## Fix wave, 2026-10-17

Applied from reviews/FIX-WAVE.md, reviews/MATH-REVIEW-layers-0-6.md, and the lower-layer findings
of `07-validation` and `08-pipeline`, one commit each:

- Deleted `PcurvesOf` and the 2D `Eval`; layer 1 owns them (C10).
- Deleted `IsClosedEdge` and `IsDegenerateEdge`; the closed-edge floor reads the new
  `IsClosedRegularEdge` (C4).
- `DiscretizeAll` takes the usability guard and gives a rejected edge `Undiscretized` (08 finding 2).
- `Refine`'s precondition asks only of requested entries (08 finding 2).
- `SameDiscretization` and `IsRefinable` moved into `EdgeDiscretizing` (08 finding 3).
- Deleted the vacuous `Law_ImageFollowsPcurve` and the mixed-unit `UvGap`; image reversal is exact
  (F9, C2).
- `ImagePoints` reads a pcurve at its own nearest parameter and is the one image function (C5).
- `Closed` directions unwrap and seam like `Periodic`; evaluation wraps; the join is a seed (C1, T1).
- Deleted the nine remaining topology stand-ins; layer 2 owns them.
- Seeds merge within the per-point parameter tolerance, which picks the length or angle floor (T8,
  the `Tolerances.Parameter` split).
- The closed-form arc law takes its slack from `ResolutionAt` (layer 0's rounding rule).
- Angles by `atan2`; `TotalTurning`'s slack from point displacement, not the angle tolerance (F7's
  pattern).
- `SamplePlan.Count` counts both ends (C8).
- Rational spans certified; `Law_CertifiedSagittaWithinChordal` promised by `Discretize` (T2).
- Every split respects `MinLength`, stated for `DiscretizeTerminates` (section 5).
- `TurningAngleBoundedByTangentDeviation` assumes regularity (section 5).
- Count requests reach their count exactly; theorem `CountRequestsReachTheirCount` with the round
  bound (C11).

Not changed, with the reason:

- `ChordalRefinementIsMonotone`, `SharedPolylineClosesEveryEdge`, `EdgeReversalInvariance`: the
  review finds them sound. The certified sagitta keeps monotonicity: the certificate does not
  depend on the bound, so a test that fails at a looser bound fails at a tighter one.
- The criteria laws keep their widening by the file's tolerances (decision 6): there the file's
  uncertainty, not rounding, is the reason, so `ResolutionAt` does not apply.

Other layers now depend on: layer 7 renames its `Law_AtLeastTwoParameters` check and drops the
`Law_ImageFollowsPcurve` check and `PcurveGapAt`; layer 8 deletes `DiscretizeUsable` and its
`Undiscretized` (same signature as layer 4's) and calls `DiscretizeAll`; layer 5 draws loops with
`ImagePoints`.

## Name review, 2026-10-17

The name-and-dependency review after the fix wave (VOCABULARY.md revision 3) changed this layer as follows.

- Took `ScaledBy(c: DiscretizationCriteria, factor)` and `ScaledBy(l: Limit, factor)` from layer 8, where they stood in (`belongs-in: 04-discretization`), into the Criteria section.

## Implementation, chunk A

TKT-314, 2026-10-17. Five bodies, each from its contract in `discretization.spec.plato`:

| Body | Derived from | Laws that read it |
|---|---|---|
| `EdgeSeeds` | contract `EdgeSeeds`: domain ends copied from `EdgeDomain`; every copy inside the domain of layer 1's `Breakpoints` and, on a `Closed` curve, of the join; sorted; a candidate within `ParameterToleranceAt` of the last kept seed or of the end dropped | `Law_SeedsAreSampled`, `Law_TurningAngleWithinAngular`, `Law_ShortSegmentIsForced` |
| `TotalTurning` | contract `TotalTurning`: 0 for a line, the domain length for a circle; otherwise the sum of angles between tangents sampled at 65 points per seed span, the jumps at seeds crossed between spans | `TurnFloor`, `Law_SegmentFloorMet` |
| `Sagitta` | contract `Sagitta`, its closed forms: 0 for a line, `R (1 - cos(dt / 2))` for a circle, the parametric midpoint's distance for an ellipse arc under half a turn. Every other case calls `SagittaByHullBound`, a new bodiless function holding the control-hull certificate for chunk F | `Law_CertifiedSagittaWithinChordal`, `Discretize`'s bisection |
| `ImagePoints` | contract `ImagePoints`: canonical order, reversed with `d`; the pcurve's 2D curve at layer 1's `ClosestParameter` on the pcurve, or `Project` with a pole's free coordinate taken from its neighbour; unwrapped by `NearestUnwrapped` | `Law_ImageHasOnePointPerPoint`, `Law_ImagePointReevaluates`, `Law_ImageStepsAreUnwrapped`, `Law_ImageChordWithinChordal` |
| `Discretize` | contract `Discretize` and its deferred note: degenerate edge two samples; line, circle, ellipse uniform at the closed-form count (`ConicCount`), raised while an image chord exceeds the bound and the minimum length allows; other curves bisected at parameter midpoints per seed span (depth at most 40), then the widest parameter span halved until `MinimumSegmentCount` | every law of the "Samples", "Criteria" and "Counts" sections, `Law_EdgeReversalLeavesDiscretization` |

The image path with a pcurve reaches layer 1's `ClosestParameter(g, p: PcurveIndex, q)`, still
deferred; no witness of chunk A has a pcurve.

Law results, provisional (scratch compiler, see layer 2's README): over every edge of the ten
positive and three negative witnesses, discretized under `Witness_UnitScaleOptions` (chordal 0.01,
15 degrees), 7,704 evaluations. All hold except: `Law_TurningAngleWithinAngular` on the full circles
of `Witness_Cylinder`, `Witness_Torus`, `Witness_Cone` and the arcs of the sector, where the uniform
count lands exactly on the bound (24 segments of 15 degrees) and the 32-bit turning angle exceeds it
by more than the witness's angle tolerance of `1e-8` rad, which a 32-bit `Number` cannot honour
(PLATO-PRIMER.md D.1); chunk B, with TKT-315's 64-bit profile, is where circles are judged. The box,
the hollow box and the block with a hole get one segment per edge. `Witness_BSplinePatchSolid`'s four
spline edges throw in layer 1's deferred `BSplinePoint` (chunk F).

## Implementation, chunk B

TKT-324, 2026-10-18. One body, from its contract in `discretization.spec.plato`:

| Body | Derived from | Laws that read it |
|---|---|---|
| `RefineEdge` | contract `RefineEdge` and its deferred note: a degenerate edge kept; every segment failing `SegmentMeetsCriteria` (the per-segment test of `MeetsCriteria`, factored out so the two cannot drift: certified sagitta, tangent deviation, length limit, image chords, each widened as in its law or escaped at the length floor) bisected at its parameter midpoint, each half again while its piece fails the same test (depth at most 40); then `RaisedToCount` to the requested count | the contract's ensures, `Law_RefineNeverCoarsens`, `Law_RefineMeetsRequestedSegments`, layer 8's `Law_RefinementNeverCoarsens` |

Because the split test is the one `MeetsCriteria` applies, a discretization that already meets the
criteria gains only the count pass's points: the contract's `SegmentCount == d.SegmentCount.Max(segments)`
holds by construction. Probe on the unit cylinder witnesses (interpreter, cpu64, chordal 0.01,
15 degrees): the full circle goes from 24 to 48 segments at a third of the chordal bound, to 40
segments when 40 are asked, and stays at 24 when nothing is asked; the quarter arc goes from 6 to 12;
every old parameter is kept and the contract's laws hold on every result.

Decision F-54 (2026-10-18): the laws over a discretization the library makes take the producer's
inputs. `Law_ParameterCountEqualsPointCount`, `Law_EmptyOrAtLeastTwoParameters`,
`Law_ParametersStrictlyIncreasing`, `Law_LowestParameterIsDomainStart` and
`Law_HighestParameterIsDomainEnd` take `(m, e, c, floors)` and check `DiscretizedEntry`, the entry
`DiscretizeAll` makes for one edge (new, and now `DiscretizeAll`'s own per-entry rule).
`Law_SeedsAreSampled` and `Law_ClosedEdgeHasMinSegments` check `Discretize` under `CanDiscretize`,
since an `Undiscretized` entry has no samples. `Law_UndiscretizedExactlyWhenUnusable`,
`Law_DiscretizationsIndexedByEdge` and `Law_DiscretizationsCoverEdges` check `DiscretizeAll`'s
result. Each claim keeps its body as a predicate of the same name without `Law_`, which the
contracts, `IsRefinable` and layer 7's checks apply to the values they hold.
`Law_SegmentFloorMet` still takes a discretization: layer 8 calls it, and it follows once layer 8's
open edits land.
