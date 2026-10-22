# v1-gate: layer 5 meets the version 1 mesh contract, and plane faces take the no-refinement path

Ticket: TKT-418 (with TKT-416), then TKT-349 with TKT-412, then TKT-399
Status: ready: V1G-1, V1G-2, V1G-3 (V1G-3 is the diagnosis and the per-check laws; its fix waits on a decision, below)

The contract is `sandbox/step-brep-mesh/README.md`, "Version 1 mesh contract" (owner, 2026-10-21).

## Chunks

| Id | Tickets | What | Expected |
|---|---|---|---|
| V1G-1 | TKT-418, TKT-416 | the gate/quality list of every layer 5 law; where the quality laws go; the gate laws on real face meshes, including both diagonal splits of every quad; delete `Law_RefinedInteriorMeetsMinAngle` | 2 h |
| V1G-2 | TKT-349, TKT-412 | plane faces triangulated from boundary and holes with no refinement; the 45 not-simple plane faces meshed or explained | 2 h |
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
  - TKT-412: the 27 twelve-edge plane faces (three MAYA REVC files, 9 each) are a file defect, not a false collision. In SHO/MAYA-W260_REVC.step loop #39396, edge #39442 (an arc of radius 0.15) is written with its vertices against the loop's vertex chain, so read literally it runs 350.4 degrees instead of 9.6, and the loop crosses itself through three of its own vertices. Layer 5's FACE-NOT-SIMPLE diagnostic is correct and kept; the evidence and the repair are TKT-419 (filed). The other 18 faces (ODIN-W260 4, LENA-R8 1, ANN-MB2 2, CAM, ANNA-B4, and the 54-edge MAYA faces) have no broken vertex chain; each keeps its located FACE-NOT-SIMPLE diagnostic with edge requests, and its cause is not yet named.
- V1G-3 (TKT-399), this commit, about 1.3 h against 2 h. No type added. Library `V1PoleChecksLaws` (v1-poles.laws.plato), 16 laws `Law_V1Gate_Pole<Check>`: each of the sixteen checks `ValidateFaceMesh` runs at Geometric, as its own law over every face of every `PoleWitness` (07-validation/poles-witness), so a verdict names the failing check. Each law's comment gives its kind.
  - Committed library, compiled, budget 600 s: 13 pass, 3 fail. Quality, so out of the version 1 gate: `ElementNormalAgreesWithSurface` (fails first on the sphere) and `SurfaceEdgeNormalTurnWithinSurfaceAngular` (first on the cone). Gate: `ElementFacesFaceNormal`, on the cone's lateral face only: 4 of its 4,378 elements, each with three corners nearly on one ruling through the apex (three on the seam copy u = -2 pi, one on u = 0 within 1.3e-6), 3D area 1e-8 or less, winding sign -1 or 0. Their corners are `Interior` points: refinement inserts points ever closer to the seam beside the apex (u distances 6.8e-4, 3.4e-4, 1.7e-4, 8.5e-5, each still 85 or more tolerance units inside, 122 of the 2,177 interior points within 1e-3 of a seam copy), and the apex's zero radius makes the resulting triangles degenerate in space. Every gate check passes on both spheres, the torus, the torus pinned at a vertex, the redundant-pole sphere and the cone's base disk. So the *FaceChecksHold failures on the sphere, torus and pinned torus were quality checks; the one gate failure is the cone.
  - Cause, by elimination on scratch copies: with the angle pass off (`RefinementMinAngle` 0) the 4 slivers stay; with the angular surface criterion also off (SurfaceAngular 180 degrees in the pole options) all 16 checks pass, witnesses build in 1.1 s against 14.6 s, and the 16 laws take 1.9 s summed against 295 s. Both criteria are quality under the contract. But in that run the two pole-loop sphere witnesses throw `ArgumentOutOfRangeException` while being built (with SurfaceAngular off they mesh coarser), so it covers six witnesses of eight; the throw looks like TKT-411's.
  - Not fixed here: refinement on version 1's curved faces against the chordal bound alone (no angle pass, no SurfaceAngular test) changes every curved face's mesh and needs the index error fixed first; it is a decision for the supervisor (see Requests). The per-check laws stay staged until then: on the committed library they take 15 to 108 s each, compiled.
  - TKT-399's second criterion (ValidateFaceMesh under 2 s on a built mesh): `LocalVertexFibresAreIdentifications` is the slow check, 108.5 s over the 8 witnesses with the others at 15 to 25 s while they share the cores and 0.02 s for the cheap ones; on the chordal-only meshes all 16 take 1.9 s summed. Not fixed.

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

V1G-3 (TKT-399):
- None yet. `v1-poles.laws.plato` moves to `07-validation/poles-checks.laws.plato` (library `V1PoleChecksLaws`) only together with the chordal-only refinement below, or with the four gate laws alone (`Law_V1Gate_PoleElementFacesFaceNormal`, `..ElementPositiveInChart`, `..ElementDeviationWithinSurfaceChordal`, `..SurfaceWithinSurfaceChordalOfElement`) and a budget the 15 to 25 s they take today allows.

## Contract requests

## Requests to other tracks
- supervisor (decision, blocks TKT-399's fix): should version 1 refine curved faces against the chordal bound alone, dropping the angle pass and the SurfaceAngular test from refinement? The contract makes both quality; doing so clears the cone's only gate failure (4 apex slivers) and cuts the pole witnesses' build from 14.6 s to 1.1 s, but changes every curved face's mesh, and two pole-loop sphere witnesses then throw an index error (see the next line). If yes, the change is a `RefineToSurfaceV1` that passes SurfaceAngular 180 degrees and skips the angle pass, which this track can stage as V1G-4.
- v1-faces (TKT-411): `Witness_SphereByPoleLoops(1.0)` at chordal 0.05 and 0.01 with SurfaceAngular 180 degrees throws `ArgumentOutOfRangeException` while meshing (scratch copy, compiled); it may be a small witness for TKT-411's index error. Not blocking.
- v1-faces (TKT-415): `Law_V1Gate_QuadSplitsWithinChordal` fails on `Witness_BumpSolidV1Gate` (the bump solid at 0.3): the quad grid keeps the top face as one flat quad. It is the law TKT-415's first criterion asks for, on the whole witness; the fix is yours. Not blocking V1G-1.
- v1-faces (quad grid): the version 1 contract relaxes the grid's keep rule. Today a quad is kept only when planar within SurfaceChordal and strictly convex (`QuadGridIfRectangular`, "Quads" section of face-meshing.library.plato); the contract keeps any quad whose both diagonal splits are within the chordal bound and oriented (`QuadSplitsWithin`, `QuadSplitsOriented` in this folder's `v1-gate.library.plato`). Changing the keep rule is yours, since you own the grid functions; not blocking.

## Findings
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

## Lessons
- Sixteen laws over the same eight witnesses at a 20 s budget made almost every law a budget error: the laws share the cores, so each law's wall time is the batch's. A larger budget gave the verdicts in 3 minutes.
- A probe console project referencing the corpus harness's release folder reads the compiled library directly (witnesses included), which named the failing elements in minutes where a law could only say "fails".
- A `find` over `artifacts/` took 2 minutes; the corpus report names the build folder, which is the place to look.
- The full sweep on a pristine and on a wired `git archive` copy, one after the other, gave a clean before and after in 12 minutes; a budget error that flips both ways is load, and a rerun alone settles it.
