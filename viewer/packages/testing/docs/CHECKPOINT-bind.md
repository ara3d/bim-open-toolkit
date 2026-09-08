# Track BIND checkpoint — normalized binding cost

State: verified (both chunks)
Contract revision in force: P0 (`docs/plans/visualization/V2-PLAN.md`) plus `M1-stub` from Track M. Acknowledged.

Fence: `viewer/packages/testing/src/bindings/**`, `test/bindings/**`, `test/perf/bindings/**`,
`docs/normalized-bindings.md`, `docs/CHECKPOINT-bind.md`. Everything else in the package is read-only,
including `src/perf/**` and `test/perf/*.perf.ts` (Track PERF).

Nested sub-agents spawned so far: 0.

## Chunk plan

| # | Concern | Files | State |
|---|---|---|---|
| 1 | Columnar binding builder, alpha baseline, synthetic model, regression tests | `src/bindings/**`, `test/bindings/**` | verified, committed `e936857` |
| 2 | Benchmarks and the report | `test/perf/bindings/**`, `docs/**` | verified, committed `3ccea84` |

Commits: `e936857` builder and regression tests, `3ccea84` benchmarks and report, `947f395` checkpoint
state, `c318094` steadied the small-scale benchmark, and one further checkpoint edit recording these.

## Delivered

`src/bindings/` builds a columnar binding from the loader's own output, copying nothing:

- `source.ts` — reads a field of a record table in place (`IntColumn` with offset and stride), so the
  BFAST entity index at word 13 of every 16-word instance record is read without materializing a column.
- `object-table.ts` — objects as two `Int32Array`s (entity row, source id) plus an entity-to-row index,
  in the same order the alpha loader creates them, with the record derived on demand.
- `representation-table.ts` — `objectIndex`, `groupIndex`, `instanceIndex` columns over the group
  buffers, with `colorFactor` and `localTransform` override columns allocated only if a row needs one.
  `instanceAt` answers "which object, transform and colour does instance i have" through views on the
  group buffers, so parity is checked without materializing anything.
- `build.ts` — the whole binding step, split into the parts that cost different amounts: object table
  (per entity), opaque material rebuild (per group), transform validation (per float), up-axis
  conversion (per instance, bulk over the group buffers), representation columns (per instance).
- `alpha-reference.ts` — the alpha loader's binding step as a standalone synchronous function, so it
  can be timed. Checked against the shipped `loadBosModel` on the reference model.
- `synthetic-model.ts` — a `RenderModel` built in memory, with hidden instances, instances with no
  mesh, an empty mesh, several instances per object and entity rows no instance names. No file, no
  private data.

`test/bindings/` runs in `npm test`: exact parity between the alpha bindings and the columnar table on
the synthetic model for Y up and Z up, and the edge cases above.

`test/perf/bindings/` runs in `npm run perf`: the reference-model benchmark (skips with a printed
reason when the model is absent) and a synthetic 10k/100k/500k benchmark that always runs.

`docs/normalized-bindings.md` has the method, the numbers and the recommendation.

## Headline numbers

Reference model, warm, Node 22.13.1, Windows 11, Intel Core Ultra 7 155H, 64 GB. Medians of five
interleaved repetitions after warm-up.

| Step | Median ms |
|---|---:|
| parse | 94 |
| entity table decode | 14 |
| group conversion | 574 |
| alpha binding | 348 |
| columnar binding | 75 |

Memory retained by the binding step: 234.8 MB of JavaScript objects for the alpha against 4.6 MB of
objects plus 5.23 MB of typed-array columns for the columnar path, so 9.8 MB against 234.8 MB.
(V8 keeps typed-array backing stores out of `heapUsed`; verified directly, and the column bytes are
asserted structurally rather than sampled.) End to end the shipped `loadBosModel` measured 1687 ms
against 896 ms for parse plus entity table plus conversion plus columns.

Of the columnar step's 75 ms, 41 ms is transform validation that `parseBfastModel` has already done.
Dropping it leaves about 35 ms, of which 13 ms is the object table and 12 ms the three columns.

## Commands and results

