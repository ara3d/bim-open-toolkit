---
id: TKT-438
title: Plato law runner: the interpreter-against-compiled differential run (DifferentialRun) is a CLI and server option, run over every witness and every law under 2 s in each sweep
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [C:/Users/cdigg/git/plato/src/Plato.CLI/**, C:/Users/cdigg/git/plato/src/Plato.Laws/DifferentialRun.cs]
workflow: [W3]
related: [TKT-355, TKT-426]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] plato run --laws --differential writes each mismatch (law, case, both answers) and exits 1 on one
- [x] every Witness_* value is built in both arms and compared with the library's own equality
- [x] the mesher sweep's verdict file records the differential result

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class E (interpreter and compiled C# differ). TKT-355 (array Equals), TKT-426, F-50's 97 silent conditional sites and TKT-350 all passed in the interpreter; DifferentialRun exists but ran only over 39 stdlib laws.

## Resolution (2026-10-22, Plato ec51f061)

- `plato run --laws --differential` (also `--backend=differential`, and `backend=differential` on the warm server) evaluates every call the law runner makes in the interpreter and on compiled C#, one at a time, and compares the answers with Plato's structural equality. A disagreement is the verdict `differs` with the case and both answers (`differs    X.Law_Y  case 1: k = -1  interpreter: true; csharp: false`); every disagreement is also printed as a `differs` line and written as a `# differs` comment at the head of the report. The exit code is 1 on any disagreement, 0 otherwise. The interpreter's `--budget` (2 s by default) keeps the slow arm to the quick laws; a law it stops is a budget error, not a mismatch.
- Every `Witness_*` is built in both engines and compared with the same equality. A witness that differs is listed and dropped, and the laws over its type run on the other witnesses.
- Mesher library at 3cc4c194 (layers 00-09, cpu64): 1,376 laws and 204 witnesses in 255 s, 0 mismatches. The verdict file with the differential header is `sandbox/step-mesh-staging/v1-compiler/verdicts-differential-cpu64.tsv`. The first run found 178 mismatches, all from the comparison itself (a compiled `String` read back as a C# struct; closures compared), both fixed in ec51f061.
- Tests: `tests/Plato.Interpreter.Tests/DifferentialBackendTests.cs` (agreement with a String field, a law answered differently, a witness built differently).
