---
id: TKT-445
title: Plato: the type checker accepts a Number returned where a one-field wrapper type is declared
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/Checking/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/tracker/decisions/**]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A function declared to return ModelLength { Value: Number } whose body is a Number is a type error from the Plato checker, not from the C# compiler; a test in C:/Users/cdigg/git/plato/tests shows it
- [ ] The same holds for an argument and a field of a one-field type, or the ticket records the rule chosen in tracker/decisions

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). The compiler-399 decision says the checker never converts a value into a one-field type, but Solver.cs (src/Plato.Compiler/Checking/Solver.cs:744, 777) still unifies a Number with a one-field record at return boundaries, and only the C# compiler rejects it because the writer emits the bare value (writers/Plato.CSharpWriter/TirCSharpBodyWriter.cs:399-407). Every typed wrapper the STEP mesher declares (ModelLength, CurveParameter, typed indices) rests on this check. Not probed; first step is a failing test. Can start now.
