# Phase 3 findings

Findings against the design, one entry each, numbered F-n. A finding names the file and
declaration, the problem, the proposed fix, and the ticket that carries the work. Reviews in this
folder (`MATH-REVIEW-*.md`, `NAMES-REVIEW-*.md`) add their findings here when the supervising
session accepts them.

## F-1: layer 3 types STEP by string

- **Raised** 2026-10-17 by the owner, reading `03-step/step-where.laws.plato`.
- **Where** `03-step/step-where.laws.plato` (every `Law_Where_*`), `03-step/step-schema.library.plato`
  (`InstanceIsA`, `IsA`, `FieldReference`, `FieldIsA`, `IsExactlyOneOf`, `FieldReal`), and the
  decision "no typed `StepEntity` sum" in `03-step/README.md`.
- **Problem** The WHERE laws read the file through the schema table by name at run time:
  `f.InstanceIsA(i, "ADVANCED_FACE") ? f.IsExactlyOneOf(f.FieldReference(i, "FACE_SURFACE",
  "face_geometry"), ["ELEMENTARY_SURFACE", "B_SPLINE_SURFACE", "SWEPT_SURFACE"]) : true`. The
  compiler checks none of the names: a misspelt entity, an attribute that does not exist on that
  owner, a SELECT alternative the schema never offered, or a rule applied to the wrong supertype
  type-checks and makes the law vacuously true or false. This breaks three of the design's own
  rules: the catalog is the documentation and the type checker the first gate; laws are total and
  meaningful; every algorithm is an exhaustive `match`. The author's reason, that a typed layer
  would restate the kernel in about sixty hand-written records, does not hold once the records are
  generated from the EXPRESS schema: they are STEP's own types, not a copy of the kernel.
- **Fix** Generate the typed STEP layer from the AP242 long-form schema (one record per decoded
  entity with typed attributes in EXPRESS order, one sum per SELECT, one enumeration per
  ENUMERATION, a record per sanctioned complex-instance combination); restate every WHERE law over
  the typed records, or let the generated types carry it (a `face_geometry` field that *is* the
  three-case sum makes `ADVANCED_FACE` WR1 true by construction); keep the string-keyed
  `Part21File` as the lexical layer only (parsing, printing, provenance, the unsupported-entity
  diagnostic); decode `Part21File` to typed records by generated code and typed records to the
  kernel by hand-written exhaustive matches. Where a string must remain (diagnostics, unsupported
  entities), ask for a Plato or tool feature that resolves a string literal against the schema
  table rather than design around its absence.
- **Ticket** [TKT-300](../../../tickets/TKT-300-step-typed-entities.md).
- **Status** recorded only. The owner said on 2026-10-17 that TKT-300 is **not to be tackled**;
  it stays as the record of the finding and leaves the ready list until the owner promotes it.
  Nothing in `03-step` changed.

## F-2 to F-44: the mathematical review of layers 0 to 6

- **Source** [MATH-REVIEW-layers-0-6.md](MATH-REVIEW-layers-0-6.md), a fresh reviewer, 2026-10-17.
  Twelve false or imprecise laws, eleven missing laws, eleven cross-layer inconsistencies, nine
  timid choices, four false theorems and seven needing a hypothesis, out of forty-four; the Euler
  counting rule verified on nineteen worked examples and four boundary cases.
- **Ranked by the reviewer** (file and name in the review): seams placed by continuity fail at
  poles (layer 5 `Unwrap`, `AddMissingSeamsAndPoles`; use the left/right rule of
  `research/STEP-BREP-MODEL.md` 4.3); closed non-periodic curves and surfaces ignored above layer 1
  (add a `Closed(Period)` periodicity case decided at decode); mirrored placements and the inner
  part of a lemon torus get the wrong normal sign; `EdgeDomain`'s closed-edge rule fails on pcurves
  with unbounded domains; `ChartWindingIsFaceWinding` and `NormalTurnBoundsCentroidDeviation` are
  false (a folded sliver on the unit sphere); `Law_ShellIsConnected` is missing; the derivative
  laws exclude too few knots and borrow the file's angle tolerance for the library's own rounding;
  the rounding floor is taken at the model's size, not its coordinates; no law says each boundary
  segment of a face triangulation is an element edge, so tiling is not implied; several rounding
  laws are judged by file tolerances and `Check` stores no bound.
