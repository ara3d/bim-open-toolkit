---
id: TKT-353
title: Plato C# writer emits a lambda as the receiver of an extension call (CS0023), so the B-spline files do not build
status: claimed
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/writers/**, ../plato/src/Plato.Compiler/**, ../plato/tests/**, ../plato/tracker/**]
workflow: [W3, W4]
related: [TKT-327, TKT-313, TKT-350]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] a call whose receiver is a lambda (f.MinimizeOverDomain(...) with f a lambda) is emitted as C# that compiles; a writer test generates one from a fixture, compiles it with Roslyn and runs it
- [ ] the stdlib tiers plus the STEP design library generate and build under cpu64 with no CS0023 from BsplineInverse.g.cs or BsplineOracles.g.cs
- [ ] the fix is pushed and its commit named in this ticket, so the supervisor can pin one CLI with TKT-350's fix

Found 2026-10-19 while checking TKT-350 (Plato dcbec43d): with the library at 120 design files (the B-spline track, TKT-327, merged), the whole-library C# build fails with 4 CS0023 'Operator . cannot be applied to operand of type lambda expression' at BsplineInverse.g.cs(64,32) and (81,36) and BsplineOracles.g.cs(58,32) and (80,50). The writer emits ((t) => _var1999.Eval(_var2000, t)).MinimizeOverDomain(...): a lambda has no type in C# until it is converted to a delegate, so it cannot be the receiver of a member or extension call. The writer is fixed rather than the library, so the next lambda receiver does not hit it.
