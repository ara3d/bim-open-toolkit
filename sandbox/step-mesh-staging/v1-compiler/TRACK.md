# v1-compiler: Plato compiler defects that cost corpus faces or split the interpreter from compiled C#

Ticket: TKT-410, TKT-355 (TKT-398 left: it blocks nothing in the corpus)
Status: ready: C1, C2

Fence: this folder, `tickets/TKT-410*`, `tickets/TKT-355*`, and the Plato repository
(`C:\Users\cdigg\git\plato`: `writers/`, `src/`, `tests/`, `docs/interpreter.md`), committed there.
Both fixes are in the Plato compiler, so this folder holds no `.plato` files and there is nothing
to merge into the library.

## Chunks

| Id | Ticket | What | Expected | Actual |
|---|---|---|---|---|
| C1 | TKT-410 | Why `BisectionCached.SagittaByHullBoundGiven` has no ground TIR; fix in the compiler | 2 h | about 2.5 h, most of it cold builds |
| C2 | TKT-355 | Cause of the three interpreter/compiled divergences; fix with a regression test | 2 h | about 1 h |
| C3 | TKT-398 | Only if it blocks the corpus: it does not (both defects have library workarounds, and the regenerated library has no stub) | - | - |

## Done

- C1, Plato `0ef7e686`: the resolver reads a `match` subject's sum type before type checking,
  from the call's function group. A function joins its group in the same loop that resolves
  bodies, and the regen copies every layer into one folder, where
  `discretization-ranged-bisection.library.plato` sorts before `geometry.library.plato`, which
  declares `CurveAt`. So the group was empty, the match had no sum type (CHK304, not printed by the
  CLI), and its TIR was unresolved. `SumTypeOfCall` now also reads declared methods' return types,
  which are resolved before any body. Regression fixture
  `tests/plato-test-sum/match-on-later-library-call.plato`. The DEGRADED log line now names the
  cause (`TirEmitSource.ExplainMissing`). Library 00-08 at 8984df4b, cpu64: DEGRADED 1 to 0. No
  library change and no type added: the library was correct.
- C2, Plato `c8c83c8b`: generated `Equals` compared an array field with `IReadOnlyList.Equals`
  (reference equality); the interpreter compares element-wise. Witness 7 (B-spline patch solid) is
  the only witness with array payloads in its curves and surfaces, so a model built twice differed
  from itself compiled. The writer now emits `Intrinsics.ArrayEquals` and `Intrinsics.ArrayHash`.
  Compiled verdicts: `Law_WitnessIsSameAsItself` fail to pass (14 cases), `Law_ReversalIsAnInvolution`
  fail to pass (25), `Law_DistinctWitnessesDiffer` pass (196). `Law_UpdatedNeighboursAreTheTable`
  already agreed (it is now stated over `TriangulatedWitness`, 42/42 on both). Differential test:
  0 mismatches of 975 cases under cpu64 and gpu32.

## Merge instructions

- None in the library. Move the Plato pin: `deps/bim-open-data/tools/regen-step-brep.ps1`,
  `$PinnedPlato = 'c8c83c8b660760d4f79e3f42576703dc684b832a'` (contains both fixes and the
  `2847ef71` checker change after the current pin `e37c032f`), regenerate, and move the bim-open-data
  pin in `deps.json`.
- The warm law server on 8768 (`PlatoNavigationMcp`, built from Plato `951a70ab`) does not have
  either fix; restart it from `c8c83c8b` so `plato_laws.py --backend csharp` agrees.

## Contract requests

## Requests to other tracks

## Findings

- A `match` subject's sum type depends on file order at resolution time; CHK304 from
  `SumTypeChecker` was never shown by `Plato.CLI`, so a non-sum subject degraded silently to a
  throwing stub. Fixed for calls; a `match` on a local whose initialiser calls a later file's
  function (the catalog ledger's lesson) still takes the local's declared type only.
- The lowered match re-evaluates its subject in every case test: `SagittaByHullBoundGiven` calls
  `m.Geometry.CurveAt(m.Edges[e].Curve)` up to ten times. Cheap here (an index), costly when a
  subject is a computation. A follow-up for the elaborator (bind the subject to a local).
- PlatoTests fails 4 tests at HEAD before and after these commits: the two conversion inventories
  (stale since 2026-10-17), plato-438 (TypeScript casing), and `stdlib/future/collision.library.plato`
  declaring a bodiless signature.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading tickets, regen script, compiler source | 25 min | - |
| Cold Release build of Plato.CLI (twice, two artifacts paths) | 11 + 5 min | 2 builds |
| Staging inputs and first library compiles (one crashed: no out folder) | 10 min | 3 compiles |
| C1 diagnosis with the new ExplainMissing message | 5 min | 1 compile |
| C1 fix, fixture, sum-type tests | 15 min | 1 compile, 36 tests |
| Full PlatoTests, then the 4 failures at HEAD to separate old from new | 5 + 10 min | 266 + 2 tests |
| C2 diagnosis, fix, regression test (with the fix and at HEAD) | 30 min | 3 test runs |
| C2 mesher laws on both backends | 3 min | 3 law runs |
| Full PlatoTests and Interpreter tests | 5 min | 339 tests |
| Corpus check (regen from commit, harness, two files) | see below | |

## Lessons

- A poll on a file fed by `cmd | grep | head` sees nothing until the command ends; two 10-minute
  waits were lost to it. Redirect the command to a file and poll that.
- `bash` loops of `cp` over 1,500 files took two minutes on this machine; one `Copy-Item` is faster.
- The regen script changed under me (commit-only inputs, `-PlatoCommit`); read the copy at the pin
  before relying on its parameters.
