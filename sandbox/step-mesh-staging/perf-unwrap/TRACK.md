# perf-unwrap: Unwrap, coarse-segment requests and FacesTouching without per-pair rescans (chunk F1)

Ticket: TKT-360
Status: ready: F1

## Done
- F1, this commit, about 1.5 h against 2 h expected. Ranked candidates 1, 05 #12 and 08 #5 of `docs/plans/step-mesher-complexity.md`.
  - `UnwrapIndexed(m, f, l)` / `UnwrapCounted(m, f, l): Counted<UvLoop>` (`uv-regions-indexed.library.plato`): the seam edges come once per face from one sort of its coedges (`FaceEdgeUses`, `SeamEdgesOnce`). The loop's steps are sorted once by their two sources (`SortedSteps`, a total order on `UvPointSource`: `CompareSources`), and the twin of step i is a binary search (`LowerStep`, `PlacedTwinStepIndexed`). On a face with no seam edge, nothing is sorted or searched. Cost O(B log B + C log C), down from O(B^2 (C^2 + E C)). The result is bit-identical: the same first j and the same points.
  - `FaceEdgesOnce(m, f)` and `SeamEdgesOnce(m, f)` (O(C log C)); type `FaceEdgeUse { Edge, First, Uses }` (`uv-regions-indexed.types.plato`).
  - `CoarseSegmentRequestsByEdge(m, f, d, r, c)` (`uv-regions-requests-indexed.library.plato`): one walk of the region's segments. A segment's candidate edges come from its sources: the edge of an edge-sample end, or the face edges that join its two vertex ends, found by binary search in `EdgesByEnds`. These are the only edges `IsDiscretizationSegment` can hold for. Each segment is measured once, and only when it lies on a face edge. `SegmentUvDeviationLazy` evaluates the surface only at synthetic ends, the only ones `SharedPosition` reads it for. The requests are the same, in the same order (first citation).
  - `FacesTouchingByCoedges(m, chosen, changed)` (`pipeline-indexed.library.plato`): `Any` over `FaceCoedges`, with no dedupe.
  - Laws (`unwrap-indexed.laws.plato`), all passing on both backends:
    - Agreement with the originals: `Law_Perf_UnwrapIndexedAgrees` (every meshed bound of every regioned face of all ten positive witnesses), `Law_Perf_UnwrapIndexedAgreesOnLoop` (the generated m, f, l domain of `Law_UnwrapKeepsSources`), `Law_Perf_UnwrapIndexedAgreesOnPolygon`, `Law_Perf_FaceEdgesOnceAgrees`, `Law_Perf_CoarseRequestsByEdgeAgrees` (witness criteria, and the same criteria with a 1 µm edge chordal bound), `Law_Perf_FacesTouchingByCoedgesAgrees`.
    - Checks that the agreement laws have cases to compare: `Law_Perf_UnwrapIndexedFindsTwins` (the cylinder has a placed twin step) and `Law_Perf_CoarseRequestsByEdgeAsks` (the tightened criteria give requests).
    - Mutation check: with the twin forced to -1, `Law_Perf_UnwrapIndexedAgrees` fails.
  - Count witness: `Witness_UnwrapIndexedWork`, slope `Insertions(2)`, sizes 32 and 128. The family is a regular polygon of n vertex sources on the unit box's bottom face, a plane. Measured work is 32 and 128 Insertions (one step visited per point; no seam edge, so no sort or search). The old Unwrap tried n (n - 1) / 2 earlier steps: 496 and 8128, each rebuilding FaceEdges.
  - Types added: `FaceEdgeUse`. It replaces three parallel arrays (edge, first citation, use count) from the one sort.

