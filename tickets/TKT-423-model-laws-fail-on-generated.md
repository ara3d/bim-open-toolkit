---
id: TKT-423
title: STEP mesher: 23 model-validity laws of layers 0 and 1 fail on the runner's generated values, because they state a check over any value with no precondition
status: claimed
depends_on: []
owner: session 926ba8f2
session: 926ba8f2-bca1-4ee8-ba05-864e69eba3b2
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**]
workflow: [W3]
related: [TKT-418, TKT-356]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Each of the 23 laws (listed below) either holds on every generated case or is restated over decoded witness values or behind the containing value's IsWellFormed, so the claim it makes about the library is checked and the runner's malformed values are not
- [ ] reviews/verdicts-cpu64.tsv records the 23 as pass

Found 2026-10-22 by the v1-gate track's triage (V1G-5, sandbox/step-mesh-staging/v1-gate/TRACK.md). The laws are the predicates of layer 7's model checks (comments say Model law or Convention law), for example Law_LengthTolerancePositive(t) => t.IsWellFormed. The runner builds a LengthTolerance through its constructor, so it draws 0 or -0.5 and the law fails; the library is not at fault. Laws: BrepFoundationLaws Law_AngleTolerancePositive, Law_CheckBoundIsNonNegative, Law_ClosedPeriodIsRangeLength, Law_FailedCheckHasDiagnostic, Law_HoldsExactlyWhenWithinBound, Law_LengthTolerancePositive, Law_LengthToleranceResolvable, Law_ParameterTolerancePositive, Law_WrapOnClosedDomainStaysInRange; BrepGeometryLaws Law_BSplineCurve2D{DegreePositive, DomainNonEmpty, KnotCount, KnotsNonDecreasing, WeightCount, WeightsPositive}, Law_BSplineCurve{DegreePositive, DomainNonEmpty, KnotCount, KnotsNonDecreasing, WeightCount, WeightsPositive}, Law_CurvePlacementOrthonormal, Law_SurfacePlacementOrthonormal (the last two noted in FINDINGS F-58: no guard on a positive angle tolerance). Gate kind: structure (input validity the gate laws rely on). Fence: none of the v1 tracks; supervisor.

## 2026-10-22: rerun under the runner's generator rule (TKT-446)

Plato 7859fdce draws a type with a `Generate_X(seed: Integer): T` function only from its generators and witnesses, never field by field. With the tolerance generators of `sandbox/step-mesh-staging/v1-generators/` (`Generate_LengthTolerance`, `Generate_AngleTolerance`, `Generate_ParameterTolerance`, `Generate_Tolerances`), the 23 laws under `plato run --laws --profile=cpu64 --budget=60` (stdlib tiers plus the library, the warm server's `brep.*` excludes) go from 0 pass, 23 fail to 6 pass, 17 fail.

- Now pass: Law_LengthTolerancePositive, Law_AngleTolerancePositive, Law_ParameterTolerancePositive, Law_LengthToleranceResolvable, Law_CurvePlacementOrthonormal, Law_SurfacePlacementOrthonormal.
- Still fail, each on a type with no generator yet: Law_ClosedPeriodIsRangeLength and Law_WrapOnClosedDomainStaysInRange (`CurveDomain`: a Closed period that is not the range length); Law_HoldsExactlyWhenWithinBound and Law_CheckBoundIsNonNegative (`Check`: a negative bound, a Holds flag that disagrees with Worst); Law_FailedCheckHasDiagnostic (`Report`); the six Law_BSplineCurve* laws (`BSplineCurveData`) and the six Law_BSplineCurve2D* laws (`BSplineCurve2DData`): negative degrees, unsorted knots, wrong counts.

A generator per type (`Generate_CurveDomain` building through the decoder's constructors, `Generate_Check` through CheckWithin/CheckExact, `Generate_Report` through Empty/Merge/ReportOf, B-spline data through a valid basis) is the other way to close this ticket besides restating the laws; the merge of v1-generators needs the Plato pin at 7859fdce or later.

## 2026-10-22: generators for the five remaining types (v1-generators G2)

`sandbox/step-mesh-staging/v1-generators/` now has a generator for each of the five types, each building only through the library's own functions over seeds 0 to 15: `Generate_Check` (CheckExact, CheckWithin, WorseOf), `Generate_Report` (Empty, ReportOf, Merge, Located, and a decoder diagnostic from `Diagnose`), `Generate_CurveDomain` (FullTurnDomain, UnboundedDomain, BoundedDomain, WithClosure, TorusVDomain, and layer 2's TraversalDomain), and `Generate_BSplineCurveData` / `Generate_BSplineCurve2DData` (a STEP knot spec that passes `ConstraintsParamBSpline`, expanded by multiplicity, with positive weights; `Law_V1Generators_KnotSpecsDecodable` checks every seed's spec). `generator-seeds.laws.plato` runs the 17 laws over every seed, since the runner samples only 25 cases.

Plato 78a7776d built from HEAD, `plato run --laws --profile=cpu64 --budget=30` over the stdlib tiers, the library and the folder with the warm server's `brep.*` excludes, filtered on the layer 0 and 1 law classes (`BrepFoundation,BrepGeometry,Bspline,GeometryLawsOnce,PolishCached,ProjectAlong`):

- Before (tolerance generators only): 393 laws, 366 pass, 18 fail (the 17 below, and `Law_SagittaIsAttained`, TKT-425), 1 obligation, 8 skipped.
- After: 399 laws (the six new staging laws included), 387 pass, 3 fail, 1 obligation, 8 skipped. 16 of the 17 pass: Law_CheckBoundIsNonNegative, Law_HoldsExactlyWhenWithinBound, Law_FailedCheckHasDiagnostic, Law_WrapOnClosedDomainStaysInRange, and the twelve Law_BSplineCurve* and Law_BSplineCurve2D* laws. No other law's verdict changed. `Law_SagittaIsAttained` still fails, as before (TKT-425).
- Still fails, a real defect: **Law_ClosedPeriodIsRangeLength**. Layer 2's `TraversalDomain` (`sandbox/step-brep-mesh/02-topology/topology.library.plato:585`) gives a closed edge on a Closed curve domain the range `[first, first + period]` with `Closed(period)`, and `(first + period) - first` is not `period` in floating point. Failing case (generator seed 7): the domain [0.125, 0.225] made Closed by WithClosure, a closed edge from 0.2, gives `CurveDomain(NumberInterval(0.2, 0.30000000000000004), Periodicity.Closed(0.1))`. The law is `CurveDomain`'s declared invariant (`foundation.spec.plato:61`), so it is not weakened; `TraversalDomain` should keep it (for example a period of `(first + period) - first`), or the supervisor decides edge domains are outside the invariant and restates it. `Law_WrapOnClosedDomainStaysInRange` holds on the same domain within its slack.

The second box waits for three things: the supervisor merging the folder (merge instructions in its `TRACK.md`), the toolkit's Plato pin moving to 7859fdce or later after the version 1 wave, and the `TraversalDomain` fix. The ticket stays open.
