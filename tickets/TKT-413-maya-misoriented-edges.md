---
id: TKT-413
title: STEP mesher: the assembled meshes of SHO/M2-MAYA-W271.step and the three MAYA-W26x_REVC files have 2 to 4 non-manifold and 4 misoriented edges, the only such edges in the corpus
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**]
workflow: [W3]
related: [TKT-313, TKT-405]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] The four files' assembled meshes have 0 non-manifold and 0 misoriented edges, or the face each such edge comes from carries a diagnostic naming it
- [ ] The corpus rerun reports 0 misoriented edges

Found by the corpus rerun of 2026-10-21 (library 8984df4b, PreferQuads on since TKT-405): MeshCheck over the assembled mesh finds SHO/M2-MAYA-W271.step 2 non-manifold and 4 misoriented edges (4,944 faces, 4,737 meshed), SHO/MAYA-W260_REVC.step 4 and 4 (1,754 faces), SHO/MAYA-W261_W271_REVC.step 4 and 4 (1,485), SHO/MAYA-W266_W276_REVC.step 4 and 4 (1,737). The other 83 finished files have none. Boundary edges in these files come from unmeshed faces (TKT-410, TKT-412) and are not the defect. Not yet traced to a face: the harness's per-face rows and MeshCheck restricted to one face's triangles would find it. Possible causes: a quad grid or a lifted triangle wound against its neighbour on one of the not-simple-adjacent faces, or the mirror fold in PrepareModel on an occurrence of these files.
