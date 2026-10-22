---
id: TKT-445
title: Plato: the type checker accepts a Number returned where a one-field wrapper type is declared
status: done
depends_on: []
owner: session fd0b89d8
session: fd0b89d8-8ba9-4f59-823d-f14d31e00db9
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/Checking/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/tracker/decisions/**]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] A function declared to return ModelLength { Value: Number } whose body is a Number is a type error from the Plato checker, not from the C# compiler; a test in C:/Users/cdigg/git/plato/tests shows it
- [x] The same holds for an argument and a field of a one-field type, or the ticket records the rule chosen in tracker/decisions

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). The compiler-399 decision says the checker never converts a value into a one-field type, but Solver.cs (src/Plato.Compiler/Checking/Solver.cs:744, 777) still unifies a Number with a one-field record at return boundaries, and only the C# compiler rejects it because the writer emits the bare value (writers/Plato.CSharpWriter/TirCSharpBodyWriter.cs:399-407). Every typed wrapper the STEP mesher declares (ModelLength, CurveParameter, typed indices) rests on this check. Not probed; first step is a failing test. Can start now.

## Outcome (2026-10-22)

The probe confirmed the defect, though only in part. Before the fix, a bare Number returned where ModelLength was declared, and a tuple `(x, x)` returned for a struct whose first field is a ModelLength, both checked clean. A bare Number passed as an argument or as a constructor field was already a CHK201 error, because argument matching never wrapped. The leak was `ValueConvertsToSingleFieldStruct` in `Solver.TryCoerce`, which return-position coercion and tuple elements both use.

- Plato 5096cd1c: removes that rule; `tests/PlatoTests/SingleFieldWrapCheckerTests.cs` covers a return, an argument, a constructor field and a tuple field, each bare (must be an error) and explicitly wrapped (must be clean). No new rule needed recording: the checker now follows the existing compiler-399 decision (`tracker/decisions/2026-08-02-single-field-mirror-unwraps-only.md`).
- Plato 78a7776d: the legacy stdlib tripped 12 new errors, which took the legacy checker ratchet (`CheckerCompletenessTests`) from 26 to 38. All 12 were in `legacy/stdlib-legacy/transforms.plato`: Transform3D, Invert, Compose, TranslationX/Y/Z, UniformScaling3D and five Identity overloads returned a Matrix4x4, Vector3 or Quaternion where the wrapper was declared. Each is now a one-line `new T(payload)`, and the ratchet is back at 26.
- Forward stdlib: 0 new diagnostics (the `ForwardStdLibCheckerTests` ratchet stays at 0).
- STEP mesher (`sandbox/step-brep-mesh`, with the stdlib's brep.* files excluded and `*.spec.plato` left out): `TypeChecker.CheckAll` reports 0 error diagnostics with the new compiler and with the pinned e37c032f compiler. Its info-level diagnostics are unchanged, except one CHK204 line that the new compiler no longer prints. Codegen degrades 1 body (the stdlib's `Tween.Change`); the pinned compiler degrades 2.
