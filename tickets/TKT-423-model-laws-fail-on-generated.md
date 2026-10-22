---
id: TKT-423
title: STEP mesher: 23 model-validity laws of layers 0 and 1 fail on the runner's generated values, because they state a check over any value with no precondition
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**]
workflow: [W3]
related: [TKT-418, TKT-356]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Each of the 23 laws (listed below) either holds on every generated case or is restated over decoded witness values or behind the containing value's IsWellFormed, so the claim it makes about the library is checked and the runner's malformed values are not
- [ ] reviews/verdicts-cpu64.tsv records the 23 as pass

Found 2026-10-22 by the v1-gate track's triage (V1G-5, sandbox/step-mesh-staging/v1-gate/TRACK.md). The laws are the predicates of layer 7's model checks (comments say Model law or Convention law), for example Law_LengthTolerancePositive(t) => t.IsWellFormed. The runner builds a LengthTolerance through its constructor, so it draws 0 or -0.5 and the law fails; the library is not at fault. Laws: BrepFoundationLaws Law_AngleTolerancePositive, Law_CheckBoundIsNonNegative, Law_ClosedPeriodIsRangeLength, Law_FailedCheckHasDiagnostic, Law_HoldsExactlyWhenWithinBound, Law_LengthTolerancePositive, Law_LengthToleranceResolvable, Law_ParameterTolerancePositive, Law_WrapOnClosedDomainStaysInRange; BrepGeometryLaws Law_BSplineCurve2D{DegreePositive, DomainNonEmpty, KnotCount, KnotsNonDecreasing, WeightCount, WeightsPositive}, Law_BSplineCurve{DegreePositive, DomainNonEmpty, KnotCount, KnotsNonDecreasing, WeightCount, WeightsPositive}, Law_CurvePlacementOrthonormal, Law_SurfacePlacementOrthonormal (the last two noted in FINDINGS F-58: no guard on a positive angle tolerance). Gate kind: structure (input validity the gate laws rely on). Fence: none of the v1 tracks; supervisor.
