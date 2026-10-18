# Layer 1: geometry

The exact curves and surfaces of ISO 10303-42 that a STEP B-rep names, as closed sums held in one
flat arena (`GeometrySet`), with their natural parameterizations, derivatives, normals, area
elements, and inverse evaluation, and the laws that bind them. Layers 2 (topology), 4 (edge
discretization), 5 (face meshing) and 7 (validation) evaluate through this layer and nothing
else. Written 2026-10-17 against [VOCABULARY.md](../VOCABULARY.md) revision 2 and the layer 0
files present that day.

## Files

| File | Holds | Block |
|---|---|---|
| `geometry-curves.types.plato` | `BrepCurve`, `BrepCurve2D`, `CompositeSegment`, `CompositeSegment2D`, `CurveSupport`, `PreferredRepresentation`, `Pcurve` | |
| `geometry-surfaces.types.plato` | `BrepSurface`, `TorusPart`, `SurfaceParameter` | |
| `geometry-splines.types.plato` | `SplineBasis`, `BSplineCurveData`, `BSplineCurve2DData`, `BSplineSurfaceData` | |
| `geometry-set.types.plato` | `GeometrySet` and the views `ArenaCurve`, `ArenaCurve2D`, `ArenaSurface` | |
| `geometry.concepts.plato` | `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface` | |
| `geometry.library.plato` | the arena: index ranges, accessors, reference graph, well-formedness, placements, piece arithmetic, views, defining points | `BrepGeometry` |
| `geometry-curves.library.plato` | space curves, parameter-plane curves, pcurves | `BrepGeometryCurves` |
| `geometry-surfaces.library.plato` | surfaces | `BrepGeometrySurfaces` |
| `geometry-scaling.library.plato` | the arena scaled about the origin: `ScaledCurve`, `ScaledSurface`, `ScaledPcurve`, `ParameterScaleFactor`, `ScaledGeometry` | `BrepGeometryScaling` |
| `geometry-motion.library.plato` | the arena carried by a rigid motion: `MovedVector`, `MovedDirection`, `MovedFrame`, `Moved` (curve, surface), `MovedGeometry` (from layer 2 in the name review) | `BrepGeometryMotion` |
| `geometry-splines.library.plato` | spline domains, shape predicates, breakpoints; de Boor deferred | `BrepGeometrySplines` |
| `geometry.laws.plato` | 95 laws, 3 oracles, their helpers and measures | `BrepGeometryLaws` |
| `geometry.spec.plato` | invariants, contracts, theorems (SPEC-DSL.md section 3 only) | |

Counts after the fix wave: 19 types, 3 interfaces, 262 library functions (244 with a body, 18
deferred), 95 laws, 46 `spec` blocks, 10 theorems and no conjecture.

## The objects

**A curve is a map from a domain.** A `BrepCurve` is a map `C: D -> R^3`; a `BrepCurve2D` is a map
into one surface's parameter plane. `D` is a `CurveDomain`: an interval of the real line and a
periodicity. Each case is one formula (`Line` is `P + t V`, `Circle` is `C + R (cos t x + sin t y)`,
and so on), written in the curve's *natural* parameter: radians for an angle, model length units
for a length, the knot value for a spline. Nothing is rescaled to `[0, 1]`; that is what STEP's
trims, pcurves and seams are written in.

**Periodicity is a quotient.** A domain is `Periodic(P)` when the formula satisfies
`C(t + P) = C(t)` for every real `t`, so the map factors through the circle `R / PZ`. The domain's
range is then one fundamental window, `[0, 2 pi]` for every angle here, and any real `t` may be
evaluated; layer 0's `Wrap` and `NearestUnwrapped` are the section and the path lifting of that
quotient. An aperiodic domain is a closed interval, possibly the whole line (layer 0's `UnboundedDomain`,
ends at `Number.MinValue` and `Number.MaxValue`, so `ParameterLength` is infinite).

**Closure is not periodicity, and both are in the domain.** A bounded curve is *closed* when its two
ends coincide. Periodic implies closed. Closed does not imply periodic: a clamped B-spline whose
first and last control points coincide is closed, yet its derivative may jump at the join, and
evaluation outside its knot span is undefined (ISO 10303-42 4.5.34). Layer 0's `Periodicity` has
three cases: `Periodic` (the formula wraps: conics and every angle parameter), `Closed` (the point
set wraps, the formula does not: a closed clamped spline, a polyline back at its start, a
composite that closes), and `Aperiodic`. `HasSeam` is true for the first two, and every
seam, unwrapping, winding and edge-domain decision above this layer reads it (review C1, T1).
Layer 3 decides closure at decode, from end coincidence within the length tolerance, and records
each decision as a `ClosureMark` in `GeometrySet.Closures` (a curve, a parameter-plane curve, or
one direction of a surface); `Domain` reads the record's natural domain and makes a marked bounded
aperiodic direction `Closed` (`WithClosure`), without a tolerance. A surface is closed in a parameter (`IsClosedIn`) when its domain has a seam
in it or its two opposite sides are the same curve within tolerance. A closed direction has no
degenerate sides; a trim across a closed basis's join is wrapped into the basis's range
(`BasisParameter`, `TrimmedToBasis`) before it is evaluated.

**A surface is a map from a rectangle.** A `BrepSurface` is `S: D_u x D_v -> R^3`, each direction a
`CurveDomain`. A cylinder's domain is a circle times a line, a torus's a circle times a circle.
Placement-based cases carry a `Frame3D`; the stdlib's `Plane`, `Cylinder`, `Cone`, `Sphere`,
`Torus` types are not reused because they are finite or unit-square parameterized.

**A degenerate side is a collapse of the map.** An iso-line, one parameter held at `c` and the
other varying, may be sent to a single point: `S(u, pi/2)` is the sphere's north pole for every
`u`. `CollapsedAt(g, s, which, tol)` lists those values `c`; `DegenerateSides(g, s, tol)` lists the
sides of the natural domain that lie on one. Along a collapsed line the partial *along* it
vanishes; the partial *across* it does not (at a sphere's pole `S_v = -R e_r(u)`, a different
vector for each `u`), which is why a pole has one point and a fan of tangents. A cone's apex
`v = -R / tan a` lies inside its domain, because ISO's cone covers both nappes, so it is a
collapsed line and not a side.

**Normal, area element, metric.** `PartialU` and `PartialV` are the columns of the Jacobian. The
area element `|S_u x S_v|` is the factor by which the map scales parameter area; a face's area is
its integral over the face's parameter region (layer 7's Green oracle integrates it).
`NormalOr` returns ISO's stated normal, which is `<S_u x S_v>` except on the part of a torus
inside its axis (the lemon), where ISO states the opposite (4.5.64 NOTE 1);
`NormalAgreesWithParameterization` records which. The per-point parameter tolerance is the
length tolerance pulled back through the partials (layer 0's `ParameterToleranceAt`,
`UvToleranceAt`); this layer exposes the per-point forms because it alone has the derivatives.

