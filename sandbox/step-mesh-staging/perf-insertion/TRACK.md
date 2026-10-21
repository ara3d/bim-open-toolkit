# perf-insertion: refinement passes over List builders, one surface evaluation per new point

Ticket: TKT-383
Status: merged: R1 (2026-10-21, into 05-face-meshing/triangulation-built.{types,library,laws}.plato; the local pass functions kept as the references the agreement laws compare against)

## Done
- R1, this commit, about 0.9 h against 2 h expected: ranked candidate 22 of `docs/plans/step-mesher-complexity.md`.
  - `insertion-built.types.plato`: `PositionedTriangulation` (a triangulation and the surface point of each of its points, carried through the passes), `TriangleWrites`, `SlotWrites`, `TrialInsertion` (one trial's outcome as the writes that keep it, so a refused trial copies nothing).
  - `insertion-built.library.plato` (library `TriangulationBuilt`): `TryInsertionInto(m, f, r, chart, tol, least, guarded, k, uv, points, pos, tris, nb): TrialInsertion` reads the pass's builders; `FlipCavity` runs `FlippedAround`'s queue on an overlay of the triangles it writes; `FanOf` (`ChangedNear` over the overlay), `CavityAngles` (`ChangedAnglesAt` from cached positions), `CavityNeighbours` (`UpdatedNeighbours` as writes, no second walk); `WithTriangles`, `WithNeighbours`; `SurfacePassBuiltCounted`/`SurfacePassBuilt`, `AnglePassBuiltCounted`/`AnglePassBuilt` (List builders for parameter points, chart points, positions, triangles and the neighbour table through a pass, loops inlined); `Positioned`; `RefineToSurfaceByInsertionBuilt` (F4's body, with the region tolerance and minimum length computed once per call, and positions evaluated once and carried between passes). List readers of the library's array helpers: `WalkToIn`, `SplitSideSlotOf`, `SurfaceFallbackIn`, `InCircleOfFour`, `IsFlippableFour`, `AngleOfCorners`, `LiftedAngleIn`. `PlaceInTriangle`, `SplitIsPositive`, `Circumcentre` and `AngleCandidates` are reused unchanged on three- or four-element corner arrays with local indices.
  - Per candidate: no array copied (was the points twice and the triangles twice, and on a kept point the points twice more and the neighbour table), at most one surface evaluation, at uv, only for a point strictly inside (was 1 + 3 or 4 corners, plus 6 per changed triangle when guarded), one walk (was two for a kept point), `RegionTolerance` not recomputed. `IsStrictlyInside` is still O(B) per candidate that passes the split test (see Findings).
  - `insertion-built.laws.plato` (library `InsertionBuiltLaws`): `Witness_AnglePassWork`, slope `Insertions(12).Add(Evaluations(4))`, sizes 32 and 128 boundary points of `StripRegion(n)` (a strip over the unit box's plane face 0), one angle pass over its constrained Delaunay triangulation; measured 11 Evaluations + 301 Insertions (7 points kept, 30 triangles below the angle) at 32 and 17 + 1001 (13 points, 126 triangles) at 128. Agreement laws: `Law_Perf_TrialAgrees` (the trial keeps exactly when `TryInsertion` does, guarded and unguarded; its writes give `TryInsertion`'s triangles and `NeighbourSlots`' table; at most one evaluation, exactly one for a kept point), `Law_Perf_SurfacePassBuiltAgrees`, `Law_Perf_AnglePassBuiltAgrees` (same triangulation as the library pass, and every position is the surface at its point), `Law_Perf_RefineBuiltAgrees` (the whole refinement, point for point and triangle for triangle, on every triangulable face of every sample), `Law_Perf_StripPassAgrees` (the witness strip).
  - Interpreter (`plato_laws.py "InsertionBuiltLaws,Law_WorkIsWithinSlope" --staging sandbox/step-mesh-staging/perf-insertion --budget 20`): 6 laws, 6 pass, 0 type errors.
  - Preservation (`plato_laws.py "TriangulationLaws,TriangulationFastLaws,TriangulationFastMarksLaws,Law_TriangulationAddsOnlyInteriorPoints" --staging ...`): 19 laws, 18 pass, 1 fail: `Law_RefinedInteriorMeetsMinAngle` at k = 1, as in `reviews/verdicts-cpu64.tsv`.
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-insertion --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=InsertionBuiltLaws,Law_WorkIsWithinSlope`: 6 laws, 6 pass; slowest `Law_Perf_RefineBuiltAgrees` 1.19 s over 14 cases, `Law_WorkIsWithinSlope` 0.75 s over 16, the rest at most 0.44 s.

## Merge instructions
- Move `insertion-built.types.plato` to `05-face-meshing/triangulation-built.types.plato` and `insertion-built.library.plato` to `05-face-meshing/triangulation-built.library.plato` (library `TriangulationBuilt`, after `TriangulationFast` in layer 05: it calls `SideSlot`, `HasCorner`, `Holds`, `CarriedMarks`, `BelowAngleKnown`, `AngleGoodMarks`).
- `triangulation-fast.library.plato` `RefineToSurfaceByInsertion` => `=> m.RefineToSurfaceByInsertionBuilt(f, r, chart, t, c);` (or move the body in).
- After that, `SurfacePassLocal`, `AnglePassLocal`, `SurfaceFallback`, `InsertedLocally`, `FlippedAround` and `ChangedAnglesAt` have no caller but the agreement laws: delete them with those laws, or keep them as references. Keep `TryInsertion`, `UpdatedNeighbours`, `ChangedNear` and `WalkTo`: `TriangulationFastLaws.Law_UpdatedNeighboursAreTheTable` calls them.
- `triangulation-refine.library.plato` `IsFarFromPoints`: drop the dead `added` parameter and its conjunct, and drop `new List<UvCoordinate>()` from `TryInsertion`'s call (triangulation-fast.library.plato line 234).
- Move `Witness_AnglePassWork`, `StripRegion`, `AnglePassWork` and `Law_Perf_TrialAgrees` (renamed `Law_TrialAgreesWithTryInsertion`) with `TrialAgreesOn`, `SameTriangles` into `05-face-meshing/triangulation-built.laws.plato`.
- Optional, to remove the duplicates: `TriangulationCdt.InCircleOf` => `InCircleOfFour(a, b, c, d, points[a], points[b], points[c], points[d])`, `IsFlippableCdt` => `IsFlippableFour`, `UvDelaunay.SplitSideSlot` => `SplitSideSlotOf`, `TriangulationRefine.LiftedAngleOf` => `AngleOfCorners` of its three evaluations. Chunk R3 (TKT-385) rewrites `InCircleOf` and `SplitSideSlot` too; do this after R3 merges, so each has one body.

## Contract requests
- none. `RefineToSurfaceByInsertionBuilt` has `RefineToSurfaceByInsertion`'s signature; the passes take new parameters (`tol`, `least`, a `PositionedTriangulation`) under new names.

## Requests to other tracks
- R2 (TKT-384, `TriangleNeedsRefinementCached`): the passes now carry `PositionedTriangulation.Positions`, the surface point of every point, through the refinement; `NeedsRefinement` and `BelowAngleKnown` can read corners from it instead of evaluating them. Not blocking.

## Findings
- No floating-point result changes: the trial runs the same arithmetic on the same values (a cached position is the same `Eval` of the same parameters; `InCircleOfFour` ranks the same indices as `InCircleOf`). `Law_Perf_RefineBuiltAgrees` checks the whole refinement point for point on every triangulable sample face.
- `IsStrictlyInside` is still O(B) per candidate. A constant-time test needs a boundary-segment index; using the walk's containing triangle instead is not bit-identical near the boundary (the chart is scaled parameters). It now runs only for a candidate the walk placed and whose split is positive, before the one surface evaluation.
- A kept point's cavity (the triangles it rewrites) grows with the strip's length: 43 writes per kept point at 32 boundary points, 77 at 128. That is the Delaunay cavity of a circumcentre in a long thin strip, the same flips the library made, not overhead.
- `ChangedNear`'s test "after differs from before" equals "the trial wrote it": every rewritten triangle holds the new point and no earlier triangle did, so the overlay replaces the comparison and the fan order is unchanged.
- The compiled run reports "1 degraded bodies", as F4's did, with or without this folder.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, library, callers, F4's laws) | 15 min | |
| Writing | 25 min | |
| Interpreter law runs | 5 min | 5 (two probe runs to read the witness's counts) |
| Compiled runs | 1 min | 1 (41 s) |
| Waiting | 0 min | |

## Lessons
- The law runner prints no values, so reading the counted work took temporary probe laws (`(work / 8^d) % 8 != i` over the generated integers) to recover each octal digit; a value-printing mode would save two runs.
