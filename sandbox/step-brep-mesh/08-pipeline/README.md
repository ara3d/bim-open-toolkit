# 08-pipeline: STEP text to mesh

Layer 8 of the STEP B-rep to mesh design ([../README.md](../README.md)), written 2026-10-17 under
TKT-299 against [VOCABULARY.md](../VOCABULARY.md) revision 2 and the files of layers 0 to 6 as
committed that day. It composes the stages into total functions with result records: parse a STEP
text (layer 3), decode it into a `BrepModel` (layer 3), discretize every edge once (layer 4), mesh
every face (layer 5), refine the edges face meshing asks for in a bounded loop, assemble the mesh by
numbering (layer 6), and validate it at a requested conformance level (layer 7). It owns the loop,
the options, the outcome records, and the laws about the whole.

Validation is layer 7's: `ValidateBrep(level)`, `ValidateModelMesh(tolerances, thresholds, level)`,
and `CrossCheck(mesh, level, criteria)`, all at the options' `ConformanceLevel` (decision 10).

| File | Holds |
|---|---|
| `pipeline.types.plato` | `MeshingOptions`, `PipelineState`, `MeshOutcome`, `StepMeshOutcome` |
| `pipeline.library.plato` | library `StepToMesh`: options, provenance, the pipeline's findings, edges, faces, the loop, assembly and validation, the entry points; 9 of its functions are owed by layers 0, 2, 4, 5 and marked `// belongs-in:` |
| `pipeline.laws.plato` | library `StepToMeshLaws`: 34 laws, 1 witness, 13 helpers |
| `pipeline.spec.plato` | invariants of the 4 types, 14 function contracts, 5 theorems |

Counts: 4 types; 54 library functions, 52 with a body and 2 deferred (`RigidlyMoved` and
`ScaledBy` on a model, both owed by layer 2 and needed only by the metamorphic laws); 34 laws;
18 `spec` blocks; 5 theorems.

## The pipeline as a composition of partial functions

```
String --ParseStep--> ParsedFile --.File--> Part21File --DecodeBrepWith(o.Decode)--> DecodedModel
       --.Model--> BrepModel --MeshModel(o)--> MeshOutcome
```

`ParseStep` is a host obligation (the owner's decision of 2026-10-17, `PLAN.md` "Decided by the
owner during the pass"): STEP parsing stays in C#, and the `Part21File` value of layer 3 is the
boundary between the host and Plato. Layer 3 keeps `ParseStep` as a bodiless declaration that
Plato's foreign function interface binds to the host's parser; the first chunk's parser is the C#
one, and the TypeScript backend will need the same service in TypeScript. Nothing in this layer
changes: `MeshStepTextTraced` calls `ParseStep` as before, and a host that already holds a
`Part21File` (or a `BrepModel`) enters at `DecodeBrepWith` (or `MeshModel`). Every stage from
decoding on is Plato.

Each stage has a domain on which it is exact and is extended to a total function by a located
diagnostic outside it, the same pattern layer 3 uses for decoding. Nothing in the pipeline fails;
it reports.

| Stage | Domain where it is exact | Outside the domain |
|---|---|---|
| `ParseStep` (layer 3, host) | every `String` | total by its contract: `Ok` false exactly when an Error was reported, and `File` holds what parsed |
| `DecodeBrepWith` (layer 3) | **F**, the files `ParseStep` produces; exact on its subset **D** of conforming files | total on **F**: repairs and skips, each diagnosed |
| `MeshModel(m, o)` | **R** = { (m, o) : `Law_IndicesInRange(m)` and `IsWellFormed(o)` } (`IsRunnable`) | refused: `RefusedOutcome`, `Ok` false, no element, the refusal's findings and the model's validation |
| `Discretize(m, e, c, floors)` (layer 4) | **E** = { e : `CanDiscretize(m, e, c)` } | the edge's entry is `Undiscretized` (no points) and an Error at `KernelEdge(e)` |
| `MeshFace(m, f, d, c)` (layer 5) | **F**(d) = { f : `IsDiscretizedFace(m, f, d)` } | `UnmeshedOutcome`: an empty face mesh and an Error at `KernelFace(f)` |
| `Refine(m, d, requests, c)` (layer 4) | `IsRefinable(m, d, requests, c)`, which asks only of requested entries | not reached: every state the loop reaches satisfies it (`Law_PendingRequestsAreRefinable`, invariant I7) |
| `AssembleModelMesh` (layer 6) | `CanAssemble` | not reached: one face mesh per face in face order and a numbering from `NumberMeshVertices` hold by construction |
| `ValidateBrep`, `ValidateModelMesh`, `CrossCheck` (layer 7) | total: each is `ForLevel` over its checks | |

Decoding goes on whatever the parse found, as layer 3 asks: a file with one bad instance is still
decoded and meshed, and the parse Error makes `Ok` false. A text that yields no face gives a mesh
with no element and `Ok` false (`Law_NoFacesMeansNoMesh`, `Law_NoFacesMeansNotOk`); this is what
"parse or decode failure yields no mesh" means here. A face outside **F**(d), or one whose loops
still cross after the loop ends, gets its own diagnostics and no mesh, and every other face is
meshed as it would be without it (`Law_FailedFaceLeavesOthersUnchanged`).

`MeshModel` chooses every face. The loop is defined over a choice of faces (`MeshChosenFaces`), so
that "the run without face f" is a definition and the failure isolation law can compare two runs.
A face left out gets an empty mesh and an Error, so a partial run is never reported as clean.

## The refinement loop as a fixed-point iteration

Research finding 2 ([../research/MESHING-REQUIREMENTS.md](../research/MESHING-REQUIREMENTS.md)
section 0 and 3.7): every gap-free kernel re-discretizes an edge when a face finds its
parameter-space polygon self-intersecting, and re-meshes the faces of that edge; OpenCascade allows
five rounds. Layer 4 made the hook (`EdgeRefinementRequest`, `Refine`), layer 5 the requests
(`FaceMeshOutcome.Requests`; only `LoopSelfIntersects` withholds a mesh). This layer runs it.

**State.** `PipelineState { Round; Discretizations; Floors; Outcomes; Pending }`: the step count,
one polyline per edge (empty for an edge outside **E**), the largest segment count requested per
edge so far, one face outcome per face, and the requests of the faces meshed in the latest round.

**Start.** `InitialState`: layer 4's `DiscretizeAll` with no floors (`Discretize` on every edge of
**E**, `Undiscretized` on every other), every face given `FaceOutcome`, the requests of the chosen faces pending, `Round` 0.

**Step.** `Step(s)`:

1. `d' = Refine(m, s.Discretizations, s.Pending, c)`: per requested edge, the smallest requested
   chordal bound and the largest requested count (layer 4); every other edge bit-identical.
