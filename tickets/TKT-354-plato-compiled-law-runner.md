---
id: TKT-354
title: Plato law runner over compiled C#: 2 s budget, laws in parallel, time per law
status: done
depends_on: []
owner: builder 415b3c71-2c9c-4409-8fae-081c3b236679
session: 415b3c71-2c9c-4409-8fae-081c3b236679
fence: [C:/Users/cdigg/git/plato/src/**, C:/Users/cdigg/git/plato/tests/**, sandbox/step-brep-mesh/tools/plato_laws.py, docs/plans/step-mesher-v2.md]
workflow: [W3]
related: [TKT-317, TKT-332, TKT-335, TKT-351]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
closed: 2026-10-22
---

## Acceptance criteria

- [x] plato run --laws --backend=csharp emits the program with the C# writer, compiles it in process with Roslyn (as tests/Plato.Interpreter.Tests/DifferentialBackend.cs does today) and runs every Law_* over the same witness enumeration as the interpreter's LawRunner, with identical verdict semantics (pass, fail, error, skipped, obligation) and the same --report/--baseline files Evidence: Plato 731adb72 (src/Plato.Laws, ILawBackend in src/Plato.Interpreter/LawBackend.cs); stdlib foundation+geometry+graphics+tests, 148 laws: identical verdicts and witness text on both backends; the differential test (moved into Plato.Laws) has 0 mismatches under cpu64 and gpu32.
- [x] the default per-law budget is 2 s for both backends; a law over it is reported as error with its elapsed time, and the report file carries elapsed milliseconds per law Evidence: Plato 731adb72, LawRunOptions.DefaultBudgetSeconds = 2; verdict files are name, verdict, ms, detail; the three-column verdicts-cpu64.tsv still parses and compares (LawRunnerReportTests).
- [x] laws run on all cores (one law per task; pure functions, so no shared state) and the CLI prints the wall time, the law time summed, and the 15 slowest laws Evidence: Plato 731adb72, LawRunner.RunAll with Parallel.For, one big-stack thread per law, witnesses built first and shared; the summary line prints both times, the slow list and slow witnesses. The interpreter backend stays serial: its elaboration cache, call memo and deadline are one per interpreter.
- [x] the warm server's plato_laws tool takes backend=csharp and keeps the compiled assembly warm per folder set, recompiling only when a source changes Evidence: Plato ba5b9d66 (WarmProgram keeps a CSharpProgram per profile; emit and Roslyn times in LawRunOutcome), studio ff4198b8 (backend argument, --law-backend=, timings emitMs, csharpCompileMs, backendReused); WarmLawRunnerTests, 7 pass. The server on 8768 still runs the 951a70ab build and must be rebuilt from Plato e37c032f to offer it.
- [x] on the mesher library at a4c64137 under cpu64, the full compiled sweep completes and its verdicts are listed law by law against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: every difference is explained (a 2 s time-out in the interpreter that passes compiled is expected; a pass that fails compiled is a defect, filed) Evidence: sweep 2026-10-19 on the library at d3d297ce with Plato e37c032f: 802 laws, 520 pass, 27 fail, 84 error, 84 obligation, 87 skipped; 37 verdicts differ from verdicts-cpu64.tsv: 3 pass-to-fail filed as TKT-355, 33 pass-to-error and 1 fail-to-error are laws over 2 s (the interpreter's call memo had answered their repeated meshing once), ranked with the 50 unchanged time-outs in TKT-356 (85 laws). No interpreter time-out passes compiled.

Owner decisions 2026-10-19: laws run on compiled C#, not the interpreter (the interpreter is hundreds of times slower; 50 of 802 mesher laws hit a 120 s budget and cost 100 of the sweep's 107 minutes), and the law budget is 2 s: a law over it is a defect in the library or the backend, never a reason to shrink a witness. The pieces exist: DifferentialBackend.cs and DifferentialRun.cs (Roslyn in-process compile, reflection over witnesses, 560 lines in the test project) ran 39 stdlib laws both ways with 0 mismatches for TKT-317. Move them into Plato.Interpreter (or a Plato.Laws project both the CLI and Plato.Navigation reference), behind a backend switch. Pin a CLI from the result at C:/Users/cdigg/.plato-cli/<commit>/ from a clean git archive export (see docs/plans/step-mesher-v2.md rule changes: -m:1, csproj refs to C:/Users/cdigg/ara3d-sdk rewritten) and switch sandbox/step-brep-mesh/tools/plato_laws.py to backend csharp and the pinned CLI sweep command in the plan to --backend=csharp --budget=2.

## Log

- 2026-10-19: built in Plato 731adb72 (compiled backend, CLI flags, budget, parallel runs, time column), ba5b9d66 (warm server), e37c032f (docs); studio ff4198b8 (plato_laws backend argument). CLI pinned at C:/Users/cdigg/.plato-cli/e37c032f (clean export of e37c032f, parakeet eedf2f0a, 61 files, 19 MB). Full compiled sweep: 1836 s wall (12 s compile, 9 s emit, 12 s Roslyn, 1803 s laws on 22 threads; the law times sum to 8480 s because 65 laws ran to the 120 s abandon cap and kept their cores afterwards). The compiled sweep is not faster than the interpreter's 107 minutes by the margin expected: the slow laws are slow in the library itself (refinement loop, re-meshing per case), see TKT-356. Builder session 415b3c71-2c9c-4409-8fae-081c3b236679.
