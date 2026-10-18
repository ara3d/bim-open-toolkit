# Implementation order

Written 2026-10-17 by the supervising session of TKT-299 (the STEP B-rep to mesh design), from
layer 8's "Implementation order" and layer 7's witness table, under the owner's instruction of the
same day: move quickly, let no test depend on more than it must, develop and test from first
principles, and modularize as far as that requires. A separate session is writing the C# STEP
reader (`docs/plans/step-reader.md`, TKT-301 to TKT-307); this file names the one type where the
two meet and keeps every other chunk independent of it.

## Rules every chunk follows

1. **A chunk's tests read only the layers below it.** Layer k's laws run on values built by
   layer k's own witnesses or by the witnesses of layer 7, never on a file read from disk, until
   the end-to-end chunk at the very end.
2. **Witnesses before files.** Every shape enters as a `BrepModel` literal (layer 7's
   `Witness_*`) before it enters as STEP text. The literal has known counts, areas and volumes,
   so a failing law names the defect; a file only says "different".
3. **The parser is a host module with the boundary `Part21File`** (`03-step/step-part21.types.plato`).
   Decode tests build `Part21File` values in Plato by hand (`Witness_Part21*`, chunk D below);
   the parser's own tests, in C#, run layer 3's file laws over text fixtures. The two meet once,
   in chunk E, through an adapter.
4. **Oracles, not kernels.** No OpenCascade in library or tests (owner, 2026-10-17). A measure is
   checked against a closed form, a Green's-theorem or divergence-theorem integral, Euler-Poincare,
   Gauss-Bonnet, or re-evaluation from provenance (`07-validation/README.md`).
5. **One commit per law group.** A chunk lands as several commits, each making a named set of
   laws pass; the commit message lists them and carries `Ticket: TKT-299` until implementation
   gets its own ticket.

## Test modules and what each depends on

| Module | Runs the laws of | On values from | Needs the parser | Needs layers |
|---|---|---|---|---|
| M0 foundation | `00-foundation` | literal tolerances, ranges, periodic domains | no | 0 |
| M1 geometry | `01-geometry` | literal curves and surfaces in layer 1's laws file | no | 0, 1 |
| M2 topology | `02-topology` | layer 7's ten positive and three negative `BrepModel` witnesses | no | 0 to 2, 7's witness file only |
| M3 decode | `03-step` decode, schema, units, WHERE laws | hand-built `Part21File` values (chunk D) | no | 0 to 3 |
| M4 discretization | `04-discretization` | witness edges: line, circle, B-spline | no | 0 to 4 |
| M5 face meshing | `05-face-meshing` | witness faces: plane, cylinder band, sphere, torus, cone, B-spline patch | no | 0 to 5 |
| M6 mesh | `06-mesh` | meshes assembled from M5 outputs; literal meshes (`Witness_UnitTetrahedron`, `Witness_UnitSquare`, `Witness_DartQuad`) | no | 0 to 6 |
| M7 oracles and cross-checks | `07-validation` | witnesses meshed through layer 8's `MeshModel` | no | 0 to 8, witnesses only |
| MP parser and adapter (C#) | layer 3's file laws: `Law_ParseOkIffNoError`, `Law_ReferencesResolve`, `Law_HeaderNamesASchema`, `Law_ChildrenPrecedeParent`, the `Part21File` invariants of `step.spec.plato`; `Law_ParsePrintParseIsIdentity` once a printer exists | text fixtures: a hand-written unit cube, the same truncated, the same without a shape representation, one complex instance, one assembly | is the parser | 0, 3's types |
| ME end to end | `08-pipeline` over `MeshStepText` | text fixtures, then the corpus of `03-step/README.md` "Test files" | yes | all |
| M9 tooling | `09-tooling`: the diff laws (each diff is its equality), the generator laws, and the law runner itself | layer 7's witnesses, generated samples (`DefaultFamilyAt`, seed, index), perturbations | no (the corpus loader needs TKT-312) | 0 to 9 |

M0 to M7 can be built and tested with no parser at all. MP can be built against the type
declarations alone. ME is the only place the two meet.

## Development mode

The owner's philosophy, stated 2026-10-17: specifications and laws drive development, and the aim
is a high likelihood of working out of the box. In practice:

- **Laws before bodies.** The law runner over the witnesses (TKT-316's first deliverable) exists
  before the first body, so every body is written against laws that already run and fail.
- **Bodies from contracts, in Plato.** A body is derived from its `spec` contract and the laws
  that name it. The layer README records, per body, which contract and laws it came from.
- **Existing code is an oracle, not a body.** The Ara 3D SDK's routines (Delaunay, earcut,
  welding, half-edge topology) are second implementations the laws compare against, declared as
  host obligations with contracts; they are not wrapped as the library's bodies.
- **C# first only for exploration.** Where a specification is not yet known, a throwaway C# body
  may be used to find it; it is replaced by a Plato body derived from the specification it helped
  write, not ported.
- **The writer is part of the trusted base.** Backend law results are evidence only once the
  writer has a regression test for each defect of F-50 and the interpreter-versus-backend
  differential test (TKT-317) agrees; until then the front-end gate and reading a body against
  its contract are the checks.
- **A chunk closes** when every body it owns is in Plato, its laws pass over the witnesses, and no
  throwaway code remains.

## Tooling, by chunk

`09-tooling` (TKT-316, README there) is a parallel track; each tool is first needed by the chunk
named. Chunk A: the law runner (`LawReportOf`, before the first body), `DiffModels`,
`DiffConnectivity`, `DiffMeshes` and `DiffReports` for the reversal, failure-isolation and
idempotence laws, `ModelMeshDump`, `ReportToTable` and `DumpStages` for the box, the box family,
and the edge and every-face reversal perturbations. Chunk B: `RegionToSvg` and `StageFaceSvg` for
the seam cut, `RoundMeshDump` and `StateTable` for the first refinement rounds,
`DiffDiscretizations` and `DiffFaceMeshes` for the refinement laws, the cylinder family. Chunk C:
the sphere, torus and cone families. Chunk D: jitter (closure decided by end coincidence within
the tolerance) and `DiffModels` on `RawDecodedModel.Model`. Chunk E: `DiffFiles` on the parser's
fixtures. Chunk F: the B-spline patch family. Chunk G: the block-with-hole and hollow-box
families. Chunk H: rigid motion and power-of-two scale, and `LoadCorpusModel`.

## Preconditions, none of which blocks the first chunk

- **64-bit `Number`.** `TARGET-LANGUAGE.md` recommends a per-compilation profile with `cpu64`
  as the default. Until it exists, chunk A's unit cube passes with 32-bit floats; chunks B
  onward (circles, spheres, the B-spline patch) need the profile, so it is the first language
  task and runs beside chunk A.
- **The spec tooling** of `SPEC-EXECUTION.md` (`plato verify`, generators, bounded quantifiers).
  Until it exists, the laws run as ordinary Boolean functions over the witnesses through the law
  runner, and `.spec.plato` contracts are checked by reading. Every chunk below lists laws, not
  contracts, for that reason.
- **The C# parser and its adapter** (the parser session and whoever the owner assigns under
  TKT-306). Needed by ME only.