- **Status** accepted for a fix wave after wave B lands: one fixer per layer, one commit per
  finding, a fixer may skip a finding with a stated reason (CODING.md, "Fix and Sweep"). Findings
  that change a fixed name go through `VOCABULARY.md` revision 3.

## F-45: layer 3 has no hand-built `Part21File` witness

- **Raised** 2026-10-17 by the supervising session, applying the owner's rule that tests depend
  on as little as possible and that the parser is another session's work.
- **Where** `03-step/*.laws.plato`: every law over a `Part21File` is quantified, and the only way
  to get a value today is `ParseStep`, a host obligation.
- **Problem** Every decode, schema, units and WHERE law of layer 3 would wait for the C# parser
  and its adapter.
- **Fix** `Witness_Part21UnitBox` and the other `Part21File` literals of `TASKS.md` chunk D,
  written with arena indices by hand, plus the law that decoding the unit-box file gives
  `Witness_UnitBox` up to tolerance, and a `MeshParsedFile` entry in layer 8 that starts from a
  `ParsedFile`. The same literals are the expected values of the adapter test spec (chunk E),
  written first under `adapter/` while the layer 3 fixer owns `03-step`.
- **Status** open, carried by `TASKS.md` chunk D.

## F-46: what writing the adapter test spec showed about layer 3 and the C# parser

