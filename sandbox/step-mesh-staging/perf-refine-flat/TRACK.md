# perf-refine-flat: O(T) filters in refinement and the seed, and an angle test that lifts only changed triangles

Ticket: TKT-363
Status: merged: F4 (2026-10-21, into 05-face-meshing/triangulation-fast-marks.{library,laws}.plato and the five edit sites)

## Done
- F4, this commit, about 0.6 h against 1.5 h expected: ranked candidate 7 of `docs/plans/step-mesher-complexity.md`.
  - `triangulation-fast-flat.library.plato` (library `TriangulationFastFlat`): `SurfacePassLocalFlat` (the failing filter with `[k].Take(0)`), `BelowAngleCounted(m, f, t, refused, good): Counted<Array<Integer>>` (a List builder, lifts only the triangles neither `refused` nor `good` marks), `BelowAngleKnown` (its value), `BelowAngleFlat` (BelowAngle's signature, no good marks), `AngleGoodMarks`, and `RefineToSurfaceByInsertionKnown`, which carries the angle-good mark through both passes with `CarriedMarks` the way `known` is carried.
  - `face-meshing-flat.library.plato` (library `FaceMeshingFlat`): `WindingLoopsFlat`, `EnclosedPoleLineFlat`, `TriangulateRegionCdtFlat`, each the original with `[k].Take(0)` for the `n.Range.Take(0)` empty.
  - `refine-flat.laws.plato` (library `RefineFlatLaws`): `Witness_BelowAngleWork`, slope `Insertions(1).Add(Evaluations(3))`, sizes 32 and 128 triangles of `PlaneStrip(n)` (a strip of n triangles over the unit box's plane face 0, every triangle below 30 degrees, the worst case); measured work exactly 96 Evaluations + 32 Insertions and 384 + 128, the slope's limit. `Law_Perf_BelowAngleCountsItsLifts` (lifts are 3 x unmarked triangles: all, none when all are good, half when every other one is), and agreement laws `Law_Perf_BelowAngleFlatAgrees`, `Law_Perf_SurfacePassLocalFlatAgrees`, `Law_Perf_RefineKnownAgrees` (same points, sources, triangles, quads in order on every triangulable face of every sample), `Law_Perf_TriangulateRegionCdtFlatAgrees`, `Law_Perf_WindingAndPoleFlatAgree` (over `WitnessAt(k)`, which includes the sphere, torus and cone).
  - Types added: none. `Counted<T>`, `WorkClaim` and `WorkBudget` (layer 00) carry the count; the angle-good mark is an `Array<Boolean>` like `known` and `refused`, the form `CarriedMarks` already takes.
  - Interpreter (`plato_laws.py "RefineFlatLaws,Law_WorkIsWithinSlope" --staging ... --budget 20`): 7 laws, 7 pass, 0 type errors.
  - Preservation (`plato_laws.py "TriangulationLaws,TriangulationFastLaws,FaceMeshingLaws" --staging ...`): 63 laws, 62 pass, 1 fail: `Law_RefinedInteriorMeetsMinAngle` at k = 1, as in `reviews/verdicts-cpu64.tsv`.
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-refine-flat --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=RefineFlatLaws,Law_WorkIsWithinSlope`: 7 laws, 7 pass; slowest `Law_Perf_RefineKnownAgrees` 1.18 s over 14 cases, `Law_Perf_WindingAndPoleFlatAgree` 0.61 s, the rest at most 0.53 s.

## Merge instructions
- `triangulation-fast.library.plato` `SurfacePassLocal` line 263: `t.Triangles.Count.Range.Take(0)` => `[k].Take(0)` (the body of `SurfacePassLocalFlat`).
- `triangulation-fast.library.plato`: move `BelowAngleCounted`, `BelowAngleKnown` and `AngleGoodMarks` in after `BelowAngle`; `BelowAngle(m, f, t, refused)` => `m.BelowAngleKnown(f, t, refused, [false].Take(0))` (or delete it: after the next line nothing calls it).
- `triangulation-fast.library.plato` `RefineToSurfaceByInsertion` => the body of `RefineToSurfaceByInsertionKnown` (adds `none`, `good`, `goodMid`, and the `good =` line; `BelowAngle(f, mid, carried)` becomes `BelowAngleKnown(f, mid, carried, goodMid)`, `SurfacePassLocalFlat` becomes `SurfacePassLocal`).
- `uv-regions.library.plato` `WindingLoops` line 402: `loops.Count.Range.Take(0)` => `[k].Take(0)`.
- `pole-segments.library.plato` `EnclosedPoleLine` line 93: `lines.Count.Range.Take(0)` => `[k].Take(0)`.
- `triangulation-cdt.library.plato` `TriangulateRegionCdt` lines 110 and 115: `r.Holes.Count.Range.Take(0)` => `[h].Take(0)`.
- Move `Witness_BelowAngleWork`, `PlaneStrip`, `BelowAngleWork` and `Law_Perf_BelowAngleCountsItsLifts` (renamed `Law_BelowAngleCountsItsLifts`) into `triangulation-fast.laws.plato`; drop the agreement laws and the six staged copies once the edits above are made.

## Contract requests
- none.

## Requests to other tracks
- R1 (TKT-383, `perf-insertion`) rewrites `SurfacePassLocal` and `AnglePassLocal`; it should start from the merged F4 body of `RefineToSurfaceByInsertion` (the carried `good` mark), not the current one.

## Findings
- No floating-point result changes: every replacement gives the same value. `Law_Perf_RefineKnownAgrees` checks the whole refinement point for point on every triangulable sample face.
- The witness family is a synthetic plane strip, not a refined plane face: a refined face's triangle count is not a parameter, and the angle test's work depends only on the count and the marks. The strip with no marks is the worst case (every triangle lifted and kept).
- Compiled timing depends on concurrency: run together with `TriangulationLaws` on 22 threads, `Law_Perf_RefineKnownAgrees` took 2.72 s and eight existing `TriangulationLaws` (`Law_CdtIsConforming` 4.48 s, `Law_MinAngleBetterOnCylinders` 3.80 s, `Law_RefineMeetsContract` 2.37 s, ...) went over the 2 s budget too; run alone, the chunk's laws take at most 1.18 s. The existing laws' cost is chunk L4's (candidate 37).
- The compiled run reports "1 degraded bodies" with or without this folder's laws in the filter; not traced to a file.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, library, callers) | 12 min | |
| Writing | 12 min | |
| Interpreter law runs | 1 min | 2 |
| Compiled runs | 3 min | 3 (about 50 s each) |
| Waiting | 0 min | |

## Lessons
- Running the chunk's laws with a large law block in the same compiled filter inflates their times through thread contention; measure the chunk's laws alone, then the preserved laws.
