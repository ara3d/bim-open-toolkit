# The cost of changing instances in bulk

How much does it cost to change the colour, visibility or position of a large
number of instances in a big BIM model, and where does that cost actually go?
This document records measurements, not opinions. Every number here came from a
test in `viewer/packages/testing/test/perf` that can be re-run.

## Method

**The model shape.** The reference model has 456,598 rendered instances spread
over 158,055 instanced groups: 2.9 instances per group on average, with a long
tail of a few large groups. That ratio is the single most important fact in this
document. Any cost paid once per group is paid roughly once per three instances,
so "batch it per group" is barely a batch at all.

The measurements use synthetic scenes with that exact shape, generated from a
seed by `src/perf/scene.ts`. They build real `InstancedGroup` objects from the
alpha renderer with synthetic geometry. No model data is read.

**What is measured.** CPU-side data-structure work only. No WebGL context is
created, so no number here includes buffer upload to the GPU or draw time. The
question being answered is what the JavaScript side costs, which is what the V2
`InstanceTable` design controls.

**How.** Each case runs 2 untimed warm-up repetitions and then 7 timed ones, with
untimed setup before each repetition to restore whatever state the previous one
mutated. The median is reported; the minimum and maximum are printed alongside so
a noisy run is visible. Each timed body returns a number derived from its work so
it cannot be optimised away.

**Machine.** Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11
(10.0.26200), Node v22.13.1, vitest 4.1.11.

**Reproducing.** From `viewer/`:

```
npm run perf -w @bim-open-toolkit/testing -- --reporter=verbose
```

The `--reporter=verbose` is required: vitest's default reporter hides console
output from passing tests, which means it hides the tables these tests exist to
print.

