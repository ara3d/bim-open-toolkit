# catalog-proofs: TYPE-CATALOG.md section 4 (proof-carrying types) and the section 15 concepts IToleranced, IHasProvenance

Ticket: TKT-323
Status: ready: catalog-proofs

## Done
- catalog-proofs, 5cef4318 (types, Decided sums, constructors, kernel laws) and the commit holding
  this file (regions, discretization, mesh, geometry laws; spec; TRACK.md), about 1.7 hours against
  2 expected: 57 `Law_Catalog_` laws, all pass under cpu64, also on a fresh copy of the folder;
  zero type errors in this folder; pinned CLI `lint` over the library and the three folders: 0
  resolution errors, no LINT001, 35 LINT003 and 8 LINT014 infos (below).

Types added (26): `InRangeModel`, `PreparedModel`, `ResolvableModel`, `ChainedLoop`, `ClosedShell`,
`OrientedShell`, `ConnectedShell` (kernel); `SimpleUvLoop`, `ClosedUvLoop`, `OrientedUvRegion`
(regions); `CompleteDiscretization`, `PartialDiscretization`, `CanonicalDiscretization`,
`DirectedDiscretization`, `MeetsCriteriaProof` (discretization); `MeshedFaceSet`,
`FullyMeshedModel`, `WatertightMesh`, `CheckedMesh`, `QualityGradedMesh`, `PlanarQuad`, `ConvexQuad`,
`ValidatedReport` (mesh); `WellFormedBSpline`, `ClampedBSpline`, `OrthonormalFrame` (geometry).

Concepts added (2): `IToleranced { Tolerance(x: Self): Tolerances }` (implemented by
`PreparedModel`, `ResolvableModel`), `IHasProvenance { Where(x: Self): Provenance }` (implemented by
`ChainedLoop`, `ClosedShell`, `OrientedShell`, `ConnectedShell`, `CanonicalDiscretization`,
`MeetsCriteriaProof`; the library's `Check` and `Diagnostic` already discharge it through their
`Where` field).

Files: `catalog-proofs-{kernel,regions,discretization,mesh,geometry}.{types,library,laws}.plato`,
`catalog-proofs.concepts.plato`, `catalog-proofs.spec.plato`, `catalog-borrowed.types.plato`.

Constructors: one per type, `Check<Name>(...)` returning `Decided<Name> = Decided(Value) |
Undecided(Reason: UndecidedReason)`, except `DirectedAlong(c: CanonicalDiscretization, s: Sense):
DirectedDiscretization`, which is total (every canonical polyline has both directions). Each calls the
library's own predicate:

| Type | Constructor | Library predicate |
|---|---|---|
| InRangeModel | CheckInRangeModel(m) | IsEveryIndexInRange |
| PreparedModel | CheckPreparedModel(raw) | PrepareModel, then Tolerances.IsWellFormed |
| ResolvableModel | CheckResolvableModel(m) | IsResolvable(Tolerances.Length, CoordinateExtent) |
| ChainedLoop | CheckChainedLoop(m, l) | IsLoopIntact, ChainsEndToStart |
| ClosedShell | CheckClosedShell(m, s) | EdgesOfShell, CountsAsEdge, UseCount.IsZeroOrTwo; ReducedCounts |
| OrientedShell | CheckOrientedShell(m, c: ClosedShell) | HasCoherentOrientation |
| ConnectedShell | CheckConnectedShell(m, s) | ShellComponentCount <= 1 |
| SimpleUvLoop | CheckSimpleUvLoop(l, tol) | IsSimpleRegion of the loop as a hole-free region |
| ClosedUvLoop | CheckClosedUvLoop(m, f, l) | UWinding, VWinding |
| OrientedUvRegion | CheckOrientedUvRegion(m, f, r) | UvRegionWindingPositive, Law_UvHoleWindingNegative |
| CompleteDiscretization | CheckCompleteDiscretization(m, d) | IsDiscretized on every entry |
| PartialDiscretization | CheckPartialDiscretization(m, d) | IsDiscretized; Failed lists the rest |
| CanonicalDiscretization | CheckCanonicalDiscretization(m, d) | IsEvaluable, RunsAlongCurve, ParametersStrictlyIncreasing, Lowest/HighestParameterIs..., Law_DomainStart/EndPointIsVertex |
| MeetsCriteriaProof | CheckMeetsCriteriaProof(m, d, c) | MeetsCriteria; Worst = largest Sagitta |
| MeshedFaceSet | CheckMeshedFaceSet(faces, outcomes) | IsEmptyFaceMesh, HasBlockingRequest |
| FullyMeshedModel | CheckFullyMeshedModel(m, outcomes) | as MeshedFaceSet over every face |
| WatertightMesh | CheckWatertightMesh(mesh) | IsWellFormed, IsClosed |
| CheckedMesh | CheckCheckedMesh(m, mesh) | IsWellFormed, IsManifold, IsConsistentlyOriented, RestrictedToShell(..).IsClosed on each ClosedShell; ComponentCountsOf |
| QualityGradedMesh | CheckQualityGradedMesh(mesh) | IsWellFormed, HasValidCorners; TriangleQualityAt, QuadQualityAt |
| PlanarQuad | CheckPlanarQuad(fm, q, c) | IsMeasurableQuad, QuadWarp <= SurfaceChordal |
| ConvexQuad | CheckConvexQuad(fm, q) | IsMeasurableQuad, IsConvexQuad |
| ValidatedReport | CheckValidatedReport(m, level) | ValidateBrep, IsClean |
| WellFormedBSpline | CheckWellFormedBSpline(d) | IsWellShaped |
| ClampedBSpline | CheckClampedBSpline(w: WellFormedBSpline) | HasClampedEnds (new, see below) |
| OrthonormalFrame | CheckOrthonormalFrame(f, tol) | OrthonormalityDeviation; Handedness as a Sign |

