---
id: TKT-354
title: Plato law runner over compiled C#: 2 s budget, laws in parallel, time per law
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/src/**, C:/Users/cdigg/git/plato/tests/**, sandbox/step-brep-mesh/tools/plato_laws.py, docs/plans/step-mesher-v2.md]
workflow: [W3]
related: [TKT-317, TKT-332, TKT-335, TKT-351]
confidence: high
created: 2026-10-19
---

## Acceptance criteria

- [ ] plato run --laws --backend=csharp emits the program with the C# writer, compiles it in process with Roslyn (as tests/Plato.Interpreter.Tests/DifferentialBackend.cs does today) and runs every Law_* over the same witness enumeration as the interpreter's LawRunner, with identical verdict semantics (pass, fail, error, skipped, obligation) and the same --report/--baseline files
- [ ] the default per-law budget is 2 s for both backends; a law over it is reported as error with its elapsed time, and the report file carries elapsed milliseconds per law
- [ ] laws run on all cores (one law per task; pure functions, so no shared state) and the CLI prints the wall time, the law time summed, and the 15 slowest laws
- [ ] the warm server's plato_laws tool takes backend=csharp and keeps the compiled assembly warm per folder set, recompiling only when a source changes
- [ ] on the mesher library at a4c64137 under cpu64, the full compiled sweep completes and its verdicts are listed law by law against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: every difference is explained (a 2 s time-out in the interpreter that passes compiled is expected; a pass that fails compiled is a defect, filed)

Owner decisions 2026-10-19: laws run on compiled C#, not the interpreter (the interpreter is hundreds of times slower; 50 of 802 mesher laws hit a 120 s budget and cost 100 of the sweep's 107 minutes), and the law budget is 2 s: a law over it is a defect in the library or the backend, never a reason to shrink a witness. The pieces exist: DifferentialBackend.cs and DifferentialRun.cs (Roslyn in-process compile, reflection over witnesses, 560 lines in the test project) ran 39 stdlib laws both ways with 0 mismatches for TKT-317. Move them into Plato.Interpreter (or a Plato.Laws project both the CLI and Plato.Navigation reference), behind a backend switch. Pin a CLI from the result at C:/Users/cdigg/.plato-cli/<commit>/ from a clean git archive export (see docs/plans/step-mesher-v2.md rule changes: -m:1, csproj refs to C:/Users/cdigg/ara3d-sdk rewritten) and switch sandbox/step-brep-mesh/tools/plato_laws.py to backend csharp and the pinned CLI sweep command in the plan to --backend=csharp --budget=2.
