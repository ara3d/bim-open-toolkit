---
id: TKT-485
title: Plato law runner: a witness has no time cap, so one slow Witness_ (20 minutes) stalls a whole sweep before any law is reported
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [C:/Users/cdigg/git/plato/src/Plato.Interpreter/LawRunner.cs, C:/Users/cdigg/git/plato/src/Plato.CLI/RunCommand.cs, C:/Users/cdigg/git/plato/tests/Plato.Interpreter.Tests/**]
workflow: [W3]
related: [TKT-479, TKT-354]
confidence: high
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] every Witness_ evaluation is capped (default the law cap, 120 s; --witness-budget=<seconds>), on the interpreter and on compiled C#, and a capped witness is reported as faulted, naming it and the cap
- [x] a law whose parameter's only values came from witnesses that faulted is an error naming those witnesses, not skipped and not hung
- [x] a test with a non-terminating witness finishes the run and reports both

Found 2026-10-22 by the supervisor: plato run --laws caps each law (120 s, AbandonSeconds), but LawRunner.EvaluateWitnesses clears the deadline and invokes every witness without limit. A quadratic check in Witness_CounterboreMeshed's validation ran 20 minutes on one core, and the sweep never reported a law.

## Resolution (2026-10-22, Plato d6eafae8)

- LawRunOptions.WitnessBudgetSeconds caps each Witness_* (default the law cap, AbandonSeconds, 120 s); `plato run` takes `--witness-budget=<seconds>`. The interpreter stops a witness at the cap through its deadline; a compiled witness runs on its own thread and is abandoned past the cap. The fault names the cap: "over the 1 s witness cap" or "still running after the 1 s witness cap; abandoned".
- A law whose parameter had no values because every witness of its type faulted is an error: "no values for h: Heavy: every Witness_* of Heavy faulted: WitnessCapFixture.Witness_Heavy: over the 1 s witness cap". The laws over a type with other values still run on them.
- WitnessCapTests on the interpreter and on compiled C#: the run finishes in seconds, the witness is reported capped, its law is an error naming it, and an unrelated law passes. Plato.Interpreter.Tests 97/97.
- The warm server uses the same law runner, so it gains the cap once it is rebuilt from d6eafae8 or later. The generated C# is unchanged (law runner and CLI only).
