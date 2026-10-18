# Mathematical review of layers 0 to 6

Reviewer: a fresh Opus session that wrote none of the layers (TKT-299, the STEP B-rep to mesh design,
Phase 3 "Mathematical review" of [PLAN.md](../PLAN.md)). Date 2026-10-17. Scope: `00-foundation` to
`06-mesh`, read against [README.md](../README.md), [SPEC-DSL.md](../SPEC-DSL.md),
[VOCABULARY.md](../VOCABULARY.md) and the three research documents. Layers 7 and 8 were not reviewed.
Names and syntax were not checked except where a name carries a meaning that conflicts with another.

The worked numbers below were computed with small Python scripts kept in the session scratch folder
(`scratchpad/math-review/checks.py`, `counts.py`, `sliver.py`); every number quoted is their output.
Finding identifiers are `F` (false or imprecise), `M` (missing), `C` (cross-layer), `T` (timid),
`H` (theorem), and each names the file and the declaration it is about.

The owner's premise (PLAN.md, "Decided by the owner during the pass") is applied throughout: where a
law can be enforced, enforce it; where the mathematics settles a question, settle it.

## 1. False or imprecise laws

### F1. Model seams are assigned by continuity, which fails whenever a loop crosses a pole

`05-face-meshing/uv-regions.library.plato`, `Unwrap`, `AddMissingSeamsAndPoles`, and the README
decision "a seam's two pcurves ... continuity in `Unwrap` assigns the two copies anyway".

`Unwrap` replaces each point by the copy nearest its predecessor, and a point on a collapsed line
takes the free parameter from its predecessor. Continuity can tell the two uses of a seam apart only
when something between them winds around the period, such as the circles of a cylinder. When the two
uses meet at a pole or an apex, nothing does:

- Sphere A (research/VALIDATION-MATH.md 1.5, "the form a careful exporter writes"), loop
  `[seam+, seam-]`. Every seam sample projects to `u = 0` (or `2 pi - 1e-17` after rounding). The pole
  takes its `u` from the last seam sample, and the down seam takes the copy nearest the pole. Both uses
  land on one copy. The region is a zero-width slit. `AddMissingSeamsAndPoles` inserts a pole segment
  "from the arriving to the leaving free parameter", which is empty because both are 0.
- The cone with an apex vertex and a seam (`Witness_Cone`), loop `[base+, seam+, seam-]`. The base
  circle carries `u` from 0 to `2 pi`, the seam goes up at `2 pi`, the apex takes `2 pi`, and the seam
  comes down at `2 pi` again. The loop is then a winding loop with a zero-width slit, so the face gets
  a synthetic cut as well. `Law_RegionSegmentsSeparated` fails, `MeshFace` returns a blocking
  `LoopSelfIntersects` request, and no refinement of the seam can clear it.
- Sphere C (degenerate pole edges) fails the same way.

research/STEP-BREP-MODEL.md 4.3 gives the correct rule, and on this point the research is right. Seen
in the chart `(s u, v)` with `s = FaceNormalSign`, the face lies to the left of each use. So the use
traversed with increasing `v` sits on the copy at the larger chart `u`, and the use traversed with
decreasing `v` sits on the smaller one.

Fix: assign the `u` copy of every seam-use sample by that rule, and use continuity only for samples
that are not on a seam. State it as a law (M8).

### F2. Mirrored placements give inward normals on analytic faces, and fail the placement law

`03-step` "Orientation folding" (`w = sigma(f_o) sigma(s_o) d`); `01-geometry`
`NormalOr`, `NormalAgreesWithParameterization`, `IsOrthonormalWithin(Frame3D)` (used by
`Law_SurfacePlacementOrthonormal` and `Law_CurvePlacementOrthonormal`).

A placement with a negative determinant turns a right-handed frame into a left-handed one. Two things
then go wrong.

1. `IsOrthonormalWithin` requires `X x Y` to be the same direction as `Z`, so every surface and conic
   of a mirrored mapped item fails a File law. A mirrored mapped item is legal STEP.
2. For placement-based surfaces (plane, cylinder, cone, sphere, torus), `NormalOr` is built from the
   frame's axes, so after mirroring it is `T N`, still pointing outward. But
   `S'_u x S'_v = -T (S_u x S_v)`. Computed for a sphere with `R = 2` at `(u, v) = (0.7, 0.3)`:
   `N . (S_u x S_v)` is `+3.82` in the right-handed frame and `-3.82` in the mirrored one, with
   `N . P = +2` (outward) in both. `NormalAgreesWithParameterization` still returns true. The fold
   multiplies `SameSense` by `d = -1`, so the face normal `sigma(SameSense) NormalOr` points into the
   material. For B-spline and swept faces, whose `NormalOr` is `<S_u x S_v>`, the same fold is
   correct. The fold is right for one family of surfaces and wrong for the other.

Fix, and the stronger design: make the kernel normal `<S_u x S_v>` for every case. Fold ISO's sense
difference (the lemon part, a mirrored frame) into `SameSense` at decode, which removes
`NormalAgreesWithParameterization` and the sign `epsilon` from layers 2 and 5. Mirroring is then
uniformly "flip `SameSense` and every bound". The placement law should accept an orthonormal frame of
either handedness.

