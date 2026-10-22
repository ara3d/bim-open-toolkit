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

## F-57: what step C showed

Step C (TKT-325, merged from `sandbox/step-mesh-staging/poles`) gave `LimitNormal`, `ExpandedPoles` and `CutWholePeriods` bodies, so the sphere, torus and cone mesh. The track's findings, as it left them:

1. Layer 07's `Oracle_AngleDefectSum` sums thousands of corner angles in plain floats and subtracts the total from 2 pi times the vertex count. Under gpu32 the rounding of that sum exceeds `AngleDefectMatchesBrepEuler`'s allowance on every curved witness: sphere gap -0.0185 against 0.0133 (1,109 vertices), cone -0.0029 against 0.0026, step B's cylinder -0.00204 against 0.00204. Under cpu64 the gaps are 5e-11 (cone) and 3e-12 (cylinder). A compensated sum (as `SignedVolume` uses) or an allowance that counts the additions would fix it.
2. Refinement can stop short on a triangle with long sides. On the seamed unit sphere at chordal 0.01 (gpu32), triangle 1913 deviates 19.9 degrees from the surface normal at its centroid (bound 15). `TriangleNeedsRefinement` flags it, but `SplitPass` rejects the split because the midpoint of its longest side lies 0.00062 from the far corner of the neighbouring triangle, under the minimum length 0.001, and tries nothing else. Its shortest side is 0.023, so `MeshFace`'s minimum-length escape does not cover it. A fallback (the centroid, or another side) would fix it; this blocks `Law_SphereFaceChecksHold`. Refinement also takes corner normals from `FaceNormalAt` with a +z fallback, which is wrong at a cone's apex (`LimitNormal` gives the ruling's normal there), so it splits toward the apex until the minimum length stops it.
3. Layer 07's `Oracle_BodyVolume` gives `Witness_SphereWithRedundantPoleLoops(1)` a volume of 8.378, twice the sphere's 4.189: it counts the redundant vertex loops. The mesh of that witness is the seamed sphere's, so `Law_RedundantPoleLoopsMeshIsSound` judges its volume against the seamed sphere's oracle.
4. A face whose winding loops `WithSeamCut` does not pair (other than the whole torus at a vertex) is returned unchanged by `CutWholePeriods`; `AddMissingSeamsAndPoles` has no outcome through which to diagnose it (layer 05 README, open item 1). No witness reaches it. A hemisphere bounded by its equator alone, or a cone by its base circle alone, is handled: `ExpandedPoles` adds the enclosed pole's whole segment (`WithMissingPole`), and the band join cuts to it; `Witness_Hemispheres(r)` is the witness, and `Law_HemispheresRegionsAreWellFormed` passes. Its whole-model mesh is not verified: one run at chordal 0.05 used 1,277 s of CPU without finishing (the seamed sphere at the same chordal takes about 60 s), so something in refinement or lifting is far costlier with an added pole loop. Not diagnosed; the mesh law was taken out rather than left unverified.
5. Cost: the torus of radii 2 and 0.5 meshes to about 7,000 triangles even at chordal 0.05, driven by the 15 degree normal-turn bound on a tube of radius 0.5; one whole-model law then takes about 7 minutes in the interpreter. `Lift`'s identification compares every pair of points (about 12 million comparisons at 3,500 points); a sort on the source would make it n log n. The torus laws need a budget near 900 s.
6. In this Plato, `Take(n)` faults when n exceeds the array's count.
7. Since the triangulation track's refinement merged (7d8dae2d), whole-model meshing of a curved witness exceeds the runner's budget in the interpreter: the seamed unit sphere ran past 1,500 s at chordal 0.05 and past 10 minutes at 0.2, the trace in `AnglePass` < `TryAngleInsertion` < `Delaunayed` < `FlipPass` < `NeighbourTable` < `SortedIndices`: each insertion's flips rebuild and sort the whole neighbour table. Until that cost falls, every whole-model law of this track stays a budget error under the sweep.

Lessons for the process:

- A bodied declaration in a staging folder beside the library's bodiless one compiles, but the interpreter still reports the host obligation, so staged bodies are reachable only through mirrors of the call chain until merge. A runner option that binds `<Name>Body` to a bodiless `<Name>` for staging runs would remove the mirrors.
- The warm server did not answer within 10 minutes on the first staging call; the cold pinned CLI compiled the library plus the folder in 10 to 15 s, and meshing dominated every run.
- Whole-model laws on curved witnesses cost minutes each in the interpreter; diagnose with `--call` on a debug function that returns the parts of a law as numbers, then run the laws once at the end.
- Layer 07's face validation at Geometric holds several all-pairs checks; on a 7,000-triangle torus one run did not finish in 100 minutes. Face-level laws on large curved faces should check the per-element laws directly (linear) and leave the all-pairs checks to small faces.
- The library changed under the track (four merges in one day); rerunning everything after each merge cost more than the track's own development. A staging run could pin the library at a commit and rerun only on request.

## F-58: what implementing the type catalog showed

- **Raised** 2026-10-20 by the nine catalog builders and the merging session (plan v2 log of the same date; each track's `TRACK.md` under `sandbox/step-mesh-staging/catalog-*` has the detail).
  1. **Compiler, generics:** with every catalog folder in the program, the library's `DifferencesTable(ds: Array<LocatedDifference<$T>>, name)` reported CHK201 with `$T` shown as `$Ret3` and the lambda's parameter typed `SparseMatrixEntry`; removing any one of seven unrelated files cleared it. A type-variable collision that depends on program size. Worked around by making the function concrete; to file in the Plato repository.
  2. **Server, stale paths:** a renamed or deleted declaration stays alive at a path the server has compiled; checks run on fresh copies. **Server, silent skip:** a call chained on a payload-free qualified case (`Expectation.ShouldPass.IsMet(v)`) returns 0 laws and 0 type errors without compiling. **Server, LINT001:** a missing interface function is not reported; the CLI `lint` is. **Server, memory:** many fresh paths grow it to 2.8 GB and a check from 15 s to 4.5 min.
  3. **Language:** a sum case named like a field (`Point`) makes the field ambiguous; a field typed by a type of the same name (`Angle: Angle`, `Round: Round`) derives an implicit conversion; `Density`, `Speed`, `VertexRemap` and `PowerOfTwo` are taken; a `match` on a local initialised from a later-sorting file fails at run time with no type error; `Take(n)` faults past the end.
  4. **Catalog corrections:** `ToCurveParameter` does not apply `SameSense`; `Diagnose` and `PlanOf` need the model; `RemoveFace` needs `RestoreFace`; `Transform`'s inverse is exact only within tolerance; `UndecidedReason` wants a `Fails(Property)` case; `KernelKey` is `KernelElement`.
  5. **Contract requests**, one list per `TRACK.md`, all waiting for a wave boundary: `Check` over `Measure`, `CoedgeSite` over slots, `FaceMeshOutcome`, `MeshOutcome` and `DecodeBrep` as sums, `NormalOr` and `LimitNormal` returning `SurfaceNormal`, `Project` returning `Projection`, `FaceChart.Mirrored: Parity`, new `RefinementReason` cases, `StepRepair` as a projection of `RepairAction`, `ProvenanceMap.Repairs` of `RepairEntry`, `implements` lines on `BrepModel` and the arena views, four library functions renamed where they share a type's name.
     - Applied at merge (foundation, 2026-10-20): `PowerOfTwo(k): Number` renamed `PowerOfTwoValue`, and the type `PowerOfTwoFactor` renamed `PowerOfTwo`; `ResolutionAt` returns `Resolution` (every caller reads `.Value`; `ResolutionFor` deleted).
     - Not applied at merge (foundation): `CoedgeRunsForwardOnCurve` as `Compose` of three `ToSense` values. Equal to the XNOR, but in the interpreter `Law_PowerOfTwoScalingScalesPositions` went from 51 s to over 400 s (budget error) with it, and back with the Booleans; a sum match per coedge visit is a hot-loop cost until laws run compiled (TKT-354). Also seen at this merge: four laws that passed the baseline's 120 s budget under the pinned CLI (`Law_SphereMeshIsSound`, `Law_ConeGaussBonnet`, `Law_OnlyFacesOfChangedEdgesAreRemeshed`, `Law_PendingRequestsAreRefinable`) exceed it on the warm server with the committed library too, so the server is the slower runner; and two pipeline laws over `PipelineState` are skipped ("nesting deeper than 6") only when the staging folders are in the program, a runner limit, not a library change.
     - Not applied at merge (foundation): `Check { Worst; Bound }` over `Measure`. Needs a design decision: 54 call sites build a measured check (12 direct `CheckWithin`/`CheckExact`, 42 callers of layer 7's `CheckAllWithin`, `CheckAllWithinEach`, `CheckGridWithin`, `CheckGridWithinEach`), and their measures are lengths, angles, parameters, ratios and areas; a `CheckWithin(law, Number, Number, where)` kept as a convenience would have to name a kind it does not know. The change wants each layer 7 check to pass a typed measure (`ToMeasure` of a `ModelLength`, an `Angle`, ...), one check family per chunk, after which the Number fields go.
     - Applied at merge (indices, 2026-10-20): `CoedgeSite { Bound: BoundSlot; Slot: CoedgeSlot }`; `MeshVertexSite.EdgeInterior`/`FaceInterior` `Slot: InteriorSlot`; `UvPointSource.FromEdge(Edge, Index: EdgeSampleIndex)`; the function `ElementSide(mesh, e, slot)` renamed `ElementSideVertices`.
     - Not applied at merge (indices): `FaceMesh`'s parameter-point indices as `UvPointIndex` and its local vertex indices as `LocalVertexIndex`. Touches the mesher's core data layout; a chunk of its own.
     - Not applied at merge (indices): the hand-written `3T + 4q + s` corner arithmetic replaced by `TriangleCorner` and `QuadCorner`. Touches the mesher's core data layout; a chunk of its own.
     - Seen at merge (indices): the five-parameter laws of `BrepFoundationIndicesLaws` run 25 cases each, not exhaustively (the two-parameter ones run 196); `Law_RowInRangeAgreesWithTable` runs over runner-made `BrepModel`s, mostly small, so a witness model with rows in every table would make it bite harder. No kernel table implements `IIndexedTable` (an `Array<T>` field cannot gain an `implements` clause), so the interface waits for a table wrapper type.
     - Applied at merge (decided, 2026-10-20): `UndecidedReason` gains `Fails(Property: String)` (the proofs track still uses `NotApplicable` for a failed property; its merge switches them); `FaceMeshResult.Meshed` gains `Diagnostics`, so `ToFaceMeshResult` keeps the warnings of advisory requests (`Law_FaceMeshResultKeepsDiagnostics`); `HasBlockingRequest` moves from layer 8 to layer 5, beside `ToFaceMeshResult`. The four sum forms and their conversions are in the library beside the records.
     - Not applied at merge (decided): `FaceMeshOutcome` replaced by `FaceMeshResult`. 42 lines in 18 files name the record outside the moved files, `PipelineState.Outcomes` holds it, and the refinement loop reads `.Requests` and `.Mesh` per face per round (`RequestsOf`, `FailureDiagnostics`), where a `match` is the interpreter's 8x hot-loop cost. The library has `ToFaceMeshResult(outcome)`.
     - Not applied at merge (decided): `MeshOutcome` replaced by `MeshResult`, and the loop returning `Incomplete` with its pending requests at the round limit. 35 lines name the record, and 45 calls of `MeshModel` and `MeshStepText` read `.Ok`, `.Mesh` or `.Report` from it, most in the witness-meshing laws of layers 7 to 9. The library has `ToMeshResult(m, outcome)`; `Incomplete` stays unbuilt until the loop changes.
     - Not applied at merge (decided): `DecodeBrep` returning `DecodeResult`. 63 lines call or name it (35 in `step.laws.plato`, 19 in `validation-checks-step.library.plato`), over the limit of about 25. The library has `DecodeBrepResult(file)` beside it.
     - Not applied at merge (decided): `NormalOr(fallback)` and `LimitNormal` returning `SurfaceNormal`. 50 lines; `NormalOr` is a member of the `INaturalSurface` concept with one body per surface kind, called per sample. Needs a design decision too: a decided form beside `LimitNormal` was tried and rejected, because telling `Regular` from `Limit` by `AreaElement > 0` calls the unit sphere's pole regular (its area element there is about 6e-17), so the classification wants a tolerance, as layer 7's `IsOnCollapsedLine` takes one. The geometry track's `Pole.Normal` already wraps `LimitNormal` in `SurfaceNormal.Limit`.
     - Seen at merge (decided): the runner builds payload-free sums as law parameters (`Sign` ran 126 cases, exhaustive), contrary to PLATO-PRIMER.md B.2. `TerminationCertificate` (layer 0) holds `WorkBudget`, still staged in catalog-validation; that track's merge must put `WorkBudget` in layer 0. `ToMeshResult` (layer 8) calls catalog-proofs' `CheckCheckedMesh`, so `pipeline-decided.library.plato` compiles only with catalog-proofs until it merges.
     - Applied at merge (proofs, 2026-10-20): every section 4 constructor gives `Fails(Property)`, naming the predicate, where it had `NotApplicable(Kind)` for a property checked and found false; `HasClampedEnds(SplineBasis)` moved into `geometry-splines.library.plato` beside `KnotMultiplicityBounded`; `IsOrthonormalEitherHandWithin(Frame3D, AngleTolerance)` added beside `IsOrthonormalWithin`, which now says in a comment that it is the motion test, and `CheckOrthonormalFrame` calls it.
     - Not applied at merge (proofs): none; the track's three contract requests were all applied.
     - Seen at merge (proofs): the track's laws use layer 7's witnesses (`WitnessAt`) or layer 8's (`MeshingOptions.WitnessOptions`, `WitnessMesh`, `CurveFixture`), so by VOCABULARY.md's dependency rule they sit in layers 7 and 8 (`validation-proofs-*.laws.plato`, `pipeline-proofs-*.laws.plato`), not beside their types; only the three frame laws stay in layer 1. `CheckCheckedMesh` reads layer 7's `RestrictedToShell`, so its constructor is layer 7's while `CheckedMesh` is layer 6's; `CheckCanonicalDiscretization` and `CheckOrientedUvRegion` read law claims of their own layers (4 and 5) and stay there.
     - Seen at merge (proofs): `Law_CurvePlacementOrthonormal` and `Law_SurfacePlacementOrthonormal` (`BrepGeometryLaws`), skipped in `verdicts-cpu64.tsv` for want of a `GeometrySet`, now run and fail on a negative angle tolerance (the law has no `tol.Angle.Value.Radians > 0` guard). The committed library gives the same 74 pass, 14 fail, 8 skipped, so not a regression of this merge.
     - Carried from the proofs track: every "iff" law restates the library predicate from library calls, so it guards the constructor's wiring, not the predicate; the laws with independent content are `Law_PositiveWitnessShellsAreClosed`, `Law_BowtieIsNotSimple`, `Law_DiscretizedEntryIsCanonicalReversedIsNot`, `Law_ClosedWitnessMeshesAreChecked`, `Law_UnitSquareQuadIsPlanar`, `Law_ClampedBSplineIffFixtureClamped`, `Law_ClampedBSplineInterpolatesEnds`, `Law_RigidFrameIsOrthonormal`.
     - Carried from the proofs track: `Law_InRangeModelIffIndicesInRange` is one-sided in practice (no witness model has an index out of range), and `Law_RigidFrameIsOrthonormal` is likely vacuous on random frames, which are almost never orthonormal; a witness frame and an out-of-range witness model would make them bite.
     - Carried from the proofs track: LINT014 (info): the concept members `Where` and `Tolerance` collide with struct fields (`Check.Where`, `Diagnostic.Where`, `SimpleUvLoop.Tolerance`, stdlib `PathSimplifyParameters.Tolerance`); kept because `Check` and `Diagnostic` implement `IHasProvenance` through their fields; rename `IToleranced.Tolerance` to `TolerancesOf` if the C# call syntax matters before plato-323 lands. LINT003 (info): proof fields no library function reads yet; their consumers come with the rewiring.
     - Applied at merge (geometry, 2026-10-20): `ArenaCurve implements IHasCurveDomain, IEvaluableCurve3D, IDifferentiable1, IDifferentiable2`, `ArenaCurve2D implements IHasCurveDomain, IEvaluableCurve2D`, `ArenaSurface implements IHasSurfaceDomain, IEvaluableSurface, IHasSeams, IHasPoles, IProjectable3D` (beside their `INatural*` concepts); `Degeneracy.Apex(At: IsoLine)`, `InteriorDegeneracy` building v = v0 or u = u0 and `IsApexAtV` reading `Constant` and `At`; `Placement { Frame: OrthonormalFrame }` with the `Handedness` field dropped (`Law_PlacementCopiesHandedness` became `Law_PlacementHandednessIsFrames`). No staged folder named any of them.
     - Not applied at merge (geometry): `Project(ArenaSurface, Point3D)` returning `Projection`. `Project` has 25 call sites in layers 1 to 7, among them face meshing's per-sample loops (`uv-regions.library.plato`, `face-meshing.library.plato`) and layer 7's oracles, and `INaturalSurface` declares `Project(x, p): UvCoordinate` with the same parameters. Added `ProjectDecided(ArenaSurface, p): Projection` beside it (`geometry-views.library.plato`: `OffDomain` where the foot is on a bounded side and the descent points out, `Failed` where the surface cannot be evaluated) and made it `IProjectable3D`'s obligation; 3 laws. Changing `Project` itself wants a decision on `INaturalSurface` too.
     - Not applied at merge (geometry): layer 1 owning the surface second partials. `JetWith` stays in `geometry-jets.library.plato`; moving it beside `PartialU`/`PartialV` and extending `Law_SurfaceSecondPartialsMatchDifferences` past B-splines is out of this chunk's scope.
     - Seen at merge (geometry): `Witness_CatalogArena` is not `IsWellFormed`, so `CanEvaluate` is false on every record of it (the kinds and jets laws evaluate without asking); the `ProjectDecided` laws use its five closed-form surfaces in an arena of their own, which is well formed. Being a `Witness_*` `GeometrySet`, it now feeds the `BrepGeometryLaws` the baseline skipped: 63 of them go from skipped to pass. Its records are built with layer 7's `WorldFrameAt`/`FrameAt` and layer 8's fixtures, a reference upward that layer 1's `bspline-*.laws.plato` already make.
     - Carried from the geometry track: `Pole` as a type compiles beside the `UvPointSource.Pole(Side, Index)` case, and `Sagitta` as a type beside layer 4's `Sagitta(m, e, t0, t1): Number` function (different arities); the textbook principal curvatures H -+ sqrt(H^2 - K) lose half the digits at an umbilic, so `CurvatureAlong` reads the second form in an orthonormal tangent basis; the catalog's `Speed` is declared `ParameterSpeed` and the catalog should be corrected.
     - Applied at merge (meshing, 2026-10-20): `RefinementReason` gains `NoInteriorPointMeetsChordal(Segment: Chord)`, `PoleAdjacency`, `NeighbourDensity` (three matches gained arms: `IsBlocking`, `RequestDiagnostic`, `ReasonName`); `FaceChart.Mirrored` is a `Parity` (six sites, read as `== Parity.Odd`, not a `match`, so the per-point `ToChart` stays a tag compare); the functions `NeighbourTable(tris, n)`, `ElementDeviation(m, d, fm, k)`, `SplitSide(...)` and `ElementCorners(mesh, e)` are `NeighbourSlots`, `ElementChordalDeviation`, `SplitSideSlot`, `ElementCornerList`; `TimeBudget`, `Elapsed`, `WorkBudget` moved to layer 0 so `IBudgeted` and `TerminationCertificate` resolve without catalog-validation.
     - Not applied at merge (meshing): `EdgeRefinementRequest.Chordal` as `ModelLength` and `Segments` as `SegmentCount` (0 meaning "not about counts" then needs a sum or a `Count`). A change to the refinement loop's data, read by every request producer and by `Refine`; a chunk of its own.
     - Not applied at merge (meshing): layer 5's `TwiceSignedArea` callers on chart points switched to `OrientationOf` or `OrientationWithin`. They sit in per-triangle hot loops (`triangulation-refine`, `uv-delaunay`, the insertion passes), where a `Sign` match per triangle is the interpreter's 8x cost; waits for compiled laws (TKT-354).
     - Carried from the meshing track: no `Seed` is produced yet; `Law_SeedsAreSampled` over `Discretize`'s inputs belongs to layer 4 once `Discretize` returns its seeds. The four defect finders of section 9 (`BoundaryCycleListOf`, `NonManifoldEdgesOf`, `PinchedVerticesOf`, `MisorientedEdgesOf`) are bodiless; their invariants are obligations in `06-mesh/mesh-elements.spec.plato`. The track's server finding (0 type errors on the real staging path) is item 2 above.
     - Applied at merge (validation, 2026-10-20): `Check.Law` and `LawRun.Law` are layer 0's `LawName { Value: String }` (the track's `LawId { Name }` was the same thing and is deleted; `CheckWithin` and `CheckExact` keep a `String` parameter, since about 450 call sites pass a literal, and wrap it; 18 readers changed, 10 in the staged repair track); `LawVerdict` gains `Error(Message)`, `Obligation`, `OverBudget(Elapsed)` from `LawVerdictDetail`, which is deleted (`Pass`, `Fail` were `Held`, `Failed`; `FailedAsExpected` and `HeldUnexpectedly` stay, `RunOfCheck` produces both; three matches gained arms: `IsDefectVerdict`, `VerdictName`, `VerdictReason`, formerly `SkipReason`); `LawRun.Elapsed`, zero (`LawRun.Untimed`) at the runner's four constructor sites, which do not time; `PerturbationKind` deleted, since its three cases renamed three of `Perturbation`'s six with other payload types, and `InvarianceOf` takes `Perturbation`.
     - Not applied at merge (validation): `Failed` carrying the catalog's `Evidence` payload. Needs a design decision: a run from a `Check` has no measure kind and no sample count to build `Evidence` from (the same gap as `ToCheckRecord`'s extra parameters), and a selector run's measure is a failing index, not a measure; the run's `Measure` and `Where` hold what the runner knows.
     - Not applied at merge (validation): `Check` as `CheckRecord { Claim; Evidence; Holds }`. Follows the `Check` over `Measure` change, which the foundation merge did not apply; `ToCheckRecord(c, kind, samples)` is the bridge until then.
     - Not applied at merge (validation): a layer 8 `Stage = Parsing | Decoding | Preparing | Discretizing | FaceMeshing | Assembling | Validating` beside layer 9's `RunStage`. A design question, filed nowhere: `RunStage` names where the law runner looked, not a pipeline stage. Because `StageOutcome<T>` names `RunStage`, it sits in `09-tooling/tooling-reports.types.plato`, not in layer 8 with the rest of section 11.
     - Not applied at merge (validation): `PipelineState` gaining `Trace: Trace` and `Work: WorkBudget` and implementing `ITraced`. A change to the refinement loop's data, a chunk of its own; `ITraced` has no implementer.
     - Not applied at merge (validation): `BrepModel implements ICheckable, IDiffable, IWitnessed`. `BrepModel` is layer 2's and a layer names only lower layers, while the concepts' obligations name layer 7's `ConformanceLevel` and `Report` (`ICheckable`, now in `07-validation/validation.concepts.plato`) and layer 9's `ModelDiff` and `WitnessSpec` (`IDiffable`, `IWitnessed`, in `09-tooling/tooling.concepts.plato`). Either the concepts and their obligation types move to layer 2 or below, or `Check`, `Diff` and `Witnesses` stay plain functions; the CLI lint reports LINT009 "unreachable" for the four concepts.
     - Seen at merge (validation): `Law_SameModelHasNoDifference` errored ("match subject is not a sum type") once its library sorted after its laws file (`tooling-reports.library` after `tooling-reports.laws`), the known later-sorting-file defect; it now reads `Diff(m, m, tol).IsSame`. `Diff(BrepModel, BrepModel, Tolerances)` is `DiffModelsWithin(a, b, tol.Length.Value)` and `DiffSummaryOf` uses `ModelDiffOf`, instead of restating them; `TotalWork` was deleted for layer 0's `WorkTotal`. `Law_Catalog_LawNameKeepsId` became `Law_CheckKeepsLawName`, since `LawNameOf(LawId)` no longer exists. `CorpusRow` is in `09-tooling/tooling-corpus-rows.types.plato` because it names the staged repair track's `DefectReport`; it compiles only with `catalog-repair` passed as `--staging` until that track merges.
     - Carried from the validation track: LINT010 (info) remains for `StageOutcome`, `RowDump`, `CorpusRow`, plain records no function takes yet. Check that a name the catalog marks **exists** really does (`LawId` did not) before planning around it.
     - Applied at merge (editing, 2026-10-20): `Reversed(loop: BrepLoop)` moved to `02-topology/topology.library.plato` beside `Reversed(face)`; `ShellCountsDelta { Vertices; Edges; Faces; Loops: Integer }` (signed) added in layer 2 beside `ShellCounts`, with `WithDelta(c, d): ShellCounts` and `CharacteristicDelta(d)` (moved from the editing track, retyped), and `CountDelta(op)` returns it, so `ShellCounts`'s "every field is non-negative" stays true. No caller outside the moved files. The catalog's section 12 says `RestoreFace(At, Face, Uses)` is `RemoveFace`'s inverse.
     - Not applied at merge (editing and validation): `BrepModel implements IEditable`, `ICheckable`, `IDiffable`, `IWitnessed` waits on a decision: move the concepts and their obligation types down to layer 2, or accept that the kernel type implements nothing from above. `IEditable`'s obligation `Apply(BrepModel, ModelEdit): EditOutcome` names layer 10's types, and a layer names only lower layers.
     - Not applied at merge (editing): one motion type across `IMoved` (`Pose3D`) and layer 2's `RigidlyMoved` (`Frame3D`). A design question; `Apply` converts with the stdlib's `Frame3D(pose)`.
     - Carried from the editing track: `Transform`'s inverse is exact only up to rounding, so it has its own law with the length tolerance (`Law_TransformInverseRestoresVertices`); `BodyShells` (`07-validation/validation-oracles.library.plato`) indexes `m.Bodies[b]` without a range guard; `DirtyAfter` reads every script edit against `Before`, wrong for a later edit after a removal; looping witnesses and indices inside a law over Integer selectors makes the runner exhaustive (five-parameter laws get 25 random cases).
     - Applied at merge (repair, 2026-10-20): `StepRepair` as a lossless projection of `RepairAction`: `MergedInto(Vertex, RawVertex)` and `DroppedZeroLengthEdge(RawEdge)` keep the raw index of what was removed (two constructor sites in `ReduceRaw`, one match in `MergedVertexOf`), and `ToRepairAction(record)` lost its two index arguments. `SkipInstance` is in TYPE-CATALOG.md section 13's action list, and `Diagnose`/`PlanOf` read with the model there. The section 13 defect types went to layer 7 (`validation-defects.*`), so layer 9's `CorpusRow` compiles without staging; the repair types to the new layer `11-repair`; section 14 to `03-step/step-decoding.*`. `FacesOnSurface` and `FacesOfLoop` were declared twice (staged diagnosis library and layer 10's `editing-closure`, same bodies in effect); the staged copies are deleted.
     - Not applied at merge (repair): `ProvenanceMap.Repairs` holding `RepairEntry`, with `RepairRecord` built by `ToRepairRecord(entry)`. `RepairEntry` names layer 10: its `Outcome` is a `RepairOutcome`, whose `Repaired` case carries `ModelEdit`, and the decoder has no outcome to give its own entries, so layer 3 keeps `RepairRecord` and `RepairAction`, `RepairOutcome`, `RepairEntry` live in layer 11.
     - Not applied at merge (repair): `Check` carrying per-family addresses (two kernel elements, a slot, a count) so `DefectOf` can map the other 19 defect families instead of `Unclassified`. A design decision that follows the `Check` over `Measure` request; a `DefectOf(m, check)` overload that re-derives the address from the model is the other option.
     - Carried from the repair track: on layer 7's negative witnesses, `Witness_BoxWithFlippedFace` maps to `MisorientedFace(0)`, while `Witness_SphereWithRedundantPoleLoops` and `Witness_TwoBoxesSharingCorner` give only `Unclassified` defects (a redundant vertex loop needs a bound slot; the Euler and vertex-link laws have no defect family). An Integer law parameter runs 14 values (-7 to 6), so a selector into 28 samples misses half of them; the sample laws quantify over every sample inside the body. LINT014 for `Defects(HealedModel)` against the fields `DefectReport.Defects` and `CorpusRow.Defects` (the catalog names both); LINT010 for `GapClosure`, which no function takes yet.
- **Status** open; the folders are merge-ready (`ready:` in every `TRACK.md`); the library wiring is the contract wave.

## F-59: what chunk D1 (closure decided without evaluating a B-spline, TKT-348) showed

- **Where** `03-step/step.library.plato` (`DecidesClosedByEnds`, `RunsBackToStartDecided`, `ReachesSpline`, `Reduced`), `00-foundation/foundation-decided.types.plato` (`DecidedClosure`), `03-step/step-diagnostics.*` (`EdgeClosureUndecided`), `03-step/step-raw-witnesses.library.plato` (`ClosureArena`, the two raw cubes with a B-spline edge), `03-step/step.laws.plato` and `08-pipeline/pipeline-proofs-bsplines.laws.plato` (9 laws). Merged 2026-10-21 from `sandbox/step-mesh-staging/prepare/` (3a0f5cc4).
- **What** `Reduced` decided every edge's closure by evaluating both ends of its curve; a host whose `BSplinePoint` had no body threw out of it and 72 of 88 corpus files meshed nothing. Closure is now read from the record (a clamped B-spline's end control points, P42 4.5.34; a trim of such a spline over its whole domain; evaluated ends only for a kind that reaches no B-spline) and is `Undecided` otherwise; an undecided edge is kept and gets `EdgeClosureUndecided` with the curve's instance id as Measure. Of the 40,399 throwing corpus edges, 40,378 are B_SPLINE_CURVE_WITH_KNOTS directly on their splines and are now decided; the 21 SURFACE_CURVE edges of SHO/NINA-B222-W1x2 become kept edges with a diagnostic.
- **Found on the way**
     - Since the bspline track merged (2026-10-19) the library's `BSplinePoint` has a body, so the interpreter no longer throws; the defect is in the C# generated before that merge. The record-based decision is still right: the decoder must not depend on evaluation (the arena's weightless splines, which `BSplinePoint` cannot evaluate, prove it: `Law_ClosureDecisionReturnsForEveryKind`).
     - The interpreter cannot `match` on a local `var` ("match subject is not a sum type"); `ClosableEndsClosure` takes the record as a parameter for that reason.
     - A law's `var` is evaluated before a later guard: `Law_DecisionAgreesWithEvaluation` first reached `BSplinePoint` on a weightless spline through a `var evaluated = ...` above its `ArenaIsUnevaluable` test; the evaluation moved into a helper called only in the guarded branch, and `||` was not relied on to short-circuit either.
     - The runner's Integer range reaches at most 17 fixture indices; a law over a larger arena checks all of it in one case (`ArenaCurves.All`).
     - The law server's listing of a whole-class run drops a row now and then (two `(RawDecodedModel, Integer)` overloads missing from a 202-law listing, passing by name); a verdict comparison runs missing names alone before calling them regressions.
     - Compiled-backend discrepancy, predating this merge (control run on a `git archive` copy of the committed tree, pinned CLI e37c032f, cpu64): `StepToMeshProofsBSplinesLaws.Law_WellFormedBSplineKeepsRecord` fails at k = 0 compiled and passes interpreted; the baseline verdict file came from the interpreter. Same family as `Law_WitnessIsSameAsItself` (7678b40b).
     - The staged `Law_Prepare_PreparationAgreesWhereDecided` compared the staged preparation to the library's and had nothing to compare after the merge; dropped, so 9 laws landed of the 10 staged.
