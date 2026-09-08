# Track R checkpoint: the render package

State: **verified** against the gates listed below, on the recorded inputs.
Contract revision: **M1 at `641624b`**, unchanged and unedited by this track. The model package
landed additive M1.1 columns and an instance-table module during the track; this package followed
them, see finding 9.
Fence: `viewer/packages/render/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts`, `vitest.perf.config.ts`. Nothing outside it was written.

Nested delegates spawned: **0**. Every module was small enough that specifying the work would have
cost more than doing it, and the two design corrections that mattered (see Findings 1 and 2) came
out of reading measurements, which is not work a written spec could have carried.

## Files

| File | Lines | What it holds |
|---|---:|---|
| `src/instance-table.ts` | 331 | Rows bound to viewer-core groups through typed-array index columns |
| `src/updates.ts` | 589 | Five bulk writers, change detection, dirty ranges, publish, change tables |
| `src/picking.ts` | 256 | Hit resolution, visibility and clipping rejection, ray and mesh geometry |
| `src/clipping.ts` | 125 | Planes and boxes, bounds rejection, the clipping seam |
| `src/representations.ts` | 238 | Registry, replacement state, drawn list, replacement pick source |
| `src/overlays.ts` | 292 | Primitives, layers, anchor resolution, projection, hit test |
| `src/environment.ts` | 233 | Settings, scale-aware grid, axes, ground, the environment seam |
| `src/capture.ts` | 113 | Size arithmetic and the render-encode-restore ordering |
| `src/timing.ts` | 227 | Frame and GPU timing, percentiles, scene statistics, HUD data |
| `src/scene-binding.ts` | 319 | Scene membership and the operations that cross modules |
| `src/index.ts` | 219 | One level of re-exports, one `//` line per export |
| `test/**` | 2 156 | 214 tests in 11 files, no browser |
| `test/perf/**` | 623 | 14 measured cases at 10k, 100k and 456,598 rows |

## Delivered behaviour

- **Instance table.** A model `Geometry` binds to one `InstancedGroup` per mesh, with rows ordered
  by mesh so a group's rows are contiguous. Object keys reach rows through index columns; there is
  no per-instance JavaScript object anywhere. Geometry-free instance records, out-of-range mesh
  indices, unknown object indices and repeated keys are reported as diagnostics, not refused.
- **Bulk updates.** Colour, opacity, visibility, whole transforms and translations, each taking a
  broadcast value or one per row, with change detection and per-group dirty slot ranges. `everyRow`
  drops the row index. `applyUpdates` drives the same writers from a model `Table` addressed by
  object ordinal or key; a partial colour or transform is refused rather than half applied.
  `publishDirty` bumps viewer-core's counters once per touched group.
- **Visibility composes with opacity.** The stored alpha is always `visible ? opacity : 0`, so
  hiding a ghosted object and showing it again returns it to ghosted.
- **Picking.** Renderer hits become object keys and a world point. Hidden rows, rows below
  `MIN_VISIBLE_ALPHA` and hits removed by the clipping planes are rejected; a ghosted object stays
  pickable. Extra sources that draw their own geometry compete on distance. Ray-triangle and
  ray-mesh intersection and an inverse-view-projection ray builder are pure and tested.
- **Clipping.** Planes and boxes with three.js's sign convention, exact bounds rejection, one seam.
- **Representations and replacement.** Replacement hides the object's rows and draws a substitute
  beside them; no group is removed and no geometry is rebuilt, so the shared prototype is untouched.
  `changedReplacements` names exactly what has to be shown or hidden again. Picking a substitute
  reports the object it stands for; a hidden substitute is not picked. `boxMesh` is the standard
  stand-in.
- **Overlays.** Points, lines, arrows, labels, paths and boxes share one shape, so one projection
  and one hit test serve all of them, with typed click actions. A hidden layer neither projects nor
  answers a click. An anchor whose object has gone stays unresolved.
- **Environment.** Background, light rig, scale-aware grid, ground plane and axes as settings plus
  line segments. None of it is in the instance table, so it cannot enter an inventory or a
  fit-to-selection bound.
- **Capture.** Render immediately before encode; restore the view size even on failure; a refused
  encode or an empty result is a diagnostic naming the reason.
- **Frame timing.** Intervals from caller-supplied timestamps, nearest-rank percentiles, a 33.3 ms
  budget check on the 95th percentile, GPU timing behind an interface whose unavailability carries
  its reason. Scene statistics distinguish source objects, groups, rendered instances, visible
  instances and rendered triangles.
