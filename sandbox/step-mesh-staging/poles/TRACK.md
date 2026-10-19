# poles: mesh the sphere, torus and cone (poles, two seams, the cone's tip)

Ticket: TKT-325
Status: merged

Merged into the library 2026-10-19 (see the merge commit): bodies and the seven findings now live in `sandbox/step-brep-mesh` and `reviews/FINDINGS.md` (F-57). The laws are `Law_*` in `07-validation/poles.laws.plato`.

## Done
- faca6918 and the commit that sets this status: `LimitNormalBody`, `ExpandedPolesBody` (with `WithMissingPole` for a pole the face encloses without touching), `CutWholePeriodsBody` with `WithSeamCutAll`, the test mirrors, two new witnesses (`PolesTorusAtVertex`, `PolesHemispheres`), and 26 `Law_Poles_*` laws.
- Before: every sphere, torus and cone face stopped at a host obligation (`ExpandedPoles`, or `LimitNormal` in `Lift`); the whole torus at a vertex would have meshed nothing (its loop does not wind, so `WithSeamCut` passes it through).
- cpu64, pinned CLI 128cf769, on the library after the wave 1 merges (276 files), 2026-10-19: all 9 limit-normal and region laws pass: `Law_Poles_LimitNormalAtSpherePoles`, `Law_Poles_LimitNormalAtConeApexIsRulingNormal`, `Law_Poles_LimitNormalIsNormalWhereRegular`, and the regions of the seamed sphere, the sphere bounded by its pole vertices, the torus, the cone, the two hemispheres and the whole torus at a vertex (each closes in the plane, winds positive, has its cut copies opposite, is simple, and has its pole points on their line). The whole-model and face-check laws exceed the runner's budget on this library (finding 7), so their verdicts are the gpu32 ones below.
- gpu32, pinned CLI 88aa0277, on the library before tracks G and T merged (refinement as step B left it), 2026-10-18 and 19:
  - Pass: `Law_Poles_SphereMeshIsSound`, `Law_Poles_SphereByPoleLoopsMeshIsSound`, `Law_Poles_TorusMeshIsSound` (Euler characteristic 0; the volume oracle over a boundary that wraps in v), `Law_Poles_ConeMeshIsSound`, `Law_Poles_TorusAtVertexMeshIsSound`, `Law_Poles_RedundantPoleLoopsMeshIsSound` (closed, consistently oriented, Euler characteristic, volume within the tube). Volumes: sphere 4.133 against 4.189 at chordal 0.01; torus 9.802 against 9.870; cone 1.038 against 1.047; torus at a vertex 9.800.
  - Pass: `Law_Poles_SphereByPoleLoopsFaceChecksHold`, `Law_Poles_ConeFaceChecksHold` (every check of layer 07's `ValidateFaceMesh` at Geometric).
  - Fail: `Law_Poles_SphereFaceChecksHold`, one element of 1,913 (finding 2). `Law_Poles_TorusFaceChecksHold` fails at chordal 0.05; which check fails is not known, because the Geometric validation of the torus's 7,000 triangles did not finish in the time available (finding 5). `Law_Poles_TorusAtVertexFaceChecksHold` exceeded a 1,200 s budget in layer 07's all-pairs `Law_LocalVertexFibresAreIdentifications`.
  - Fail under gpu32 only: `Law_Poles_SphereGaussBonnet`, `Law_Poles_TorusGaussBonnet`, `Law_Poles_ConeGaussBonnet` (finding 1); under cpu64 the same meshes satisfy Gauss-Bonnet to 5e-11 (cone) and 3e-12 (step B's cylinder).
  - Not run: `Law_Poles_HemispheresMeshIsSound` was removed (finding 4).

## Merge instructions
- Layer 01 `LimitNormal(g, s, uv)` => `LimitNormalBody(g, s, uv)`; move `limit-normal.library.plato` (library `PolesLimitNormal`) into `01-geometry/`.
- Layer 05 `ExpandedPoles(m, f, loops, c)` => `ExpandedPolesBody(m, f, loops, c)`; move `pole-segments.library.plato` (library `PolesSegments`) into `05-face-meshing/`.
- Layer 05 `CutWholePeriods(m, f, loops, c)` => `CutWholePeriodsBody(m, f, loops, c)`, and `WithSeamCut(m, f, loops, c)` => `WithSeamCutAll(m, f, loops, c)` (the replacement also cuts a whole torus bounded by one vertex, whose loop does not wind, which `WithSeamCut` passes through unchanged); move `whole-periods.library.plato` (library `PolesWholePeriods`) into `05-face-meshing/`.
- Delete `poles-mirrors.library.plato` (test mirrors of the library's chain, equal to the library after the wiring above). In `poles.laws.plato` rename the calls `MeshFacePoles` => `MeshFace`, `RegionOfPoles` => `RegionOf`; keep `ModelMeshPoles` beside the laws as `RoundZeroModelMesh` (it has no library twin), or use layer 08's `MeshModel(o).Mesh`, which also runs the refinement rounds and validation.
- Move `poles.laws.plato` into `07-validation/` (it meshes witnesses with layer 08's options) and rename `Law_Poles_*` to `Law_*`; move `PolesTorusAtVertex` and `PolesHemispheres` into `validation-witnesses.library.plato` as `Witness_TorusAtVertex(_: BrepModel, major, minor)` and `Witness_Hemispheres(_: BrepModel, r)`.
- Layer READMEs: layer 01 has one deferred function fewer (`LimitNormal`); layer 05 has two fewer (`ExpandedPoles`, `CutWholePeriods`).

## Contract requests
- None. The staged functions use only signatures the library declares.

## Requests to other tracks
- T (triangulation, TKT-343), blocking `Law_Poles_SphereFaceChecksHold`: refinement can stop short on a triangle whose sides are long. On the seamed unit sphere at chordal 0.01 (gpu32), triangle 1913 of the refined triangulation, corners near (u, v) = (-5.94, -1.533), (-5.931, -1.556), (-5.923, -1.510), deviates 19.9 degrees from the surface normal at its centroid (bound 15). `TriangleNeedsRefinement` flags it, but `SplitPass` rejects the split because the midpoint of its longest side lies 0.00062 from the far corner of the neighbouring triangle, under the minimum length 0.001, and tries nothing else. Its shortest side is 0.023, so `MeshFace`'s minimum-length escape does not cover it. A fallback (the centroid, or another side) would fix it; the replacement triangulator should handle it.
- T, not blocking: refinement takes corner normals from `FaceNormalAt` with a +z fallback, which is wrong at a cone's apex (`LimitNormal` gives the ruling's normal for each point of the apex segment). Refinement then splits toward the apex until the minimum length stops it.
- G (layer 07), not blocking this track: findings 1 and 3.

## Findings
1. Layer 07's `Oracle_AngleDefectSum` sums thousands of corner angles in plain floats and subtracts the total from 2 pi times the vertex count. Under gpu32 the rounding of that sum exceeds `AngleDefectMatchesBrepEuler`'s allowance on every curved witness: sphere gap -0.0185 against 0.0133 (1,109 vertices), cone -0.0029 against 0.0026, step B's cylinder -0.00204 against 0.00204. Under cpu64 the gaps are 5e-11 (cone) and 3e-12 (cylinder). A compensated sum (as `SignedVolume` uses) or an allowance that counts the additions would fix it.
2. Refinement can stop short on a triangle with long sides (request to T above).
3. Layer 07's `Oracle_BodyVolume` gives `Witness_SphereWithRedundantPoleLoops(1)` a volume of 8.378, twice the sphere's 4.189: it counts the redundant vertex loops. The mesh of that witness is the seamed sphere's (closed, oriented, Euler characteristic 2, region of 74 points), so `Law_Poles_RedundantPoleLoopsMeshIsSound` judges its volume against the seamed sphere's oracle.
4. A face whose winding loops `WithSeamCut` does not pair (other than the whole torus at a vertex) is returned unchanged by `CutWholePeriodsBody`; `AddMissingSeamsAndPoles` has no outcome through which to diagnose it (layer 05 README, open item 1). Not reached by any witness. A hemisphere bounded by its equator alone, or a cone by its base circle alone (one winding loop, the pole not on the boundary), is handled: `ExpandedPolesBody` adds the enclosed pole's whole segment (`WithMissingPole`), and step B's band join cuts to it; `PolesHemispheres(r)` is the witness (two faces, one equator edge); `Law_Poles_HemispheresRegionsAreWellFormed` passes. Its whole-model mesh is not verified: one run at chordal 0.05 used 1,277 s of CPU without finishing (the seamed sphere at the same chordal takes about 60 s), so something in refinement or lifting is far costlier with an added pole loop. Not diagnosed; the mesh law was taken out rather than left unverified.
5. Cost: the torus of radii 2 and 0.5 meshes to about 7,000 triangles even at chordal 0.05, driven by the 15 degree normal-turn bound on a tube of radius 0.5; one whole-model law then takes about 7 minutes in the interpreter. `Lift`'s identification compares every pair of points (about 12 million comparisons at 3,500 points); a sort on the source would make it n log n. The torus laws need a budget near 900 s.
6. In this Plato, `Take(n)` faults when n exceeds the array's count.
7. Since the triangulation track's refinement merged (7d8dae2d), whole-model meshing of a curved witness exceeds the runner's budget in the interpreter: the seamed unit sphere ran past 1,500 s at chordal 0.05 and past 10 minutes at 0.2, the trace in `AnglePass` < `TryAngleInsertion` < `Delaunayed` < `FlipPass` < `NeighbourTable` < `SortedIndices`: each insertion's flips rebuild and sort the whole neighbour table. The supervisor's log already notes `Law_RefinementNeverCoarsens` over budget on the torus. Until that cost falls, every whole-model law of this track stays a budget error under the sweep; they are not regressions, since none passed before.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Read the plan, staging rules, contracts and witnesses | 40 min | 0 |
| Write the three bodies, mirrors and laws | 60 min | 0 |
| First law runs and the whole-pole-segment fix | 40 min | 4 cold CLI runs |
| Mesh laws, Gauss-Bonnet and refinement diagnosis | 150 min | 10 cold CLI runs, most 2 to 17 min (whole-model meshing) |
| Hemispheres, torus face-check diagnosis, cpu64 reruns after the wave 1 merges | about 6 hours wall, mostly waiting | 12 cold CLI runs; three stopped after 40 to 100 minutes; the machine ran at about a tenth of its speed for part of it |

## Lessons
- A bodied declaration in a staging folder beside the library's bodiless one compiles, but the interpreter still reports the host obligation, so staged bodies are reachable only through mirrors of the call chain until merge. A runner option that binds `<Name>Body` to a bodiless `<Name>` for staging runs would remove the mirrors.
- The warm server did not answer within 10 minutes on the first staging call; the cold pinned CLI compiled the library plus this folder in 10 to 15 s, and meshing dominated every run.
- Whole-model laws on curved witnesses cost minutes each in the interpreter; diagnose with `--call` on a debug function that returns the parts of a law as numbers, then run the laws once at the end.
- Layer 07's face validation at Geometric holds several all-pairs checks; on a 7,000-triangle torus one run did not finish in 100 minutes. Face-level laws on large curved faces should check the per-element laws directly (linear) and leave the all-pairs checks to small faces.
- The library changed under this track (four merges in one day); rerunning everything after each merge cost more than the track's own development. A staging run could pin the library at a commit and rerun only on request.
