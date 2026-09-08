# Track M2 checkpoint — model bridges (review follow-up)

State: working. Contract revision in force: M1, additive only (no export renamed, removed or
re-signed). Fence: `viewer/packages/model/**` except `package.json`, `tsconfig.json`,
`tsconfig.build.json`, `vitest.config.ts`.

## Chunks and commits

| # | Brief item | Concern | Commit | State |
|---|---|---|---|---|
| 1 | 4 | Table accessors by column type, `tableFromRecord` | `d1d3bb6` | verified |
| 2 | 3 | `joinTablesOn` for string keys | `b489031` | verified |
| 3 | 1 | `instanceTable` | this commit | verified |
| 4 | 2 | `rowsInSet`, `setOfRows` | — | not started |
| 5 | 5 | `Vec2` and its helpers | — | not started |
| 6 | 6 | README, README test, CONTRACTS M1.1 section | — | not started |

## Delivered so far

New exports, all additive:

- `table.ts`: `tableFromRecord`, `stringColumnOf`, `boolColumnOf`, `cellOf`, `numberOf`, `stringOf`,
  `indexByStringKey`, `matchStringRows`, `joinTablesOn`.
- `instance-table.ts` (new module): `instanceTable`, `transformColumnNames`, `colorColumnNames`.

`instanceTable` layout: `meshIndex` and `objectIndex` are the records' own `Int32Array`s, not
copies; the transform becomes sixteen `f32` columns `m0`..`m15` (`m{c * 4 + r}`, so `m12`, `m13`,
`m14` are the translation) and the colour four columns `red`, `green`, `blue`, `alpha`. One
allocation and one pass per component column, none per row.

Why one column per component rather than one strided column sharing the transform buffer: a strided
column is longer than the table's row count, so `takeRows`, `filterRows`, `sortRows` and the joins
would silently mix rows up. Correctness before the copy. JavaScript has no strided view of a typed
array, so sharing the buffer and having usable columns are exclusive.

## Commands and results

Run from `viewer/`, after chunk 3:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, 5 s |
| `npx eslint packages/model` | pass, 14 s |
| `npm test -w @bim-open-toolkit/model` | pass, 19 files, 211 tests, 1.1 s |

Baseline before any edit: 18 files, 198 tests, 0.8 s.

## Findings

- `instanceTable` at 100,000 rows: 4.1 ms, against 15.5 ms for the best possible per-row build (one
  `Matrix4` and one `Color` per row, written into preallocated typed arrays). 3.8 times, asserted in
  the test at twice so a loaded machine does not fail the suite. Both builds move the same bytes;
  the per-row allocations are the whole difference.
- Transposing 16 components with one whole-buffer pass each costs 11.8 ms rather than 4.1 ms,
  because a stride of 16 floats is exactly one cache line: the buffer is read once per component.
  `instance-table.ts` spreads 512 rows at a time instead.

## Blockers

None.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 4 | 5 s warm | 0 so far | none | neutral so far |
| `eslint` | 3 | 14 s | 0 | 14 s for 20 source files is the slowest gate here | neutral |
| `vitest` | 6 | 0.8 to 1.2 s | 1 real: the first `instanceTable` was only 1.5 times faster than the per-row build, which the timing test caught and the cache-blocked transpose fixed | none | helpful |