### F3. `NormalAgreesWithParameterization` is constant per surface, but the sign is not

`01-geometry/geometry-surfaces.library.plato`, `NormalAgreesWithParameterization` (Torus case
`part != Lemon`); `02-topology/topology.spec.plato`, its contract.

Decision 6 of layer 1 keeps a `toroidal_surface` with `major < minor` as `Full`. On that surface,
`S_u x S_v = r rho N` with `rho = R + r cos v`, which changes sign at the axis. With `R = 1`, `r = 2`:
at `v = 0.3`, `rho = 2.91` and `N . (S_u x S_v) = +5.82`; at `v = 2.5`, `rho = -0.60` and the product
is `-1.21`. `Law_NormalSenseMatchesParameterization` fails on the inner region, and
`FaceNormalSign` (layer 2) is wrong for any face on it. Layer 2's contract for the same function
demands a constant sign over the domain, which layer 1's body does not give.

Fix: split a `Full` torus with `major < minor` into its `Apple` and `Lemon` parts at decode (layer 3
already reports it), or, following F2, drop `epsilon` altogether.

### F4. The closed-edge rule of `EdgeDomain` breaks on unbounded curves and on pcurves

`02-topology/topology.library.plato`, `TraversalDomain`, `EdgeDomain`, `PcurveEdgeDomain`;
`01-geometry`, `ClosestParameter(g, p: PcurveIndex, q)`.

"A closed edge on an aperiodic curve spans the curve's whole domain" is false in three legitimate
cases.

- (a) An unbounded curve. A closed edge on a `Line` gets `[Number.MinValue, Number.MaxValue]`.
  Layer 3's repairs (merge coincident vertices on one edge, drop zero-length edges on open curves)
  mostly prevent this in decoded files. The rule is still false for every other producer of a
  `BrepModel`.
- (b) `PcurveEdgeDomain` applies the rule to the pcurve's 2D curve. The bottom circle of a cylinder
  is a closed edge whose pcurve is a 2D `Line`, the commonest pcurve there is, so its pcurve range is
  the unbounded domain. `Law_PcurveAgreesWithCurve` then samples `Lerp` over `[-1.8e308, 1.8e308]`,
  gets `inf` or `NaN`, and fails. For open edges, `ClosestParameter` on that pcurve has infinitely many
  global minimizers (`u + 2 pi k` all reach the same 3D point), so "ties to the smaller parameter" has
  no answer on an unbounded domain. Layer 1's `Law_SurfaceCurvePcurveLiesOnCurve` has the same flaw at
  the arena level: it samples the pcurve's whole domain, so a bounded 3D curve with an unbounded line
  pcurve fails.
- (c) A closed clamped B-spline whose vertex is not at its join, or an open edge that crosses the join.
  The rule gives the curve's own domain or the complementary arc. Theorem
  `EdgeDomainEndsFollowFromVertexOnCurve` excludes this case instead of fixing it.

Fix: decide closure once (C1). On a curve that is aperiodic and not closed, a closed edge is
degenerate with the range `[a, a]`. Derive a pcurve's range from the edge's 3D range and the surface
periods, never from the pcurve's own domain.

### F5. The derivative laws exclude the wrong knots, and use the wrong kind of tolerance

`01-geometry/geometry.laws.plato`, `Law_DerivativeMatchesCentralDifference`,
`Law_SecondDerivativeMatchesCentralDifference`, `Law_PartialMatchesCentralDifference` and their 2D
and pcurve forms; the `forall (tol: Tolerances)` ensures in `geometry.spec.plato`.

- **Breakpoints are too few.** `StraddlesBreakpoint` skips only knots of multiplicity at least the
  degree `p`. A central difference loses its second order wherever the next derivative jumps: at
  multiplicity `p - 1` or more for the first-derivative law, and `p - 2` or more for the second. Worked
  example: a quadratic B-spline with simple interior knots (C1 joins, the ordinary quadratic NURBS),
  sampled within `h` of the knot 0.25. Then `|CD - C'| = 1.1e-4`, against a bound of `1.3e-7` at an
  angle tolerance of 1e-8. The law is false.
- **Wrong kind of tolerance.** The bound is "model angle tolerance times speed, plus
  `ResolutionAt(|Eval(x)|) / h`". The first term reads the file's coincidence tolerance as an error
  bound for this library's own code, which layer 0's rule forbids ("rounding-only laws take their bound
  from `ResolutionAt`, never from a model tolerance"). The `forall (tol)` contracts then quantify it
  down to the smallest normal. The second term measures rounding by the distance of the point from the
  world origin, not by the size of the terms the evaluation adds. Worked example: a circle of radius 1
  centred at `(1, 0)`, at `t = pi`, where it passes through the origin. The error `2.6e-11` holds at
  an angle tolerance of 1e-8, fails at 1e-12, and fails at the smallest normal (bound `9e-26`).

Fix: exclude samples within `h` of any distinct interior knot. Replace the bound with a
self-calibrating Richardson estimate, `|D(h/2) - C'| <= (4/3) |D(h) - D(h/2)| + ResolutionAt(M) / h`,
where `M` is the curve's evaluation magnitude (largest of the placement origin, the radii, and the
control points). This settles conjecture `CentralDifferenceStepSuffices` (H1).