- **Status** merged; the C# regeneration (E1) and the corpus rerun (D2) are the ticket's open boxes.

## F-60: what the version 1 merges showed (v1-gate, v1-faces, v1-edges)

- **V1G-1 (TKT-418, TKT-416), merged in 7a59273d.** 12 quality laws moved to `10-editing/face-quality.laws.plato`, `Law_RefinedInteriorMeetsMinAngle` deleted, 6 gate laws and `V1GateWitness` in `08-pipeline`.
  - Layer 5's `face-meshing.spec.plato` still states four of the moved laws in invariants and ensures (`Law_ElementNormalAgreesWithSurface`, `Law_SurfaceEdgeNormalTurnWithinSurfaceAngular`, `Law_QuadPlanarWithinSurfaceChordal`, `Law_QuadConvex`). The program is one namespace, so it type-checks, but layer 5 now names layer 10: an upward reference, and the ensures still state quality claims on the gate path. Decision for the supervisor: drop those ensures, or keep the four laws in layer 5 and tag them.
  - The staged `v1-gate.library.plato` held both V1G-1 and V1G-2 content (`PlaneFaceMeshesAt` calls V1G-2's `IsPlaneFace`), so V1G-1 did not type-check alone from its staged files. The section came out at merge and went back with V1G-2. A chunk's files should not be shared with the next chunk's.
  - The warm server answers "0 laws, 0 type errors" (the runner prints "no laws matched") for an unresolved symbol, not only for a misspelled filter; the pinned CLI (`dotnet ~/.plato-cli/e37c032f/Plato.CLI.dll run ... --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --filter=<Block>`) names the symbol.
  - From the track: `SameUvPoints` guards with `&&`, which does not short-circuit, so two triangulations of different sizes make `Law_RefinedIsFaceTriangulation` throw instead of fail; every `Same*` helper written this way has the defect. The host runs no refinement loop, so blocking edge requests are never acted on in the corpus. Layer 5 element laws over a `FaceMesh` parameter pass on 25 generated cases that are not one MeshFace built, so those verdicts say little; `V1GateLaws` states the same claims on four real meshes.
- **V1G-2 (TKT-349, TKT-412), merged in e9d9586f.** `RefineToSurface` calls `RefineToSurfaceV1` (`V1Plane`): a plane face keeps its constrained triangulation, no refinement; both plane laws pass, the 220-segment fine disk meshes in 0.04 s against 1.88 s.
  - The 27 twelve-edge MAYA plane faces are a file defect (TKT-419), not a false collision; 32 of the 45 not-simple plane faces have exact segment crossings that remain at a chordal bound 1000 times finer, 6 are chord artifacts clean at 0.01 mm, 7 are exact touches or slivers (the polystrata spike). `LENA-R8` 1349 is a valid weakly simple face that the shared-vertex rule rejects.
  - The warm server runs the interpreter, which cannot build `CappedWitness` or `CostlyLoopRunWitness`: six laws that pass in `verdicts-cpu64.tsv` (compiled) report "skipped" there. A merge check on `RefinementAttainableLaws` needs the pinned CLI with `--backend=csharp` (292 s for 34 laws, nearly all compile).
  - The staged `v1-plane.library.plato` was changed by V1G-4 (chordal-only refinement) before V1G-2 merged; V1G-2 took the committed version from its own commit (ac4f8c23) and left the staged file for V1G-4. Same lesson as V1G-1: a chunk's staged file should not be edited by the next chunk before it merges.
- **F1 (TKT-415), merged in 1369e852.** `QuadGridOnSides` keeps a grid through `GridUnlessFoldedOrCoarse`: no folded element and every element within SurfaceChordal at the samples refinement uses. The bump solid's top (one flat quad before) and the torus get the refined triangulation; `Law_V1Gate_QuadSplitsWithinChordal` now passes.
  - The library's grid broke the chordal bound on every doubly curved four-sided face, not only the bump: a cell's deviation is about the sum of its two directions' sagittas and the boundary bounds each alone (torus witness, hemispheres, sphere zones). Cylinders and cones keep their grids.
  - Cost, from the track: refining the whole torus witness (major radius 2.5) at chordal 0.01 exceeds a 60 s law budget, and the bump solid of bump 0.5 at chordal 0.01 does too (`ProjectBySearchBody` under `NeedsRefinementCarried`, TKT-351). Corpus tori are small fillets, so the corpus cost is probably small but unmeasured; F1b (a finer grid in place of a full refinement) is the track's proposed answer.
  - After the merge `Law_V1Faces_GridKeptUnlessCurvedBothWays` would have compared the library with itself; it is now `Law_V1Faces_GridRefusedWhereCurvedBothWays` (the refusal half only). No law states that every other four-sided face keeps its grid.
- **E3 (TKT-400), merged in d02f0f52.** Implicit edge keys are ranks (below twice the use count), `ShellPolyEdges` carries `EdgeLow` and `EdgeHigh`; the packed key `(a * N + b) * 2` is gone. Under cpu64 (the profile the mesher uses) Plato's `Integer` is 64-bit, so the packed keys could not overflow there; TKT-400's defect is real only under gpu32, and the ticket text predates that check.
  - The stdlib `Sort`/`SortedIndices` with a closure comparator costs about 300 us per comparison on the server (12 s for 40,000 three-key uses), and `DistinctCount` sorts the same way; a counting sort over the class range does the same order in about 40 ms. `CoincidenceRootsByGrid` sorts every poly point with a comparator, so a shell of 33,000 poly points exceeds a 2 s law budget in that sort alone. Any shell-scale law over tens of thousands of elements meets this.
  - `CoincidenceRootsPairwise`'s `i * n + j` also overflows a 32-bit Integer above 46,340 points under gpu32; it is the quadratic reference only, not on the production path.
  - Merge: the track's `ShellImplicitEdges` was merged as `ShellPolyEdges` with two more fields rather than as a second type, so no caller changed and `PolyEdges` (the identity) was not needed.
- **E1 (TKT-413, TKT-419), merged in 367d9dfb.** `PrepareModelWith` runs `LoopsChained` after `Reduced`: loops that do not chain head to tail are re-chained, arcs written with their vertices the wrong way round are reversed (`STEP-EDGE-REVERSED`), other changes are coedge flips (`STEP-COEDGE-SENSE-FLIPPED`). The three MAYA REVC files lose their 4 non-manifold and 4 misoriented edges and their not-simple plane faces (track's scratch regeneration; to be repeated by the real one).
  - A mesh check alone would have accepted the wrong repair: coedge flips also chain the loop and clear the check but keep 352 degree arcs where the corner is 7.7 degrees. Only the geometry the loop's lines imply tells reversal from flip.
  - M2-MAYA-W271's defect is not a broken loop: faces 1672 and 1730 are needle cones (TKT-420, layer 5). TKT-419's third box (a located diagnostic for an unchainable loop) is still open.
  - Process: the V1G-1 merge broke the layers 00 to 08 compile (layer 7 called laws that moved to layer 10) and the warm server did not see it, because it compiles every folder. Fixed in a0904cc1 by moving four quality checks to layer 10; every later merge compiled layers 00 to 08 alone with the pinned CLI first.
- **E2 (TKT-414), merged in 2770f293.** A surface curve whose master is a pcurve takes that pcurve's `ClosestParameter` and, when the pcurve repeats, a periodic domain of one period (`MasterPcurveDomain`); `DiscretizeEdgeRangedCounted` refuses a range that is not finite, not increasing, or longer than 2^20 effective minimum lengths (`IsTractableRange`). NINA-B222's four edges had ranges near [-5.3e29, 1.1e30] and did not return; on the track's scratch regeneration they get [pi/2, pi] and return at once.
  - `MasterPcurveDomain` (layer 1, `geometry-curves`) and `PcurveSearchDomain` (layer 1, `bspline-along`) state nearly the same rule, [0, T) periodic for a repeating pcurve, but test different things: no seam against not periodic. On a closed aperiodic pcurve with a period, `PcurveSearchDomain` would replace a domain that need not start at 0. Not merged into one here; one of the two should call the other once the difference is decided.
  - `ConicCount` does not look through a surface curve to its space curve, so every SURFACE_CURVE edge, even a circle's or a line's, takes bisection (ELLA-W1 has 20,684). `Parallel.For` blocks hold the rest of a block behind a row that does not return (21 edges behind 4 here); `StepPlatoMesher.Rows` (TKT-403) has the same shape.
  - law_lint (920e869a) on the staging folder: one staged comparison, `Law_V1Edges_WitnessEdgeRangesKept` (`EdgeDomainV1` against `EdgeDomain`), restated at merge as `Law_V1Edges_WitnessEdgeRangesTractable`. Its 16 "unguarded" findings are in library files the chunk does not touch, the same 16 for every staging folder (03-step `step.laws` 553 and 568, 04 `discretization-work.laws` 22, 05 `face-meshing-lift.laws` 115, 123, 128, `face-meshing.spec` 36, `triangulation-witness.laws` 42, `uv-regions.library` 387, 06 `mesh-assembly-indexed.laws` 81, 07 `validation-checks-face-meshing-once.library` 93, `validation-oracles-once.laws` 64, 08 `bspline-pipeline-run.laws` 78, `pipeline-edge-tables.laws` 85, `pipeline-loop-chaining.laws` 192, 09 `tooling-law-runner.laws` 110).
  - `compile-layers-00-08.sh` counts lines matching `RESOLVE` case-insensitively, and the c8c83c8b CLI prints "Creating symbol resolver" on every run, so a clean compile reports "error lines: 1".
- **V1G-4 (TKT-399), merged in 568541ff.** `RefineToSurfaceV1` refines a curved face against the chordal bound alone (`RefineToSurfaceChordal`: no angle pass, SurfaceAngular at 180 degrees); the cone's four apex slivers are gone and all twelve gate checks pass on every pole witness (track). In the full compiled sweep no verdict got worse and eight got better, among them the five `PolesLaws` face-check laws; witnesses build in 29 s against 106 s and the laws take 399 s summed against 900 s.
  - `Law_MinAngleNoWorseThanLibrary` compared the insertion refinement with the library's, which has no angle pass now; it is deleted, as the track proposed. The improvement pass (layer 10) has no law on smallest angles until it has its own refinement.
  - The warm server (Plato 951a70ab) reported "Circular expression" and "Unexpected missing body" for this tree after one incremental recompile, and 0 type errors for the same files after a later one. A compile error from the server after an edit is confirmed by a second recompile or by the pinned CLI before it is chased in the code.
  - law_lint on v1-gate: its one staged comparison is V1G-6's (`Law_V1Gate_PinchRuleAgreesAwayFromPinches`); nothing in V1G-4's file. The 16 library "unguarded" findings are listed under E2.
- **V1G-3 (TKT-399), merged in 959130d7.** Twelve gate laws, one per check of `ValidateFaceMesh` at Geometric, over every pole witness (`V1PoleChecksLaws`, 07-validation/poles-checks.laws.plato), all passing; the four quality ones are in `FaceQualityLaws`, where `Law_V1Gate_PoleElementNormalAgreesWithSurface` and `Law_V1Gate_PoleSurfaceEdgeNormalTurnWithinSurfaceAngular` fail, as expected under chordal-only refinement.
  - From the track: before V1G-4 the one gate failure was `ElementFacesFaceNormal` on the cone, 4 of 4,378 elements with corners nearly on one ruling through the apex, made by the angle pass and the angular criterion driving points onto the seam beside the apex; both are quality, and V1G-4 removes them.
  - law_lint: nothing in this chunk's file.
- **V1G-5 (TKT-418), merged in 7c91b3b5.** 121 non-passing laws outside layer 5 triaged in the track (31 fail, 6 error, 84 obligations), none a quality law on its own; the five `PolesLaws` face-check laws and `FaceCheckFailures` are deleted, since `V1PoleChecksLaws` states the same checks one each. Of the table's budget errors, `Law_ValidatedReportIffClean` and `Law_TighterChordalStaysWithinLooserBound` already pass after V1G-4, as the track predicted.
  - `PolesWitnessLaws` keeps two helpers, `FaceChecksHoldOn` and `PoleFaceChecksHold` (07-validation/poles-witness.laws.plato), that no law calls; and the witness comments in `poles-witness.library.plato` name laws replaced earlier (`Law_SphereMeshIsSound`, `Law_TorusFaceChecksHold`). Not changed here; a sweep can remove both.
- **V1G-6 (TKT-412), merged in 56d3216c.** `SegmentsSeparated` accepts a pinch (two segments of one loop meeting only at one exactly shared end); the ear clippers skip a point at an ear's corner exactly; `MeshRegion` gives zero-width regions FACE-ZERO-WIDTH and a non-keyhole pinch FACE-LOOP-NOT-SIMPLE. The 8 pinch laws pass and no other verdict changed.
  - From the track: LENA-R8 1349 is one loop of 66 points through two vertices twice, not three loops, so the fix is the collision rule and the clippers, with no loop split. The clippers' index-only skip test blocked every ear at a pinch (44 of 64 triangles on face 1349). The keyhole test is what keeps MAYA-W260 face 1599 (a 5-gon pinched to a disc outside it) not simple.
  - Two loops that touch at a vertex stay not simple: the triangulator's hole bridging does not cover a touching hole (4 of 8 triangles on the synthetic case).
  - law_lint's staged comparison here, `Law_V1Gate_PinchRuleAgreesAwayFromPinches`, still says something after the merge (every pair against the grid under the new rule), so it was kept and its comment restated, not dropped.
- **V1G-7 (TKT-399), merged in 08b97f9e.** `Check_LocalVertexFibresAreIdentifications` and `Check_LocalVertexSurjective` call n log n forms that build the same `Check`; the quadratic bodies stay as `...Reference` for the agreement laws. From the track: on HEAD's angle-pass meshes the reference checks passed the 120 s cap on every pole witness and the indexed ones took 2.5 to 35 s; with V1G-4's chordal-only meshes either form is under 2 s, so V1G-4 met TKT-399's criterion and V1G-7 keeps it on large faces.
  - What remains of `ValidateFaceMesh`'s time on a large face is the geometric checks (a surface projection per element sample), linear in the elements.
- **F3 and F3b (TKT-411), merged in edb4ae49.** Unwrap ends with `ClosedAtPole`, `IsBandPair` tests its count with a conditional, `ExpandedPoint` measures the pole gap against the parameter floor, and a whole pole segment takes at least three steps. The three new laws pass; no other verdict changed.
  - Three causes, not one (track): a half-turn lune ties its two unwrap copies, a `&&` chain does not guard what follows it, and the point tolerance at a pole is half the period. The `&&` defect is the same as `SameUvPoints`' (V1G-1's finding): any `&&` used as a guard in this library is suspect, and law_lint lists 15 more.
  - From the track's scratch regeneration: the needle cones (MAYA-W160, MAYA-W260_REVC) and the single-winding cylinders now mesh with folded elements where they were holes, so MAYA-W160's non-manifold and misoriented counts rise from 0 and 0 to 6 and 12 until F4b (TKT-421). The supervisor merged F3 ahead of F4.
  - `Law_V1Faces_SingleWindingLoopIsNoBandPair` would have held vacuously after the merge (its loop no longer winds); it is restated on a parallel of the sphere, which winds alone by construction.
- **F2 (TKT-401), merged in 8e10a3f2.** All three insertion tests keep a point only when the triangles it writes are at least ten length tolerances thick, or thicker than those they replace.
  - `Law_V1Faces_BumpTopHasNoDegenerateElement` passes on HEAD without F2 since V1G-4 (2.2 s): the bump's 15 degenerate elements came from refinement against the 15 degree normal bound, which version 1 no longer runs. TKT-401's witness is met by V1G-4; F2 stays as a guard with no failing witness. A witness that fails without it under chordal-only refinement would make it testable again.
  - From the track: the effective minimum length as the bound refused too much (LENA-R8 lost points on 78 faces); and a `&&` in the fast path would evaluate `ChangedNear` for a refused point, which throws, so the wiring there is a conditional.
- **T1 (TKT-435), merged in a5855daa.** `GridUnlessFoldedOrCoarse` keeps a grid only when every triangle of both diagonal splits faces the face normal and is within the chordal bound (`DecideGridChordal`), the rule the gate and the contract state; F1's nearer-triangle rule is deleted. The witness grids are kept and refused as before (F1's three laws and the keep half pass); a quad twisted along its other diagonal is now refused.
  - Under the law CLI e37c032f, `Law_V1Types_EarlyExitAgreesWithAll` errors with "no ground TIR for moved member ... EarlyExitAgreesOn (not monomorphized)"; under c8c83c8b, the regeneration's pin, it passes. The verdict file is from e37c032f, so a law that depends on a newer compiler shows as an error there until the sweeps move to c8c83c8b.
  - From the track: three readers measured a quad three ways; `FlatElementDistance` (and so `ElementCoverageGap`) still takes the nearer triangle on the diagonal from corner 0. The optional switch to `FlatElementDistanceBothSplits` is not made; it changes a validation measure and wants its own check.
- **V1G-8 (TKT-429), merged in 966a5d35.** `JoinedByCut` ends a band's seam cut at `BandEndCopy`, the nearest copy of the second circle's point on the face's side; on a torus band the copies one period either way across are equally near, and the old cut meshed the inner half of moon_buggy_asm.stp face #34380's tube where the file bounds the outer. Without the edit `Law_V1Gate_OuterTorusBandMeshesOutside` fails; the inner band passes either way, since the old tie went its way.
- **V1G-10 (TKT-455, library half), merged in 6e355417.** `QuadSplitsWithin` measures the surface over each split against the nearer of its two triangles; a uneven parametrization no longer fails a quad that lies on its surface (moon_buggy_asm.stp B-spline faces 41 and 117), and the forced bump quad still fails. Merged from the V1G-10 commit's staged files (ae9df102); V1G-11 replaces the library file with its own version.
  - `Law_PowerOfTwoScalingScalesPositions` (StepToMeshLaws) takes 63 to 68 s alone on HEAD and flips between pass and a budget error from sweep to sweep at 60 s.
