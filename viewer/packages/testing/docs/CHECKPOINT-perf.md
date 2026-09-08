# Track PERF checkpoint

Instance-update performance study. Fence: `viewer/packages/testing/src/perf/**`,
`viewer/packages/testing/test/perf/*.perf.ts` and `*.test.ts` (not the `bindings`
subdirectory, which Track BIND owns), and this document plus
`viewer/packages/testing/docs/instance-updates.md`.

## State

`verified`. All six questions in the brief are measured, every measurement is a
runnable test, and the findings document is written. Every assigned gate passes
against the recorded inputs.

## Resumption note (2026-09-07, second agent)

The first PERF agent stalled at about 20:07 with uncommitted work and no
checkpoint. It had left five source files and three test files covering colour
and visibility, substantially complete and of good quality. Nothing was
rewritten. One defect was found and fixed (a `Map` keyed by an `as const` literal
union rejected a `number` lookup under strict mode); after that every check
passed and the found work was committed as chunk 1.

Two things in that work were later found to be measurement artifacts rather than
results, and are corrected in the findings document:

- "One shared allocation halves a scattered colour write." It does not. The
  apparent halving came from measuring each case to completion in turn: the
  per-group case ran first and paid a cold start. Measured with the cases
  interleaved, the two are the same within the run-to-run spread.
- The default of 7 repetitions was too few for the 10,000-row cases; medians of
  cases a few hundred microseconds apart swapped places between runs.

## Machine

Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11 (10.0.26200), Node
v22.13.1, vitest 4.1.11. Other agents were working in the same checkout for most
of this track's run, which is why the measurement protocol ended up where it did.

## Files

| File | Purpose |
|---|---|
| `src/perf/prng.ts` | Seeded random numbers and distinct row selection |
| `src/perf/measure.ts` | Warm-up, interleaved repetitions, medians, table printing |
| `src/perf/memory.ts` | Heap growth with a forced collection, reached without `--expose-gc` |
| `src/perf/scene.ts` | Deterministic instanced scenes shaped like the reference model |
| `src/perf/columns.ts` | Columnar instance table, bulk writes, dirty ranges, column diff |
| `src/perf/bounds.ts` | Allocation-free world bounds over the columns |
| `src/perf/object-index.ts` | The alpha's per-instance binding layout beside the columnar one |
| `test/perf/columns.test.ts` | Correctness contract of the bulk-write helpers (fast) |
| `test/perf/bounds.test.ts` | Columnar bounds agree with the alpha's (fast) |
| `test/perf/object-index.test.ts` | The two object layouts describe the same assignment (fast) |
| `test/perf/color-updates.perf.ts` | What a bulk colour change costs |
| `test/perf/visibility.perf.ts` | What hiding and restoring cost |
| `test/perf/transform-updates.perf.ts` | What moving instances costs, and what bounds add |
| `test/perf/change-detection.perf.ts` | What finding the changed rows costs |
| `test/perf/binding-objects.perf.ts` | Per-instance binding objects against columns |
| `test/perf/batch-sync.perf.ts` | What the alpha's mirror does with a small change |

## Delivered behaviour

- A synthetic scene generator reproducing the reference model's shape: 456,598
  instances over 158,055 groups (2.9 instances per group) belonging to 51,139
  objects (8.9 instances per object). It builds real `InstancedGroup` objects
  from the alpha renderer and never reads model data.
- A columnar instance table over borrowed group buffers in two layouts, with
  bulk writes that take a row list plus either a broadcast value or a value per
  row, optional change detection, and optional dirty-range collection.
- An allocation-free columnar bounds implementation, unit-tested against the
  alpha's `groupBounds` and `sceneBounds`.
- A faithful local model of the alpha's `RenderBinding` layout beside the
  columnar equivalent, unit-tested to describe the same assignment.
- A measurement harness that warms every case in a comparison group before
  timing any of them and interleaves repetitions.
- Six perf tests, each answering one question, each printing its table and
  asserting relationships rather than absolute times.
- `docs/instance-updates.md`: method, machine, tables, interpretation and
  fifteen ranked recommendations for the V2 `InstanceTable`, each with the
  measurement behind it.

## Remaining work

None assigned. Three things worth doing later are recorded at the end of the
findings document under "What is not measured here": GPU upload cost (needs a
browser), the cost of sorting an unsorted row list, and anything against real
model data.

## Commands and actual results

Run from `viewer/`. Times are on a machine shared with other agents.

