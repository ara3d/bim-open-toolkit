# catalog-meshing: TYPE-CATALOG.md sections 7, 8, 9 and IBudgeted, in Plato

Ticket: TKT-323
Status: ready: catalog-meshing

## Done
- catalog-meshing, see `git log -- sandbox/step-mesh-staging/catalog-meshing`, about 1.2 hours against 2
  expected: 35 `Law_Catalog_` laws, all pass under cpu64; zero type errors in this folder (the one
  reported error is the known `triangulation-fast.laws.plato:21`).

Types added (42, plus 1 borrowed):
- Section 7 (11): `Chord`, `Arc`, `ChordMeasures`, `CriterionName`, `CriterionVerdict`, `Seed`,
  `SeedReason`, `SegmentDensity` (the catalog's `Density`), `DensityField`, `RequestSet`,
  `DiscretizationDelta`. (`RefinementReason` additions: contract request, below.)
- Section 8 (17): `ConstraintSource`, `Constraint`, `ConstrainedTriangulation`, `Cavity`,
  `NeighbourTable`, `DelaunayCertificate`, `EarCandidate`, `Bridge`, `ElementInChart`,
  `ElementDeviation`, `RefinementTarget`, `SeamCopy`, `SeamPair`, `PoleRun`, `LiftTable`,
  `QuadGridSides`, `GridCounts`.
- Section 9 (14): `CornerAttribute<T>`, `Crease`, `CreaseSet`, `ElementKind`, `ElementRef`,
  `ElementCorners`, `BoundaryCycle`, `BoundaryCycleList`, `NonManifoldEdge`, `PinchedVertex`,
  `MisorientedEdge`, `MeshSlice`, `ProvenanceIndex`, `ElementProvenance`.
- Borrowed (1): `WorkBudget` (section 10) in `catalog-borrowed.types.plato`.
- Concepts (1): `IBudgeted` (no implementer yet: none of these sections' types is a refinement
  result; LINT009 info "unreachable").

Files: `catalog-{discretization,face-meshing,assembly}.{types,library,laws}.plato`,
`catalog-borrowed.types.plato`, `catalog-meshing.concepts.plato`, `catalog-meshing.spec.plato`.

Completions the catalog only sketched:
- `MergeRequests(xs)`: one request per edge, sorted by edge; each is the `Strongest` fold of that
  edge's requests in input order: smallest `Chordal` with its `Reason` (the earlier on a tie),
  largest `Segments`. `RequestFor(s, e)` reads it back as a zero- or one-element array.
- `OrientationOf(a, b, c)` = `SignWithin(TwiceSignedArea(...), OrientationResolution(a, b, c))`,
  calling layer 5's `TwiceSignedArea` on `ToPoint2D` of the chart points. The resolution is
  `ResolutionFor` the product of the largest coordinate differences of b and c from a.
  `OrientationWithin(a, b, c, tol)` takes an explicit tolerance; with `Resolution.Exact` it is the
  library's `> 0` / `< 0` sign exactly (a law).
- `NeighbourTable.Across[3e + s]` is the side across side s of triangle e, or the none side
  `ElementSide(ElementIndex(-1), 0)`. `NeighbourTableOf(tris)` is a quadratic search, the
  specification of the incremental table.
- `LiftTableOf(pointCount, pairs, runs)` joins with layer 0's `ClassRoots` (union-find) and numbers
  local vertices in order of their smallest parameter point. Requires disjoint pairs and runs.
- `ConstraintSource.LoopSegment(Loop: BoundSlot, Slot: Integer)`: Slot is the position of the
  segment's first point in the loop. `PoleRun.Pole` is a `DomainSide`.
- `ElementInChart` has fields `A`, `B`, `C` (the catalog's "3 ChartPoints").
- `QuadGridSides` sides run corner to corner in cyclic order; `IsStructured` checks counts and
  shared corners; `QuadGridSidesOf(GridCounts)` and `GridCountsOf` round-trip.
- `CornerAttribute<T>`: the stdlib's `MeshAttribute<T>` does not serve; its `Domain` is a runtime
  value, so a per-vertex array type-checks where a per-corner one is wanted. The catalog's aliases
  are constructor functions `CornerNormalsOf(mesh)` and `CornerUvsOf(mesh)`, not `CornerNormals`
  and `CornerUvs`: those are `ModelMesh` field names, and a function of the same name and receiver
  would tie with the field accessor (CHK203).
- `ElementRef` and `ElementCorners` each have a third case (`NotAnElement`, `NoCorners`) so
  `ResolveElement` and `CornersOf` are total without a sentinel.
- Renamed fields to avoid a one-field-named-after-its-type implicit conversion (PLATO-PRIMER D.11):
  `Crease.Dihedral` (catalog `Angle: Angle`), `ElementProvenance.MadeIn` (catalog `Round: Round`).
- `SegmentDensity`, not `Density`: the stdlib declares `type Density` (mass per volume); a second
  declaration halts the compiler.
- Deferred (bodiless): `BoundaryCycleListOf`, `NonManifoldEdgesOf`, `PinchedVerticesOf`,
  `MisorientedEdgesOf`; their invariants are obligations in the spec.

Laws (35, all pass, cpu64, 2026-10-20):
- Discretization (10): ChordsOfAreConsecutive, VerdictHoldsIffWithin, VerdictAcrossKindsFails,
  SegmentsForIsAtLeastOne, SegmentsForCoversLength, MergeRequestsIsIdempotent,
  MergeRequestsIsOnePerEdge, MergeRequestsKeepsStrongest, MergeRequestsInventsNothing,
  DeltaNamesEveryRequestedEdge. Request lists come from `MeshingRequestsAt(k, n)`: up to eight
  requests over three edges, every reason; 196 cases each.
- Face meshing (15): OrientationOfAgreesWithLibrarySign, ExactOrientationIsLibrarySign,
  OrientationIsAntisymmetric, ElementInChartAreaHasItsOrientation, NeighbourTableIsInvolution,
  NeighbourTableSeesClosure, DelaunayCertificateIsConsistent, LoopConstraintsAreSides,
  OtherDiagonalIsNotASide, WorseBoundsBoth, OtherCopyIsInvolution, CopiesAreTheEnds,
  LiftTableJoinsSeamPairsAndPoles, LiftTableJoinsNothingElse, QuadGridSidesRoundTrip.
  Neighbour witnesses: the closed tetrahedron, a 3 by 2 grid, one triangle.
- Assembly (10): CornerCountIsThreeTPlusFourQ, CornerUvAtAgreesWithMesh,
  ResolveElementAgreesWithAccessors, CornersOfAgreesWithElementCorners, CornersOfHasItsKindsCount,
  SliceElementsAreOnItsFaces, SliceOfAllFacesIsWholeMesh, ProvenanceIndexListsElementCorners,
  ProvenanceIndexListsNothingElse, ElementProvenanceNamesElementFace. Witnesses: layer 6's
  `MeshWitnessAt` (unit tetrahedron and its reversal) and `MeshingPyramid` (four triangles and a
  quad, so the quad branches run); element indices run from -1 to one past the end.
- Mutation check: with `Strongest` taking the larger Chordal, `LiftTableOf` joining nothing, and
  `ResolveElement` shifted by one, MergeRequestsKeepsStrongest, LiftTableJoinsSeamPairsAndPoles,
  ResolveElementAgreesWithAccessors and CornersOfAgreesWithElementCorners all fail.
- Not covered by a law: `ArcOf`, `ChordalVerdict`/`AngularVerdict` (thin wrappers), `DensityAt`,
  `CreasesAbove`, `Removes`, `Changes`, `CycleEdgeCount`, and the four deferred defect finders.

## Merge instructions
- Move `catalog-discretization.*` into `04-discretization`, `catalog-face-meshing.*` into
  `05-face-meshing`, `catalog-assembly.*` into `06-mesh`, `IBudgeted` into the concepts file of
  the layer that owns section 15's concepts; delete `catalog-borrowed.types.plato` once section
  10's `WorkBudget` lands.
- Rename `Law_Catalog_*` to the layer's law prefix at merge.

## Contract requests
- `RefinementReason` (`04-discretization/discretization.types.plato`): add
  `NoInteriorPointMeetsChordal(Segment: Chord)` (chunk S1), `PoleAdjacency`, `NeighbourDensity`.
  Not declared beside it: nothing in these sections needs the cases yet.
- `FaceChart.Mirrored` (`05-face-meshing/uv-regions.types.plato`): `Parity` instead of `Boolean`.
- `EdgeRefinementRequest.Chordal: Number` should become `ModelLength`, `Segments: Integer` a
  `SegmentCount` (0 meaning "not about counts" then needs a sum or `Count`).
- Layer 5's `TwiceSignedArea` callers on chart points should call `OrientationOf` (or
  `OrientationWithin` where they mean the exact sign) and stop comparing with `> 0.0`.
- Name collisions that compile but read badly (different arity): layer 5's functions
  `NeighbourTable(tris, count): Array<Integer>` (`triangulation-fast.library.plato`),
  `ElementDeviation(m, d, fm, k): Number` (`face-meshing.library.plato:530`), `SplitSide(...)`
  (`uv-delaunay.library.plato:188`), and layer 6's `ElementCorners(mesh, e): Array<VertexIndex>`
  (`mesh.library.plato:73`) share names with the new types `NeighbourTable`, `ElementDeviation`,
  the case `RefinementTarget.SplitSide`, and the sum `ElementCorners`. Rename the functions at
  merge (`NeighbourSlots`, `ElementChordalDeviation`, `SplitSideSlot`, `ElementCornerList`).

## Requests to other tracks
- Section 10's track: `WorkBudget { Evaluations; Insertions; Flips; Projections: Integer }` is
  borrowed here with that shape. Does not block.

## Findings
- The plato-navigation server reported "0 type errors" on the real staging path after the first
  edit, missing even the known library error; a fresh scratch copy reported the expected one.
  Every check here ran on a fresh copy (the foundation track's workaround).
- The CLI lint (pinned `bac65e1c`) gives no warning or error in this folder: no LINT001. Infos: about 40
  LINT003 (fields not yet read by a library function: the defect, slice and provenance records,
  `WorkBudget`) and LINT009 for `IBudgeted`. Three LINT010 infos (`DensityField`, `Cavity`,
  `RefinementTarget`) were fixed with `DensityAt`, `Removes`, and `Changes`.
- `Seed` reasons are not yet produced by anything: `Law_SeedsAreSampled` over `Discretize`'s
  inputs belongs to layer 4 once `Discretize` returns its seeds.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer, spec DSL, catalog, foundation and indices tracks, layers 4 to 6) | 15 min | |
| Writing types, concepts, libraries | 30 min | |
| Writing laws and spec | 20 min | |
| Type-check runs | 2 min | 3 server runs |
| Law runs | 2 min | 5 runs (10, 15, 10, 4 mutants, 111) |
| CLI lint | 1 min | 1 |
| Waiting on the server | 0 min | never busy |
| Committing | 2 min | 1 commit |

## Lessons
- Grepping every new type name against the stdlib and the library first found `Density` (fatal
  duplicate) and four function-name overlaps before the first compile.
- A field named after its own type (`Angle: Angle`, `Round: Round`) is an implicit conversion in
  Plato; the catalog's shorthand needs a field name.
