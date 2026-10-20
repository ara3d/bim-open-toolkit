# catalog-indices: TYPE-CATALOG.md section 3 (indices, slots, keys, addresses) and IIndexedTable

Ticket: TKT-323
Status: ready: catalog-indices

## Done
- catalog-indices, see `git log -- sandbox/step-mesh-staging/catalog-indices`, about 0.7 h: 19 laws pass, 0 type errors in this folder.
  Types added (23): `BoundSlot`, `CoedgeSlot`, `EdgeSampleIndex`, `InteriorSlot`, `UvPointIndex`,
  `LocalVertexIndex`, `ElementSide`, `ElementSidePair`, `HalfEdgeKey`, `EdgeKey`, `SampleKey`,
  `TableName`, `BrepVertexRemap`, `EdgeRemap`, `LoopRemap`, `FaceRemap`, `ShellRemap`, `BodyRemap`,
  `CurveRemap`, `Curve2DRemap`, `PcurveRemap`, `SurfaceRemap`, `KernelRemap`. Library functions
  for the stdlib's `CornerIndex`: `TriangleCorner`, `QuadCorner`. Concepts added (1): `IIndexedTable<TIndex, TRow>`.

## Choices where the catalog sketches
- `BrepVertexRemap`, not `VertexRemap`: the stdlib's `geometry/remeshing.types.plato` declares `VertexRemap`.
- Remaps hold typed indices (`FaceRemap { NewOf: Array<BrepFaceIndex> }`); each is built from an
  Integer form by `To<Name>Remap` and read back by `NewOfValues(KernelRemap, TableName)`. The catalog's
  generic `IndexRemap<TIndex>` was not added: the per-table names are what the brief asked for.
- `IIndexedTable`'s obligations are `RowCountOf`, `RowAt`, `IsRowIndex`, not `Count`, `At`, `IsInRange`,
  so they never join the stdlib's `ICountable.Count` and `IIndexable.At` overload groups.
- **No kernel table implements `IIndexedTable`.** The tables are `Array<T>` fields of `BrepModel` and
  `GeometrySet`; `Array<T>` cannot gain an `implements` clause, and `BrepModel` cannot implement it once
  per table (one `RowCountOf(x: Self)` cannot mean six counts). The one law over ten tables is stated
  over `TableName` instead: `IsRowInRange(m, t, i)` against `IsInTable(m, t, i)`, which calls the
  library's existing per-table predicates (`IsFaceInRange` and the rest), so no new per-table predicate
  was needed. The interface stays declared for a later table wrapper type.
- `ToSite(m, key, sampleCount)` takes the edge's sample count; `ToSiteOnEdge` is the Integer-testable
  core. Sample 0 is the start vertex, sample `count - 1` the end vertex, sample k interior slot k - 1,
  following `mesh-numbering.types.plato`. An out-of-range edge or sample gives `EdgeInterior(e, -1)`,
  the none slot; the spec's `requires` names the ranges.
- `KernelKey` was not added: `KernelElement` (`03-step/step-decode.types.plato`) already is the typed
  union of the ten tables. `ProvenanceMap.SourceOf(KernelElement)` was not added: `NoElement` has no
  `StepSource`, so it needs a decided result (section 5) or a fallback, which section 5's owner should pick.
- `GlobalVertexIndex` not added: `VertexIndex` stays the global index, as the catalog allows.

## Merge instructions
- Move the five files in; no library function is rewired. The laws keep their `Law_Catalog_` names until merge.

## Contract requests
- `CoedgeSite` (`02-topology/topology-model.types.plato`): retype `Bound: Integer` as `Bound: BoundSlot`
  and `Slot: Integer` as `Slot: CoedgeSlot`, so the two cannot be swapped at a call site.
- `MeshVertexSite.EdgeInterior` and `FaceInterior` (`06-mesh/mesh-numbering.types.plato`): retype `Slot: Integer`
  as `Slot: InteriorSlot`; `ToSiteOnEdge` then drops its `.Value`.
- `UvPointSource.FromEdge(Edge, Index: Integer)` (`05-face-meshing/uv-regions.types.plato`): `Index: EdgeSampleIndex`.
- `FaceMesh`: its parameter-point indices as `UvPointIndex` and its local vertex indices as `LocalVertexIndex`.
- The hand-written `3T + 4q + s` corner arithmetic: call `TriangleCorner` and `QuadCorner`.
- `ModelMesh`'s library function `ElementSide(mesh, e, slot): VertexPair` (`06-mesh/mesh.library.plato:97`)
  shares its name with the new type `ElementSide`. It compiles (different arity), but reads badly; rename
  the function `ElementSideVertices` at merge.

## Requests to other tracks
- None. Nothing borrowed.

## Findings
- The five-parameter laws ran 25 cases each, not exhaustively; the two-parameter ones ran 196.
- `Law_Catalog_RowInRangeAgreesWithTable` runs over runner-made `BrepModel`s, which are mostly small;
  a witness model with rows in every table would make it bite harder.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading | 12 min | |
| Writing | 20 min | |
| Type-check runs | 7 s | 1 |
| Law runs | 1 s | 1 (19 laws) |
| Waiting on the server | 0 min | |
| Committing | 2 min | 1 |

## Lessons
- Reading the existing range predicates first saved declaring ten new ones.