**Inverse evaluation.** `ClosestParameter` on a curve and `Project` on a surface return a global
minimizer of the distance to a point, in the canonical window of every periodic direction.
Edge ranges are not in a STEP file (layer 2 derives them by `ClosestParameter` of the vertices),
and most exporters write no pcurves, so both are on the main path, not fallbacks. `ProjectNear`
is the local inverse from a seed, which face meshing uses along an edge so that continuity picks
the root and no unwrapping is needed.

**The arena.** `GeometrySet` holds four tables and the closure marks; a case built on another curve or surface names it
by index. The references form a graph; evaluation recurses along it and terminates because a
well-formed arena's graph has no cycle (`IsWellFormed`, theorem `EvaluationTerminates`).

## Natural parameterizations

`C, x, y, z` are the placement's origin and axes, `e_r(u) = cos u x + sin u y`, `rho` the distance
term named in the row. "Collapsed" lists `CollapsedAt`; "sides" lists `DegenerateSides`.

| Case | Formula | Domain, period | Collapsed (sides) | `h = |S_u x S_v|` |
|---|---|---|---|---|
| Curve `Line` | `P + t V` (V not unit) | line | | |
| Curve `Circle` | `C + R e_r(t)` | `[0, 2pi]`, `2pi` | | |
| Curve `Ellipse` | `C + R1 cos t x + R2 sin t y` | `[0, 2pi]`, `2pi` | | |
| Curve `Hyperbola` | `C + R1 cosh t x + R2 sinh t y` | line | | |
| Curve `Parabola` | `C + F (t^2 x + 2t y)` | line | | |
| Curve `Polyline` | segment `i` on `[i, i+1]` | `[0, n-1]` | | |
| Curve `BSpline` | `sum w N P / sum w N` | `[k_d, k_n]` | | |
| Curve `Trimmed` | `B(a + s)` or `B(b - s)` | `[0, b - a]` | | |
| Curve `Composite` | segments end to end by parametric length | `[0, sum]` | | |
| Curve `Offset` | `B(t) + d <v x B'(t)>` | the basis's | | |
| Curve `OnSurface` | the master: space curve or `S(f(t))` | the master's | | |
| `Plane` | `C + u x + v y` | line x line | none | `1` |
| `Cylinder` | `C + R e_r(u) + v z` | `2pi` x line | none | `R` |
| `Cone` | `C + (R + v tan a) e_r(u) + v z`, v axial | `2pi` x line | `v = -R/tan a` (interior) | `|R + v tan a| / cos a` |
| `Sphere` | `C + R cos v e_r(u) + R sin v z` | `2pi` x `[-pi/2, pi/2]` | `v = +-pi/2` (VMin, VMax) | `R^2 cos v` |
| `Torus`, `Full` | `C + (R + r cos v) e_r(u) + r sin v z` | `2pi` x `2pi` | none if `R > r`; `pi` if `R = r`; `phi, 2pi - phi` if `R < r` (interior) | `r |R + r cos v|` |
| `Torus`, `Apple` | as `Full`, `r cos phi = -R` | `2pi` x `[-phi, phi]` | both ends (VMin, VMax) | as `Full` |
| `Torus`, `Lemon` | as `Full` | `2pi` x `[phi, 2pi - phi]` | both ends (VMin, VMax) | as `Full` |
| `Revolution` | `L(v)` rotated by `u` about the unit axis | `2pi` x profile's | profile ends on the axis | `|(A x (L - C)) x L'|` |
| `LinearExtrusion` | `L(u) + v V` (V not unit) | profile's x line | none | `|L'(u) x V|` |
| `BSpline` | tensor product | knot spans | sides whose control row collapses | cross product |
| `RectangularTrimmed` | basis at `(u1 + s or u2 - s, v1 + t or v2 - t)` | `[0, |u2-u1|]` x `[0, |v2-v1|]` | basis's, inside the box | basis's |
| `Offset` | `B + d N_B` | basis's | basis's | cross product |

The cone's `v` is axial, as ISO 10303-42 4.5.61 states; OpenCascade's cone measures slant length
and rescales pcurve `v` by `1 / cos a` on import. The consequence is the `1 / cos a` in `h`, and
in `Project`'s closed form the foot `v = cos^2 a (z + tan a (r - R))` on the ruling, both written
for the axial `v`.

## Decisions and reasons

1. **One `BSpline` case, weights always present.** A rational and a polynomial spline are one
   formula, `sum w N P / sum w N`, which reduces to the polynomial one when the weights are equal
   (ISO 4.5.34 NOTE 2); two cases would double every match arm with no second formula. The cost is
   one number per control point. `IsPolynomial` tells layer 4 when a polynomial bound (Wang's
   formula) applies. Degree and knot vector form a `SplineBasis`, so a surface has one per
   parameter and the shape rules are written once.
2. **Hyperbola and Parabola are evaluated, not rejected.** Their formulas are one line each and
   their domains are the whole line, like `Line`; rejecting them would need a diagnostic path and
   lose data an `advanced_face` may legally hold (WR3 admits any conic). Their closest parameter
   goes through the general search.
