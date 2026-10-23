---
id: TKT-443
title: Plato: generic sums (Maybe<T>, Decided<T>), lifting CHK306
status: done
depends_on: []
owner: session 4b11f140
session: 4b11f140-3344-4fac-833b-1090962a8012
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/stdlib/foundation/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
claimed: 2026-10-23
closed: 2026-10-23
---

## Acceptance criteria

- [x] type Maybe<T> = Just(Value: T) | Nothing; type-checks, matches exhaustively, runs in the interpreter, and compiles in the C# writer for T a struct, an index type and an array; tests in C:/Users/cdigg/git/plato/tests cover each
- [x] The sum checker's restriction (src/Plato.Compiler/Checking/SumTypeChecker.cs:27-41) is off by default, and SEMANTICS.md says so
- [x] The law runner constructs values of a generic sum for a law's parameter

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato rejects generic sums (CHK306). The STEP mesher pays with 39 hand-copied Decided* sums, each with its own ValueOr, and 89 XIndex(-1) sentinels over 16 index types (00-foundation/foundation-indices.types.plato:6 documents -1 as none), because a per-index sum was not worth writing. Sentinels and defaults are the largest class in the mesher's defect record (11 of 58). The library change that follows is a separate ticket. Can start now: Plato repository only.

## Result (2026-10-23)

Plato commits 4918d0b3 (checker), a2ef1262 (C# writer), 86e70931 (interpreter), 62bbc40c (law runner), ed7d5e1c (docs). Tests: tests/Plato.Interpreter.Tests/GenericSumTests.cs (Maybe<T> over Number, Integer, an index record, a record, an array, itself, and a sealed generic sum; interpreter, generator, and all 13 laws on both backends with no mismatch), tests/PlatoTests/SumTypeCheckingTests.cs and SumTypeCodegenTests.cs (option.plato). The stdlib's C# output and lint are byte-identical before and after; the STEP mesher's PlatoGate output is identical (its 11 errors are already present at Plato HEAD). Not covered, listed in plato tracker/decisions/2026-10-23-generic-sums-monomorphize-per-use.md: a generic sum nested in a generated value built through a $T helper, a function over Maybe<$T> named like a case predicate (CS0111), and the TypeScript and Rust writers, which reject every sum.
