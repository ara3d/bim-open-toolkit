---
id: TKT-311
title: Spike: compile a slice of the Plato STEP library (the unit-cube BrepModel types and one function with a body) to C# with Plato's current C# writer and call it from a C# test
status: open
depends_on: []
owner:
fence: [docs/plans/step-reader.md]
workflow: [W3, W4]
related: [TKT-299, TKT-306]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] the plan's build log says which constructs the library's types use (sum types and match, generic arrays, records, Number) and, for each, whether the current Plato C# writer compiles it, with the command and output
- [ ] a throwaway C# program constructs a BrepModel value through the generated C# types and calls one compiled function with a body (for example a law or a measure over the unit cube), or the build log names the first construct that blocks it
- [ ] the build log estimates what writer work, if any, stands between TASKS.md chunk A and running code

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). The Plato design (sandbox/step-brep-mesh, TKT-299) deliberately has no algorithm bodies; TARGET-LANGUAGE.md assumed, by the owner's premise, that every writer emits the full language. This checks the C# writer against that premise before the geometry chunks depend on it. Plato is at C:\Users\cdigg\git\plato. Throwaway code stays outside the repositories.
