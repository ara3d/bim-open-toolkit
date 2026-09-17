# The cost of changing instances in bulk

How much does it cost to change the colour, visibility or position of a large
number of instances in a big BIM model, and where does that cost actually go?
This document records measurements, not opinions. Every number came from a test
in `viewer/packages/testing/test/perf` that can be re-run.

## Summary

The per-instance method call is not the problem. Six things cost more:

1. **Telling the renderer what changed.** Bumping a version once per touched
   group costs more than three times the write it publishes, because the model
   averages 2.9 instances per group.
2. **The renderer finding out.** Any change at all makes the alpha's mirror walk
   every group in the model, so recolouring one instance costs 69 % of what
   recolouring five hundred costs.
3. **Memory order.** Writing 10,000 rows in buffer order is three to five times
   faster than writing the same rows in random order.
4. **Row indirection on a full-table update.** A straight pass over one array is
   twice as fast as the same values written through a row list.
5. **Keeping the bounds correct.** Even the cheapest correct bounds update costs
   several times the transform write that made it necessary.
6. **Per-instance JavaScript objects.** At 500,000 instances they take about 11
   times longer to build than typed-array columns and hold about 30 times the
   memory.

Change detection is not on that list. Comparing a row costs about what writing
it costs, so detecting change saves no CPU time; it only earns its place through
what it lets the renderer skip afterwards.

## Method

**The model shape.** The reference model has 456,598 rendered instances spread
over 158,055 instanced groups, and those instances belong to 51,139 model
objects. That is 2.9 instances per group and 8.9 instances per object, with a
long tail of a few large groups. The instances-per-group ratio is the single most
important fact in this document: anything paid once per group is paid roughly
once per three instances, so "batch it per group" is barely a batch at all.

The measurements use synthetic scenes with that exact shape, generated from a
seed by `src/perf/scene.ts`. They build real `InstancedGroup` objects from the
alpha renderer with synthetic geometry. No model data is read.

**What is measured.** CPU-side data-structure work only. No WebGL context is
created, so no number here includes buffer upload to the GPU or draw time. The
question being answered is what the JavaScript side costs, which is what the V2
`InstanceTable` design controls.

**How.** Cases that are compared with each other are measured together. Every
case in a group is run untimed before any is timed, so the first case does not
carry the cost of compiling code the later ones reuse. Repetitions are then
interleaved — one round runs every case once — so a machine that gets busy
partway through slows every case equally. Setup is untimed and restores whatever
the previous repetition changed. Each timed body returns a number derived from
its work so it cannot be optimised away. The default is 5 untimed rounds and 25
timed ones; groups containing a case that takes tens or hundreds of milliseconds
use fewer, which each test states.

**Medians and minimums.** The tables report medians. The tests assert on the
fastest repetition instead. This checkout is shared with other agents doing heavy
work, and interference can only ever make a run slower, so the minimum is the
estimate that survives a busy machine. Two earlier protocols were tried and
discarded, and the reasons are recorded in the source: measuring each case to
completion in turn (cold-start bias), and asserting on medians (two close cases
swapped places under load).

**Machine.** Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11
(10.0.26200), Node v22.13.1, vitest 4.1.11. Other agents were working in the same
checkout throughout, so absolute times are pessimistic and vary between runs by
up to about 40 %. Ratios between cases measured in the same group are stable.

**Reproducing.** From `viewer/`:

```
npm run perf -w @bim-open-toolkit/testing -- --reporter=verbose
```

The `--reporter=verbose` is required: vitest's default reporter hides console
output from passing tests, which means it hides the tables these tests exist to
print.

## Colour

`test/perf/color-updates.perf.ts`. All 456,598 instances in 158,055 groups.

### Changing 10,000 instances

| Path | median ms | versus per-instance |
|---|---:|---:|
| `group.setColor(...)` once per instance, scattered rows | 3.841 | 1.00 |
| Column write, per-group buffers, scattered rows | 2.654 | 0.69 |
| Column write, per-group buffers, rows sorted | 1.339 | 0.35 |
| Column write, per-group buffers, rows contiguous | 0.261 | 0.07 |
| Column write, one shared buffer, scattered rows | 2.477 | 0.64 |
| Column write, one shared buffer, rows sorted | 1.190 | 0.31 |
| Column write, one shared buffer, one value per row | 1.344 | 0.35 |

