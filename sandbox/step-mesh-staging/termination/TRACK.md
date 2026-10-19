# termination: edge discretization returns on every input, and an edge off its face is reported

Ticket: TKT-346
Status: merged

## Files

- `termination-witnesses.library.plato` (library `TermWitnesses`): `TermOffSurfaceCube(k)`, the
  1 mm unit box with plane #118 (surface 5, face 5) replaced by a sphere (k 0), a cylinder (1) or
  a torus (2) on the plane's own placement, the repro of the C# finding without a file; any other
  k is the consistent box. `TermFindingCriteria`, the finding's `DefaultCriteria(0.001)`. No
  `Witness_` prefix, so the law runner does not feed an inconsistent model to every `BrepModel` law.
- `termination-discretize.library.plato` (library `TermDiscretize`): `DiscretizeBounded`,
  `RefineEdgeBounded`, the searched raise `RaisedForImagesBounded`, the image tests over a given
  set of images (`...On`), the off-surface test (`ImageGap`, `GapProbe`, `IsOffSurface`,
  `UsableImages`), `SegmentBound`, `DiscretizeAllBounded`, and the findings
  (`DISCRETIZE-EDGE-OFF-SURFACE`, `DISCRETIZE-NOT-CONVERGED`, `DiscretizationFindings`).
- `termination.laws.plato` (library `TermLaws`): ten `Law_Term_*` laws.
- `termination-wiring.library.plato` (library `TermWiring`): staging only, not merged. Layer 8's
  loop with this track's wiring applied (`MeshModelTerm`), so the whole mesh is checked now.
- `verdicts-gpu32.tsv`: the verdicts of the seven laws that pass before the merge.

## The defect, measured

`Discretize` of a line or conic edge took the closed-form uniform count and raised it one segment
at a time (`RaisedForImages`) while an image chord exceeded the chordal bound, up to the cap the
minimum length gives (the edge's length over it: 10^4 for the 1 mm line at
`DefaultCriteria(0.001)`). Each step re-measured every chord of the new split, so a count that
never passes costs cap(cap + 1) / 2 = 5 x 10^7 segment tests: finite, but a hang in practice.
It never passes when the edge does not lie on the face's surface. A segment's image deviation is
measured at interior samples that approach its end points as it shrinks, so it tends to the gap
between the edge and the surface there, and no refinement brings it under the bound. Bisection
(every other curve) and `RefineEdge` are linear in the segments they make, but went on to the
length floor along the whole edge for the same unmeetable image.

## Done

- (this commit): the bounded discretization, its laws, the repro and the wired copy of layer 8's
  loop. Pinned CLI acbc9b94, gpu32, `--budget`.
  - Before, over layer 4's and layer 8's own functions on the repro, budget 60 s each, all
    `time budget exceeded`: `Law_Term_DiscretizeReturnsOnOffSurfaceEdge` (sphere, in
    `RaisedForImages`), `Law_Term_RefineEdgeReturnsOnOffSurfaceEdge` (torus, in `RefinedSpan`
    recursing toward the floor; sphere and cylinder returned within the budget),
    `Law_Term_OffSurfaceCubeMeshReports` (cylinder, `MeshModel` stuck in `DiscretizeAll` ->
    `RaisedForImages`). These three stay errors until the merge wires the bounded functions in.
  - After, one run of 30.6 s (11.7 s compile), 7 of 7 pass (`verdicts-gpu32.tsv`):
    - `Law_Term_BoundedDiscretizeReturnsOnOffSurfaceEdge` (14 cases): edge 3 returns 1 segment on
      the sphere, cylinder and torus repros.
    - `Law_Term_BoundedRefineReturnsOnOffSurfaceEdge` (14): `RefineEdgeBounded` asked for 8 gives 8.
    - `Law_Term_RaiseSearchEndsAtCap` (14, 11.1 s): with the off-surface image kept in the test,
      the searched raise ends at the cap (1000 at `DefaultCriteria(0.01)`) within the bound and
      reports `DISCRETIZE-NOT-CONVERGED`.
    - `Law_Term_OffSurfaceEdgeIsDiagnosed` (14): edge 3 is reported `DISCRETIZE-EDGE-OFF-SURFACE`;
      every finding is at one of face 5's edges 3, 7, 8 and 11; the consistent box gives none.
    - `Law_Term_BoundedDiscretizeWithinSegmentBound` (196): every edge of the four cubes.
    - `Law_Term_BoundedAgreesOnConsistentModels` (196): bit for bit equal to layer 4's
      `Discretize` on every edge of the 1 mm box and of layer 7's cylinder.
    - `Law_Term_WiredMeshReportsOffSurfaceEdge` (14, 5.9 s): the cylinder repro meshes through the
      wired loop within the round limit, and the report carries edge 3's off-surface finding.
  - A deliberately false probe law (deleted) confirmed that the 196-case laws evaluate real cases.

## Merge instructions

Move the three `.plato` files into `04-discretization/` (the laws beside
`discretization.laws.plato`, the witness library into `07-validation/` if preferred; its names
need no change). Rename `Law_Term_` to `Law_`. Then:

