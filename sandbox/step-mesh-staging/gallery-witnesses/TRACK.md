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
| Law run (7 operation laws + 3 MeshedWitness laws, Oracle level) | running, over 15 min | 1 |

## Lessons
- Write a track in its staging folder from the first file: a merge agent compiles the tree between a writer's commits, and a registration file that names witnesses not yet written breaks its check.