2. `changed = ChangedEdges(d', d)`: the edges `Refine` actually changed. An edge whose segments are
   all at the length floor comes back unchanged.
3. `remeshed = FacesTouching(chosen, changed)`: the chosen faces citing a changed edge
   (`FaceEdges`, layer 5).
4. Each remeshed face gets `FaceOutcome(m, f, d')`; every other outcome is kept.
5. `Floors' = RaisedFloors(s.Floors, s.Pending)`; `Pending'` = the requests of the remeshed faces;
   `Round' = Round + 1`.

**Stop.** `IsTerminal(s)`: `Pending` is empty, or `Round >= MaxRefinementRounds`. `FinalState` is
`StateAfter(MaxRefinementRounds)`, the loop written with `var` and `while` over the state.

**Invariants** of every state the loop reaches, each a law:

| | Invariant | Law |
|---|---|---|
| I1 | `0 <= Round <= MaxRefinementRounds` | `Law_MeasureIsNeverNegative`, spec `PipelineState` |
| I2 | one discretization per edge, entry i of edge i; empty exactly for edges outside **E** | layer 4's `Law_DiscretizationsIndexedByEdge` and `Law_UndiscretizedExactlyWhenUnusable` (round 0), `Law_EmptyDiscretizationExactlyWhenEdgeUnusable` (every round) |
| I3 | every outcome is current: `Outcomes[f]` is `FaceOutcome(m, f, Discretizations)` | `Law_OutcomesAreCurrent`, `Law_OutcomeIsOfItsFace` |
| I4 | every pending request is a request of some outcome, and names an edge of that face | `Law_PendingRequestIsInSomeOutcome`, `Law_RequestsNameEdgesOfTheirFace` |
| I5 | no edge coarsens: every parameter of round r is a parameter of round r + 1 | `Law_RefinementNeverCoarsens` |
| I6 | every discretized edge meets the accumulated floors and layer 4's structural floors | `Law_FinalDiscretizationsMeetFloors` (layer 4's `Law_SegmentFloorMet`) |
| I7 | `Refine` can answer what is pending: every requested edge is discretizable, evaluable, and canonical | `Law_PendingRequestsAreRefinable` (layer 4's `IsRefinable`) |

I3 is what makes the loop a fixed-point iteration rather than a history: because `MeshFace` reads
only the discretizations of the edges a face cites, meshing again only the faces of changed edges
gives the same outcomes as meshing every face. The loop therefore iterates
`G(d) = Refine(d, requests of every face meshed under d)` from `d0`, and the final outcomes are the
outcomes of meshing every face under the final discretizations.

**Termination.** The measure is `MaxRefinementRounds - Round`, a natural number while the loop runs
(I1). `Step` raises `Round` by exactly one (`Law_StepDecreasesMeasure`), and the loop runs only while
the measure is positive, so it makes at most `MaxRefinementRounds` steps (theorem `LoopTerminates`).
At exit `IsTerminal` holds (`Law_LoopEndsTerminal`): nothing is pending, or the round limit is
reached. The loop also stops early at a fixed point of `G`: a step that changes no edge meshes no
face again, so it leaves nothing pending.

**At exit**, every chosen face without a mesh is diagnosed at the face (`FailureDiagnostics`):
`PIPELINE-FACE-UNRESOLVED` when it still holds a blocking request (face meshing put those findings
at the edges), `PIPELINE-FACE-EMPTY` when nothing located an error at the face. The rest is
assembled: `NumberMeshVertices` and `AssembleModelMesh` over the final face meshes, in face order.

## Options and defaults

`MeshingOptions { Face: FaceMeshingCriteria; Level: ConformanceLevel; MaxRefinementRounds: Integer; Decode: DecodePolicy; Quality: MeshQualityThresholds }`.
`DefaultMeshingOptions(chordal)` gives the research's recommended set
([../research/MESHING-REQUIREMENTS.md](../research/MESHING-REQUIREMENTS.md) 2.5 and section 8):

| Field | Default | Why |
|---|---|---|
| `Face.Discretization.Chordal` | the caller's `chordal`, model units | research 2.5: required from the caller; an absolute length is checkable and unit-safe |
| `Face.Discretization.Angular` | 15 degrees | research 2.5: ACIS 15, OpenCascade suggests 12 to 20, gmsh 0.3 rad; layer 4's `DefaultCriteria` |
| `Face.Discretization.MaxLength` | `Unlimited` | every kernel defaults it off |
| `Face.Discretization.MinLength` | `0.1 * chordal`, floored at the length tolerance by layer 4's `EffectiveMinLength` | research recommendation 5 (OpenCascade's `MinSize`): the stop rule that makes refinement terminate |
| `Face.Discretization.MinSegments` | 3 | layer 4's `DefaultCriteria`; layer 4 never goes below 3 on a closed edge |
| `Face.SurfaceChordal` | `chordal` | research 2.5, OpenCascade |
| `Face.SurfaceAngular` | 15 degrees | layer 5 defines it as the normal turn along an element edge, ACIS's `SPANORMALTOL`, whose default is 15 degrees |
| `Face.PreferQuads` | false | research 2.5: triangles are what every exchange format accepts |
| `Level` | `Geometric` | checks every promise the options make (layer 7: structure, every toleranced law, the criteria, quality thresholds); `Oracle` adds the independent oracles and the library self-tests, which test runs want and production runs can skip |
| `MaxRefinementRounds` | 5 | research 3.7 and recommendation 2: OpenCascade's bound; the early exit makes unused rounds free |
| `Decode` | `DecodePolicy.StandardPolicy` | layer 3's defaults (millimetre, radian, 1e-6 of the model size) |
| `Quality` | `MeshQualityThresholds.CubitAcceptable` | layer 6's "acceptable" thresholds; a missed threshold is Info, so it never changes `Ok` |

`IsWellFormed(o)` is layer 5's `IsWellFormed` on the face criteria (which includes layer 4's on the
edge criteria) and a round limit that is not negative. A run refuses other options with
`PIPELINE-OPTIONS-ILL-FORMED` instead of clamping them, since no criterion can be repaired without
guessing what the caller meant.

The research also recommends deriving the chordal bound from a fraction (0.001) of the model's
diagonal once per model. That needs the model size, which layer 3 computes and does not export;
see "What is left open".

## The diagnostics flow

```
ParsedFile.Diagnostics ----+
DecodedModel.Diagnostics --+-- Located(WholeInput) --+
                                                     |
RefusalDiagnostics | ModelDiagnostics ---------------+
FaceMeshOutcome.Diagnostics (final outcomes) --------+-- Merge -- Located(WholeInput) -- MeshOutcome.Report
FailureDiagnostics (faces without a mesh) -----------+                                   Ok = IsClean
Validated: ValidateBrep(level), ValidateModelMesh(t, quality, level), CrossCheck(level, criteria)
```

