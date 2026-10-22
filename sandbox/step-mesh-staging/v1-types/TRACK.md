# v1-types: types that make the version 1 algorithms correct by construction

Ticket: TKT-435
Status: ready: T1

The review behind this track is `docs/plans/step-mesher-types-review-2026-10-22.md`. This folder
stages only the changes that fit one chunk and touch few call sites; wide renames are tickets,
because the version 1 tracks are mid-flight.

## Chunks

| Id | Ticket | What | Expected |
|---|---|---|---|
| T1 | TKT-435 | `ElementShape` (an element by arity, total lookup) and `QuadSplits` (both diagonal splits named once); the grid keep rule decided on every triangle a renderer may draw, the contract's rule, with an early exit and the offending element as evidence | 1 h |

## Done
- T1 (TKT-435), this commit, about 0.7 h against 1 h. Types added (`element-shape.types.plato`):
  `ElementShape = TriangleShape(TriangleFace) | QuadShape(QuadFace) | NoElement(ElementIndex)`,
  `QuadSplit { First; Second: TriangleFace }`, `QuadSplits { OnAC; OnBD: QuadSplit }`,
  `GridChordalDecision = GridWithinChordal(Grid, Bound) | GridExceedsAt(Element)`. Library
  `V1TypesElements` (`element-shape.library.plato`): `ShapeOf` on a `UvTriangulation` and on a
  `FaceMesh` (total: `NoElement` out of range), `ShapeCorners`, `SplitsOf`, `SplitTriangles`,
  `RenderTriangles`, `QuadDistanceBothSplits`, `FlatElementDistanceBothSplits`,
  `GridTriangleWithinChordal`, `GridTriangleFacesFaceNormal`, `GridElementKept`,
  `DecideGridChordal`, `GridOutcomeOf`, `GridUnlessFoldedOrCoarseV1Types`. Laws
  `V1TypesElementsLaws`, 7, over the eight grid cases of `FaceMeshingGridChordalLaws`:
  - Warm server, cpu64, budget 120 s (`plato_laws.py "<the 7>" --staging sandbox/step-mesh-staging/v1-types`):
    7 pass, 14.4 s for all of them; type check of library plus folder 0 errors.
  - `Law_V1Types_DecisionAgreesWithLibrary` passes: on every witness the contract's rule keeps
    and refuses the same grids as F1's `GridUnlessFoldedOrCoarse` (bump tops and torus refused;
    box, cylinders, sphere, cone kept). So wiring it changes no witness verdict; it changes the
    rule to the one the gate checks, and a quad twisted along its other diagonal
    (`Law_V1Types_TwistedQuadNeedsBothSplits`: the old measure gives 0, the split on B D is more
    than 0.05 away) is refused instead of kept.
  - `Law_V1Types_SplitsMatchGateSplits`: `SplitsOf` gives the gate's `QuadSplitTriangles` in its
    order, so the gate can read it without a verdict changing.
  - `Law_V1Types_BothSplitsNotNearer`: the both-splits distance is never below
    `FlatElementDistance`'s.

## Merge instructions
- Move `element-shape.types.plato`, `element-shape.library.plato` and `element-shape.laws.plato`
  into `05-face-meshing/` (names unchanged; the laws keep their `Law_V1Types_` names or drop the
  prefix).
- `QuadGridOnSides` (05-face-meshing/face-meshing.library.plato:610): call
  `m.GridUnlessFoldedOrCoarseV1Types(f, r, m.QuadGrid(f, r, corners, c), c)` in place of
  `m.GridUnlessFoldedOrCoarse(...)`. Then `GridUnlessFoldedOrCoarse`, `GridElementWithinChordal`
  and `FlatDistanceOf` (grid-chordal.library.plato) have no caller but
  `Law_V1Types_DecisionAgreesWithLibrary` and `Law_V1Types_TwistedQuadNeedsBothSplits`: keep them
  until those laws are restated, or delete the three and the two laws together.
- `V1Gate.QuadSplitTriangles(fm, q)` (08-pipeline/pipeline-v1-gate.library.plato:121) =>
  `fm.Quads[q].SplitsOf.SplitTriangles.Map(t => t.Vertices)`.
- Optional, changes a measure the validation layer reads: `FlatElementDistance(fm, k, p)`
  (face-meshing.library.plato:521) => `fm.FlatElementDistanceBothSplits(k, p)`, so
  `ElementCoverageGap` measures the gap the contract states. Run the layer 5 and 7 law classes
  that read `ElementCoverageGap` before and after.

## Contract requests
- None. Wider changes (typed sentinels, `UvPointIndex` in `FaceMesh`, typed parameters in the
  layer 1 arena API, `Sense` in the topology records) are tickets, listed in the review.

## Requests to other tracks
- v1-faces: the keep rule above replaces F1's element test with the contract's; no verdict
  changes on the witnesses. Not blocking.

## Findings
- Three readers measured a quad three ways: the grid keep rule and `FlatElementDistance` take the
  nearer triangle of the split on the diagonal from corner 0; the gate takes all four triangles of
  both splits. `GridElementWithinChordal` orders its tests "surface-point tests first", but Plato's
  `&&` evaluates both sides, so all four ran on every element.
- `UvTriangulation` and `FaceMesh` number elements triangles first then quads in one
  `ElementIndex`; `ElementCorners` returns an `Array<VertexIndex>` and every reader re-derives the
  arity from its `Count` and reads `ps[3]` by position.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading the design documents and the grid code | 15 min | |
| T1: types, library, laws | 20 min | 1 type check (23 s), 1 law run (16 s) |
| T1: TRACK.md and commit | 5 min | |

## Lessons
- The warm server type-checks a staging folder in 23 s and ran the seven laws in 14 s; the
  witnesses the grid laws already declared (`GridCase`) made the laws cheap to write.
