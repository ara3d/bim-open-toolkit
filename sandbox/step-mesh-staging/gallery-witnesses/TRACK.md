# gallery-witnesses: one Plato witness per first-level CAD operation, for the mesher gallery and the law sweeps

Ticket: TKT-482
Status: ready: G1

## Chunks

| Id | Ticket | Goal | Expected |
|---|---|---|---|
| G1 | TKT-482 | 22 witnesses (hexagon, L bracket, chamfer, fillet, extruded fillet, inner fillet, slot, D-shaft, pyramid, blind hole, boss, counterbore, countersink, sphere dimple and dome, open box, tube, oblique cut, torus fillet, revolved barrel and cone, cross hole) with stated counts, genus and volume; seven laws over them; each registered as a MeshedWitness | 4 h |

## Done
- G1, 2ab7ea1a (written in the library tree, moved here at the supervisor's request on 2026-10-22), about 4 h against 4 h. Files: `operation-witnesses.types.plato` (ProfileCorner), `operation-witnesses.library.plato` (library OperationWitnesses: a profile extruder, features on a box, spools, the cross hole's two cubic B-splines from `sandbox/step-brep-mesh/tools/cross_hole_spline.py`), `operation-witnesses.laws.plato` (library OperationWitnessesLaws, 7 laws over OperationWitnessAt), `pipeline-operation-witnesses.library.plato` (22 `Witness_<X>Meshed` values of MeshedWitness; layer 8, since it calls MeshedWitnessOf). The whole program type-checks with the four files in place (plato_laws.py none: 0 type errors at 2ab7ea1a). The law run over the seven laws and the three MeshedWitness laws was started before the move and its verdicts go in this file when it ends.
- The laws are named `Law_OperationWitness<What>`, not `Law_Gallery_<What>`: no library law has that prefix, and the names are the ones the merged file keeps.
- Verdicts (plato_laws.py with `--staging` this folder, cpu64, 2026-10-22 evening): `Law_OperationWitnessHasStatedCounts` and `Law_OperationWitnessStatedCountsImplyStatedGenus` pass (exhaustive); `Law_OperationWitnessEulerIsTwoMinusTwiceGenus`, `Law_OperationWitnessIsStructurallyClean`, `Law_OperationWitnessValidatesClean` and `Law_OperationWitnessIsOracleClean` pass on all 22 (21 in one run with the cross hole held out, the cross hole alone in a scratch law after its closure marks were added; the Oracle law settles alone at 60 s, over the 2 s budget on the first case). `Law_OperationWitnessVolumeMatchesOracle`: 19 of 22 agree with the closed form within the allowance (a probe over the regenerated C# printed every pair); the extruded fillet, the barrel and the revolved cone get NaN from `Oracle_DivergenceVolume` (TKT-483, defect filed) and hold vacuously under a guard the ticket removes. The three MeshedWitness laws passed on the 21 other witnesses and failed on the cross hole before its closure marks; not rerun since (about 6 min).
- Fixes after the first run: `OperationWitnesses` renamed `OperationWitnessList` (the law interpreter read the function as the library of that name: "OperationWitnesses has 0 fields"); `At(x, y)` renamed `ProfilePoint` (the C# generator wrote `3.4[2.4]` for it: `At` is the indexing intrinsic); the cross hole's GeometrySet goes through layer 3's `ClosureMarks`, since a closed edge on an aperiodic B-spline otherwise gets an empty domain (`TraversalDomain`, topology.library.plato:585) and the edge counts as degenerate.
- Meshed by the compiled harness (scratch regeneration from 2ab7ea1a's layers plus these files, commit a73c168 of a scratch repo under artifacts/, never committed to bim-open-data): 21 of 22 mesh closed and oriented with the contract holding; the cross hole's outer band (4 loops, two of them the B-splines) is refused as not simple (FACE-LOOP-NOT-SIMPLE, the TKT-412 family), 3 of 4 faces meshed, 576 boundary edges. That is the gallery card's verdict.

## Merge instructions
- `operation-witnesses.types.plato`, `operation-witnesses.library.plato`, `operation-witnesses.laws.plato` => `sandbox/step-brep-mesh/07-validation/`
- `pipeline-operation-witnesses.library.plato` => `sandbox/step-brep-mesh/08-pipeline/`
- No wiring edit: nothing in the library is changed; the files only add values and laws. Every `Witness_*(_: BrepModel)` here becomes a case of the 157 laws over BrepModel, and every `Witness_*Meshed` a case of the MeshedWitness laws, so the merge's full sweep is the first run of those over these witnesses.
- `deps/bim-open-data` regenerates Ara3D.StepBrep from 2ab7ea1a (the files in the tree) for the gallery's run; after the merge, regenerate from the merge commit so the provenance line names it.

## Contract requests
- None.

## Requests to other tracks
- None.

## Findings
- The Plato parser refuses a 22-deep nested ternary (`expected EOS`); a 10-deep one (BrepWitnesses.WitnessAt) parses. OperationWitnessAt indexes an array instead.
- A cubic interpolant through 49 points of the cross hole's quartic is 5.2e-6 off the cylinders, outside Witness_Tolerances' 1e-6; 97 points give 3.5e-7. An exporter's approximation of a cylinder-cylinder intersection is the realistic edge, and the tolerance decides whether the library accepts it.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Writing the witnesses and facts | 2.5 h | 0 |
| Type check (plato_laws.py none) | 3 runs, 5 s warm each | 3 |
| Law run (7 operation laws + 3 MeshedWitness laws, Oracle level) | 23 min (the MeshedWitness laws 5.4 min of it) | 1 |
| Law reruns after the fixes (operation laws, scratch per-witness laws) | 4 runs, 0.5 to 3 min each | 4 |
| Scratch regeneration (compiler cached), harness build, 22-case gallery run | 2.5 min, 0.5 min, 0.6 min | 2 regenerations (one with the `At` collision), 3 builds |

## Lessons
- Write a track in its staging folder from the first file: a merge agent compiles the tree between a writer's commits, and a registration file that names witnesses not yet written breaks its check.
