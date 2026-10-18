---
id: TKT-315
title: A 64-bit Number compilation profile for Plato's C# backend
status: open
depends_on: [TKT-299]
owner:
fence: [../plato/**]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] a per-compilation profile selects the C# type Number compiles to, cpu64 (double) by default and gpu32 (float) on request, as sandbox/step-brep-mesh/TARGET-LANGUAGE.md recommends
- [ ] Integer is exact within 2^53 under cpu64, and the stdlib's own tests pass under both profiles
- [ ] the STEP B-rep mesh design folder compiles under cpu64 with the gate at PASS

Owner approval 2026-10-17. Work happens in the Plato repository (C:\Users\cdigg\git\plato); this ticket lives here so the id does not collide. TARGET-LANGUAGE.md section on Number states the design: a profile, not a second primitive; declared precision requirements; Plato-owned correctly rounded elementary functions are a later step. TASKS.md chunk B onward needs this.

## Log

- 2026-10-18, paused by the owner: Plato commits b875bbc0 2eb70fb3 80e7f207 3bb6d954 (Number profile, docs, tests), 40a7d5a8 5c2ad367 3d5d21d9 c0abb82a cb274ffc ced94312 a2d41c7b 54a3996a afb1f304 (tracker issues, writer fixes plato-454 to plato-458, compiler-461, regenerated output); not done: 64-bit Integer, fix 6 (plato-459), stdlib-460, the CS0305 generic-constructor defect.