## Chunks

Each chunk names the functions that need bodies (every other function the chunk reaches has one),
the laws that must pass, and the module it extends. Shapes follow research recommendation 23, one
new difficulty per shape.

### Chunk A: the unit cube, witness-driven (M0, M1, M2, M4, M5, M6, M7)

Input: `Witness_UnitBox` and `Witness_Box(w, d, h)` of layer 7. Expected mesh: 8 vertices, 12
triangles, reduced Euler characteristic 2, closed, consistently oriented, signed volume 1,
`Rounds` 0, `Ok` true.

| Layer | Functions that need bodies |
|---|---|
| 0 | none |
| 1 | none: `Line` and `Plane` evaluation, derivatives, `ClosestParameter`, `Project` are closed forms |
| 2 | `IsDegenerateEdge`, `NormalAgreesWithParameterization`, `ReducedCounts`, `LinkComponentCount`, `CoordinateExtent`, `ModelSize` |
| 4 | `EdgeSeeds`, `TotalTurning`, `ImagePoints`, `Discretize` |
| 5 | `Unwrap`, `AddMissingSeamsAndPoles`, `MeanSpeed`, `TriangulateRegion`, `RefineToSurface`, `Lift` |
| 6 | `AssembleModelMesh`, `EdgeTableOf`, `ComponentsOf`, `ComponentCountsOf`, `IsPinchedVertex`, `CoincidentVertexPairs` |
| 7 | `ValidateBrep`, `ValidateModelMesh`, `CrossCheck` at `Structural` and `Geometric`; the planar area oracle at `Oracle` |
| 8 | none |

Laws: layer 2's well-formedness, manifold, orientation and Euler laws on the ten positive
witnesses (they are literals, so they can all run now) and the three negative witnesses failing
exactly their named laws; then on the box mesh: `Law_MeshModelIsDeterministic`,
`Law_OkExactlyWhenClean`, `Law_RoundsWithinLimit`, `Law_EveryDiagnosticIsLocated`,
`Law_LoopEndsTerminal`, `Law_MeasureIsNeverNegative`, `Law_OutcomeIsOfItsFace`,
`Law_OutcomesAreCurrent`, `Law_EmptyDiscretizationExactlyWhenEdgeUnusable`,
`Law_FinalDiscretizationsMeetFloors`, `Law_ClosedWhenEveryShellClosedAndNoFaceEmpty`,
`Law_OrientedWhenEveryShellClosedAndNoFaceEmpty`, `Law_EdgeReversalPreservesMesh` on each of the
12 edges, `Law_ShellReversalNegatesVolume`, `Law_ValidationIsIdempotent`; with
`Witness_BoxWithFlippedFace` and the planted bad face of layer 7: `Law_EmptyFaceIsDiagnosed`,
`Law_FailedFaceLeavesOthersUnchanged`.

