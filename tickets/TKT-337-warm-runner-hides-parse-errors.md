---
id: TKT-337
title: The warm law runner reports '0 laws, 0 type errors' when a file fails to parse, instead of the parse error
status: open
depends_on: []
owner:
fence: [../plato/src/Plato.Navigation/**, ../plato/tests/Plato.Interpreter.Tests/**, ../studio/labs/PlatoNavigationMcp/LawMcpTools.cs]
workflow: [W3, W4]
related: [TKT-331, TKT-323]
confidence: high
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] when any file of the law folders fails to parse, plato_laws reports ok false and each parse error with its file and line, as the cold 'plato run' does ('Parsing failed'), and runs no laws
- [ ] a test plants a missing semicolon in a copy of a law file and asserts the parse error comes back through the warm runner
- [ ] the server on 8768 is rebuilt from the fix and restarted with the law flags by the supervisor, and sandbox/step-brep-mesh/tools/plato_laws.py still exits 2 on an empty run

Found 2026-10-18 by the step B session (TKT-324): a missing semicolon made plato_laws answer '0 laws: {}; 0 type errors', which reads as a clean run; the cold CLI said 'Parsing failed'. A builder trusting the warm answer could commit a library that does not compile. Mitigated the same day: tools/plato_laws.py exits 2 with a hint whenever a filtered run matches no law. WarmLawRunner is Plato 38f2031a (TKT-331).
