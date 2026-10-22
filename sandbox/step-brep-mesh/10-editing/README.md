# 10-editing: edits as data with inverses

Layer 10 of the STEP B-rep to mesh design ([../README.md](../README.md)), TYPE-CATALOG.md sections
12 and 15 (`IEditable`). Editing is outside the mesher's scope; these types keep the door open. An
edit is a value (`ModelEdit`). `Apply(m, edit)` returns the edited model, the remap of every table,
and the edit that undoes it, or a refusal naming the failed precondition. The layer also says which
edges and faces an edit invalidates, so a re-mesh can touch only those. Nothing below layer 10 names
anything declared here.

Written 2026-10-20 by the catalog-editing track (TKT-323) and merged the same day.

| File | Holds |
|---|---|
| `editing-selection.types.plato` | `Selection`, `SelectionClosure`, `Anchor` |
| `editing-edits.types.plato` | `GeometricEdit`, `FaceUse`, `TopologicalEdit`, `ToleranceEdit`, `ModelEdit`, `EulerOperator`, `EditPrecondition`, `EditOutcome`, `EditScript`, `ScriptOutcome`, `Transaction` |
| `editing-invalidation.types.plato` | `Invalidation`, `MeshPatch`, `EditPreview`, `Dirty` |
| `editing.concepts.plato` | `IEditable { Apply(x, edit): EditOutcome }`; no type declares it (see "Open") |
| `editing-closure.library.plato` | library `BrepEditingClosure`: `ClosureOf(m, Selection)`, the sorted index sets and the incidence helpers it reads |
| `editing-euler.library.plato` | library `BrepEditingEuler`: `CountDelta(op): ShellCountsDelta`, `HoleDelta(op)`; `ApplyEuler` deferred |
| `editing-invalidation.library.plato` | library `BrepEditingInvalidation`: `InvalidationOf(m, edit)`, `Covers`, `DirtyAfter(Transaction)` |
| `editing-outcome.library.plato` | library `BrepEditing`, the layer's main block: `Apply(m, ModelEdit): EditOutcome`, `Apply(m, EditScript): ScriptOutcome`, `Preview`, the remaps (`IdentityRemap`, `Compose`), the table rewrites, and the outcome readers; five topological edits deferred |
| `editing.laws.plato` | library `BrepEditingLaws`: 17 laws |
| `face-quality.laws.plato` | library `FaceQualityLaws`: 12 laws moved from layer 5 (TKT-418): the quality claims of the version 1 split (angles, the Delaunay property, side-normal turn, quad planarity and convexity, refinement targets); see `05-face-meshing/README.md`, "Gate and quality" |
| `editing.spec.plato` | contracts of `Apply`, `ClosureOf`, `InvalidationOf`, `CountDelta` and the deferred edits; the gate does not read it |

The library files sort closure, euler, invalidation, outcome, and each calls only files that sort
before it, or lower layers. `Reversed(loop)`, which `ReverseLoop` uses, is layer 2's
(`02-topology/topology.library.plato`, beside `Reversed(face)`); so are `ShellCountsDelta`,
`WithDelta` and `CharacteristicDelta`.

## What `Apply` implements

- Geometric: `MoveVertex`, `ReplaceCurve`, `ReplaceSurface`, whose inverse is the same edit with the
  old value; `Transform` and `Scale` of `Selection.Everything` through layer 2's `RigidlyMoved` and
  `ScaledBy`, whose inverse is the inverse pose or the inverse power of two. Every geometric edit
  keeps the table sizes, so its remap is the identity.
- Tolerance: `SetTolerances` (refused unless the length tolerance is positive) and `ScaleTolerances`
  (refused unless the factor is positive); the inverse of both is `SetTolerances(old)`.
- Topological: `ReverseFace` (layer 2's `WithFacesReversed`), `ReverseLoop` (coedges reordered and
  flipped), `RemoveFace`, and its inverse `RestoreFace`.

## Choices where the catalog sketches

- `RestoreFace(At, Face, Uses: Array<FaceUse>)` is a `TopologicalEdit` case the catalog lacked: its
  `AddFace(BrepFace)` has no index and no shell membership, so it cannot undo `RemoveFace` exactly.
  TYPE-CATALOG.md section 12 now says so.
- `Transform` and `Scale` refuse a partial selection (`SelectionIsWholeModel`): moving part of a
  model first needs the curves and surfaces it shares with the rest split, a topological edit.
  `Scale` takes a `PowerOfTwo`, so a scale and its inverse are exact.
- The script form returns `ScriptOutcome` (`ScriptApplied(Model, Remap, Inverse: EditScript)` or
  `ScriptRefused(Step, Precondition, Where)`), not `EditOutcome`: a script's inverse is a script,
  known only after applying, so the catalog's `Inverse(script)` became the outcome's field.