- **Every finding is located** (`Law_EveryDiagnosticIsLocated`, `Law_EveryStepTextDiagnosticIsLocated`).
  The pipeline's own findings carry `KernelEdge` or `KernelFace` where they are about one element.
  Findings about the input as a whole, and any finding a lower layer left at `Nowhere`, are located
  at layer 0's `Provenance.WholeInput`, by layer 0's `Located` (a constructor of `Report` that
  keeps every check, code, and severity: layer 0's `Law_LocatedKeepsVerdict`,
  `Law_LocatedKeepsFindings`).
- **Only final outcomes report.** A face meshed in several rounds reports its last outcome; the
  findings of earlier rounds were superseded by the refinement that answered them.
- **Ok is the verdict.** `MeshOutcomeOf` is the one place `Ok` is set, to `Report.IsClean`
  (`Law_OkExactlyWhenClean`). Any Error anywhere, parse, decode, pipeline, face, or validation,
  makes `Ok` false; the mesh is still returned with everything that meshed.
- **Tracing to the file.** `MeshStepTextTraced` returns the `DecodedModel` beside the outcome, so a
  `KernelFace(f)` finding, an element's `ElementFace`, or a vertex's provenance reaches its STEP
  instance and assembly occurrence through `Decoded.Map`. `MeshStepText` is the same without it.

The pipeline's own findings, all Errors because each means part of the model has no mesh:

