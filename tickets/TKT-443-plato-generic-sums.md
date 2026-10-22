---
id: TKT-443
title: Plato: generic sums (Maybe<T>, Decided<T>), lifting CHK306
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/stdlib/foundation/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] type Maybe<T> = Just(Value: T) | Nothing; type-checks, matches exhaustively, runs in the interpreter, and compiles in the C# writer for T a struct, an index type and an array; tests in C:/Users/cdigg/git/plato/tests cover each
- [ ] The sum checker's restriction (src/Plato.Compiler/Checking/SumTypeChecker.cs:27-41) is off by default, and SEMANTICS.md says so
- [ ] The law runner constructs values of a generic sum for a law's parameter

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato rejects generic sums (CHK306). The STEP mesher pays with 39 hand-copied Decided* sums, each with its own ValueOr, and 89 XIndex(-1) sentinels over 16 index types (00-foundation/foundation-indices.types.plato:6 documents -1 as none), because a per-index sum was not worth writing. Sentinels and defaults are the largest class in the mesher's defect record (11 of 58). The library change that follows is a separate ticket. Can start now: Plato repository only.