**Interpretation.** Removing the per-instance method call is worth about 30 %.
Sorting the same rows into buffer order is worth 65 %, and having them contiguous
is worth 93 %. The method call is not the problem; the memory access pattern is.

Holding every group's colours in one allocation rather than 158,055 small ones is
usually a little faster on scattered rows, but the difference sits inside the
run-to-run spread and no test asserts it. Its real value is that it makes the
whole-model fast path below possible at all.

Writing a distinct colour per row instead of broadcasting one colour costs about
13 % more on the same rows. A per-row value table is affordable and needs no
separate fast path.

### Changing every instance

| Path | median ms |
|---|---:|
| `group.setColor(...)` once per instance | 10.7 |
| Column write, per-group buffers | 9.064 |
| Column write, one shared buffer | 8.052 |
| One straight pass over the shared colour store, no row indirection | 4.274 |
| `group.setColors(...)` once per group | 17.1 |

**Interpretation.** When the update covers everything, the row indirection is
what costs. A straight pass over the colour store is about twice as fast as the
same work driven through a row list, and 2.5 times faster than the alpha's
per-instance calls. An `InstanceTable` should recognise a full-table update and
skip the index entirely.

The per-group call is the worst option at 17.1 ms, worse than the per-instance
path. This is the model shape asserting itself: with 2.9 instances per group,
158,055 calls that each set up a subarray and a range are more overhead than
456,598 plain writes.

### The cost of saying that something changed

10,000 scattered instances fall in 8,594 distinct groups.

| Path | median ms | versus the write |
|---|---:|---:|
| Column write only | 1.460 | 1.00 |
| Column write and record a dirty slot range per group | 1.749 | 1.20 |
| Column write, then one `setColor` per touched group to bump its version | 5.213 | 3.57 |

**Interpretation.** This is the most important result for colour. Publishing a
change through the alpha's mechanism — bumping a version per touched group —
costs about 3.5 times the write it publishes, because 10,000 changed instances
touch 8,594 groups. Recording the touched slot range per group instead costs
about 20 % on top of the write and gives the renderer strictly more information:
which groups, and which slot range inside each.

A third measurement confirms the mechanism. With the groups attached to a
`ViewerScene`, 10,000 `setColor` calls advance the scene revision 10,000 times,
once per instance. The columnar write advances it zero times. A subscriber that
reacts per revision does 10,000 units of work for one logical bulk change.

## Visibility

`test/perf/visibility.perf.ts`. Same scene.

### Hiding by writing a column

| Fraction | Rows | Alpha 0 (ms) | Restore (ms) | Collapse transform (ms) |
|---|---:|---:|---:|---:|
| 1 % | 4,566 | 0.430 | 0.365 | 0.038 |
| 10 % | 45,660 | 1.411 | 1.402 | 0.538 |
| 50 % | 228,299 | 2.037 | 2.026 | 2.939 |

**Interpretation.** Hiding scales with the number of hidden rows, not the size of
the model, and restoring costs the same as hiding because it is the same write.
Even hiding half the model is about 2 ms of CPU work. Writing one channel (the
alpha of the colour) and writing three diagonal entries of the transform are in
the same range; the transform variant is cheaper for small selections because the
rows are contiguous in one store, and more expensive at 50 % because it writes
three floats per row instead of one.

Both are far below the alternatives, so the choice between them should be made on
rendering grounds, not CPU cost. A zero-scale transform removes the triangles at
the vertex stage; an alpha of zero still rasterises, and in the alpha renderer it
also decides whether a batch is treated as transparent.

### Hiding by moving or rebuilding data

| Path | median ms |
|---|---:|
| Hide 50 % by writing a column, for scale | 2.577 |
| Rebuild the drawn-row list with 1 % hidden | 0.611 |
| Rebuild the drawn-row list with 10 % hidden | 1.183 |
| Rebuild the drawn-row list with 50 % hidden | 2.426 |
| Physically compact colours and transforms with 10 % hidden | 63.0 |
| Rebuild the three.js batches for the whole model | 290.5 |

**Interpretation.** There are three tiers, an order of magnitude apart each time.
Flagging rows and rebuilding a compact list of drawn rows are both a few
milliseconds, though the list rebuild is a full pass over the model however
little changed. Physically moving the instance data so the drawn rows are
contiguous costs 63 ms, 25 times more. Rebuilding the renderer's batches costs
290 ms, more than a hundred times the cost of hiding half the model.

