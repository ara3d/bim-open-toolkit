# catalog-editing: TYPE-CATALOG.md section 12 (edits as data with inverses) and IEditable

Ticket: TKT-323
Status: ready: catalog-editing

## Done
- catalog-editing, see `git log -- sandbox/step-mesh-staging/catalog-editing`, about 1.2 h against 2
  expected: 17 `Law_Catalog_` laws, all pass under cpu64; zero type errors in this folder.

Types added (18): `Selection`, `SelectionClosure`, `Anchor`, `GeometricEdit`, `FaceUse`,
`TopologicalEdit`, `ToleranceEdit`, `ModelEdit`, `EulerOperator`, `EditPrecondition`,
`EditOutcome`, `EditScript`, `ScriptOutcome`, `Transaction`, `Invalidation`, `MeshPatch`,
`EditPreview`, `Dirty`. Concepts added (1): `IEditable`.

Files: `catalog-editing-{selection,edits,invalidation}.types.plato`, `catalog-editing.concepts.plato`,
libraries `catalog-editing-closure` (`CatalogEditingClosure`), `-euler` (`CatalogEditingEuler`),
`-invalidation` (`CatalogEditingInvalidation`), `-outcome` (`CatalogEditingOutcome`), laws
`catalog-editing.laws.plato` (`CatalogEditingLaws`), spec `catalog-editing.spec.plato`.

What `Apply(m, edit)` implements:
- Geometric: `MoveVertex`, `ReplaceCurve`, `ReplaceSurface` (inverse: the same edit with the old value);
  `Transform` and `Scale` of `Selection.Everything` through layer 2's `RigidlyMoved` and `ScaledBy`
  (inverse: the inverse pose, the inverse power of two). All keep table sizes; remap is the identity.
- Tolerance: `SetTolerances` (refused unless the length tolerance is positive), `ScaleTolerances`
  (refused unless the factor is positive); inverse of both is `SetTolerances(old)`.
- Topological: `ReverseFace` (layer 2's `WithFacesReversed`), `ReverseLoop` (new `Reversed(BrepLoop)`:
  coedges reordered and flipped), `RemoveFace` and its inverse `RestoreFace`. Deferred, bodiless with
  `// deferred:` and contracts in the spec: `SplitEdge`, `MergeEdges`, `SplitFace`, `AddFace`,
  `RetrimFace` (`ApplySplitEdge` and the rest), and `ApplyEuler`.

Choices where the catalog sketches:
- `RestoreFace(At, Face, Uses: Array<FaceUse>)` is a new `TopologicalEdit` case. The catalog's
  `AddFace(BrepFace)` cannot undo `RemoveFace` exactly: it has no index and no shell membership.
- `Transform` and `Scale` refuse a partial selection (`SelectionIsWholeModel`): moving part of a
  model needs the curves and surfaces it shares with the rest split first, which is a topological
  edit. `Scale` takes `PowerOfTwoFactor`, so scaling and its inverse are exact.
- The script form returns `ScriptOutcome` (`ScriptApplied(Model, Remap, Inverse: EditScript)` or
  `ScriptRefused(Step, Precondition, Where)`), not `EditOutcome`: a script's inverse is a script, and
  it is known only after applying, so the catalog's `Inverse(script)` became the outcome's field.
- `EulerOperator` payloads, minimal: `MakeVertexEdge(Loop, From, At, Curve)`,
  `MakeEdgeFace(Loop, From, To, Curve)`, `KillEdgeMakeRing(Edge)`,
  `MakeEdgeKillRing(Outer, Ring, From, To, Curve)`, `KillEdgeVertex(Edge, Vertex)`,
  `KillFaceMakeRingHole(Face, Into)`. `CountDelta(op): ShellCounts` and `HoleDelta(op): Integer`;
  KillFaceMakeRingHole changes V - E + 2F - L by -2 and adds a hole, so the law is the
  Euler-Poincare balance, not "unchanged".
- `ClosureOf`: vertices close over the edges at them and those edges' faces (plus faces with a
  vertex loop there); edges over their end vertices and `FacesOfEdge`; faces over the edges their
  loops cite and those edges' ends; shells over `ShellFaces`; bodies over their shells. Every array
  of a closure is in increasing order, each index once, in range.
- `InvalidationOf`: a vertex move invalidates its closure's edges and faces; a curve replacement the
  edges on the curve and their faces; a surface replacement its faces; a tolerance edit and a
  whole-model transform or scale the whole model; a reversal the faces it changes; `RemoveFace` the
  face; `AddFace`/`RestoreFace` nothing (the remap renumbers).