### F6. The resolution floor is taken at the model size, not at the coordinates' magnitude

`03-step/step.library.plato`, `ModelLengthTolerance`; `00-foundation`, `ParameterFloor` and
`Law_LengthToleranceResolvable` as the decoder calls them.

`ResolutionAt(modelSize)` uses the diagonal of the bounding box. Rounding depends on how large the
coordinates are, not on how large the model is. A building model in millimetres in survey
coordinates near `5e9` mm has a spacing between adjacent numbers (`ulp`) of `9.5e-7` mm, and
`ResolutionAt(5e9) = 1.8e-5` mm. With a model size of `1e5`, `ResolutionAt(1e5)` is only `3.6e-10`, so
a file tolerance of 1e-6 mm, one `ulp`, is accepted as resolvable, and every `Coincident` at that
tolerance is rounding noise. This matters for the toolkit's BIM users in particular.

Fix: pass the largest coordinate magnitude of the placed bounding box (its farthest corner from the
origin), or translate the model to its bounding-box centre at decode and record the offset (layer 6
already centres the signed volume this way).

### F7. Rounding laws judged with model tolerances

- `05-face-meshing/face-meshing.laws.plato`, `Law_PointNormalIsFaceNormal`. It uses the stdlib's
  `AngleBetween` (arc cosine) against `Tolerances.Angle`, which is 1e-9 rad by layer 3's policy. The
  arc cosine cannot resolve angles below about 1.5e-8. Comparing a normalized vector with itself gives
  up to `2.98e-8`, and 33% of 100,000 random unit vectors exceed 1e-9. Layer 0 decision 3 exists for
  exactly this case. Fix: use `AngleBetweenDirections`, which gives exactly 0 for identical vectors,
  with a bound from `ResolutionAt`.
- `06-mesh/mesh-measures.laws.plato`, `Law_AreaIsSumOfFaceMeshAreas`, tolerance `tol^2 N`. Summing 50
  element areas totalling `9.8e5` mm^2 in two orders differs by up to `7.0e-10`; the bound is `5e-11`
  (`tol = 1e-6`). Even compensated summation errs by `2 u` times the total, `2.2e-10`. The README's
  "true for meshes of any size" is false. Fix: a bound of `ResolutionAt(sum |a_i|)` times
  `(1 + log2 N)`, or require the same summation order so the identity is exact.
- `00-foundation/foundation.laws.plato`, `Law_HoldingCheckIsWithinBound(c, bound)`. As a law over all
  values of its parameters it is false: `CheckWithin("L", 0.5, 1.0, Nowhere)` holds, and
  `bound = 0.1` refutes the law. It is true only for "the check's own bound", which `Check` does not
  store (C9).

### F8. `Samples` overflows on the unbounded domain that layer 1 builds

`00-foundation/foundation.library.plato`, `Samples(range, count)` and `StepsAreResolvable`;
`Law_SamplesStrictlyIncreasing`.

