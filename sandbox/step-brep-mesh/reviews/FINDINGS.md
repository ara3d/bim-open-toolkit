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
