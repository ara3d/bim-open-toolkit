# 00-foundation: tolerances, parameter domains, indices, diagnostics

Layer 0 of the STEP B-rep to mesh design ([../README.md](../README.md)), written 2026-10-17 under
TKT-299 against [VOCABULARY.md](../VOCABULARY.md) revision 2. It holds what every other layer
compares, indexes, and reports with: the three kinds of tolerance, the arithmetic of periodic
parameters, the typed indices of every table, provenance, and the check-to-verdict chain of
[SPEC-DSL.md](../SPEC-DSL.md) section 4. It names nothing above itself. Every function has a
body, because every body here is its own specification; nothing is deferred.

| File | Holds |
|---|---|
| `foundation-tolerances.types.plato` | `LengthTolerance`, `AngleTolerance`, `ParameterTolerance`, `UvTolerance`, `Tolerances` |
| `foundation-domains.types.plato` | `Periodicity`, `CurveDomain`, `SurfaceDomain`, `DomainSide`, `SamplePlan` |
| `foundation-indices.types.plato` | the 13 typed indices |
| `foundation-diagnostics.types.plato` | `MeshVertexProvenance`, `Provenance`, `Severity`, `ConstraintGroup`, `Check`, `Diagnostic`, `Report` |
| `foundation.library.plato` | `library BrepFoundation`: 78 functions, all with bodies |
| `foundation.laws.plato` | `library BrepFoundationLaws`: 34 laws, 4 witnesses, 1 helper |
| `foundation.spec.plato` | 11 type invariant blocks, 25 function contracts, 8 theorems |

The type files carry a `foundation-` prefix because the CLI gate of PLATO-PRIMER.md E.2 copies
every layer's files into one flat folder, where a second `domains.types.plato` would overwrite
the first.

## The objects

### Tolerance as a relation

A tolerance `t` on a metric space defines the relation `x ~ y` when `d(x, y) <= t`. It is
reflexive and symmetric. It is not transitive: with `t = 1`, the points 0, 0.75 and 1.5 on a line
give `0 ~ 0.75` and `0.75 ~ 1.5` but not `0 ~ 1.5` (theorem `CoincidenceIsNotTransitive`). So
"equal within tolerance" has no equivalence classes, and that costs three things:

1. **Chains drift.** k links within `t` put the ends within `k t`, nothing better
   (`Law_CoincidenceComposesWithSummedTolerance` states the two-link case).
2. **Merging by distance depends on order.** Welding 0, 0.75 and 1.5 gives one vertex or two
   depending on which pair is welded first. The design therefore never welds: mesh vertices are
   numbered by provenance (layer 6), and a geometric near-duplicate is reported, not merged.
3. **Exact equality cannot be recovered from approximate equality.** Laws compare `Number`s only
   through a named tolerance, and use exact `==` only on integers, Booleans, indices, sum tags, and
   copied values (`Identical`, below).

### The three tolerances

| Type | Metric it bounds | Unit | Source |
|---|---|---|---|
| `LengthTolerance` | Euclidean distance between points | model length unit | the file's `uncertainty_measure_with_unit` for length |
| `AngleTolerance` | angle between two directions | `Angle` (radians stored) | the file's plane-angle uncertainty, else a decoder default |
| `ParameterTolerance` | difference of two values of one curve or surface parameter | that parameter's unit: radians for an angle, model lengths for a length | derived from the length tolerance, per point (below) |

A tolerance is well formed when it is finite and at least the smallest normal `Number`
(`ResolutionAt(0.0)`, about 2.2e-308 in 64 bits). A tolerance of 1e-310 is positive in the reals
and has no relative precision in the arithmetic.

### Arithmetic resolution

`Number` is a 32-bit float in the C# backend today (PLATO-PRIMER.md D.1). A tolerance smaller than
the rounding error at the magnitude of the values it compares cannot be honoured, and a law that
compares against it reports rounding noise. The layer makes the precision a number:

- `Number.RoundingUnit` is the unit roundoff `u`, the largest power of two with `1 + u == 1`:
  2^-53 for 64 bits, 2^-24 for 32. It is computed, not read from `Number.Epsilon`, which in the
  C# backend is `float.Epsilon`, the smallest subnormal (`src/Plato.Intrinsics/Number.cs:103`).
- `Number.SmallestNormal` is the smallest normal number, below which spacing is absolute.
- `ResolutionAt(m)` is `max(32 u |m|, SmallestNormal)`: sixteen spacings of adjacent numbers near
  `m`. At `m = 1e5` it is 3.6e-10 in 64 bits and 0.19 in 32 bits, so a building model in
  millimetres with a file tolerance of 1e-3 mm is checkable in 64 bits and not in 32
  (`Law_LengthToleranceResolvable`).

