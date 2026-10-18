# Plan for the design pass

How the design in this folder is produced, by whom, in what order, and what "done" means for a
design that deliberately writes no algorithm bodies. Ticket: TKT-299. Session:
`5da41e98-0df3-498e-a994-ac6c1ed53928` (2026-10-17).

## What done means

A design pass is done when an implementer could start any task in [TASKS.md](TASKS.md) and meet
these conditions without inventing a rule:

1. Every type the library needs is declared in a `.types.plato` or `.concepts.plato` file, with a
   comment stating its meaning and non-obvious invariants, and its invariants in a `spec` block.
2. Every function the pipeline calls is declared in a `.library.plato` file, with a body when the
   body is the specification and a `// deferred:` note plus a `spec` contract otherwise.
3. Every rule the README of a layer states in prose is also a `Law_` function.
4. Every approximate statement names its tolerance.
5. A fresh reviewer, reading only this folder and the stdlib index, finds no name used but not
   declared, and no law in one layer that contradicts a law in another.
6. The real-Plato files parse and resolve against the stdlib, or the reason they could not be run
   through the front end is recorded under Phase 3 below.
7. [TASKS.md](TASKS.md) orders implementation into chunks of one to a few files, each naming the
   laws it must make pass and the witnesses it must accept.

## Why this shape

The owner asked for a first-principles design in which the rules are encoded before any algorithm is
written, so that implementation holds few surprises. Three consequences shaped the plan:

- **Distil before designing.** The source material (ISO 10303-21 and -42, the AP242 recommended
  practices, the meshing literature, the stdlib, the existing IFC mesher) is far larger than any one
  author can hold beside the design. Phase 1 reduces it to five documents of a few pages each, written
  for the design authors, and the design authors read only those.
- **Fix the contract before fanning out.** Plato has one global namespace. Nine authors inventing
  names in parallel would collide, so [VOCABULARY.md](VOCABULARY.md) was written first and each
  author writes against it and records deviations in it.
- **Review with fresh eyes, then gate mechanically.** Phase 3 reviewers did not write the layers
  they review. The parse-and-resolve gate is the one mechanical check available to a design with no
  bodies, and it catches the most common surprise: a name that does not exist.

## Phases

### Phase 0: orientation and contract (the supervising session)

Read the Plato stdlib's conventions, style, library, and verification documents, its B-rep v1,
topology, mesh, curve, surface and spline declarations, the language semantics, and the location of
the existing IFC mesher. Wrote `README.md`, `SPEC-DSL.md`, `VOCABULARY.md`, this file, and filed
TKT-299. Committed as the first milestone.

### Phase 1: distillation (five agents in parallel)

Each writes one document and returns a short summary with open questions. Model: Opus for the four
that need judgement, Sonnet for the code read.

| Agent | Output | Brief in one line |
|---|---|---|
| Plato primer | `PLATO-PRIMER.md` | The language and stdlib exactly as a design author needs them: declaration grammar, the law convention, the reusable vocabulary with file names, the limits (no recursion, no generic sums, interface-typed fields, `Number` width, `&&`) with evidence from the compiler or docs |
| STEP model | `research/STEP-BREP-MODEL.md` | ISO 10303-21 syntax essentials; the -42 geometry and topology entities used by AP203/AP214/AP242 B-reps with attributes, natural parameterizations, WHERE rules, and the recommended-practice conventions for seams, poles, sense flags, units, and uncertainty |
| Meshing requirements | `research/MESHING-REQUIREMENTS.md` | What a tessellation is commonly required to satisfy, how kernels parameterize it (linear and angular deflection), the algorithm families and their decision points, how watertightness is guaranteed, how seams, poles, and degenerate edges are handled |
| Validation mathematics | `research/VALIDATION-MATH.md` | The theorems and oracles that check a B-rep and a mesh independently of the code that produced them: Euler-Poincare with loops, shells and genus; manifold and orientability criteria; Gauss-Bonnet for closed meshes; divergence-theorem volume; closed-form areas of analytic patches; property-based testing strategy and generators |
| Existing mesher | `research/EXISTING-MESHER-LESSONS.md` | What `deps/bim-open-data/src/data/Ara3D.MeshKernel` and `Ara3D.Ifc.Mesher` do, what they got wrong first, what their tests check, what transfers to STEP and what does not |