- Layer 04 `Discretize(m, e, c, floors)` => `DiscretizeBounded(m, e, c, floors)`.
- Layer 04 `RefineEdge(m, d, c, segments)` => `RefineEdgeBounded(m, d, c, segments)`.
- Layer 04 `SegmentFails(m, e, c, a, b)` => `SegmentFailsOn(m, e, c, a, b, m.EdgeImages(e))`,
  `ImagesExceedChordal(m, d, c)` => `ImagesExceedChordalOn(m, d, c, m.EdgeImages(d.Edge))`,
  `SegmentMeetsCriteria(m, d, c, i)` => `SegmentMeetsCriteriaOn(m, d, c, i, m.EdgeImages(d.Edge))`;
  then delete `RaisedForImages`, `BisectedParameters`, `SplitSpan`, `RefinedParameters`,
  `RefinedSpan` and `RefinedHalf`, which nothing calls after the two lines above.
- Layer 08 `LoopReport(m, o, chosen, s)`: add
  `.Merge(ReportOf(m.DiscretizationFindings(s.Discretizations, o.Face.Discretization)))` after
  the outcomes' diagnostics. Layer 08 is track G's fence; the line is the whole edit.
- Delete `termination-wiring.library.plato` and `Law_Term_WiredMeshReportsOffSurfaceEdge`: after
  the wiring they restate layer 8 and `Law_Term_OffSurfaceCubeMeshReports`.
- After the wiring, `Law_Term_DiscretizeReturnsOnOffSurfaceEdge`,
  `Law_Term_RefineEdgeReturnsOnOffSurfaceEdge` and `Law_Term_OffSurfaceCubeMeshReports` should
  pass. They cannot before the merge: they call layer 4's and layer 8's own functions.
- Add `DISCRETIZE-EDGE-OFF-SURFACE` and `DISCRETIZE-NOT-CONVERGED` to the diagnostic-code tables
  of the layer READMEs (04 and 08) at merge.

## Contract requests

- None. Every staged function uses signatures the library declares; the two findings are layer 0
  `Diagnostic` values located at `Provenance.KernelEdge`.

## Requests to other tracks

- G (genus, TKT-328, owns layer 08): the one-line `LoopReport` edit above. Not blocking.
- T (triangulation, TKT-343): `RefineToSurfaceByInsertion` is bounded (40 passes, 400 flip passes),
  but a face whose boundary is off its surface (face 5 of the repro) never meets the surface
  criterion beside the boundary, so every pass splits there until the minimum length stops it.
  Consider stopping a triangle's refinement when its boundary corners' gap to the surface already
  exceeds the chordal bound, the 2D form of `IsOffSurface`. Not blocking.

## Loops of layers 04 and 05 that refine until a tolerance is met (criterion 3)

| Loop | Bound | Why it terminates |
|---|---|---|
| 04 `RaisedForImages` | cap (length over minimum length) | Replaced: quadratic (above). `RaisedForImagesBounded`: at most 2 log2(cap / n) + 2 tests |
| 04 `SplitSpan` | depth 40 and the minimum length | Each split needs both halves at least the minimum length, so the leaves are at most the seed spans plus the polyline length over the minimum length (`SegmentBound`); linear work. Replaced only to drop off-surface images |
| 04 `RefinedSpan` / `RefinedHalf` (`RefineEdge`) | depth 40 and the length floor | `SegmentMeetsCriteria` passes at the floor (`IsAtLengthFloor`), so the same bound; replaced only to drop off-surface images |
| 04 `RaisedToCount` | the requested count | Each pass adds one parameter; quadratic in the request, which is a face's count (`QuadCountMismatch`), not a tolerance |
| 04 `EdgeSeeds`, `UnwrappedByContinuity`, `PolesFilled` | the array length | One step per element |
| 05 `RefineToSurface` | 40 passes | Stops when a pass adds no point; each pass is linear in the triangles; insertion keeps the minimum length (`IsGoodInsertion`). Track T replaces it with a loop of the same bound |
| 05 `Delaunayed` | 200 passes | Each pass is linear in the triangles |
| 05 `CutSegmentCount` | 64 | One step per count, each linear in it |
| 05 `EarClipped` | the ring's length | Each step removes a vertex or stops |
| 05 `Unwrap`, `FlipPass`, `SplitPass`, `LowerBound`, uv-regions' `i < n` loop | the array length, or a binary search | One step per element |

## Findings

- A warm-server call (`plato_laws`, budget 60) over the three hanging laws together did not answer
  before the MCP client's timeout; the pinned CLI, whose `--budget` does stop a running case,
  reported each at 60 s. Run laws over code that may hang in the CLI under an outer `timeout`, so
  a slow run never holds the shared server.
- `RaisedForImagesBounded` returns the least passing count only when the image test is monotone
  in the count; otherwise it returns some passing count at most one above a failing one. On every
  edge of the 1 mm box and of the cylinder it gives layer 4's answer bit for bit
  (`Law_Term_BoundedAgreesOnConsistentModels`).
- Possibly related: the topology track's whole-model laws on the torus witness ran past 900 s
  (plan v2 log). Its circle edges take the same raise path.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the ticket, plan, layers 04, 05 and 08 | about 25 min | none |
| Witness, bounded library, laws, wiring copy | about 40 min | 1 warm type check (5.4 s) |
| Laws over the bounded functions | about 3 min | 2 warm runs, 1 probe run, 2 CLI runs (19 s, 31 s) |
| Layer 4's and 8's own functions on the repro (before) | about 4 min | 1 warm run lost to the client timeout, 3 CLI runs (73 s each) |

## Lessons

- Laws over code that hangs belong in the pinned CLI under an outer `timeout`, not on the shared
  warm server: one call over three such laws outlived the MCP client.
- A sanity probe (a deliberately false law) settled in one run whether 196 cases in 74 ms were
  real.
