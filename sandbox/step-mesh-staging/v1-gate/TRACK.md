# v1-gate: layer 5 meets the version 1 mesh contract, and plane faces take the no-refinement path

Ticket: TKT-418 (with TKT-416), then TKT-349 with TKT-412, then TKT-399
Status: merged: V1G-1 in 7a59273d, V1G-2 in e9d9586f, V1G-4 in 568541ff, V1G-3 in 959130d7, V1G-5 in 7c91b3b5, V1G-6 in 56d3216c | ready: V1G-7, V1G-8, V1G-10 (its harness half in bim-open-data 66f0da1) | V1G-9: diagnosed, no library change

The contract is `sandbox/step-brep-mesh/README.md`, "Version 1 mesh contract" (owner, 2026-10-21).

## Chunks

| Id | Tickets | What | Expected |
|---|---|---|---|
| V1G-1 | TKT-418, TKT-416 | the gate/quality list of every layer 5 law; where the quality laws go; the gate laws on real face meshes, including both diagonal splits of every quad; delete `Law_RefinedInteriorMeetsMinAngle` | 2 h |
| V1G-2 | TKT-349, TKT-412 | plane faces triangulated from boundary and holes with no refinement; the 45 not-simple plane faces meshed or explained | 2 h |
| V1G-4 | TKT-399 | curved faces refined against the chordal bound alone (supervisor's decision, 2026-10-22) | 1 h |
| V1G-5 | TKT-418 | triage of the non-passing laws outside layer 5: gate or quality, ticket, fence | 2 h |
| V1G-6 | TKT-412 | pinched plane faces: weakly simple loops split into outer and holes; zero-width faces | 2 h |
| V1G-7 | TKT-399 | ValidateFaceMesh under 2 s on a built curved mesh: the two quadratic identification checks in n log n | 2 h |
| V1G-8 | TKT-429 | a torus band bounded by two full circles meshed on the half of the tube its loops bound | 2 h |
| V1G-9 | TKT-455 | moon_buggy's B-spline faces 41 and 117 reported at 3.8 times the chordal bound | 2 h |
| V1G-10 | TKT-455 | the contract check and the gate claim measure a quad's split as a whole, and mesh to surface by projection | 2 h |
| V1G-3 | TKT-399 | the curved-face check laws on the sphere, torus and pinned torus: gate or quality; fix the gate ones | 2 h |

## Done
- V1G-1 (TKT-418, TKT-416), this commit, about 1.2 h against 2 h. The gate/quality list of all 126 layer 5 laws (below): 113 gate, 13 quality, of which `Law_RefinedInteriorMeetsMinAngle` is deleted at merge (TKT-416) and twelve move to `10-editing` (merge instructions). Type added: `V1GateWitness { Name; Model; Options; State }` (v1-gate.types.plato), a model meshed once per sweep to the final state of layer 08's loop with quads preferred, so the gate laws read real face meshes; `MeshedWitness` holds no face meshes and meshes with triangles, `PoleWitness` stops at round zero. Library `V1Gate` (the witnesses, and the chordal and orientation claims on a triangle given by its corners, on both diagonal splits of a quad, and on every triangle); library `V1GateLaws`, 6 laws: `Law_V1Gate_EveryFaceMeshed`, `Law_V1Gate_QuadsAreReached`, `Law_V1Gate_QuadSplitsWithinChordal`, `Law_V1Gate_TrianglesWithinChordal`, `Law_V1Gate_QuadSplitsOriented`, `Law_V1Gate_TrianglesOriented`. Witnesses: unit box, cylinder, block with a through hole, bump solid at 0.3, all at chordal 0.01.
  - Warm server (`plato_laws.py "V1GateLaws" --staging ...`): 5 pass, 1 fail.
  - Compiled (pinned CLI e37c032f, `--backend=csharp --profile=cpu64 --budget=2 --filter=V1GateLaws`): 5 pass, 1 fail; `Law_V1Gate_QuadSplitsWithinChordal` fails on the bump solid only (TKT-415: the top face is one flat quad; owned by v1-faces), 2.22 s over its 4 cases with the failing case's shrink; the other five 0.02 to 0.28 s. Witnesses 19.9 s (unit box 7.4 s, the first one built, so JIT is in it; cylinder 5.9 s). Total 620 s, of which front end 143 s, C# emit 176 s, C# compile 269 s.
  - Laws before and after, layer 5: 126 laws, 125 pass and 1 fail (`Law_RefinedInteriorMeetsMinAngle`) in `reviews/verdicts-cpu64.tsv`; after the merge instructions, 125 laws in layer 5 and `FaceQualityLaws` together (the fail deleted), and 6 new gate laws, 5 passing until TKT-415 is fixed.
- V1G-2 (TKT-349, TKT-412), this commit, about 2 h against 2 h. No type added: the plane path is one function over the existing triangulation. Library `V1Plane` (v1-plane.library.plato, for layer 5): `IsPlaneFace`, `RefineToSurfaceV1` (a plane face keeps its constrained triangulation; every other face is refined as before), `IsInteriorSource`, `PlaneMeshIsBoundaryOnly`, `MeshedTriangulationOf` (the triangulation MeshFace lifts for a `TriangulatedWitness`). Library `V1PlaneLaws`, 2 laws: `Law_V1Gate_PlaneFacesAreBoundaryOnly` (every plane face meshed with triangles holds no interior point, on the four gate witnesses) and `Law_V1Gate_FineDisksAreBoundaryOnly` (the cylinder's two disks at chordal 1e-4, over 200 boundary segments each, mesh as a polygon's triangulation). `PlaneFaceMeshesAt` sits in `V1Gate`, since it reads layer 08's options.
  - Before the wiring (committed library, compiled): both plane laws fail on the cylinder, whose disks get the angle pass's points; the fine disks take 1.88 s. After (a copy of the committed library with the merge instructions below applied, compiled): both pass; the fine disks take 0.04 s.
  - Merge check, compiled at a 2 s budget, the whole library plus this folder on both copies: base 1344 laws, 1191 pass, 38 fail, 17 error, 84 obligation, 14 skipped; wired 1195 pass, 37 fail, 14 error. Changed verdicts: the two plane laws, fail to pass; `Law_CappedPathIsMeshFace`, pass to fail, mended by the fourth edit below; seven laws flipping between pass and a budget error in both directions at 2.0 to 2.5 s with 22 threads busy (`Law_ScriptInverseUndoesFromFive`, `Law_ScriptInverseUndoesOnCylinder`, `Law_BumpSolidMeshAgainstModelLaws`, `Law_PoleMeshIsSound`, `Law_AttainableMeshesClosed`, `Law_ValidationIsIdempotent`, `Law_EdgeReversalPreservesMesh`). Rerun alone on the wired copy with all four edits (`RefinementAttainableLaws`, `TriangulatedWitnessLaws`, `V1GateLaws`, `V1PlaneLaws`, `Law_InsideOnGridAgreesOnStars` and the flipped laws): 43 laws, 41 pass, 2 fail, both known (`Law_RefinedInteriorMeetsMinAngle`, deleted by V1G-1; `Law_V1Gate_QuadSplitsWithinChordal` on the bump solid, TKT-415).
  - Before the witness edits, three `TriangulatedWitnessLaws` failed on the cylinder's disk (`Law_RefinedIsFaceTriangulation`, `Law_OutcomeLiftsRefined`, `Law_LiftKeepsPointsOnSamples`): the witness's `Refined` is the insertion refinement, which MeshFace no longer lifts on a plane. They are restated on `MeshedTriangulationOf`; `Refined` keeps its meaning, so the refinement agreement laws still test the refinement.
  - TKT-349: in the corpus run of 2026-10-21 the 80 to 212 edge plane faces already took 76 to 80 ms sequentially (0.8 to 1.5 s with 22 rows sharing the cores), after TKT-351's incremental refinement; with this path they skip refinement. The corpus faces are timed again only after the supervisor regenerates the C#; the witness timing above is the evidence until then.
  - TKT-412: the 27 twelve-edge plane faces (three MAYA REVC files, 9 each) are a file defect, not a false collision. In SHO/MAYA-W260_REVC.step loop #39396, edge #39442 (an arc of radius 0.15) is written with its vertices against the loop's vertex chain, so read literally it runs 350.4 degrees instead of 9.6, and the loop crosses itself through three of its own vertices. Layer 5's FACE-NOT-SIMPLE diagnostic is correct and kept; the evidence and the repair are TKT-419 (filed). The other 18 faces (ODIN-W260 4, LENA-R8 1, ANN-MB2 2, CAM, ANNA-B4, and the 54-edge MAYA faces) have no broken vertex chain; each keeps its located FACE-NOT-SIMPLE diagnostic with edge requests, and its cause is not yet named. Named since by the polystrata spike (sandbox/step-mesh-staging/polystrata-spike/REPORT.md, a read-only session started by local_63fdab15, not committed): its reproduction of the collision rule gives the library's flags on 45 of 45 faces, so none is a tolerance artifact. 32 faces, the three MAYA families (the 27 twelve-edge, the three 54-edge with a circle written twice, the two two-loop with the outer circle written twice), have exact segment crossings that remain at a chordal bound 1000 times finer. 6 (ANN-MB2 260, 445, 1606, 1699; CAM 124, 146) are chord artifacts that are clean at 0.01 mm, so the refinement requests the host never acts on would mend them. 7 are exact touches or slivers at most one tolerance wide: LENA-R8 1349 is a valid weakly simple face (two keyhole holes, each sharing one vertex with the outer loop) that the shared-vertex rule rejects; ODIN 2613, 2615, 2616, 2625, ANNA-B4 491 and MAYA 1599 are zero-width or degenerate. Both readings keep the not-simple outcome for the MAYA families. The spike's suggested follow-up, not done: let SegmentsSeparated accept two non-consecutive segments that share an endpoint exactly and are otherwise beyond the tolerance, then split such a pinch into an outer loop and holes before triangulating (gains LENA-R8 1349, changes no MAYA verdict).
- V1G-3 (TKT-399), this commit, about 1.3 h against 2 h. No type added. Library `V1PoleChecksLaws` (v1-poles.laws.plato), 16 laws `Law_V1Gate_Pole<Check>`: each of the sixteen checks `ValidateFaceMesh` runs at Geometric, as its own law over every face of every `PoleWitness` (07-validation/poles-witness), so a verdict names the failing check. Each law's comment gives its kind.
  - Committed library, compiled, budget 600 s: 13 pass, 3 fail. Quality, so out of the version 1 gate: `ElementNormalAgreesWithSurface` (fails first on the sphere) and `SurfaceEdgeNormalTurnWithinSurfaceAngular` (first on the cone). Gate: `ElementFacesFaceNormal`, on the cone's lateral face only: 4 of its 4,378 elements, each with three corners nearly on one ruling through the apex (three on the seam copy u = -2 pi, one on u = 0 within 1.3e-6), 3D area 1e-8 or less, winding sign -1 or 0. Their corners are `Interior` points: refinement inserts points ever closer to the seam beside the apex (u distances 6.8e-4, 3.4e-4, 1.7e-4, 8.5e-5, each still 85 or more tolerance units inside, 122 of the 2,177 interior points within 1e-3 of a seam copy), and the apex's zero radius makes the resulting triangles degenerate in space. Every gate check passes on both spheres, the torus, the torus pinned at a vertex, the redundant-pole sphere and the cone's base disk. So the *FaceChecksHold failures on the sphere, torus and pinned torus were quality checks; the one gate failure is the cone.
  - Cause, by elimination on scratch copies: with the angle pass off (`RefinementMinAngle` 0) the 4 slivers stay; with the angular surface criterion also off (SurfaceAngular 180 degrees in the pole options) all 16 checks pass, witnesses build in 1.1 s against 14.6 s, and the 16 laws take 1.9 s summed against 295 s. Both criteria are quality under the contract. But in that run the two pole-loop sphere witnesses throw `ArgumentOutOfRangeException` while being built (with SurfaceAngular off they mesh coarser), so it covers six witnesses of eight; the throw looks like TKT-411's.
  - Not fixed here: refinement on version 1's curved faces against the chordal bound alone (no angle pass, no SurfaceAngular test) changes every curved face's mesh and needs the index error fixed first; it is a decision for the supervisor (see Requests). The per-check laws stay staged until then: on the committed library they take 15 to 108 s each, compiled.
  - TKT-399's second criterion (ValidateFaceMesh under 2 s on a built mesh): `LocalVertexFibresAreIdentifications` is the slow check, 108.5 s over the 8 witnesses with the others at 15 to 25 s while they share the cores and 0.02 s for the cheap ones; on the chordal-only meshes all 16 take 1.9 s summed. Not fixed.
- V1G-4 (TKT-399), this commit, about 0.7 h against 1 h. Supervisor's decision of 2026-10-22: version 1 refines curved faces against the chordal bound alone. No type added. In `V1Plane` (v1-plane.library.plato): `RefineToSurfaceV1` now gives a curved face `RefineToSurfaceChordal`, which runs `RefinementRoundChordal` (RefinementRoundCarried without its angle pass, on the carried neighbour table) under `WithoutSurfaceAngular` (SurfaceAngular 180 degrees, so the chordal deviation and the fold test still drive the surface pass); `MeshedTriangulationOf` is now `RefineToSurfaceV1` of the witness's constrained triangulation.
  - Checked on the V1G-2 wired copy with the lift-case edit below, compiled, budget 120 s, layer 5's law libraries plus `V1GateLaws`, `V1PlaneLaws`, `V1PoleChecksLaws`, `RefinementAttainableLaws`, `PolesWitnessLaws`: 160 laws, 154 pass, 6 fail, then the lift-case law passes after its edit. The 5 remaining fails are expected: four quality laws (`Law_V1Gate_PoleElementNormalAgreesWithSurface`, `Law_V1Gate_PoleSurfaceEdgeNormalTurnWithinSurfaceAngular`, `Law_MinAngleNoWorseThanLibrary`, `Law_RefinedInteriorMeetsMinAngle`) and the bump solid's quad split (TKT-415). All twelve gate checks of `V1PoleChecksLaws` pass on all eight pole witnesses: the cone's four apex slivers are gone. No witness threw (the pole-loop sphere's index error came from SurfaceAngular 180 in the whole criteria, which this path does not set). The whole batch ran in 4.2 s wall (laws 6.3 s summed, 91 witnesses 5.3 s) against minutes with the angle pass.
  - `Law_LiftCaseReachesItsBranches` failed on its CylinderRefined case: without the angular test a cylinder needs no interior point (it is ruled, so triangles along the height lie on it), so that case no longer reaches the interior-points branch. The case becomes SphereRefined (merge instructions); with it the law passes.
  - `Law_MinAngleNoWorseThanLibrary` (moving to `FaceQualityLaws`) compares the insertion refinement's smallest angle with `RefinedTriangulation`'s; under version 1 `RefinedTriangulation` is the chordal-only refinement, so the law fails by design. Delete it at merge, or restate it in the improvement pass against that pass's own refinement.