Completions the catalog only sketched:
- Failure reasons: `OutOfDomain` when the input cannot be checked (an index out of range, an
  unevaluable polyline, a malformed mesh), `ToleranceExceeded(By)` with the excess for the two
  tolerance checks (PlanarQuad, OrthonormalFrame), `BelowResolution` for ResolvableModel, and
  `NotApplicable(Kind)` naming the failed property for every structural failure (see Contract
  requests).
- `ClosedShell` is the fact, not the claim: every counted edge used zero or two times, the body of
  `Law_EveryEdgeUsedTwiceInClosedShell` without its `DeclaredClosed` guard. `Counts` is
  `ReducedCounts`, the counts Euler-Poincare reads.
- `OrientedShell` takes a `ClosedShell` and tests `HasCoherentOrientation`, not "OrientationFlips
  empty": on a non-orientable shell the parity search may colour no face "flip" and still leave an
  edge incoherent, so an empty flip list is not the fact.
- `ConnectedShell` uses the library law's `<= 1`, so a shell with no face in range is connected.
- `SimpleUvLoop` carries the `UvTolerance` it was decided under; `ClosedUvLoop` and `OrientedUvRegion`
  carry their face, since winding and chart orientation depend on it.
- `PreparedModel` fails only when `PrepareModel`'s tolerances are not well formed; it keeps the
  catalog's two fields, `Model` being `Decoded.Model`.
- `ResolvableModel` checks the length tolerance at the coordinate extent and records the extent; the
  catalog's chordal example needs the criteria too, which a later `ResolvableCriteria` could add.
- `PartialDiscretization` is built only when some edge failed, so it never claims a complete table.
- `MeetsCriteriaProof.Worst` is the largest `Sagitta` over the segments, as a length `Measure`.
- `MeshedFaceSet`: a non-empty mesh and no blocking request per face, outcome i of face i.
- `WatertightMesh` is mesh-level (`IsClosed`: every edge has two sides). The catalog's laws
  (`Law_InteriorSideIsShared`, `Law_BoundarySegmentIsElementSide`) are per-face triangulation laws;
  they make the face meshes share boundary vertices, and `IsClosed` is what that gives the model mesh.
- `CheckedMesh`: closed where the shell is means closed on every shell `CheckClosedShell` accepts,
  tested on `RestrictedToShell`. It takes the model, so its constructor is `CheckCheckedMesh(m, mesh)`.
- `QualityGradedMesh` requires every element measurable (`HasValidCorners`), the precondition of
  `TriangleQualityAt` and `QuadQualityAt`.
- `ValidatedReport` is built only for a clean report (`IsClean`), so the type means "clean at Level".
- `ClampedBSpline`: no library predicate exists, so `HasClampedEnds(SplineBasis)` is new: the first
  and last Degree + 1 knots equal (copied knots, exact by construction). Closure from end points and
  knots (chunk D1) is not part of it.
