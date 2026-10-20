# catalog-foundation: TYPE-CATALOG.md sections 1 and 2, and four section 15 concepts, in Plato

Ticket: TKT-323
Status: ready: catalog-foundation

## Done
- catalog-foundation, 135f4a5f (types, concepts, libraries, laws) and the commit holding this file
  (spec, TRACK.md), about 1.5 hours against 2 expected: 57 `Law_Catalog_` laws, all pass under
  cpu64; zero type errors in this folder.

Types added (41):
- Section 1 (21): `ModelLength`, `Metres`, `SquaredLength`, `AreaMeasure`, `VolumeMeasure`, `Ratio`,
  `Fraction`, `PowerOfTwoFactor` (the catalog's `PowerOfTwo`, see Contract requests), `Resolution`,
  `MeasureKind`, `Measure`, `Sign`, `Sense`, `Parity`, `Winding`, `Count`, `NonZeroCount`,
  `SegmentCount`, `SampleCount`, `Round`, `Depth`.
- Section 2 (20): `CurveParameter`, `Curve2DParameter`, `EdgeParameter`, `KnotParameter`,
  `ArcLength`, `NormalizedParameter`, `WrappedAngle`, `UnwrappedAngle`, `ParameterRange`,
  `DirectedRange`, `PeriodicRange`, `IsoLine`, `UvPoint`, `UvDelta`, `ChartPoint`, `ModelPoint`,
  `LocalPoint`, `UvBox`, `ChartBox`, `DomainCorner`.
- Concepts (4): `IScaled` (ModelLength, SquaredLength, AreaMeasure, VolumeMeasure), `IMoved`
  (ModelPoint), `IReversible` (Sense, Winding, DirectedRange), `IHasDomain<TDomain>` (no
  implementer yet; LINT009 info "unreachable").

Files: `catalog-{quantities,signs,counts,parameters,points}.{types,library,laws}.plato`,
`catalog-foundation.concepts.plato`, `catalog-foundation.spec.plato`.

Completions the catalog only sketched:
- `SignWithin(x, tol: Resolution)`: the tolerance is a `Resolution`; `Resolution.Exact` is zero.
- `Sense` composes as XOR with `Same` the identity; `ToSense` has overloads for `EdgeOrientation`,
  a STEP Boolean flag, and a `Parity`; `ToSign(Sense)` is a homomorphism to `Sign` (a law).
- `Parity` composes the same way; `ParityOf(n)`, `Flipped`.
- Counts: `CountOf`, `NonZeroCountOf`, `SegmentCountOf` clamp to their floor; `SampleCount` has
  floor 2 (segments + 1); `SegmentCount.ClosedEdgeMinimum` is 3; `First`/`NextRound`,
  `Root`/`Deeper`.
- `IsoLine { Constant: SurfaceParameter; At: Number }`: the field is named `Constant`, not the
  catalog's `Direction`, because it names the parameter held fixed; `(ParameterU, 0.5)` is u = 0.5.
- `DirectedRange { Start; End }`; `PeriodicRange` made by `PeriodicRangeOf(start, end, period)`
  (length is `(end - start).Wrap(period)`) or `FullPeriod`.
- `DomainCorner` names U's end then V's: `MinMax` is (U.Start, V.End); `NextCorner` runs
  counter-clockwise.
- `Measure` constructors: `ToMeasure` overloads for ModelLength, Angle, AreaMeasure,
  VolumeMeasure, Count, Ratio, CurveParameter; `IsWithin(worst, bound)` is false across kinds.
- Renamed to avoid LINT014 (a field of the same name forces property syntax in C#):
  `RangeLength(ParameterRange)`, `UnwrappedEnd(PeriodicRange)`, `NextRound(Round)`.

Laws (57, all pass, cpu64, 2026-10-20):
- Quantities (13): UnitRoundTrips, SquaredThenSqrtIsMagnitude, SquaredDistanceIsNonNegative,
  AreaScalesBySquare, VolumeScalesByCube, ScaledThenUnscaledIsIdentity, FactorTimesInverseIsOne,
  FractionOfIsInUnitInterval, FractionOfKeepsUnitValues, ResolutionIsPositive,
  ToMeasureKeepsLengthKind, LengthIsNeverWithinAngleBound, MeasureIsWithinItself.
- Signs (12): SignIsAntisymmetric, SignOfProductIsProduct, SignWithinToleranceIsZero,
  ComposeIsAssociative, SameIsLeftIdentity, SameIsRightIdentity, SenseReversedTwiceIsIdentity,
  ToSignOfComposeIsProduct, ToSenseOfEdgeOrientation, ParityOfSumIsComposed, ParitySenseComposes,
  WindingReversedTwiceIsIdentity. Sum-valued laws take Integer selectors (`CatalogSenseAt`), so
  the runner reaches every case.
- Counts (10): CountOfIsNonNegative, NonZeroCountOfIsPositive, SegmentCountIsAtLeastOne,
  ClosedEdgeMinimumIsThree, SampleCountIsAtLeastTwo, SegmentsOfSamplesOfIsIdentity,
  SamplesOfSegmentsOfIsIdentity, NextRoundIsLater, DeeperIsDeeper, CountHashAgreesWithEquality.
- Parameters (13): NormalizedParameterRoundTrips, WrapIsInOneTurn,
  WrapThenUnwrapNearReferenceIsIdentity, NearestUnwrappedIsWithinHalfTurn, RangeOfIsOrdered,
  RangeOfIsSymmetric, RangeOfKeepsEnds, DirectedRangeReversedTwiceIsIdentity,
  ReversedRangeCoversSameParameters, PeriodicRangeLengthIsWithinPeriod,
  PeriodicRangeContainsStart, PeriodicRangeContainsEnd, IsoLinePointIsOnLine.
- Points (9): UvDeltaRoundTrips, UnitSquareRoundTrips, ChartRoundTrips, MirrorNegatesChartX,
  PlacedIsMoved, UvBoxOfContainsBothPoints, ChartBoxOfContainsBothPoints, NextCornerCyclesInFour,
  CornerIsInDomainBox.
- Computed Numbers are compared within `ResolutionAt` of their magnitude
  (`CatalogAgreesToRounding`), never a literal epsilon.
- No law yet for `ToCurveParameter(m, e, t)` or `IsBreakKnot(KnotParameter, SplineBasis, order)`:
  both need a `BrepModel` or `SplineBasis` witness; they are thin wrappers over layer 1 and 2
  functions whose own laws cover them.

## Merge instructions
- Move every file into `00-foundation` (quantities, signs, counts, parameters, points, concepts,
  spec); the parameter-to-model functions (`ToCurveParameter`, `IsBreakKnot(KnotParameter, ...)`)
  depend on layers 1 and 2 and belong in `02-topology` and `01-geometry` respectively.
- Rename `Law_Catalog_*` to the layer's law prefix at merge.

## Contract requests
- `PowerOfTwo`: the library has `PowerOfTwo(k: Integer): Number` in
  `08-pipeline/pipeline.laws.plato:58` (used by `pipeline.laws.plato`, `pipeline.spec.plato` and
  `09-tooling/tooling-generators.library.plato:318,407`). A type named `PowerOfTwo` derives a
  constructor `PowerOfTwo(Integer)`, and every existing call becomes CHK203 ambiguous. The type is
  declared as `PowerOfTwoFactor { Exponent: Integer }` with `Factor`, `Inverse`, and `IScaled`
  over it. Request: rename the function (for example `PowerOfTwoValue`, or replace its callers
  with `PowerOfTwoFactor(k).Factor`), then rename the type to `PowerOfTwo`.
- `Check`: `Worst` and `Bound` should become `Measure` (catalog section 1, **extend**).
  `MeasureKind` and `Measure` are declared here; `Check` is untouched.
- `ResolutionAt(magnitude: Number): Number` should return `Resolution`. Declared beside it as
  `ResolutionFor(magnitude): Resolution`; the change touches every caller of `ResolutionAt`.
- `CoedgeRunsForwardOnCurve` (layer 2) can become
  `Compose(Compose(ToSense(edge.SameSense), ToSense(coedge.IsForward)), ToSense(bound.Orientation))`.

## Requests to other tracks
- None. No borrowed types.

## Findings
- The plato-navigation server keeps a removed type alive for a staging path it has compiled
  before: after renaming `PowerOfTwo` to `PowerOfTwoFactor`, every run on
  `sandbox/step-mesh-staging/catalog-foundation` still reported CHK203 "return types Number |
  PowerOfTwo", with `recompiled True`, while the same files copied to a fresh path compiled clean.
  Workaround used: copy the folder to a new scratch path for every check. A file that does not
  parse also reports "0 type errors" (TKT-337, seen again).
- The server's check does not report LINT001 (missing interface obligation); a type implementing
  `IReversible` with no `Reversed` passed. The pinned CLI `lint` run over the library and this
  folder gave no LINT001 and no warning for this folder; four infos (LINT014 three times, fixed;
  LINT009 for `IHasDomain`; LINT003 for `ChartBox` fields, fixed by `Contains(ChartBox, ...)`).
- The catalog says `ToCurveParameter(m, e, t)` "applies SameSense". Layer 2's `EdgeDomain` already
  runs in increasing curve parameter whatever `SameSense` (SameSense only picks which vertex is at
  `Start`, `DomainEndParameter`), so the conversion is only a wrap into the curve's domain, as
  `EdgeCurvePoint` does. The catalog's sentence should be corrected.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer, spec DSL, catalog, layer 0 and 5 files) | 15 min | |
| Writing types, concepts, libraries | 20 min | |
| Writing laws and spec | 20 min | |
| Type-check runs | 10 min | 9 server runs, 1 CLI lint |
| Law runs | 2 min | 2 runs (56, then 57 laws) |
| Waiting on the server | 0 min | never busy |
| Diagnosing the stale-path cache | 10 min | 4 runs |
| Committing | 3 min | 2 commits |

## Lessons
- Grep the library's function names, not only its type names, before declaring a product type:
  the derived constructor joins the function's overload group (`PowerOfTwo`).
- When a check result does not change after an edit, compile a copy at a fresh path before
  debugging the code.
