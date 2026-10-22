---
id: TKT-438
title: Plato law runner: the interpreter-against-compiled differential run (DifferentialRun) is a CLI and server option, run over every witness and every law under 2 s in each sweep
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/Plato.CLI/**, C:/Users/cdigg/git/plato/src/Plato.Laws/DifferentialRun.cs]
workflow: [W3]
related: [TKT-355, TKT-426]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] plato run --laws --differential writes each mismatch (law, case, both answers) and exits 1 on one
- [ ] every Witness_* value is built in both arms and compared with the library's own equality
- [ ] the mesher sweep's verdict file records the differential result

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class E (interpreter and compiled C# differ). TKT-355 (array Equals), TKT-426, F-50's 97 silent conditional sites and TKT-350 all passed in the interpreter; DifferentialRun exists but ran only over 39 stdlib laws.