- V1G-6 (TKT-412), this commit, about 1.5 h against 2 h. No type added. Library `V1Pinch` (v1-pinch.library.plato): `SegmentsSeparatedV1` (two non-consecutive segments of one loop that share exactly one end, with identical coordinates, are separated when each one's far end is more than one tolerance unit from the other), `IsSimpleRegionV1` (all pairs, for the staged laws), `IsKeyholePinch` and `RegionPinchesAreKeyholes` (at a vertex a loop passes twice, the smaller sub-loop winds opposite to the larger and lies inside it), `IsZeroWidthRegion` (chart area within `AreaTolerance`), `ZeroWidthOutcome` (FACE-ZERO-WIDTH, no requests), `MalformedPinchOutcome` (FACE-LOOP-NOT-SIMPLE), `MeshRegionOnceV1`, and `IsCornerOf` for the ear clippers. Witnesses (`V1PinchWitnesses`): LENA-R8 face 1349's region, copied from the polystrata spike's dump, and five synthetic regions. Laws (`V1PinchLaws`), 8.
  - Face 1349 is one loop of 66 points through two vertices twice (positions 4 and 14, 0 and 62), not three loops: its two keyhole holes are inside the outer loop's own ring. So the change is to the collision rule and the ear clippers; no loop is split.
  - The ear clippers stopped on any pinch: `IsEar` and the indexed clipper's blocker test skip the ear's own corners by index, so the pinch vertex's second index, which lies exactly on a corner, counted as inside and blocked every ear there (compiled probe, committed library: 44 of 64 triangles on face 1349, none on a one-loop keyhole square). With `IsCornerOf` in both skip tests, as earcut does, face 1349 and the keyhole square triangulate to covers of their area.
  - Scope kept to one loop: two loops that touch at a vertex (a hole on the outer loop, two touching holes) stay not simple. `Law_CollidingSegmentsAgrees` pins two touching holes as not simple (PerfCollideShapes, shape 12) and failed when the rule also covered two loops, and the triangulator's hole bridging does not cover a touching hole (4 of 8 triangles on the synthetic case).
  - The keyhole check stops MAYA-W260 face 1599 from being accepted: the rule alone made it simple (a 5-gon pinched to a disc wound the same way, outside it), the keyhole check refuses it with the not-simple diagnostic.
  - Corpus effect, reproduced in Python over the spike's dumped regions (the rule and the keyhole check; the consecutive-segment fold test not reproduced): LENA-R8 1349 becomes simple and keyholed, so it meshes; ANNA-B4 491 and ODIN 2625 have no width and get FACE-ZERO-WIDTH, unmeshed with no requests; the other 42 faces, all 32 MAYA faces among them, keep their not-simple outcome. ODIN 2613 (the whisker), 2615 and 2616 (the one-tolerance strips) are not zero-width by area and stay not simple.
  - Check, compiled, budget 120 s, on a copy of the library at 884466ac with the wiring edits below and this folder's pinch files: `V1PinchLaws` 8 pass; with `FaceMeshingLaws`, `FaceMeshingChartsLaws`, `TriangulationLaws`, `TriangulationCdtIndexedLaws`, `TriangulatedWitnessLaws`, `BoundaryIndexLaws`, `InsideOnGridLaws`, `UnwrapIndexedLaws`, `UvRegionCollisionLaws`, `FaceMeshingLiftIndexedLaws`, `FaceMeshingProofsLaws`, `ValidationProofsRegionsLaws`: 125 laws, 124 pass, 1 fail (`Law_RefinedInteriorMeetsMinAngle`, deleted by V1G-1). Not run: the whole sweep (the supervisor's merge sweep covers it) and the corpus (needs the regeneration).