### Phase 2: design (nine agents in parallel, Opus)

One agent per layer, each reading `README.md`, `SPEC-DSL.md`, `VOCABULARY.md`, `PLATO-PRIMER.md`,
and the research documents its brief names. Each writes its layer folder: a `README.md` stating the
layer's mathematics, decisions, and what it left open; the `.plato` files of section "How to read
this folder" in the front-door README. Each returns a summary and any change it made to the
contract. Layers 0 to 2 are the foundation others build on; their authors are told that their
exported names are fixed and that the higher layers are being written at the same time against the
contract, so a deviation must be recorded in `VOCABULARY.md` at once.

### Phase 3: review and gate

| Step | Who | Checks |
|---|---|---|
| Name and dependency review | a fresh Opus agent | every referenced name is declared in the sandbox or the stdlib index; no layer references a higher layer; no name declared twice; contract deviations recorded |
| Mathematical review | a fresh Opus agent | laws are true as stated, sufficient for the README's three constraint groups, consistent across layers; missing invariants named; wrong statements corrected or flagged |
| Parse and resolve gate | the supervising session | the real-Plato files, merged with the stdlib tiers into a scratch folder, run through `Plato.CLI lint`; findings fixed or recorded |
| Tasks | the supervising session with the reviews in hand | `TASKS.md` written from the layer READMEs and the review findings |

### Phase 4: close

Commit, push, update the ticket, and write the final report to the owner naming what was decided,
what is open, and the first three tasks.

## Open questions for the owner

Recorded as they arise; the ticket carries the same list.