- `OrthonormalFrame` uses `OrthonormalityDeviation <= tol` rather than `IsOrthonormalWithin`: the
  latter also demands right-handedness, which would make the `Handedness` field always Positive and
  reject exactly the mirrored placements the type exists to name. `Law_Catalog_RigidFrameIsOrthonormal`
  states that every frame `IsOrthonormalWithin` accepts passes.

Laws (57, all pass, cpu64, 2026-10-20). Each type has an "iff" law (the constructor succeeds exactly
when the library predicate, stated again in the law from library calls, holds) and a "records" law
(the proof's facts equal what the library computes):
- Kernel (15): InRangeModelIffIndicesInRange, InRangeModelKeepsModel,
  PreparedModelIffTolerancesWellFormed, PreparedModelRecordsPreparation, ResolvableModelIffResolvable,
  ResolvableModelRecordsExtent, ChainedLoopIffChains, ChainedLoopRecordsLoop,
  ClosedShellIffEdgesUsedTwice, ClosedShellRecordsCounts, PositiveWitnessShellsAreClosed,
  OrientedShellIffCoherent, OrientedShellKeepsCounts, ConnectedShellIffOneComponent,
  ConnectedShellRecordsShell.
- Regions (7): SimpleUvLoopIffSimpleRegion, SimpleUvLoopRecordsTolerance, BowtieIsNotSimple,
  ClosedUvLoopIffUnwound, ClosedUvLoopRecordsFace, OrientedUvRegionIffWindings,
  OrientedUvRegionRecordsFace.
- Discretization (10): CompleteDiscretizationIffAllDiscretized, CompleteDiscretizationKeepsTable,
  PartialDiscretizationIffSomeFailed, PartialDiscretizationListsFailures,
  CanonicalDiscretizationIffCanonical, DiscretizedEntryIsCanonicalReversedIsNot,
  CanonicalDiscretizationKeepsPolyline, DirectedAlongReversesOnlyWhenOpposite,
  MeetsCriteriaProofIffMeetsCriteria, MeetsCriteriaProofRecordsWorst.
- Mesh (18): FullyMeshedModelIffEveryFaceMeshed, FullyMeshedModelKeepsOutcomes,
  MeshedFaceSetIffFacesMeshed, MeshedFaceSetPairsFaces, WatertightMeshIffClosed,
  WatertightMeshKeepsMesh, CheckedMeshIffMeshChecks, ClosedWitnessMeshesAreChecked,
  CheckedMeshRecordsCounts, QualityGradedMeshIffMeasurable, QualityGradedMeshRecordsQualities,
  PlanarQuadIffWarpWithinChordal, UnitSquareQuadIsPlanar, PlanarQuadRecordsWarp, ConvexQuadIffConvex,
  ConvexQuadRecordsQuad, ValidatedReportIffClean, ValidatedReportRecordsLevel.
- Geometry (7): WellFormedBSplineIffWellShaped, WellFormedBSplineKeepsRecord,
  ClampedBSplineIffFixtureClamped, ClampedBSplineInterpolatesEnds, OrthonormalFrameIffWithinTolerance,
  RigidFrameIsOrthonormal, OrthonormalFrameRecordsHandedness.
- Inputs: models from `CatalogProofModelAt(k)` (layer 7's ten positive witnesses plus the flipped-face
  box, two boxes at a corner, and the poly-loop sheet); raw models `Witness_RawUnitCube` and
  `Witness_RawTwoCubes`; tables by `DiscretizeAll` under layer 8's witness criteria with one entry
  knocked out; face outcomes by `MeshFace` on the unit box with one face knocked out; meshes the
  literal tetrahedron, its reversal, the tetrahedron without a face, and the unit box's pipeline
  mesh; quads, UV loops, frames and tolerances from the runner's Numbers; B-splines layer 8's five
  fixtures plus one with a negative weight.

## Merge instructions
- Move the types and libraries into their layers: kernel proofs to `02-topology` (PreparedModel to
  `03-step`), region proofs to `05-face-meshing`, discretization proofs to `04-discretization`,
  mesh proofs to `06-mesh` (ValidatedReport to `07-validation`), geometry proofs to `01-geometry`,
  the concepts to `00-foundation`.
- Delete `UndecidedReason` from `catalog-borrowed.types.plato` (catalog-decided has the same shape);
  keep the 25 `Decided<Proof>` sums beside section 5's own.
- Replace catalog-decided's borrowed `CheckedMesh { Mesh }` with this one, and its direct
  `CheckedMesh(x.Mesh)` call in `catalog-decided-results.library.plato:226` with a match on
  `CheckCheckedMesh(m, x.Mesh)` (see Requests to other tracks).
- Rename `Law_Catalog_*` to the layer's law prefix.

## Contract requests
- `UndecidedReason` has no case for "the property was checked and is false". The structural checks
  use `NotApplicable(Kind)` with the property named, which reads as "the question does not apply".
  Request: add `Fails(Property: String)` (or `Violates(Law: String)`) to section 5's reason sum, and
  switch the `NotApplicable` uses here to it.
- `IsOrthonormalWithin(Frame3D, AngleTolerance)` mixes two checks (orthonormal, right-handed). Request:
  a separate `IsOrthonormalEitherHandWithin`, or document `OrthonormalityDeviation <= tol` as the
  placement check, so `CheckOrthonormalFrame` calls a named predicate.
- Layer 1 lacks a clamped-knot predicate; `HasClampedEnds(SplineBasis)` should move into
  `geometry-splines.library.plato` beside `KnotMultiplicityBounded`.

## Requests to other tracks
- catalog-decided: borrowed here, `UndecidedReason` (same shape as yours). Not blocking.
- catalog-decided: your borrowed `CheckedMesh { Mesh: ModelMesh }` and `MeshResult.Succeeded(
  CheckedMesh(x.Mesh), ...)` build the proof without its check; the real type has
  `Counts: Array<MeshComponentCounts>` and its only constructor is `CheckCheckedMesh(m, mesh)`. Your
  `MeshResult` builder should match on `CheckCheckedMesh` and give `Incomplete` or `Failed` on
  `Undecided`. Blocks your merge, not mine.

## Findings
- A `match` whose subject is a local initialised by a call into a library file that sorts later
  (`catalog-proofs-kernel.laws.plato` before `catalog-proofs-kernel.library.plato`) fails at run
  time with "match subject is not a sum type", while the type check reports nothing. The laws pass
  the Decided result to a helper as a typed parameter instead. PLATO-PRIMER.md F names the
  arm-typing half of this; the subject half is new.
- Every "iff" law restates the library predicate from library calls, so it guards the constructor's
  wiring, not the predicate. The laws with independent content are PositiveWitnessShellsAreClosed,
  BowtieIsNotSimple, DiscretizedEntryIsCanonicalReversedIsNot, ClosedWitnessMeshesAreChecked,
  UnitSquareQuadIsPlanar, ClampedBSplineIffFixtureClamped (against the fixtures' notes),
  ClampedBSplineInterpolatesEnds, and RigidFrameIsOrthonormal.
- InRangeModelIffIndicesInRange is one-sided in practice: no witness model has an index out of
  range. RigidFrameIsOrthonormal is likely vacuous on random frames, which are almost never
  orthonormal; a witness frame would make it bite.
- LINT014 (info, 8): `Where` and `Tolerance` are the catalog's concept member names and collide with
  struct fields (`Check.Where`, `Diagnostic.Where`, `SimpleUvLoop.Tolerance`, stdlib
  `PathSimplifyParameters.Tolerance`). Kept, because `Check` and `Diagnostic` implement
  `IHasProvenance` through their fields; rename `IToleranced.Tolerance` to `TolerancesOf` if the C#
  call syntax matters before plato-323 lands. LINT003 (info, 35): proof fields no library function
  reads yet; their consumers come with the rewiring.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer, spec DSL, catalog, foundation and indices tracks, layers 1 to 8) | 35 min | |
| Writing types, Decided sums, concepts, libraries | 25 min | |
| Writing laws and spec | 30 min | |
| Type-check runs | 1 min | 2 server runs |
| Law runs | 2 min | 6 runs (8 errors, then 15, 7, 10, 18, 7, 57 on a fresh copy) |
| CLI lint | 1 min | 1 run, 20 s |
| Waiting on the server | 0 min | never busy |
| Committing | 2 min | 2 commits |

## Lessons
- Read the sibling track that borrows your type (catalog-decided's `CheckedMesh`) before choosing its
  shape; the merge cost lands on whichever track guessed.
- Put match-reading law claims in helpers with typed parameters from the start.
