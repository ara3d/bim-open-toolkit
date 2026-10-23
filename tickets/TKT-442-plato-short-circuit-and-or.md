---
id: TKT-442
title: Plato: && and || short-circuit, so a count test guards the index on its right
status: done
depends_on: []
owner: session b0e9acbc
session: b0e9acbc-608f-4854-9b71-692abd4d2617
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/stdlib/foundation/primitives*.plato, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/SEMANTICS.md]
workflow: [W3]
related: [TKT-411, TKT-435]
confidence: high
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] In the interpreter and every backend the right operand of && is evaluated only when the left is true, and of || only when it is false; a test in C:/Users/cdigg/git/plato/tests shows xs.Count == 2 && xs[1] == 0 returning false on a one-element array instead of throwing
- [x] docs/SEMANTICS.md section 6 states the new rule; the law runner's differential run (interpreter against C#) agrees on the new test
- [x] All and Any over an array stop at the first deciding element, or the ticket records why they cannot
- [x] The STEP mesher's law sweep (sandbox/step-brep-mesh, plato_laws.py with the cpu64 profile) has no verdict that changes from pass to fail or error

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato's && and || are the ordinary functions And and Or, lowered to C# as this & b, so both sides always run. In the STEP mesher this caused the ArgumentOutOfRangeException on 30 corpus faces in 7 files (TKT-411 cause 2: IsBandPair, sandbox/step-brep-mesh/05-face-meshing/uv-regions.library.plato:387, winding.Count == 2 && ... loops[winding[1]]), law errors where laws should fail (SameUvPoints, 05-face-meshing/face-meshing-lift.laws.plato:116), and 109 (a ? b : false) guards, which a writer bug once mis-parenthesised (FINDINGS F-50). Plato values are pure, so the change alters only programs that threw or did not terminate on the skipped side. If a full change is too large, a first step is a lint warning on an index or At call on the right of && whose left side tests a Count. Can start now: it touches only the Plato repository.

## Outcome (2026-10-22, Plato 33604a12)

- The elaborator rewrites a call to And or Or whose arguments and result are Boolean into a conditional (`a ? b : false`, `a ? true : b`; Plato `src/Plato.Compiler/Checking/TirShortCircuit.cs`). Every backend reads the elaborated TIR, so the interpreter and the C#, C++, GLSL, Rust and TypeScript writers share the rule; Rust and TypeScript print it as their native `&&` and `||`. An And a library defines for its own type, or one reached through a type variable, stays an ordinary call.
- Test: `tests/Plato.Interpreter.Tests/ShortCircuitTests.cs`. `xs.Count == 2 && xs[1] == 0` is false on a one-element array; the fixture's laws error with an index out of range under HEAD's CLI and pass with the change; the differential run (interpreter against compiled C#) reports no mismatch.
- All and Any: they stay folds over `&&` and `||` (`stdlib/foundation/primitives.library.plato`). The predicate is not called once the answer is decided, but the fold still visits the remaining elements, because a Plato body has no early exit; stopping the loop itself is a backend override (plato-368).
- Law sweep, HEAD a7aeeb36 against the change, both CLIs on one frozen copy of the stdlib and of `sandbox/step-brep-mesh` (stdlib `brep.*`, `remeshing.*`, `lattices.*` excluded as in `tools/shipped-program.txt`), cpu64, budget 20 s, 1,461 laws: HEAD 1,285 pass, 28 fail, 50 error, 84 obligation, 14 skipped; the change 1,332 pass, 28 fail, 9 error, 78 obligation, 14 skipped. No verdict moves from pass to fail or error; 40 move from error to pass (budget errors at HEAD, the machine was loaded during that run) and 6 from obligation to pass (StepWhereRulesLaws, a host `SlotOf` call on a skipped right operand).
- PlatoTests: 263 pass, 4 fail, none from this change: the two conversion inventories (single-field wrap casts on the SDF types), OnlyIntrinsicsFileDeclaresHostIntrinsics (`stdlib/future/collision.library.plato`), and the TypeScript flag-on test on `number.MinValue()` against `Number.MinValue()`.
- Left: two comments outside the fence still say `&&` does not short-circuit: Plato `stdlib/foundation/sorting.library.plato` line 47 and `docs/plato-intrinsics-surface.md` line 88.