Run from `viewer/`, 2026-09-07:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/testing/tsconfig.json` | pass, no output |
| `npx eslint packages/testing` | pass, no output |
| `npm test -w @bim-open-toolkit/testing` | pass, 5 files, 28 tests, 1.3 s |
| `npm run perf -w @bim-open-toolkit/testing` | 6 files, 13 tests, 351 s: this track's 2 files and 4 tests passed; 2 tests failed outside the fence (see below) |
| `NODE_OPTIONS=--expose-gc npx vitest run --config vitest.perf.config.ts test/perf/bindings` | pass, 2 files, 4 tests; numbers in `docs/normalized-bindings.md` |
| the same, repeated while three other tracks were running | the 10,000 instance case of the synthetic benchmark failed once at five repetitions; fixed by raising it to 25, and the whole run took 210 s instead of 30 s |
| the same with `SNOWDON_BFAST_PATH` pointing at a missing file | the reference-model file skips with a printed reason; the synthetic benchmark still runs |
| escape-hatch scan over the fence | 0 `any`, 0 casts, 0 non-null assertions, 0 directives |

The perf numbers above were taken with `NODE_OPTIONS=--expose-gc`, which is what makes the heap
readings meaningful. Without it the benchmark still runs and asserts the timing relationship; the heap
comparison is reported as unavailable rather than asserted on a sampled number.

## Shared inputs

`test/perf/bindings/**` imports `src/perf/measure.ts` and `src/perf/memory.ts`, which belong to Track
PERF and were uncommitted and being edited while these benchmarks were written. Reusing them was the
right call — they are the measurement protocol the wave agreed on and duplicating them would have made
two sets of numbers incomparable — but a change to `measureAll`, `prepare` or `measureHeapGrowth`
invalidates the numbers recorded here. Track PERF's uncommitted edits at the time of writing were to
`src/perf/columns.ts`, `src/perf/measure.ts` and four `test/perf/*.perf.ts` files.

Other sessions' changes to `viewer/packages/demos/**`, `viewer/packages/interact/**` and
`viewer/packages/synthetic/**` were present in the working tree throughout and were never staged.

Incident to report to the supervisor: the chunk 2 commit was first issued as `git commit -F -` at the
head of a shell pipeline, so the here-document fed the pipeline's last command and `git` waited on an
empty standard input. It held `.git/index.lock` for about four minutes, which blocks every other track
in this checkout. Recovery: killed the one `git.exe`, confirmed no other git process was running,
removed the stale lock, confirmed the index still held exactly this track's five files, and committed
again with the message in a scratch file. Rule for the wave: never pipe `git commit`, and pass a commit
message as a file rather than on standard input.

## Failures outside the fence

The full `npm run perf` run had two failures, both in Track PERF's uncommitted files, both timing
relationships that did not hold on a machine running several sessions at once:

- `test/perf/change-detection.perf.ts:98` — `expected 1.136 to be greater than 1.2247`
- `test/perf/transform-updates.perf.ts:173` — `expected 135.50 to be less than 92.67`

Not investigated; they are Track PERF's to judge. This track's own files were verified with
`npx vitest run --config vitest.perf.config.ts test/perf/bindings`.

## Remaining work

None inside this fence; the study is finished. What it hands on, all outside the fence:

- Track R takes the `RepresentationTable` shape into `render` and merges it with Track PERF's
  `InstanceColumns`; Track F builds it in `formats` from `InstanceRecords`.
- The BOS path was not measured. The columnar builder consumes `bosToGroups` output unchanged because
  it has the same `groupEntities` shape, but no number backs that.
- The two loaders changes in findings 2 and 3 need the loaders session, not this track.
- Group conversion, not binding, is where the remaining load time is (finding 4).

## Blockers

None.

## Requests to the supervisor

1. `viewer/packages/testing/package.json` does not declare `@ara3d/viewer-core`, `@ara3d/viewer-loaders`,
   `@bim-open-toolkit/visualization` or `three`. They resolve through the workspace root, so tests and
   typecheck pass, but the dependency is implicit. Add them when the package is next edited.
2. `viewer/packages/testing/src/index.ts` is supervisor-owned and still exports nothing, so
   `src/bindings/index.ts` is reachable only by path. Export it when the shape is accepted, or move the
   shape into `render` (see the recommendation in the report).
3. `viewer/packages/testing/vitest.perf.config.ts` does not expose a garbage collector, so heap figures
   need `NODE_OPTIONS=--expose-gc` on the command line. Adding `--expose-gc` to the perf pool options
   would make the memory assertions run by default.
4. Ask the loaders session to export `writeBFast` and `bytesOf` from `@ara3d/viewer-loaders`. They exist
   in `src/bfast-writer.ts` but are not in the package's exports, so a downstream package cannot build a
   BFAST fixture file. This track worked around it by building `RenderModel` objects directly, which is
   fine for the binding step but not for testing the container reader.

## Findings

1. **The per-instance binding objects carry no information.** Every alpha `InstanceBinding` copies its
   transform and colour out of the group buffers that still hold them. For the reference model that is
   456,598 objects holding 456,598 frozen 16-element arrays and 456,598 frozen 4-element arrays, 234.8 MB,
   to say what three integer columns of 5.23 MB say.
2. **The transform validation in the binding step is redundant for BFAST.** `parseBfastModel` already
   rejects a non-finite instance transform (`bfast-loader.ts`, the loop over `instanceFloats`). Repeating
   it during binding costs 41 ms of the columnar step's 75 ms. It is still needed for the BOS path, which
   composes transforms during conversion.
3. **The opaque material rebuild is a conversion concern, not a binding concern.** The alpha rebuilds
   every group whose material opacity is not 1, copying its transform and colour buffers, because source
   alpha is carried in the per-instance colour and would otherwise be applied twice. 10 ms and a copy of
   the buffers of every translucent group. If `bfastToGroups` and `bosToGroups` emitted opaque materials
   and left alpha in the colour column, the rebuild would disappear from every consumer. This is a
   loaders change and was not made.
4. **Group conversion is now the dominant cost**: 574 ms of an 896 ms load, against 12 ms for the three
   representation columns. The next optimization target is `bfastToGroups`, not binding. It allocates two
   `Float32Array`s per group (158,055 groups for 456,598 instances, under three instances each) and a
   `number[]` of entities per group. A single pair of buffers for the whole model with per-group slices
   would remove 316,110 small allocations.
5. **Track M's `InstanceRecords` and Track PERF's `InstanceColumns` are two thirds of this table.**
   `InstanceRecords` (`packages/model/src/mesh.ts`) is the format-side view: `meshIndex`, `transform`,
   `color`, `objectIndex`, one row per placement before grouping. `InstanceColumns`
   (`packages/testing/src/perf/columns.ts`) is the render-side view: `groupOf`, `indexInGroup`. The
   `RepresentationTable` here is the render-side view plus `objectIndex`, which is what makes an update
   addressable by object. The three should become one type in `render`; the report says where.
6. **`loadBosModel` yields to the event loop every 4096 instances.** That is 111 yields on the reference
   model. The measured in-process alpha binding step is 348 ms while the supervisor's end-to-end figure
   attributes about 1.1 s to it; the difference is the yields, the progress callbacks and a cold heap.
   A columnar build has nothing to yield for: 12 ms of column filling does not block a frame.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 4 | ~20 s each | 1 (an unchecked typed-array read in the reference-model parity loop) | `noUncheckedIndexedAccess` forces `?? 0` on every typed-array read, including hot loops where the fallback is unreachable and the check is what is being measured | helpful, with a cost in the hot paths this track exists to measure |
| `eslint` | 2 | ~30 s each | 0 | slow relative to what it found on 9 files | neutral |
| escape-hatch scan (grep for `any`, `as`, `!`, directives) | 1 | <1 s | 0 | every prose "as" and "any" matched | neutral, cheap |
| `vitest` unit run | 3 | 1.3 s | 0; the regression tests passed on their first run | none | helpful as a guard, caught nothing yet because parity was designed in |
| `vitest` perf run | 9 | 10-30 s alone, 210-390 s while other tracks ran | 2: heap growth sampled without a forced collection is noise, so that assertion is now gated on `--expose-gc`; and five repetitions were not enough to keep two medians a few milliseconds apart in order under load | needs an environment variable to produce its memory numbers; a loaded machine makes every figure 5-10x larger, so a benchmark run has to be read together with what else was running | helpful, and the two defects it caught were both in the measurement rather than the code |
