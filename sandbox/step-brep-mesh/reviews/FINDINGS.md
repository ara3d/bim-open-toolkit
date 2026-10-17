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