**Reading the numbers.** Treat ratios as the result and absolute times as
context. The tests assert relationships ("the bulk path is not slower than the
per-instance path"), never absolute times, so they hold on a slower machine.

## Colour

`test/perf/color-updates.perf.ts`. All 456,598 instances in 158,055 groups.

### Changing 10,000 instances

| Path | median ms | versus per-instance |
|---|---:|---:|
| `group.setColor(...)` once per instance, scattered rows | 2.265 | 1.00 |
| Indexed column write, per-group buffers, scattered rows | 1.739 | 0.77 |
| Indexed column write, per-group buffers, rows sorted | 0.756 | 0.33 |
| Indexed column write, per-group buffers, rows contiguous | 0.216 | 0.10 |
| Indexed column write, one shared buffer, scattered rows | 1.130 | 0.50 |
| Indexed column write, one shared buffer, rows sorted | 0.614 | 0.27 |
| Indexed column write, one shared buffer, one value per row | 0.774 | 0.34 |

**Interpretation.** Removing the per-instance method call is worth about 23 %.
Sorting the same rows into buffer order is worth 67 %, and having them contiguous
is worth 90 %. The method call is not the problem; the memory access pattern is.
Holding every group's colours in one allocation rather than 158,055 small ones
halves the scattered case, because the scattered walk then touches one array
instead of thousands of separately allocated ones.

Writing a distinct colour per row instead of broadcasting one colour costs 26 %
more than the broadcast on the same sorted rows. A per-row value table is
therefore affordable and does not need a separate fast path.

### Changing every instance

| Path | median ms |
|---|---:|
| `group.setColor(...)` once per instance | 7.997 |
| Indexed column write, per-group buffers | 6.727 |
| Indexed column write, one shared buffer | 7.796 |
| One straight pass over the shared colour store, no row indirection | 3.396 |
| `group.setColors(...)` once per group | 14.3 |

**Interpretation.** When the update covers everything, the row indirection is
what costs. A straight pass over the colour store is 2.4 times faster than the
same work driven through a row list, and 2.0 times faster than the alpha's
per-instance calls. An `InstanceTable` should recognise a full-table update and
skip the index entirely.

The per-group call is the worst option at 14.3 ms, twice the per-instance path.
This is the model shape asserting itself: with 2.9 instances per group, 158,055
calls that each set up a subarray and a range are more overhead than 456,598
plain writes.

### The cost of saying that something changed

10,000 scattered instances fall in 8,594 distinct groups.

| Path | median ms | versus the write |
|---|---:|---:|
| Column write only | 0.903 | 1.00 |
| Column write and record a dirty slot range per group | 0.931 | 1.03 |
| Column write, then one `setColor` per touched group to bump its version | 2.932 | 3.25 |

**Interpretation.** This is the most important result for colour. Publishing a
change through the alpha's mechanism — bumping a version per touched group —
costs 3.25 times the write it publishes, because 10,000 changed instances touch
8,594 groups. Recording the touched slot range per group instead costs 3 % on top
of the write and gives the renderer strictly more information: which groups, and
which slot range inside each.

A third measurement confirms the mechanism: with the groups attached to a
`ViewerScene`, 10,000 `setColor` calls advance the scene revision 10,000 times,
once per instance. The columnar write advances it zero times. A subscriber that
reacts per revision therefore does 10,000 units of work for one logical bulk
change.

## Visibility

`test/perf/visibility.perf.ts`. Same scene.

### Hiding by writing a column

| Fraction | Rows | Alpha 0 (ms) | Restore (ms) | Collapse transform (ms) |
|---|---:|---:|---:|---:|
| 1 % | 4,566 | 0.249 | 0.125 | 0.049 |
| 10 % | 45,660 | 1.903 | 1.583 | 0.472 |
| 50 % | 228,299 | 2.225 | 2.220 | 3.053 |

**Interpretation.** Hiding scales with the number of hidden rows, not the size of
the model, and restoring costs the same as hiding because it is the same write.
Even hiding half the model is about 2 ms of CPU work. Writing one channel (the
alpha of the colour) and writing three diagonal entries of the transform are in
the same range; the transform variant is cheaper for small selections because the
rows are contiguous in one store, and more expensive at 50 % because it writes
three floats per row instead of one.

Both are far below the alternatives, so the choice between them should be made on
rendering grounds, not CPU cost. A zero-scale transform removes the triangles at
the vertex stage without needing a blend mode; an alpha of zero still rasterises.

### Hiding by moving or rebuilding data

| Path | median ms |
|---|---:|
| Rebuild the drawn-row list with 1 % hidden | 0.716 |
| Rebuild the drawn-row list with 10 % hidden | 1.005 |
| Rebuild the drawn-row list with 50 % hidden | 2.445 |
| Physically compact colours and transforms with 10 % hidden | 57.2 |
| Rebuild the three.js batches for the whole model | 272.6 |

**Interpretation.** There are three tiers, two orders of magnitude apart.
Flagging a row is about 2 ms. Rebuilding a compact list of drawn rows is also
about 2 ms, and is a full pass over the model regardless of how little changed —
acceptable, but it should not be done per hide operation. Physically moving the
instance data so the drawn rows are contiguous costs 57 ms, 25 times more.
Rebuilding the renderer's batches costs 273 ms and is 150 times the cost of
hiding half the model by writing a column.

The conclusion is that visibility must never rebuild batches. Hiding is a column
write; if a compact draw range is wanted for GPU efficiency, it is a separate,
deferred, whole-model pass, not part of the hide operation.

## Recommendations for the V2 `InstanceTable`

Ranked, each with the measurement behind it.

1. **Do not bump a per-group version to publish a bulk change.** Publishing cost
   3.25 times the write itself, and advanced the scene revision once per changed
   instance. Publish once per bulk update with a description of what changed.

2. **Record dirty slot ranges per group during the write.** It costs 3 % on top
   of the write, and it is what an uploader needs to avoid re-sending whole
   buffers. Leave it on by default.

3. **Detect a full-table update and drop the row index.** A straight pass over
   the colour store was 2.4 times faster than the same values written through a
   row list. Bulk operations that touch everything are common (reset colours,
   apply a whole-model theme) and should not pay for indirection.

4. **Hold each attribute in one allocation for the whole model, with each group's
   buffer a view into it.** This halved a scattered 10,000-row colour write
   against per-group allocations, and it is what makes the full-table fast path
   above possible at all.

5. **Sort the rows of a bulk update before writing them.** Sorting scattered rows
   into buffer order cut the write by 67 %, and contiguous rows by 90 %. If the
   caller supplies rows in arbitrary order, sorting them is likely to pay for
   itself; that is not yet measured including the sort.

6. **Do not offer a per-group bulk API.** One call per group over the whole model
   was the slowest path measured at 14.3 ms, worse than per-instance calls, because
   the model averages 2.9 instances per group.

7. **Make visibility a column write, never a rebuild.** Hiding half the model is
   about 2 ms as a column write against 273 ms to rebuild batches.

8. **Accept a value per row.** A per-row value table cost 26 % more than
   broadcasting a single value, so one API taking a table of changed columns is
   enough; a separate "set them all to this" path is not needed for speed, only
   for convenience.

## What is not measured here

- GPU upload and draw cost. No WebGL context is created anywhere in this study.
- The cost of sorting an unsorted row list, which recommendation 5 assumes is
  small relative to the 67 % it saves.
- Anything about the real model's data. All scenes are synthetic.
