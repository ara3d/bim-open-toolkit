# perf-shell-orientation: shell connectivity, orientation search and the fold in linear passes

Ticket: TKT-376
Status: ready: V8

## Files

- `shell-orientation.library.plato` (library `BrepShellOrientation`, layer 02):
  - `ShellComponentCountByVertex(m, s)` (= `ShellComponentCount`) and its counted form
    `ShellComponentCountByVertexCounted(m, s): Counted<Integer>`: every (vertex index, face
    position) reference of `FaceVertices` listed once, sorted by vertex, each joined to the
    previous one with the same vertex, then layer 0's `ClassRoots`. The rule is the reference's:
    two faces touch on a common vertex index or on a coinciding pair of poly-loop points. The poly
    part keeps the reference's pairwise test, but only among faces that have poly points, each
    face's points gathered once (`PolyPointsTouch`); coincidence by grid is V9's.
  - `OrientationFlipsByAdjacency(m, s, t)` (= `OrientationFlips` with `t = m.EdgeUseTable(s)`)
    and `OrientationFlipsByAdjacencyCounted`: a `Buffer<Integer>(F)` first-position map in place
    of `PositionOf`, the links of `FaceParityLink` read from `UsesOfEdgeIn` in the same order, a
    compressed adjacency (offsets, neighbour, parity) filled by a stable counting sort so each
    face's row is in link order, and the same breadth-first colouring over the row.
  - `IsOrientableByAdjacency(m, s)` (= `IsOrientable`): one edge-use table for the search and for
    the coherence check (`HasCoherentOrientationIndexed`), since reversing faces changes no loop
    and no bound list, so the reversed model's table is the same.
  - `FaceMarks(faces, faceCount): Array<Boolean>` (set semantics, out-of-range indices ignored),
    `WithFacesReversedMarked(m, flip: Array<Boolean>)`, `WithEveryFaceReversedMarked(m)`.
- `shell-orientation-fold.library.plato` (library `StepFoldParity`, layer 03):
  `FoldParity(folds, faceCount): Array<Boolean>`, one toggle per record.
- `shell-orientation.laws.plato` (library `ShellOrientationLaws`, layer 08): the two count
  witnesses and seven `Law_Perf_*`.

Types added: none. Every value is an index array or a mark array, and the adjacency lives only
inside one function body, so a type would have no reader.

## Done

- V8, (this commit), about 0.4 h against 2 h expected.
  - New laws, warm interpreter (cpu64, budget 20): `ShellOrientationLaws` 7 of 7 pass, and
    `Law_WorkIsWithinSlope` passes (29 cases, mine among them).
    - `Law_Perf_ShellComponentCountAgrees` (14 witness models): on every shell, and on one extra
      shell holding every face of the model, the count equals `ShellComponentCount`.
    - `Law_Perf_ShellComponentCountAgreesOnPolyLoops`: the box beside three poly triangles (two
      touching only through the point (1, 0, 3), no shared vertex index) in one shell is 3
      components in both; the two unit cubes in one shell are 2.
    - `Law_Perf_OrientationFlipsAgree` (14 models, each also with face 0, faces 1 and 3, and
      every face reversed): the flips equal `OrientationFlips` face for face, and
      `IsOrientableByAdjacency` equals `IsOrientable`.
    - `Law_Perf_OrientationFlipsAreFound`: the unit box with faces 1 and 3 reversed gives flips
      [1, 3]; `Witness_BoxWithFlippedFace` (sense only) gives none.
    - `Law_Perf_FacesReversedMarkedAgrees` (14 models): `WithFacesReversedMarked(FaceMarks(...))`
      is `SameModel` as `WithFacesReversed` for no face, one face, a face named twice, and an
      index of 99; `WithEveryFaceReversedMarked` is `WithEveryFaceReversed`.
    - `Law_Perf_FoldParityMarksFoldedFaces`: records naming 3 three times, 1 twice, 5, 0, 99, -1
      over six faces mark exactly 0, 3, 5, as `FoldedFaces` lists; no records and zero faces mark
      nothing; the box reversed both ways is the same model.
    - `Law_Perf_FoldParityAgreesOnRawWitnesses` (the two raw witnesses): the fold
      `PrepareModelWith` applies (decoder records plus `MirrorFolds`) and the refold in `RawOf`
      reverse the same faces through `FoldParity` as through `FoldedFaces`.
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter `ShellOrientationLaws,`
    `Law_WorkIsWithinSlope` and the preservation laws below): 27 laws, 23 pass, 4 obligation,
    total 50.8 s, laws 2.9 s summed; slowest of this chunk `Law_Perf_OrientationFlipsAgree`
    0.37 s over 14 cases; `Law_WorkIsWithinSlope` 1.25 s over all 29 claims.
  - Count witnesses (Insertions; Size is shell 0's coedge count, V4's `ShellTablesModelOfSize`:
    unit box 24, block with a through hole 48):
    - `Witness_ShellComponentCountWork`, slope `Insertions(6)`: one per face position, two per
      vertex reference, one per pair of poly faces tested. Measured 102 at 24 (allowance 144)
      and 202 at 48 (allowance 288). The reference tests 15 face pairs on the box, rebuilding two
      8-vertex lists per pair: 960 comparisons.
    - `Witness_OrientationFlipsWork`, slope `Insertions(4)`: one per model face row in the
      position map, one per face mapped and per face dequeued, one per use read, two per
      adjacency entry (placed, walked); the table's build is the caller's (V4 counts it).
      Measured 90 at 24 (allowance 96) and 174 at 48 (allowance 192).
  - Verdict preservation, warm interpreter and compiled, cpu64: `BrepTopologyLaws`
    `Law_ShellIsConnected`, `Law_ShellIsOrientable`, `Law_ReversingEveryFaceKeepsCoherence` (25
    cases each); `StepReadingLaws` `Law_FoldFlipsExactlyRecorded`, `Law_MirrorFoldRecordedOnce`,
    `Law_LeftHandedSurfacesAreFolded` (28 cases each), `Law_FoldPreservesInteriorSide` (25),
    `Law_PrepareIsIdempotent` (2); `StepRawWitnessesLaws` `Law_RawUnitCubePreparesToUnitBox`,
    `Law_RawTwoCubesPreparesToTwoBodies`; `BrepCheckingProofsKernelLaws`
    `Law_ConnectedShellIffOneComponent` (196); `ShellTablesLaws` (4 laws): all pass, and the four
    `Part21File` overloads of the fold laws are host obligations, as in
    `reviews/verdicts-cpu64.tsv`; 0 differ. They run the unwired library; the agreement laws carry
    the claim to the wired one. All results are exact: integers, index arrays, and models
    compared with `SameModel`.