- `EulerOperator` payloads are minimal: `MakeVertexEdge(Loop, From, At, Curve)`,
  `MakeEdgeFace(Loop, From, To, Curve)`, `KillEdgeMakeRing(Edge)`,
  `MakeEdgeKillRing(Outer, Ring, From, To, Curve)`, `KillEdgeVertex(Edge, Vertex)`,
  `KillFaceMakeRingHole(Face, Into)`. `CountDelta(op)` is a signed `ShellCountsDelta` and
  `HoleDelta(op)` an `Integer`. `KillFaceMakeRingHole` changes V - E + 2F - L by -2 and adds a hole,
  so the law is the Euler-Poincare balance, not "unchanged".
- `ClosureOf`: a vertex closes over the edges at it and their faces (and faces with a vertex loop
  there); an edge over its end vertices and `FacesOfEdge`; a face over the edges its loops cite and
  their ends; a shell over `ShellFaces`; a body over its shells. Every array of a closure is in
  increasing order, each index once, in range.
- `InvalidationOf`: a vertex move invalidates its closure's edges and faces; a curve replacement the
  edges on the curve and their faces; a surface replacement its faces; a tolerance edit and a
  whole-model transform or scale the whole model; a reversal the faces it changes; `RemoveFace` the
  face; `AddFace` and `RestoreFace` nothing, since the remap renumbers.
- `EditPrecondition` has one case per table range, `FaceSlotInRange`, `SelectionIsWholeModel`,
  `FactorIsPositive`, `ToleranceIsPositive`, the catalog's four, and `NotYetImplemented`.
- `Anchor` has no function yet: resolving `ByIndexAt` needs an edit history.

## Laws

Each law takes Integer selectors and runs both witnesses (`Witness_UnitBox`, `Witness_Cylinder`)
inside, so the runner covers it exhaustively (196 or 14 cases). All 17 pass under cpu64.

- Inverses: `Law_InverseUndoes` (every implemented kind but `Transform`, under `SameModel`),
  `Law_TransformInverseRestoresVertices` (within the model's length tolerance: a quaternion's frame
  and its inverse round), `Law_ScriptInverseUndoes` (two-edit scripts), `Law_ReversedLoopStillChains`.
- Refusal: `Law_RefusedLeavesModelUnchanged`, `Law_OutOfRangeEditIsRefused`, `Law_InRangeEditIsApplied`.
- Remaps: `Law_RemapIsIdentityForGeometricEdits` (all ten tables), `Law_ComposeWithIdentityIsIdentity`,
  `Law_RemoveFaceRemapDropsTheFace`.
- Invalidation: `Law_InvalidationCoversChangedFaces` (a face whose record, surface, loops, cited
  edges, their curves and end points, or vertex-loop vertices changed is covered),
  `Law_InvalidationIsInRange`.
- Closure: `Law_ClosureContainsSelection`, `Law_ClosureIsInRange`, `Law_ClosureHoldsFacesOfEdge`,
  `Law_ClosureHoldsEdgesOfFace`.
- Euler: `Law_EulerOperatorKeepsCharacteristic`.

A mutation check at staging (emptying a vertex move's invalidation, dropping `RemoveFace`'s uses from
its inverse, not flipping a reversed loop's coedges) made at least one law fail each time.

## Deferred edits

Bodiless, marked `// deferred:`, with their contracts in `editing.spec.plato`:

| Function | Contract |
|---|---|
| `ApplySplitEdge(m, e, at)` | `e` in range and `at` strictly inside its domain; one more vertex and edge (`CountDelta(MakeVertexEdge)`); every coedge citing `e` becomes two; inverse `MergeEdges` of the halves |
| `ApplyMergeEdges(m, a, b)` | both in range, on one curve, sharing a vertex no other edge uses; one vertex and edge fewer (`CountDelta(KillEdgeVertex)`); inverse `SplitEdge` at the removed vertex |
| `ApplySplitFace(m, f, along)` | `f` in range with a bound, its loops chained, at least two cut parameters in their edges' domains; one more face per cut (`CountDelta(MakeEdgeFace)`) |
| `ApplyAddFace(m, face)` | surface and loops in range, at least one bound; the face appended at `m.Faces.Count`, in no shell; inverse `RemoveFace` |
| `ApplyRetrimFace(m, f, bounds)` | `f` in range, at least one bound, every loop in range and chained; inverse `RetrimFace` with the old bounds |
| `ApplyEuler(m, op)` | every index `op` names in range; the touched shell's `RawCounts` change by `CountDelta(op)` (Mantyla, *An Introduction to Solid Modeling*, ch. 9) |

## Open

- `BrepModel` meets `IEditable` through `Apply` but cannot name it: `BrepModel` is layer 2's and the
  concept's obligation names layer 10's `ModelEdit` and `EditOutcome` (reviews/FINDINGS.md, F-58).
- `Transform` takes a `Pose3D` and layer 2's `RigidlyMoved` a `Frame3D`; `Apply` converts with the
  stdlib's `Frame3D(pose)`. One motion type across the two is a design question (F-58).
- `DirtyAfter` reads every edit of a script against `Before`: right for edits that keep table sizes,
  wrong for a later edit after a removal. Carrying each invalidation through the remaps is open.
- `BodyShells` (`07-validation/validation-oracles.library.plato`) indexes `m.Bodies[b]` without a
  range guard; the closure guards with `IsBodyInRange` instead of calling it.
