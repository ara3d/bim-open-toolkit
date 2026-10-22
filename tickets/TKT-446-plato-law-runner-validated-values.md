---
id: TKT-446
title: Plato law runner: draw a type's values through its Witness_ or generator function when one exists, so a tolerance is never 0 or negative
status: done
depends_on: []
owner: session 1111342c
session: 1111342c-0878-4c81-bd20-b96bd0401645
fence: [C:/Users/cdigg/git/plato/src/Plato.Laws/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/LawRunner.cs, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/**]
workflow: [W3]
related: [TKT-423, TKT-435]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] When a library declares a generator for a type (a Generate_ or Witness_ function with that return type, by a rule written in the runner's docs), the runner draws that type's law arguments from it and never builds the type field by field
- [x] A test law over LengthTolerance-like type with a generator receives no value with Value <= 0
- [x] Rerunning the 23 model-validity laws of TKT-423 under the runner with the STEP mesher's tolerance generators shows which still fail, recorded in that ticket

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). The runner constructs LengthTolerance and AngleTolerance field by field, so it draws 0 and -0.5 and at least 25 STEP mesher laws fail on values no constructor would make (TKT-423; math review F12; FINDINGS F-58 placement laws). Refinement types would remove this at the source; a generator rule in the runner is the cheap step. Can start now: Plato repository only.

## Result (2026-10-22)

- Rule (Plato 7859fdce, docs/interpreter.md "The law runner"): a bodied `Generate_X(seed: Integer): T`, or `Generate_X(_: T, seed: Integer): T`, for a declared type T makes `ValueGenerator` draw every T from its generators (seed 0 to 15) and witnesses, as a law argument, a field of another value, or an interface implementer; never field by field. It lives in `ValueGenerator`, so the interpreter, the compiled backend and the differential run all follow it. A faulting generator is a law error naming it and the seed.
- Tests: tests/Plato.Interpreter.Tests/GeneratorTests.cs (5 tests; 200 cases per law over a Tolerance with a generator, on the interpreter, C# and differential backends, none with Value <= 0); the whole Plato.Interpreter.Tests passes, 90 of 90. PlatoTests references neither changed project; its 6 failures that run came from other sessions' uncommitted compiler and stdlib edits in the shared checkout.
- TKT-423's 23 laws with sandbox/step-mesh-staging/v1-generators (toolkit 868bca3d): 0 pass before, 6 pass after; the 17 left are over CurveDomain, Check, Report and the B-spline data types, recorded in TKT-423.
