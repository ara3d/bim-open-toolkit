# The C# generated from Plato: where refinement's allocation goes, 2026-10-23

Read-only, plus one experiment. Sources: the generated library `deps/bim-open-data/src/data/Ara3D.StepBrep` (Plato
`60134758`, toolkit `07019d14`, 1,496 files), its handwritten runtime `Intrinsics/`, the Plato stdlib
(`stdlib/foundation/primitives.library.plato`, `intrinsics.library.plato`, `sorting.library.plato`), the C# writer
(`writers/Plato.CSharpWriter`), and run E's refinement profile in `step-mesher-ideas-evaluation.md` (ODIN-W160:
refinement 1,343 ms, 2.2 GB allocated, arithmetic 15% of the file). The TKT-442 regeneration (short-circuit `&&` and `||`)
is still queued and is not measured here. Tickets: TKT-505 to TKT-508.

## 1. The path from a Plato body to C#, as it is today

Written for an agent who has to predict what a Plato expression becomes. Each pass is one file in `writers/Plato.CSharpWriter`.

| Order | Pass | Flag | What it does | What it leaves alone |
|---|---|---|---|---|
| 0 | `TirShortCircuit` (in `src/Plato.Compiler/Checking`) | always, since Plato `33604a12` | `a && b` on Boolean becomes `a ? b : false` | an `And` a library defines for its own type |
| 1 | `TirInliner` | `--inline` | replaces a call by the callee's expression body, 3 passes, 40-node budget | statement bodies, calls under lambdas with compound arguments, lambda arguments, recursive bodies |
| 2 | `ComponentUnroller` | `--optimize` | `MapComponents`, `ZipComponents`, `Reduce` over fixed-arity vectors become field arithmetic | anything over `Array<T>` |
| 3 | `TirArrayMaterializer` | `--optimize-arrays` | renames `Map` to `MapEager` in stored or multi-read positions | everything, in this library: see section 3 |
| 4 | `TirLoopLowerer` | `--loops` | `Map`, `MapRange`, `Zip`, `Reduce`, `All`, `Any`, `Reverse`, `MapPairs` call sites become `for` loops | call sites inside a lambda, a conditional, or a `while` body; every receiver typed `Array<T>`: see section 3 |
| 5 | `TirCSharpBodyWriter` | always | prints the TIR; hoists captured variables as `_varN` locals | |

The runtime half (`Intrinsics/ArrayIntrinsics.cs`): `Count`, `At`, `MapRange`, `Reduce` and `FlatMap` are the only array
intrinsics. `MapRange` fills a `T[]` eagerly (TKT-350; before that it was a lazy view). `FlatMap` appends into a
`List<T>`. Every other array function, `Map`, `Take`, `Skip`, `Slice`, `SubArray`, `Concatenate`, `Append`, `Range`,
`Zip`, `All`, `Any`, `Repeat`, is a Plato body over `MapRange` or `Reduce` in `primitives.library.plato`, so each is a
full copy of its result. The comment above the sub-range family ("every one is a window onto the source, none copies")
describes the lazy runtime and is false now. Values travel as `IReadOnlyList<T>`, so every index is an interface call.

The regen script (`deps/bim-open-data/tools/regen-step-brep.ps1`) passes `--out` and `--profile=cpu64` only. No pass
numbered 1 to 4 has ever run on the measured build.

## 2. Where the generated code allocates, counted

Call sites in the 1,496 generated files (one-line chains only; chains split across `var` bindings are not counted):

| Shape | Sites | What each costs |
|---|---|---|
| `.MapRange(` | 761 | one array; 123 of them inside a lambda, so one array per element of the outer pipeline |
| `.Map(` | 1,147 | one array (a `MapRange` after inlining) |
| `.Range()` | 684 | an index array; 65 inside a lambda; 45 with a literal count (`3.Range.Any(...)` per tested triangle per round, `refinement-test-cached.library.plato` lines 49 and 124) |
| `.Range().Reduce(` / `.Range().FlatMap(` / `.Range().Map(` | 136 / 140 / 45 | an index array built only to be walked |
| `.FlatMap(` | 314 | a `List<T>`; 109 are the filter idiom, a one-element `MakeArray` or a `Take(0)` per element (92 have both in one lambda) |
| `.Concatenate(` | 323 | a copy of both operands |
| `.Take(` | 288 | a copy; 252 are `Take(0)`, cheap unless the receiver is a fresh `Range` |
| `.All(` / `.Any(` | 639 / 237 | a fold over every element plus a closure; the predicate stops being called after the answer (TKT-442) but the loop does not |
| `Intrinsics.MakeArray(` | 3,080 | one `T[]` per array literal: `CornerPositions` builds a 3-point array twice per tested triangle; `TryInsertionIndexed` builds `corners`, `ring`, `[1.0, 0.0]` and two `[0].Take(0)` per trial |