Visibility must never rebuild batches. Hiding is a column write; if a compact
draw range is wanted for GPU efficiency, it is a separate, deferred, whole-model
pass, not part of the hide operation.

## Transforms

`test/perf/transform-updates.perf.ts`. Same scene. A transform is 16 floats
against a colour's 4, which changes what dominates.

### Writing transforms

| Path | median ms |
|---|---:|
| `group.setTransform(...)` once per instance, 10k scattered rows | 5.487 |
| Column write, per-group buffers, 10k scattered rows | 5.088 |
| Column write, one shared buffer, 10k scattered rows | 5.374 |
| Column write, one shared buffer, 10k sorted rows | 2.107 |
| Column copy with `set()`, one shared buffer, 10k sorted rows | 1.439 |
| Column write, one shared buffer, 10k rows, matrix per row | 2.235 |
| Column copy with `set()`, one shared buffer, 10k rows, matrix per row | 2.188 |
| Translation only (3 floats), one shared buffer, 10k sorted rows | 1.413 |
| `group.setTransform(...)` once per instance, all rows | 13.2 |
| Column write, one shared buffer, all rows | 13.1 |
| Column copy with `set()`, one shared buffer, all rows | 9.274 |
| Translation only, one shared buffer, all rows | 8.697 |
| One straight pass over the shared transform store, no row indirection | 9.282 |

**Interpretation.** Two results matter here.

The first is that **how a row is copied matters for a wide attribute**. Assigning
16 floats one at a time is no faster than the alpha's per-instance
`setTransform`, which uses `TypedArray.set` — a whole-model column write at 13.1
ms against the alpha's 13.2 ms. Copying each row with `set()` instead brings it to
9.3 ms. A bulk write over a wide column must copy, not loop. (The gain does not
carry over to a per-row value table, where each row needs a subarray view and
that allocation cancels the saving: 2.188 ms against 2.235 ms, no reliable
difference.)

The second is that **a partial attribute is worth having**. Writing only the
translation — 3 floats of 16 — costs 8.7 ms over the whole model against 13.1 ms
for the full matrix. Moving objects is the common transform edit. At 10,000 rows
the difference disappears into the cost of finding each row's buffer among
158,055 of them, so this is a whole-model result, not a general one.

At 10,000 scattered rows the transform column behaves like the colour column:
sorting the rows into buffer order more than halves the write.

### Keeping the bounds correct

| Path | median ms |
|---|---:|
| Alpha `sceneBounds`, whole model | 100.2 |
| Columnar recompute of every group, local mesh boxes computed too | 52.2 |
| Columnar recompute of every group, local mesh boxes cached | 36.9 |
| Columnar recompute of the 8,687 changed groups, then union all | 11.5 |
| Union of the 158,055 cached group boxes only | 1.552 |
| The 10,000-row transform write this bounds work follows | 2.429 |

**Interpretation.** The alpha's `sceneBounds` allocates a result object, two
tuple arrays and a subarray per instance, and recomputes each group's local mesh
box on every call. Doing the identical arithmetic with every box held as six
numbers in one array halves it; caching each mesh's local box takes off another
third.

Recomputing only the groups that actually changed is the large win: 11.5 ms
against 36.9 ms, and it cannot go below the 1.6 ms it takes to union 158,055
cached boxes. That floor is the argument for a bounds tree rather than a flat
union, if bounds ever need to be correct at interactive rates.

Note the last row. Even the cheapest correct bounds update costs about five times
the write that made it necessary. Bounds are the expensive part of moving
instances, not the move.

## Change detection

`test/perf/change-detection.perf.ts`. Colour column, same scene.

| Path | median ms |
|---|---:|
| 10,000 rows, write unconditionally | 1.303 |
| 10,000 rows, compare first, every row changes | 1.715 |
| 10,000 rows, compare first, no row changes | 1.287 |
| 10,000 rows, compare first, one row in ten changes | 1.160 |
| All rows, write unconditionally | 7.219 |
| All rows, compare first, every row changes | 8.238 |
| All rows, compare first, no row changes | 7.854 |

**Interpretation.** Change detection is neither expensive nor a saving. Reading
four floats and comparing them costs about what writing them costs, so comparing
first lands within about 15 % of the unconditional write whatever fraction of
rows actually changes — including the case where nothing changed and every write
was skipped.

