---
id: TKT-353
title: Plato C# writer emits a lambda as the receiver of an extension call (CS0023), so the B-spline files do not build
status: done
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/writers/**, ../plato/src/Plato.Compiler/**, ../plato/tests/**, ../plato/tracker/**]
workflow: [W3, W4]
related: [TKT-327, TKT-313, TKT-350]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
closed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [x] a call whose receiver is a lambda (f.MinimizeOverDomain(...) with f a lambda) is emitted as C# that compiles; a writer test generates one from a fixture, compiles it with Roslyn and runs it Evidence: Plato bac65e1c, LambdaReceiverEmissionTests (fixture tests/plato-test-codegen/lambda-receiver.plato): ApplyTwice(f: Function1<Integer, Integer>, x) emitted on System.Func, and SecondTwice, calling it with a lambda, compiles with Roslyn and runs; it failed before with the same CS0023.
- [x] the stdlib tiers plus the STEP design library generate and build under cpu64 with no CS0023 from BsplineInverse.g.cs or BsplineOracles.g.cs Evidence: 2026-10-19, the committed library (bim-open-toolkit 2c962f84, 120 design files) with the stdlib tiers: generate and build under cpu64 with 0 errors; 8 function-first functions now emitted, MinimizeOverDomain among them.
- [x] the fix is pushed and its commit named in this ticket, so the supervisor can pin one CLI with TKT-350's fix Evidence: Plato bac65e1c on origin/main.

Found 2026-10-19 while checking TKT-350 (Plato dcbec43d): with the library at 120 design files (the B-spline track, TKT-327, merged), the whole-library C# build fails with 4 CS0023 'Operator . cannot be applied to operand of type lambda expression' at BsplineInverse.g.cs(64,32) and (81,36) and BsplineOracles.g.cs(58,32) and (80,50). The writer emits ((t) => _var1999.Eval(_var2000, t)).MinimizeOverDomain(...): a lambda has no type in C# until it is converted to a delegate, so it cannot be the receiver of a member or extension call. The writer is fixed rather than the library, so the next lambda receiver does not hit it.

## Log

- 2026-10-19: fixed in Plato bac65e1c. Two causes: a library function whose first parameter is a function type was never emitted (System.Func has no plan, the same drop as compiler-416's builders; the TKT-347 receiver rule now takes function types), and a lambda receiver had no delegate type in C# (the TIR body writer now casts it to the delegate its TIR type names). PlatoTests 259 pass, 4 pre-existing failures. The working tree's library did not compile at the time (poles.laws.plato calls RoundZeroModelMesh, not defined: another track's uncommitted merge), so the whole-library check used the committed library. One CLI from bac65e1c covers TKT-350 (dcbec43d) and this. Durations: writer tests about 1 min per run (six), PlatoTests 2.5 min, whole-library generate and build 25 min under load.
