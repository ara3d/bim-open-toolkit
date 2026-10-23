---
id: TKT-444
title: Plato: sealed constructors, so a proof type is built only by the functions its declaration names
status: done
depends_on: []
owner: session 94713c48
session: 94713c48-0bc0-412c-8002-1d1a0b08657f
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/parakeet/Parakeet.Grammars/PlatoGrammar.cs, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/src/Plato.Laws/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-435, TKT-415]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] A product or sum type can name the functions allowed to construct it (for example 'sealed by CheckMesh'); a construction, tuple conversion, or case construction anywhere else is a compile error with its own code, tested in C:/Users/cdigg/git/plato/tests
- [x] Field reads and match on a sealed type stay allowed everywhere
- [x] The law runner builds a sealed type only through a named constructor function or a Witness_ that returns it, never field by field

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato has no visibility modifiers (docs/SEMANTICS.md:387) and every product gets a public constructor (src/Plato.Compiler/Symbols/SymbolFactory.cs:757-772), so the STEP mesher's proof types (CheckedMesh, WatertightMesh, InRangeModel, PreparedModel, and v1-types' GridWithinChordal) are a convention: any function can build one. Six defects in the record are a flag where a proof was needed (TKT-415's grid among them). The sandbox proposal is sandbox/step-brep-mesh/PLATO-SPEC-EXTENSIONS.md section 2.2 ('sealed by'). Can start now: Plato repository only.

## Outcome

Syntax `type X sealed by F, G { ... }` after `implements` (parakeet f4f9a8a). Plato 3b89ce8a (checker, CHK311, `Checking/SealedConstruction.cs`), 11e63708 (ValueGenerator draws a sealed type from generators, named constructors, or witnesses), 97581899 (SEMANTICS.md section 2, decision `tracker/decisions/2026-10-22-sealed-by-names-a-types-constructors.md`). PlatoTests 289 of 293, the four failures the known unrelated ones; Plato.Interpreter.Tests 95 of 95. The toolkit's Plato pin is not moved; the mesher's proof types are sealed by TKT-451.