| Code | Provenance | Measure | When |
|---|---|---|---|
| `PIPELINE-OPTIONS-ILL-FORMED` | whole input | the round limit | `IsWellFormed(o)` fails; nothing meshed |
| `PIPELINE-MODEL-NOT-INDEXED` | whole input | the face count | `Law_IndicesInRange(m)` fails; nothing meshed; the model's validation names the indices |
| `PIPELINE-NO-FACES` | whole input | 0 | the model has no face |
| `PIPELINE-EDGE-UNDISCRETIZED` | the edge | unmeasured | the edge is outside **E** |
| `PIPELINE-FACE-UNDISCRETIZED` | the face | 0 | the face is outside **F**(d) (layer 5's `UnmeshedOutcome`) |
| `PIPELINE-FACE-EXCLUDED` | the face | 0 | the face was left out of a `MeshChosenFaces` run |
| `PIPELINE-FACE-UNRESOLVED` | the face | rounds taken | a blocking request is still unanswered at exit |
| `PIPELINE-FACE-EMPTY` | the face | 0 | no mesh, and nothing else located an error at the face |

## Decisions

1. **`ParseOutcome` is not declared; layer 3's `ParsedFile` is the parse stage's outcome.** Layer
   3 proposed it and the fields are identical: one declaration of one shape.
2. **`DecodeOutcome` is not declared; layer 3's `DecodedModel` is the decode stage's outcome, with
   no `Ok`.** Decoding is total and an Error in it does not stop the run (a skipped instance leaves
   the rest of the model meshable), so a decode-level `Ok` would decide nothing. It would also be a
   stored flag that a function can compute (`Diagnostics.Any(IsError)`), which the root README
   rules out. The run's `Ok` carries the decode's errors (`Law_DecodeErrorMeansNotOk`).
3. **`MeshStepTextTraced` returns `StepMeshOutcome { Decoded; Meshed }`.** Kernel provenance means
   nothing to a caller without the provenance map, and the root README promises that a user can go
   from a finding to the entity in the file. `MeshStepText` keeps its fixed signature as a
   projection of it.
4. **`MeshModel` is total.** Outside **R** it returns a refused outcome whose mesh holds the model's
   vertices and no element, so the numbering laws of layer 6 still hold of it.
5. **An edge outside E keeps an empty entry** (layer 4's `Undiscretized`) instead of being dropped: edge
   indices stay stable, `NumberMeshVertices` gives it an empty run, and layer 5's
   `IsDiscretizedFace` keeps every face citing it out of `MeshFace`.
6. **Faces of changed edges are meshed again, not faces of requested edges.** A request `Refine`
   cannot answer (every segment at the length floor) changes nothing; meshing its faces again would
   give the same request every round and spend the whole round limit. With changed edges the loop
   stops at the fixed point.
7. **Every request is acted on, blocking or advisory.** Advisory requests (`TooCoarseInParameterSpace`,
   `QuadCountMismatch`) improve a valid mesh; the round limit and the early exit bound their cost.
8. **Counts are recorded as floors.** `Refine` takes counts from the requests of one round; the state
   accumulates them in `Floors` so that the final discretizations can be checked against every count
   ever asked for (`Law_FinalDiscretizationsMeetFloors`). Refinement never coarsens, so meeting the
   latest request keeps every earlier one met.
9. **The pipeline constructs the face-level finding itself.** Layer 5 promises that an empty mesh
   with no request carries an error, but locates blocking-request findings at the edges. Rather than
   rely on that, `FailureDiagnostics` adds an Error at the face whenever none is there
   (`Law_EmptyFaceIsDiagnosed`).
10. **Validation is the model, the mesh, and the two against each other, all at the options'
    level:** `m.ValidateBrep(o.Level)`, `mesh.ValidateModelMesh(m.Tolerances, o.Quality, o.Level)`
    (the model's tolerances, not the mesh's own resolution, so the mesh is judged by the file's
    promise), and `m.CrossCheck(mesh, o.Level, o.Face)` (with the criteria, so an Oracle run checks
    face areas and solid volumes within the envelopes the criteria imply). A refused run validates
    the model alone at the same level.
11. **Metamorphic laws state only what is exact.** Scaling by a power of two is exact in IEEE
    arithmetic and every comparison in the pipeline is between quantities of one dimension, so
    connectivity is identical and positions are scaled bit for bit (`Law_PowerOfTwoScalingKeepsConnectivity`,
    `Law_PowerOfTwoScalingScalesPositions`, theorem `PowerOfTwoScalingCommutes`), up or down: layer
    0's per-dimension parameter floors (fix wave) scale with the model or not at all. A general rigid motion or scale factor
    rounds every coordinate differently, and a decision that sits at a tie can flip: a square planar
    face has two equally Delaunay diagonals, and rotating it by an angle that is not a quarter turn
    changes which one the in-circle test picks. So "identical connectivity" under a general rigid
    motion is false for the simplest witness and is not stated as a law. What is stated is that
    when the connectivity agrees, every position is the moved position within the length tolerance
    (`Law_RigidMotionMovesPositions`). Edge reversal and face reversal are exact by construction
    (`Law_EdgeReversalPreservesMesh`; `Law_ShellReversalNegatesVolume`, within the length tolerance
    times the area for the volume sums).
12. **Tightening the chordal criterion bounds the deviation; it does not make the realized maximum
    monotone.** The realized maximum is not monotone even under nested refinement: on the curve
    `y = h sin(2 pi x)` over one period, the whole span's chord lies on the axis and the sagitta is
    `h`, but the sub-span from `x = 0` to `x = 3/4` has the chord from `(0, 0)` to `(3/4, -h)`, from
    which the crest `(1/4, h)` lies about `1.33 h` away. A looser run can also be lucky and land below
    its bound. What holds is `Law_TighterChordalStaysWithinLooserBound`: wherever the criteria govern
    the mesh, its deviation under the tighter bound never exceeds the looser bound plus the length
    tolerance. Research 6.3 reaches the same conclusion for areas.
13. **Failure isolation is stated for a face that asks for nothing.** A face with a blocking request
    does reach its neighbours, by design: the edges it shares are refined and the neighbours are
    meshed again. Theorem `FailureIsIsolated` and `Law_FailedFaceLeavesOthersUnchanged` cover a
    failed face that issued no request (a poly loop, an undiscretizable edge, a region that synthetic
    segments make non-simple); `Law_OnlyFacesOfChangedEdgesAreRemeshed` and `Law_OutcomesAreCurrent`
    bound the reach of one that did.

## Laws

Kinds as in [../research/VALIDATION-MATH.md](../research/VALIDATION-MATH.md) section 8: "library"
laws test the pipeline's code and a failure is a defect, reported as an Error; "convention" laws
hold for states built by `InitialState` and `Step`. Every law takes a `BrepModel`, a
`MeshingOptions`, a `PipelineState`, or a `String`, so the pseudorandom runner skips them
(PLATO-PRIMER.md B.2); they run over layer 7's witnesses with `Witness_UnitScaleOptions`, over the
hand-written texts of "Implementation order", and over the corpus.

| Law | Statement | Tolerance | Kind |
|---|---|---|---|
| `Law_MeshModelIsDeterministic` | meshing a model twice gives the same outcome, bit for bit | exact | library |
| `Law_MeshStepTextIsDeterministic` | meshing a text twice gives the same outcome, bit for bit | exact | library |
| `Law_OkExactlyWhenClean` | `Ok` exactly when the report is clean | exact | library |
| `Law_StepTextOkExactlyWhenClean` | the same for a text | exact | library |
| `Law_RoundsWithinLimit` | `Rounds <= MaxRefinementRounds`, and 0 for refused options | exact | library |
| `Law_ParseErrorMeansNotOk` | a parse Error makes `Ok` false | exact | library |
| `Law_DecodeErrorMeansNotOk` | a decode Error makes `Ok` false | exact | library |
| `Law_NoFacesMeansNoMesh` | a text decoding to no face gives no element | exact | library |
| `Law_NoFacesMeansNotOk` | a text decoding to no face gives `Ok` false | exact | library |
| `Law_EveryDiagnosticIsLocated` | no finding of a model's outcome is at `Nowhere` | exact | library |
| `Law_EveryStepTextDiagnosticIsLocated` | the same for a text, parse and decode findings included | exact | library |
| `Law_UndiscretizableEdgeIsDiagnosed` | an edge outside **E** has an Error at the edge | exact | library |
| `Law_EmptyFaceIsDiagnosed` | a face without a mesh has an Error at the face | exact | library |
| `Law_LoopEndsTerminal` | the loop stops with nothing pending or at the round limit | exact | library |
| `Law_StepDecreasesMeasure` | a step from a non-terminal state raises `Round` by one | exact | library |
| `Law_MeasureIsNeverNegative` | no state passes the round limit | exact | library |
| `Law_RefinementNeverCoarsens` | every parameter before a step is a parameter after it | exact by construction | library |
| `Law_OnlyFacesOfChangedEdgesAreRemeshed` | a face whose edges a step leaves unchanged keeps its outcome bit for bit | exact | library |
| `Law_OutcomesAreCurrent` | every outcome is `FaceOutcome` under the state's discretizations | exact | library |
| `Law_RequestsNameEdgesOfTheirFace` | every request of a face names an edge the face cites | exact | library |
| `Law_FinalDiscretizationsMeetFloors` | every discretized edge meets the accumulated and structural floors | exact | library |
| `Law_PendingRequestsAreRefinable` | every state meets `Refine`'s precondition over its pending requests | exact | library |
| `Law_OutcomeIsOfItsFace` | outcome k is face k's | exact | convention |
| `Law_PendingRequestIsInSomeOutcome` | every pending request is some outcome's | exact | convention |
| `Law_EmptyDiscretizationExactlyWhenEdgeUnusable` | an entry is empty exactly for an edge outside **E** | exact | library |
| `Law_FailedFaceLeavesOthersUnchanged` | a failed face that asked for nothing leaves every other face's mesh as in the run without it | exact | library |
| `Law_ClosedWhenEveryShellClosedAndNoFaceEmpty` | closed shells and no empty face give a closed mesh | exact | library |
| `Law_OrientedWhenEveryShellClosedAndNoFaceEmpty` | the same hypotheses give a consistently oriented mesh | exact | library |
| `Law_RigidMotionMovesPositions` | when connectivity agrees, a moved model's vertex is the moved vertex | `LengthTolerance` | library |
| `Law_PowerOfTwoScalingKeepsConnectivity` | scaling by `2^k`, `|k| <= 64`, keeps connectivity | exact | library |
| `Law_PowerOfTwoScalingScalesPositions` | scaling by `2^k` scales every position exactly | exact (IEEE) | library |
| `Law_EdgeReversalPreservesMesh` | reversing an edge gives the same mesh bit for bit | exact | library |
| `Law_ShellReversalNegatesVolume` | reversing every face negates the signed volume | `LengthTolerance` times the area | library |
| `Law_TighterChordalStaysWithinLooserBound` | a tighter chordal bound's governed deviation is within the looser bound | `LengthTolerance` | library |
| `Law_ValidationIsIdempotent` | `Validated` twice gives identical reports | exact | library |

The requested laws map to these as follows. Determinism: the first two, over witnesses, since the
runner cannot build their inputs. Failure isolation: `Law_FailedFaceLeavesOthersUnchanged`, with
theorem `FailureIsIsolated`. Termination: `Law_LoopEndsTerminal`, `Law_StepDecreasesMeasure`,
`Law_MeasureIsNeverNegative`, theorem `LoopTerminates`. Monotone refinement:
`Law_RefinementNeverCoarsens`. Local re-meshing: `Law_OnlyFacesOfChangedEdgesAreRemeshed`. Closed
mesh: `Law_ClosedWhenEveryShellClosedAndNoFaceEmpty`, theorem `WatertightByConstruction`. Rigid
motion and scaling: decision 11. Tighter chordal: decision 12. Idempotent validation:
`Law_ValidationIsIdempotent`. `Ok`: `Law_OkExactlyWhenClean`. Provenance:
`Law_EveryDiagnosticIsLocated`. Rounds: `Law_RoundsWithinLimit`.

## Theorems

| Theorem | Claim | Tested by |
|---|---|---|
| `WatertightByConstruction` | under layer 2's closed-shell laws, layer 4's sharing law, layer 5's boundary and identification laws, and layer 6's `CanAssemble`, with no face left empty, the mesh is closed | `Law_ClosedWhenEveryShellClosedAndNoFaceEmpty`, layer 6's `Law_AssembledSharedBoundaryCornersCoincide` and `Law_SharedBoundarySampleHasOneGlobalVertex`, layer 4's `Law_OppositeUsesSeeReversedPoints`, layer 5's `Law_SharedPositionIsCopied` and `Law_LoopToUvCountMatchesDiscretization` |
| `LoopTerminates` | the loop ends in at most `MaxRefinementRounds` steps, terminal | `Law_LoopEndsTerminal`, `Law_StepDecreasesMeasure`, `Law_MeasureIsNeverNegative` |
| `FailureIsIsolated` | a face whose edges were never refined and which holds no request leaves every other face as in the run without it | `Law_FailedFaceLeavesOthersUnchanged`, `Law_OnlyFacesOfChangedEdgesAreRemeshed`, `Law_OutcomesAreCurrent`, `Law_RequestsNameEdgesOfTheirFace`, `Law_RefinementNeverCoarsens` |
| `OkMeansCleanAtTheLevel` | `Ok` means no Error in the parse, the decode, the meshing, or the validation at the level | `Law_StepTextOkExactlyWhenClean`, `Law_ParseErrorMeansNotOk`, `Law_DecodeErrorMeansNotOk`, `Law_OkExactlyWhenClean`, layer 0's `Law_MergeIsCleanExactlyWhenBothClean` |
| `PowerOfTwoScalingCommutes` | scaling by `2^k`, up or down, gives identical connectivity | the two scaling laws |

`WatertightByConstruction` restates the root README's theorem with the actual law names. One of
its steps rests on layer 5's conjecture `ElementsTileRegion` (every interior parameter-space segment
of a face mesh has exactly two elements); the theorem has that conjecture's status until layer 5
proves it.

## What is left open

1. **A relative chordal default.** Research 2.5 recommends 0.001 of the model's diagonal. Layer 3
   computes the model size for its tolerance default and does not export it; with a `ModelSize`
   field in `DecodedModel`, a `RelativeMeshingOptions(fraction)` resolved once per model would
   follow.
2. **A witness with a planted bad face** for `Law_FailedFaceLeavesOthersUnchanged`: layer 7's unit
   box with its top face bounded by a poly loop, which layer 5 does not mesh in version 1. Without
   it the law runs vacuously on clean witnesses.
3. **Assemblies are meshed per placed copy.** Layer 3 decodes every occurrence. An instancing table
   (one mesh per part, placements beside it) would need a field in `DecodedModel`, `MeshOutcome`,
   and `ModelMesh`; the owner decides when an assembly's cost matters.
4. **Levels for `ValidateBrep` and `ValidateModelMesh`.** Settled in the fix wave: layer 7 gave
   both a level, and `Validated` passes `o.Level` to all three.
5. **Connectivity under general rigid motions and unit changes** (decision 11) is a harness check,
   not a law: run the witnesses moved by a few generic frames and report any mismatch as Info with
   the decision that flipped.
6. **Request priority.** Blocking and advisory requests are answered together. If advisory requests
   ever use up rounds a blocking one needed, blocking requests could be answered first.
7. **Two catalogue laws are not written**: `Law_RenumberingPermutesMesh` needs a function that
   permutes the instances of a Part 21 file, and `Law_FaceSplitPreservesAreaVolumeEuler` needs
   witness pairs from layer 7 (research/VALIDATION-MATH.md section 8).
8. **The pipeline's codes are functions, not a closed sum.** Layer 3 keeps its codes in one sum with
   one table (`StepDiagnosticCode`, `Diagnose`); eight codes did not seem to need it.

## Corrections to research/VALIDATION-MATH.md

The research file is kept as written; these two corrections hold for this design and its laws.

1. **Section 6.4, first row: a rotation in the cube group is not exact.** The row calls it a law
   on the ground that no pipeline decision depends on world axis directions. That is true of the
   decisions, not of their arithmetic. Every dot product, cross product, and frame evaluation sums
   three products in a fixed order (x, then y, then z). A cube rotation permutes the axes, so the
   same three products are summed in another order, which rounds differently: in 64 bits,
   `(1e16 + 1) - 1e16` is 0 while `(1e16 - 1e16) + 1` is 1. A decision at a tie (two equally
   Delaunay diagonals of a square, two equal sagittas competing for a split) can then go the other
   way. So the cube rotation belongs with the general rigid motion in the "witnesses only" rows:
   connectivity compared by a harness, positions within `epsL` (`Law_RigidMotionMovesPositions`).
   `Law_CubeRotationCommutes` is not adopted (contract table below).
2. **Section 6.3, "Monotonicity of realized quantities ... holds only for nested refinement",
   which the catalogue's monotone relations rest on: the realized deviation is not monotone even
   under nested refinement.** On `y = h sin(2 pi x)` over one period the whole span's chord lies on
   the axis with sagitta `h`; the nested sub-span from `x = 0` to `x = 3/4` has the chord from
   `(0, 0)` to `(3/4, -h)`, from which the crest `(1/4, h)` lies about `1.33 h` away. Refining
   raised the realized maximum. What holds is the bound, which 6.3's first bullet states: a mesh
   made at `d' <= d` satisfies `d` wherever the criteria govern it
   (`Law_TighterChordalStaysWithinLooserBound`, decision 12). Inscribed length stays monotone under
   nesting, as 6.3 says.

## Implementation notes

- **Cost.** Round 0 discretizes every edge and meshes every face. Each later round refines only the
  requested edges and meshes only the faces of changed edges, so a run costs at most
  `MaxRefinementRounds + 1` full meshings and usually little more than one. Edges are independent in
  `DiscretizeAll`, faces are independent within a round, and both parallelize without
  coordination as long as results are written by index (determinism).
- **Quadratic reference bodies.** `FacesTouching` calls `FaceEdges` per face and `ChangedEdges`
  compares whole arrays. An implementation builds the edge-to-face table once, and can detect a
  change by the parameter count alone, since refinement only adds parameters (I5).
- **The laws over rounds** call `StateAfter(k)` and `StateAfter(k + 1)` from scratch, quadratic in
  the round count; fine for witnesses, and a harness can keep the states of one run instead.
- **Determinism** means no output order from a hash set, and no floating-point reduction whose order
  depends on a thread schedule. `Law_MeshModelIsDeterministic` is the test.
- **The deferred functions** `RigidlyMoved` and `ScaledBy` on a model are needed only by the
  metamorphic laws. A bodiless function compiles to a `NotImplementedException` stub in C#
  (PLATO-PRIMER.md D.7), so they can wait for the corpus chunk.
- **64-bit `Number`** is assumed, as in every layer. The power-of-two laws hold in 32 bits too.

## Implementation order

Chunks seen from the pipeline. Each runs the whole pipeline end to end on one input and makes the
listed laws pass, in addition to the laws of every lower layer the chunk reaches. Shapes are added
in the order of research recommendation 23 and layer 5's implementation notes, each adding one
difficulty.

### Chunk 1: a hand-written STEP box through the whole pipeline

Input: a unit cube written by hand as AP214 text: 8 `cartesian_point`s and `vertex_point`s, 12
`line`s and `edge_curve`s, 6 `plane`s with `axis2_placement_3d`s, 6 `advanced_face`s with
`face_outer_bound`s over `edge_loop`s of `oriented_edge`s, one `closed_shell`, one
`manifold_solid_brep`, one `advanced_brep_shape_representation` with a
`geometric_representation_context` stating millimetres, radians, and an uncertainty of 1e-6. Two
variants of the text: one truncated mid-instance (a parse Error), and one with no shape
representation (no face). Expected result: 8 vertices, 12 triangles, Euler characteristic 2, closed,
consistently oriented, signed volume 1, `Rounds` 0, `Ok` true.

Functions that need bodies, by layer (every other function the run reaches has one already):

| Layer | Functions |
|---|---|
| 0 | none deferred |
| 1 | none deferred: the `Line` and `Plane` arms of evaluation, derivatives, `ClosestParameter`, and `Project` are closed forms with bodies |
| 2 | `IsDegenerateEdge` (the fast path: the two vertices are farther apart than twice the length tolerance), `NormalAgreesWithParameterization` (true for every plane), and for validation `ReducedCounts`, `LinkComponentCount` |
| 3 | the host's C# parser behind `ParseStep`, which the host's own tests check against layer 3's parse-print-parse and reference laws; in Plato, `InstancePosition`, `DecodeBrepWith`, `ClassificationDiagnostics`, `ResolveContexts`, `FindOccurrences` (one root occurrence), `FlatRecord`, `SlotOf`, `ConformsTo`, and `KernelOf` for the decode laws |
| 4 | `EdgeSeeds`, `TotalTurning` (0 on a line), `IsDegenerateEdge`, `ImagePoints` (projection onto a plane), `Discretize` (a line is one segment unless floors ask for more) |
| 5 | `Unwrap` (the identity on a plane), `AddMissingSeamsAndPoles` (nothing to add), `MeanSpeed`, `TriangulateRegion`, `RefineToSurface` (no point on a plane), `Lift` |
| 6 | `AssembleModelMesh`, `EdgeTableOf`, `ComponentsOf`, `ComponentCountsOf`, `IsPinchedVertex`, `CoincidentVertexPairs` |
| 7 | `ValidateBrep`, `ValidateModelMesh`, `CrossCheck` at `Structural` and `Geometric`, and the planar-face area oracle at `Oracle` |
| 8 | none deferred; `ScaledBy` on a model for the two scaling laws, or those laws wait for chunk 6 |

Laws that must pass: `Law_MeshModelIsDeterministic`, `Law_MeshStepTextIsDeterministic`,
`Law_OkExactlyWhenClean`, `Law_StepTextOkExactlyWhenClean`, `Law_RoundsWithinLimit`,
`Law_EveryDiagnosticIsLocated`, `Law_EveryStepTextDiagnosticIsLocated`, `Law_LoopEndsTerminal`,
`Law_MeasureIsNeverNegative`, `Law_OutcomeIsOfItsFace`, `Law_OutcomesAreCurrent`,
`Law_EmptyDiscretizationExactlyWhenEdgeUnusable`, `Law_FinalDiscretizationsMeetFloors`,
`Law_ClosedWhenEveryShellClosedAndNoFaceEmpty`, `Law_OrientedWhenEveryShellClosedAndNoFaceEmpty`,
`Law_EdgeReversalPreservesMesh` on each of the 12 edges, `Law_ShellReversalNegatesVolume`,
`Law_ValidationIsIdempotent`, `Law_ParseErrorMeansNotOk` (truncated text),
`Law_NoFacesMeansNoMesh` and `Law_NoFacesMeansNotOk` (text without a shape),
`Law_DecodeErrorMeansNotOk`; and, with a second witness whose top face is a poly loop,
`Law_EmptyFaceIsDiagnosed` and `Law_FailedFaceLeavesOthersUnchanged`.

### Chunk 2: a cylinder (one seam)

A cylinder of radius 10 and height 20 with its seam edge, then the band variant without a seam (two
circles only), then the same with `PreferQuads` true. New: circles and the closed-form arc counts,
closed edges (at least 3 segments), seams and the synthetic seam cut, anisotropy, refinement against
the surface, structured quads and `QuadCountMismatch` requests, so the loop takes its first rounds.
Layer 1: the `Circle` and `Cylinder` arms. Layer 4: `RefineEdge`. Layer 5: `QuadSidesOf`, `QuadGrid`,
`MatchingFloors`. Laws added: `Law_StepDecreasesMeasure`, `Law_RefinementNeverCoarsens`,
`Law_OnlyFacesOfChangedEdgesAreRemeshed`, `Law_RequestsNameEdgesOfTheirFace`,
`Law_PendingRequestIsInSomeOutcome`, `Law_TighterChordalStaysWithinLooserBound` at three chordal
bounds.

### Chunk 3: a sphere (two poles)

A sphere with a seam from pole to pole, then with vertex loops at the poles, then with degenerate
pole edges. New: collapsed lines, pole segments, dropped triangles, degenerate edges of one segment,
reduced Euler counts. Layer 1: `LimitNormal`. Laws: every law of chunks 1 and 2 again, with
`Law_ClosedWhenEveryShellClosedAndNoFaceEmpty` the one most likely to fail at a pole.

### Chunk 4: a torus (two seams)

A torus with a meridian and a parallel through one vertex, then a whole torus bounded by one vertex
loop. New: two periodic directions, a whole-period region that needs two seam cuts. Laws: as chunk 3;
the expected Euler characteristic is 0.

### Chunk 5: a B-spline face

A box with one face replaced by a bicubic B-spline patch with interior knots, written without
pcurves. New: knot seeds, control-hull sagitta, search-based inverse evaluation, and the first
`LoopSelfIntersects` requests, so blocking requests are answered by the loop. Layer 1:
`BSplinePoint`, `BSplineDerivative`, `BSplinePartial`, `ClosestParameterBySearch`, `ProjectBySearch`,
`ProjectNearBySearch`. Layer 4: `Sagitta`. Laws: every law above, plus a variant with
`MaxRefinementRounds` 0 whose blocking face must give `PIPELINE-FACE-UNRESOLVED`
(`Law_EmptyFaceIsDiagnosed`) while every other face meshes (`Law_FailedFaceLeavesOthersUnchanged`
does not apply, since the face asked for refinement; `Law_OnlyFacesOfChangedEdgesAreRemeshed` does).

### Chunk 6: the corpus

The files of layer 3's "Test files" list, the u-blox models already on this machine first. New:
assemblies, degree units, short names, surfaces of revolution, defective files. Layer 8:
`RigidlyMoved` and `ScaledBy` on a model, for `Law_RigidMotionMovesPositions`,
`Law_PowerOfTwoScalingKeepsConnectivity`, `Law_PowerOfTwoScalingScalesPositions` over every file.
Every law of this layer runs on every file; the expected numbers are the published counts where
they exist.

## Findings in lower layers

Recorded here, not fixed there.

1. **Duplicate declarations with identical signatures.** `IsClosedEdge` and `IsDegenerateEdge` are
   declared by layer 2 and again by layer 4 (with `// belongs-in: 02-topology`); `PcurvesOf(g, c)`
   and `Eval(g, c: Curve2DIndex, t)` by layer 1 (with bodies) and layer 4 (bodiless, `belongs-in:
   01-geometry`); `IntegerTotal` by layer 3 and layer 6. The gate accepts a tie with equal return
   types, so which copy a call binds to is not stated, and a bodied and a bodiless copy can differ.
   The layer 4 copies and one `IntegerTotal` should go.
2. **Layer 4's `Refine` asked too much of entries it never reads, and `DiscretizeAll` had no guard.**
   Fixed in the fix wave: `IsRefinable(m, d, requests, c)` asks only of requested entries, and
   `DiscretizeAll` is total with `Undiscretized` entries.
3. **Definitions the pipeline needs live in laws libraries.** `SameDiscretization` (layer 4,
   `EdgeDiscretizingLaws`) decides which edges a step changed, and `IsDiscretizedFace` (layer 5,
   `FaceMeshingLaws`) is `MeshFace`'s precondition, which the pipeline evaluates. Both belong in their
   layers' main libraries.
4. **Layer 5's contract does not state two properties the loop rests on.** That every request in
   `MeshFace`'s outcome names an edge the face cites (here `Law_RequestsNameEdgesOfTheirFace`), and
   that `MeshFace(m, f, d, c)` reads only the entries of `d` for the edges `f` cites (here
   `Law_OutcomesAreCurrent`). Both should be `ensures` of `MeshFace`.
5. **Findings without provenance.** `Provenance` has no case for the input as a whole, so findings
   such as layer 3's `NotPart21File` have nowhere honest to point; layer 5's `NoDiagnostics` builds
   `Nowhere` sentinels (harmless, in empty arrays). Layer 0 should add a case (for example
   `WholeInput`) and admit a `Located` constructor of `Report`, which this layer declares with
   `// belongs-in: 00-foundation`. Layers 3 and 7 should say which of their findings are about the
   whole input.
6. **Layer 0's parameter floor mixed dimensions.** Fixed in the fix wave: `Tolerances` holds
   `LengthParameter` and `AngleParameter`, so meshing commutes with scaling by `2^k` in both
   directions (theorem `PowerOfTwoScalingCommutes`).
7. **Research 6.4 overstates two metamorphic relations.** The correction is the note
   "Corrections to research/VALIDATION-MATH.md" below; the research file stays as written.
8. **Layer 3 does not export the model size** it computes for the tolerance default, which a
   relative chordal default needs ("What is left open", item 1).
9. **The type checker accepted `Integer >= Number`** in a negative control on this layer's files
   (`o.MaxRefinementRounds >= 0.5`); it caught a wrong constructor argument in the same run. Mixed
   comparisons need reading; PLATO-PRIMER.md D.13 lists what the front end misses and should add
   this.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `DiscretizeUsable(m, c)`, `Undiscretized(e)` (fix wave) | deleted; layer 4's `DiscretizeAll(m, c, NoFloors)` and `Undiscretized(e)` | `DiscretizeAll` now takes the usability guard itself |
| `SameConnectivity(ModelMesh, ModelMesh)` (fix wave) | deleted; layer 6's, which compares numberings as this layer's did | one declaration, in the mesh layer |
| `ParseOutcome { Ok; File; Diagnostics }` | not declared; layer 3's `ParsedFile` | identical fields; layer 3's proposal accepted (decision 1) |
| `DecodeOutcome { Ok; Model; Map; Diagnostics }` | not declared; layer 3's `DecodedModel` | decoding is total and does not stop the run; a stored `Ok` would be a computable flag (decision 2) |
| `MeshingOptions { Face; Level; MaxRefinementRounds }` | adds `Decode: DecodePolicy` | the decode defaults pass through to `DecodeBrepWith` |
| `MeshingOptions { Face; Level; MaxRefinementRounds; Decode }` (fix wave) | adds `Quality: MeshQualityThresholds` | the thresholds `ValidateModelMesh` reports against are the caller's choice, default `CubitAcceptable` |
| `Validated(m, mesh, level)` (fix wave) | `Validated(m, mesh, o: MeshingOptions)`: `ValidateBrep(o.Level)`, `ValidateModelMesh(m.Tolerances, o.Quality, o.Level)`, `CrossCheck(mesh, o.Level, o.Face)` | layer 7's finding 8: every part at the level, the model's tolerances, the criteria for the area and volume envelopes |
| `Law_CrossCheckIsIdempotent(m, mesh, level)` (fix wave) | `Law_ValidationIsIdempotent(m, mesh, o)` | idempotence of what the pipeline actually runs |
| `MeshOutcome { Ok; Mesh; Report; Rounds }` | unchanged; `Ok` is `Report.IsClean`, set only by `MeshOutcomeOf` | |
| `MeshStepText(text, options): MeshOutcome` | unchanged, now the projection of `MeshStepTextTraced(text, options): StepMeshOutcome { Decoded; Meshed }` | tracing kernel provenance to the file needs the map (decision 3) |
| `MeshModel(m, o)` | unchanged, now `MeshChosenFaces(m, o, AllFaces(m))` | the failure isolation law compares two choices of faces |
| (new) | `PipelineState`, `InitialState`, `Step`, `StateAfter`, `FinalState`, `IsTerminal`, `FaceOutcome`, `ChangedEdges`, `RaisedFloors`, `FacesTouching`, `RequestsOf`, `IsRunnable`, `RefusedOutcome`, `RunOutcome`, `MeshOutcomeOf`, `Validated`, `DefaultMeshingOptions`, `IsWellFormed(MeshingOptions)`, `WithChordal(MeshingOptions)`, `ChordalBound`, `ScaledBy(MeshingOptions)` | the loop as an explicit state and step, and the options' defaults |
| (new, `belongs-in: 00-foundation`) | `WholeInput(_: Provenance)`, `Located(Diagnostic, Provenance)`, `Located(Report, Provenance)`; `Located` joins `Empty`, `Merge`, `ReportOf` as a constructor of `Report` | every finding located (finding 5) |
| `WholeInput(_: Provenance)`, `Located(Diagnostic, Provenance)`, `Located(Report, Provenance)` and its spec (fix wave) | deleted; layer 0's `Provenance.WholeInput` case and `Located` | layer 0 took them; `#0` is no longer a sentinel |
| (new, `belongs-in: 02-topology`) | `RigidlyMoved(m, motion: Frame3D)`, `ScaledBy(m, factor)` (both deferred), `WithEveryFaceReversed(m)` | the metamorphic laws; the arena parts belong in 01-geometry |
| (new, `belongs-in: 04-discretization`) | `ScaledBy(DiscretizationCriteria, factor)`, `ScaledBy(Limit, factor)` | scaling the criteria with the model |
| (new, `belongs-in: 05-face-meshing`) | `ScaledBy(FaceMeshingCriteria, factor)` | as above |
| (requested of layer 5) | `ensures` on `MeshFace`: requests name the face's own edges; the outcome reads only the face's edges' discretizations | finding 4 |
| (requested of layer 7) | a witness with one planted bad face; say whether `ValidateBrep` and `ValidateModelMesh` take a level; never leave a finding at `Nowhere` | "What is left open", items 2 and 4; finding 5 |
| (research catalogue) | `Law_MeshingIsDeterministic` is `Law_MeshModelIsDeterministic` and `Law_MeshStepTextIsDeterministic`; `Law_PowerOfTwoScalingCommutes` is `Law_PowerOfTwoScalingKeepsConnectivity` and `Law_PowerOfTwoScalingScalesPositions`; `Law_RigidMotionCommutesWithinTolerance` is `Law_RigidMotionMovesPositions`; `Law_EdgeReversalPreservesMesh` and `Law_ShellReversalNegatesVolume` kept; `Law_CubeRotationCommutes` not adopted (finding 7); `Law_RenumberingPermutesMesh`, `Law_FaceSplitPreservesAreaVolumeEuler` not written (left open, item 7) | one statement per law; only exact relations as laws |

## Gate

Run 2026-10-17 with the PLATO-PRIMER.md E.3 driver, built from a copy of `tools/PlatoGate/` in the
scratch folder, over copies of layers 00 to 06 and this folder, the three stdlib `brep.*.plato` files
excluded.

- **With a stub of layer 7's four fixed names** (`ConformanceLevel` with its three cases,
  `ValidateBrep`, `ValidateModelMesh`, `CrossCheck`, signatures as in VOCABULARY.md): `PASS: 0
  error(s) in scope; 5426 functions type-checked`. The only findings in this folder are two LINT003
  Info notes on `StepMeshOutcome`'s fields, which are read through a chained call the linter does
  not follow.
