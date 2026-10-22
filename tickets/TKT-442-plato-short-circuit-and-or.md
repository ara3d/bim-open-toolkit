---
id: TKT-442
title: Plato: && and || short-circuit, so a count test guards the index on its right
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/**, C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/stdlib/foundation/primitives*.plato, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/docs/SEMANTICS.md]
workflow: [W3]
related: [TKT-411, TKT-435]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] In the interpreter and every backend the right operand of && is evaluated only when the left is true, and of || only when it is false; a test in C:/Users/cdigg/git/plato/tests shows xs.Count == 2 && xs[1] == 0 returning false on a one-element array instead of throwing
- [ ] docs/SEMANTICS.md section 6 states the new rule; the law runner's differential run (interpreter against C#) agrees on the new test
- [ ] All and Any over an array stop at the first deciding element, or the ticket records why they cannot
- [ ] The STEP mesher's law sweep (sandbox/step-brep-mesh, plato_laws.py with the cpu64 profile) has no verdict that changes from pass to fail or error

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Plato's && and || are the ordinary functions And and Or, lowered to C# as this & b, so both sides always run. In the STEP mesher this caused the ArgumentOutOfRangeException on 30 corpus faces in 7 files (TKT-411 cause 2: IsBandPair, sandbox/step-brep-mesh/05-face-meshing/uv-regions.library.plato:387, winding.Count == 2 && ... loops[winding[1]]), law errors where laws should fail (SameUvPoints, 05-face-meshing/face-meshing-lift.laws.plato:116), and 109 (a ? b : false) guards, which a writer bug once mis-parenthesised (FINDINGS F-50). Plato values are pure, so the change alters only programs that threw or did not terminate on the skipped side. If a full change is too large, a first step is a lint warning on an index or At call on the right of && whose left side tests a Count. Can start now: it touches only the Plato repository.
