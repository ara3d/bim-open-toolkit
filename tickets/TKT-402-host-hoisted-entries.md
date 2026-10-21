---
id: TKT-402
title: STEP mesher host: StepPlatoMesher.MeshFile calls the sweep's once-per-model forms instead of the per-item entries that rescan the model per edge and face
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**]
workflow: [W3]
related: [TKT-323, TKT-313, TKT-358, TKT-359, TKT-364, TKT-365]
created: 2026-10-21
---

## Acceptance criteria

- [ ] MeshFile builds EdgeFaceTable, TwoEdgeLoopEdges, the in-range flag and the arena-ok flag once per model and calls the ranged per-edge and per-face entries (what DiscretizeAllRanged and FaceOutcomeInRange do per row), keeping per-row exception isolation and the same StepPlatoFailure records
- [ ] The three baseline files of docs/plans/step-mesher-ideas-evaluation.md (EMMY-W1, NINA-B400, a TKT-349 file) give the same vertex and triangle counts and position hash on both paths, and the plan's hoisted-path timings are reproduced by the host within noise
- [ ] The corpus harness (deps/bim-open-data/tools/step-corpus-harness) drops its own restatement of the hoisted path and calls MeshFile

Found by run G of the speed-ideas evaluation (docs/plans/step-mesher-ideas-evaluation.md, new idea 22): the host calls CanDiscretize (Law_IndicesInRange over every table, once per edge; hoisted by G1), Discretize -> DiscretizeBounded -> UsableImages -> EdgeImages -> FacesOfEdge (every face scanned per edge, EdgeDomain recomputed; replaced by E1 and E2) and IsDiscretizedFace -> IsEveryIndexInRange per face (replaced by G2). The sweep's gain never reaches the host until this lands. About 1 h. Layer 8's MeshModel stays uncalled until its loop stops re-meshing per read (see the host's own comment).
