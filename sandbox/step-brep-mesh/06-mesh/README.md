# 06-mesh: the assembled model mesh

Layer 6 of the STEP B-rep to mesh design ([../README.md](../README.md)). It takes the face meshes of
`05-face-meshing`, one per model face, and assembles them into one `ModelMesh`: a mesh of the whole
model whose vertices remember which model vertex, edge, or face they sample, whose elements remember
which face they approximate, and whose corners carry the face parameters and outward normal there.
It then answers the questions every consumer asks of such a mesh (is it closed, manifold,
consistently oriented; what are its components, Euler characteristic, genus, area, signed volume;
are its elements degenerate or of poor shape) and converts it to the stdlib's mesh types.
`07-validation` checks meshes with these functions and laws; `08-pipeline` builds them.

Library blocks: `ModelMeshes` (the fixed name, in `mesh.library.plato`), with `ModelMeshNumbering`,
`ModelMeshAssembly`, `ModelMeshTopology`, `ModelMeshMeasures`, `ModelMeshQuality`, and
`ModelMeshConversions` beside it, and a `...Laws` block for each.

## Files

| Stem | Holds |
|---|---|
| `mesh-numbering` | `MeshVertexSite`, `MeshVertexNumbering`; sites to indices and back; `NumberMeshVertices`; face mesh points to sites (`GlobalVertexOf`) |
| `mesh` | `ModelMesh`; element and corner access; element geometry (`ElementTriangles`); `Reversed`; `RestrictedToFaces`; `SameConnectivity`; the tetrahedron witness |
| `mesh-assembly` | `AssembleModelMesh` (body since chunk A), its preconditions (`CanAssemble`), where face mesh elements land; the watertightness law and theorem |
| `mesh-topology` | `MeshEdgeTable`, components and their counts; manifold, closed, oriented; Euler characteristic, genus, pinched vertices |
| `mesh-measures` | area, signed volume, winding number, corner angles and angle defects; degenerate elements, coincident vertices, folds |
| `mesh-quality` | `TriangleQuality`, `QuadQuality`, `MeshQualityThresholds` and their functions |
| `mesh-conversions` | `ToTriangleMesh3D`, `ToQuadMesh3D`, `ToPolygonMesh3D`, `ToSplitTriangleMesh3D` and their result types |

Each stem has `.types.plato` where it declares types, `.library.plato`, `.laws.plato` (block
`<Library>Laws`), and `.spec.plato` (SPEC-DSL.md section 3 constructs only).

## The objects

**The mesh is a finite 2-complex with a map to the model.** A `ModelMesh` is a cell complex K. Its
0-cells are the vertices 0 to N - 1, each with a position. Its 2-cells are the elements, each a
cyclic sequence of three or four vertices (its corners, in winding order): triangles first, then
quads, so `ElementIndex` e names triangle e below the triangle count T and quad e - T above. Its
1-cells are implied: the unordered pairs {a, b}, a not b, that occur as consecutive corners of some
element. The geometric realization is piecewise linear: a triangle is the flat triangle on its
corner positions, and a quad is the two flat triangles of its A-C split, (A, B, C) and (A, C, D),
the split the stdlib's `QuadFace` comment and `FanTriangles` already state. Area, signed volume,
solid angle, and the conversions all read that one realization (`ElementTriangles`). The Euler
characteristic is V - E + F with F = T + Q.

**The edge table is the 1-skeleton with its incidence.** `MeshEdgeTable` lists each 1-cell once,
canonically (lower index first) and sorted, so its position is its `UndirectedEdgeIndex`, exactly as
the stdlib's `UndirectedEdgeList` (which it holds). Per edge it records how many element sides lie
on it (`ElementCounts`) and their orientation parity (`DirectionSums`). An element side whose two
ends are one vertex is not a 1-cell; `HasRepeatedCorner` reports it.

**Orientation is a 2-colouring of half-edges.** Each element side is a half-edge, coloured +1 when it
runs from the lower vertex index to the higher and -1 otherwise. An edge with two sides is coherent
when the colours differ, that is when its direction sum is 0; the mesh is consistently oriented when
every two-sided edge is coherent. Reversing every element (`Reversed`) swaps every colour, negates
every direction sum, and negates the signed volume.

**Manifold, closed, components, genus.** `IsManifold` is the edge condition (no edge with more than
two sides), `IsClosed` the closed-surface edge condition (every edge exactly two sides).
The vertex condition is separate: the link of v (for each element at v, the side from the corner
before v to the corner after) must be one cycle, or one path on a boundary; `IsPinchedVertex` fails
it. Components are the classes of elements joined by chains that share vertices (`ComponentsOf`);
per component `MeshComponentCounts` holds the cells, the defects, and the boundary cycles. A
connected, oriented surface with B boundary circles has Euler characteristic 2 - 2g - B by the
classification of compact surfaces, which is what `Genus` reads off and
`Law_ClosedOrientedSurfaceHasGenus` (B = 0) and `Law_OrientedSurfaceWithBoundaryHasGenus` check the
counts against.

**The provenance map sends the complex to the model.** Every vertex maps to a point of a model cell
(`VertexProvenance`: `OnVertex(v)`, `OnEdge(e, t)`, `OnFace(f, uv)`), every element to the face it
approximates (`ElementFace`), and every element corner to that face's parameters and outward normal
at the corner (`CornerUvs`, `CornerNormals`). The map is cellular: a vertex inside an edge's
discretization maps into that edge, never into a face, and every corner of an element of face f maps
into the closure of f (`CornerProvenanceIsOnItsElementFace`). `07-validation` checks it geometrically by
re-evaluating the model at each provenance (`Law_VertexReevaluatesFromProvenance`).

**The numbering is a bijection from sites to indices.** The vertex set is a disjoint union: model
vertices, the interior points of each edge's one discretization, the interior vertices of each face
mesh. A `MeshVertexSite` names one element of that union (`ModelVertex(v)`, `EdgeInterior(e, slot)`,
`FaceInterior(f, slot)`); `MeshVertexNumbering` assigns the runs model vertices, then edges in edge
order, then faces in face order, so that `IndexOfSite` and `SiteAt` are inverse bijections
(theorems `NumberedSitesHaveDistinctIndices`, `EveryIndexHasASite`). Assembly is then the quotient
of the disjoint union of the face meshes by "same site": the face meshes are glued along their
shared boundary samples exactly as the B-rep glues faces along edges, combinatorially, by identity.

## Decisions and reasons

