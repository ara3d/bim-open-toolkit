---
id: TKT-317
title: A Plato interpreter: run laws and functions over the typed AST with no code generation
status: done
depends_on: []
owner: session c4298a2b
session: c4298a2b-52b5-4c66-abfe-c7b982524e14
fence: [../plato/**]
workflow: [W3, W4]
related: [TKT-315, TKT-316, TKT-311]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-18
---

## Acceptance criteria

- [x] an evaluator over Plato's resolved, typed AST runs any function of the stdlib and of sandbox/step-brep-mesh on values built in the interpreter: product and sum types, match, arrays, Number under the cpu64 and gpu32 profiles of TKT-315, Integer exact within 2^53, bodiless functions reported as 'host obligation' rather than failing silently Evidence: tests/Plato.Interpreter.Tests UnitTests (product and sum values, match, arrays, both Number profiles, Integer exactness) pass, 37 tests; `plato run ... --laws` over stdlib and sandbox/step-brep-mesh on 2026-10-18 reports 123 sandbox host obligations by bodiless function (report section 'Rerun on 2026-10-18').
- [x] a command, for example 'plato run <folder> --laws', evaluates every Law_* over the Witness_* values of the same folder and prints pass, fail with the first failing witness and the law's measure, or skipped with the reason, in the same process as the front end, with no C# emitted or built Evidence: `dotnet src/Plato.CLI/bin/Release/net8.0/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics stdlib/tests --laws --budget=60` prints pass/fail (first failing witness)/error/obligation/skipped per law in 17.9 s, no C# emitted (src/Plato.CLI/RunCommand.cs).
- [x] the interpreter and the C# backend agree: a differential test runs the stdlib's laws both ways and the results match law by law, under both Number profiles Evidence: tests/Plato.Interpreter.Tests/DifferentialTests.cs runs 39 laws x 975 cases under cpu64 and gpu32 against the C# backend, 0 mismatches.
- [x] turnaround measured and recorded in the Plato repository's docs: time from editing one function body in the STEP design folder to the law results, for the interpreter and for the generate-build-run path, on the same machine Evidence: docs/reports/interpreter-turnaround-2026-10-17.md in the Plato repository (interpreter path 16.6-23.8 s per edit, generate-build-run path measured on the same machine; rerun section of 2026-10-18).
- [x] the evaluator is the execution engine that SPEC-EXECUTION.md's 'plato verify' needs: it exposes evaluation of an expression against an environment so bounded quantifiers, invariants and theorem test lines can be run without a second engine Evidence: `Interpreter.Evaluate(TirNode, Environment)` is public and documented in docs/interpreter.md (lines 99 and 247); the law runner is a thin driver over it.

Owner request 2026-10-17, after a discussion of development turnaround: every Plato change today means compile, generate C#, build, run, which is slow enough that algorithm bodies are better written in C# first and ported later (see TASKS.md and the TKT-316 tooling for how that is arranged). The interpreter is the long-run fix: Plato is pure, has closed sums and no generics over sums, and its laws are Boolean functions over witnesses, so an evaluator over the typed AST is small and can run laws in the compiler's own process. It is also the engine SPEC-EXECUTION.md needs for plato verify. Design points to settle first, in the Plato repository: value representation (boxed records versus arrays of primitives; arrays as the only recursion); how intrinsics and host obligations are supplied (a table of built-in operations for the stdlib's bodiless primitives, an error for anything else); how the Number profile is chosen at run time; whether the law runner's conventions (Law_, Witness_, Oracle_, Check_) live in the interpreter or in a thin driver over it. Order: TKT-315 (the Number profile) and TKT-311 (does the C# writer compile the design) come first, and the design's first chunks run through C#.