- **Scene binding.** Model membership in a `ViewerScene`, change tables, resolved styles, publish,
  bounds, statistics and picking across models.

Requirements touched: F03 (bulk updates and replacement), F06 (picking), F10 (environment),
F11 (frame timing and HUD basics), F12 (clipping), F16 (replacement), F18 (overlay primitives),
F20 (capture).

## Escape hatches

**Zero.** No `any`, no `as` cast other than `as const`, no non-null assertion, no compiler or lint
directive, in `src` or `test`. Verified by grep and by the ratchet counts being unchanged.

## Commands and actual results

Run from `viewer/` at the end of the track, all writers in this fence stopped.

| Command | Result | Wall time |
|---|---|---|
| `npx tsc --noEmit -p packages/render/tsconfig.json` | exit 0, no output | 13 s |
| `npx eslint packages/render` | exit 0, no output | 12 s |
| `npm test -w @bim-open-toolkit/render` | 11 files, **214 passed**, 0 failed | 4 s |
| `npm run perf -w @bim-open-toolkit/render` | 2 files, **14 passed**, 0 failed | 15 s |

## Chunk commits

| Commit | Chunk |
|---|---|
| `146ce91` | Instance table and bulk column updates, 50 tests |
| `e9e5f9f` | Performance suite at 10k, 100k and 456,598 rows; the two design corrections it forced |
| `2825fd8` | Picking and clipping, 96 tests |
| `1c76ab2` | Representation registry, replacement and overlay primitives, 137 tests |
| `7277d06` | Environment, capture and frame timing, 186 tests |
| `1cd09be` | Scene binding onto viewer-core, 212 tests |
| `db9a63c` | Follow the model package's M1.1 additions: honour the source `visible` column, adopt its change-table names, 214 tests |
| `3483a63` | `docs/render.md`, `README.md`, this checkpoint |

Every commit staged by explicit pathspec inside the fence. One `index.lock` collision with another
session, retried after six seconds. Nothing pushed. Modified and untracked files elsewhere in the
checkout (`viewer/packages/loaders`, `viewer/packages/visualization`, and other wave 1 tracks) were
left alone and never staged.

## Findings, measured

Machine for every number: Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11 (10.0.26200),
Node v22.13.1, vitest 4.1.11. Scenes are synthetic, of the reference model's shape: 456,598 rendered
instances over 158,055 groups and 51,139 objects. CPU only; no WebGL context is created anywhere, so
no number includes GPU upload or draw.

### 1. `InstancedGroup.colors` and `.transforms` allocate on every access

Both are getters returning `this._colors.subarray(0, count * stride)`. A per-row loop that reads
them therefore allocates a typed-array view per instance. With 456,598 rows this put garbage
collection inside the timed body often enough that medians were meaningless: the first perf run had
maxima of 268 ms against medians of 3 ms, and a whole-model transform write measured 1,102 ms.

`InstanceTable` now captures both views once at build time and the writers use those. The
consequence, documented in the README, is that nothing may append instances to a group after its
table is built.

This is a finding about viewer-core, not only about this package: any consumer writing to those
buffers in a loop has the same problem, and the getters give no hint of it.

### 2. Resolving the row selection inside the loop cost a factor of nine

`RowSelection` is `Int32Array | 'every-row'`. Comparing against the string inside the per-row loop
made the loop variable sometimes a string and sometimes a typed array. A whole-table visibility
write over 456,598 rows measured 40 ms, against about 2 ms for the equivalent in the instance-update
study. Resolving the selection to an array or null before the loop, and hoisting the table's columns
into locals, brought it to 19.1 ms for a whole-table write and 3.07 ms for 10,000 scattered rows.

The perf suite holds both shapes in place. This is noted in the source because it looks like
premature optimisation and is not.

Together, findings 1 and 2 took the suite from 106 s with two failures to 15 s with none.

### 3. The study's relationships hold, with the same magnitudes

Changing 10,000 of 456,598 rows:

| Operation | scattered | sorted | contiguous |
|---|---:|---:|---:|
| Colour | 3.39 ms | 2.11 ms | 0.45 ms |
| Visibility | 3.07 ms | 1.67 ms | 0.54 ms |
| Translation | 3.80 ms | 2.69 ms | 0.27 ms |
| Whole 4x4 transform | 9.74 ms | 6.47 ms | - |

Sorting is worth about a third and contiguity about seven eighths, which is why `InstanceTable`
orders rows by mesh rather than leaving the order to the caller. Asserted in the suite with a
tolerance of 1.25.

### 4. Recording dirty ranges costs 20 %, not the study's 3 %