- **Attributes are per element corner; topology is per vertex.** One vertex can carry two parameter
  values on a seam, one parameter pair per adjacent face on a model edge, one normal per face on a
  crease, and one normal per element at a cone apex (research/MESHING-REQUIREMENTS.md finding 6).
  Splitting such vertices would break closedness and create coincident vertices, so the mesh stays
  welded by index and only `CornerNormals` and `CornerUvs` are per corner, 3T + 4Q entries each.
  Renderers that want one normal per vertex get `ToSplitTriangleMesh3D`, a separate output.
- **Identity by numbering; no welding by distance, ever.** The global index of a face mesh point is
  `GlobalVertexOf`: the index of its site, read from its source (`FromVertex`, `FromEdge`) or from its
  local vertex's rank among the face-interior vertices. No position is compared. Welding by position
  was what the IFC mesher did (research/EXISTING-MESHER-LESSONS.md, step 10): it cannot repair a
  vertex that exists in one face only (lesson 11), its integer key overflows and splits on rounding
  boundaries (lesson 1), and merging within a tolerance is not transitive. Here two faces that cite
  one edge sample get one index by construction (`WatertightByNumbering`). Because nothing reconciles
  disagreeing copies, the face meshes owe agreement (`Law_FaceMeshesAgreeOnSharedSites`,
  `Law_FaceMeshModelVertexIsModelPoint`); coincident vertices that do not share a site are reported
  (`CoincidentVertexPairs`), never merged.
- **Every model vertex is numbered; only cited edges are.** Model vertex v is mesh vertex v, so a
  model vertex's index needs no table. An edge gets a run only when some face mesh cites it, so an
  edge whose faces all failed to mesh leaves no vertex without a position. A model vertex no face
  mesh reaches stays as an unreferenced vertex, which the component counts report.
- **The start arrays are CSR offsets.** `EdgeInteriorStart` has E + 1 entries and `FaceInteriorStart`
  F + 1, the last being the vertex count, so each count has one location (no separate total field).
  The starts are non-decreasing rather than increasing: a straight edge discretized by its two
  vertices owns an empty run.
- **A quad's geometry is its A-C split.** research/VALIDATION-MATH.md 4.7 recommends the average of
  the two splits for volume (the exact flux through the bilinear patch). This layer uses the A-C split
  for area and volume alike, so a `ModelMesh` and its `ToTriangleMesh3D` have the same area and
  volume and the conversion laws can say so. The two differ by the volume of the tetrahedron ABCD,
  which the both-diagonals rule of research/MESHING-REQUIREMENTS.md 5.4 keeps within the criteria.
- **Edge conditions and the vertex condition are separate predicates.** `IsManifold` and `IsClosed`
  are exactly the edge statements VOCABULARY.md and the task name; the pinched-vertex test is
  counted per component, because a closed, oriented, edge-manifold mesh can still be two spheres
  touching at a point.
- **Quality is measured, never promised.** With the boundary locked no triangulator guarantees an
  angle (research/MESHING-REQUIREMENTS.md finding 8). Threshold laws are Info. Two shape conditions
  break the mesh as a surface and are Error: a non-convex quad (`QuadIsConvex`) and a fold
  (`ElementIsNotFolded`). The metrics are functions of the stdlib's `Triangle3D` and `Quad3D`, so
  their identity laws (Euler's inequality, normalizations) can run on pseudorandom triangles.
- **Partial operations use the stdlib's styles.** `ToQuadMesh3D` returns a `QuadMeshOutcome` (style 1:
  `Ok` is true exactly when there are no triangles; otherwise `Mesh` holds every position and every
  quad and the triangles are left out). `Genus` takes a fallback (style 3) returned whenever the
  component is not an oriented surface whose counts give an even, non-negative 2 - chi - B.