This settles the question the wrong way round from how it is usually asked.
Change detection is not a CPU optimisation. It is worth doing only for what it
enables downstream: a smaller dirty range, a skipped GPU upload, a notification
that is not sent. Those are not measured here, and they are the whole case for it.

### Deriving the changed rows instead of being told them

| Path | median ms |
|---|---:|
| Diff two whole colour columns to derive the changed rows | 3.568 |
| Write the 10,000 known rows unconditionally | 1.867 |
| Write all rows unconditionally | 8.188 |

**Interpretation.** Comparing a proposed column against the current one to work
out which rows changed costs a full model pass and writes nothing — about twice
what simply writing the 10,000 known rows costs, and about half the cost of
writing the entire model. An API that is told which rows to change is
structurally cheaper than one that is handed a new column and left to work it
out.

## Binding objects against columns

`test/perf/binding-objects.perf.ts`. The alpha keeps one frozen JavaScript object
per rendered instance plus three maps over them (`RenderBinding` in
`viewer/packages/visualization/src/render.ts`). The columnar form keeps object
ordinals, a compressed row index, and one map from object identity to an integer.
Both are built from the same assignment of instances to objects, at the
reference model's ratio of 8.9 instances per object.

### Build time

| Instances | Frozen binding objects (ms) | Object columns (ms) | Ratio |
|---|---:|---:|---:|
| 10,000 | 3.153 | 0.280 | 11x |
| 100,000 | 61.1 | 3.073 | 20x |
| 500,000 | 340.4 | 29.9 | 11x |

### Memory held

Median of three readings, each with a collection forced before and after.

| Instances | Frozen binding objects (MB) | Object columns (MB) | Ratio |
|---|---:|---:|---:|
| 10,000 | 2.5 | 0.1 | 25.6x |
| 100,000 | 25.8 | 0.9 | 27.4x |
| 500,000 | 127.1 | 4.3 | 29.5x |

### Updating through each layout

5,600 objects, one in ten, covering 50,400 instances.

| Path | median ms |
|---|---:|
| Through the binding objects: key lookup, then `setColor` per binding | 9.600 |
| Through the object columns: key lookup, then a column write over the row range | 5.358 |

**Interpretation.** At the reference scale the per-instance layout costs about a
third of a second to build and holds about 127 MB, against 30 ms and 4 MB for the
columns. The memory ratio grows with the model, from 26 times at 10,000 instances
to 30 times at 500,000, because the per-instance layout also keeps one map per
group.

The update path is also slower, but only by a factor of about 1.8, and that gap
is mostly the per-instance `setColor` measured in the colour section rather than
the lookup. Both layouts find an object by the same string key. The case against
the binding objects is build time and memory, not lookup.

## What the renderer does with the change

`test/perf/batch-sync.perf.ts`. A smaller scene — 50,000 instances in 17,308
groups — because the alpha's packed small-mesh path only engages below a vertex
budget. The mirror is built and synced once before anything is measured, so a
measured `sync()` is an update rather than a build.

| Change | median ms, packed off |
|---|---:|
| Nothing changed | 0.003 |
| One instance recoloured | 0.813 |
| 500 instances recoloured (1 %) | 1.172 |
| 5,000 instances recoloured (10 %) | 2.559 |
| 50,000 instances recoloured (100 %) | 3.682 |

**Interpretation.** Two mechanisms are visible.

A sync with no change at all returns in microseconds, because `SceneObject.sync`
compares one scene revision first. But **any** change costs a walk over every
group in the model: `BatchObject.sync` compares a version per range, and there
are 17,308 of them. That walk is why recolouring one instance costs 0.81 ms and
recolouring five hundred costs 1.17 ms — 69 % as much for one five-hundredth of
the change. Scaled to the reference model's 158,055 groups, the floor for any
change at all would be about 7 ms.

The second mechanism is range amplification. A version is per group, so a group
with one changed instance has all its instances rewritten. The 500 changed
instances land in groups holding 6,278 instances between them: 12.6 times more
work than the change.

### The packed small-mesh path

Small meshes are baked into one vertex buffer, so a colour change rewrites
vertices rather than instances.

| Change | Instances the mirror rewrites | Packed on, median ms | Packed off, median ms |
|---|---:|---:|---:|
| One instance | 4 | 1.11 | 1.12 |
| 1 % of instances | 6,278 | 2.85 | 1.76 |
| 10 % of instances | 21,033 | 7.13 | 3.26 |
| 100 % of instances | 50,000 | 14.25 | 4.06 |