4.08 ms against 3.39 ms for a scattered colour write. The study measured 3 % over 8,594 touched
groups with a plain function; this implementation marks through a class with a first and last array
and a touched-group count, over nearly 10,000 groups. It is still far cheaper than the alternative
it replaces, and it is left on by default. Asserted at 1.6.

### 5. Change detection does not save CPU on scattered rows, and that is not why it is there

Measured overhead ranges from nothing (visibility, where the compare is one byte) to about 1.5 to
1.9 times (a three-float translation, where the compare is nearly the whole cost). Writing 10,000
scattered rows whose values have not moved costs 2.96 ms against 3.39 ms for writing rows that have:
the cache line has to be fetched either way and the three stores are almost free once it is there.

**This departs from the brief's phrasing** that "change detection costs a small fraction of the
write". The study never isolated change detection; the 3 % figure it reports is the dirty-range
cost, which is asserted separately above. What detection actually buys is downstream: when nothing
has moved it leaves the dirty ranges empty, so no group is published and no buffer is uploaded. The
suite asserts the overhead stays under 2x, and asserts functionally that a repeated identical write
returns zero rows written and zero touched groups.

Because the measurement is unstable at 10,000 rows - a whole write there is 0.34 ms, and the ratio
swung between 1.25 and 1.96 across runs - the overhead assertion is made only at 100,000 rows and
above. The numbers are still printed at 10,000.

### 6. Grouping by mesh recovers most of what "one allocation per attribute" would buy

The study's fourth recommendation is not reachable: `InstancedGroup` allocates its buffers in its
constructor and offers no way to supply one. `test/perf/layout.perf.ts` measures the gap.

