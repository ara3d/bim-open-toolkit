---
id: TKT-300
title: Generate the typed STEP entity layer from the EXPRESS schemas and restate the WHERE laws over it, removing string typing from 03-step
status: open
depends_on: [TKT-299]
owner:
fence: [sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/tools/**, sandbox/step-brep-mesh/VOCABULARY.md]
workflow: [W3, W4]
confidence: low
created: 2026-10-17
kind: question
---

## Acceptance criteria

- [ ] a generator reads the AP242 long-form EXPRESS schema (with AP214 and AP203e2 differences noted) and emits, for every entity in 03-step's schema table marked decoded, one Plato record with typed attributes in EXPRESS order (supertype attributes first), one sum per SELECT type, one enumeration per ENUMERATION, and the sanctioned complex-instance combinations as records
- [ ] every Law_Where_* in sandbox/step-brep-mesh/03-step/step-where.laws.plato is restated over the generated typed record, or shown to hold by construction of the generated types, so no law reads an entity, attribute, or type by string
- [ ] the string-keyed Part21File remains the lexical layer only: parsing, printing, provenance, and the unsupported-entity diagnostic path; decoding is Part21File -> typed records (generated) -> kernel (hand-written exhaustive match)
- [ ] the gate driver (sandbox/step-brep-mesh/tools/PlatoGate) passes over all layers with 0 errors after the change, and the 03-step README's 'Decision: no typed StepEntity sum' is replaced by the new decision and its reasons

Phase 3 finding F-1 of the TKT-299 design pass, raised by the owner on 2026-10-17 and recorded in sandbox/step-brep-mesh/reviews/FINDINGS.md. The WHERE laws of 03-step read the file through the schema by string (InstanceIsA(i, "ADVANCED_FACE"), FieldReference(i, "FACE_SURFACE", "face_geometry"), IsExactlyOneOf(..., ["ELEMENTARY_SURFACE", ...])), so a misspelt name or a wrong owner type-checks and makes a law vacuous at run time, against the design's own rules that the catalog is the documentation, that laws are meaningful and total, and that every algorithm is an exhaustive match. The layer author's objection, that a typed layer restates the kernel in about sixty records, falls once the records are generated from the schema rather than written by hand; they are STEP's own types, not a copy of the kernel. Complex instances are a small closed set in AP242 B-rep and get a record per sanctioned combination. If the few remaining string sites (diagnostics, unsupported entities) want compiler help, a string-literal-resolves-to-schema-name check is a small Plato or tool feature to request rather than design around.

## Doubt

2026-10-17, session 5da41e98: The owner said on 2026-10-17 that this ticket is not to be tackled. It stays as the record of Phase 3 finding F-1 (sandbox/step-brep-mesh/reviews/FINDINGS.md). Default if nobody answers: leave it unworked; do not claim it.

Was a task; answer here, then run `ticket.py promote`.