**Interpretation.** For a single instance the two paths are the same: four
instances' worth of vertices is nothing next to the walk over every group. Once
enough instances are touched for the vertices to dominate, baking costs three to
four times as much — 14.2 ms against 4.1 ms to recolour everything, with these
meshes at 8 to 32 vertices each. The multiplier is the vertex count per instance,
so it grows with mesh size up to the path's 100-vertex limit.

The packed path exists to make small meshes draw as one opaque mesh. This
measurement says what that costs on the update side, and that a design which
recolours large selections often should not bake vertices.

## Recommendations for the V2 `InstanceTable`

Ranked, each with the measurement behind it.

1. **Do not bump a per-group version to publish a bulk change.** Publishing cost
   3.5 times the write itself, and advanced the scene revision once per changed
   instance. Publish once per bulk update with a description of what changed.

2. **Hold no per-instance JavaScript objects.** At 500,000 instances the
   object-per-instance layout took 340 ms to build and held 127 MB, against 30 ms
   and 4 MB for columns, and the memory ratio grows with the model.

3. **Record dirty slot ranges per group during the write.** It costs about 20 %
   on top of the write, and it is what an uploader needs to avoid re-sending
   whole buffers. Leave it on by default.

4. **Detect a full-table update and drop the row index.** A straight pass over the
   colour store was twice as fast as the same values written through a row list.
   Whole-model operations are common — reset colours, apply a theme — and should
   not pay for indirection.

5. **Copy each row with `TypedArray.set`, never an element loop, for wide
   columns.** A 16-float element loop made the columnar write no faster than the
   alpha's per-instance calls (13.1 ms against 13.2 ms); copying brought it to
   9.3 ms. For a 4-float colour the difference does not arise.

6. **Sort the rows of a bulk update before writing them.** Sorting scattered rows
   into buffer order cut a colour write by 65 % and a transform write by 60 %.
   The cost of the sort itself is not measured, so this needs confirming before
   it becomes automatic.

7. **Hold each attribute in one allocation for the whole model, with each group's
   buffer a view into it.** This is what makes recommendations 4 and 6 possible.
   On its own, at 10,000 scattered rows, it was worth less than the run-to-run
   spread.

8. **Offer a translation-only update alongside the full matrix.** Writing 3 floats
   instead of 16 cut a whole-model transform update from 13.1 ms to 8.7 ms.
   Moving objects is the common transform edit.

9. **Do not offer a per-group bulk API.** One call per group over the whole model
   was the slowest colour path measured at 17.1 ms, worse than per-instance calls,
   because the model averages 2.9 instances per group.

10. **Make visibility a column write, never a rebuild.** Hiding half the model is
    about 2 ms as a column write against 290 ms to rebuild the batches. If a
    compact draw range is wanted, make it a separate deferred pass.

11. **Do not walk every group to find out what changed.** In the alpha, any
    change at all costs a pass over every group's version: recolouring one
    instance cost 69 % of what recolouring five hundred cost. A bulk update that
    already knows which groups it touched should hand that list to the renderer.

12. **Keep bounds out of the write path.** The cheapest correct bounds update
    after a 10,000-row move cost 11.5 ms against 2.4 ms for the move. Cache a box
    per group, recompute only the changed groups, and do it when something asks
    for the bounds rather than when the transform changes.

13. **Take the changed rows as an argument; do not derive them.** Diffing two
    whole columns to find the changed rows cost 3.6 ms and wrote nothing — twice
    the cost of writing the 10,000 known rows.

14. **Treat change detection as a downstream optimisation, not a CPU one.**
    Comparing before writing came within 15 % of writing unconditionally in every
    case measured, including when nothing had changed. Enable it where it lets
    something later be skipped, not to save the write.

15. **Do not bake vertices for a model whose colours change often.** Recolouring
    everything through the alpha's packed small-mesh path cost 14.2 ms against
    4.1 ms without it, and the multiplier is the vertex count per instance.

## What is not measured here

- GPU upload and draw cost. No WebGL context is created anywhere in this study,
  so the main reason to track dirty ranges and detect change is not quantified.
- The cost of sorting an unsorted row list, which recommendation 6 assumes is
  small relative to the 60–65 % it saves.
- Anything about the real model's data. All scenes are synthetic and generated
  from a seed.