| Whole-model colour write, 456,598 rows | median |
|---|---:|
| 158,055 groups, one per element (the alpha's shape) | 14.6 ms |
| 2,048 groups, one per mesh (this package's shape) | 9.35 ms |
| One allocation, straight pass (not reachable through viewer-core) | 8.98 ms |

For 10,000 scattered rows: 1.48 ms per element against 0.58 ms per mesh, a factor of 2.6.

**Recommendation: do not change viewer-core for this.** Grouping by mesh gets within 4 % of the
floor, and it is a change this package makes on its own.

### 7. Publishing is the most expensive part of a bulk update

Writing 10,000 scattered rows takes 3.66 ms; publishing what it touched takes another 5.31 ms,
because those rows fall in nearly 10,000 distinct groups and each needs a `setColors` self-copy to
bump its counter. See the request below.

### 8. `resolveStyles` omits keys equal to the fallback

Found while writing `applyStyles`. `ResolvedStyles.byKey` holds only keys whose appearance differs
from the fallback, and deleted keys are omitted entirely. A binding that iterated `byKey` would
never restore an object a rule had stopped applying to. `applyStyles` therefore addresses every row
of the model and relies on change detection to make that cheap; a second identical resolution writes
zero rows, which is asserted.

The consequence for reporting: `applyStyles` cannot count a styled key the model does not hold if
that key resolved to the fallback, because it is not named. The report says so and the limit is
documented.

### 9. The model contract moved past M1 during the track, additively, and this package followed

At `641624b` the brief's revision, `InstanceRecords` had five columns and the model package had no
instance-table module. By the end of the track the model had landed `ea3ddf2`, `bc75733` and
`b57c237`, adding optional `visible`, `roughness` and `metallic` instance columns, a `MeshTable`,
and an `instance-table` module exporting `instanceTable(records)` with column names `objectIndex`,
`m0` to `m15` and `red`/`green`/`blue`/`alpha`. `CONTRACTS-M1.md` records these under "M1.1
additions" and keeps the revision label M1, correctly: nothing was renamed, removed or re-signed.

Two consequences, both handled here:

- **`buildInstanceTable` now honours `records.visible`.** A source that declares a row hidden gets
  `visible = 0` and a stored alpha of zero while keeping the opacity it had, which is the same
  composition every later visibility write maintains. Before this it silently drew such rows.
- **The change-table vocabulary was mine and is now the model's.** `updates.ts` had invented
  `object`, `opacity` and `transform0` to `transform15`; it now uses `objectIndex`, `alpha` and the
  model's `transformColumnNames` and `colorColumnNames`. A table from `instanceTable(records)` is
  therefore a change table with no translation, which is asserted by a test. `transformColumnNames`
  is no longer exported from this package, which also removes a name that would have collided with
  the model's for a consumer re-exporting both.

Had this landed a day later it would have been two vocabularies in wave 2. **The general point for
the supervisor: an additive contract change that adds a name a downstream track has already invented
is not neutral, even though it breaks nothing.** A note to wave 1 tracks when `instance-table.ts`
landed would have cost one message.

## Requests

**To the supervisor, for `@ara3d/viewer-core` (wave 4 or whenever the alpha reopens):**

1. `InstancedGroup.markColorsChanged(start, count)` and `markTransformsChanged(start, count)`:
   bump the version counters over a slot range without taking values. A bulk writer already wrote
   the values; publishing currently has to hand the group back the slice it already holds. Measured
   cost of the workaround: 5.31 ms per 10,000-row update on the reference shape (finding 7).
2. A note on `get colors()` and `get transforms()` saying they allocate a view per call, or a pair
   of non-allocating accessors. Finding 1 cost a full measurement cycle to diagnose.

**To Track M / the model contract:** nothing needed. Group and instance index columns stayed the
render package's concern exactly as M1 anticipated; `Geometry`, `Table`, `ResolvedStyles`, `Result`
and `Bounds` were sufficient without additions. The one behaviour worth writing down in the model
docs is finding 8: that `resolveStyles` omits fallback-equal keys is correct and deliberate, but a
consumer that does not know it will write a subtly wrong binding.

**To the supervisor, package files (supervisor-owned, no change needed now):** `package.json`,
`tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` and `vitest.perf.config.ts` were all
correct as delivered. `@bim-open-toolkit/synthetic` was deliberately **not** added as a dependency:
its `generateStressScene` would have fitted, but it is Track S2's active fence and would have made
this package's perf suite depend on an unstable input, so the perf scenes are built in the test.

## Blockers

None. Nothing outside the fence was needed and no stop-and-reassess condition was reached:
viewer-core's structures do take bulk writes without per-instance calls (they are live views), and
every part was testable without WebGL behind one of the six interfaces.

## Tooling

For the user's decision on which checks to keep.

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---:|---:|---|---|---|
| `tsc --noEmit` | ~20 | 13 s each | 6, all real: two `noUncheckedIndexedAccess` misses in tests that would have thrown, one `exactOptionalPropertyTypes` violation on `MeshBuffers.normals` that would have produced a wrong optional property, one union-narrowing error on `GpuAvailability` where the test read a field that does not exist on the other arm, and one inference circularity | One false-ish positive: `TS7022 'row' implicitly has type any` on `const row = rows[k] ?? 0` after a narrowing return, fixed by an explicit `: number`. The message names the wrong cause | **helpful** |
| `eslint` (untyped set) | ~12 | 12 s each | 0 | None. Never fired once across 5,759 lines | **neutral.** It costs 12 s and found nothing tsc had not. Keep it only for the rules tsc cannot express; if `no-explicit-any` is the only one that matters, the ratchet already covers it |
| Escape-hatch rules (no `any`, no `as`, no `!`) | continuous | 0 | Not a defect count, but they changed the code: with no `!` available, every typed-array read is `number \| undefined` and has to be given a meaning. That forced explicit `-1` sentinels for "no such group" and explicit empty returns for out-of-range rows, which is where four of the tests came from | Real cost: `?? 0` appears about 120 times in hot loops, and each one is a branch the engine has to prove away. The perf suite says the cost is not measurable against the memory traffic, but that is a fact about this workload and would not hold for a tighter loop | **helpful**, with the caveat that the perf suite is what makes it safe to say so |
| `vitest` unit run | ~30 | 4 s | The tests are the work, not a check on it. Two behaviours were wrong when first written and the tests caught them: `applyStyles` iterating `byKey` (finding 8) and the `everyRow` value index in `writeColors` | 4 s for 212 tests is fast enough to run on every edit | **helpful** |
| `vitest` perf run | ~10 | 15 s (was 106 s) | 2, both severe and both invisible to every other check: findings 1 and 2. Neither is a correctness bug, so no unit test would ever have failed | High friction until fixed: the first three runs were dominated by noise from the harness's own allocations, and two ratio assertions failed at random. Diagnosing that took as long as writing the suite | **helpful**, and the highest-value check in the track. But it only became useful once the harness itself allocated nothing in setup; a perf suite that is noisy is worse than none, because it teaches you to ignore failures |

Two process notes:

- Writing the perf suite **before** the rest of the package, immediately after the first chunk, was
  the single best decision in the track. Both design corrections landed before eight modules were
  built on top of the slow shapes.
- Running `cd viewer && ...` inside a compound shell command left the working directory changed for
  a following `git add`, which then failed on a relative pathspec. Subshells for directory changes;
  git always from the repository root.