The factor 32 comes from error analyses of this layer's functions. `Wrap` errs by at most
`u (|t| + 3p)`; the class laws compose two or three such steps and stay below `14 u (|t| + p)`.
A scratch fuzzer that mirrors the bodies in C# made 300,000 adversarial draws in each of `double`
and `float` (multiples of 2 pi offset by 1e-12, subnormal periods, magnitudes from 1e-20 to 1e20),
and each numeric law ran on the 90,000 to 300,000 draws its guard admitted. No law failed; a
separate run of 2,000,000 draws found the worst errors at 2 `u` for the `Wrap` laws and 3.9 `u`
for `NearestUnwrapped`. The first run found two laws failing, both only on subnormal values:
`Law_SamplesStrictlyIncreasing` on a range of 4e-323, and
`Law_ParameterToleranceAtMovesWithinLength` with a length tolerance of 3e-316. They are why
`ResolutionAt` has the `SmallestNormal` floor and why a well-formed tolerance must be normal. Rounding-only laws take their bound from
`ResolutionAt`, never from a model tolerance, as SPEC-EXECUTION.md 5.9 item 4 asks.

### The parameter tolerance

The decision VOCABULARY.md left to this layer. A single parameter tolerance per model is wrong
because the parameter metric is the length metric pulled back through the parameterization, and
that depends on the point. On a sphere of radius `R`, a step `du` in longitude at latitude `v`
moves the point by `R cos(v) du`. With `R = 100` and a length tolerance of 1e-3, the step that
moves the point by the length tolerance is 1e-5 rad at the equator, 5.7e-3 rad at latitude 89.9
degrees, and unbounded at the pole, where every longitude is the same point.

The rule, in `ParameterToleranceAt(t, speed, cap)`:

```
tau(x) = max( floor, min( Length / speed(x), cap ) )
```

- `speed(x)` is `|c'(t)|` on a curve, or `|dS/du|` or `|dS/dv|` on a surface, in model lengths per
  parameter unit. To first order, a step of `tau` moves the point by at most `Length`
  (theorem `ParameterToleranceBoundsMotion`).
- `cap` is `ParameterToleranceCap(domain)`: half the period for a periodic direction (no two
  points of a circle are farther apart), the range's length for a bounded aperiodic direction,
  `Number.MaxValue` for an unbounded one. At a pole the speed is zero and the tolerance is the cap.
- `floor` is the model-wide `Tolerances.Parameter`. It keeps the tolerance from collapsing where
  the speed is huge (a B-spline span between nearly coincident knots) and from dropping below the
  arithmetic resolution. **`Tolerances.Parameter` is this floor, never the tolerance at a point.**
  The decoder sets it with `ParameterFloor(length, modelSize)`:
  `max(Length / max(modelSize, 1), ResolutionAt(max(modelSize, 4 pi)))`. The first term is the
  derived tolerance at the largest speed an analytic parameterization of the model reaches (1 for
  a unit-speed length parameter, the radius, at most the model size, for an angle); the second is
  the resolution of parameter values, which reach the model size or two turns. 1e-6 mm over a
  1000 mm model gives 1e-9.

For a surface, `UvToleranceAt(t, speedU, speedV, domain)` returns a `UvTolerance`, one tolerance
per direction, each computed for twice the partial's length. A displacement within both moves the
point by at most `|S_u||du| + |S_v||dv| <= Length / 2 + Length / 2` by the triangle inequality,
whatever the angle between the partials (theorem `UvToleranceBoundsMotion`). The box is
conservative by up to a factor of sqrt(2) against the exact ellipse of the first fundamental form,
and needs no `F` term.

Who applies it: **layer 1** (geometry), which alone evaluates derivatives, should expose the
per-point forms, for example a curve form `ParameterToleranceAt(g, c, t, tol)` and a surface form
`UvToleranceAt(g, s, uv, tol)` that call these with `|Derivative|`, `|PartialU|`, `|PartialV|`.
**Layers 2, 4 and 5** consume them: `Law_LoopSimpleInParameterSpace`, `Law_InnerBoundInsideOuter`
and `Law_EdgeDomainWithinPeriod` (VALIDATION-MATH.md section 8, tolerance "Parameter"), seam and
pole snapping in face meshing, and the parameter-space criteria of `Discretize`. Where one number
must serve a whole face, the floor is the conservative choice for a "separated by more than"
test, and the cap for a "same point" test. `SameParameter` has deliberately no overload taking
`Tolerances`, so a caller cannot use the floor by accident.