Set against run E: the 500 MB of `TryInsertionIndexed` is these small arrays and the `FanOf` and `FlipCavityIndexed`
lists; the 165 ms of `NeighbourSlots` is a buffer merge sort (`SortedIndices`, allocation-light) called three times per
pass, with a delegate call per comparison; the 1 GB of the inside test was removed by TKT-407.

## 3. The experiment: the existing passes on this library

The pinned compiler compiled the same inputs twice into the scratchpad: plain, and with `--inline --loops --inline-report`.
Both produced 1,508 files (6.5 min and 16.4 min).

- `--inline` fired 61,918 times (refusals: 518,552 no callee body, mostly constructors and arithmetic; 56,395 no ground
  TIR; 24,885 statement bodies; 15,645 under a lambda). Inlining alone made the output larger without changing what runs:
  `MapRange` sites went from 774 to 2,930, `Concatenate` from 323 to 2,602, `Range()` from 685 to 130 (inlined to
  `MapRange`). With eager intrinsics and no fusion, an inlined `Map` still allocates its array.
- `--loops` lowered nothing. The output has no `for` loop. `TirLoopLowerer.cs` lines 182, 256, 258 and 305 test the
  receiver and result type by name and accept only `IArray`, the legacy stdlib's name; this library's arrays are
  `Array<T>`. `TirArrayMaterializer` has the same check. The passes were built and tested against `stdlib-legacy` and
  have never matched a modern-stdlib program. Filed as TKT-505.

## 4. Opportunities, ranked

| | Change | Where | Sites it reaches | Evidence | Ticket |
|---|---|---|---|---|---|
| 1 | Make the lowerer and materializer recognise `Array<T>`; regenerate with `--loops`; measure | `TirLoopLowerer.cs`, `regen-step-brep.ps1` | the statement-level `MapRange`, `Map`, `Reduce`, `All`, `Any` sites, such as the seven arrays per round of `NeedsRefinementCarriedCounted` | section 3: a name check; the pass exists and has tests | TKT-505 |
| 2 | Fuse `Range` into its consumer, `Map` into `Map`, `Reduce`, `Take`; unroll literal-count ranges | after `TirInliner`, before `TirLoopLowerer` | 321 one-line `Range` chains, 45 literal counts, 188 pipelines inside lambdas | section 2 | TKT-506 |
| 3 | Lower the filter idiom to a conditional append; name it `Filter` | lowerer and `primitives.library.plato` | 109 `FlatMap` sites, 11 of which build an `n.Range` to take nothing from it (`step.library.plato` 165 to 167, O(E^2) on ELLA-W1) | section 2 and the algorithmic-performance report | TKT-507 |
| 4 | Document the pipeline for agents; split the passes along the data flow; fix the stale comments | `plato/docs`, pass headers | | section 1 is the first draft; the owner asked for it 2026-10-23 | TKT-508 |
| 5 | Backend override table (plato-368, `ready`, p1): `Sort` and `SortedIndices` by `Array.Sort` on a key array, `Concatenate` and `Take` by `Array.Copy` | Plato runtime | 59 sort sites, 323 `Concatenate`, 288 `Take` | run E: `NeighbourSlots` 165 ms; the merge sort is stable and `Array.Sort` is not, so equal keys need a law | plato-368 |
| 6 | Emit `T[]` or `FrozenArray<T>` where the writer knows the producer, instead of `IReadOnlyList<T>` | `CSharpTypeWriter` | every index | no measurement here; the materializer's 2026-07 probe put interface dispatch as the dominant micro-cost | none yet |
| 7 | Allocation-free small arrays: a fixed-size `Triple<T>` for `CornerPositions`, `corners`, `ring` | library, with the lowerer unrolling literal-count arrays | 2 arrays per tested triangle per round, 5 per insertion trial | run E: 500 MB in trials | folds into TKT-506 |

Order: 1 first (a day, and it decides how much 2 and 3 are worth), then 2 and 3 together with a corpus run before and
after, then 4 as the write-up of what landed. 5 to 7 wait for the measurement after 1 to 3.

## 5. What this cannot see

- No allocation profile of the current build was taken; run E's numbers are from 2026-10-21 and predate TKT-407 and the
  neighbour-table work. The before-and-after criterion in each ticket supplies it.
- The one-line counts miss chains written across `var` bindings, which the generated statement bodies favour; the real
  counts are higher.
- The 16.4-minute compile with `--inline` doubled the compiler's own time; a regen with every pass on needs the
  compiler's cost measured too.