| Command | Result | Wall time |
|---|---|---|
| `npx tsc --noEmit -p packages/testing/tsconfig.json` | passes | 15 s |
| `npx eslint packages/testing` | passes, no output | 14 s |
| `npm test -w @bim-open-toolkit/testing` | 6 files, 34 tests passed (includes Track BIND's) | 1.2 s |
| `npm run perf -w @bim-open-toolkit/testing -- <this track's six files>` | 12 tests passed, three consecutive runs | 30 s each |

Note that `npm test` and `npm run perf` without a filter also run Track BIND's
files under `test/perf/bindings/`. This track's runs were filtered to its own six
files so another track's in-progress work could not be mistaken for a failure
here.

## Chunk commits

| Chunk | Commit | Verification |
|---|---|---|
| Colour and visibility (found work plus the strict-mode fix) | `b08d6b4` | the four commands above |
| Transforms and bounds | `e91d856` | the four commands above |
| Change detection and binding objects | `36d9f87` | the four commands above |
| Renderer sync, findings document | `9c071b2` | the four commands above |

## Blockers

None.

## Requests to the supervisor

1. **Make the perf script show its tables.** `npm run perf -w
   @bim-open-toolkit/testing` hides every printed table: vitest 4's default
   reporter only forwards `stdout` for failing tests, so the measurement tables a
   perf run exists to produce are invisible. Please change the `perf` script in
   `packages/testing/package.json` to `vitest run --config vitest.perf.config.ts
   --reporter=verbose`; that file is outside this track's fence. Until then the
   documented command is `npm run perf -w @bim-open-toolkit/testing --
   --reporter=verbose`.

2. **No `--expose-gc` is needed.** An earlier version of this checkpoint asked
   for it. `src/perf/memory.ts` now reaches the collector through `node:v8` and
   `node:vm`, so the heap figures are exact without changing the command line.
   `@types/node` is present in `viewer/node_modules`, so those imports typecheck.

3. **Consider whether perf files from different tracks should share a run.**
   `vitest.perf.config.ts` includes `test/perf/**/*.perf.ts`, so this track and
   Track BIND run together and each sees the other's failures. Splitting the
   include, or documenting that a track filters to its own files, would avoid
   the confusion this caused here.

## Findings

Full tables and interpretation are in `instance-updates.md`. Headline results:

- **Publishing costs more than writing.** Recolouring 10,000 instances and then
  bumping a version per touched group costs 3.5 times the write itself, because
  those 10,000 instances fall in 8,594 groups. Recording a dirty slot range per
  group instead costs 20 % on top of the write and carries more information.
- **Any change makes the alpha's mirror walk every group.** Recolouring one
  instance costs 69 % of recolouring five hundred. Scaled to the reference
  model's group count the floor for any change would be about 7 ms.
- **Memory order beats call overhead.** Removing the per-instance call saves
  30 %; sorting the same rows into buffer order saves 65 %.
- **A full-table update should drop the row index.** A straight pass over the
  colour store is twice as fast as the same values written through a row list.
- **Wide columns must be copied, not looped.** Assigning 16 floats one at a time
  made a whole-model transform write no faster than the alpha's per-instance
  `setTransform`; `TypedArray.set` per row brought it from 13.1 ms to 9.3 ms.
- **Bounds are the expensive part of moving instances.** The cheapest correct
  bounds update after a 10,000-row move cost 11.5 ms against 2.4 ms for the move.
  The alpha's `sceneBounds` costs 100 ms for the model; the same arithmetic
  without per-instance allocations costs 37 ms.
- **Change detection is CPU-neutral.** Comparing before writing lands within 15 %
  of writing unconditionally whatever fraction of rows changed, including when
  none did. Its value is entirely downstream.
- **Per-instance binding objects are expensive to hold.** At 500,000 instances
  they take 340 ms to build and hold 127 MB, against 30 ms and 4.3 MB for
  columns, and the memory ratio grows with the model.
- **Baking small meshes costs three to four times more to recolour.** 14.2 ms
  against 4.1 ms to recolour a 50,000-instance model.

## Tooling

One line per check, for the tooling ledger.

| Check | Runs | Wall time | Real defects caught | False positives / friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | ~25 | 14–18 s | 3: a `Map` keyed by an `as const` union rejecting a `number`; an unused import left by an edit; an import of a name that does not exist, which vitest had silently turned into `undefined` and made a measurement read zero rows | none | helpful — the third defect was a wrong measurement that the test itself could not see |
| `eslint packages/testing` | ~8 | 14–30 s | 0 | none, but it never found anything the compiler had not | neutral |
| Escape-hatch rules (no `any`, no `as`, no `!`, no directives) | continuous | none | 0 directly | real friction: `noUncheckedIndexedAccess` forces `?? 0` on every typed-array read, so the inner loops of the measurement code are full of dead fallback branches a reader has to check. It cost about ten minutes and made two hot loops harder to read. It did not prevent a bug in this track's work | neutral, with a caveat: tight numeric code pays a readability tax here that other code does not |
| `vitest run` (unit) | ~10 | 1 s | 2: the columnar bounds initially disagreed with the alpha's on nothing, but the tests are what proved the two layouts and the two bounds implementations agree, which is what makes the comparisons meaningful | none; fast enough to run on every edit | helpful |
| `vitest run --config vitest.perf.config.ts` | ~45 | 30 s for this track's six files | the perf tests caught four of their own claims being false: a bulk transform write that was slower than the alpha's per-instance path, change detection that saves nothing, a "shared allocation halves it" result that was a measurement artifact, and a per-row copy that is not faster than a per-row loop | the default reporter hides the tables (request 1); assertions comparing close cases needed three protocol revisions before they stopped failing at random on a busy machine | helpful, and the most valuable check here — but only after the protocol was fixed; a naive perf test on this machine is a flaky test |

Protocol revisions, recorded because they are the transferable lesson:

1. 7 repetitions, medians, each case measured to completion. Flaky, and the first
   case in every list was penalised by its cold start.
2. 25 repetitions, medians, cases warmed and timed in interleaved rounds. Fixed
   the cold-start bias and most of the flakiness; still failed about once in
   thirteen runs when another agent's work spiked the machine.
3. Same, but assertions compare the fastest repetition rather than the median.
   Interference can only add time, so the minimum is the estimate that survives.
   Assertions that were still unstable under this were removed rather than
   weakened, and the pairs they covered are reported without a claim.