- **The split mesh groups corners by exact attribute equality.** Two corners at one vertex share a
  split vertex exactly when their normal and uv are bitwise equal, which is sound because equal
  attributes arise only by copying from one parameter-space point of one face mesh; no tolerance is
  involved. Unreferenced vertices have no corner, so they are dropped rather than given invented
  attributes (honest absence, principle 3 of the toolkit's `PROJECT.md`).
- **Signed volume about the bounding-box centre.** For a closed mesh the origin does not matter in
  exact arithmetic; in floating point the rounding grows with the squared distance to it (research
  4.7), and buildings sit far from the world origin.

### Stdlib mesh-topology names reused and avoided

| Name | Decision | Reason |
|---|---|---|
| `VertexIndex`, `TriangleFace`, `QuadFace`, `UndirectedEdgeIndex`, `CornerIndex`, `VertexPair` | reused | same meaning; `CornerIndex` indexes `CornerNormals` and `CornerUvs` (the stdlib's c / 3 rule for triangles holds; quads follow at 3T + 4q) |
| `UndirectedEdgeList` | reused, as `MeshEdgeTable.Edges` | identical: canonical, sorted pairs, position is the index |
| `TriangleMesh3D`, `QuadMesh3D`, `PolygonMesh3D`, `Triangle3D`, `Quad3D`, `Tetrahedron`, `FanTriangles`, `MidPoint`, `Area(Quad3D)` | reused | conversion targets and element geometry; `Area(Quad3D)` and `FanTriangles` are the A-C split |
| `UndirectedEdgeAdjacency` | avoided | stores at most two faces per edge, so it cannot hold the non-manifold edges the table exists to find |
| `TriangleMeshTopology`, `CornerTable` | avoided | triangle-only (corner c belongs to triangle c / 3); this mesh mixes triangles and quads |
| `FaceAdjacency`, `VertexFaceAdjacency` | avoided | index `FaceIndex`; elements here are `ElementIndex`, and components need only union-find |
| `TopologySummary`, `Manifoldness` | avoided | `Manifoldness.Manifold` asserts vertex stars are disks, which an edge table cannot establish; no orientation count; per component the component count is always 1 |
| `MeshSection` | avoided | a contiguous face range per slot; one model face's triangles and quads are two runs here, and `ElementFace` is per element |
| `MeshIndex` | avoided | a mesh within a scene; unrelated |
| `RichMesh3D`, `MeshAttribute<T>` | avoided | channels found by name string, so no type or law can say "one normal per position" |
| `VertexLayout` | avoided | the GPU attribute layout; the numbering is `MeshVertexNumbering` (VOCABULARY.md) |

## Laws

Severity per SPEC-DSL.md section 4: **Error** for a structural or topological law failing on a mesh
(a finding about the mesh, its face meshes, or the model); **Info** for a quality threshold; **test**
for a library law, whose failure is a defect in this layer's code, run on witnesses or, where the
parameters are records of numbers, on pseudorandom instances. "Exact" means integers, indices, or
signs, or a copied value compared bitwise (`// exact by construction`). Every law is total: an index
outside its range makes it vacuously true, and the range is another law's statement.

### Numbering (`mesh-numbering.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `NumberingHasOneEdgeRunPerEdge` | `EdgeInteriorStart` has E + 1 entries | exact | Error |
| `NumberingHasOneFaceRunPerFace` | `FaceInteriorStart` has F + 1 entries | exact | Error |
| `NumberingCountsEveryModelVertex` | `ModelVertexCount` is the model's vertex count; model vertices come first | exact | Error |
| `EdgeRunsFollowModelVertices` | the first edge start is `ModelVertexCount` | exact | Error |
| `FaceRunsFollowEdgeRuns` | the first face start is the last edge start | exact | Error |
| `EdgeRunHasNonNegativeLength` | edge starts do not decrease | exact | Error |
| `FaceRunHasNonNegativeLength` | face starts do not decrease | exact | Error |
| `NumberingCoversPositions` | the runs and model vertices sum to the position count | exact | Error |
| `Law_IndexOfSiteIsInRange` | a numbered site's index is in 0 to N - 1 | exact | test |
| `Law_SiteAtInvertsIndexOfSite` | `SiteAt` undoes `IndexOfSite`: every site has exactly one index | exact | test |
| `Law_IndexOfSiteInvertsSiteAt` | `IndexOfSite` undoes `SiteAt`: every index has a site | exact | test |
| `Law_ModelVertexKeepsItsIndex` | `GlobalIndex(OnVertex(v))` is v | exact | test |
| `Law_NumberingCountsCitedEdgeInteriors` | a cited edge's run has one slot per interior discretization point | exact | test |
| `FaceMeshPointHasNumberedSite` | every face mesh point's site has a slot | exact | Error |
| `FaceMeshSourceAgreesWithProvenance` | a point's source and its local vertex's provenance name one cell | exact | Error |
| `SeamCopiesShareOneGlobalVertex` | the two copies of a seam point reach one global vertex | exact | Error |
| `DistinctLocalVerticesHaveDistinctGlobalVertices` | a face mesh holds no two copies of one model point | exact | Error |
| `SharedBoundarySampleHasOneGlobalVertex` | points citing one model vertex or one edge sample reach one global vertex | exact | test |

### Model mesh (`mesh.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `ElementFaceHasOneEntryPerElement` | `ElementFace` has T + Q entries | exact | Error |
| `CornerNormalsHaveOneEntryPerCorner` | `CornerNormals` has 3T + 4Q entries | exact | Error |
| `CornerUvsHaveOneEntryPerCorner` | `CornerUvs` has 3T + 4Q entries | exact | Error |
| `VertexProvenanceHasOneEntryPerVertex` | `VertexProvenance` has one entry per position | exact | Error |
| `ElementCornersInRange` | every element corner names a vertex | exact | Error |
| `ElementFaceIsModelFace` | every `ElementFace` entry is a model face | exact | Error |
| `VertexProvenanceMatchesNumbering` | a vertex's provenance names its index's site's cell | exact | Error |
| `CornerProvenanceIsOnItsElementFace` | every corner of an element of face f maps into the closure of f: the cellular map | exact | Error |
| `Law_ReversalPermutesCorners` | reversed slot s is original slot `ReversedSlot(arity, s)` | exact | test |
| `Law_ReversalMovesCornerUvWithCorner` | a corner's uv moves with its corner under reversal | exact by construction | test |
| `Law_RestrictionKeepsTheElementsOfTheFaces` | the restriction to a set of faces has exactly their elements | exact | test |
| `Law_RestrictionKeepsEachCorner` | element k of the restriction has the corners of the k-th kept element | exact | test |
| `Law_RestrictionKeepsEachElementFace` | element k of the restriction has the face of the k-th kept element | exact | test |
| `Law_RestrictionToEveryFaceKeepsTheEulerCharacteristic` | restricting to all faces keeps V - E + F | exact | test |

### Assembly (`mesh-assembly.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_FaceMeshesAgreeOnSharedSites` | points with one site have one 3D position | exact by construction | Error |
| `Law_FaceMeshModelVertexIsModelPoint` | a point citing a model vertex sits at the model's point | exact by construction | Error |
| `Law_AssemblyKeepsTheNumbering` | the result carries the numbering given | exact | test |
| `Law_AssemblyKeepsEveryTriangle` | every face mesh triangle becomes one mesh triangle | exact | test |
| `Law_AssemblyKeepsEveryQuad` | every face mesh quad becomes one mesh quad | exact | test |
| `Law_AssembledModelVertexIsModelPoint` | model vertex v sits at the model's point | exact by construction | test |
| `Law_AssembledPositionIsFaceMeshPosition` | a point's global vertex sits where its face mesh puts it | exact by construction | test |
| `Law_AssembledCornerIsGlobalVertexOfFaceMeshCorner` | each assembled corner is `GlobalVertexOf` its face mesh corner | exact | test |
| `Law_AssembledElementRemembersItsFace` | each assembled element's `ElementFace` is its face mesh's face | exact | test |
| `Law_AssembledCornerUvIsCopied` | assembled corner uvs are the face mesh's | exact by construction | test |
| `Law_AssembledCornerNormalIsCopied` | assembled corner normals are the face mesh's | exact by construction | test |
| `Law_AssembledSharedBoundaryCornersCoincide` | corners citing one boundary sample, in any two face meshes, are one assembled vertex: the watertightness mechanism | exact | test |

### Topology (`mesh-topology.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `EdgeTableHasOneCountPerEdge` | one count per listed edge | exact | test |
| `EdgeTableHasOneDirectionSumPerEdge` | one direction sum per listed edge | exact | test |
| `EdgeTableEdgeIsCanonical` | each listed pair has A < B | exact | test |
| `EdgeTableIsStrictlySorted` | listed pairs strictly increase, so none repeats | exact | test |
| `EdgeTableListsOnlyUsedEdges` | every listed edge has a side | exact | test |
| `Law_EdgeTableCountsEveryProperSide` | the counts sum to the number of proper sides | exact | test |
| `Law_EdgeTableListsEveryProperSide` | every proper side lies on a listed edge | exact | test |
| `Law_EdgeTableCountMatchesItsSides` | each count equals a direct count of its sides | exact | test |
| `Law_EdgeTableDirectionSumMatchesItsSides` | each direction sum equals a direct sum over its sides | exact | test |
| `DirectionSumIsBoundedByCount` | the direction sum's magnitude is at most the count | exact | test |
| `DirectionSumHasTheParityOfCount` | count minus direction sum is even | exact | test |
| `Law_ReversalNegatesEveryDirectionSum` | reversal negates each direction sum | exact | test |
| `Law_ClosedMeansEveryEdgeHasTwoSides` | closed implies every edge has two sides | exact | test |
| `Law_ManifoldMeansNoEdgeHasMoreThanTwoSides` | manifold implies no edge has more than two sides | exact | test |
| `Law_OrientedExactlyWhenNoEdgeIsMisoriented` | consistently oriented exactly when the direction sum is 0 on every two-sided edge | exact | test |
| `Law_ClosedMeshHasNoPinchedVertex` | in a closed mesh every vertex link is one cycle | exact | Error |
| `Law_ElementCornersShareItsComponent` | an element's corners lie in its component | exact | test |
| `Law_ComponentParentIsInItsComponent` | an element's spanning-forest parent is in its component | exact | test |
| `Law_ComponentParentSharesAVertex` | a non-root element shares a vertex with its parent | exact | test |
| `Law_ComponentRootHasDepthZero` | an element is a root exactly when its depth is 0 | exact | test |
| `Law_ComponentParentIsOneShallower` | a non-root element is one level deeper than its parent | exact | test |
| `Law_ComponentRootIsItsLowestElement` | a root is the lowest element of its component, so each component has one root | exact | test |
| `Law_ComponentsAreNumberedByRoot` | the component rooted at r is the number of roots below r | exact | test |
| `Law_ComponentCountIsRootCount` | one component per root | exact | test |
| `Law_ComponentEulerCharacteristicsAddUp` | component Euler characteristics plus unreferenced vertices give the mesh's | exact | test |
| `Law_ClosedOrientedSurfaceHasGenus` | a closed, oriented, manifold component has an even Euler characteristic at most 2 | exact | Error |
| `Law_OrientedSurfaceWithBoundaryHasGenus` | an oriented surface component with boundary has 2 - chi - B even and at least 0 | exact | Error |
| `Law_ClosedComponentEulerIsTwoMinusTwiceGenus` | Euler characteristic = 2 - 2 genus for a closed connected component with a genus | exact | test (random records) |
| `Law_EulerIsTwoMinusTwiceGenusMinusBoundaryCycles` | Euler characteristic = 2 - 2 genus - B for any component with a genus | exact | test (random records) |

### Measures (`mesh-measures.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_AreaIsSumOfFaceMeshAreas` | the assembled area is the sum of the face mesh areas (the element areas are bitwise equal, only the grouping of the compensated sums differs) | `ResolutionAt` of the total (`TotalsAgree`) | test |
| `Law_ReversalNegatesSignedVolume` | reversing every element negates the signed volume | `ResolutionAt(VolumeRoundingMagnitude)` | test |
| `Law_VectorAreaVanishes` | a closed, consistently oriented component has zero vector area | `ResolutionAt(VectorAreaRoundingMagnitude)` | test |
| `Law_OutwardTetrahedronHasPositiveVolume` | the outward-wound unit tetrahedron has positive signed volume | exact sign | test |
| `Law_TriangleAngleSumIsPi` | a triangle's angles sum to pi (fails on a zero-length side) | `AngleSumResolution`, `ResolutionAt(2 pi)` | Error |
| `Law_QuadAngleDefectIsNotNegative` | a quad's angles sum to at most 2 pi | `AngleSumResolution` | test |
| `Law_AngleDefectSumIsTwoPiTimesEuler` | discrete Gauss-Bonnet on a closed all-triangle component; checks angle sums and counts, not geometry (see below) | `DefectSumResolution`: `ResolutionAt(2 pi V + pi K)`, K the corners | Error |
| `Law_AngleDefectSumIsTwoPiTimesEulerPlusQuadDefects` | the same with quads: defects = 2 pi chi + the quads' own defects | `DefectSumResolution`: `ResolutionAt(2 pi (V + Q) + pi K)` | Error |
| `ElementHasNoRepeatedCorner` | no element names a vertex twice | exact | Error |
| `ElementIsNotDegenerate` | every element's smallest altitude exceeds the length tolerance | `LengthTolerance` | Error |
| `VerticesOfOneComponentAreApart` | distinct vertices of one component are farther apart than the length tolerance | `LengthTolerance` | Error |
| `Law_ReportedPairIsCoincident` | every reported coincident pair is coincident | `LengthTolerance` | test |
| `Law_CoincidentPairIsReported` | every coincident pair is reported | `LengthTolerance` | test |
| `ElementIsNotFolded` | each element's normal agrees in sign with the face normal at its corners | exact sign | Error |

What the Gauss-Bonnet laws check, and what they do not: the proof uses only that each triangle's
angles sum to pi and that 3T = 2E on a closed component, so the identity holds for any positions. It
cannot detect wrong geometry, a wrong Euler characteristic relative to the model (comparing the defect
sum with the B-rep's Euler characteristic is `07-validation`'s job), or a pinched vertex. It does
detect degenerate triangles, an element list inconsistent with the counts, and disagreement between
two independently written computations (VALIDATION-MATH.md 4.5).

The sign law asked for ("positive for an outward-oriented closed mesh") is the theorem
`SignedVolumeSignIsOrientation` in `mesh-measures.spec.plato`, stated with the generalized winding
number (`WindingNumber`) as the definition of outward, and tested by the witness law and the
reversal law above; no pointwise law can say "outward" without quantifying over all of space.

### Quality (`mesh-quality.laws.plato`)

Thresholds come from a `MeshQualityThresholds` parameter, normally `CubitAcceptable` (Cubit's
acceptable ranges: triangle angles 30 to 90 degrees, radius and aspect ratio at most 3, quad skew at
most 0.5, warp cosine at least 0.9, scaled Jacobian at least 0.5; quad angle defect at most 5
degrees, chosen here).

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `TriangleMinAngleMeetsThreshold` | smallest triangle angle at least the threshold | threshold | Info |
| `TriangleMaxAngleMeetsThreshold` | largest triangle angle at most the threshold | threshold | Info |
| `TriangleRadiusRatioMeetsThreshold` | radius ratio at most the threshold | threshold | Info |
| `Law_TriangleAspectRatioMeetsThreshold` | aspect ratio at most the threshold | threshold | Info |
| `QuadSkewMeetsThreshold` | quad skew at most the threshold | threshold | Info |
| `QuadWarpMeetsThreshold` | quad warp cosine at least the threshold | threshold | Info |
| `QuadAngleDefectMeetsThreshold` | quad angle defect at most the threshold | threshold | Info |
| `QuadScaledJacobianMeetsThreshold` | quad scaled Jacobian at least the threshold | threshold | Info |
| `QuadIsConvex` | quad scaled Jacobian positive | exact sign | Error |
| `Law_RadiusRatioIsAtLeastOne` | Euler's inequality R >= 2r | `ComparisonTolerance` | test (random triangles) |
| `Law_AspectRatioIsAtLeastOne` | aspect ratio at least the equilateral's | `ComparisonTolerance` | test (random triangles) |
| `Law_EquilateralTriangleHasUnitRadiusRatio` | normalization of R / 2r | `ComparisonTolerance` | test |
| `Law_EquilateralTriangleHasUnitAspectRatio` | normalization constant sqrt(3) / 6 | `ComparisonTolerance` | test |
| `Law_UnitSquareHasZeroSkew` | skew of a square is 0 | `ComparisonTolerance` | test |
| `Law_UnitSquareHasUnitScaledJacobian` | scaled Jacobian of a square is 1 | `ComparisonTolerance` | test |
| `Law_DartQuadIsNotConvex` | the convexity test fires on the planar dart (a rejecting witness) | exact sign | test |

### Conversions (`mesh-conversions.laws.plato`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_TriangleMeshKeepsPositions` | `ToTriangleMesh3D` positions are the mesh's | exact by construction | test |
| `Law_TriangleMeshSplitsEachQuadInTwo` | T + 2Q triangles | exact | test |
| `Law_TriangulatedCornerNamesTheTriangleCorner` | triangle k slot s is model corner `TriangulatedCorner(k, s)` | exact | test |
| `Law_TriangleMeshKeepsArea` | same total area | `ResolutionAt` of the total (`TotalsAgree`) | test |
| `Law_QuadMeshIsOkExactlyWithoutTriangles` | `Ok` exactly when there are no triangles | exact | test |
| `Law_QuadMeshKeepsPositions` | `ToQuadMesh3D` positions are the mesh's | exact by construction | test |
| `Law_QuadMeshKeepsAreaWhenOk` | same total area when `Ok` | `ResolutionAt` of the total (`TotalsAgree`) | test |
| `Law_PolygonMeshKeepsPositions` | `ToPolygonMesh3D` positions are the mesh's | exact by construction | test |
| `Law_PolygonMeshHasOneFacePerElement` | one face row per element | exact | test |
| `Law_PolygonMeshKeepsArea` | same total area through the stdlib's fan triangulation | `ResolutionAt` of the total (`TotalsAgree`) | test |
| `Law_SplitHasAtLeastAsManyVertices` | at least as many vertices, when every vertex is referenced | exact | test |
| `Law_SplitSplitsEachQuadInTwo` | the same T + 2Q elements | exact | test |
| `Law_SplitHasOneNormalPerVertex` | one normal per split vertex | exact | test |
| `Law_SplitHasOneUvPerVertex` | one uv per split vertex | exact | test |
| `Law_SplitHasOneSourcePerVertex` | one source vertex per split vertex | exact | test |
| `Law_SplitVertexKeepsItsSourcePosition` | a split vertex sits at its source's position | exact by construction | test |
| `Law_SplitFollowsTheTriangulation` | under `SourceVertex` the split triangles are `ToTriangleMesh3D`'s | exact | test |
| `Law_SplitVertexCarriesItsCornerNormal` | each corner's split vertex has that corner's normal | exact by construction | test |
| `Law_SplitVertexCarriesItsCornerUv` | each corner's split vertex has that corner's uv | exact by construction | test |
| `Law_SplitVerticesDiffer` | two split vertices differ in source, normal, or uv: no needless split | exact by construction | test |

### Theorems (`*.spec.plato`)

`NumberedSitesHaveDistinctIndices`, `EveryIndexHasASite`, `SharedSamplesShareAnIndex`, `ComponentsAreTheChainClasses`,
`WatertightByNumbering`, `ClosedOrientedSurfacesHaveAGenus`, `OrientedSurfacesWithBoundaryHaveAGenus`, `DiscreteGaussBonnet`,
`MixedGaussBonnet`, `SignedVolumeSignIsOrientation`, `RadiusRatioIsAtLeastOne`,
`AspectRatioIsAtLeastOne`, each with its justification and the laws that test it.

## Names used from lower layers

All fixed in VOCABULARY.md revision 2: from `00-foundation` `LengthTolerance`, `AngleTolerance`,
`ElementIndex`, `BrepVertexIndex`, `BrepEdgeIndex`, `BrepFaceIndex`, `MeshVertexProvenance` (cases
`OnVertex`, `OnEdge`, `OnFace`), and, since the fix wave, `IntegerTotal`, `IsOnFace`, `Corresponds`,
and `ResolutionAt`; from `02-topology` `BrepModel` (fields `Vertices`, `Edges`, `Faces`,
`Tolerances`) and `BrepVertex.Point`; from `04-discretization` `EdgeDiscretizations.ByEdge` and
`EdgeDiscretization.Points`; from `05-face-meshing` `FaceMesh` (all nine fields) and `UvPointSource`
(all five cases). Nothing is declared on another layer's behalf.

Readings of those names this layer depends on, for the owning authors to confirm:

1. `UvPointSource.FromEdge(Edge, Index)`: `Index` is the point's position in the edge's forward
   discretization (`EdgeDiscretization.Points`), and only interior points (1 to n - 2) use it; the end
   points are `FromVertex`. `SiteOfUvPoint` reads slot `Index - 1`.
2. `FaceMesh.Normals` are outward face normals (the surface normal times the face's `SameSense`), and
   `FaceMesh` elements are wound counter-clockwise about them; assembly copies both unchanged.
3. Synthetic `SeamCut` and `Pole` points, and `Interior` points, have local vertices with provenance
   `OnFace`; all parameter-space points of one pole share one local vertex.
4. `AssembleModelMesh` receives one face mesh per model face, in face order (an empty one for a face
   that failed): `CanAssemble` states it.

## Left open

- **The quad volume convention** (A-C split here, averaged splits in research 4.7) is the owner's to
  confirm.
- **The 5 degree quad angle-defect threshold** has no source.
- **Degenerate model edges.** A degenerate edge (a pole or an apex) should be discretized by its two
  vertex points only; if it had interior points they would be distinct coincident vertices, which
  `VerticesOfOneComponentAreApart` reports. `04-discretization` to confirm.

## Implementation notes

- **Totals are compensated.** `CompensatedSum` (Neumaier) sums areas, volumes, and angle sums, so
  each total errs by about 2u times the sum of its terms' magnitudes rather than n u times it, and
  the laws comparing two totals are judged by `ResolutionAt` (32 u) of that magnitude whatever the
  mesh size. A plain fold (`SumOf`) would make those laws false on large meshes (the review's F7: 50
  element areas totalling 9.8e5 mm^2 already differ by 7e-10 between two orders). With a 32-bit
  `Number` the same laws hold, since `ResolutionAt` scales with the unit roundoff.
- **The edge table's sort key** must not be `min * V + max` in a 32-bit `Integer` (it overflows above
  46,341 vertices); sort pairs, or use a 64-bit key. The coincident-vertex hash has the same hazard
  (research/EXISTING-MESHER-LESSONS.md lesson 1).
- **Reference bodies are quadratic** where clarity won: `NumberMeshVertices` (through `CitesEdge`),
  `FaceInteriorRank`, `SideCountOf`, `DirectionSumOf`, `LinkEdges`, `CountsOf`, and `PieceCount`
  (cubic, by label propagation; `IsPinchedVertex` uses it on one link). They are the oracles
  the table laws compare against; the implementation replaces them with one-pass versions and keeps
  these for the tests.
- **`GlobalVertexOf` per face mesh** is best precomputed once as a table from parameter-space point
  to global index; assembly and every corner law then read it.
- **The six deferred functions** (`AssembleModelMesh`, `EdgeTableOf`, `ComponentsOf`,
  `ComponentCountsOf`, `CoincidentVertexPairs`, `ToSplitTriangleMesh3D`) compile to
  `NotImplementedException` stubs in C# today (PLATO-PRIMER.md D.7).
- **`ToSplitTriangleMesh3D` compares attributes bitwise**, as the decision above says; compare the bit
  patterns, so that negative zero and NaN do not split or merge by accident.

## Gate

Run 2026-10-17 with the driver of PLATO-PRIMER.md E.3, built in scratch:

- Before the fix wave, over all nine layers: PASS, 0 errors, 6,357 functions type-checked.
- Fix wave, after each commit, this folder live with the other layers as of the wave's start
  (commit 9099f8e8), and 07-validation's calls to the nine rounding laws adjusted in the scratch
  copy only, without the tolerance argument: PASS, 0 errors (6,399 functions at the end).
- Fix wave, last: this folder live against main at c42213a2 (layer 0 committed): no finding in
  this folder. The 15 errors are all in 05-face-meshing and 07-validation and are the predicted
  mid-wave follow-ups (the `Tolerances.Parameter` split, `ReportOf` with `Check.Bound`, the new
  `Provenance` arms), plus two layer 4 names layer 7 still calls, stubbed in scratch.
- Remaining Info findings: LINT003 (fields no function reads yet) and two LINT014 on
  `EulerCharacteristic`, a name VOCABULARY.md fixes that the stdlib's `TopologySummary` also uses
  as a field.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `MeshVertexNumbering` start arrays, lengths unstated | `EdgeInteriorStart` has E + 1 entries, `FaceInteriorStart` F + 1, CSR offsets, non-decreasing | one location for each count and for the vertex total; empty runs for straight edges |
| `GlobalIndex(n, p, slot)`, slot unstated | slot is ignored for `OnVertex`, is the discretization point index minus 1 for `OnEdge`, and the rank among the face mesh's `OnFace` local vertices for `OnFace` | the numbering is defined on sites; `MeshVertexSite` (new) names them |
| (none) | `MeshVertexSite`, `NumberMeshVertices`, `SiteOfUvPoint`, `GlobalVertexOf`, `IsSameBoundarySample`, `CanAssemble`, `AssembledElement` | the constructor of the numbering and the face-mesh-to-global map assembly and validation share |
| `ToQuadMesh3D(mesh)` returning a quad mesh | returns `QuadMeshOutcome { Ok; Mesh }` | partial-operation style 1 for "only when there are no triangles" |
| `ToSplitTriangleMesh3D(mesh)`, result unstated | returns `SplitTriangleMesh3D { Mesh; Normals; Uvs; SourceVertex }` | a renderer needs the per-vertex attributes the split exists for |
| `MeshEdgeTable`, fields unstated | `{ Edges: UndirectedEdgeList; ElementCounts; DirectionSums }` | reuses the stdlib's canonical edge list |
| `Genus` per component | `Genus(c: MeshComponentCounts, fallback)`, with `MeshComponentIndex`, `MeshComponents`, `MeshComponentCounts`, `ComponentsOf`, `ComponentCountsOf`, `CountsOf` | components need a type; genus is partial (style 3) |
| `AngleDefectSum(mesh)`, `SignedVolume(mesh)` | also per component: `AngleDefectSum(mesh, comps, c)`, `SignedVolume(mesh, comps, c)`; `AngleDefectSum` returns `Angle` | Gauss-Bonnet and the volume sign are per closed component and per shell |
| `TriangleQuality`, `QuadQuality` functions unnamed | `TriangleQualityOf(Triangle3D)`, `QuadQualityOf(Quad3D)`, `TriangleQualityAt`, `QuadQualityAt`, `MeshQualityThresholds` with `CubitAcceptable` | metrics on stdlib shapes so identity laws run on random triangles |
| (none) | `Reversed(mesh)`, `WindingNumber`, `CoincidentVertexPairs`, `DegenerateElements`, `ElementsWithRepeatedCorners`, `IsPinchedVertex`, `Witness_UnitTetrahedron` | the reversal, outward-orientation, detection, and witness the laws need |
| research catalogue names for layer 6 | `Law_MeshEdgeAtMostTwoElements` is `Law_ManifoldMeansNoEdgeHasMoreThanTwoSides`; `Law_MeshEdgeExactlyTwoElements` is `Law_ClosedMeansEveryEdgeHasTwoSides`; `Law_MeshEdgeOppositeTraversal` is `Law_OrientedExactlyWhenNoEdgeIsMisoriented`; `Law_MeshVertexLinkIsSingleCycle` is `Law_ClosedMeshHasNoPinchedVertex`; `Law_MeshNoCoincidentVertices` is `VerticesOfOneComponentAreApart`; `Law_MeshElementNotDegenerate` is `ElementIsNotDegenerate`; `Law_MeshComponentEulerEvenAtMostTwo` is `Law_ClosedOrientedSurfaceHasGenus`; `Law_AngleDefectSumIdentity` is `Law_AngleDefectSumIsTwoPiTimesEuler`; `Law_QuadAngleDefectWithinTolerance` is `QuadAngleDefectMeetsThreshold` | names that say the statement; the catalogue's were proposals, not fixed names |
| (none) | `CompensatedSum(values)`, `TotalsAgree(a, b)` | the summation and the yardstick of every law comparing two totals |
| `Law_AreaIsSumOfFaceMeshAreas(m, faceMeshes, n, tol)`, `Law_TriangleMeshKeepsArea(mesh, tol)`, `Law_QuadMeshKeepsAreaWhenOk(mesh, tol)`, `Law_PolygonMeshKeepsArea(mesh, tol)` | the same without `tol` | rounding laws judged by `ResolutionAt`, not by the model's length tolerance; 07-validation's four `Check_` calls drop the argument |
| `Law_ReversalNegatesSignedVolume(mesh, tol)`, `Law_TriangleAngleSumIsPi(mesh, e, tol)`, `Law_QuadAngleDefectIsNotNegative(mesh, e, tol)`, `Law_AngleDefectSumIsTwoPiTimesEuler(mesh, c, tol)`, `Law_AngleDefectSumIsTwoPiTimesEulerPlusQuadDefects(mesh, c, tol)` | the same without `tol`; `VolumeRoundingMagnitude`, `AngleSumResolution`, `DefectSumResolution` added | rounding laws judged by `ResolutionAt`; 07-validation's five `Check_` calls drop the argument |
| `MeshComponents { ElementComponent; VertexComponent; ComponentCount }`, `ComponentsOf` contract partial | adds `ElementParent`, `ElementDepth` (a spanning forest rooted at each component's lowest element); `ElementParentOf`, `ElementDepthOf`, `IsComponentRoot`, `RootsBelow`, `RootCount`, `SharesAVertex` | the certificate makes the contract exact without a reachability form |
| `IsPinchedVertex` deferred, contract partial | written out over `PieceCount` (with `FirstPositionOf`, `DistinctEnds`, `PieceLabelRound`, `PieceLabels`) | the definition is a degree test and a piece count; the body is total and exact |
| `MeshComponentCounts` with eight fields; `Genus` for closed components only | adds `BoundaryCycles`; `HasGenus` and `Genus` use 2 - chi - B; `BoundaryEdgesOf` | the genus of a component with boundary (an open shell, a face that failed to mesh) is defined |
| (none) | `RestrictedToFaces(mesh, faces)`, `IsElementOfFaces`, `ElementsOfFaces`, `ReferencedEulerCharacteristic(mesh)` | per-shell counts (review M10, section 6): the mesh of a shell is a valid `ModelMesh`, and its Euler characteristic counts only referenced vertices |
| (none) | `CornerProvenanceIsOnItsElementFace`, `IsOnClosureOfFace` | the cellular map stated as a law (review M9); 07-validation can add its `Check_` |
| (none) | `Law_VectorAreaVanishes`, `ComponentVectorArea`, `VectorAreaRoundingMagnitude` | research 4.6's law with an a-priori rounding bound (review M11) |
| face mesh area | `FaceMeshArea(fm)` declared here | this layer's area law needs it; named apart from `Area` so it cannot collide with one `05-face-meshing` may declare |
| `SameConnectivity` in 07-validation (vertex count) and 08-pipeline (numbering) | `SameConnectivity(a, b)` here, in `ModelMeshes`: same triangles, quads, element faces, vertex count, and numbering (`IsSameNumbering`, moved from the assembly laws to `ModelMeshNumbering`) | one declaration, in the layer that owns `ModelMesh`; layer 8's meaning, which two numberings with one vertex total do not pass |

## Fix wave, 2026-10-17

Findings from `reviews/MATH-REVIEW-layers-0-6.md`, the "Findings in lower layers" sections of
`07-validation/README.md` and `08-pipeline/README.md`, and `reviews/FIX-WAVE.md`, one commit each.

Applied:

- **`SameConnectivity` by numbering** (FIX-WAVE ownership table; 07 finding 1). Declared once here
  with a body; layers 7 and 8 delete their copies.
- **Area-sum and conversion area laws by `ResolutionAt`** (review F7). `CompensatedSum` and
  `TotalsAgree` added; `Area` and `FaceMeshArea` are compensated; the four area laws lose their
  `LengthTolerance` parameter. The README's "true for meshes of any size" now holds.
- **The other rounding laws by `ResolutionAt`** (review F7, "and others"). The volume reversal law
  is judged by `ResolutionAt` of `VolumeRoundingMagnitude` (the sum of the products of corner
  distances from the volume origin), the triangle angle sum and quad defect laws by
  `ResolutionAt(2 pi)`, and both Gauss-Bonnet laws by `ResolutionAt` of the defect sum's
  magnitude; the signed volume and the angle sums are compensated. The model's angle tolerance
  (1e-9 rad by layer 3's policy) was the wrong kind of bound for an identity about rounding.
- **No ill-formed tolerance in the Gauss-Bonnet theorems** (review F12). `DiscreteGaussBonnet` and
  `MixedGaussBonnet` assumed `ElementIsNotDegenerate` at `LengthTolerance(0.0)`, below layer 0's
  smallest well-formed tolerance; they now assume a positive smallest altitude directly.
- **`ComponentsOf` contract exact** (FIX-WAVE layer 6; README "Left open"). `MeshComponents` carries a
  spanning forest (`ElementParent`, `ElementDepth`) whose laws certify that each component is
  connected, so elements joined by no chain cannot share a component; theorem
  `ComponentsAreTheChainClasses` states it. The old "first appearance" ensures is replaced by the
  root numbering laws.
- **`IsPinchedVertex` total and exact** (FIX-WAVE layer 6; README "Left open"). It has a body: a link
  degree above 2, or a link of more than one piece (`PieceCount`, label propagation), so the
  disconnected link is now pinned as well.
- **The genus of components with boundary** (FIX-WAVE layer 6; README "Left open").
  `MeshComponentCounts.BoundaryCycles` (the pieces of the boundary-edge graph, `PieceCount` in the
  contract) gives chi = 2 - 2g - B; `HasGenus` no longer requires closedness. Theorem
  `OrientedSurfacesWithBoundaryHaveAGenus` and two laws added; the closed-case laws keep their
  names and meaning.
- **Counts per shell** (review M10 and section 6, condition 1). `RestrictedToFaces(mesh, faces)`
  is the sub-complex of a set of faces over the same vertices and numbering, a valid `ModelMesh`
  (corner attributes kept), and `ReferencedEulerCharacteristic` is its V - E + F over referenced
  vertices. The function `07-validation` needs for `Law_MeshEulerEqualsBrepEuler` is
  `mesh.RestrictedToFaces(m.ShellFaces(s)).ReferencedEulerCharacteristic`. Layer 7's
  `RestrictedToShell` already compares per shell, as condition 1 requires, but builds a mesh with
  empty corner arrays, which breaks `ModelMesh`'s invariants; it should become a call to
  `RestrictedToFaces`. Conditions 2 (C6, vertex loops on a seam's pole) and 3 (F1 and C1, seams by
  the left rule and `Closed` directions) are layer 5's fixes: until they land, sphere A and B, the
  seamed cone, and closed B-spline faces produce no mesh and the identity is vacuous there.
- **A cellular provenance law** (review M9). `CornerProvenanceIsOnItsElementFace`: every corner
  of an element of face f has provenance `OnFace(f)`, `OnEdge(e)` with e cited by f, or
  `OnVertex(v)` with v on f's bounds (02-topology's `FaceUsesEdge`, `BoundVertices`).
- **`Law_VectorAreaVanishes` stated** (review M11). The vector area of a closed, consistently
  oriented component, summed compensated, is within `ResolutionAt` of the sum of |b - a| |c - a|
  over its triangles.
- **`IntegerTotal` and `IsOnFace` deleted** (review C10; FIX-WAVE first table). Both are now layer
  0's, with the same signatures and meaning (commit c09a121b); this layer calls them. Gated
  against the committed layer 0 on main (see "Gate").

Checked, nothing to change:

- **`Periodicity.Closed`** (FIX-WAVE first table). No layer 6 code reads `Periodicity` or matches on
  it; seams reach this layer only as face mesh points, already numbered by site.
- **`Tolerances.Parameter` split.** No layer 6 code reads `.Parameter`.
- **New `Provenance` cases.** No layer 6 code matches on `Provenance`.
- **Section 6 of the review, conditions 2 and 3** (C6; F1 and C1) are layer 5's.
- **07-validation finding 7** (`Law_AngleDefectMatchesBrepEuler`): this layer's comment already
  names it as 07-validation's.

Skipped:

- **M7** (pole collapse decided by combinatorics) names `Lift`, layer 5's; C7 says layers 5 and 6
  agree on the pole segment, so nothing here changes.

Follow-ups owed by other layers: 07-validation drops the tolerance argument from its nine
`Check_` calls of `Law_AreaIsSumOfFaceMeshAreas`, `Law_TriangleMeshKeepsArea`,
`Law_QuadMeshKeepsAreaWhenOk`, `Law_PolygonMeshKeepsArea`, `Law_ReversalNegatesSignedVolume`,
`Law_TriangleAngleSumIsPi`, `Law_QuadAngleDefectIsNotNegative`,
`Law_AngleDefectSumIsTwoPiTimesEuler`, and `Law_AngleDefectSumIsTwoPiTimesEulerPlusQuadDefects`;
layers 7 and 8 delete their `SameConnectivity`; layer 7's `RestrictedToShell` becomes
`RestrictedToFaces`, and it may add `Check_`s for `CornerProvenanceIsOnItsElementFace`,
`Law_VectorAreaVanishes`, and `Law_OrientedSurfaceWithBoundaryHasGenus`. `CompensatedSum` could
move to layer 0 if a second layer needs it.

## Implementation, chunk A

TKT-314, 2026-10-17. Of the six functions the design pass deferred, all six have bodies, each from
its contract; `ToSplitTriangleMesh3D` was not on TASKS.md's list but every model mesh validation
reaches it, so the unit box could not validate without it.

| Body | Derived from |
|---|---|
| `AssembleModelMesh` | contract `AssembleModelMesh` and its note: one pass writing each parameter-space point's local position and provenance at its `GlobalVertexOf` index, first write winning, model vertices first with their points; triangles of all faces, then quads, corners mapped by `GlobalVertexOf`, corner normals and parameters copied in `CornerOf` order |
| `EdgeTableOf` | contract `EdgeTableOf`: proper sides sorted by canonical pair (lexicographic, not a packed key, per "Implementation notes"), runs counted, direction sums +1 lower-to-higher |
| `ComponentsOf` | contract `ComponentsOf`: one breadth-first search per component from its lowest element over shared vertices, which gives the classes and the spanning forest together; unreferenced vertices -1 |
| `ComponentCountsOf` | contract `ComponentCountsOf`: each count its ensures clause (the reference form, quadratic) |
| `CoincidentVertexPairs` | contract `CoincidentVertexPairs`: every pair a < b of referenced vertices of one component within the tolerance, lexicographic by construction (quadratic where the note hashes) |
| `ToSplitTriangleMesh3D` | contract `ToSplitTriangleMesh3D`: corners of a vertex grouped by exact (normal, uv), compared with layer 0's `Identical` per component; split vertices by source vertex then first corner |


## Invariants as predicates (finding F-54)

2026-10-18. The law runner draws arbitrary `ModelMesh`, `MeshEdgeTable`, `MeshVertexNumbering` and
`FaceMesh` values, and every law must hold for every value it can draw (F-54's decision). The
invariants of those types, and the properties a mesh the library produced has (no repeated corner,
no degenerate or folded element, distinct vertices, quality thresholds), are therefore predicates,
not laws: the names above without the `Law_` prefix, still checked one by one by layer 7's
`Check_` functions over the meshes it validates, with the predicate's name as the diagnostic code.
`IsWellFormed(mesh)` bundles the seven `ModelMesh` invariants and `IsWellFormed(t)` the seven of the
edge table. The laws that state them:

| Law | States |
|---|---|
| `Law_MeshWitnessIsWellFormed(k)` | every literal mesh (`MeshWitnessAt(k)`: the unit tetrahedron, its reversal) meets the `ModelMesh` invariants |
| `Law_EdgeTableOfIsWellFormed(mesh)` | `EdgeTableOf` builds a well-formed table from any well-formed mesh |
| layer 8's laws over `MeshModel`'s inputs | the mesh, its numbering and its face meshes as the pipeline produces them meet every predicate (layer 8 README) |

The laws over a function of a mesh (the split-mesh laws, `Law_ComponentEulerCharacteristicsAddUp`,
`Law_ClosedOrientedSurfaceHasGenus`, the restriction laws) are guarded by `IsWellFormed(mesh)`, the
function's precondition.
