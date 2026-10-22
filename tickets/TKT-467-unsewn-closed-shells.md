---
id: TKT-467
title: STEP mesher: closed shells written with each face's own vertices and edges are never sewn, so THEO-P173 and the MAYA REVC files mesh 4,170 boundary edges inside closed shells
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/11-repair/**]
workflow: [W3]
related: [TKT-323, TKT-413, TKT-419]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness closed shell whose faces cite separate vertex and edge records at the same positions (the unit box with every face's edges duplicated) states that preparation leaves every edge cited by exactly two faces, records each merge, and fails on the current library
- [ ] SHO/THEO-P173.STEP meshes with every closed shell closed (the harness's ClosedShellsClosed, bim-open-data 97495d8 or later), or each shell left open carries a located diagnostic
- [ ] No edge of the 88 corpus files is cited once inside a shell declared closed after preparation, apart from those each such diagnostic names

Found 2026-10-22 by track v1-edges, classifying the boundary edges of the corpus run of 2026-10-22 (library 43dd439b, bim-open-data b2cfaf3; per-file lines in the side-session notes, v1-edges-boundary-classes-2026-10-22.txt). 4,170 boundary edges lie in shells the file declares closed on a model edge that only one face cites: THEO-P173 3,895 (366 of its 451 closed shells are open in the mesh), MAYA-W260_REVC 235, W261 and W266 20 each. Of the cited-once edges, 1,828 of 1,848 in THEO-P173, 104 of 105 in W260 and 20 of 20 in W261 have another edge between different vertex records at the same positions (within 10 times the length tolerance); 8 in W260 even share both vertices with a second edge record. The file writes each face of a closed shell with vertices and edges of its own, and PrepareModel never joins them: Reduced merges only vertices that an edge or a loop's head-to-tail joint brings together. The repair is sewing in preparation: within a shell, merge vertices that coincide at the length tolerance, then merge edges on the same two vertices whose curves agree, recording each merge (RepairRecord, as Reduced does) and reporting an edge that coincides with another but whose curve does not. The remaining 20 THEO-P173 edges and 1 W260 edge have no twin and are a separate finding.