### Chunk B: the cylinder (M1, M4, M5 grow)

`Witness_Cylinder(r, h, 2 pi)` with its seam, the band without a seam, the sector
`Witness_Cylinder(r, h, sweep)`, then `PreferQuads` true. New: circles and the closed-form arc
counts, closed edges, the synthetic seam cut, anisotropy, refinement against the surface,
structured quads and `QuadCountMismatch` requests. Bodies: layer 1 `Circle` and `Cylinder` arms;
layer 4 `RefineEdge`; layer 5 `QuadSidesOf`, `QuadGrid`, `MatchingFloors`. Laws added:
`Law_StepDecreasesMeasure`, `Law_RefinementNeverCoarsens`, `Law_OnlyFacesOfChangedEdgesAreRemeshed`,
`Law_RequestsNameEdgesOfTheirFace`, `Law_PendingRequestIsInSomeOutcome`,
`Law_TighterChordalStaysWithinLooserBound` at three chordal bounds; the cylinder area and volume
oracles.

### Chunk C: sphere, torus, cone (M1, M5 grow)

`Witness_Sphere(r)`, `Witness_SphereByPoleLoops(r)`, `Witness_SphereWithRedundantPoleLoops(r)`
(negative), `Witness_Torus(R, r)`, `Witness_Cone(r, h)`. New: poles, collapsed lines, dropped
triangles, degenerate edges of one segment, reduced counts, two periodic directions and a
whole-period region with two seam cuts, the apex. Bodies: layer 1 `LimitNormal` and the `Sphere`,
`Torus`, `Cone` arms. Laws: every law of A and B again; expected Euler characteristic 0 for the
torus; the torus volume oracle over a boundary that wraps in v; Gauss-Bonnet on every closed
mesh.

### Chunk D: PrepareModel, the Plato side of the decode (M3)

**Boundary moved on 2026-10-17** (owner decision in the parser session, confirmed here): parsing
and decoding are C# from generated AP242 types (TKT-312), Plato does the geometry. The boundary is
`RawDecodedModel` (`03-step/step-decode.types.plato`): the B-rep as written (faces with `SameSense`
as in the file, `Periodicity` by surface family, never `Closed`, `Closures` empty), the
occurrences and sources, per-context units and uncertainty in millimetres and radians with the
factors recorded, and the decoder's diagnostics. Plato's `PrepareModel(raw): DecodedModel` makes
the four decisions that are geometry and whose laws live here: closure from end coincidence
(`ClosureMarks`), the mirror fold (`PlacementHandedness`), the tolerance floors at the coordinate
extent, and the reduction repairs. The schema table and the 110 WHERE laws stay as the
specification the C# typed layer's checks are written against (finding F-1 is resolved by the
generated types; TKT-300 is unnecessary).

This chunk gives `PrepareModel` and the functions it composes their bodies and makes pass:
`Law_PrepareIsIdempotent`, `Law_PrepareKeepsPointSet`, `Law_RawHasNoClosures`,
`Law_RawHasNoClosedPeriodicity`, `Law_UnitsFactorsAgree`, `Law_CurveClosureDecidedByEnds`,
`Law_SurfaceClosureDecidedBySides`, `Law_ClosureMarksAreTheDecisions`, the fold laws,
and the two witness laws `Law_RawUnitCubePreparesToUnitBox`
(`Witness_RawUnitCube`, from `adapter/fixtures/unit-cube.stp`, against `Witness_UnitBoxMillimetres`, the unit box relabelled in millimetres: the fixture is a 1 mm cube)
and `Law_RawTwoCubesPreparesToTwoBodies` (`Witness_RawTwoCubes`). It depends on chunk A for
`ScaledBy`, `RigidlyMoved`, `ReducedCounts` and `IsSameModel` bodies. The `Part21File` witnesses
of `03-step/step-witnesses.laws.plato` and `adapter/` stay as the C# parser's and decoder's test
fixtures, not as Plato tests.

### Chunk E: the C# decoder meets PrepareModel (ME)