Both preconditions hold for `[-MaxValue, MaxValue]`, because both ends are finite, yet `End - Start`
overflows. With `count = 3` the samples are `[-1.8e308, inf, 1.8e308]`, `StepsAreResolvable` is true,
and sample 1 is not below sample 2, so the law fails. This is not academic: layer 1's
`UnboundedDomain` is exactly this range, so every `Check_` that samples a `Line`, a `Plane`, or the `v`
of a cylinder, cone, or extrusion by `Samples(domain, plan)` gets infinite samples. Fix: require
`ParameterLength.IsFinite` in both. Laws over an unbounded direction should sample a bounded window
(the edge domain, or the face's parameter box).

### F9. `Law_ImageFollowsPcurve` is vacuous, and mixes units

`04-discretization/discretization.laws.plato`, `Law_ImageFollowsPcurve`, `PcurveGap`, `UvGap`.

`ImagePoints` is defined as the pcurve evaluated at `t_i`, and the law compares it with the pcurve
evaluated at `t_i`. The gap is zero by construction. `UvGap` is also a Euclidean norm of
`(du, dv)` over radians and millimetres, compared with one scalar (the floor). That contradicts layer
0 decision 4, which measures `uv` with a box because the two directions carry different units. Fix:
delete the law. The substantive claim is `Law_ImagePointReevaluates` plus a same-parameter law (M3).

### F10. `Law_TangentialPartialVanishesOnDegenerateSide` is false for toleranced collapses

`01-geometry/geometry.laws.plato`. The law compares "the speed along the side times the side's
parameter length" with `Length`. For a spline side that collapses only within the tolerance, the speed
need not be small. Take a degree-1 row of 10 uniform spans whose control points alternate between two
points `delta = Length` apart: the speed is `10 delta`, and the product is `10 Length`. For exact
collapses the law adds nothing to `Law_CollapsedLineIsOnePoint`. Fix: drop it for spline and
revolution sides, or bound the length of the control polygon instead.

### F11. The exclusion zone around collapsed lines is the parameter floor

`01-geometry/geometry.laws.plato`, `IsNearCollapsed`, used by `Law_NormalIsUnit`,
`Law_NormalOrthogonalToPartial` and `Law_AreaElementPositiveAwayFromCollapse`.

This is a parameter tolerance used exactly where the metric degenerates. Next to a collapsed B-spline
side at `dv = 2e-9`, the partial along the side is about `dv |dP|`, while its rounding is about
`u |P|`. With `|P| = 1e5` the relative error is about 5e-3, so the normal laws (angle tolerance 1e-9)
fail on a correct implementation. Fix: drop the floor-sized zone and add a rounding term to the
bound instead. The normal's angle error is about the relative error of the smaller partial,
`ResolutionAt(M) / (|S_x| s_x)` with `s_x` that direction's parameter scale, which is the same form
the derivative laws already use.

### F12. Smaller items

- `05-face-meshing/README.md`, open item 3, says the mean-speed region tolerance makes separation
  "judged a little strictly" near a pole. A smaller tolerance passes the test "farther than `tol`"
  more often, so separation is judged leniently there.
- `01-geometry/geometry.spec.plato`, `spec Eval(g, s, uv)`, builds `ParameterTolerance(0.0)`, and
  `06-mesh/mesh-measures.spec.plato`, `DiscreteGaussBonnet`, builds `LengthTolerance(0.0)`. Both break
  layer 0's invariant that a tolerance is at least the smallest normal number. Write the containment
  without a tolerance, and write "smallest altitude > 0".
- `01-geometry`, `spec ProjectNear` ensures `result == NearestUnwrapped(result, seed)`. That is an exact
  `==` on a computed value; `seed + ShortestDifference(seed, x)` is not bitwise `x`.
- `02-topology`, `Law_SeamUsesRunOpposite`: its name says "in one face"; its statement says "run
  opposite". Within a shell it repeats `Law_EdgeUsesHaveOppositeOrientation`.

## 2. Missing laws

### Topology

- **M1. `Law_ShellIsConnected` (layer 2) is necessary, not diagnostic.** The layer 2 README says the
  global laws "would add the diagnosis". That is true for orientability, not for connectivity. A
  closed shell holding a sphere's faces and a torus's faces has `chi = 2 + 0 = 2`, so every edge is
  used twice, every link is one cycle, and Euler-Poincare passes with genus 0. Two tori in one shell
  give 0 and pass as one torus. ISO 10303-42 requires a connected shell. State the law with a
  union-find over faces joined by edges.
- **M2. Open shells.** There is no vertex condition for open shells ("one cycle or one path", research
  2.2), and no open-shell Euler law (`chi + B` even and at most 2, research 1.4). `B` is a walk over
  the free edges, which `FreeEdgeCount` already enumerates.
- **M3. Pcurve coupling.** Missing: the reverse point-set direction (curve on pcurve), agreement of
  the tangents' senses, that a pcurve's surface is the surface of a face citing the edge, and
  `Law_PcurveSharesCurveParameter`: `|S(q(t)) - c(t)| <= epsL` at the edge's discretization
  parameters. Layer 4's `ImagePoints` relies on that last property, and nothing states it.

### Geometry

- **M4. Executable inverse evaluation at points off the curve or surface.** The contracts of
  `ClosestParameter` and `Project` state global minimality with `forall s`, and no law tests it. The
  existing `Law_*Recovers*` laws test only points on the curve, which is the easy case. Add
  `Law_ClosestParameterNoWorseThanSample(g, c, p, s)`:
  `|C(t*) - p| <= |C(s) - p| + ResolutionAt(M)`. Add the surface form, and a stationarity law
  `(C(t*) - p) . C'(t*) = 0` at interior minimizers. Vertices and edge samples sit up to `epsL` off
  the curve or surface, so this is the path the pipeline actually takes.

### Discretization and face meshing

- **M5. Boundary conformity of the triangulation.** Every boundary segment of the region should be an
  edge of exactly one element, traversed in the boundary's direction, and every interior edge an edge
  of exactly two elements, traversed opposite ways. No law states this. `Law_TriangulationKeepsBoundary`
  keeps the boundary points but not the segments. Theorem `DroppedTrianglesArePoleSegments` assumes the
  property ("each boundary segment belongs to exactly one triangle"), and it is what makes tiling
  provable (H6).
- **M6. Coverage from the surface to the mesh.** `ElementDeviation` measures from the mesh to the
  surface only. Add, per element: for samples `p` inside the element's parameter triangle,
  `dist(S(p), flat element) <= SurfaceChordal + epsL`. That is an exact point-to-triangle distance,
  cheap, and the other half of the Hausdorff distance.
- **M7. Pole collapse decided by combinatorics.** `Lift` drops "triangles with two corners on one
  collapsed line", which is a geometric test, while vertices are identified by `IdentifiedSources`,
  which is combinatorial. The two agree only when every point on a collapsed line is identified with
  every other. State: an element is dropped exactly when two of its corners have the same local vertex.
- **M8. `Law_SeamUsesOnOppositeCopies`.** The two uses of a model seam in a region lie one period
  apart, and the use with the face on its left at the larger chart coordinate is the one traversed
  upward (F1). Today only synthetic cuts have a law (`Law_SeamCutCopiesRunOpposite`).

### Mesh

- **M9. A cellular provenance law.** The layer 6 README says "the map is cellular", but no law states
  it. Every corner of an element of face `f` should have provenance `OnFace(f)`, `OnEdge(e)` with `e`
  cited by `f`, or `OnVertex(v)` with `v` on `f`'s bounds.
- **M10. Counts per shell.** Layer 6 counts per connected component only. The Euler identity with the
  B-rep needs counts restricted to a shell's elements (section 6).
- **M11. `Law_VectorAreaVanishes`** is left open "for want of a tolerance". A rigorous a-priori bound
  exists, `gamma_k sum_i |b_i - a_i| |c_i - a_i|` with `k` about `4 + log2 N` under pairwise summation,
  so the law can be stated.

## 3. Cross-layer consistency

- **C1. Closure is promised in layer 1 and honoured nowhere above it.** The layer 1 README says face
  meshing "treats a closed direction as a seam either way, with the range's length as the period, and
  wraps a parameter into the range before evaluating an aperiodic one". No file in layers 2, 4, 5 or 6
  calls `IsClosedIn` or `IsClosed(curve)` (checked by search). `Wrap`, `Unwrap`, `Winding`,
  `SameParameter` and `EdgeDomain` read only `Periodicity`. STEP has no periodic B-spline surface, so
  every B-spline face that a CAD system wraps into a cylinder is clamped and aperiodic. On such a face
  the seam's samples have two global minimizers (`u = k_start` and `u = k_end`). Nearest-copy
  unwrapping does nothing on an aperiodic direction, so the loop zig-zags, a blocking request follows,
  and refinement cannot clear it. A band between two closed B-spline edges gets no cut (`Winding = 0`).
  An edge that crosses a closed curve's join gets the complementary arc (F4c). Fix: see T1.
- **C2. Three meanings of the parameter tolerance.** Layers 1, 2 and 4 use the model-wide floor; layers
  0 and 1 and layer 5's `PointTolerance` use the per-point box; layer 5's `RegionTolerance` uses a
  per-face mean speed. Layer 4's Euclidean `UvGap` against the floor (F9) and layer 1's floor-sized
  exclusion zone (F11) are the two that are wrong. The floor itself mixes units:
  `ParameterFloor = max(L / max(modelSize, 1), ...)` is dimensionless for an angle parameter and a
  length for a length parameter. The `max(., 1)` makes it depend on the length unit: a 100 mm part
  with `L = 1e-4` mm has a floor of `1e-6`; the same part in metres has `1e-7`. So the metamorphic law
  "scaling by `2^k` changes nothing" (research 6.4) fails wherever the floor decides. Fix: one floor
  per direction, `L / speed bound` (`L / modelSize` for an angle, `L` for a unit-speed length), and a
  box for every `uv` comparison.
- **C3. `NormalAgreesWithParameterization`** is declared bodiless in layer 2 (`belongs-in: 01`) with a
  contract of constant sign, and with a body in layer 1 that breaks that contract on a `Full` spindle
  torus and on mirrored frames (F2, F3). The two declarations have the same signature.
- **C4. `IsClosedEdge` and `IsDegenerateEdge` mean different things in layers 2 and 4**, with the same
  signatures. Layer 2: `Start == End`, and "within `epsL` of the Start vertex". Layer 4: `Start == End`
  and not degenerate, and "within `epsL` of one point". Layer 2's `EdgeDomain` gives a degenerate
  closed edge a full period; layer 4 gives it one segment. Fix: keep layer 2's declarations, and rename
  layer 4's to `IsClosedRegularEdge`.
- **C5. The pcurve parameter is treated three ways.** Layer 1 decision 8: pcurve and curve agree only
  as point sets. Layer 4's `ImagePoints` evaluates the pcurve at the curve's `t_i`, which assumes the
  same parameter. Layer 5's `LoopToUv` uses the pcurve at its own `ClosestParameter`, or projects, and
  always projects seams. So layer 4 certifies the image chords of a polygon that layer 5 never
  triangulates. Fix: one image function used by both layers, its route chosen by M3's same-parameter
  law.
- **C6. Layer 5 does not apply layer 2's vertex-loop reduction.** Sphere B has vertex loops on the
  seam's pole vertices. Layer 2 drops them as harmless for counting. Layer 5 expands each into a full
  pole segment (`AddMissingSeamsAndPoles`) next to the seam loop's own pole segment. They overlap, the
  region is not simple, and the face is never meshed. Fix: apply `ReducedCounts`' rule 2 (drop a vertex
  loop whose vertex lies on another bound of the face) before building the region.
