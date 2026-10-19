---
id: TKT-315
title: A 64-bit Number compilation profile for Plato's C# backend
status: done
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/**]
workflow: [W3, W4]
related: [TKT-299, TKT-323]
confidence: high
created: 2026-10-17
claimed: 2026-10-18
closed: 2026-10-19
---

## Acceptance criteria

- [x] a per-compilation profile selects the C# type Number compiles to, cpu64 (double) by default and gpu32 (float) on request, as sandbox/step-brep-mesh/TARGET-LANGUAGE.md recommends Evidence: Plato b875bbc0 (NumberProfile, --profile=cpu64|gpu32, NumberValue alias, NumberProfile.g.cs build check); on 2026-10-18 the stdlib tiers plus the STEP design library generated and built with 0 errors under each profile.
- [ ] Integer is exact within 2^53 under cpu64, and the stdlib's own tests pass under both profiles
- [x] the STEP B-rep mesh design folder compiles under cpu64 with the gate at PASS Evidence: 2026-10-18, Plato 78be1798: the three stdlib tiers plus the 100 design files generate (1260 files, one degraded body, Tween.Change, pre-existing) and build with 0 C# errors under cpu64 and under gpu32 (8 errors before: CS0305 x2, CS1929 x2, CS0117, CS1061 x3); PlatoGate over the design folder: PASS, 0 errors in scope, 7252 functions type-checked.

Owner approval 2026-10-17. Work happens in the Plato repository (C:\Users\cdigg\git\plato); this ticket lives here so the id does not collide. TARGET-LANGUAGE.md section on Number states the design: a profile, not a second primitive; declared precision requirements; Plato-owned correctly rounded elementary functions are a later step. TASKS.md chunk B onward needs this.

## Log

- 2026-10-18, paused by the owner: Plato commits b875bbc0 2eb70fb3 80e7f207 3bb6d954 (Number profile, docs, tests), 40a7d5a8 5c2ad367 3d5d21d9 c0abb82a cb274ffc ced94312 a2d41c7b 54a3996a afb1f304 (tracker issues, writer fixes plato-454 to plato-458, compiler-461, regenerated output); not done: 64-bit Integer, fix 6 (plato-459), stdlib-460, the CS0305 generic-constructor defect.

- 2026-10-18, resumed: the owner lifted the pause ("plain floats until doubles are ready, have an agent work on that"). Plan docs/plans/step-mesher-v2.md, track D2; merged alone, after which the default profile becomes cpu64.

- 2026-10-18 to 2026-10-19, done in Plato: 1614e017 (stdlib-460: Lattices.Trimmed through Eval, LaplacianWeighting.UniformWeights), f4f62b00 (CS0305: a generic constructor call writes its type arguments), 8848409c (plato-459: one throwing stub for every bodiless function outside library Intrinsics and the interface members; emit snapshot rebaselined, two stub lines), f2b20722 (PlatoTests find fixtures from a private --artifacts-path), 78be1798 (Integer is 64-bit under cpu64: IntegerValue alias, checked implicit int conversion; docs/SEMANTICS.md section 1), 951a70ab (filed stdlib-464). Checks: Plato.Intrinsics.Tests 179 pass cpu64, 177 gpu32; interpreter differential against the C# backend passes under both; PlatoTests 251 of 255, the 4 failures pre-existing and unrelated (EmittedConversionsMatchBaseline, ImplicitCastsMatchBaseline, OnlyIntrinsicsFileDeclaresHostIntrinsics on stdlib/future/collision, UseTirOnReproducesTheFullTypeScriptLibraryByteForByte); forward conformance law runner (C# backend) cpu64 122 pass, 7 fail, 26 skipped, gpu32 10 fail, the same lists as before this work, all stdlib laws unguarded against generated inputs or binary32 tolerance edges, filed as stdlib-464. Durations: whole-library generate and build about 4 min per profile (six runs); PlatoTests about 2.7 min (three runs); Plato.Intrinsics.Tests about 1 min per profile (eight runs); conformance about 1.5 min per profile; gate 13 s build and 33 s run. Builds only under the session scratchpad's --artifacts-path. Left: the 4 PlatoTests failures and stdlib-464 belong to their owners; Integer's implicit int conversion prefers int overloads (Math.Abs(Integer) binds Abs(int)), checked, so a value past the int range throws rather than wraps.

## Closed with criteria unmet

2026-10-19: Criterion 2 is met for Integer (64-bit under cpu64, exact within 2^53, Plato 78be1798) and for every test suite under both profiles (Plato.Intrinsics.Tests, the interpreter's C# differential, PlatoTests apart from 4 pre-existing failures). It is not met literally for the stdlib's laws: the C# conformance runner fails 7 under cpu64 and 10 under gpu32. These are the stdlib's own laws, unguarded against generated inputs or at binary32 tolerance edges. They fail the same way in the interpreter and failed identically before this work. Filed as Plato stdlib-464 for the stdlib's owner.
