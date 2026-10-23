---
id: TKT-506
title: Plato: fuse Range, Map, Take and FlatMap chains into one loop, and unroll literal-count ranges
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/tests/**]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
---

## Acceptance criteria

- [ ] n.Range.Map(f), n.Range.FlatMap(f), n.Range.Reduce(s, f), n.Range.All(f) and n.Range.Any(f) compile to one loop over 0 to n-1 with no index array, shown by a test on the emitted C#
- [ ] xs.Map(f).Map(g), xs.Map(f).Reduce(s, g) and xs.Take(k).Map(f) compile to one loop with no intermediate array
- [ ] A MapRange, Range, All or Any whose count is an integer literal of at most 8 is unrolled to straight-line code: 3.Range.Any(j => ...) in refinement-test-cached.library.plato becomes three terms joined by or
- [ ] The differential law run over sandbox/step-brep-mesh has no new mismatch, and the regenerated library's corpus run reports allocation before and after

The fusion pass the 2026-10-22 corpus report asked for, sized from the generated C# at Plato 60134758 (docs/plans/step-mesher-generated-csharp-2026-10-23.md): 136 `Range().Reduce`, 140 `Range().FlatMap` and 45 `Range().Map` chains on one line (more across let bindings), 45 literal-count ranges, and 123 `MapRange` and 65 `Range()` calls inside lambdas, where the index array is built per element of an outer pipeline.

Every one of `Map`, `Take`, `Skip`, `Slice`, `Concatenate`, `Range` and `Zip` is a Plato body over `MapRange` (`stdlib/foundation/primitives.library.plato`), and the host intrinsic materialises `MapRange` eagerly since TKT-350, so each stage of a chain is a full copy. The comment in that file still says the sub-range family never copies.

Fusion belongs after `TirInliner` (which exposes the chains: 61,918 calls inlined in the experiment) and before `TirLoopLowerer` (which turns the fused call into the loop). It depends on the lowerer seeing `Array<T>` at all (the defect filed beside this ticket).
