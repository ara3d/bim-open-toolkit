---
id: TKT-444
title: Plato: sealed constructors, so a proof type is built only by the functions its declaration names
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/parakeet/Parakeet.Grammars/PlatoGrammar.cs, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/src/Plato.Laws/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-435, TKT-415]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] A product or sum type can name the functions allowed to construct it (for example 'sealed by CheckMesh'); a construction, tuple conversion, or case construction anywhere else is a compile error with its own code, tested in C:/Users/cdigg/git/plato/tests
- [ ] Field reads and match on a sealed type stay allowed everywhere
- [ ] The law runner builds a sealed type only through a named constructor function or a Witness_ that returns it, never field by field

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato has no visibility modifiers (docs/SEMANTICS.md:387) and every product gets a public constructor (src/Plato.Compiler/Symbols/SymbolFactory.cs:757-772), so the STEP mesher's proof types (CheckedMesh, WatertightMesh, InRangeModel, PreparedModel, and v1-types' GridWithinChordal) are a convention: any function can build one. Six defects in the record are a flag where a proof was needed (TKT-415's grid among them). The sandbox proposal is sandbox/step-brep-mesh/PLATO-SPEC-EXTENSIONS.md section 2.2 ('sealed by'). Can start now: Plato repository only.
