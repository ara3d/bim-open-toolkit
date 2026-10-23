---
id: TKT-507
title: Plato: lower the FlatMap filter idiom (a one-element array or an empty Take(0) per element) to a conditional append, and name it Filter
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/tests/**, C:/Users/cdigg/git/plato/stdlib/foundation/primitives.library.plato]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
---

## Acceptance criteria

- [ ] A FlatMap whose lambda is a conditional between a one-element array literal and an empty array compiles to a loop that appends the element when the condition holds, with no array per element, shown by a test on the emitted C#
- [ ] The stdlib offers a named Filter over Array of T with a Plato reference body, and the C# writer lowers it to the same loop; the 109 FlatMap filter sites in sandbox/step-brep-mesh are counted before and after a sweep that adopts it
- [ ] The differential law run over sandbox/step-brep-mesh has no new mismatch

Plato has no filter. The library writes one as `FlatMap` over a lambda returning a one-element array literal (`Intrinsics.MakeArray`, one `T[]` per kept element) or an empty `Take(0)` (a `MapRange(0)`, cheap, but 11 sites still build `n.Range` first; `step.library.plato` lines 165 to 167 among them, which `docs/plans/step-mesher-algorithmic-performance-2026-10-22.md` costs at O(V^2 + 2 E^2) on ELLA-W1). 109 of the 317 `FlatMap` sites in the generated C# at Plato 60134758 have this shape; 92 pair `MakeArray` with `Take(0)` in the same lambda. The host `FlatMap` then copies the one-element array into a growing `List<T>`.

A recognised shape in the lowerer (a `FlatMap` whose lambda is a conditional between a one-element array and an empty array) removes the per-element allocation. A named `Filter` in the stdlib makes the intent visible to the lowerer and to readers. From docs/plans/step-mesher-generated-csharp-2026-10-23.md.