## Merge instructions

- Move `shell-orientation.library.plato` to `02-topology/topology-shell-orientation.library.plato`,
  `shell-orientation-fold.library.plato` to `03-step/step-fold-parity.library.plato`,
  `shell-orientation.laws.plato` to `08-pipeline/pipeline-shell-orientation.laws.plato`.
- 02 `topology.library.plato` `ShellComponentCount(m, s)` => `m.ShellComponentCountByVertex(s)`
- 02 `topology.library.plato` `OrientationFlips(m, s)` => `m.OrientationFlipsByAdjacency(s, m.EdgeUseTable(s))`
- 02 `topology.library.plato` `IsOrientable(m, s)` => `m.IsOrientableByAdjacency(s)`
- 02 `topology.library.plato` `WithFacesReversed(m, faces)` => `m.WithFacesReversedMarked(FaceMarks(faces, m.Faces.Count))`
- 02 `topology.library.plato` `WithEveryFaceReversed(m)` => `m.WithFacesReversedMarked(m.Faces.Count.MapRange(i => true))`
  (then delete `WithEveryFaceReversedMarked`, or point one at the other)
- 03 `step.library.plato` `PrepareModelWith`: `reduced.Model.WithFacesReversed(folds.FoldedFaces(reduced.Model.Faces.Count))` => `reduced.Model.WithFacesReversedMarked(FoldParity(folds, reduced.Model.Faces.Count))`
- 03 `step.library.plato` `RawOf`: `d.Model.WithFacesReversed(d.Map.Folds.FoldedFaces(d.Model.Faces.Count))` => `d.Model.WithFacesReversedMarked(FoldParity(d.Map.Folds, d.Model.Faces.Count))`
- Keep `FoldedFaces` (the agreement law and readers of the record list) and `FoldCountIn` (used
  per face at 03 line 627, O(R) per call, fine). Keep `FacesTouch`, `FaceVertices`,
  `FacePolyPoints`: `topology.spec.plato` states `ShellComponentCount` through `FacesTouch`.
- `FaceParityLink` and `PositionOf(faces, f)` have no caller once `OrientationFlips` is wired:
  delete them, and move the "links" description into `OrientationFlipsByAdjacencyCounted`'s
  comment (it already states the link rule).
- After wiring, the agreement laws compare each replacement with itself. Keep
  `Law_Perf_ShellComponentCountAgreesOnPolyLoops`, `Law_Perf_OrientationFlipsAreFound` and
  `Law_Perf_FoldParityMarksFoldedFaces` under non-Perf names (they assert fixed answers); the
  rest can go, or stay as `Law_*Agrees` against `FoldedFaces` and `FacesTouch` where they still
  test something (`Law_Perf_FoldParityAgreesOnRawWitnesses`' first conjunct does).

## Contract requests

- none

## Findings

- After wiring, `WithFacesReversed` is O(F + |faces|) and `PrepareModelWith`'s fold O(F + R),
  where they were O(F |faces|) and O(F R); on a mirrored assembly R >= F, so the fold was O(F^2)
  per decode.
- `IsOrientable` built two edge-use tables per shell (one in `OrientationFlips`, one in
  `HasCoherentOrientation` on the reversed model); the table depends only on loops and bound
  lists, which reversal keeps, so one serves both.
- The poly-point part of `ShellComponentCountByVertex` is still pairwise over faces with poly
  points, O(P^2) points for P poly points in the shell: V9's grid of tolerance cells can replace
  `PolyPointsTouch` there with no change to the rule.
- `OrientationFlipsByAdjacency` initialises a position map over every model face, O(F) per
  shell, as the dispatch asked; with S shells that is O(S F). A model with thousands of shells
  would want the map sized to the shell (sort the shell's (face, position) pairs) instead.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, ticket, V4 track, layer 2 and 3 functions and callers, witnesses) | 10 min | |
| Writing the three files | 8 min | 1 failed shell heredoc, rewritten with the file tool |
| Law runs, warm server | 4 min | 3 runs and 1 probe run (measured work) |
| Compiled run | 1 min | 1 run, 50.8 s |
| TRACK.md, ticket, commit | 4 min | |

## Lessons

- One law expectation was wrong (`Witness_BoxWithFlippedFace` flips only SameSense, so its edge
  uses stay opposite and the search finds nothing): read a witness's comment before asserting
  what a search finds on it.