3. **Offset is evaluated with deferred higher derivatives.** Offset curves and surfaces are not
   allowed in an `advanced_face` (AIC WR1, WR3) but occur in surface models and non-conforming
   files. Offset curve: `Eval` and `Derivative` are written (the derivative of the unit vector
   `<v x B'>` needs the basis's second derivative, which this layer exports); `SecondDerivative`
   is deferred. Offset surface: `Eval` is `B + d N_B` with `LimitNormal`, the basis normal
   extended by continuity (deferred); `NormalOr` is the basis normal; the partials (Weingarten
   equations) are deferred. A law that the offset stays regular (`1 + d k > 0`) needs principal
   curvatures and is left open.
4. **Composite segments chain by parametric length; `transition_code` is dropped.** Segment `i`
   spans `[sum of earlier lengths, plus its own]` and runs its curve by `SameSense` (ISO 4.5.44).
   The transition code claims a continuity the geometry can be checked for, so the kernel keeps
   none: `Law_CompositeSegmentsChain` checks positional continuity, `Breakpoints` lists every join
   so nothing differentiates across one, and closure is `IsClosed`. Layer 3 may compare the
   file's codes with the geometry and report a disagreement. A
   `reparametrised_composite_curve_segment` changes parameters, not the point set; layer 3 decodes
   it as a plain segment with a warning.
5. **Closure and periodicity are separate (above).** A closed, clamped B-spline is `Closed`, not
   `Periodic`: making it periodic, as OpenCascade does, would let `Eval` wrap into a region where
   the formula is not periodic in its derivatives. The decision needs a tolerance, which `Domain`
   has none of, so layer 3 makes it and records it in the arena (`ClosureMark`; fix wave, T1).
6. **`select_outer` lives in the torus payload as `TorusPart`.** The three parts share one
   formula, so the choice is a domain, not a case: `Full` (STEP `toroidal_surface`, any radii),
   `Apple` and `Lemon` (STEP `degenerate_toroidal_surface` with `select_outer` true and false).
   A sum rather than a Boolean because `Full` is a third value with its own domain, and a flag
   ignored for ring tori would be a field that means nothing in most values. `HasEvaluableShape`
   requires `major < minor` for the two spindle parts (the entity's WR1). A plain
   `toroidal_surface` with `major < minor` (a Unigraphics deviation) stays `Full`; it is
   self-intersecting, `IsInjectiveByConstruction` is false for it, and layer 3 reports it. Its
   normal is ISO's `<S_u x S_v>`, which is the closed form outside the axis and its negation inside
   (review F3), so `NormalAgreesWithParameterization` is true on all of it.
7. **`Trimmed` and `RectangularTrimmed` use ISO's reparameterization from 0.** The decoder stores
   the range forward (`[min, max]`, a period added on a periodic basis per 4.5.43 NOTE 1) and the
   sense apart; `SensedParameter` maps a trimmed parameter to the basis's. Edges rarely name a
   trimmed curve (not allowed in an `advanced_face`), and their ranges come from
   `ClosestParameter` anyway, so the choice matters for composite segments and surface models.
   For `RectangularTrimmed`, research/STEP-BREP-MODEL.md reads the clause both ways (section 3.5
   says from 0, section 5.2's table says basis terms); this layer takes the first, unconfirmed.
8. **The surface-curve case.** `OnSurface(Curve, Supports, Master)` keeps the space curve, one or
   two `CurveSupport`s (a pcurve, or only a surface: ACIS writes bare planes), and the master.
   Evaluation follows the master (ISO 4.2.6); when the master names an absent or bare support the
   space curve rules (`MasterPcurve`). The proposed `SurfaceCurveKind` is dropped: a seam is two
   pcurves on one surface, an intersection curve two supports on distinct surfaces, both derivable,
   and the survey shows seams recognized by topology, not entity type. Pcurve and space curve
   agree as point sets, not parameters: `Law_SurfaceCurvePcurveLiesOnCurve` and
   `Law_SurfaceCurveLiesOnPcurve` compare points through `ClosestParameter`, and
   `Law_SurfaceCurvePcurveSameSense` checks the sense (IP2).
9. **Range checking is a law of this layer.** The arena is this layer's, so
   `Law_*ReferencesInRange` and `IsEveryIndexInRange` live here; layer 2 checks only its own
   tables' references into the arena (an edge's curve, a face's surface).
10. **Acyclicity by a capped depth, not by index order.** References run between arenas (a surface
    of revolution names a curve; a surface curve names surfaces), so "every reference points to a
    lower index" cannot be stated across tables. `CurveDepth` and its siblings count the longest
    chain, capped at one more than the arena size; reaching the cap means a cycle (pigeonhole,
    theorem `DepthBelowFuelIffAcyclic`). Real files are trees of depth two or three.
11. **`ClosestParameter`'s representative.** In `[Range.Start, Range.Start + period)` on a periodic
    curve; `Range.Start` when a closed aperiodic curve's join is nearest (both ends map there);
    `0` on a circle's axis, where every parameter is equally near. Layer 2 must therefore take the
    end parameter of an edge ending at a closed curve's join as `Range.End`, and add a period on a
    periodic curve when the end parameter is not past the start. On a pcurve the representative is
    bounded even where the domain is not: with a parameter period `T` (`PcurveParameterPeriod`: a
    2D line along a periodic direction, `P / |V|`), the minimizer in `[0, T)`; otherwise the one of
    least magnitude. A pcurve's range over a stretch of its space curve is `PcurveRangeOver`, built
    from the space curve's range and `T`, never from the pcurve's own domain (review F4); layer 2's
    `PcurveEdgeDomain` can use it.
12. **`Project`'s representative and poles.** Each periodic coordinate is in the window. Where the
    point determines no value of one coordinate (on the axis of a surface of revolution, at a pole
    or apex) that coordinate is the window's start, `0`, exactly on the axis and arbitrary within
    the tolerance of it; the per-point tolerance there is the cap, so no law depends on it, and
    face meshing takes the coordinate from a neighbour (research/MESHING-REQUIREMENTS.md 4.2).
    `ProjectNear` keeps the seed's value of a coordinate the point does not determine
    (`KeepSeedWhereFree`), so face meshing needs no special case at a pole (review T5).
    Closed forms for the plane, cylinder, cone (both rulings in the meridian plane compared),
    sphere, and ring torus; a deferred search for the rest.
13. **`DegenerateSides` takes a tolerance.** A spline side collapses when its control row does,
    and a revolution profile ends on its axis, each within the length tolerance; the fixed
    signature had none (see "Changes to the contract").
14. **`NormalOr` uses closed forms where they exist.** They extend by continuity to a sphere's
    poles, so the fallback is taken only at a cone's apex and where the cross product of the
    partials is exactly zero (`TryFromVector`'s rule).
15. **Matches are on parameters.** Each arena function looks the record up with a typed accessor
    (`CurveAt`, `Curve2DAt`, `PcurveAt`, `SurfaceAt`) and passes it to the function of the same
    name over the record, which holds the exhaustive match. The gate showed why: the sum checker
    types a match subject that is an index expression as unknown, and a call subject only when the
    callee's library was compiled earlier in file order (both reproduced in probes). A parameter
    subject always works; the stdlib's `fields-graphs.library.plato` uses the same shape.
16. **Views implement the concepts.** An arena function's receiver is the arena, so it cannot
    discharge an interface whose receiver is the curve (PLATO-PRIMER.md A.3). `ArenaCurve`,
    `ArenaCurve2D`, `ArenaSurface` pair the arena with an index and implement `INaturalCurve3D`,
    `INaturalCurve2D`, `INaturalSurface` by delegation; a non-STEP geometry can implement them
    directly.
17. **Mirrored placements are legal, and the kernel normal follows the parameterization.** A
    `cartesian_transformation_operator` with a negative determinant gives a left-handed frame
    (research/STEP-BREP-MODEL.md 4.2). The placement laws accept either handedness, and
    `Handedness(f)` and `PlacementHandedness(g, s)` export the sign. On a mirrored frame
    `S_u x S_v` turns over while the frame's axes do not, so the closed-form normals multiply by
    the handedness: `NormalOr` is `eps <S_u x S_v>` on every surface and frame, `eps` from
    `NormalAgreesWithParameterization`. Mirroring then turns the kernel normal of a plane and of a
    B-spline alike, and layer 3's fold of the transform's determinant into the face's sense is right
    for both (review F2). `IsOrthonormalWithin(Frame3D)` stays right-handed: it is the test layers 7
    and 8 apply to rigid motions.

## How to read the contracts

- Every law over `GeometrySet` or a spline record is witness-only: the law runner cannot build
  values holding arrays (PLATO-PRIMER.md B.2). Witness models come from layer 7.
- A law's `tol: Tolerances` is the model's. In `geometry.spec.plato`, `forall (tol: Tolerances)`
  ranges over tolerances the arithmetic can honour at the arena's magnitudes (layer 0's
  `IsResolvable`); the DSL cannot name that magnitude, so this sentence carries the restriction.
- An `ensures` that compares distances without a tolerance (a global-minimizer inequality has one,
  `+ tol.Length.Value`) is a statement in exact arithmetic about the ideal function; theorems are
  likewise exact.
- Tolerances used: `Length` for points; the parameter floor of the parameter's kind
  (`ParameterFloorOf`, `ParameterFloorAlong`, `UvFloorOf`: layer 0's `AngleParameter` for an
  angle, `LengthParameter` otherwise), where a strict parameter comparison is meant (a range inside another, a side on a collapsed line); the per-point
  `ParameterToleranceAt` and `UvToleranceAt` where a parameter is recovered from a point;
  `Angle` for frames and transversality;
  layer 0's `ResolutionAt` at an `EvaluationMagnitude` (the size of the terms an evaluation sums,
  not of its result) for every law about this layer's own arithmetic.

## Laws

Severity follows SPEC-DSL.md section 4. "Library" laws test this layer's own formulas against an
independent route (a difference quotient, a cross product, an oracle); a failure is a defect in
the implementation, so `Error`. "File" laws test data a file supplied; an exact one is `Error`, a
toleranced one is `Warning` below ten times its tolerance and `Error` above.

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_CurveReferencesInRange`, `..2D..`, `Law_PcurveReferencesInRange`, `Law_SurfaceReferencesInRange` | every index a record holds names an arena entry | exact | Error |
| `Law_CurveReferencesAcyclic`, `..2D..`, `Law_SurfaceReferencesAcyclic` | no reference chain from the entry repeats an entry | exact | Error |
| `Law_CurveHasEvaluableShape`, `..2D..`, `Law_SurfaceHasEvaluableShape` | the record's arrays have the sizes its formula reads | exact | Error |
| `Law_CurvePlacementOrthonormal`, `..2D..`, `Law_SurfacePlacementOrthonormal` | placement frames orthonormal of either handedness (plane frames counter-clockwise); offset reference and revolution axis unit; measure `PlacementDeviation` | Angle | File, 10x |
| `Law_BSplineCurve{DegreePositive, KnotCount, KnotsNonDecreasing, KnotMultiplicityBounded, DomainNonEmpty, WeightCount, WeightsPositive}`, the same seven for `Curve2D` | ISO 4.6.11 and 4.5.39 WR1, WR2, one rule each | exact | Error |
| `Law_BSplineSurface{DegreePositive, KnotCount, KnotsNonDecreasing, KnotMultiplicityBounded, DomainNonEmpty}(d, which)`, `..NetConsistent`, `..WeightGridMatchesNet`, `..WeightsPositive` | the same per parameter, and the grids' shapes | exact | Error |
| `Law_BSplineCurveDomainIsKnotSpan`, `..2D..`, `Law_BSplineSurfaceDomainIsKnotSpan` | the domain is `[Knots[Degree], Knots[Count - Degree - 1]]`, aperiodic | exact by construction | Library |
| `Law_BSplineCurveMatchesBasisSum`, `..2D..`, `Law_BSplineSurfaceMatchesBasisSum` | de Boor agrees with the Cox-de Boor oracle | `ResolutionAt(EvaluationMagnitude)` | Library |
| `Law_PeriodicCurveSpansOnePeriod`, `Law_PeriodicSurfaceSpansOnePeriod` | a periodic domain is one period long | Parameter | Library |
| `Law_PeriodicCurveIsClosed` | a periodic curve meets itself at its domain's ends | Length | Library |
| `Law_CurveRepeatsWithPeriod`, `Law_Curve2DRepeatsWithPeriod`, `Law_SurfaceRepeatsWithPeriod` | `Eval(t + P)` is `Eval(t)` | `ResolutionAt(M)` plus speed times `ResolutionAt(|t| + P)` | Library |
| `Law_DerivativeMatchesCentralDifference`, `..2D..`, `Law_PcurveDerivativeMatchesCentralDifference`, `Law_PartialMatchesCentralDifference` | `|D(h/2) - C'| <= 4/3 |D(h) - D(h/2)|` plus rounding, `D` the central difference, `h = cbrt(u)` times the shortest smooth piece; samples within `h` of a break of order 6 (every distinct knot) excluded | Richardson's estimate plus `ResolutionAt(EvaluationMagnitude) / h`; no tolerance parameter | Library |
| `Law_SecondDerivativeMatchesCentralDifference`, `..2D..`, `Law_PcurveSecondDerivativeMatchesCentralDifference` | the same for the central difference of the first derivative | as above, rounding over the piece scale | Library |
| `Law_ClosestParameterRecoversPoint` | the point at `ClosestParameter(Eval(t))` is `Eval(t)` | Length | Library |
| `Law_ClosestParameterNoWorseThanSample`, `Law_ProjectNoWorseThanSample` | for any point, on or off the curve or surface, the result is no farther than any sample (review M4) | rounding at the evaluation magnitudes | Library |
| `Law_ClosestParameterIsStationary`, `Law_ProjectIsStationary` | at an interior minimizer the offset is orthogonal to the tangent or each partial | rounding | Library |
| `Law_ClosestParameterIsCanonical`, `Law_ProjectIsCanonical` | the result is in the canonical window | Parameter | Library |
| `Law_PcurveClosestParameterIsBounded` | a pcurve's closest parameter is finite, and in `[0, T]` with a parameter period `T` | Parameter | Library |
| `Law_ScaledCurvePointIsScaled`, `Law_ScaledSurfacePointIsScaled`, `Law_ScaledPcurvePointIsScaled` | `ScaledGeometry(g, k)` scales every point by `k`; curves keep their parameter, surfaces reach it at `ParameterScaleFactor` times theirs, pcurves follow | `ResolutionAt(k M)` | Library |
| `Law_TrimmedRangeInsideBasis`, `Law_RectangularTrimmedInsideBasis` | the trim lies in the basis domain (at most one period on a periodic basis) | Parameter | File, 10x |
| `Law_TrimmedRangeIsForward`, `Law_RectangularTrimmedRangeIsForward` | the stored range runs forward and is not a point | Parameter | Error |
| `Law_TrimmedStartsAtSensedEnd` | a trimmed curve starts at the basis point its sense names | Length | Library |
| `Law_CompositeSegmentsBounded` | every segment's domain is bounded (4.5.45 WR1) | exact | Error |
| `Law_CompositeSegmentsChain` | segment `i` ends where segment `i + 1` starts | Length | File, 10x |
| `Law_OffsetReferenceNotTangent`, `Law_ExtrusionProfileTransverse` | the reference or extrusion is never along the tangent | Angle | File, 10x |
| `Law_SurfaceCurveLiesOnSupport` | a surface curve lies on each support's surface | Length | File, 10x |
| `Law_SurfaceCurvePcurveLiesOnCurve`, `Law_SurfaceCurveLiesOnPcurve` | pcurve and space curve agree as point sets, both ways; the pcurve sampled over `PcurveRangeOver` the space curve's bounded domain | Length | File, 10x |
| `Law_SurfaceCurvePcurveSameSense` | pcurve and space curve run the same way | exact sign | Error |
| `Law_PcurveWithinSurfaceDomain` | a pcurve stays in its surface's domain | Parameter | File, 10x |
| `Law_NormalIsUnit` | `NormalOr` is unit, everywhere | `ResolutionAt(1)` | Library |
| `Law_NormalOrthogonalToPartial` | `|N . S_x| <= |S_x| NormalAngleBound`, the bound growing toward collapsed lines | `ResolutionAt(1) + ResolutionAt(M) / min(|S_x| s_x)` | Library |
| `Law_NormalSenseMatchesParameterization` | `NormalOr . (S_u x S_v) > 0` exactly where `NormalAgreesWithParameterization`, wherever `NormalAngleBound < 1` | exact sign | Library |
| `Law_AreaElementMatchesCrossProduct` | `AreaElement` is `|S_u x S_v|` | rounding of the product and of each partial | Library |
| `Law_AreaElementPositiveAwayFromCollapse` | the surface is regular off its collapsed lines (`IsOnCollapsedLine`, to rounding) | exact sign | File: Error |
| `Law_ConeAreaElement`, `Law_SphereAreaElement`, `Law_TorusAreaElement` | `|S_u x S_v|` equals `|R + v tan a| / cos a`, `R^2 cos v`, `r |R + r cos v|` | as `Law_AreaElementMatchesCrossProduct` | Library |
| `Law_ProjectRecoversPoint` | `Eval(Project(Eval(uv)))` is `Eval(uv)`, on degenerate sides too | Length | Library |
| `Law_ProjectRecoversParameter` | on surfaces injective by construction, `Project(Eval(uv))` is `uv` modulo the period | `UvToleranceAt(uv)` | Library |
| `Law_ProjectNearRecoversParameter` | `ProjectNear(Eval(uv), seed uv)` is `uv`, on every surface | `UvToleranceAt(uv)` | Library |
| `Law_ProjectNearRecoversFromNearbySeed` | the same from a seed moved by up to `NearSeedOffset` (1.8e-3 of each direction's scale), so the inverse must iterate | `UvToleranceAt(uv)` | Library |
| `Law_CollapsedLineIsOnePoint` | each `CollapsedAt` line is one point | Length | Library (spline, revolution: File, 10x) |
| `Law_TangentialPartialVanishesOnDegenerateSide` | along a degenerate side of a surface that collapses it by formula, the partial along it times the side's length is within rounding; vacuous for spline and revolution sides (review F10) | `ResolutionAt(EvaluationMagnitude)` | Library |

Every toleranced File law exports its measure, so layer 7 can grade it Warning below ten times
the tolerance: `PlacementDeviation` (radians), `TrimExcess` and `TrimBoxExcess` (the basis's
parameter), `SegmentGap`, `SupportGap`, `PcurveToCurveGap`, `CurveToPcurveGap` and
`CollapsedLineSpread` (lengths), `PcurveDomainExcess` (per surface parameter), and the lower bounds
`OffsetReferenceAngle` and `ExtrusionProfileAngle` (radians from parallel; the law holds when the
measure is at least the tolerance). Each law is its measure compared with the tolerance, so the two
cannot disagree.

The brief asked that "both partials vanish along a degenerate side"; only the partial along the
side does, so the law states that, and theorem `TangentialPartialVanishesOnCollapsedLine` gives the
counterexample for the other. "Away from degenerate sides" is made precise two ways: laws about
the normal carry `NormalAngleBound`, the rounding of the normal's direction, which grows as the
smaller partial vanishes, and only the positivity law skips points on a collapsed line to rounding
(review F11 replaced an exclusion zone the size of the parameter floor); laws recovering a
parameter use the per-point tolerance, which reaches its cap on a collapsed line and so says
nothing of the free coordinate there.

## Left open

1. **The central-difference step.** Closed in the fix wave: the step is `cbrt(u)` times the
   shortest smooth piece, every break of order 6 is excluded, and the bound is Richardson's estimate
   plus the library's rounding (theorem `RichardsonBoundsTheDifferenceError`, which replaces the
   refuted conjecture `CentralDifferenceStepSuffices`). The laws still take a `tol` they do not
   read, so that layer 7's calls keep their shape; dropping it is a two-layer change for later.
2. **Interior singular points.** A revolution profile touching its axis inside its domain, or a
   spline row collapsed inside the net, is not found by `CollapsedAt`;
   `Law_AreaElementPositiveAwayFromCollapse` reports such a surface instead.
3. **Periodic copies of breakpoints and collapsed lines.** A trimmed curve over a periodic basis
   whose range crosses the window's end sees only the window's copy of the basis's breakpoints;
   only offset and surface-curve bases on periodic pcurves have any.
4. **Offset regularity.** No law yet states that an offset surface stays regular
   (`1 + d k_i > 0`); it needs principal curvatures.
5. **`RectangularTrimmed` parameters.** From 0 (taken here) or the basis's own (decision 7).
6. **Degree files and pcurves.** Whether exporters that assign degrees write pcurve `u` in degrees
   is unconfirmed (research/STEP-BREP-MODEL.md 5.1); this layer assumes layer 3 converts, as for
   every angle.
7. **Offset curve side in 2D.** `BrepCurve2D.Offset` offsets to the left of the tangent, the side
   of ISO's `orthogonal_complement`; the clause of `offset_curve_2d` was not read.
8. **A `Witness_` per case.** Layer 7 owns the model witnesses (`Witness_Cylinder`, ...); small
   arena witnesses, one per case, would let these laws run before layer 7 exists.
9. **Offset pcurves under unequal scaling.** `ScaledPcurve` has no exact image for a 2D offset
   curve on a surface whose two parameters scale differently (a cylinder, a cone): the image of an
   offset is not an offset. Its precondition excludes the case; a fitted spline would need the
   model's tolerance.

## Implementation notes

Deferred, with their families (contracts in `geometry.spec.plato`):

| Function | Family |
|---|---|
| `BSplinePoint` (3D, 2D, surface), `BSplineDerivative` (3D, 2D), `BSplinePartial` | de Boor on homogeneous points; derivatives by the quotient rule (Piegl and Tiller, *The NURBS Book*, A3.2, A4.2 to A4.4) |
| `BSplineSideCollapses`, `BSplineSidesCoincide` | knot insertion to multiplicity `Degree` at a side, then a control-row test (convex hull) |
| `ClosestParameterBySearch`, `PcurveClosestParameterBySearch` (`ClosestParameter` on a pcurve that is not straight in space) | bracket each smooth piece by curvature-paced samples, Newton with bisection fallback, compare ends |
| `ProjectBySearch`, `ProjectNearBySearch` | grid seeds per smooth patch, Newton on the two normal equations in a trust region; the near form starts at the seed and does not wrap |
| `OffsetSecondDerivative` (3D, 2D), `SecondDerivative` on a pcurve | one more order of the chain rule; needs third derivatives or surface second partials |
| `OffsetPartial`, `LimitNormal` | Weingarten equations; the normal's limit along the transverse parameter |

Costs: evaluating a composite curve scans its segments, linear in their number; `CurveDepth` is
linear in the arena for trees and exponential only for a deliberately shared diamond graph;
`Oracle_BSpline*Point` uses the stdlib's recursive `BasisFunction`, exponential in the degree,
which is acceptable for a check and not for evaluation.

`Number` precision: every law states its rounding with layer 0's `ResolutionAt`, so the laws are
true in 32-bit and 64-bit arithmetic, and weak in 32-bit (the difference laws accept a relative
error near 5e-4 there).

Names this layer depends on from layer 0: `CurveDomain`, `SurfaceDomain`, `Periodicity`
(`Aperiodic`, `Periodic`, `Closed`), `DomainSide`, `LengthTolerance`, `AngleTolerance`,
`ParameterTolerance`, `UvTolerance`, `Tolerances`, `CurveIndex`, `Curve2DIndex`, `PcurveIndex`,
`SurfaceIndex`; and the functions `IsPeriodic`, `PeriodOr`, `ParameterLength`, `IsFullPeriod`,
`CanWrap`, `Wrap`, `NearestUnwrapped`, `SameParameter`, `ContainsParameter`, `IsUSide`,
`SideValue`, `SideRange`, `SidePoint`, `Coincident`, `SameDirection`, `AngleBetweenDirections`,
`ResolutionAt`, `RoundingUnit`, `SmallestNormal`, `ParameterToleranceAt` and `UvToleranceAt` (with
a floor argument), `ParameterToleranceCap`, `IsWellFormed` (on tolerances), and the fields
`Tolerances.LengthParameter` and `Tolerances.AngleParameter`. Only the types are fixed in VOCABULARY.md; the functions are layer
0's current proposals.

Gate (PLATO-PRIMER.md E.3, 2026-10-17, after the fix wave): this folder with layer 0 at HEAD,
PASS, 0 errors, 4410 functions type-checked; all nine live layers together, PASS, 0 errors, 6641
functions. Before the fix wave: with this folder and a copy of `00-foundation` as the design
folder, PASS, 0 errors, 4281 functions type-checked; the only findings are two LINT003
infos (the linter does not see `CompositeSegment2D`'s fields read inside lambdas) and LINT014
infos on the views' `Domain`. With this folder alone, resolution stops on the layer 0 names above,
as expected.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `DegenerateSides(g, s)` | `DegenerateSides(g, s, tol: Tolerances)` | a spline side or a revolution profile end collapses within a tolerance (decision 13) |
| (proposed) `SurfaceCurveKind` | dropped | seam and intersection are derivable from the supports (decision 8) |
| (proposed) `PreferredRepresentation` | kept, cases `SpaceCurve`, `FirstPcurve`, `SecondPcurve` | STEP `preferred_surface_curve_representation` |
| `BSplineCurveData`, `BSplineSurfaceData` with degree and knots | each holds a `SplineBasis { Degree; Knots }` (the surface one per parameter) | the shape rules are written once per basis (decision 1) |
| (new) | `BSplineCurve2DData`, `CompositeSegment`, `CompositeSegment2D`, `CurveSupport`, `TorusPart`, `SurfaceParameter`, `SplineBasis`, `ArenaCurve`, `ArenaCurve2D`, `ArenaSurface` | payloads and views (decisions 1, 4, 6, 8, 16) |
| (new) | `SecondDerivative`, `Curvature`, `Breakpoints`, `IsClosed` on curves; `Breakpoints`, `IsClosedIn`, `CollapsedAt`, `ProjectNear`, `NormalAgreesWithParameterization`, `IsInjectiveByConstruction` on surfaces | curvature and mandatory samples for layer 4; seams, poles and seeded inversion for layer 5; the lemon's orientation for layer 2 |
| (new) | `ParameterToleranceAt(g, c, t, tol)`, `ParameterToleranceAt(g, p, t, tol)`, `UvToleranceAt(g, s, uv, tol)` | the per-point forms layer 0's README asks layer 1 to expose |
| (new) | `Domain`, `Eval`, `Derivative`, `SecondDerivative`, `ClosestParameter` on `PcurveIndex`; `Domain`, `Eval`, `Derivative`, `SecondDerivative`, `Breakpoints` on `Curve2DIndex`; `PcurvesOf` | declared by layers 2 and 4 with `belongs-in: 01-geometry`, same signatures; their copies can go |
| (new) | `IsEveryIndexInRange`, `IsWellFormed`, `CanEvaluate`, `CurveAt`, `Curve2DAt`, `PcurveAt`, `SurfaceAt` | arena well-formedness and typed lookup (decisions 9, 10, 15) |
| (new, `belongs-in: 00-foundation`) | `UnboundedDomain(_: CurveDomain)` | layer 0 allows unbounded domains but has no constructor for one |
| `IsBreakKnot(b, i)`, `CompositeBreakpoints` | `IsBreakKnot(b, i, order)`, `CompositeBreaks(g, segments, order)` | breaks of any derivative order (fix wave, F5) |
| (new) | `Breaks(g, c, order)` on curves, parameter-plane curves and surfaces; `SplineBreaks(b, order)`; `EvaluationMagnitude` on curves, parameter-plane curves, pcurves and surfaces | the derivative laws' exclusions and rounding bound (fix wave, F5) |
| `IsOrthonormalWithin(Frame3D)` used by the placement laws | `OrthonormalityDeviation(f)` (either handedness) in the placement laws; `IsOrthonormalWithin` stays right-handed for rigid motions | mirrored placements are legal (fix wave, F2; decision 17) |
| (new) | `Handedness(f: Frame3D)`, `PlacementHandedness(g, s)`, `PlacementDeviation(g, c | s)` | the determinant sign for layers 2 and 3; the placement laws' measure for layer 7 (fix wave, F2) |
| (new) | `TorusNormalOr`; a contract for `NormalAgreesWithParameterization` (one sign over the domain) | the Full spindle torus normal follows `S_u x S_v` (fix wave, F3, C3) |
| `TrimInsideBasis`, `HoldsRange`, `SegmentsChainAt`, `ReferenceTransverse`, `IsTransverseTo`, `LiesOn`, `PcurveLiesOnCurve`, `CurveLiesOnPcurve`, `TrimBoxInsideBasis`, `ExtrusionTransverse` (Boolean claims) | the measures `TrimExcess`, `RangeExcess`, `SegmentGap`, `OffsetReferenceAngle`, `AngleFromParallel`, `GapTo`, `SupportGap`, `PcurveToCurveGap`, `CurveToPcurveGap`, `PcurveDomainExcess`, `TrimBoxExcess`, `ExtrusionProfileAngle`, `CollapsedLineSpread` | layer 7 grades file laws by their measure (layer 7 finding 5) |
| `ClosestParameter(g, p: PcurveIndex, q)` minimizer over the domain | the bounded representative: in `[0, T)` with a parameter period `T`, else of least magnitude | an unbounded line pcurve has a minimizer in every period (fix wave, F4) |
| (new) | `PcurveParameterPeriod(g, p)`, `PcurveRangeOver(g, p, c, r)`, `PcurveSampleFor`, `Law_PcurveClosestParameterIsBounded` | pcurve ranges from the space curve and the surface periods (fix wave, F4) |
| (new) | `CollapsesByFormula(g, s)` | the guard of `Law_TangentialPartialVanishesOnDegenerateSide` (fix wave, F10) |
| `tol.Parameter` (one floor) | `ParameterFloorOf(g, c | p, tol)`, `ParameterFloorAlong(g, s, which, tol)`, `UvFloorOf(g, s, tol)`, `FinerParameterFloor(tol)`, and `IsAngleParameter` on curves, parameter-plane curves and surface parameters | layer 0 split the floor by kind; this layer knows the kind (fix wave, C2) |
| `Domain` of a closed spline or polyline: `Aperiodic` | `Closed(range length)` when clamped with first and last control points (rows) the same point exactly; `IsClosed`, `IsClosedIn`, `DegenerateSides`, the period laws read `HasSeam` | closure decided once at decode and seen by every layer (fix wave, T1, C1) |
| (new) | `IsClamped`, `SplineDomainOf`, `SameExactly`, `IsClosedSpline`, `EndRowsCoincide`, `PolylineDomain`, `BasisParameter`, `IntoRange`; `TrimmedToBasis` takes the arena and the basis | closed domains, and trims across a closed join | 
| `IsNearCollapsed` (parameter-floor zone) | `IsOnCollapsedLine` (rounding), `NormalAngleBound`, `DirectionScale`; `AreaElementIs` drops its tolerance | normal and area-element laws bounded by rounding (fix wave, F11, F7) |
| (new) | `Law_ClosestParameterNoWorseThanSample`, `Law_ClosestParameterIsStationary`, `Law_ProjectNoWorseThanSample`, `Law_ProjectIsStationary`, `IsInteriorParameter` | inverse evaluation tested at points off the geometry (fix wave, M4) |
| (new) | `KeepSeedWhereFree`, `NearSeedOffset`, `NearbySeed`, `Law_ProjectNearRecoversFromNearbySeed`; theorem `ProjectNearIsLocalInverse` restated with a seed in a stated neighbourhood | the local inverse keeps the seed's free coordinate (fix wave, T5) |
| `GeometrySet { Curves; Curves2D; Pcurves; Surfaces }`; closure read from exact end coincidence (previous row) | `GeometrySet` gains `Closures: Array<ClosureMark>` (`ClosedCurve`, `ClosedCurve2D`, `ClosedSurface(s, which)`); `Domain` applies them (`WithClosure`, `IsMarkedClosed`); laws `Law_ClosureMarkInRange`, `Law_ClosureMarkNamesBoundedAperiodic` | layer 3 decides closure with its tolerance and must store it for every aperiodic record, composites and trims included; every `GeometrySet(...)` construction gains a fifth argument, `[]` when nothing is closed (layer 7's witnesses) |
| (new) | `ScaledCurve(curve, k)`, `ScaledSurface(surface, g, k)`, `ScaledPcurve(curve2D, g, s, k)`, `ParameterScaleFactor(g, s, which, k)`, `ScaledGeometry(g, k)`, `SurfaceOf(g, c, fuel)`, `AnisotropicConic` (deferred); laws `Law_Scaled{Curve,Surface,Pcurve}PointIsScaled` | the scaling layer 2's `ScaledBy` and layer 7's metamorphic laws build on (FIX-WAVE ownership table) |
| `UnboundedDomain` (here, `belongs-in: 00-foundation`) | layer 0's `UnboundedDomain` | the stand-in moved down (fix wave, C10) |

## Fix wave, 2026-10-17

Findings from [reviews/MATH-REVIEW-layers-0-6.md](../reviews/MATH-REVIEW-layers-0-6.md), the
"Findings in lower layers" of layers 7 and 8, and [reviews/FIX-WAVE.md](../reviews/FIX-WAVE.md),
one commit each.

Applied:

- **F5, H1.** Derivative laws exclude every break of order 6 (all distinct knots up to degree 6),
  step from the shortest smooth piece, bound by Richardson's estimate plus
  `ResolutionAt(EvaluationMagnitude) / h`; the refuted conjecture is replaced by theorem
  `RichardsonBoundsTheDifferenceError` with its hypothesis (`|C^(5)| <= 6e14 M / s^5`).
- **F2.** Placement laws accept mirrored frames and export `PlacementDeviation`; `Handedness` and
  `PlacementHandedness` export the determinant sign; the closed-form normals multiply by it, so
  `NormalOr = eps <S_u x S_v>` holds on mirrored placements (decision 17).
- **F3, C3.** A Full torus with major below minor takes `sign(rho)` times the closed-form normal, so
  `NormalAgreesWithParameterization` is one sign per surface, now stated as its contract; the Apple
  and Lemon keep the closed form, which is `eps <S_u x S_v>` on both.
- **Layer 7 finding 5.** Every toleranced File law is its exported measure compared with the
  tolerance; the Boolean claim helpers are gone.
- **F4 (the layer 1 part).** `ClosestParameter` on a pcurve returns a bounded representative;
  `PcurveRangeOver` derives a pcurve range from the space curve's range and the parameter period;
  `Law_SurfaceCurvePcurveLiesOnCurve` samples that range, so a bounded curve with a line pcurve passes.
- **F10.** `Law_TangentialPartialVanishesOnDegenerateSide` holds by formula only (sphere, torus
  parts, their trims and offsets), bounded by rounding; spline and revolution sides are left to
  `Law_CollapsedLineIsOnePoint`.
- **C2 (the layer 1 part).** Every parameter comparison takes the floor of its parameter's kind,
  chosen by `IsAngleParameter`; `ParameterToleranceAt` and `UvToleranceAt` pass it to layer 0. A
  parameter that is neither angle nor length (knots, a line's `t`) takes the length floor in its own
  units, a lower bound under its per-point tolerance.
- **T1, C1 (the layer 1 part).** Splines and polylines whose ends are the same point exactly get a
  `Closed` domain; `IsClosed` and `IsClosedIn` report it; closed directions have no sides; trims
  across a closed join wrap. Layer 3 records its decision by snapping and clamping (above).
- **F11, and F7 for this layer.** The normal, area-element, oracle and period laws are library
  laws and take rounding bounds (`NormalAngleBound`, `ResolutionAt(EvaluationMagnitude)`), not
  the model's angle or length tolerance; the floor-sized exclusion zone is gone.
- **F12 (the layer 1 items).** `spec Eval` on a surface states containment without a zero tolerance;
  `spec ProjectNear` states nearness to the seed within half a period plus rounding instead of an
  exact `==` on computed values; `spec LimitNormal` likewise compares directions within
  `NormalAngleBound`.
- **M4.** Inverse evaluation is tested at any point: no worse than any sample, and stationary at
  an interior minimizer, on curves and surfaces.
- **T5, and theorem ProjectNearIsLocalInverse.** `ProjectNear` keeps the seed's free coordinate at a
  pole, apex or axis; the theorem is restated for a seed in a neighbourhood the inverse function
  theorem provides, and a new law seeds near the answer, not at it.
- **T1, continued (layer 3's request).** Closure decided at decode is stored as `ClosureMark`s in
  the arena, for any bounded aperiodic curve, 2D curve or surface direction; the exact-coincidence
  reading of the previous commit is removed.
- **Theorem ConeAreaElement.** States its hypothesis `|a| < pi/2`, which `1 / cos a` needs.
- **ScaledCurve, ScaledSurface, ScaledPcurve (FIX-WAVE ownership).** New file
  `geometry-scaling.library.plato`: speed vectors scale with positions so curve parameters never
  change; lengths along unit frame axes (plane, cylinder and cone `v`) scale; angles never;
  pcurve coordinates follow their surface; `ScaledGeometry` scales a whole arena.
- **C10, UnboundedDomain.** The stand-in is deleted; layer 0's is used.

Skipped or left to other layers, with the reason:

- **M3, the rest.** The reverse point-set direction and the sense test already exist here
  (`Law_SurfaceCurveLiesOnPcurve`, `Law_SurfaceCurvePcurveSameSense`); a pcurve's surface being a
  face's surface and the same-parameter law at an edge's discretization parameters are edge-level
  claims for layers 2 and 4.
- **F8, the sampling part.** The laws here are pointwise and finite for any finite sample; choosing
  a bounded window for an unbounded direction (the edge's domain, the face's box) belongs to the
  callers, as layer 0's `Samples` precondition now says. `PcurveRangeOver` gives the pcurve window.
- **KernelCurve and KernelSurface provenance.** This layer builds no `Check`; layer 7's checks over
  geometry laws choose the site.
- **The unread `tol` of the library laws.** Kept so that layer 7's calls keep their shape; dropping
  it is a two-layer change for after the wave.
- **Kept as owner:** `PcurvesOf`, `Eval(g, c: Curve2DIndex, t)`, `NormalAgreesWithParameterization`
  (layers 2 and 4 delete their copies); no change was needed beyond F3's contract.

Names this layer now depends on from other layers' fixes: layer 0's `Closed`, `HasSeam`,
`Tolerances.LengthParameter`, `Tolerances.AngleParameter`, `UnboundedDomain`, and the floor
arguments of `ParameterToleranceAt` and `UvToleranceAt`. Layer 3 must write `ClosureMark`s into
`GeometrySet.Closures` and fold `PlacementHandedness`; layer 2 can build `ScaledBy` on
`ScaledGeometry` and `PcurveEdgeDomain` on `PcurveRangeOver`.

## Name review, 2026-10-17

The name-and-dependency review after the fix wave (VOCABULARY.md revision 3) changed this layer as follows.

- Took layer 2's stand-ins (`belongs-in: 01-geometry`): `DefiningPoints` (curve, surface) into `geometry.library.plato` (new section "Defining points"), and `MovedVector`, `MovedDirection`, `MovedFrame`, `Moved` (curve, surface), `MovedGeometry` into the new `geometry-motion.library.plato` (`BrepGeometryMotion`), beside `BrepGeometryScaling`.

## Implementation, chunk B

TKT-324, 2026-10-18, two changes requested by the topology session (TKT-314) for edges that carry
pcurves, which the cylinder's seam edges do:

- `ClosestParameter` on a `BrepCurve`: the `OnSurface` arm whose master is the space curve (Eval's
  own test, `MasterPcurve` none) returns the space curve's closed form instead of calling the
  bodiless `ClosestParameterBySearch`.
- `ClosestParameter(g, p: PcurveIndex, q)` gets a body: where the pcurve's space image is a straight
  line run at constant velocity (`IsStraightPcurve`, `IsStraightOn`, `LiftsLineStraight`: a 2D line
  on a plane, or a 2D line along v on a cylinder or a cone), the foot of q on that line, which is the
  unique minimizer and satisfies the contract's bounds (such a pcurve has no parameter period).
  Every other pcurve calls `PcurveClosestParameterBySearch`, the new name of the deferred search,
  whose note is the old deferred note.

Counts: four functions added with bodies (`IsStraightPcurve`, `IsStraightOn`, `LiftsLineStraight`,
and `ClosestParameter` on a pcurve, which was deferred) and one deferred function renamed out of it,
so 18 functions stay deferred. The circle and cylinder arms needed no new body: their evaluation,
derivatives, normals, `ClosestParameter` and `Project` were closed forms already.
