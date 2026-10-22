---
id: TKT-476
title: STEP mesher: a third of layer 7's checks cannot run on a corpus file: 6 never finish in 2 s and about 70 overrun on nearly every file, so they guard only witnesses
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/**]
workflow: [W3]
related: [TKT-441, TKT-335, TKT-356]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] every check the harness's laws mode runs finishes within 2 s on SHO/NINA-B400.STEP and SHO/THEO-P173.STEP, or the check states the size it is meant for and the laws mode skips it above that size with a reason

Found by the TKT-441 corpus run (docs/plans/step-mesher-reliability-2026-10-22.md (TKT-441 section); run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8). Over budget on every one of the 176 file-stages: ClosestParameterNoWorseThanSample, ProjectNearRecoversFromNearbySeed, ProjectNoWorseThanSample (and their Hoisted forms). Over budget on 174 or 175: OuterShellExactVolumePositive, ProjectIsStationary(Hoisted), AreaElementMatchesCrossProduct, BSplineSurfaceMatchesBasisSum, ConeAreaElement, NormalOrthogonalToPartial, PartialMatchesCentralDifference, ProjectRecoversParameter, ScaledSurfacePointIsScaled and about 60 more (the full list: tools/laws_corpus_table.py over the run). Only 41 of 180 checks pass on every file and stage. A known cause is TKT-335's whole-arena CanEvaluate at every sample. A check that cannot run on a real model is a law the corpus never tests.