- **Without the stub**: resolution stops on exactly those four names and `ConformanceLevel`'s cases,
  as expected while layer 7 is being written.
- **With layer 7's folder as it stood at the end of this pass** (its `ConformanceLevel` declared,
  the three validation functions not yet) and a stub of only `ValidateBrep`, `ValidateModelMesh`,
  `CrossCheck`, over layers 00 to 08: `PASS: 0 error(s) in scope; 5840 functions type-checked`,
  this folder's findings the same two Info notes.
- **Negative control**: a wrong argument type injected into `WholeInput` failed with CHK201, so the
  driver type-checks these files. The same control showed the checker accepting an `Integer >=
  Number` comparison (finding 9).

## Fix wave, 2026-10-17

Findings applied, one commit each, under `reviews/FIX-WAVE.md`:

1. **`Validated` as layer 7 proposes** (layer 7 README, "Findings in lower layers", item 8):
   `ValidateBrep(o.Level)`, `ValidateModelMesh(m.Tolerances, o.Quality, o.Level)`,
   `CrossCheck(mesh, o.Level, o.Face)`; `Validated` takes the options; `MeshingOptions` gains
   `Quality`; `Law_CrossCheckIsIdempotent` becomes `Law_ValidationIsIdempotent` over `Validated`.
2. **The note correcting research 6.4** (finding 7 of "Findings in lower layers"): section
   "Corrections to research/VALIDATION-MATH.md". The research file is outside this layer's fence
   and is not edited; a pointer from it to the note is the supervisor's to add.
