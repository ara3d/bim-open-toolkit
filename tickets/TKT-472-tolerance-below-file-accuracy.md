---
id: TKT-472
title: STEP decoder: the decided length tolerance is tighter than the file's own accuracy, so edges sit off their faces and vertices off their curve ends by more than the tolerance in 9 corpus files
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**]
workflow: [W3]
related: [TKT-441]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] EdgeLiesOnAdjacentSurfaces, VertexCoincidesWithCurveEnd and EdgeDomainEndsAtVertices pass on the prepared models of POS/MAX (STEP-AP214), POS/SAM_AP203 and AP214, SHO/JODY-W4, SHO/M2_JODY-W5 and W6 CARD, POS/ZOE_S-LGA51 (both), SHO/NORA-B120, B121, B126 and POS/ANN-MB2, by a tolerance that covers the file's measured gaps or a located diagnostic naming the gap

Found by layer 7's checks on every corpus file (TKT-441; docs/plans/step-mesher-reliability-2026-10-22.md (TKT-441 section); run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8, library before J5). Prepared models: edges off their adjacent surfaces by 2.0e-5 to 3.6e-4 mm against a length tolerance of 2e-6 to 1e-5 mm (MAX face 156 3.6e-4, SAM face 0 8.8e-5, JODY-W5/W6 face 897 1e-4, JODY-W4 face 61 2e-5); vertices off their curve ends by 2.4e-5 mm (NORA-B120 edge 7981, B121 7727, B126 7871, bound 2e-6) and 3.9e-3 mm (ZOE_S-LGA51 edges 2418, 2420, bound 1e-5); ANN-MB2 edge 1252 1.2e-5 against 1e-5. A tolerance below the file's own accuracy makes every coincidence test downstream (vertex merges, closure, seam pairing) decide on noise. NINA-B222's 0.365 mm (edge 1507) predates J5 and is not counted here.