- V1G-7 (TKT-399, second criterion), this commit, about 1.2 h against 2 h. No type added. Library `V1Fibres` (v1-fibres.library.plato): `Check_LocalVertexFibresAreIdentificationsIndexed` (two sorts: points by local vertex, keyed points by source key, neighbours compared; n log n against the reference's n^2 pairs), `Check_LocalVertexSurjectiveIndexed` (one marking pass against a scan of the points per local vertex), `ExactCheckOf` (the reference's fold reduced to its one Boolean: every sample of these exact laws is about the face, so WorstOf gives the same Check from one CheckExact, or the vacuous check with no sample), and the reference bodies under `...Reference` names. Laws (`V1FibresLaws`), 12: the two agreement laws over every PoleWitness face mesh and two mutations of each (two unrelated points merged; one point moved to a local vertex of its own), `Law_V1Gate_MutationsFail` (the mutations reach failing checks), `Law_V1Gate_IndexedChecksHold`, and eight timing laws, `Law_V1Gate_ValidateFaceMeshOn<Witness>`, each running ValidateFaceMesh at Geometric on one witness's face meshes.
  - Compiled, budget 600 s (the runner stops a law at 120 s whatever the budget), all twelve laws together on a saturated machine, so a law's time includes waiting for cores. Four copies of HEAD at dc2ccca4: with and without the wiring below, each with and without V1G-4's staged refinement in place of the merged `face-meshing-v1-plane.library.plato`.

| ValidateFaceMesh on | HEAD, reference checks | HEAD, indexed checks | with V1G-4, reference checks | with V1G-4, indexed checks |
|---|---|---|---|---|
| Sphere (0.05) | over 120 s | 3.00 s | 0.10 s | 0.17 s |
| Torus (0.05) | over 120 s | 35.5 s | 0.34 s | 0.41 s |
| Cone (0.01) | over 120 s | 8.41 s | 0.36 s | 0.41 s |
| TorusAtVertex (0.05) | over 120 s | 35.1 s | 0.22 s | 0.31 s |
| SphereByPoleLoops (0.05) | over 120 s | 2.49 s | 0.12 s | 0.09 s |
| RedundantPoleLoops (0.05) | over 120 s | 3.41 s | 0.10 s | 0.09 s |
| SphereFine (0.01) | over 120 s | 8.60 s | 0.61 s | 0.34 s |
| SphereByPoleLoopsFine (0.01) | over 120 s | 8.82 s | 0.55 s | 0.27 s |

  - Reading: with V1G-4 merged, ValidateFaceMesh is under 2 s on all eight witnesses with either form, because chordal-only refinement makes the curved meshes small; the criterion is met by V1G-4. The indexed checks are what keeps it linear-ish on a large face: on HEAD's meshes (angle pass, thousands of points) the reference checks alone pass the 120 s cap, the indexed form finishes in 2.5 to 35 s, and what remains there is the geometry checks (a surface projection per element sample), linear in the elements. The two forms agree on every mesh and mutation (both agreement laws pass on both V1G-4 copies; on HEAD's meshes the fibre agreement law times out on its reference side, the surjectivity one passes).