3. **The host-parser decision** in the pipeline description: `ParseStep` is a host obligation,
   `Part21File` the boundary, and the first chunk's parser is C#; the implementation order's layer 3
   row says so.
4. **`DiscretizeUsable` dropped** (finding 2, second half): `InitialState` calls layer 4's
   `DiscretizeAll`, which now takes the usability guard; this layer's `Undiscretized` is deleted in
   favour of layer 4's.
5. **Provenance stand-ins deleted** (finding 5): `WholeInput` is layer 0's `Provenance` case, and
   `Located` on a diagnostic and on a report is layer 0's, with its contract; the `#0` sentinel is
   gone.
6. **Per-dimension parameter floors** (finding 6): the scaling laws and theorem drop the `k >= 0`
   and `Length >= Parameter` hypotheses and hold for `|k| <= 64`; `ScaledBy(m)`'s contract scales
   `LengthParameter` and keeps `AngleParameter`.
7. **`Step`'s preconditions simplified** (finding 2, first half): `Step` requires layer 4's
   `IsRefinable` over its pending requests, which subsumes the coverage requirement; `InitialState`
   and `Step` ensure it of their result; new invariant I7, `Law_PendingRequestsAreRefinable`.
8. **`SameConnectivity` deleted**: layer 6 declares it with this layer's meaning (numberings
   compared).
