---
id: TKT-402
title: STEP mesher host: StepPlatoMesher.MeshFile calls the sweep's once-per-model forms instead of the per-item entries that rescan the model per edge and face
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**]
workflow: [W3]
related: [TKT-323, TKT-313, TKT-358, TKT-359, TKT-364, TKT-365]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] MeshFile builds EdgeFaceTable, TwoEdgeLoopEdges, the in-range flag and the arena-ok flag once per model and calls the ranged per-edge and per-face entries (what DiscretizeAllRanged and FaceOutcomeInRange do per row), keeping per-row exception isolation and the same StepPlatoFailure records
- [x] The three baseline files of docs/plans/step-mesher-ideas-evaluation.md (EMMY-W1, NINA-B400, a TKT-349 file) give the same vertex and triangle counts and position hash on both paths, and the plan's hoisted-path timings are reproduced by the host within noise
- [x] The corpus harness (deps/bim-open-data/tools/step-corpus-harness) drops its own restatement of the hoisted path and calls MeshFile

Found by run G of the speed-ideas evaluation (docs/plans/step-mesher-ideas-evaluation.md, new idea 22): the host calls CanDiscretize (Law_IndicesInRange over every table, once per edge; hoisted by G1), Discretize -> DiscretizeBounded -> UsableImages -> EdgeImages -> FacesOfEdge (every face scanned per edge, EdgeDomain recomputed; replaced by E1 and E2) and IsDiscretizedFace -> IsEveryIndexInRange per face (replaced by G2). The sweep's gain never reaches the host until this lands. About 1 h. Layer 8's MeshModel stays uncalled until its loop stops re-meshing per read (see the host's own comment).

## Log

- 2026-10-21, builder 14b9bcc0, bim-open-data 33206f5. `StepPlatoTables` (new, `Plato/StepPlatoTables.cs`) builds the
  index-range law, the edge-face table, the two-edge-loop flags and the arena flag once per model; `MeshFile` calls
  `DiscretizeEdgeRangedCounted` per edge and `IsDiscretizedFaceIn` then `MeshFace` per face through it, exception
  isolation and failure records unchanged. The harness's `MeshPath` is now the host's tables timed (`--path host`;
  `hoisted` gone) and its summary carries a `MeshCheck`. Harness, warm, minimum of three runs, run A's binary beside
  this one on the same machine: EMMY-W1 hoisted 484 ms, old host 723, this host 505 (edge stage 21 to 27, 288 to 487,
  28 to 34 ms); ODIN-W160 hoisted 4,899, old host 53,061, this host 4,484 (edges 263 to 398, 34,414 to 42,935, 235 to
  406 ms). The machine was 2x slower than during run A on every path, so the plan's absolute hoisted timings (577 and
  2,751 ms) are reproduced only in ratio. Digests unchanged on EMMY-W1 (2,279 vertices, 4,342 triangles,
  A6150C71276BDCE4), NINA-B400 (3,620, 6,680, E52C64A09BB0CB7B), ODIN-W160 (17,623, 33,394, 20F057D2B3C44BF3) and
  LILY-W131 (8,522, 16,592, A9492191231F5A5D); every mesh closed and oriented with 0 boundary, non-manifold or
  misoriented edges; `--path meshfile` gives the same digest as the time mode.
