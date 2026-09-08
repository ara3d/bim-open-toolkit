# Track PERF checkpoint

Instance-update performance study. Fence: `viewer/packages/testing/src/perf/**`,
`viewer/packages/testing/test/perf/*.perf.ts` and `*.test.ts` (not the `bindings`
subdirectory, which Track BIND owns), and this document plus
`viewer/packages/testing/docs/instance-updates.md`.

## State

`working`. Colour and visibility questions are measured and committed. Transforms,
change detection and the binding-object comparison are still to do.

## Resumption note (2026-09-07, second agent)

The first PERF agent stalled at about 20:07 with uncommitted work and no checkpoint.
The state it left was five source files and three test files, all substantially
complete and of good quality. Nothing was rewritten. One defect was found and fixed:
`visibility.perf.ts` keyed a `Map` with the literal union from an `as const` array, so
`hiddenRows.get(fraction)` did not typecheck under strict mode. After that fix every
check passed, so the found work was committed as one chunk.

## Machine

Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11 (10.0.26200), Node
v22.13.1, vitest 4.1.11. All numbers in `instance-updates.md` are from this machine.

## Files

| File | Purpose |
|---|---|
| `src/perf/prng.ts` | Seeded random numbers and distinct row selection |
| `src/perf/measure.ts` | Warm-up, repetitions, medians, markdown table printing |
| `src/perf/memory.ts` | Heap growth accounting, optional forced collection |
| `src/perf/scene.ts` | Deterministic instanced scenes shaped like the reference model |
| `src/perf/columns.ts` | Columnar instance table, bulk writes, dirty ranges |
| `test/perf/columns.test.ts` | Correctness contract of the bulk-write helpers (fast) |
| `test/perf/color-updates.perf.ts` | Bulk colour change cost |
| `test/perf/visibility.perf.ts` | Hide and restore cost |

## Delivered behaviour

- A synthetic scene generator that reproduces the reference model's shape: 456,598
  instances over 158,055 groups, so the mean group holds 2.9 instances and a few
  hold hundreds. It builds real `InstancedGroup` objects from the alpha renderer
  and never reads model data.
- A columnar instance table over borrowed group buffers, in two layouts: one
  buffer per group (what the alpha has) and one allocation per attribute with each
  group's buffer a view into it (what V2 should have).
- Bulk writes that take a row list and either one broadcast value or one value per
  row, with optional change detection and optional dirty-range collection.
- Measured answers for colour and visibility, printed as tables by each test.

## Remaining work

1. Transform updates: bulk matrix writes, bounds recomputation, partial versus full.
2. Change detection: cost of comparing rows against writing unconditionally.
3. Binding objects versus columns at 10k, 100k, 500k: build time and heap.
4. `docs/instance-updates.md`: method, tables, ranked recommendations.

## Commands and actual results

Run from `viewer/`.

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/testing/tsconfig.json` | passes (after the `Map` fix; failed once before it) |
| `npx eslint packages/testing` | passes, no output |
| `npm test -w @bim-open-toolkit/testing` | 2 files, 10 tests passed, 994 ms |
| `npm run perf -w @bim-open-toolkit/testing` | 2 files, 6 tests passed, 6.8 s |

## Chunk commits

| Chunk | Commit | Verification |
|---|---|---|
| Colour and visibility measurements (found work plus the typecheck fix) | `a24b8d5` | the four commands above |

## Blockers

None.

## Requests to the supervisor

1. `npm run perf -w @bim-open-toolkit/testing` hides every printed table. Vitest 4's
   default reporter only forwards `stdout` for failing tests, so the measurement
   tables a perf run is supposed to leave behind are invisible. `npm run perf -w
   @bim-open-toolkit/testing -- --reporter=verbose` shows them. Please change the
   `perf` script in `packages/testing/package.json` to
   `vitest run --config vitest.perf.config.ts --reporter=verbose`; the file is
   outside this track's fence. Until then, the documented way to reproduce the
   tables is the `--` form.
2. Consider adding `--expose-gc` to the perf script (`NODE_OPTIONS=--expose-gc`), so
   `src/perf/memory.ts` can force a collection before each heap reading. Without it
   the heap comparison in the binding-versus-columns measurement includes garbage
   and is a rough comparison rather than a retained-size measurement.

## Findings so far

See `instance-updates.md` for the tables. Headline results:

- Per-instance `setColor` is not the main cost of a bulk colour change. Replacing
  10,000 calls with 10,000 indexed writes saves about 23 %; sorting those rows into
  buffer order saves 67 %; making them contiguous saves 90 %. Memory order matters
  more than call overhead.
- Publishing the change is the expensive part. 10,000 scattered instances live in
  8,594 distinct groups, so "notify once per group" is nearly "notify once per
  instance": it costs 3.2 times the write it is publishing. Recording a dirty slot
  range per group instead costs 3 % on top of the write.
- Hiding is a cheap column write at every fraction measured, and rebuilding the
  three.js batches for the whole model costs 273 ms, about 150 times more than
  hiding half the model.

## Tooling

One line per check, per the wave's tooling ledger.

| Check | Runs | Wall time | Real defects | False positives / friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 3 | 12–18 s | 1: a `Map` keyed by an `as const` literal union rejected a `number` lookup, which would have been a runtime-silent authoring trap | none | helpful |
| `eslint packages/testing` | 2 | 25–30 s | 0 | none; slower than the typecheck and found nothing here | neutral |
| Escape-hatch rules (no `any`, no `as`, no `!`) | continuous | none | 0 directly, but they forced `?? 0` and explicit `undefined` guards on every typed-array read, which is noise in tight measurement loops and could itself perturb a measurement | the `?? 0` fallbacks are dead branches that a reader must check; `noUncheckedIndexedAccess` is the actual source, not the escape-hatch ban | neutral, with a caveat: measure code pays a readability tax here |
| `vitest run` (unit) | 2 | ~1 s | 0 | none; fast enough to run on every edit | helpful |
| `vitest run --config vitest.perf.config.ts` | 4 | 5–7 s | 0 | the default reporter swallows the tables the tests exist to print (see request 1) | helpful once the reporter is fixed |
