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
  1. The C# parser's header keeps three strings and drops `OriginatingSystem` and
     `PreprocessorVersion`, which the decoder's repairs key on; the adapter re-reads the header
     section itself (spec, fifth row). Reported to the parser session.
  2. No diagnostic code fits "the parse stopped at an unknown place": `SyntaxError` must name an
     instance (`Law_ParseFindingsPointAtTheirSubject`). The accepted first step uses
     `NotPart21File` at `WholeInput`. Layer 3 should add a code or relax the subject for this case.
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