TKT-312 (the parser session): `DecodeRaw(file, policy): RawDecodedModel` in C#, from
`Ara3D.IO.StepParser` through the generated `Ara3D.StepTypes`. Its acceptance is chunk D's two
witnesses: decoding `unit-cube.stp` and `two-cubes-assembly.stp` gives values equal to
`Witness_RawUnitCube` and `Witness_RawTwoCubes` under `SameRawModel`, and `PrepareModel` of each equals the expected
`DecodedModel`, run from C# against the compiled Plato (TKT-313). Then
`Law_MeshStepTextIsDeterministic`, `Law_StepTextOkExactlyWhenClean`,
`Law_EveryStepTextDiagnosticIsLocated`, `Law_ParseErrorMeansNotOk` run through `MeshStepText`.
`adapter/ADAPTER-SPEC.md` remains the specification of the parser's `Part21File` view and its
fixtures; the adapter it describes is no longer a deliverable, since C# decodes from its own typed
layer.

### Chunk F: the B-spline face (M1, M4, M5 grow)

`Witness_BSplinePatchSolid(bump)`, then a `Part21File` witness for it. New: knot seeds,
control-hull sagitta, search-based inverse evaluation, `LoopSelfIntersects` requests, a
`MaxRefinementRounds` 0 variant giving `PIPELINE-FACE-UNRESOLVED`. Bodies: layer 1 `BSplinePoint`,
`BSplineDerivative`, `BSplinePartial`, `ClosestParameterBySearch`, `ProjectBySearch`,
`ProjectNearBySearch`; layer 4 `Sagitta`. Laws: all above; the area bound of the witness table.

### Chunk G: genus and voids (M2, M6, M7 grow)

`Witness_BlockWithThroughHole`, `Witness_HollowBox`, `Witness_TwoBoxesSharingCorner` (negative).
Laws: Euler characteristic 0 and the component counts; the negative volume of the void shell;
`Law_EulerPoincareEvenAndBounded`, `Law_VertexLinkIsOneCycle` failing where stated.

### Chunk H: the corpus (ME)

The 88 u-blox files at `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`
(82 AP214, 6 AP203, the corpus the parser session already opens), then the rest of
`03-step/README.md` "Test files". New: assemblies, degree units, short names, surfaces of
revolution, defective files, the eleven complex-instance combinations tabled in
`docs/plans/step-reader.md`. Bodies: layer 2 `RigidlyMoved`, `ScaledBy` for
`Law_RigidMotionMovesPositions`, `Law_PowerOfTwoScalingKeepsConnectivity`,
`Law_PowerOfTwoScalingScalesPositions`. Expected numbers are the published counts where they exist;
otherwise the reports must be clean.

## Order and parallelism

```
A ──┬── B ── C ── F ── H
    ├── D ── E ─────────┘      (E is TKT-312 and TKT-313, C#, the parser session)
    └── G
```

A first, alone, because every module's bodies start there; the 64-bit `Number` profile (the Plato
repository) runs beside it, as does TKT-311 (does the C# writer compile the library's constructs).
Then B, D and G in parallel. C after B; E after D and TKT-312; F after C; H last.

## Coordination with the parser session

- 2026-10-17: boundary and file laws sent to the session "STEP file geometry parsing with Ara 3D".
  Its reply: parser is `Ara3D.IO.StepParser` (NuGet 1.6.2, complex instances parse since ara3d-sdk
  f48f62b); the four invariant differences above; no printer; throws on malformed input; nothing in
  its tickets writes the adapter (TKT-305 meshes from generated C# types over `StepDocument`
  directly); it asks this side for the test spec; ownership of the adapter waits on TKT-306.
- 2026-10-17, later: the spec's two parser-side asks are TKT-310, with a builder on it: the parser
  reports a malformed or truncated file as a diagnostic with a byte offset and keeps the parsed
  prefix, and `StepHeader` keeps all ten header fields. Its acceptance test is
  `adapter/fixtures/unit-cube-truncated.stp`, copied into the ara3d-sdk tests. The parser session
  will send the diagnostic type's shape when it lands; chunk E's adapter maps it to
  `ParsedFile.Diagnostics`. The spec's "accepted first step" clause and its fifth row then lapse.
- Open for the owner: TKT-306 (how the C# reader relates to this design). The design's answer is
  in chunk E: the adapter is small, the boundary stays, and the two meshing paths (TKT-305's and
  this one's) can share the adapter spec's fixtures as their common test set.
- 2026-10-17, later: owner decision relayed by the parser session and confirmed by the owner in this
  session ("go for it"): parsing and decoding in C# from generated types, geometry in Plato; the
  boundary moves from `Part21File` to `RawDecodedModel` with Plato's `PrepareModel` finishing it
  (chunk D above). TKT-312 is the C# decoder, TKT-313 the call into compiled Plato, TKT-311 the
  check that the C# writer compiles the library's constructs. Chunk A starts now under this
  session; the parser session starts TKT-312 when the type is committed.
