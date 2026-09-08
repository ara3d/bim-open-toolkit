# Track M2 checkpoint — model bridges (review follow-up)

State: verified. Contract revision in force: M1, additive only — no export renamed, removed or
re-signed, so the label stays M1 and the additions are listed as "M1.1 additions" in
[CONTRACTS-M1.md](CONTRACTS-M1.md). Fence: `viewer/packages/model/**` except `package.json`,
`tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`. Nothing outside it was written.

## Chunks and commits

| # | Brief item | Concern | Commit | State |
|---|---|---|---|---|
| 1 | 4 | Table accessors by column type, `tableFromRecord` | `d1d3bb6` | verified |
| 2 | 3 | `joinTablesOn` for string keys | `b489031` | verified |
| 3 | 1 | `instanceTable` | `31ef243` | verified |
| 4 | 2 | `rowsInSet`, `setOfRows` | `b6885cb` | verified |
| 5 | 5 | `Vec2` and its plane helpers | `d1645b8` | verified |
| 6 | 6 | README, README test, CONTRACTS M1.1 section | this commit | verified |

## Delivered

New exports, all additive:

- `math.ts`: `Vec2`, `crossVec2`, `turnVec2`, `polygonArea`. Track S can now delete the local `Vec2`,
  `turn` and `signedArea` in its `src/triangulate.ts`.
- `table.ts`: `tableFromRecord`, `stringColumnOf`, `boolColumnOf`, `cellOf`, `numberOf`, `stringOf`,
  `indexByStringKey`, `matchStringRows`, `joinTablesOn`.
- `instance-table.ts` (new module): `instanceTable`, `transformColumnNames`, `colorColumnNames`.
- `table-sets.ts` (new module): `rowsInSet`, `setOfRows`.

`joinTablesOn` takes two integer key columns or two string key columns, so a schedule keyed by
object id joins. `joinTables` keeps its integer-only behaviour and now shares the assembly step.

`instanceTable` layout: `meshIndex` and `objectIndex` are the records' own `Int32Array`s, not copies;
the transform becomes sixteen `f32` columns `m0`..`m15` (`m{c * 4 + r}`, so `m12`, `m13`, `m14` are
the translation) and the colour four columns `red`, `green`, `blue`, `alpha`. One allocation and one
pass per component column, none per row.

Why one column per component rather than one strided column sharing the transform buffer: a strided
column is sixteen times longer than the row count, so `takeRows`, `filterRows`, `sortRows` and the
joins would silently mix rows up — and filtering the instance table to the unrated doors is the
first thing anyone will do with it. JavaScript has no strided view of a typed array, so sharing the
buffer and having usable columns are exclusive. Correctness before the copy.

`rowsInSet` reads a string column of object keys, or an integer column of object indices against a
`keys` array (an instance table's `objectIndex` against `objectRefs(model).map(objectKey)`).

README: the three mismatches the review found are now stated (`ref` not `id`, `|` not `#`, `table()`
takes entries), and the probe's door-review sequence — coverage, reconcile, style rule, instance
table, schedule join — is a README example that runs in `test/readme.test.ts` on hand-made data,
since that file imports only this package.

## Commands and results

Run from `viewer/` after chunk 6:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, no output, 5 s |
| `npx eslint packages/model` | pass, no output, 14 s |
| `npm test -w @bim-open-toolkit/model` | pass, 20 files, 224 tests, 1.0 s |
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | pass, no output (read-only check, nothing in `synthetic` was edited) |

Baseline before any edit: 18 files, 198 tests. All four were run before every chunk commit.

## Verification limits

- Only `model` was checked, plus the `synthetic` typecheck. The other wave 1 packages import this
  one from source and were being edited while this ran, so no repository-wide typecheck was run and
  none would have been meaningful. The additions are new names; the risk to a track is a name
  collision with its own local export, and `Vec2`, `numberOf` and `stringOf` are the likely ones.
- The 100k-row timing test compares two builds in the same process. It asserts a relationship, not a
  wall time, and it is the only test here that could fail on a loaded machine.
- No renderer has consumed `instanceTable`. Column names and the `m0`..`m15` order are asserted
  against `instanceTransform`, not against a GPU buffer.

## Blockers

None. Every item was possible additively and without a per-row allocation.

## Findings

- `instanceTable` at 100,000 rows: 4.1 ms, against 15.5 ms for the best possible per-row build (one
  `Matrix4` and one `Color` per row, written into preallocated typed arrays). 3.8 times, asserted in
  the test at twice so a loaded machine does not fail the suite. Both builds move the same bytes, so
  the per-row allocations are the whole difference; a probe-style build into plain arrays would be
  further behind again.
- Transposing sixteen components with one whole-buffer pass each costs 11.8 ms rather than 4.1 ms,
  because a stride of sixteen floats is exactly one cache line: the buffer is read once per
  component. `instance-table.ts` spreads 512 rows at a time instead.
- `Column.values` is a mutable typed array on an otherwise immutable structure, which is what lets
  `instanceTable` share the index arrays. Every existing column exposes the same handle, so this is
  the package's standing convention rather than a new hole, but it is the one place where two
  structures now alias and a `render` track writing into a column would change the records.
- The `render` track does not need `instanceTable` to upload buffers: `InstanceRecords` already
  gives it one contiguous array per attribute. The table is for querying, filtering and joining.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction or false positives | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 7 | 5 s warm | 0 | none | neutral here: the additions were small and typed by their callers |
| `eslint` | 5 | 14 s on 21 source and 22 test files | 0 | 14 s is the slowest gate in this track and caught nothing in it | neutral, drifting towards hindrance at this package size |
| `vitest` | 9 | 0.8 to 1.3 s for 224 tests | 1 real: the first `instanceTable` was only 1.5 times faster than the per-row build, which the timing test caught and the cache-blocked transpose fixed | none | helpful, and the timing test earned its place on its first run |
| `tsc -p packages/synthetic` | 1 | 6 s | 0 | none | helpful as the one cheap check that an additive change stayed additive |
