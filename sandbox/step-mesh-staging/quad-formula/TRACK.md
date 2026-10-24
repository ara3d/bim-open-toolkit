# quad-formula: analytic curved faces as structured grids sized by the closed-form chordal count

Ticket: TKT-502
Status: working: QF1

The design and chunk table are in the ticket. Baseline corpus measurement (per surface kind and
path) from a private export of bim-open-data HEAD (`a362442`, library `Ara3D.StepBrep` at `1093b2e`),
run while other agents loaded the machine; its per-kind table goes into the results note.

## Done
- (none yet)

## Merge instructions
- `QuadGridOnSides(m, f, d, r, c, sides)` => `m.QuadGridOnSidesFormula(f, d, r, c, sides)` (face-meshing.library.plato; chunk QF2)
- move `grid-formula.{types,library,laws}.plato` into `05-face-meshing/`; rename `Law_QuadFormula_*` to `Law_V1Faces_*`

## Contract requests
- none. `SegmentFloors` stays dense; finding 9's sparse floors would change `QuadGridOutcome.CountsDiffer` and wait for a wave.

## Requests to other tracks
- quads (TKT-409, chunk Q1b): the host answering `QuadCountMismatch` requests is what lets a face the formula asks floors of take its grid in the next round; `QuadGridOnSidesCurved` calls `QuadGridOnSides`, so it gets the formula's floors for free. Does not block.

## Findings
- The host drops advisory requests today (`BlockingOnly`), so until Q1b merges the formula's floors change no corpus mesh; a face the gate refuses still takes the refined triangulation in the same round, as before.
- The sphere witness (one seam, two poles) gets its u count from `PoleStepCount` (the surface angular bound), not from any edge, so no floor reaches it: chunk QF4.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| reading | 55 min | |
| baseline harness export and build | 5 min (twice: a shared scratchpad folder was deleted under the first) | 2 builds |
| writing QF1 | 25 min | |

## Lessons
- The scratchpad folder is shared by every agent of one parent session; name a private subfolder.