- `EditPrecondition` cases: one per table range, `FaceSlotInRange`, `SelectionIsWholeModel`,
  `FactorIsPositive`, `ToleranceIsPositive`, the catalog's four, and `NotYetImplemented`.
- `Anchor` has no function yet: resolving `ByIndexAt` needs an edit history.

Laws (17, all pass, cpu64, 2026-10-20). Each takes Integer selectors and runs both witnesses
(`Witness_UnitBox`, `Witness_Cylinder`) inside, so the runner covers it exhaustively (196 or 14 cases):
- `InverseUndoes` (every implemented kind but Transform, `SameModel`), `TransformInverseRestoresVertices`
  (within the model's length tolerance), `ScriptInverseUndoes` (two-edit scripts), `ReversedLoopStillChains`.
- `RefusedLeavesModelUnchanged`, `OutOfRangeEditIsRefused`, `InRangeEditIsApplied`.
- `RemapIsIdentityForGeometricEdits` (all ten tables), `ComposeWithIdentityIsIdentity`, `RemoveFaceRemapDropsTheFace`.
- `InvalidationCoversChangedFaces` (a face whose record, surface, loops, cited edges, their curves and
  end points, or vertex-loop vertices changed, `DefiningPoints` included, is covered),
  `InvalidationIsInRange`.
- `ClosureContainsSelection`, `ClosureIsInRange`, `ClosureHoldsFacesOfEdge`, `ClosureHoldsEdgesOfFace`.
- `EulerOperatorKeepsCharacteristic`.
- Mutation check: emptying a vertex move's invalidation, dropping `RemoveFace`'s uses from its
  inverse, and not flipping a reversed loop's coedges each made at least one law fail.

## Merge instructions
- New layer `10-editing`: move every file in. The laws keep their `Law_Catalog_` names until merge.
- `Reversed(loop: BrepLoop)` belongs in `02-topology` beside `Reversed(face)`.

## Contract requests
- `ShellCounts` (`02-topology/topology-model.types.plato`) says every field is non-negative; the
  catalog asks for `CountDelta(op): ShellCounts`, a signed delta. Either relax the comment or add a
  `ShellCountsDelta` type with the same fields.
- `BrepModel implements IEditable` at merge (the obligation is `Apply(BrepModel, ModelEdit)` in
  `CatalogEditingOutcome`); a staging folder cannot add an implements clause to a library type.
- The catalog's `Transform(Selection, By: Pose3D)` meets layer 2's `RigidlyMoved(m, Frame3D)`; Apply
  converts with the stdlib's `Frame3D(pose)`. One motion type across `IMoved` (Pose3D) and layer 2
  (Frame3D) would remove the conversion.
- The catalog's `AddFace` alone cannot be `RemoveFace`'s inverse; add `RestoreFace` to the catalog.

## Requests to other tracks
- None. Nothing borrowed.

## Findings
- `Transform`'s inverse is exact only up to rounding (a quaternion's frame and its inverse), so
  `Law_Catalog_InverseUndoes` cannot hold under `SameModel` for it; it has its own law with the
  length tolerance.
- `BodyShells` (`07-validation/validation-oracles.library.plato:765`) indexes `m.Bodies[b]` without a
  range guard; this folder guards with `IsBodyInRange` instead of calling it.
- The server answered "0 laws, 0 type errors" twice right after an edit (compile about 500 ms) and
  correctly on the rerun; the pinned CLI found nothing wrong. Rerun before debugging.
- `DirtyAfter` reads every script edit against `Before`: right for edits that keep table sizes,
  wrong for a later edit after a removal. Carrying each invalidation through the remaps is open.
- Five-parameter laws get 25 random cases from the runner; looping the witness and the indices inside
  the law made every law here exhaustive over the runner's 14 Integer values.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer, spec DSL, catalog, foundation and indices tracks, layer 2 and 7) | 20 min | |
| Writing types, concepts, libraries | 25 min | |
| Writing laws, spec, TRACK.md | 20 min | |
| Type-check runs | 3 min | 4 server runs, 3 CLI lints |
| Law runs | 2 min | 6 runs, 2 of them on mutated copies |
| Waiting on the server | 0 min | |
| Committing | 2 min | 1 |

## Lessons
- Build each law's model and edit from Integer selectors and loop the witnesses inside: the runner
  then covers every edit kind against in-range and out-of-range indices.