### A periodic domain as a quotient

A periodic parameter with period `p` lives on the circle `R / pZ`: `t` and `t + k p` name the same
point. Each function of the periodic kit is a standard map of that quotient:

| Function | Mathematical object | Example, `p = 2 pi` |
|---|---|---|
| `Wrap(t, p)` | the section picking the representative in `[0, p)` | `Wrap(7.0)` is 0.7168 |
| `ShortestDifference(from, to, p)` | the signed lift of the arc from `from` to `to`, in `[-p/2, p/2)` | `(6.0, 0.5)` gives 0.7832 |
| `PeriodicDistance(a, b, p)` | the quotient metric, the shorter arc length | `(0.01, 6.28)` gives 0.0132 |
| `NearestUnwrapped(t, ref, p)` | the lift of `t` nearest to `ref`: path lifting, which unwraps a loop | `(0.1, 6.2)` gives 6.3832 |

`Wrap` lands in `[0, p)` like the stdlib's `Wrap(Angle, Angle)`. A tie at exactly half a period
goes to `-p/2`, and the half-period test doubles `w` rather than halving `p`, so
`Law_ShortestDifferenceAtMostHalfPeriod` holds exactly, even for subnormal periods. `CanWrap(t, p)`
is the precondition of all of them: `t` and `p` finite and `p > ResolutionAt(t)`, which keeps
`t / p` far below the range where `Floor` stops being exact.

The brief's law "`Wrap(t + p) == Wrap(t)` within parameter tolerance" is false as an absolute
difference: next to the seam one side can land just below `p` and the other just above 0. In
64-bit arithmetic with `p = 1` and `t = 1 - 2^-53`, `Wrap(t)` is `t` while `t + 1` rounds to 2 and
`Wrap(2)` is 0. `Law_WrapIgnoresWholePeriods` therefore measures the difference around the circle,
with `PeriodicDistance`.

### Closed directions

A clamped B-spline whose first and last control points coincide is a loop as a point set, but
its formula does not wrap: it is defined only on `[k_start, k_end]`, and its derivatives need not
agree at the join. STEP has no periodic B-spline surface, so every B-spline face that a CAD system
wraps into a cylinder is of this kind. `Periodicity.Closed(Period)` records it, with `Period` the
range's length (`Law_ClosedPeriodIsRangeLength`); layer 3 decides it at decode.

Seam reasoning sees `Closed` as a period. These functions treat `Closed(p)` exactly as
`Periodic(p)`: `HasSeam`, `PeriodOr`, `ParameterToleranceCap`, `SameParameter`, `IsFullPeriod`,
`CanWrap`, `Wrap`, `NearestUnwrapped` and `ContainsParameter` on a `CurveDomain`, and the
`SurfaceDomain` forms built from them. One function does not: `IsPeriodic`, which says the
formula wraps, is false for `Closed`, so layer 1 never evaluates a closed curve outside its
range. A caller that holds an unwrapped coordinate wraps it with `Wrap(d, t)` before it
evaluates; on a closed domain the result is in the range within rounding
(`Law_WrapOnClosedDomainStaysInRange`).

### Curve and surface domains, sides, seams, poles

A `CurveDomain` is a closed interval of natural parameter values with a periodicity. For a
periodic domain the interval is one lift of an arc of the circle: an edge on a circle may have
range `[5.5, 7.0]`, and `ContainsParameter` finds 0.5 in it as 6.783. The interval may be a single
point and may be unbounded (a line); `IsProper` admits only finite, longer than the tolerance, and
at most one period plus the tolerance, which is what sampling and meshing need. A full circle is
proper with length exactly one period (`IsFullPeriod`).