- **C7. The pole segment in layers 5 and 6** is consistent: one local vertex per pole, which is the
  model vertex when the segment touches a `FromVertex` point and otherwise `OnFace`. The exception is
  M7's mismatch between the geometric drop test and the combinatorial identification.
- **C8. `SamplePlan.Count`** counts both ends in layer 0 (`Count >= 2`) and only interior samples in
  layer 4 (`j / (k + 1)`). It is one type with two meanings.
- **C9. `Check` against per-point bounds.** Layer 0 makes the parameter tolerance per point, but
  `Check` stores no bound. `WorseOf` compares raw `Worst` values across samples whose bounds differ,
  and `SeverityOf` is computed against the single bound passed to `ReportOf`. The fold can pick a
  sample that is not the worst exceedance and assign the wrong severity. Fix: store `Worst` as
  measure divided by bound (bound 1), or add `Bound` to `Check`. Either one also makes F7's
  `Law_HoldingCheckIsWithinBound` true.
- **C10. Duplicate `belongs-in` declarations** with the same meaning: `PcurvesOf` and
  `Eval(Curve2DIndex)` (layer 1 with bodies, layer 4 without), `IntegerTotal` (layers 3 and 6,
  identical), `IsOnFace` (layer 6) and `IsFaceInteriorProvenance` (layer 5). `UnboundedDomain` (layer 1
  for layer 0) agrees with layer 0's `IsProper`, which rejects it, but meets F8.