- **Raised** 2026-10-17 by the agent that wrote `adapter/ADAPTER-SPEC.md` and its fixtures.
- **Where** `03-step` (diagnostics, invariants, equality), `07-validation` (witness units),
  `deps/ara3d-sdk/src/Ara3D.IO.StepParser/StepHeader.cs` (the parser session's code).
- **Problems and fixes**, one line each:
  1. The C# parser's header kept three strings and dropped `OriginatingSystem` and
     `PreprocessorVersion`, which the decoder's repairs key on. Fixed in TKT-310 (ara3d-sdk
     002784d): `StepHeader` keeps all ten fields raw; the adapter decodes them. The spec's fifth
     row lapses.
  2. No diagnostic code fits "the parse stopped at an unknown place": `SyntaxError` must name an
     instance (`Law_ParseFindingsPointAtTheirSubject`). The accepted first step uses
     `NotPart21File` at `WholeInput`. Decided 2026-10-17 after TKT-310 landed in ara3d-sdk
     (002784d; the parser now returns diagnostics with a byte offset instead of throwing): a new
     layer 3 code `P21-SYNTAX-OUTSIDE-INSTANCE`, Error, at `WholeInput`, the byte offset in
     `Measure`; `P21-SYNTAX` keeps its instance subject. Chunk D adds the code.
  3. Layer 3 has `IsSameFile` but no equality for `Diagnostic` or `Provenance`; the tests compare
     field by field. Layer 0 should own `IsSameDiagnostic`.
  4. The `Part21File` invariants exist only as quantifiers in `step.spec.plato`; the spec wrote
     them as folds (`SatisfiesFileInvariants`). Layer 3 should own that function.
  5. Layer 3 fixes neither the count nor the order of diagnostics; the spec fixes one
     dangling-reference Warning per instance, whole-input findings first, then by instance id.
     Layer 3 should state it as a law.
  6. The fixtures are in millimetres, `Witness_UnitBox` in metres; chunk D's decode-equals-witness
     law compares against the witness scaled by 1000 through layer 2's `ScaledBy`.
  7. The Plato literal `"André Lefort"` (a decoded `\X2\` escape) passes the front end; whether the
     C# code generator keeps it intact is untested. A language note, not a design defect.
- **Status** 1 reported to the parser session; 2 to 6 assigned to `TASKS.md` chunk D; 7 noted
  for `TARGET-LANGUAGE.md`.

## F-47: what the fix wave left open

- **Raised** 2026-10-17 by the supervising session from the nine fixers' return reports.
- **Design items**
  1. Four laws have no `Check_` because they need a harness input: `Law_RigidMotionKeepsCoedgeSense`,
     `Law_MeshFaceReadsOnlyFaceEdges`, and layer 3's two findings-subject laws. Chunk A of
     `TASKS.md` decides how a check receives a second input (a generator argument, per
     `SPEC-EXECUTION.md`).
  2. Layer 7's new measured checks (the eleven graded by layer 1's exported measures, the
     per-face area and per-body volume envelopes) have no written agreement laws
     (`Law_*CheckAgrees`) yet.
  3. The two lower-bound angle laws stay exact Errors; there is no excess to grade.
  4. Layer 1's library laws keep a `tol` parameter they no longer read, so layer 7's calls keep
     their shape; the name review or chunk A removes the parameter in both layers at once.
  5. `ScaledPcurve` has no exact result for a 2D offset curve on a cylinder or cone; its
     precondition excludes the case, so `ScaledBy` on a model with such a pcurve is partial.
- **Process items**, for the next wave's procedure (`reviews/FIX-WAVE.md` step 1)
  6. All fixers shared one scratchpad and overwrote each other's gate scripts and snapshots
     three times; each fixer must work in `scratchpad/<layer>/` from the start.
  7. All fixers inherit the supervising session's `CLAUDE_CODE_SESSION_ID`, so every `Agent:`
     trailer carries the same id; the agent id from the spawn result is the one to write.
  8. Fixers reported the model that ran (Opus) in `Co-Authored-By`, not the line the brief gave.
     The brief should not name a model.
- **Status** 1 to 5 carried by `TASKS.md` chunk A and the name review; 6 to 8 to be folded into
  the next wave brief.

## F-48: design questions from the name-and-dependency review

- **Raised** 2026-10-17 by the name reviewer (six commits, 81a4f6b2 to be3a8848; gate
  `PASS: 0 error(s) in scope; 6710 functions type-checked`), not fixed because they are design
  choices, not naming defects.
  1. **Euler oracle independence.** `RedundantVertexLoopCount` and `RedundantVertexLoops` in
     `07-validation/validation-oracles.library.plato` now call layer 2's `IsRedundantVertexLoop`
     (the duplicate was deleted). An oracle that checks layer 2's rule needs its own rule under
     another name, or the check is not independent.
  2. **Planted-face facts.** `Witness_BoxWithPolyLoopSheet`'s meshing facts left layer 7's spec
     when the laws that used layer 8 moved to `08-pipeline/pipeline-witnesses.laws.plato`; no
     theorem ties witness and laws together now.
  3. **Field and function with one name** (gate Info LINT014; the C# writer picks property or
     method syntax by name): `ModelSize`, `CoordinateExtent` (fields of `DecodedModel`, functions
     on `BrepModel`); `Handedness` (`TangentBasis` field, `Frame3D` function);
     `EulerCharacteristic` (`TopologySummary` field, functions on `ModelMesh` and
     `MeshComponentCounts`); `Domain`, `CircleRadius` against stdlib fields. Rename the fields or
     fix the writer; a language question for `TARGET-LANGUAGE.md`.
  4. **Case name equal to a type name.** `Provenance.StepInstance` (layer 0) and layer 3's type
     `StepInstance`. Rename the case `AtInstance`.
  5. **Law with no parameter.** `Law_WitnessFilesSatisfyInvariants()` in
     `03-step/step-witnesses.laws.plato` should take the `(_: T)` form every other input-free law
     uses.
- **Status** open; 1, 2, 4, 5 go to `TASKS.md` chunk A's first commit (they are mechanical once
  decided); 3 is a note for the C# writer.

## F-49: what the RawDecodedModel boundary showed

- **Raised** 2026-10-17 by the builder of the boundary type (commits 44aa7687, a4b2cffa).
  1. `spec FindOccurrences` requires that an occurrence has no placing instance exactly when it
     has no parent. `two-cubes-assembly.stp` breaks it legitimately: the assembly's
     `SHAPE_REPRESENTATION` #147 holds no B-rep, so both cubes are roots placed by #161 and #162.
     Relax the contract to "a root occurrence may be placed when its parent representation holds
     no body".
  2. The file's `closed_curve`, `u_closed` and `v_closed` flags have no field in `RawDecodedModel`,
     so `ClosedFlagWithoutClosure` and `ClosureWithoutClosedFlag` cannot be raised from a C#
     decode. Add `ClosedFlags` per curve and surface direction to the raw geometry records, or
     drop the two codes.
  3. `ContextUnits` has no steradian field; `AngleFactor` covers the root context only.
  4. `Law_DecodeErrorMeansNotOk`, named in `TASKS.md` and layer 8's law list, does not exist:
     `DecodedModel` has no `Ok`. Either add `Ok` to `DecodedModel` (false exactly when a
     Diagnostic is an Error, like `ParsedFile`) and the law, or strike the name from layer 8.
  5. `ModelSize` and `CoordinateExtent` are now taken from the raw model, before the merges, so
     `Law_PrepareIsIdempotent` holds only when the second pass gives the same numbers; the two
     `spec DecodedModel` invariants that said otherwise were dropped.
- **Status** 1, 2 and 4 to `TASKS.md` chunk D's first commit; 3 and 5 are notes.

## F-50: the C# writer miscompiles the design (TKT-311)

- **Raised** 2026-10-17 by the parser session's spike TKT-311 (`docs/plans/step-reader.md` build
  log, 281b076d): the whole library through Plato 65d63c90's C# writer.
- **Silent defect.** A conditional used as a condition, `(a ? b : false) ? x : y`, loses its
  parentheses. 109 sites; about 97 compile with the wrong meaning. The design's own rule, guard an
  index with `? :` because `&&` does not short-circuit (SPEC-DSL.md), is exactly the pattern hit,
  so every law that guards before testing is affected. No front-end gate can see this; only a
  writer test can.
- **Compile stoppers.** Typed-index subscripts, `IIndexable` functions on arrays, C# keywords as
  identifiers, sum-type `Equals` throwing on inactive cases (`SameModel` throws), inconsistent
  bodiless stubs; two stdlib geometry sites.
- **Also observed.** `.spec.plato` files halt the parser (excluded by convention, as designed);
  `Number` compiles as 32-bit float (TKT-315); laws compile as Boolean functions but no runner
  builds witness arguments (the law runner for static witnesses is a tooling task, TKT-316 or
  TKT-317).
- **With the six fixes shimmed:** `RawCounts` of the cube 8, 12, 6, 6, Euler-Poincare 2, four
  layer 2 laws true on the cube, `CoedgeRunsForwardOnCurve` correct.
- **Status** fixes assigned to the TKT-315 builder after the profile, fix 1 first with a
  regression test; TKT-312 holds until 2, 3 and 5 land; the chunk A builder is told to distrust
  backend law results until then. Lesson for `TARGET-LANGUAGE.md`: the writer needs a
  differential test suite (interpreter versus backend, TKT-317) before law results are evidence.

## F-51: what the tooling layer showed

- **Raised** 2026-10-17 by the builder of `09-tooling` (TKT-316, commits 4836db8f to 26adc5db;
  gate `PASS: 0 error(s) in scope; 7040 functions type-checked`).
  1. **`SameModel` is too weak.** Layer 7's model equality ignores pcurves, parameter-plane
     curves, loop and body cases, and poly-loop points: an empty edge loop equals a poly loop,
     `ManifoldSolid(s)` equals `ShellSet([s])`. `DiffModels` in the tooling covers everything;
     `SameModel` should become `DiffModels(a, b).IsSame`. Assigned to the chunk A builder.
  2. **Most laws are not reached by any runner.** The runner reaches laws through layer 7's
     `Check_` wrappers and the witness laws it lists by hand; layers 0, 1, 4, 5 and layer 3's
     validity rules (most of 714 laws) have no run. The host entry point lists them as "not
     enumerated" by reflection; each chunk enumerates its layer's laws as it reaches them.
  3. **Front-end defects** (for the Plato repository): a conditional nested 13 deep fails to
     parse and the error location is hundreds of lines early; `match` on a field read fails with
     CHK304; a generic function cannot take `$T` as its first parameter.
  4. **The 3D pane ignores vertex colours** (colours by material), so mesh dumps write one part
     per B-rep face; provenance travels as `_VERTEX` and `_PROVENANCE` attributes.
  5. **Strings.** Plato strings support literals and `==` only, so `RegionToSvg` returns an
     `SvgDocument` record the host serializes; every text output of the design goes through the
     host.
- **Host shims the C# side owes** (contracts in `09-tooling/tooling.spec.plato`): the law runner
  entry point, `LoadCorpusModel`, `WriteMeshDump`, `WriteSvg`, `WriteTable`, `WriteStageDump`, a
  dump command. Roughly: entry point half a day once TKT-313 or TKT-317 exists, writers one to two
  days.
- **Status** 1 to the chunk A builder; 2 per chunk; 3 to the Plato repository (with F-50's
  writer defects); 4 and 5 are design facts, recorded in the tooling README.

## F-52: what chunk A left for the next chunks

- **Raised** 2026-10-17 by the chunk A builder (TKT-314, commits d80f3e89 to 36c893f8).
  1. `TriangulateRegion` is ear clipping with hole bridging, not constrained Delaunay; the contract
     does not require Delaunay, but `Law_TriangleMinAngleMeetsThreshold` (Info) fails on the 2x3x4
     box. Chunk B replaces it.
  2. `RefineToSurface` splits failing triangles at their centroids; that does not meet the
     criteria on curved faces. Chunk B needs edge insertion with flips.
  3. `AddMissingSeamsAndPoles` handles faces with no seam or pole only; `CompletePeriodicRegion`
     is new and bodiless for chunks B and C. `SagittaByHullBound` likewise for chunk F.
  4. `BoundaryCycleCount` counts indexed free edges only, so the planted poly-loop sheet also
     fails `Law_OpenShellEulerEvenAndBounded` at its shell; decide whether implicit edges of
     faceted shells count.
  5. Two 32-bit effects, both resolved by TKT-315: `Law_LengthToleranceResolvable` warns on every
     box; `Law_TurningAngleWithinAngular` fails on full circles whose segment count lands exactly
     on the 15 degree bound. `Law_AngleDefectMatchesBrepEuler` now allows `ResolutionAt` in its
     sum (4 pi off by 1e-6 against 1e-8 per vertex in 32 bits).
  6. `ParameterizationSignAt` at a 32-bit sphere pole was rounding noise; changed.
  7. `SharesCurveParameter` remains the one deferred body in layer 2.
  8. The `09-tooling` runner may not reach the layer 4 to 6 laws the harness ran; the builder
     ran laws by direct calls. Chunk B wires those into the runner.
  9. Results are provisional until the whole-library build is green under the fixed writer and
     the laws are rerun through it; TKT-314's boxes 2 and 3 stay unticked until then.
- **Status** 1, 2, 3, 8 to chunk B; 4 and 7 to chunk A's close; 5 and 6 closed by TKT-315; 9 gates
  TKT-314's close.

## F-53: what the interpreter's profile of the whole-model laws showed

- **Raised** 2026-10-18 by the interpreter speed session (TKT-332), profiling the ten laws that hit
  the 60 s budget in the 2026-10-18 sweep. Recorded by the supervisor of
  `docs/plans/step-mesher-parallel.md`.
  1. **Hot spots the interpreter's call cache hides.** `RoundingUnit` and `SmallestNormal` loop at
     each call (30 of 90 s in one hollow-box case); `CanEvaluate` re-runs `IsWellFormed` at every
     `CheckGrid` sample (26 s); the `Law_HollowBox*` laws mesh one model three times and the
     planted-face laws compute `WitnessOutcome` two to five times. The compiled C# has no cache.
     TKT-335, after step B closes.
  2. **New verdicts once the ten laws finish.** `Law_WitnessIsOracleClean` fails at k = 5:
     `ValidateBrep(Oracle)` reports `Law_DerivativeMatchesCentralDifference` on `KernelCurve(0)`.
     `Law_ValidationIsIdempotent` errors on a generated `ModelMesh` with negative vertex indices
     (`At` out of range in `CornerNormalAt < RestrictedToFaces`), an unguarded precondition. Both to
     the topology session (layers 07 and 08).
  3. `Law_WitnessEdgeReversalPreservesMesh` and `Law_EveryDiagnosticIsLocated` reach the bodiless
     `ExpandedPoles` under `CompletePeriodicRegion`: step B and C work (TKT-324, TKT-325).
- **Status** 1 TKT-335; 2 topology session; 3 step B session.

## F-54: laws over derived values, and type invariants, under a runner that generates arbitrary values

- **Raised** 2026-10-18 by the topology session (TKT-314). Since Plato acbc9b94 the law runner
  generates arbitrary `ModelMesh` values. (1) Layer 7 laws over `(m: BrepModel, mesh: ModelMesh)`
  assume the mesh was made from `m`, and nothing guards that: `Law_MeshClosedExactlyWhenShellClosed`
  fails on `Witness_Cylinder` paired with the tetrahedron mesh. (2) Layer 6's invariant laws
  (`Law_ElementFaceHasOneEntryPerElement`, `Law_ElementCornersInRange`, the other length laws) fail
  on meshes no constructor made; they are invariants of the type, not properties of every value.
- **Decision** (supervisor of `docs/plans/step-mesher-parallel.md`, 2026-10-18; the owner may
  revise): a law about a value that only a function produces takes that function's inputs and
  computes the value inside, guarded by the function's own precondition. For example
  `Law_MeshClosedExactlyWhenShellClosed(m, o)` with `mesh = m.MeshModel(o).Mesh` under
  `m.IsRunnable(o)`. The invariants of a type become predicates (bundled in layer 6's
  `IsWellFormed(mesh)`, 31a70b02), asserted by laws over the producing function's inputs and over
  the literal mesh witnesses by index, like `WitnessAt`. No runner change and no new law form:
  every law stays true for every value the runner can generate.
- **Rejected for now:** an `Invariant_*` law form that the runner draws only from witnesses. It needs a
  Plato change (TKT-331's fence) and leaves a law that is false for some values of its declared
  types.
- **Status** topology session (layers 06 to 08).
- **2026-10-18, also under F-54:** step B reports layer 4's `Law_SeedsAreSampled` failing on a
  generated `EdgeDiscretization` (one parameter, four points); only `Discretize`'s output promises
  every seed. Same pattern: the law takes `Discretize`'s inputs. Step B (TKT-324) applies it in
  layers 4 and 5.

## F-56: leftovers of the wave 1 merges

- **Raised** 2026-10-19 by the merge agents of plan v2 (`docs/plans/step-mesher-v2.md`).
  1. After TKT-346's wiring, `Law_BoundedAgreesOnConsistentModels` compares `Discretize` with
     `DiscretizeBounded`, which are now one function, and `DiscretizeAllBounded` duplicates
     `DiscretizeAll`. Delete the law and the duplicate.
  2. After TKT-343's wiring, `Law_MinAngleNoWorseThanLibrary` is trivially true and
     `Law_MinAngleBetterOnCylinders` compares against angles recorded from the old library (4.99
     degrees for the cylinder, 8.50 for the sector). Keep the second as a recorded benchmark or
     delete both.
  3. `Law_RefinementNeverCoarsens` exceeds the 120 s budget on the torus since the merge.
- **Status** a sweep after wave 1; item 3 with step C (TKT-325).
