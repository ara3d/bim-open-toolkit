---
id: TKT-456
title: STEP mesher: the live insertion passes (SurfacePassCarried, AnglePassCarried, TryInsertionIndexed) have no agreement law, and about ten agreement laws compare a function with an alias of itself
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/face-quality.laws.plato]
workflow: [W3, W4]
related: [TKT-323]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] an agreement law compares SurfacePassCarried, AnglePassCarried and TryInsertionIndexed with the Local reference forms on the refinement witnesses, and passes
- [ ] every agreement law named in docs/plans/step-mesher-consolidation-2026-10-22.md as comparing a function with an alias of itself either compares against a real reference or is deleted

Found by the read-only consolidation review of 2026-10-22 (docs/plans/step-mesher-consolidation-2026-10-22.md, layers 04-05 finding 1 and 6). Law_TrialAgreesWithTryInsertion, Law_SurfacePassBuiltAgrees, Law_AnglePassBuiltAgrees and Law_StripPassAgrees compare the Built generation with the Local one; neither is the code the mesher runs. Law_RefineIndexedAgrees(OnStars), Law_DelaunayedIndexedAgrees(OnStars), parts of Law_ThirteenHolesAgree and CdtIndexedAgreesOn compare a function with an alias of itself and always pass. Correctness, not cleanup: the live refinement is checked only end to end by the corpus harness's contract check (TKT-432).