- **C11. `Segments` and `SegmentFloors` (layers 4 and 5)** are consistent as lower bounds combined by
  maximum. A quad grid needs equal counts, which is reached because counts only rise to the maximum of
  each equality class of edges. That converges within the number of edges in the class. State it as a
  theorem, so that `MaxRefinementRounds` can be chosen from it, and name the owner who turns requests
  into floors (layer 5, open item 6).

## 4. Timid choices

- **T1. A `Closed(Period)` periodicity.** Layer 1 decision 5 rejects treating closed curves as
  periodic because `Domain` has no tolerance. Layer 3 has one. Decide closure once at decode
  (`IsClosed`, `IsClosedIn`), store it as a third periodicity case (the point set wraps, the
  derivatives need not), make the join a breakpoint, and let every wrap, unwrap, winding and edge-domain
  function read it. This one case fixes C1 and F4c.
- **T2. Rational spans have a certificate.** Layer 4's README says "Rational B-spline spans have no
  certificate". A rational Bezier span with positive weights lies in the convex hull of its control
  points. Distance to a segment is convex, so its maximum over the hull is reached at a control point,
  and the largest control-point distance to the chord bounds the sagitta. research/VALIDATION-MATH.md
  6.3 says so, and it is right. With this, `Law_SagittaWithinChordal` holds by construction for every
  NURBS edge, not only the polynomial ones.
- **T3. Connectivity and orientability by search.** These are a union-find and a parity search over
  faces, both linear. Connectivity is necessary (M1).
- **T4. Store the bound in `Check`** (C9). It turns "a holding check is within its bound" into a type
  invariant instead of a convention.
- **T5. `ProjectNear` should keep the seed's coordinate where the point determines none** (at a pole or
  on an axis). That is what a local inverse is. It removes the "free parameter from the neighbour"
  special cases in layers 4 and 5 and their exemptions in the laws.
- **T6. Conjectures the mathematics settles.** `CentralDifferenceStepSuffices` is replaced by F5's
  Richardson law. `ElementsTileRegion` becomes a theorem once M5 is a law (H6).
  `NormalTurnBoundsCentroidDeviation` is false (H7).
- **T7. Exact deviation oracles.** research/VALIDATION-MATH.md 5.8 gives exact element-to-surface
  deviation on planes, cylinders and spheres (`R - dist(c, triangle)`). Using them makes
  `Law_ElementDeviationWithinSurfaceChordal` exact on most faces of a building model at no extra cost.
- **T8. Use the per-point tolerance that already exists.** Layer 2 open item 6 and layer 4 open items
  wait for a per-point tolerance that layer 1 already declares (`ParameterToleranceAt(g, c, t, tol)`).
- **T9. Store edge and pcurve ranges at decode** (layer 2 open item 7), with a law tying them to the
  rule. That removes the repeated inverse evaluation and gives F4b's pcurve range one definition.

## 5. Theorems and conjectures