## Merge instructions
- `Unwrap(m, f, l)` => `m.UnwrapIndexed(f, l)` (or move `UnwrapCounted`'s body in). Then `PlacedTwinStep` has no caller left in the library; keep it for `Law_Perf_UnwrapIndexedFindsTwins`, or delete both.
- `FaceEdges(m, f)` => `m.FaceEdgesOnce(f)` (the same list; every caller gets O(C log C)).
- `AreSeamNeighbours(m, f, e, a, b)` => `m.IsSeamEdgeOf(f, e) ? m.AreNeighboursAlongSeam(e, a, b) : false` (one body for the neighbour test).
- `CoarseSegmentRequests(m, f, d, r, c)` => `m.CoarseSegmentRequestsByEdge(f, d, r, c)`. `EdgeTooCoarseInFace` then has no caller.
- `SegmentUvDeviation(m, f, d, r, k, i)` => `m.SegmentUvDeviationLazy(f, d, r, k, i)`.
- `FacesTouching(m, chosen, changed)` => `m.FacesTouchingByCoedges(chosen, changed)`.
- After wiring, the `Law_Perf_*Agrees` laws compare a function with itself. Delete them, or keep them only until the merge check has run once.
- `LowerBound` (`uv-delaunay.library.plato`) is reused by `ContainsSorted`. `CompareIntegers`, `CompareThen` and `CompareSources` are general and can move to a lower layer if another chunk needs them.

## Contract requests
- none

## Requests to other tracks
- I5 (TKT-382) threads the domain and tolerance into `UnwrapIndexed`; it should build on `UnwrapCounted` here.

## Findings
- No floating-point result changes: every replacement is bit-identical (exact `==` on coordinates, chordal bounds and sources in the agreement laws).
- The count witness's family is a plane, as the chunk asks, so it shows that the O(n^2) twin search is gone on seamless faces. On a seamed face the work is n + (n - 1) + (probes per seam step, at most log2 n + 1 each). That is O(n log n), and no witness checks it with a slope.
- `StepToMeshLaws.Law_OnlyFacesOfChangedEdgesAreRemeshed` takes 59 s compiled over 25 cases (budget error at 2 s), all of it in the library's MeshModel path (`RefineToSurfaceByInsertion`), not in anything this chunk touches. FINDINGS.md already lists it as a slow law. Its verdict with a larger budget is under "Law runs".

## Law runs
- Warm server (interpreter, cpu64): `UnwrapIndexedLaws`, `Law_WorkIsWithinSlope`, `FaceMeshingLaws` and the named laws: 55 pass. `Law_OnlyFacesOfChangedEdgesAreRemeshed` gave a time-budget error at 20 s (known slow, see Findings).
- Compiled: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics <toolkit>/sandbox/step-brep-mesh <toolkit>/sandbox/step-mesh-staging/perf-unwrap --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=UnwrapIndexedLaws,Law_WorkIsWithinSlope,Law_UnwrapKeepsSources,Law_UnwrapMovesByWholePeriods,Law_UnwrappedStepBelowHalfPeriod,Law_SeamUsesOnOppositeCopies,Law_RequestsNameFaceEdges,Law_RequestHasDiagnostic,Law_OnlyFacesOfChangedEdgesAreRemeshed`: 15 pass, 1 error (`Law_OnlyFacesOfChangedEdgesAreRemeshed`, 59.3 s). The slowest F1 law took 0.26 s (`Law_Perf_CoarseRequestsByEdgeAgrees`).
- Compiled again with `--budget=300 --filter=Law_OnlyFacesOfChangedEdgesAreRemeshed`: pass (25 cases, 61.4 s), the same verdict as `reviews/verdicts-cpu64.tsv`.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, library, callers) | 25 min | |
| Writing (4 plato files) | 30 min | |
| Law runs, warm server | 8 min, of which 5 min queued behind other builders | 5 |
| Compiled runs | 4 min | 3 |
| Mutation check | 2 min | 2 |

## Lessons
- The warm server returned "0 laws, no laws matched" twice while the supervisor's merge edits were in the library's working tree. The pinned CLI compiled the same files a minute later, so a "no laws matched" during a merge is worth one retry before looking for a parse error.
