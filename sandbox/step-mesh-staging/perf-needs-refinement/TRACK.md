# perf-needs-refinement: the surface refinement test from cached positions, normals and side samples

Ticket: TKT-384
Status: merged: R2 (2026-10-21, into 05-face-meshing/refinement-test-cached.{types,library,laws}.plato; the duplicate cached loop and its law deleted; the slope of 8 evaluations per tested triangle accepted as the verdict-preserving floor)

## Done
- R2, this commit, about 0.6 h against 1.5 h expected: ranked candidate 27 of `docs/plans/step-mesher-complexity.md`.
  - `needs-refinement-cached.types.plato`: `PointNormals` (the face normal and collapsed-line test at each corner of a tested triangle), `CentroidTest` (whether a triangle's corner and centroid tests fail, and the evaluations they made), `SideSample` (a side's chord-midpoint surface distance and parameter-midpoint surface point).
  - `needs-refinement-cached.library.plato` (library `RefinementTestCached`): `NeedsRefinementCachedCounted(m, f, r, pt: PositionedTriangulation, known, c): Counted<Array<Boolean>>` and `NeedsRefinementCached` (its `.Value`), with the `known` mark kept. Per pass: corner positions read from `pt.Positions` (R1); one `FaceNormalAt` and one `IsOnCollapsedLine` per point that is a corner of a tested triangle; per tested triangle `TriangleCentroidTest`, cheapest first with early exit (side normal turns from the cached normals, then one centroid normal serving both the fold test of `LiftsFacingFaceNormal` and the angle test, then the centroid's `Eval`, then the corner mean's `SurfaceDistance`); per side, only for triangles those tests pass, one `SideSample` (a projection and two evaluations) read by both triangles of the side through `SampleSlot` over `NeighbourSlots`; `TriangleNeedsRefinementCached(r, pt, first, samples, sources, k, c)` combines them. `RefineToSurfaceByInsertionCached` is R1's `RefineToSurfaceByInsertionBuilt` with the one call swapped, kept only for the agreement law.
  - The signature differs from the dispatch's `TriangleNeedsRefinementCached(m, f, r, t, positions, normals, k, c)`: the per-triangle verdict also reads the pass's side samples (shared between two triangles), so it takes them and the triangle's `CentroidTest` instead of the model.
  - `needs-refinement-cached.laws.plato` (library `RefinementTestCachedLaws`): `Law_Perf_NeedsRefinementCachedAgrees` (on every `TriangulatedWitness`: the same Boolean per triangle as `NeedsRefinement` on the constrained Delaunay triangulation and on the refined one with nothing known, and on the constrained one with every other triangle known); `Law_Perf_RefineCachedAgrees` (the whole refinement with the cached test equals the witness's `Refined`, point for point and triangle for triangle: the same insertions in the same order); `Witness_NeedsRefinementWork`.
  - Count witness: `Witness_NeedsRefinementWork`, slope `Evaluations(8)`, sizes 32 and 128 boundary points of `StripRegion(n)` on the cylinder's side (face 0 of `Witness_Cylinder`), one pass over its constrained Delaunay triangulation, every triangle tested. Evaluations counts surface evaluations, normals and projections. Measured 239 at 32 (32 normals + 30 triangles x 4 + 29 sides x 3) and 1007 at 128 (128 + 126 x 4 + 125 x 3): every triangle of the strip passes every test, the worst case, 8n - 17. TriangleNeedsRefinement made about 26 per tested triangle.
  - Interpreter (`plato_laws.py "RefinementTestCachedLaws,Law_WorkIsWithinSlope,TriangulatedWitnessLaws,Law_ElementLiftsFacingFaceNormal,Law_ElementDeviationWithinSurfaceChordal,Law_SurfaceWithinSurfaceChordalOfElement,InsertionBuiltLaws,TriangulationFastMarksLaws" --staging sandbox/step-mesh-staging/perf-needs-refinement --budget 20`): 35 laws, 34 pass, 1 fail: `Law_RefinedInteriorMeetsMinAngle` on "Cylinder face 0", as in `reviews/verdicts-cpu64.tsv` (k = 1). `Law_RefineMeetsContract`, `Law_MinAngleBetterOnCylinders`, `Law_RefinedNoFlippableEdge`, the Cdt laws, the three FaceMeshingLaws laws, `InsertionBuiltLaws` and `TriangulationFastMarksLaws` pass, as in the baseline.
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-needs-refinement --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=RefinementTestCachedLaws,Law_WorkIsWithinSlope,Law_RefineMeetsContract,Law_MinAngleBetterOnCylinders,Law_ElementLiftsFacingFaceNormal`: 6 laws, 6 pass; `Law_WorkIsWithinSlope` 0.59 s over 24 cases, `Law_Perf_RefineCachedAgrees` 0.20 s over 42, `Law_Perf_NeedsRefinementCachedAgrees` 0.12 s over 42, the rest at most 0.12 s; total 42.1 s.

## Merge instructions
- Move the three files to `05-face-meshing/refinement-test-cached.{types,library,laws}.plato` (library `RefinementTestCached` calls `Positioned`, `NeighbourSlots`, `SideSlot`, `ElementUvCentroid`, `FaceNormalAt`, `SurfaceDistance`, `HalfwayPoint`, `UvMidpoint`, `IsOnCollapsedLine`; its laws call `StripRegion` and `SameUvTriangulation` of `InsertionBuiltLaws`).
- `triangulation-built.library.plato` `RefineToSurfaceByInsertionBuilt`, line 561: `m.NeedsRefinement(f, r, now, known, c)` => `m.NeedsRefinementCached(f, r, current, known, c)`.
- Then delete `RefineToSurfaceByInsertionCached` and `Law_Perf_RefineCachedAgrees` (the library's refinement is that function, and `TriangulatedWitnessLaws` checks it through `w.Refined`), and rename `Law_Perf_NeedsRefinementCachedAgrees` to `Law_NeedsRefinementCachedAgrees`.
- Keep `UvDelaunay.TriangleNeedsRefinement` and `NeedsRefinement` as the agreement law's reference; `InsertionBuiltLaws.SurfacePassAgreesOn` also calls `NeedsRefinement`.

## Contract requests
- none.

## Requests to other tracks
- none.

## Findings
- No floating-point result changes: every value tested is the old path's (a cached position is `Positioned`'s `Eval` of the same parameters, which `HoldsItsPositions` checks; the centroid normal takes the same fallback, the vector area of the same three points in the same order; `HalfwayPoint` and `UvMidpoint` are `(a + b) * 0.5`, exact under exchange of a and b, so the neighbour's sample is the same value). The verdict is the disjunction of the same tests in another order.
- The plan's count, "Evals per tested triangle <= 4", is not reachable with the same verdict: a triangle that passes every test needs four values of its own (the centroid's point and normal, the corner mean's projection and its surface point) before its sides, and each side not on the boundary needs a projection and two evaluations (shared by two triangles: about 1.5 sides per triangle, 4.5 per triangle). Measured 8n - 17 on the strip, so the witness states `Evaluations(8)`, against about 26 before. The plan's estimate counted the per-point and per-midpoint work and left out the centroid. If 4 is the goal, it needs a change of verdict (for example dropping the corner-mean test, which the centroid test nearly implies), a decision for the plan, not this chunk.
- Normals are taken with `FaceNormalAt`, not the jet of I4's `FirstJet`: `NormalOr` has closed forms for the elementary surfaces (and the Lemon torus sign) that `PartialU x PartialV` does not reproduce bit for bit; on a B-spline surface `NormalOr` already runs one `BSplineSurfaceFirstJet`.
- Normals are taken per pass for the corners of tested triangles, not carried through the passes with the positions: carrying them needs a field on R1's `PositionedTriangulation` and writes in the pass builders, a change to the library's type. Per pass they cost one normal per corner of a tested triangle, at most n.
- `NeighbourSlots` is rebuilt per pass (a sort of 3T codes, no evaluation); the pass builders of R1 hold the table, but `PositionedTriangulation` does not carry it.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, R1's track, the function, its helpers and callers, the witness laws) | 15 min | |
| Writing | 15 min | |
| Interpreter law runs | 3 min | 3 (one probe run to read the counts) |
| Compiled runs | 1 min | 1 (42 s) |
| Waiting | 0 min | |

## Lessons
- The octal-digit probe of R1's track read both counts in one interpreter run (eight laws, one per digit and size).