| Theorem | Verdict |
|---|---|
| L0 `CoincidenceIsNotTransitive`, `CoincidenceChainBound`, `WrapIsTheCanonicalRepresentative`, `ReportsFormAMonoid`, `IsCleanIsAMonoidHomomorphism` | Sound. The chain bound is right because floating-point subtraction rounds relative to the difference. |
| L0 `ParameterToleranceBoundsMotion` | The conclusion is only the arithmetic inequality; the motion claim is in `because`, not in `conclude`. Sound as stated, weaker than its name. |
| L0 `UvToleranceBoundsMotion` | Sound; it has no `tested by`, and `Law_ParameterToleranceAtMovesWithinLength`, applied per direction, would serve. |
| L0 `WorseOfFoldIsWellDefined` | Sound: the leftmost greatest element under a total preorder does not depend on grouping. Its premise that `Worst` values are comparable fails under per-point bounds (C9). |
| L1 `EvaluationTerminates`, `DepthBelowFuelIffAcyclic`, `KnotMultiplicityWindow`, `SphereAreaElement`, `TorusAreaElement` | Sound. |
| L1 `ConeAreaElement` | Sound; it needs the hypothesis `0 < a < pi/2`, because `1 / cos a` uses it. |
| L1 `LemonNormalOpposesParameterization` | Sound. Its argument also proves F3: the `Full` torus with `major < minor` has the same sign change. |
| L1 `TangentialPartialVanishesOnCollapsedLine` | Sound for exact collapses (F10 covers the toleranced law). |
| L1 `ProjectNearIsLocalInverse` | True but trivial: Newton started at the exact preimage stays there. `Law_ProjectNearRecoversParameter` seeds at the answer. A meaningful test seeds at a perturbed `uv` inside the injectivity radius. |
| **H1** L1 conjecture `CentralDifferenceStepSuffices` | **False.** It is refuted by the quadratic B-spline at a simple knot (`1.1e-4` against `1.3e-7`), and by the circle through the origin at an angle tolerance of 1e-12 (F5). |
| L2 `ReducedCountsEqualRawOnCleanShell` | Sound. |
| L2 `EdgeDomainEndsFollowFromVertexOnCurve` | Sound for the cases it covers. The excluded case is a defect to fix (F4c), not a hypothesis. |
| L2 `ClosedOrientableShellHasEvenEuler` | Sound, including the parity argument for faces with handles (`2(k - 1) - 2h` is even). The tests are adequate. |
| L3 `ProvenanceIsBijection`, `CountsFollowFromProvenance` | Sound. |
| L3 `FoldingKeepsFaceRegions` | Sound for point sets. The README's corollary "every normal points out of the material" is false for mirrored analytic faces (F2). |
| L4 `SharedPolylineClosesEveryEdge`, `ChordalRefinementIsMonotone` (at a fixed count the image criterion is monotone in the bound), `EdgeReversalInvariance` | Sound. |
| L4 `TurningAngleBoundedByTangentDeviation` | It needs regularity (`|C'| > 0` on the closed span). Coincident control points make a cusp inside a span, where "not a seed" does not imply a continuous tangent. |
| L4 `DiscretizeTerminates` | Sound if splits made for the image criterion also respect `MinLength`; state it in `Discretize`'s contract. |
| **H5** L5 `ChartWindingIsFaceWinding` | **False.** The `O(h^3)` term can dominate. On the unit sphere, the parameter triangle `(0, 0.5)`, `(0.2, 0.5)`, `(0.1, 0.5001)` has chart area `+1e-5`, spans 0.2 rad, and touches no pole, yet its flat normal is 2.05 rad (117 degrees) from the face normal. Its height (`1e-4`) is below the sagitta of its long edge (`3.8e-3`). It needs a shape hypothesis, such as `kappa_max * l_max < sin(theta_min)`, or the conclusion should become a postcondition `RefineToSurface` enforces. |
| L5 `SharedEdgePositionsAgree` | Sound. |
| L5 `DroppedTrianglesArePoleSegments` | Sound given M5, which it assumes silently. |
| **H6** L5 conjecture `ElementsTileRegion` | **False as stated:** a unit square triangulated by `ABC` and `ABD` keeps every boundary point, has two positive triangles, and has areas summing to exactly 1, but `(0.2, 0.9)` is in neither. **True with M5:** positive triangles whose boundary edges are the region's boundary cycle once, with interior edges paired opposite, form a 2-chain with boundary `dP`. The number of triangles over a point equals the winding number of `dP` about it, which is 1 inside the region. |
| **H7** L5 conjecture `NormalTurnBoundsCentroidDeviation` | **False:** the same sliver has normal turns of 0.175, 0.088 and 0.088 rad along its edges and a flat-normal deviation of 2.05 rad. Its maximum distance from the sphere is `3.8e-3`. The README's argument ("both lie in the cone spanned by the corner normals") fails for the flat normal of a sliver. |
| L6 `WatertightByNumbering`, `SharedSamplesShareAnIndex`, `NumberedSitesHaveDistinctIndices`, `EveryIndexHasASite`, `MixedGaussBonnet`, `SignedVolumeSignIsOrientation`, `ClosedOrientedSurfacesHaveAGenus`, `RadiusRatioIsAtLeastOne`, `AspectRatioIsAtLeastOne` (the constants were checked) | Sound. |
| L6 `DiscreteGaussBonnet` | Sound; `LengthTolerance(0.0)` in its assumption is ill-formed (F12). |

## 6. The counting rule

`ReducedCounts` (layer 2) was checked against every worked example of research/VALIDATION-MATH.md 1.5
and four boundary cases, with `chi = V - E + 2F - L` against `2(S - G)` (script `counts.py`). Every
reduced row matches: box 2, cylinder with a seam 2, cylinder band 2, spheres A, B (reduced), C
(reduced), D and E 2, torus 0, cone (all five encodings, the degenerate apex reduced) 2, block with a
square or round through hole 0, and each hollow-box shell 2. The raw rows that the reduction exists to
repair give 0 (sphere B), 0 (sphere C) and 1 (cone with a degenerate apex edge). Boundary cases: a
torus face bounded only by one meridian gives 1, which is odd, so `Law_EulerPoincareEvenAndBounded`
correctly rejects the face's handle. A sphere face with no bound gives `2F - L = 2`, which is correct,
and `Law_AtLeastOneBound` reports it. A single-face open shell gives 1. An empty closed shell gives 0
and passes.