1. **`Number` width.** The design assumes a 64-bit real. The C# backend emits `float` today
   (`src/Plato.Intrinsics/Number.cs:21`); TypeScript and Rust are 64-bit; C++, CUDA, GLSL 32-bit.
   `TARGET-LANGUAGE.md` recommends one width per compilation, 64-bit by default on every CPU backend
   and 32-bit only in an explicit GPU profile, over a separate `Double` type (about twenty reused
   stdlib types would need twins) and over "whatever the backend has" (today's accidental state).
   At 32 bits, millimetre coordinates in a 100 m building are 0.0078 mm apart. Decide before the
   first implementation task; the C# change is about 25 code sites (plato-370).
2. **Reconciliation with the stdlib's B-rep v1.** Replace `Brep3D` and friends in place, or ship this
   library beside them under its own names? The design uses the v1 names where meanings match and
   lists the collisions in `VOCABULARY.md`.
3. **Where the library lives.** As a tier of the Plato stdlib (`geometry` cannot hold it: it reaches
   STEP, which is a file format), as a new tier, or as its own repository that depends on the
   stdlib?
4. **Scope of STEP entities.** Advanced B-rep (`advanced_brep_shape_representation`) and manifold
   surface models are in; faceted B-rep is trivially in; assemblies through `mapped_item` and
   product structure are decoded only far enough to find shapes. Confirm.

## Phase log

- 2026-10-17 Phase 0 complete: contract documents written, TKT-299 filed (commit 02c2aacf).
- 2026-10-17 Phase 1: four of five research documents in (`PLATO-PRIMER.md`,
  `research/MESHING-REQUIREMENTS.md`, `research/VALIDATION-MATH.md`,
  `research/EXISTING-MESHER-LESSONS.md`); the STEP entity model still running. Findings that changed
  the contract are logged at the end of `VOCABULARY.md` (revision 2). Facts established with
  evidence: `Number` is a 32-bit float in the C# backend (`src/Plato.Intrinsics/Number.cs`),
  64-bit in the Rust and TypeScript backends; a type may not contain itself directly but may through
  `Array<T>`; an interface-typed field boxes and dispatches at run time; the law runner skips laws
  whose parameters are arrays, sums, zero-field types or interfaces, so this design's laws run over
  witnesses; the stdlib's law-runner script passes a `--scalar=float` flag the CLI now rejects.
  A type-check gate driver (parse, resolve, lint, types, sums, style, over the stdlib tiers plus one
  design folder, excluding the stdlib's `brep.*.plato`) was built and runs in about 15 seconds;
  its source is kept in `tools/PlatoGate/` and its use is in `PLATO-PRIMER.md` section E.3.
- 2026-10-17 Phase 2 wave A launched for layers 0, 4, 6 (independent of the STEP document); layers
  1, 2, 3, 5 followed once `research/STEP-BREP-MODEL.md` landed (commit fead8f9f; 1,933 lines from
  the ISO texts, the three AP long-form schemas, the OpenCascade reader, and a survey of 103 files
  from 13 exporters). Its facts that bind the layers: angles arrive in the file's plane-angle unit and
  the decoder converts once; a cone's v is axial; edge ranges come from projecting the vertices;
  seams and pcurves are optional in practice; poles are never edges. Layers 7 and 8 form wave B after
  layers 0 to 6 exist, because they reference the laws by their actual names.
- 2026-10-17 Phase 2 wave A complete: seven layers committed (foundation 45a5c0b1, geometry
  803a6622, topology 51aaf51f, STEP reading ca580076, discretization 3ae8f2f5, face meshing
  52da481f, mesh 5dabce18). The supervising session ran the gate driver over the 74 `.plato` files
  of layers 0 to 6 merged into one folder, against the stdlib's three shipping tiers with the
  `brep.*.plato` files excluded: `PASS: 0 error(s) in scope; 5326 functions type-checked (23.2s)`,
  with only LINT003 informational notes (fields no function reads yet). Each layer's README ends
  with a "Changes to the contract" section; the Phase 3 name review folds them into VOCABULARY.md
  revision 3. Wave B (validation, pipeline) launched; the mathematical review of layers 0 to 6
  launched in parallel since those laws are final.
- 2026-10-17 Phase 2 wave B complete: validation (0fc198ec; 472 checks, 15 oracles, 20 witnesses
  as values) and pipeline (7bb5f53f). Gate over all nine layers merged: `PASS: 0 error(s) in scope;
  6357 functions type-checked`. The mathematical review of layers 0 to 6 (4023d412) found 12 false or
  imprecise laws, 11 missing, 11 cross-layer inconsistencies, 9 timid choices, 4 false theorems;
  layers 7 and 8 recorded further findings in lower layers. Phase 3 fix wave launched: nine fixers,
  one per layer, under `reviews/FIX-WAVE.md` (the cross-layer decisions: a `Closed(Period)`
  periodicity case, `Check.Bound`, `Provenance` gains curve, surface and whole-input cases,
  per-dimension parameter floors, the rounding floor at the coordinate extent, and the owner of each
  duplicated declaration), one commit per finding. The name-and-dependency review and vocabulary
  revision 3 follow the wave, then the gate, then `TASKS.md`.
- 2026-10-17 Two owner-requested investigations run beside the design: `SPEC-EXECUTION.md` (how to
  make the spec DSL executable: validate, prove, generate tests; inside Plato, a separate language,
  or convention plus tooling) and `TARGET-LANGUAGE.md` (which backend to implement on first, and
  what `Number`'s width should be).
- 2026-10-17 `TASKS.md` written while the fix wave runs (it depends on no fixer's output): eight
  chunks A to H, eight test modules of which seven need no parser, the dependency graph, and the
  coordination record with the parser session. Finding F-45 (no hand-built `Part21File` witness in
  layer 3) recorded. An agent writes the adapter test spec under `adapter/`: five STEP text
  fixtures, their expected `Part21File` literals, and `ADAPTER-SPEC.md` for whoever builds the
  `StepDocument -> ParsedFile` adapter.
- 2026-10-17 Fix wave complete: 125 commits across the nine layers (9, 18, 19, 10, 18, 17, 13, 13,
  14 for layers 0 to 8), each one finding, every fixer reporting no findings in its own folder;
  layer 7 last, with the all-layer gate at `PASS: 0 error(s) in scope; 6716 functions
  type-checked` (adapter folder included). Cross-layer changes landed as `FIX-WAVE.md` predicted
  plus three it did not (the floor arguments of `ParameterToleranceAt` and `UvToleranceAt`,
  `DiagnosticOf` and `ReportOf` without a bound, `GeometrySet.Closures`), relayed to the affected
  fixers by message while they ran. Layer 3 was resumed once to write the `ClosureMark`s layer 1
  reads. Leftovers in `reviews/FINDINGS.md` F-47. The adapter test spec landed under `adapter/`
  (F-46); the parser session took its two parser-side asks as TKT-310. The name-and-dependency
  reviewer is launched: single declarations, no upward references, stand-ins resolved,
  `VOCABULARY.md` revision 3, the adapter witnesses' home, the final gate.
- 2026-10-17 Name-and-dependency review complete, six commits (81a4f6b2 to be3a8848): three
  same-signature duplicates deleted (`IsRedundantVertexLoop` in layers 5 and 7, `LoopOfBoundaryPoint`
  in 7, `WithEveryFaceReversed` in 8); one upward reference removed (layer 7's witness laws that
  meshed through layer 8 moved to `08-pipeline/pipeline-witnesses.laws.plato`); every `belongs-in`
  stand-in moved to its owner (`ScaledTolerances` to 0, `DefiningPoints` and the `Moved*` family to
  1, criteria `ScaledBy` to 4 and 5); `Law_SeamUsesAreInOneFace` renamed `Law_SeamUsesRunOpposite`
  in layers 2, 7, 8; the adapter witnesses moved to `03-step/step-witnesses.laws.plato`
  (`StepWitnessesLaws`, generator output matches byte for byte); `VOCABULARY.md` revision 3 with
  72 contract-change lines. Final gate `PASS: 0 error(s) in scope; 6710 functions type-checked`.
  Five design questions recorded as F-48. The parser's TKT-310 landed (diagnostics with byte
  offsets, ten header fields); the adapter spec carries the mapping. Phase 4: README status,
  ticket acceptance boxes ticked, final report to the owner. The design pass is done.

- 2026-10-17 Implementation started. Chunk A (TKT-314) landed in nine commits (d80f3e89 to
  36c893f8): bodies in layers 0, 2, 4, 5, 6 derived from their contracts (layer 2's deferred count
  11 to 1), the F-47 and F-48 mechanical items, `SameModel` compares every table. Provisional
  results through the builder's scratch harness (the writer fixes were landing underneath it):
  `Witness_UnitBox` meshes to 8 vertices and 12 triangles, closed, oriented, reduced Euler
  characteristic 2, volume 1, `Rounds` 0, `Ok` true; all 317 chunk A law evaluations true; layer 2's
  laws true on nine positive witnesses (the B-spline solid reaches chunk F's deferred
  `BSplinePoint`) and the three negatives fail exactly their named laws; layer 4's hold except
  `Law_TurningAngleWithinAngular` on full circles at 32 bits. Gate `PASS: 0 error(s) in scope; 7112
  functions type-checked`. The tooling layer `09-tooling` (TKT-316) landed in six commits: law
  runner, diffs, dumps, generators, nothing run yet. TKT-315: five of six writer fixes on Plato main
  (nested conditionals 5c2ad367), the whole-library build at 8 errors. The parser session resumed
  TKT-312 against the fixed types. Leftovers in F-52.

- 2026-10-18 Paused by the owner. State at the pause: TKT-315 everything green committed (last
  Plato commit afb1f304, ticket log ce393d3e); whole library under both profiles, 1,257 files,
  8 errors (3 bodiless stubs, fix 6 reverted and kept as a patch at
  `scratchpad/number-profile/fix6-bodiless-stubs.patch` because it also stubbed a scalar intrinsic
  forwarder, plato-459; 3 stdlib-460 defects; 2 CS0305 generic constructor without type argument);
  64-bit `Integer` and the cube-law run not started. The owner's interpreter experiment
  (`src/Plato.Interpreter`, `Plato.CLI/RunCommand.cs`) is in the same checkout, untouched. The
  parser session continues TKT-312 into bim-open-data (`Ara3D.StepBrep`) from an archived Plato
  copy. Chunk B not launched. Decisions with the owner: STEP's purpose in PROJECT.md (ticket
  review's first recommendation), chunk B, closing TKT-299 and TKT-300.

## Decided by the owner during the pass

- 2026-10-17, governing: **Specifications and laws drive development; the aim is a high likelihood
  of working out of the box.** The owner stated this as the project's philosophy after the
  discussion of development turnaround. Consequences for the implementation: a body is derived
  from its contract and laws, in Plato, and the laws run over the witnesses before and after it
  is written, so the law runner exists before the first body; existing C# routines (the Ara 3D
  SDK's Delaunay, earcut, welding, topology) are oracles, second implementations the laws compare
  against, not the bodies; C# first is reserved for exploration where the specification is not
  yet known, and such a body is replaced, not ported, once the specification is written; the C#
  writer's correctness is itself a precondition (F-50), so a writer regression test and the
  interpreter-versus-backend differential test (TKT-317) come before backend law results count
  as evidence. `TASKS.md` "Development mode" states the same.
- 2026-10-17, last: **Parsing and decoding in C#, geometry in Plato; implementation starts.**
  TKT-306 was decided in the parser session ("reuse the C# reader and parser but write the
  geometry algorithms in Plato") and relayed here; the owner then approved this session's
  recommendation to start implementing on four parallel tracks ("go for it"). The boundary moves
  from `Part21File` to `RawDecodedModel`, the B-rep as written, with Plato's `PrepareModel`
  making the four geometric decisions (closure, mirror fold, tolerance floors, reduction repairs).
  Layer 3's schema table and WHERE laws become the specification for the C# typed layer's checks;
  F-1 is resolved by generated types and TKT-300 is unnecessary. `TASKS.md` chunks D and E are
  rewritten; TKT-312 (C# decoder), TKT-313 (call into compiled Plato) and TKT-311 (does the C#
  writer compile the constructs) are the parser session's; chunk A and the `Number` profile are
  this session's, under their own tickets.
- 2026-10-17: **Tests depend on as little as possible; coordinate with the parser session.**
  The owner asked for speed, for tests that do not depend on too many other things, for
  development and testing from first principles, and for as much modularization as that needs.
  `TASKS.md` is written to it: eight test modules, seven of which never read a file; shapes enter
  as `BrepModel` witnesses before STEP text; decode tests use hand-built `Part21File` literals
  (finding F-45); the C# parser (`Ara3D.IO.StepParser`, the session "STEP file geometry parsing
  with Ara 3D", `docs/plans/step-reader.md`) meets the design through an adapter whose test spec
  this side writes (`adapter/`). TKT-306 asks the owner how the two efforts relate.
- 2026-10-17: **Plato can change; optimize for the long run.** The first versions of
  `SPEC-EXECUTION.md` and `TARGET-LANGUAGE.md` recommended the least-effort path (leave the compiler
  unchanged, convention plus tooling, the one backend that works today). The owner rejected that
  framing: most compiler and backend gaps are solvable without significant effort, and the question
  that matters is what makes the creation and validation of the library efficient once code
  generation works. Both reports were revised under that premise; the measured facts about the
  current state stay as the gap to close, not as the constraint.
- 2026-10-17: **STEP parsing stays in C#, for now.** The owner started a separate agent to see
  whether the existing IFC parsing code (`deps/bim-open-data`, `Ara3D.IfcTypes` and its
  EXPRESS-driven generator) can read STEP Part 21 files, so that Plato concentrates on extraction
  of properties, relationships and B-reps, geometry, meshing and validation. The boundary is the
  `Part21File` value of layer 3: the host produces it, Plato decodes it. `ParseStep` and printing
  become host obligations (bodiless declarations, Plato's FFI); the schema model, decoding, and
  layer 3's laws stay in Plato, with the parse-print-parse and reference laws checked by the host's
  tests. Layers 0 to 2 and 4 to 8 are unaffected. The TypeScript backend will later need the same
  host service in TypeScript. Finding F-1 (`reviews/FINDINGS.md`) stays on hold as decided.
- 2026-10-17: **no OpenCascade dependency**, in the library or its tests. This settles
  `TARGET-LANGUAGE.md` open question 6 (which OpenCascade-based oracle) and `SPEC-EXECUTION.md`
  open question 11 (OpenCascade as a test dependency): neither. Differential testing, where wanted,
  uses the design's own oracles, witnesses with known measures, and public files with published
  properties; the validation layer and `TASKS.md` are written to that.

## Additional open questions from Phase 1

5. **Law discovery.** The conformance runner looks for `Law_` members as instance methods on
   generated types; library functions are emitted as static classes. Whether the runner finds the
   sandbox's laws at all is unverified (PLATO-PRIMER.md, open questions). A task in TASKS.md.
6. **Where the gate driver lives.** `tools/PlatoGate/` here, or `tools/` in the Plato repository.
7. **The v1 B-rep files.** The gate excludes them so v2 can reuse the names. When the library moves
   into the stdlib, v1 is replaced; until then nothing compiles both at once.