- V1G-8 (TKT-429), this commit, about 1.3 h against 2 h. No type added. Cause: `JoinedByCut` (05-face-meshing/uv-regions.library.plato) joins a band's two circles by a cut to `NearestUnwrapped`'s copy of the second circle's point. On a torus band between two v-circles the cross direction is periodic, so the second circle has a copy on each side; for the tube's top and bottom circles (half a turn apart) both are equally near, and the tie chose the inner half where moon_buggy's face #34380 bounds the outer. Fix: `BandEndCopy` (v1-band.library.plato, library `V1Band`) takes, among that copy and its copies one period either way across, the nearest one strictly to the left of the first circle's step at the cut's start (`IsLeftOfStep`, which follows the chart's mirroring), since the face lies to the left of its loops; with no period across (a cylinder band) it is `NearestUnwrapped`'s copy as before. Witness `Witness_TorusBand(major, minor, outer)` (same file): the torus (2, 0.5) between its bottom and top circles, the outer or the inner half by the loops' direction. Laws (`V1BandLaws`, v1-band.laws.plato), 2: `Law_V1Gate_OuterTorusBandMeshesOutside`, `Law_V1Gate_InnerTorusBandMeshesInside` (every point on its half, area within 2 percent of 2 pi r (pi R +- 2 r)).
  - Compiled, budget 120 s, copies of HEAD at dc2ccca4 with V1G-4's refinement: before the edit the outer band fails (meshed inside) and the inner passes (the tie happened to fall its way); after, both pass. The laws over the band, pole and gate witnesses (`BrepWitnessesLaws`, `PolesWitnessLaws`, `PolesLaws`, `FaceMeshingLaws`, `TriangulatedWitnessLaws`, `UnwrapIndexedLaws`, `FaceMeshingLiftIndexedLaws`, `StepToMeshWitnessesLaws`, `RefinementAttainableLaws`, `V1GateLaws`): 127 laws, the same verdicts before and after (126 pass; the one fail is the CylinderRefined lift case, which V1G-4's merge instructions replace).
  - moon_buggy_asm.stp through the harness, on scratch regenerations of the same library with and without the edit (regen-step-brep.ps1 into a scratch copy of bim-open-data at 3f1ad1b, Plato c8c83c8b; harness built with -p:DepsRoot pointing at the toolkit's deps): without, 162 of 162 faces meshed, closed, not oriented, 180 misoriented edges; with, closed and oriented, 0 boundary, 0 non-manifold, 0 misoriented. Faces 33, 65 and 127 lie 176 to 193 mm from an axis fitted to their own points (the outer half, 177.8 to 190.5 mm, within the fitted axis's error; before, 165 to 178 mm). The harness's contract check gives the same five failing faces with and without the edit (cones 26, 76, 132 with flipped elements; B-spline faces 41, 117 over the chordal bound), so none comes from this chunk.
  - Not run: the corpus rerun (TKT-429's third box; it needs the merged regeneration).
- V1G-9 (TKT-455), this commit, about 0.8 h. No staged code: the meshes are within the bound and the excess is in the measure. Faces 41 and 117 of moon_buggy_asm.stp take the quad grid (13 planar strip quads, about 80 by 1016 mm) under both F1's keep rule and T1's. A probe against a scratch regeneration of HEAD dc2ccca4 with V1G-4 (chordal 1.0, bound 1.00001) gives, per quad: F1's samples at most 0.96; the harness's contract samples (each triangle of both splits, seven barycentric points, the surface over the triangle's own parameter triangle measured to that triangle) up to 3.80, 2.35 and 1.62 on quads 0 to 2, all from one sample, the parameter midpoint of the split's diagonal, which lies 3.80 from one triangle of the split and 0.77 from the other. Geometrically, on a 21 x 21 sample: every point of every split triangle is within 0.954 of the surface (projection), and every surface point over a quad is within 0.956 of the quad. The B-spline's parametrization is not uniform across the strip, so a parameter point of one triangle lands in 3D inside its neighbour; the per-triangle parametric measure then overstates the chordal error. Refinement does not stop early here: the grid is kept and correct. The fix belongs to the harness's ContractCheck (and to this track's merged gate claim, which uses the same per-triangle form): TKT-455.
- V1G-10 (TKT-455), about 1.2 h. Harness half: bim-open-data 66f0da1 (`tools/step-corpus-harness/ContractCheck.cs`, pushed): a quad's surface samples go against each diagonal split as a whole (the nearer of its two triangles, the worse split counting), and every drawn triangle's barycentric samples are projected onto the surface. Old and new harness built against the same library (bim-open-data e646e28): moon_buggy_asm.stp over-chordal faces 16 to 14, only 41 and 117 leaving, every other failing face at the same deviation; the bump solid at 0.3, whose grid that library keeps outside the bound (TKT-415), fails with both at 0.075 against 0.01; the unit box and the cylinder hold. Plato half, this commit: library `V1GateSplits` (v1-splits.library.plato): `SplitDistance`, `SplitGapAt`, `SplitWithin`, `QuadSplitsWithinV1` (mesh to surface per triangle by projection, surface to mesh per split as a whole), `QuadSplitsWithinPerTriangle` (the old claim, kept by name for the comparison law), `Witness_SkewedPatchSolid(skew)` (a flat Bezier top whose middle control column sits at x = skew, so x runs unevenly with u) and `ForcedQuadMesh` (a face as one quad on its four boundary points, no keep rule). Laws (`V1GateSplitsLaws`), 2: `Law_V1Gate_SkewedQuadIsWithinAsASplit` (the skewed top's quad passes as a split and fails per triangle: the diagonal's parameter midpoint lands 0.14 off the diagonal) and `Law_V1Gate_BumpQuadFailsAsASplit` (the bump top forced to one quad fails both). Compiled, budget 120 s, on a copy of HEAD 15430645 with and without the wiring: `V1GateSplitsLaws` and `V1GateLaws`, 8 laws, 8 pass both ways.
  - Finding for v1-types: T1's keep rule (`GridTriangleWithinChordal`) measures a split triangle's diagonal midpoint against that triangle alone, the per-triangle form; once T1 merges it refuses grids such as moon_buggy's faces 41 and 117 (and the skewed patch's top), which then take refinement. Not wrong for the contract, only more elements; measuring the split as a whole there too would keep them.

## Gate and quality: every law of layer 5

126 laws in 15 law files (`grep Law_` over `05-face-meshing/*.laws.plato`, 2026-10-21). The four
properties of the contract are: **closure** (faces that share an edge use its one
discretization, so the meshes join), **orientation** (no inverted or folded element, regions
wound the right way), **coverage** (the face is tiled, no gap or overlap, and every face gets a
mesh or a located diagnostic), and **chordal** (every element within the chordal bound of the
surface, both ways). Two more kinds of law serve the gate without stating one of the four:
**trace** (provenance and stored data, the contract's fourth bullet) and **structure** (a fast
body equals its reference, a sum round-trips, a predicate is consistent, a witness reaches its
cases): they carry the gate laws from the reference function to the body on the live path, so
they stay in the gate. **Quality** is everything the contract leaves to the improvement pass:
angles (including the Delaunay property, which exists to maximise the smallest angle), aspect,
side-normal turn and element-normal agreement, quad planarity and convexity, slivers, and
refinement targets.

| Law | File | Kind |
|---|---|---|
| `Law_LoopPointLiftsToSharedPoint` | face-meshing.laws | gate: closure |
| `Law_LoopToUvCountMatchesDiscretization` | face-meshing.laws | gate: closure |
| `Law_PcurveAgreesWithProjection` | face-meshing.laws | gate: closure |
| `Law_UnwrapKeepsSources` | face-meshing.laws | gate: trace |
| `Law_UnwrapMovesByWholePeriods` | face-meshing.laws | gate: closure |
| `Law_UnwrappedStepBelowHalfPeriod` | face-meshing.laws | gate: coverage |
| `Law_SeamUsesOnOppositeCopies` | face-meshing.laws | gate: closure |
| `Law_RegionLoopClosesInPlane` | face-meshing.laws | gate: coverage |
| `Law_UvRegionWindingPositive` | face-meshing.laws | gate: orientation |
| `Law_UvHoleWindingNegative` | face-meshing.laws | gate: orientation |
| `Law_RegionSegmentsSeparated` | face-meshing.laws | gate: coverage |
| `Law_HoleInsideOuter` | face-meshing.laws | gate: coverage |
| `Law_SeamCutCopiesRunOpposite` | face-meshing.laws | gate: closure |
| `Law_MeshedFaceHasSimpleRegion` | face-meshing.laws | gate: coverage |
| `Law_TriangulationCornersInRange` | face-meshing.laws | gate: structure |
| `Law_TriangulationKeepsBoundary` | face-meshing.laws | gate: closure |
| `Law_TriangulationAddsOnlyInteriorPoints` | face-meshing.laws | gate: coverage |
| `Law_EveryPointIsACorner` | face-meshing.laws | gate: coverage |
| `Law_ElementPositiveInChart` | face-meshing.laws | gate: orientation |
| `Law_ElementAreasSumToRegionArea` | face-meshing.laws | gate: coverage |
| `Law_ElementLiftsFacingFaceNormal` | face-meshing.laws | gate: orientation |
| `Law_BoundarySegmentIsElementSide` | face-meshing.laws | gate: closure |
| `Law_InteriorSideIsShared` | face-meshing.laws | gate: coverage |
| `Law_ElementSpansBelowHalfPeriod` | face-meshing.laws | gate: orientation |
| `Law_LiftKeepsPoints` | face-meshing.laws | gate: structure |
| `Law_LocalVertexInRange` | face-meshing.laws | gate: structure |
| `Law_LocalVertexSurjective` | face-meshing.laws | gate: structure |
| `Law_LocalVertexFibresAreIdentifications` | face-meshing.laws | gate: closure |
| `Law_SharedPositionIsCopied` | face-meshing.laws | gate: closure |
| `Law_ProvenanceMatchesSource` | face-meshing.laws | gate: trace |
| `Law_PointNormalIsFaceNormal` | face-meshing.laws | gate: trace |
| `Law_DroppedElementsArePoleCollapsed` | face-meshing.laws | gate: closure |
| `Law_CollapsedQuadsBecomeTriangles` | face-meshing.laws | gate: closure |
| `Law_ElementFacesFaceNormal` | face-meshing.laws | gate: orientation |
| `Law_ElementNormalAgreesWithSurface` | face-meshing.laws | **quality**: element normal against the surface normal (SurfaceAngular) |
| `Law_SurfaceEdgeNormalTurnWithinSurfaceAngular` | face-meshing.laws | **quality**: side-normal turn |
| `Law_ElementDeviationWithinSurfaceChordal` | face-meshing.laws | gate: chordal |
| `Law_SurfaceWithinSurfaceChordalOfElement` | face-meshing.laws | gate: chordal |
| `Law_QuadPlanarWithinSurfaceChordal` | face-meshing.laws | **quality**: quad planarity; replaced in the gate by `Law_V1Gate_QuadSplitsWithinChordal` |
| `Law_QuadConvex` | face-meshing.laws | **quality**: quad convexity; replaced in the gate by `Law_V1Gate_QuadSplitsOriented` |
| `Law_NoQuadsUnlessPreferred` | face-meshing.laws | gate: structure |
| `Law_RequestsNameFaceEdges` | face-meshing.laws | gate: closure |
| `Law_MeshFaceReadsOnlyFaceEdges` | face-meshing.laws | gate: closure |
| `Law_BlockingRequestMeansEmptyMesh` | face-meshing.laws | gate: coverage |
| `Law_RequestHasDiagnostic` | face-meshing.laws | gate: coverage |
| `Law_EmptyMeshIsExplained` | face-meshing.laws | gate: coverage |
| `Law_OrientationOfAgreesWithLibrarySign` | face-meshing-charts.laws | gate: orientation |
| `Law_ExactOrientationIsLibrarySign` | face-meshing-charts.laws | gate: orientation |
| `Law_OrientationIsAntisymmetric` | face-meshing-charts.laws | gate: orientation |
| `Law_ElementInChartAreaHasItsOrientation` | face-meshing-charts.laws | gate: orientation |
| `Law_NeighbourTableIsInvolution` | face-meshing-charts.laws | gate: structure |
| `Law_NeighbourTableSeesClosure` | face-meshing-charts.laws | gate: structure |
| `Law_DelaunayCertificateIsConsistent` | face-meshing-charts.laws | gate: structure (the certificate's own consistency, not the Delaunay property) |
| `Law_LoopConstraintsAreSides` | face-meshing-charts.laws | gate: closure |
| `Law_OtherDiagonalIsNotASide` | face-meshing-charts.laws | gate: structure |
| `Law_WorseBoundsBoth` | face-meshing-charts.laws | gate: chordal |
| `Law_OtherCopyIsInvolution` | face-meshing-charts.laws | gate: structure |
| `Law_CopiesAreTheEnds` | face-meshing-charts.laws | gate: structure |
| `Law_LiftTableJoinsSeamPairsAndPoles` | face-meshing-charts.laws | gate: closure |
| `Law_LiftTableJoinsNothingElse` | face-meshing-charts.laws | gate: closure |
| `Law_QuadGridSidesRoundTrip` | face-meshing-charts.laws | gate: structure |
| `Law_InsertionRejectionRoundTrips` | face-meshing-decided.laws | gate: structure |
| `Law_InsertionAttemptRoundTrips` | face-meshing-decided.laws | gate: structure |
| `Law_FlipRejectionRoundTrips` | face-meshing-decided.laws | gate: structure |
| `Law_FlipAttemptRoundTrips` | face-meshing-decided.laws | gate: structure |
| `Law_FaceMeshOutcomeBlockedMapsToBlocked` | face-meshing-decided.laws | gate: coverage |
| `Law_FaceMeshResultKeepsDiagnostics` | face-meshing-decided.laws | gate: coverage |
| `Law_LiftCaseReachesItsBranches` | face-meshing-lift.laws | gate: structure |
| `Law_SourceKeyMatchesIdentification` | face-meshing-lift.laws | gate: closure |
| `Law_NeedsRefinementCachedAgrees` | refinement-test-cached.laws | gate: structure (the surface test drives chordal refinement) |
| `Law_InCircleWitnesses` | triangulation.laws | gate: structure |
| `Law_FlipNeverUndone` | triangulation.laws | gate: structure (flips terminate) |
| `Law_InCircleOfAgreesWithInCircle` | triangulation.laws | gate: structure |
| `Law_TrialAgreesWithTryInsertion` | triangulation-built.laws | gate: structure |
| `Law_SurfacePassBuiltAgrees` | triangulation-built.laws | gate: structure (the surface pass is the chordal refinement) |
| `Law_AnglePassBuiltAgrees` | triangulation-built.laws | **quality**: the angle pass |
| `Law_StripPassAgrees` | triangulation-built.laws | **quality**: the angle pass |
| `Law_TriangulateRegionCdtIndexedAgrees` | triangulation-cdt-indexed.laws | gate: structure |
| `Law_TriangulateRegionCdtIndexedAgreesOnStars` | triangulation-cdt-indexed.laws | gate: structure |
| `Law_TriangulateRegionCdtIndexedAgreesOnJagged` | triangulation-cdt-indexed.laws | gate: structure |
| `Law_TriangulateRegionCdtIndexedAgreesWhenWoken` | triangulation-cdt-indexed.laws | gate: structure |
| `Law_StarCasesRetestSlots` | triangulation-cdt-indexed.laws | gate: structure |
| `Law_BelowAngleCountsItsLifts` | triangulation-fast-marks.laws | **quality**: the angle pass |
| `Law_CarriedTableIsNeighbourSlots` | triangulation-neighbours-carried.laws | gate: structure |
| `Law_TriangulatedWitnessesCoverTheSamples` | triangulation-witness.laws | gate: structure |
| `Law_RefinedIsFaceTriangulation` | triangulation-witness.laws | gate: structure |
| `Law_OutcomeLiftsRefined` | triangulation-witness.laws | gate: structure |
| `Law_CdtKeepsBoundary` | triangulation-witness.laws | gate: closure |
| `Law_CdtKeepsEverySegment` | triangulation-witness.laws | gate: closure |
| `Law_CdtIsConforming` | triangulation-witness.laws | gate: coverage |
| `Law_CdtPositiveOrientation` | triangulation-witness.laws | gate: orientation |
| `Law_CdtNoFlippableEdge` | triangulation-witness.laws | **quality**: angles (the Delaunay property) |
| `Law_CdtAreaIsRegionArea` | triangulation-witness.laws | gate: coverage |
| `Law_UpdatedNeighboursAreTheTable` | triangulation-witness.laws | gate: structure |
| `Law_RefineMeetsContract` | triangulation-witness.laws | gate: coverage and orientation (every postcondition of `RefineToSurface`; none is an angle) |
| `Law_RefinedNoFlippableEdge` | triangulation-witness.laws | **quality**: angles (the Delaunay property) |
| `Law_RefinedInteriorMeetsMinAngle` | triangulation-witness.laws | **quality**: angles; **deleted** (TKT-416) |
| `Law_MinAngleNoWorseThanLibrary` | triangulation-witness.laws | **quality**: angles |
| `Law_MinAngleBetterOnCylinders` | triangulation-witness.laws | **quality**: angles |
| `Law_BoxFacesStayTwoTriangles` | triangulation-witness.laws | gate: the plane path (a plane face is its boundary's triangulation, no refinement) |
| `Law_QualityRequestsOnBoxes` | triangulation-witness.laws | **quality**: refinement targets |
| `Law_TriangulationCornersInRangeOnSamples` | triangulation-witness.laws | gate: structure |
| `Law_EveryPointIsACornerOnSamples` | triangulation-witness.laws | gate: coverage |
| `Law_LiftKeepsPointsOnSamples` | triangulation-witness.laws | gate: structure |
| `Law_LocalVertexInRangeOnSamples` | triangulation-witness.laws | gate: structure |
| `Law_LocalVertexSurjectiveOnSamples` | triangulation-witness.laws | gate: structure |
| `Law_ProvenanceMatchesSourceOnSamples` | triangulation-witness.laws | gate: trace |
| `Law_RequestsNameFaceEdgesOnSamples` | triangulation-witness.laws | gate: closure |
| `Law_InsideOnGridAgrees` | uv-boundary-index-inside.laws | gate: structure |
| `Law_InsideOnGridAgreesOnStars` | uv-boundary-index-inside.laws | gate: structure |
| `Law_InsideOnGridAgreesOnWideSegments` | uv-boundary-index-inside.laws | gate: structure |
| `Law_InsideOnGridAgreesBeyondTheGrid` | uv-boundary-index-inside.laws | gate: structure |
| `Law_IsConstrainedInAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_IsConstrainedInAgreesOnStars` | uv-boundary-index.laws | gate: structure |
| `Law_IsStrictlyInsideIndexedAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_IsStrictlyInsideIndexedAgreesOnStars` | uv-boundary-index.laws | gate: structure |
| `Law_IsStrictlyInsideIndexedAgreesOnJagged` | uv-boundary-index.laws | gate: structure |
| `Law_InCircleOfSortedAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_DelaunayedIndexedAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_DelaunayedIndexedAgreesOnStars` | uv-boundary-index.laws | gate: structure |
| `Law_SplitSideSlotIndexedAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_RefineIndexedAgrees` | uv-boundary-index.laws | gate: structure |
| `Law_RefineIndexedAgreesOnStars` | uv-boundary-index.laws | gate: structure |
| `Law_ThirteenHolesAgree` | uv-boundary-index.laws | gate: structure |
| `Law_UnwrapIndexedFindsTwins` | uv-regions-indexed.laws | gate: structure |
| `Law_CoarseRequestsByEdgeAsks` | uv-regions-indexed.laws | gate: structure |

Totals: 113 gate, 13 quality (one deleted, twelve moved). New gate laws in this folder: 6
(`V1GateLaws`, below).

### Where the quality laws go

Recommendation: **move** the 12 remaining quality laws into one new file of the improvement pass,
`10-editing/face-quality.laws.plato`, library `FaceQualityLaws`, bodies unchanged. Layer 10 sees
layer 5, so the helpers they call stay where they are. Then every law left in a layer 5 library
is a gate law, and the version 1 run is simply the layer 5 libraries plus the new gate library:

```
python -I sandbox/step-brep-mesh/tools/plato_laws.py "FaceMeshingLaws,FaceMeshingChartsLaws,FaceMeshingDecidedLaws,FaceMeshingLiftIndexedLaws,RefinementTestCachedLaws,TriangulationLaws,InsertionBuiltLaws,TriangulationCdtIndexedLaws,TriangulationFastMarksLaws,NeighboursCarriedLaws,TriangulatedWitnessLaws,BoundaryIndexLaws,InsideOnGridLaws,UnwrapIndexedLaws,V1GateLaws"
```

The two alternatives were weighed: a tag the version 1 run skips needs a runner change
(`plato_laws.py` filters by law or library name only) and leaves quality claims inside gate
libraries, where a later reader cannot tell them apart; deleting them loses the claims the
improvement pass will want back. A move needs neither.

## V1G-5: non-passing laws outside layer 5

Every law of layers 00 to 04 and 06 to 08 that is not pass or skipped in `reviews/verdicts-cpu64.tsv` (committed at 823302a3, sweep 3, compiled, budget 20 s): 121 laws, 31 fail, 6 error, 84 obligation. Kind follows the layer 5 list above. No law here is a quality law on its own; the five `PolesLaws` face-check laws bundle quality checks, and V1G-3's per-check laws replace them.

| Law | File | Verdict | Kind | Why it does not pass | Ticket | Fence |
|---|---|---|---|---|---|---|
| `BrepCheckingProofsLaws.Law_ValidatedReportIffClean` | 07-validation/validation-proofs.laws.plato | error | gate: structure (the report says clean exactly when it is) | over the 20 s budget; the meshes these laws build shrink under V1G-4's chordal-only refinement, so rerun after that merge | TKT-356 | supervisor (merge sweep) |
| `BrepCheckingProofsLaws.Law_ValidatedReportRecordsLevel` | 07-validation/validation-proofs.laws.plato | error | gate: structure (the report records its level) | over the 20 s budget; the meshes these laws build shrink under V1G-4's chordal-only refinement, so rerun after that merge | TKT-356 | supervisor (merge sweep) |
| `BrepFoundationLaws.Law_AngleTolerancePositive` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_CheckBoundIsNonNegative` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_ClosedPeriodIsRangeLength` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_FailedCheckHasDiagnostic` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_HoldsExactlyWhenWithinBound` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_LengthTolerancePositive` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_LengthToleranceResolvable` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_ParameterTolerancePositive` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepFoundationLaws.Law_WrapOnClosedDomainStaysInRange` | 00-foundation/foundation.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DDegreePositive` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DDomainNonEmpty` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DKnotCount` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DKnotsNonDecreasing` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DWeightCount` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurve2DWeightsPositive` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveDegreePositive` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveDomainNonEmpty` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveKnotCount` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveKnotsNonDecreasing` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveWeightCount` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_BSplineCurveWeightsPositive` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_CurvePlacementOrthonormal` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BrepGeometryLaws.Law_SurfacePlacementOrthonormal` | 01-geometry/geometry.laws.plato | fail | gate: structure (input validity) | fails on generated values outside the type's invariant; the law has no precondition | TKT-423 (new) | supervisor (layers 0, 1) |
| `BsplinePipelineLaws.Law_TighterChordalStaysWithinLooserBound` | 08-pipeline/bspline-pipeline.laws.plato | error | gate: chordal | over the 20 s budget; the meshes these laws build shrink under V1G-4's chordal-only refinement, so rerun after that merge | TKT-356 | supervisor (merge sweep) |
| `BsplinePipelineLoopRunLaws.Law_BumpSolidValidatesStructurally` | 08-pipeline/bspline-pipeline-run.laws.plato | fail | gate: orientation (a degenerate element) | the bump solid's top has a degenerate element | TKT-401 | v1-faces |
| `BsplineSagittaLaws.Law_SagittaIsAttained` | 04-discretization/bspline-sagitta.laws.plato | fail | gate: chordal (edge segments within the bound) | fails on fixture 12; cause not named | TKT-425 (new) | v1-edges |
| `EdgeDiscretizingLaws.Law_SegmentFloorMet` | 04-discretization/discretization.laws.plato | fail | gate: structure (segment floors keep shared edges matching) | takes an arbitrary discretization and ill-formed criteria | TKT-424 (new) | v1-edges |
| `Part21ReadingLaws.Law_InstancePositionIsExact` | 03-step/step-part21.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `Part21ReadingLaws.Law_ParseFindingsPointAtTheirSubject` | 03-step/step-part21.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `Part21ReadingLaws.Law_ParseOkIffNoError` | 03-step/step-part21.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `Part21ReadingLaws.Law_ParsePrintParseIsIdentity` | 03-step/step-part21.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `PolesLaws.Law_ConeFaceChecksHold` | 07-validation/poles.laws.plato | fail | mixed: bundles 12 gate and 4 quality checks | superseded by V1PoleChecksLaws (V1G-3), whose gate laws all pass after V1G-4 | TKT-399 | this track |
| `PolesLaws.Law_SphereByPoleLoopsFaceChecksHold` | 07-validation/poles.laws.plato | fail | mixed: bundles 12 gate and 4 quality checks | superseded by V1PoleChecksLaws (V1G-3), whose gate laws all pass after V1G-4 | TKT-399 | this track |
| `PolesLaws.Law_SphereFaceChecksHold` | 07-validation/poles.laws.plato | fail | mixed: bundles 12 gate and 4 quality checks | superseded by V1PoleChecksLaws (V1G-3), whose gate laws all pass after V1G-4 | TKT-399 | this track |
| `PolesLaws.Law_TorusAtVertexFaceChecksHold` | 07-validation/poles.laws.plato | fail | mixed: bundles 12 gate and 4 quality checks | superseded by V1PoleChecksLaws (V1G-3), whose gate laws all pass after V1G-4 | TKT-399 | this track |
| `PolesLaws.Law_TorusFaceChecksHold` | 07-validation/poles.laws.plato | error | mixed: bundles 12 gate and 4 quality checks | superseded by V1PoleChecksLaws (V1G-3), whose gate laws all pass after V1G-4 | TKT-399 | this track |
| `StepReadingLaws.Law_AngleUnitIsReported` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_BodyCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_CirclePeriodIsTwoPi` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ClosureMarksAreTheDecisions` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_CurveClosureDecidedByEnds` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_CurveCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DeclaredClosedCopied` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DecodeFindingsPointAtTheirSubject` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DecodeIsTotal` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DecodedMagnitudesAreTheModels` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DecodedToleranceResolvable` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_DecodedTolerancesWellFormed` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_EdgeCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_EdgeSenseCopied` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_FaceCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_FoldFlipsExactlyRecorded` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_FoldPreservesInteriorSide` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_FoldRecordsNameFalseFlags` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_LeftHandedSurfacesAreFolded` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_LoopCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_MergedVerticesCoincide` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_MirrorFoldRecordedOnce` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ModelUnitIsRootUnit` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_OuterFlagClearedWhenDoubled` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_OuterFlagCopiedWhenSingle` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ParameterFloorsFollowLength` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_PcurveCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_PcurvesComeFromPcurveInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ProvenanceCoversModel` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ProvenanceLookupInvertsSources` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ProvenanceSourcesDistinct` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_RawFaceFlagsAreTheFiles` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ReachedInstancesAreAccountedFor` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_RepairedSourcesAreUnmapped` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_RepairsAreDiagnosed` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ShellCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_SourceKindMatchesTable` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_SurfaceClosureDecidedBySides` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_SurfaceCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_ToleranceCoversStatedUncertainties` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_UncertaintyDefaultExactlyWhenAbsent` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepReadingLaws.Law_VertexCountMatchesInstances` | 03-step/step.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepSchemaModelLaws.Law_AggregateBoundsHold` | 03-step/step-schema.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepSchemaModelLaws.Law_AttributeCountMatchesSchema` | 03-step/step-schema.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepSchemaModelLaws.Law_AttributeKindsMatchSchema` | 03-step/step-schema.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepSchemaModelLaws.Law_DefinedTypeRulesHold` | 03-step/step-schema.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepSchemaModelLaws.Law_SchemaDerivesAreInherited` | 03-step/step-schema.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_DecodeErrorMeansNotOk` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_EveryStepTextDiagnosticIsLocated` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_MeshStepTextIsDeterministic` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_NoFacesMeansNoMesh` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_NoFacesMeansNotOk` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_ParseErrorMeansNotOk` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshLaws.Law_PowerOfTwoScalingKeepsConnectivity` | 08-pipeline/pipeline.laws.plato | error | gate: structure (scaling keeps connectivity) | over the 20 s budget; the meshes these laws build shrink under V1G-4's chordal-only refinement, so rerun after that merge | TKT-356 | supervisor (merge sweep) |
| `StepToMeshLaws.Law_PowerOfTwoScalingScalesPositions` | 08-pipeline/pipeline.laws.plato | error | gate: structure (scaling scales positions) | over the 20 s budget; the meshes these laws build shrink under V1G-4's chordal-only refinement, so rerun after that merge | TKT-356 | supervisor (merge sweep) |
| `StepToMeshLaws.Law_StepTextOkExactlyWhenClean` | 08-pipeline/pipeline.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepToMeshProofsBSplinesLaws.Law_WellFormedBSplineKeepsRecord` | 08-pipeline/pipeline-proofs-bsplines.laws.plato | fail | gate: structure | fails compiled, passes interpreted (F-59) | TKT-426 (new) | v1-compiler |
| `StepWhereRulesLaws.Law_Practice_Axis2Placement3D_Orthogonal` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_AdvancedFace_WR10` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_AdvancedFace_WR6` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Axis2Placement3D_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Axis2Placement3D_WR3` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Axis2Placement3D_WR4` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_CartesianTransformationOperator_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_ConversionBasedUnit_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Direction_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_EdgeLoop_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Face_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_IntersectionCurve_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Parabola_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Path_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Pcurve_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_Pcurve_WR3` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_RationalBSplineSurface_WR1` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_RectangularTrimmedSurface_WR3` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_RectangularTrimmedSurface_WR4` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_RepresentationRelationshipWithTransformation_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_SeamCurve_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_SeamCurve_WR3` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_SeamCurve_WR4` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_SurfaceCurve_WR2` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWhereRulesLaws.Law_Where_SurfaceCurve_WR3` | 03-step/step-where.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |
| `StepWitnessesLaws.Law_WitnessFilesSatisfyInvariants` | 03-step/step-witnesses.laws.plato | obligation | gate: structure (what reading a file must give) | host obligation: calls a host function the runner cannot evaluate; checked by the host's tests, not a failure | - | none (host C#) |

Per ticket: - 84, TKT-356 5, TKT-399 5, TKT-401 1, TKT-423 (new) 23, TKT-424 (new) 1, TKT-425 (new) 1, TKT-426 (new) 1.

## Merge instructions

V1G-1 (TKT-418, TKT-416):
- Delete `Law_RefinedInteriorMeetsMinAngle` (05-face-meshing/triangulation-witness.laws.plato), its claim `RefinedMinAngleOn` (triangulation-witness.library.plato) and `TouchesBoundary` (triangulation.laws.plato), which only `RefinedMinAngleOn` calls; drop the law's row from `reviews/verdicts-cpu64.tsv`.
- Create `10-editing/face-quality.laws.plato`, library `FaceQualityLaws`, and move into it, bodies and comments unchanged:
  - from `FaceMeshingLaws` (face-meshing.laws.plato): `Law_ElementNormalAgreesWithSurface`, `Law_SurfaceEdgeNormalTurnWithinSurfaceAngular`, `Law_QuadPlanarWithinSurfaceChordal`, `Law_QuadConvex`
  - from `InsertionBuiltLaws` (triangulation-built.laws.plato): `Law_AnglePassBuiltAgrees`, `Law_StripPassAgrees`
  - from `TriangulationFastMarksLaws` (triangulation-fast-marks.laws.plato): `Law_BelowAngleCountsItsLifts`
  - from `TriangulatedWitnessLaws` (triangulation-witness.laws.plato): `Law_CdtNoFlippableEdge`, `Law_RefinedNoFlippableEdge`, `Law_MinAngleNoWorseThanLibrary`, `Law_MinAngleBetterOnCylinders`, `Law_QualityRequestsOnBoxes` with its helpers `QualityRequestsOn` and `ExtentSum`
  - rename their rows in `reviews/verdicts-cpu64.tsv` to `FaceQualityLaws.<law>`.
- Move this folder's `v1-gate.types.plato`, `v1-gate.library.plato` and `v1-gate.laws.plato` to `08-pipeline/` (the witnesses mesh through layer 08's loop), as `pipeline-v1-gate.{types,library,laws}.plato`; the law names keep `Law_V1Gate_` (unique already).
- Add the gate/quality table above to `05-face-meshing/README.md` under "Laws", and the version 1 run's filter line.

V1G-2 (TKT-349, TKT-412):
- `RefineToSurface` (05-face-meshing/face-meshing.library.plato) => `m.RefineToSurfaceV1(f, r, chart, t, c)`; its comment becomes "Refinement under the version 1 contract (RefineToSurfaceV1): none on a plane face; elsewhere against the surface and the smallest-angle bound, by insertion and flips (RefineToSurfaceByInsertion, triangulation-fast.library.plato)."
- Move `v1-plane.library.plato` to `05-face-meshing/face-meshing-v1-plane.library.plato` (library `V1Plane`), and `v1-plane.laws.plato` to `08-pipeline/pipeline-v1-plane.laws.plato` (library `V1PlaneLaws`; it reads the gate witnesses).
- In `TriangulatedWitnessLaws` (05-face-meshing/triangulation-witness.laws.plato), read `w.MeshedTriangulationOf` in place of `w.Refined` in exactly three bodies: `Law_RefinedIsFaceTriangulation` (the first argument of `SameTriangulation`), `Law_OutcomeLiftsRefined` (the argument of `Lift`), `Law_LiftKeepsPointsOnSamples` (the receiver of `LiftKeepsPointsOn`); in their comments, "the triangulation MeshFace lifts (MeshedTriangulationOf)" for "the witness's refined triangulation".
- In `CappedAt` (08-pipeline/pipeline-attainable.laws.plato), the `Wired` field lifts `m.RefineToSurface(...)` in place of `m.RefineToSurfaceByInsertion(...)`, so `Law_CappedPathIsMeshFace` compares MeshFace with the live refinement.
- The wired copy these edits were checked on: `git archive HEAD sandbox/step-brep-mesh` at 884466ac with exactly these four edits.

V1G-3 and V1G-4 (TKT-399):
- No new wiring for the refinement: `RefineToSurface` already points at `RefineToSurfaceV1` (V1G-2), whose body now refines curved faces against the chordal bound alone.
- `v1-poles.laws.plato` moves to `07-validation/poles-checks.laws.plato` (library `V1PoleChecksLaws`), except its four quality laws (`Law_V1Gate_PoleQuadConvex`, `..QuadPlanarWithinSurfaceChordal`, `..ElementNormalAgreesWithSurface`, `..SurfaceEdgeNormalTurnWithinSurfaceAngular`), which go to `FaceQualityLaws` with V1G-1's quality laws.
- In `face-meshing-lift.laws.plato` (05), `Witness_CylinderRefinedLift` becomes `Witness_SphereRefinedLift(_: LiftCase): LiftCase => LiftCaseAt("SphereRefined", 2, 2, [LiftBranch.InteriorPoints, LiftBranch.IdentifiedPoints]);`, and the comment on `Law_LiftCaseReachesItsBranches` says "SphereRefined interior points" for "CylinderRefined interior points".
- Delete `Law_MinAngleNoWorseThanLibrary` (see V1G-4 above), or keep it out of the version 1 run in `FaceQualityLaws` and expect it to fail.

V1G-4, at its merge: the library holds V1G-2's (merged in e9d9586f) `05-face-meshing/face-meshing-v1-plane.library.plato` (library `V1Plane`); this folder's `v1-plane.library.plato` is the V1G-4 version of the same library. Replace the merged file's content with the staged file's, not both: they declare the same functions.

V1G-6 (TKT-412), four in-place edits and three moves:
- `SegmentsSeparated` (05-face-meshing/uv-regions.library.plato) => `r.SegmentsSeparatedV1(tol, k, i, q, j)`; its old body is the V1 body's fallback and can go.
- `IsEar` (05-face-meshing/face-meshing.library.plato): the skip condition becomes `(x == p || x == q || x == s || points[x].IsCornerOf(points[p], points[q], points[s]))`.
- `EarClippedIndexedCounted` (05-face-meshing/triangulation-cdt-indexed.library.plato), the blocker test: `if (copies.At(y) > 0 && y != p && y != q && y != s && points[y].IsCornerOf(points[p], points[q], points[s]).Not)`.
- `MeshRegion` (05-face-meshing/face-meshing.library.plato) => `m.MeshRegionOnceV1(f, d, c)`.
- Move `v1-pinch.library.plato` to `05-face-meshing/face-meshing-v1-pinch.library.plato`, `v1-pinch.witnesses.plato` to `05-face-meshing/face-meshing-v1-pinch-witnesses.library.plato`, and `v1-pinch.laws.plato` to `05-face-meshing/face-meshing-v1-pinch.laws.plato`; they read only layer 5.
- The four edits were checked exactly as written above, on a copy of the library at 884466ac.

V1G-7 (TKT-399, second criterion):
- Move `v1-fibres.library.plato` to `07-validation/validation-checks-fibres.library.plato` (library `V1Fibres`) and `v1-fibres.laws.plato` to `07-validation/validation-checks-fibres.laws.plato` (library `V1FibresLaws`; it reads PoleWitness).
- `Check_LocalVertexFibresAreIdentifications` (07-validation/validation-checks-face-meshing.library.plato) => `fm.Check_LocalVertexFibresAreIdentificationsIndexed`; `Check_LocalVertexSurjective` => `fm.Check_LocalVertexSurjectiveIndexed`. Their old bodies are the staged `...Reference` functions already, so nothing else moves; update the fibre check's comment ("quadratic as written; an implementation groups...") to name the indexed form.
- The eight `Law_V1Gate_ValidateFaceMeshOn<Witness>` laws are timing probes; keep them in the merge sweep if the 2 s budget should guard TKT-399's criterion, or drop them after the first sweep.

V1G-8 (TKT-429):
- In `JoinedByCut` (05-face-meshing/uv-regions.library.plato): `var end = m.SurfaceDomainOf(f).NearestUnwrapped(b.Points[j], start);` => `var end = m.BandEndCopy(f, a, i, b, j);`, and the function's comment says the cut ends at "the copy of b's point nearest it on the face's side (BandEndCopy)".
- Move `BandEndCopy` and `UvDistance` (v1-band.library.plato) to `05-face-meshing/face-meshing-v1-band.library.plato` (library `V1Band`), and `Witness_TorusBand` to layer 7's witnesses beside `Witness_Torus` (07-validation/validation-witnesses.library.plato); `v1-band.laws.plato` goes to `07-validation/poles-band.laws.plato` (library `V1BandLaws`; it reads `PolesOptionsAt`).

V1G-10 (TKT-455):
- `QuadSplitsWithin` (08-pipeline/pipeline-v1-gate.library.plato) => `m.QuadSplitsWithinV1(d, fm, q, bound)`; its comment says each split is measured as a whole.
- Move `v1-splits.library.plato` to `08-pipeline/pipeline-v1-gate-splits.library.plato` (library `V1GateSplits`; `Witness_SkewedPatchSolid` may go beside `Witness_BSplinePatchSolid` in 07-validation/validation-witnesses.library.plato instead) and `v1-splits.laws.plato` to `08-pipeline/pipeline-v1-gate-splits.laws.plato`.

V1G-5 (triage):
- Delete the five `PolesLaws` face-check laws (`Law_SphereFaceChecksHold`, `Law_SphereByPoleLoopsFaceChecksHold`, `Law_TorusFaceChecksHold`, `Law_ConeFaceChecksHold`, `Law_TorusAtVertexFaceChecksHold`, 07-validation/poles.laws.plato) and `FaceCheckFailures` if nothing else calls it, when `V1PoleChecksLaws` merges: the per-check laws state the same checks, gate and quality apart.
- No other move: none of the other 116 is a quality law.

## Contract requests

## Requests to other tracks
- supervisor: decided 2026-10-22 (yes, chordal bound alone); staged as V1G-4.
- polystrata spike (local_63fdab15, done): its dumped regions in sandbox/step-mesh-staging/polystrata-spike/regions are what V1G-6's witness and corpus reproduction read; the folder is not committed, so the witness file carries the copied coordinates.
- v1-faces (TKT-411): `Witness_SphereByPoleLoops(1.0)` at chordal 0.05 and 0.01 with SurfaceAngular 180 degrees throws `ArgumentOutOfRangeException` while meshing (scratch copy, compiled); it may be a small witness for TKT-411's index error. Not blocking.
- v1-faces (TKT-415): `Law_V1Gate_QuadSplitsWithinChordal` fails on `Witness_BumpSolidV1Gate` (the bump solid at 0.3): the quad grid keeps the top face as one flat quad. It is the law TKT-415's first criterion asks for, on the whole witness; the fix is yours. Not blocking V1G-1.
- v1-faces (quad grid): the version 1 contract relaxes the grid's keep rule. Today a quad is kept only when planar within SurfaceChordal and strictly convex (`QuadGridIfRectangular`, "Quads" section of face-meshing.library.plato); the contract keeps any quad whose both diagonal splits are within the chordal bound and oriented (`QuadSplitsWithin`, `QuadSplitsOriented` in this folder's `v1-gate.library.plato`). Changing the keep rule is yours, since you own the grid functions; not blocking.

## Findings
- moon_buggy_asm.stp, at HEAD with V1G-4's refinement and with or without V1G-8: the harness's contract check reports three cone faces (26, 76, 132) with 195, 195 and 4 flipped elements, marked explained, and two B-spline faces (41, 117) at 3.8 times the chordal bound. Orientation is a gate property, so the cones' flips are worth a ticket if "explained" does not mean apex-collapsed elements the contract allows.
- `SameUvPoints` (face-meshing-lift.laws.plato) guards with `a.Count == b.Count && ...`, but both sides of `&&` are evaluated (as the library already notes of `||`), so two triangulations of different sizes make `Law_RefinedIsFaceTriangulation` throw, reported as an error, instead of fail. Every `Same*` helper written this way has the defect; a conditional guards it.
- The host (`StepPlatoMesher.MeshFile`) runs no refinement loop, so a face's blocking edge requests (FACE-NOT-SIMPLE's "refine this edge") are never acted on in the corpus. Finer edges would not have helped the MAYA family (TKT-419): at chordal 0.01 and 0.001 mm the gallery mode reports the same 13 not-simple faces in MAYA-W260_REVC.
- Quad grids on four-sided plane faces still place interior grid points; the contract's "no refinement" is read here as applying to triangulated plane faces. Whether a plane face should skip the grid is open (v1-faces owns the grid).
- Layer 5's element laws over a `FaceMesh` parameter (`Law_ElementDeviationWithinSurfaceChordal`, `Law_SurfaceWithinSurfaceChordalOfElement`, `Law_ElementFacesFaceNormal`, `Law_QuadConvex` and the like) pass on "25 cases" the runner generates; a generated `FaceMesh` is not one MeshFace built, so these verdicts say little. `V1GateLaws` states the same claims on four real meshes from layer 08's loop.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading the contract, tickets, layer 5 laws and verdicts | 25 min | 0 |
| Probe: two layer 5 laws on the warm server | 1 min | 1 (cold compile 40 s) |
| Gate laws, first run on the warm server | 4 min | 1 (recompile 113 s, laws 15 s) |
| Gate laws, compiled | 10 min, in the background | 1 (front end 143 s, emit 176 s, C# compile 269 s, witnesses 20 s, laws 26 s wall) |
| Gate/quality list and TRACK.md | 20 min | 0 |
| V1G-2: plane path and its laws | 20 min | 0 |
| Plane laws before, compiled | 3.3 min, background | 1 (cached front end; emit 26 s, compile 21 s) |
| Layer 5 and gate laws on the wired copy, compiled | 3.1 min, background | 1 |
| Full sweep, base then wired, compiled | 11.5 min, background | 2 (6.1 and 5.4 min) |
| Recheck of changed laws on the wired copy | 1 min | 1 |
| TKT-412: harness time and gallery runs on MAYA-W260_REVC | 9 min | 4 (two gallery runs at 3.5 min each while the sweep held the cores) |
| TKT-412: probe against the compiled library, STEP entity reading, chain script | 25 min | 3 builds, 4 runs |
| TKT-419 and TRACK.md | 15 min | 0 |
| V1G-3: per-check laws | 10 min | 0 |
| Per-check laws, budget 20 s then 600 s, compiled | 3.5 min, then 3.2 min in the background | 2 |
| Cone probe against the compiled library | 15 min | 4 builds, 4 runs |
| Scratch copies without the angle pass, then without SurfaceAngular | 2.1 min | 2 |
| TRACK.md | 10 min | 0 |
| V1G-4: chordal-only refinement | 15 min | 0 |
| V1G-4 check on the wired copy, compiled, budget 120 s | 1 min | 1 |
| Lift-case fix and recheck | 5 min | 1 (front end recompiled after the library edit, 1.8 min) |
| V1G-5: listing, reading the 37 failing laws, ticket search, 4 tickets, table | 35 min | 0 |
| V1G-6: rule, witnesses from the spike's dump, laws | 25 min | 0 |
| V1G-6: first compile of a new folder path | 6.8 min | 1 (cold: the cache is per folder path) |
| V1G-6: compiled probe of the ear clipper on pinches | 5 min | 1 build, 1 run |
| V1G-6: wired copy and three reruns, compiled | 1 to 1.3 min each | 3 |
| V1G-6: Python reproduction over the 45 dumped regions | 10 min | 2 |
| V1G-7: reading the checks, indexed forms, laws | 30 min | 0 |
| V1G-7: HEAD with and without the wiring, compiled, budget 600 s | 8.5 min, background | 2 (cold compile of new folders) |
| V1G-7: the same with V1G-4's refinement | 3 min, background | 2 |
| V1G-8: reading the band cut, fix, witness, laws | 30 min | 0 |
| V1G-8: laws before and after, compiled | 3 min, background | 2 |
| V1G-8: regression laws before and after | 3.5 min, background | 2 |
| V1G-8: two scratch regenerations and harness builds | 2 and 2.5 min, background | 2 (regeneration 1.5 min each) |
| V1G-8: moon_buggy gallery runs and the axis distances | 6 min | 5 |
| V1G-9: face table, measure comparison, probe of face 41 (three versions), ticket | 45 min | 4 builds, 4 runs |
| V1G-10: harness change, old and new harness builds, moon_buggy and witness runs | 25 min | 2 builds, 8 runs |
| V1G-10: Plato claim, witnesses, laws, two compiled runs | 30 min | 2 (89 s and 43 s) |

## Lessons
- The compile cache follows the folder path: a fresh scratch folder cost 6.8 minutes, the same folder rerun about 1 minute. Keep one scratch folder per check.
- The spike's dumped regions let a Python reproduction of the rule decide the corpus effect on all 45 faces in seconds, before any regeneration; it caught MAYA 1599, which the rule alone would have accepted.
- Sixteen laws over the same eight witnesses at a 20 s budget made almost every law a budget error: the laws share the cores, so each law's wall time is the batch's. A larger budget gave the verdicts in 3 minutes.
- A probe console project referencing the corpus harness's release folder reads the compiled library directly (witnesses included), which named the failing elements in minutes where a law could only say "fails".
- A `find` over `artifacts/` took 2 minutes; the corpus report names the build folder, which is the place to look.
- The full sweep on a pristine and on a wired `git archive` copy, one after the other, gave a clean before and after in 12 minutes; a budget error that flips both ways is load, and a rerun alone settles it.