The mesh side, layer 6, computes `V - E + T + Q` per connected component. Research 4.4's refinement
argument (each counted edge cut into `k` segments contributes -1, each face triangulation contributes
`chi_c = 1 - r`) carries over term by term, given what layers 3, 5 and 6 already do. A closed
degenerate edge yields a side whose two ends are one vertex, which the edge table does not count. An
open degenerate edge is merged at decode. A point hole becomes a triangulation corner, adding 1 to `V`
on both sides. Pole-collapsed triangles are dropped, which preserves `chi` (`-k + 2k - k = 0` for a pole
segment of `k` segments).

**Can `Law_MeshEulerEqualsBrepEuler` hold under both definitions?** Yes, for every legitimate encoding
above, on three conditions.

1. Compare per shell by restricting the mesh to the elements whose `ElementFace` belongs to the shell
   and the vertices they reference, not per layer 6 component. Two shells of a `ShellSet` may share
   edges (layer 2 decision 6), and layer 6 numbers every model vertex, including vertices of other
   shells and unreferenced ones.
2. Fix C6, or sphere B never produces a mesh.
3. Fix F1 and C1, or sphere A, the seamed cone and every closed B-spline face produce no mesh.

The law fails exactly where the B-rep breaks ISO's "no handles in a face": the boundless torus face
counts 2 against the mesh's 0. That is a strength, because `Law_EulerPoincareEvenAndBounded` passes on
it.

## 7. What is well done

- Layer 0's per-point parameter tolerance with a floor and a cap, `ResolutionAt` as the one rounding
  bound, the error analysis checked by a fuzzer, and the exact half-period test.
- Layer 2's counting rule, the sense composition as a product of signs, and per-shell laws. Its
  rejection of the research's `Law_EulerPoincareMatchesGenus` (a law with a free genus is false for
  most values) is right, and so is the even-parity theorem.
- Layer 3's folding as a product that keeps `f * b` invariant, and the decode as a total extension of
  an exact partial function.
- Layer 4's canonical direction with `Reversed` by copy, nested bisection, termination by `MinLength`,
  and the monotonicity argument on the closed-form path for conics.
- Layer 5's poles as blown-up segments, the orientation chart, blocking against advisory requests, and
  the correct rejection of `Law_FaceFlipReversesWinding`.
- Layer 6's numbering by site with no welding, corner attributes, CSR offsets, quality identities on
  stdlib shapes, and the signed volume about the bounding-box centre.
- Layer 1's axial cone `v`, the lemon normal, and the correction of the brief's "both partials vanish".

## Ranked findings

1. F1: model seams placed by continuity collapse to a zero-width slit at poles and apexes, so the sphere and cone witnesses never mesh; use the left rule.
2. C1/T1: closed but aperiodic directions are ignored above layer 1, so closed B-spline faces zig-zag, bands get no cut, and arcs come out complementary; add `Closed(Period)`.
3. F2/F3: mirrored frames and `Full` spindle tori give the wrong face normal sign; make the kernel normal `<S_u x S_v>` and fold every sense difference into `SameSense`.
4. F4: the closed-edge rule produces unbounded pcurve ranges (cylinder circle with a line pcurve), and pcurve inversion has many answers.
5. H5/H7: the chart-winding theorem and the turn conjecture are false (a 117-degree fold with turns at most 0.18 rad); enforce element orientation, do not derive it.
6. M1: without `Law_ShellIsConnected`, a sphere plus a torus in one closed shell passes every law as genus 0.
7. F5/H1: the derivative laws miss knots of multiplicity `p - 1` (error `1.1e-4` against a bound of `1.3e-7`) and use the model's angle tolerance as an error bound.
8. F6: the resolvability floor is taken at the model size; at survey coordinates of 5e9 mm, a 1e-6 mm tolerance of one `ulp` passes.
9. M5/H6: the triangulation has no boundary-conformity law; tiling is false without it and a theorem with it.
10. F7/C9: rounding laws judged by model tolerances (the arc-cosine normal law fails 33% of self-comparisons; the area-sum law is false), and `Check` lacks the bound that per-point tolerances need.

## Count of findings per heading

| Heading | Findings |
|---|---|
| 1. False or imprecise laws | 12 (F1 to F12; F12 groups 4 small items) |
| 2. Missing laws | 11 (M1 to M11) |
| 3. Cross-layer consistency | 11 (C1 to C11) |
| 4. Timid choices | 9 (T1 to T9) |
| 5. Theorems | 4 refuted or false (H1, H5, H6, H7) and 7 needing a hypothesis or restatement, among 44 theorems and conjectures read |
| 6. The counting rule | the reduction is correct on all 19 worked examples and 4 boundary cases; the mesh identity holds under 3 stated conditions |
| 7. What is well done | 7 items |