A `SurfaceDomain` is the product of a U and a V domain: a cylinder is circle times interval, a
torus circle times circle, a sphere circle times an interval whose two ends the surface collapses
to points. `DomainSide` names the four sides of the parameter rectangle. A **seam** is a pair of
opposite sides identified by periodicity (`OppositeSide`); a **pole** is a side the surface maps to
one point (layer 1's `DegenerateSides`). `SideValue`, `SideRange` and `SidePoint` give face
meshing the coordinates for the synthetic seam and pole points of `UvPointSource`.

### Typed indices

A typed index is an injection of a table position into its own type, so a face index cannot be
passed where an edge index is meant. Each is `{ Value: Integer }` implementing `IValue, IHashable,
IComparable, IIndex` (PLATO-PRIMER.md probe G02); `-1` means none. `IsNone`, `IsPresent`, `Hash`,
ordering, `xs[i]` and `xs.IsValidIndex(i)` are the stdlib's generic `IIndex` functions
(`collections.library.plato`) and are not redeclared; the stdlib writes `VertexIndex(-1)`, and so
does this design. `StepInstanceId` is the `n` of `#n`, not a position; `ElementIndex` addresses the
triangles and then the quads of a mesh as one sequence.

### Provenance

Provenance is the map from a result back to its source. For a mesh vertex,
`MeshVertexProvenance` names its **carrier**, the lowest-dimensional model cell containing it, and
its parameter on that cell: `OnVertex(v)`, `OnEdge(e, t)`, `OnFace(f, uv)`. Re-evaluating the
carrier at the parameter must give the vertex position within the length tolerance (layer 7,
`Law_VertexReevaluatesFromProvenance`); `CarrierDimension` (0, 1, 2) is the order of layer 6's
vertex numbering. For a finding, `Provenance` names what it is about, so a user can go from a
diagnostic to the entity in the file: `WholeInput` for a finding about the input as a whole (a
text that is not Part 21, a model with no faces), a STEP instance number, a curve or surface of the
geometry arena (`KernelCurve`, `KernelSurface`: a defect in the geometry record, reported once
rather than at every edge or face citing it), a topology object, or a mesh vertex or element.
`Nowhere` is a placeholder: a stage that knows what its callee's findings are about replaces it
with `Located(report, where)`, which keeps every check, code and severity, so the verdict is
unchanged (`Law_LocatedKeepsVerdict`).

### Checks, diagnostics, reports

The chain is SPEC-DSL.md section 4:

```
Law_X  ->  Check (CheckWithin, CheckExact, folded by WorseOf)  ->  ReportOf  ->  Merge  ->  IsClean
```

- A `Check`'s `Worst` is a measure in the law's own unit, oriented so that larger is worse, and
  its `Bound` is the bound that sample was checked against. `CheckWithin(law, worst, bound, where)`
  sets `Holds` to `worst <= bound` and keeps the bound; `CheckExact` uses 0 for holds, 1 for fails,
  against bound 0. Both are the only constructors besides `WorseOf`, so
  `Law_HoldsExactlyWhenWithinBound` is a type invariant. A measure that could not be taken is
  `Number.Unmeasured` (NaN), never 0, and the check fails.
- `WorseOf` folds per-sample checks into one: a failing check outranks a holding one, then an
  unmeasured one a measured one, then the larger `Exceedance` (`Worst / Bound`; infinity for a
  failed exact check). Ties keep the left. Ranking by exceedance and not by raw `Worst` matters
  because the parameter tolerance is per point: a sample 3e-9 past a bound of 1e-9 is worse than one
  5e-6 inside a bound of 1e-5. `Outranks` is a total preorder, so the fold is associative, and
  when the result fails its `Where` names the failing sample farthest past its own bound.
- `ReportOf(check, group, message)` is the one place a check becomes a diagnostic: the check, plus,
  when it failed, a `Diagnostic` whose `Code` is the law's name and whose severity comes from
  `SeverityOf` of the check's own `Worst` and `Bound`. `ReportOf(diagnostics)` wraps findings that
  no check produced.
- `Located(report, where)` is the fourth constructor of `Report`: it gives every `Nowhere`
  diagnostic the provenance `where` and keeps the rest.
- `Report` is a monoid under `Merge` (concatenation of both arrays) with `Report.Empty` as
  identity, and `IsClean` is a monoid homomorphism into Booleans under "and": a validation assembled
  piece by piece is clean exactly when every piece is.

## Decisions and reasons

1. **The parameter tolerance is derived per point, with a model-wide floor and a per-direction
   cap**, as above. Layer 1 applies it; layers 2, 4, 5 consume it. Reason: the pulled-back metric
   degenerates at poles and grows without bound near coincident knots; one number is too tight at
   one and too loose at the other.
2. **A rounding bound is a function, not an epsilon.** `ResolutionAt` replaces every literal
   epsilon a law would otherwise need, works for 32 and 64 bits, and turns the `Number` width
   question into a check (`Law_LengthToleranceResolvable`).
3. **`SameDirection` measures `atan2(|a x b|, a . b)`**, in `AngleBetweenDirections`. The stdlib's
   `AngleBetween` takes the arc cosine of the dot product, which cannot resolve angles below about
   1.5e-8 rad in 64 bits or 3.5e-4 rad in 32; STEP angle tolerances are often smaller.
4. **`SameParameter` on parameter-space points is a box**, `|du| <= U` and `|dv| <= V`, because
   the two directions carry different units (radians against millimetres on a cylinder).
5. **`Samples` copies its ends and computes each interior value from its index**, never by
   accumulating a step, so `Law_SamplesStartAtRangeStart` and `Law_SamplesEndAtRangeEnd` hold
   bitwise and the error does not grow along the array. Strict increase needs each step above the
   resolution (`StepsAreResolvable`); 1e-20 split into 10 steps at magnitude 1 is not resolvable.
6. **Severity comes from the constraint group.** `ConstraintGroup` (`Topological`, `Geometric`,
   `Quality`) is the front README's three groups. `SeverityOf` reads SPEC-DSL.md's "Warning when
   the exceedance is below ten times the criterion" as `worst < 10 * bound`; an unmeasured
   geometric check is an Error.
7. **A diagnostic's `Code` is the failed law's name.** One identity per rule, so a finding leads
   straight to its `Law_` and its spec.
8. **Reports and checks are compared with `Identical`, not `==`.** The generated C# compares array
   fields by reference (PLATO-PRIMER.md D.6) and NaN equals nothing; `Identical` is
   field-by-field with NaN equal to NaN, the executable form of "exact by construction".
9. **`Check` and `Report` list constructors in their spec blocks.** That makes "a holding check is
   within its bound" and "every failed check has a diagnostic" promises rather than hopes, at the
   cost of every `Check_` in layers 2 to 7 building through `CheckWithin`, `CheckExact`, `WorseOf`,
   `ReportOf`, `Merge` and `Empty`.
10. **No `None` constant per index**, matching the stdlib's `VertexIndex(-1)`. Thirteen one-line
    statics would repeat what `IIndex` already says.

## Laws

Kind follows VALIDATION-MATH.md section 8: **model** laws run on user data and their severity
applies; **library** laws are tests of this layer, a failure is a defect here ("test");
**convention** laws hold for values built by this layer's constructors, so a failure is a defect in
the layer that built the value. "Rounding" means the bound is `ResolutionAt` of the magnitude
named; "tolerance, resolvable" means the law takes a `ParameterTolerance` and its guard requires it
to be at least that rounding bound.

| Law | Statement | Tolerance | Kind, severity |
|---|---|---|---|
| `Law_LengthTolerancePositive` | a length tolerance is finite and at least the smallest normal Number | exact | model, Error |
| `Law_AngleTolerancePositive` | likewise for an angle tolerance | exact | model, Error |
| `Law_ParameterTolerancePositive` | likewise for a parameter tolerance | exact | model, Error |
| `Law_LengthToleranceResolvable` | the length tolerance is at least `ResolutionAt(model size)` | rounding, model size | model, Warning |
| `Law_ParameterToleranceAtNeverBelowFloor` | the derived tolerance is at least the floor | exact | library, test |
| `Law_ParameterToleranceAtMovesWithinLength` | `speed * tau <= max(Length, speed * floor)` | rounding, that maximum | library, test |
| `Law_CoincidentIsReflexive` | a finite point coincides with itself | exact | library, test |
| `Law_CoincidentIsSymmetric` | `Coincident(a, b)` equals `Coincident(b, a)` | exact | library, test |
| `Law_CoincidenceComposesWithSummedTolerance` | within `t` of b and b within `t` of c give within `2t` | rounding, `t` | library, test |
| `Law_SameDirectionIsReflexive` | a direction is the same as itself | exact | library, test |
| `Law_WrapLandsInPeriod` | `0 <= Wrap(t, p) < p` | exact | library, test |
| `Law_WrapIsIdempotent` | `Wrap(Wrap(t)) = Wrap(t)` | parameter tolerance (holds bitwise) | library, test |
| `Law_WrapStaysInClass` | `Wrap(t)` is `t` on the circle | rounding, `abs(t) + p` | library, test |
| `Law_WrapIgnoresWholePeriods` | `Wrap(t + p)` is `Wrap(t)` on the circle | tolerance, resolvable at `abs(t) + p` | library, test |
| `Law_ShortestDifferenceAtMostHalfPeriod` | `2 abs(d) <= p` | exact | library, test |
| `Law_NearestUnwrappedWithinHalfPeriodOfReference` | `abs(n - ref) <= p / 2` | tolerance, resolvable at `abs(ref) + p` | library, test |
| `Law_NearestUnwrappedIsSameParameter` | `n` is `t` on the circle | tolerance, resolvable at `abs(t) + abs(ref) + p` | library, test |
| `Law_ClosedPeriodIsRangeLength` | a `Closed` direction's period is its range's length | exact by construction | convention, test |
| `Law_WrapOnClosedDomainStaysInRange` | `Wrap(d, t)` on a closed domain lies in the range | rounding, the range's ends | library, test |
| `Law_DomainContainsItsSamples` | every sample of a proper domain is contained in it | tolerance, resolvable at the ends and period | library, test |
| `Law_SamplesHaveRequestedCount` | `Samples(range, n)` has `n` values | exact | library, test |
| `Law_SamplesStartAtRangeStart` | the first sample is `range.Start` | exact by construction | library, test |
| `Law_SamplesEndAtRangeEnd` | the last sample is `range.End` | exact by construction | library, test |
| `Law_SamplesStrictlyIncreasing` | sample k is below sample k + 1 when the steps are resolvable | exact | library, test |
| `Law_HoldsExactlyWhenWithinBound` | a check holds exactly when `Worst <= Bound` | exact | convention, test |
| `Law_CheckBoundIsNonNegative` | a check's `Bound` is finite and at least 0 | exact | convention, test |
| `Law_UnmeasuredCheckFails` | a check with a NaN `Worst` fails | exact | convention, test |
| `Law_WorseOfKeepsTheGreaterExceedance` | the fold keeps the sample farthest past its own bound | exact | library, test |
| `Law_WorseOfHoldsExactlyWhenBothHold` | `WorseOf(a, b)` holds exactly when both do | exact | library, test |
| `Law_WorseOfIsAssociative` | the `WorseOf` fold ignores grouping | exact | library, test |
| `Law_MergeIsAssociative` | `Merge` is associative | exact | library, test |
| `Law_EmptyIsLeftIdentityOfMerge` | `Merge(Empty, r)` is `r` | exact | library, test |
| `Law_EmptyIsRightIdentityOfMerge` | `Merge(r, Empty)` is `r` | exact | library, test |
| `Law_IsCleanExactlyWhenNoError` | `IsClean` exactly when `ErrorCount` is 0 | exact | library, test |
| `Law_MergeIsCleanExactlyWhenBothClean` | a merged report is clean exactly when both parts are | exact | library, test |
| `Law_FailedCheckHasDiagnostic` | every failed check has a diagnostic with its law's name | exact | convention, test |
| `Law_LocatedKeepsVerdict` | `Located(r, where)` is clean exactly when `r` is | exact | library, test |
| `Law_LocatedKeepsFindings` | `Located` keeps each diagnostic's code and severity and fills only `Nowhere` | exact | library, test |
| `Law_IsNoneExactlyWhenNegative` | `IsNone` exactly when `Value < 0`, for every `IIndex` type | exact | library, test |
| `Law_OppositeSideIsInvolution` | the opposite of the opposite side is the side | exact | library, test |

The laws over numbers, tolerance records, points, directions, intervals and indices are reachable
by the stdlib's random runner (PLATO-PRIMER.md B.2). Those over `CurveDomain` (it holds a sum),
`Check`, `Report` and `DomainSide` need witnesses: `Witness_Tolerances`,
`Witness_FullCircleDomain`, `Witness_SphereDomain`, `Witness_ClosedSplineDomain`,
`Witness_MixedReport`. The runner draws
tolerances from [-10, 10], so about half its tolerance draws fail the well-formedness guards and
count as vacuous.

The theorems in `foundation.spec.plato`: `CoincidenceIsNotTransitive`, `CoincidenceChainBound`,
`WrapIsTheCanonicalRepresentative`, `ParameterToleranceBoundsMotion`, `UvToleranceBoundsMotion`,
`ReportsFormAMonoid`, `IsCleanIsAMonoidHomomorphism`, `WorseOfFoldIsWellDefined`. All but
`UvToleranceBoundsMotion` name the laws that test them.

## Open questions

1. **`Number` width.** The layer works in both widths, and `Law_LengthToleranceResolvable` shows
   the cost: 0.19 model units of resolution at 1e5 in 32 bits. The decision stays with the owner
   (PLAN.md question 1, TARGET-LANGUAGE.md).
2. **The reference speed in `ParameterFloor`.** The `max(modelSize, 1)` assumes length parameters
   have unit speed. A STEP `line` whose `vector` has magnitude 1000, or a B-spline with a short knot
   span, moves faster; there the floor binds and the tolerance is looser than `Length / speed` by
   `speed / max(modelSize, 1)`. Layer 1 could instead compute a floor per curve from its largest
   speed.
3. **Reading of "ten times the criterion"** in SPEC-DSL.md section 4. `SeverityOf` uses
   `worst < 10 * bound`; the other reading is `worst - bound < 10 * bound`.
4. **A sample count in `Check`.** SPEC-EXECUTION.md 5.1 item 4 wants a vacuity rate per law. A
   `Check` does not record how many samples it took; a `Samples: Integer` field would carry it.
   The type is fixed in VOCABULARY.md, so it is not added here.
5. **The angle tolerance when the file has none** (layer 3). A default consistent with the length
   tolerance is `Length / modelSize` radians: two directions that differ by less diverge by less
   than the length tolerance across the whole model.
6. **The name `SameParameter`.** In Open CASCADE "same parameter" is a property of an edge whose
   pcurve and 3D curve share a parameterization, which STEP has no flag for. Kept as VOCABULARY.md
   proposed, to spare concurrent authors a rename; `CoincidentParameter` would avoid the clash.
7. **Overlapping case names.** `Provenance.StepInstance` shares its name with layer 3's type
   `StepInstance`; `ConstraintGroup.Geometric` with layer 7's `ConformanceLevel.Geometric`. Both
   compile when qualified (PLATO-PRIMER.md probes L08, L09), and SPEC-DSL.md already requires the
   qualified form.
8. **Constructor discipline.** Phase 3 should check that every `Check_` in layers 2 to 7 builds its
   result through `CheckWithin`, `CheckExact` or `WorseOf`, and every report through `ReportOf`,
   `Merge` or `Empty`.

## Implementation notes

- `RoundingUnit` and `SmallestNormal` are constants written as loops (53 and 1022 halvings in 64
  bits) because the stdlib has no such constant and `Number.Epsilon` means something else. An
  implementation folds them, or replaces them with the host's 2^-53 and 2^-1022; `ResolutionAt`
  calls both.
- `Wrap` is `t - p floor(t / p)` followed by one correction on each side. Do not replace it with
  the C# `%` operator, which keeps the sign of `t` and loses the `[0, p)` range.
- `ShortestDifference` compares `w + w` with `p`, not `w` with `p * 0.5`: halving a subnormal
  period rounds, doubling never does.
- Every guard in a law uses `? :`; `&&` appears only between operands that cannot fault.
- `Report([], [])` type-checks because the constructor fixes the element types.
- The scratch fuzzer used for the error analysis is not part of the design. Its cases are the
  calibration set for the law runner when it exists: multiples of 2 pi offset by 1e-12, periods
  from 4.9e-324 to 1e20, ranges whose steps sit at the resolution.
- Gate (PLATO-PRIMER.md E.3, this folder alone, the three `brep.*.plato` files excluded):
  `PASS: 0 error(s) in scope; 3937 functions type-checked`, with no lint or style findings. A
  negative control with two injected type errors failed as expected, so the driver does check
  these files.

## Changes to the contract

Fixed names: none changed. All 13 indices, the three tolerances, `Tolerances`, `Periodicity`,
`CurveDomain`, `SurfaceDomain`, `DomainSide`, `MeshVertexProvenance`, `Provenance`, `Severity`,
`Check`, `Diagnostic`, `Report` are declared exactly as VOCABULARY.md states them.

Proposed names: all kept, with these signatures settled.

| Name | Settled as | Reason |
|---|---|---|
| `Coincident` | `(Point3D, Point3D, LengthTolerance)`, `(Point3D, Point3D, Tolerances)`, `(Point2D, Point2D, LengthTolerance)` | the `Tolerances` form reads the model's length tolerance |
| `SameDirection` | `(Direction3D, Direction3D, AngleTolerance)` and a `Tolerances` form | as above |
| `SameParameter` | `(Number, Number, ParameterTolerance)`, `(CurveDomain, Number, Number, ParameterTolerance)`, `(UvCoordinate, UvCoordinate, UvTolerance)`, `(UvCoordinate, UvCoordinate, ParameterTolerance)`, `(SurfaceDomain, UvCoordinate, UvCoordinate, UvTolerance)`; no `Tolerances` form | the parameter tolerance is per point |
| `Wrap` | `(t, period)` into `[0, period)`; also `(CurveDomain, t)` and `(SurfaceDomain, uv)` | the domain forms wrap into `[Range.Start, Range.Start + period)` |
| `ShortestDifference` | `(from, to, period)`, the step from `from` to `to`, in `[-period/2, period/2)` | fixes the sign |
| `NearestUnwrapped` | `(t, reference, period)`; also domain and `UvCoordinate` forms | |
| `Samples`, `SamplePlan` | `Samples(range, count)`, `Samples(CurveDomain, SamplePlan)`, `Samples(SurfaceDomain, SamplePlan)` | |

Meaning settled:

- `Tolerances.Parameter` is the model-wide parameter **floor**, set by layer 3 with
  `ParameterFloor`; the parameter tolerance at a point comes from `ParameterToleranceAt` or
  `UvToleranceAt`, applied by layer 1.
- A well-formed ("positive") tolerance is finite and at least the smallest normal `Number`.
- `Diagnostic.Code` is the failed law's name, or a producing layer's code for a finding outside any
  law; `Diagnostic.Measure` and `Check.Worst` are NaN (`Number.Unmeasured`) when nothing was
  measured.
- `Check` is built only by `CheckWithin`, `CheckExact`, `WorseOf`; `Report` only by `Empty`,
  `Merge`, `ReportOf`.

New exported names: the types `UvTolerance` and `ConstraintGroup`, and the functions
`RoundingUnit`, `SmallestNormal`, `ResolutionAt`, `IsResolvable`, `Unmeasured`, `IsWellFormed`
(for each tolerance, `Tolerances`, `Periodicity`, `SamplePlan`), `ParameterFloor`,
`ParameterToleranceAt`, `IsSpeedAndCap`, `ParameterToleranceCap`, `UvToleranceAt`,
`AngleBetweenDirections`, `CanWrap`, `PeriodicDistance`, `IsPeriodic`, `PeriodOr`,
`ParameterLength`, `IsProper`, `IsFullPeriod`, `ContainsParameter`, `ContainsPeriodic`, `IsUSide`,
`OppositeSide`, `SideValue`, `SideRange`, `SidePoint`, `StepsAreResolvable`, `ToProvenance`,
`CarrierDimension`, `IsError`, `SeverityOf`, `CheckWithin`, `CheckExact`, `Outranks`, `WorseOf`,
`DiagnosticOf`, `Empty` (on `Report`), `Merge`, `ReportOf`, `ErrorCount`, `IsClean`, `Identical`,
`Corresponds`. Each was checked against `stdlib/types-and-concepts.txt` and the stdlib's library
files; the only same-named stdlib functions are `Wrap(Angle, Angle)` and `Empty` on `Bounds2D` and
`Bounds3D`, which overload by parameter type.

## Fix wave, 2026-10-17

Findings from [../reviews/MATH-REVIEW-layers-0-6.md](../reviews/MATH-REVIEW-layers-0-6.md), the
"Findings in lower layers" of layers 7 and 8, and [../reviews/FIX-WAVE.md](../reviews/FIX-WAVE.md),
one commit each (TKT-299).

Applied:

1. **T1, C1: `Periodicity.Closed(Period)`.** A third case for a direction whose point set wraps and
   whose formula does not; every seam function sees it as a period, `IsPeriodic` does not
   ("Closed directions" above). New: `HasSeam` (on `Periodicity` and `CurveDomain`),
   `Law_ClosedPeriodIsRangeLength`, `Law_WrapOnClosedDomainStaysInRange`,
   `Witness_ClosedSplineDomain`.
2. **C9, T4, F7 (third item), layer 7 finding 4: `Check.Bound`.** Set by `CheckWithin` (its bound)
   and `CheckExact` (0), kept by `WorseOf`. `WorseOf` ranks by `Exceedance`, so the fold keeps the
   sample farthest past its own per-point bound and `SeverityOf` grades that sample.
   `DiagnosticOf(c, g, message)` and `ReportOf(c, g, message)` drop their `bound` argument and read
   the check's. `Law_HoldingCheckIsWithinBound(c, bound)`, false for any bound but the check's own,
   is replaced by `Law_HoldsExactlyWhenWithinBound(c)`, now a type invariant; new
   `Law_CheckBoundIsNonNegative`, `Law_WorseOfKeepsTheGreaterExceedance`, `Exceedance`.
3. **Layer 7 finding 3, layer 8 finding 5: `Provenance` cases and `Located`.** `WholeInput`,
   `KernelCurve(Index: CurveIndex)`, `KernelSurface(Index: SurfaceIndex)`; `Located(d: Diagnostic,
   where)` and `Located(r: Report, where)`, moved from layer 8 and listed as a constructor of
   `Report`. New laws `Law_LocatedKeepsVerdict`, `Law_LocatedKeepsFindings`.
