# Normalized bindings: what they cost and what replaces them

Track BIND, 2026-09-07. Local measurement evidence for the V2 plan's
"Data layout for scale" section. Not release qualification.

## The question

The alpha loader's `loadBosModel` does three things: parse the file, convert the
geometry into `InstancedGroup`s, and then build one frozen JavaScript
`InstanceBinding` per rendered instance plus one `ObjectRecord` per entity. The
third step copies each instance's 4x4 transform and RGBA colour factor out of the
group buffers into two more frozen arrays inside the binding object. For the
reference model that is 456,598 binding objects.

Every value it copies is still in the group buffer it came from. The question was
whether a columnar table that keeps only where a row lives — which object, which
group, which slot — says the same thing, and what it saves.

It does, and it is about five times faster and twenty-four times smaller.

## Method

- Machine: Intel Core Ultra 7 155H, 64 GiB, Windows 11 (10.0.26200).
- Node 22.13.1, vitest 4.1.11, one process, `NODE_OPTIONS=--expose-gc`.
- Model: the private prepared BFAST of the reference building, 111,630,208 bytes,
  the conversion that keeps the Parquet tables. It is never committed. The
  benchmark reads `SNOWDON_BFAST_PATH` and skips with a printed reason when the
  file is absent.
- File reading is excluded. The buffer is read once and reused.
- Every case is warmed once, then the repetitions are interleaved — one round
  runs every case — and the median is reported. Interleaving is what makes two
  cases on the same machine comparable; see `src/perf/measure.ts` (Track PERF).
  Five repetitions on the reference model, 25 to 5 on the synthetic scales.
- The machine was otherwise idle for the numbers below. Repeating the same run
  while three other agents were working made every figure five to ten times
  larger while leaving the relationships intact.
- Heap figures are `process.memoryUsage().heapUsed` growth with a forced
  collection before and after, with the built value kept reachable. They are
  sampled numbers, not allocation counts.
- Commands:
  - `npm test -w @bim-open-toolkit/testing` — parity and edge cases, no model needed.
  - `NODE_OPTIONS=--expose-gc npm run perf -w @bim-open-toolkit/testing` — the benchmarks.

## What is compared

| Path | What it produces |
|---|---|
| alpha | `src/bindings/alpha-reference.ts`: the alpha loader's binding loop with its event-loop yields removed so it can be timed. One frozen object per instance holding a frozen 16-element transform and a frozen 4-element colour, plus one record per entity. |
| columnar | `src/bindings/build.ts`: an `ObjectTable` of two `Int32Array`s and a `RepresentationTable` of three `Int32Array`s over the group buffers. No per-instance object. |

The alpha reference is checked against the shipped `loadBosModel` on the
reference model: same object count and order, same object ids, names and source
ids, same object for every one of the 456,598 instances, same representation ids,
same colours, and the same transforms to single precision.

## Where the time goes

Reference model, 158,055 groups, 456,598 rendered instances, 51,139 objects.
Medians of five interleaved repetitions.

| Step | Median ms | Note |
|---|---:|---|
| parse (`parseBfastModel`) | 94 | typed-array views on the file, plus full geometry validation |
| entity table decode (`bimEntityLocalIds`) | 14 | one Parquet column |
| group conversion (`bfastToGroups`) | 574 | allocates two `Float32Array`s per group |
| alpha binding | 348 | 456,598 objects |
| columnar binding | 75 | three integer columns |

End to end, five repetitions each in the same process:

| Path | Median ms |
|---|---:|
| shipped `loadBosModel` | 1687 |
| parse + entity table + conversion + columnar binding | 896 |

The shipped loader is slower than the sum of its measured parts because it yields
to the event loop every 4096 instances — 111 yields on this model — and calls a
progress callback per group. The supervisor's cold-process figure for the same
file was 1981 ms.

### Inside the columnar step

| Part | Median ms | Cost is per |
|---|---:|---|
| transform validation | 41 | float in the group buffers |
| object table | 14 | entity, plus one pass over the instance records |
| opaque material rebuild | 10 | translucent group |
| representation columns | 12 | instance |

Only the last is the binding proper. The other three are work the alpha does too,
and two of them do not belong here at all:

- **Transform validation is redundant for BFAST.** `parseBfastModel` already
  rejects a non-finite instance transform. Repeating it during binding costs 41
  of the 75 ms. It is still needed for BOS, which composes transforms during
  conversion.
- **The opaque material rebuild belongs to conversion.** Source alpha is carried
  in the per-instance colour, so a group whose material is also translucent would
  fade twice; the alpha loader rebuilds such a group with an opaque material,
  copying its transform and colour buffers. If `bfastToGroups` and `bosToGroups`
  emitted opaque materials and left alpha in the colour column, no consumer would
  need the rebuild.

Removing both leaves about 26 ms for the whole binding step: 14 ms of object
table and 12 ms of columns.

## Memory

V8 keeps typed-array backing stores outside the JavaScript heap, so `heapUsed`
growth measures JavaScript objects and the columns have to be counted separately.
Checked directly: allocating a 5,479,176-byte `Int32Array` moves `heapUsed` by
-3,152 bytes and `arrayBuffers` by exactly 5,479,176.

| Path | JavaScript heap growth | Typed-array columns | Together |
|---|---:|---:|---:|
| alpha | 234.8 MB | 0 | 234.8 MB |
| columnar | 4.6 MB | 5.23 MB | 9.8 MB |

The alpha figure is all JavaScript: 456,598 binding objects, 456,598 frozen
16-element arrays, 456,598 frozen 4-element arrays and 456,598 representation-id
strings. The columnar figure is 5.23 MB of columns — exactly `456,598 x 3 x 4`
bytes, asserted structurally so the claim does not depend on heap sampling — plus
the objects both paths share, chiefly the group clones the material rebuild makes.

Twenty-four times less, and the part that grows with instance count is the 5.23
MB, not the 4.6 MB.

## Scale, without the private model

`test/perf/bindings/synthetic-scale.perf.ts` builds a `RenderModel` in memory with
the same shape — many groups holding few instances, several instances per object,
plus hidden and geometry-free rows — and runs everywhere.

| Instance records | Rendered | Groups | Reps | alpha ms | columnar ms | alpha heap | columnar heap | columns |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | 9,533 | 7,242 | 25 | 12.0 | 4.8 | 6.3 MB | 1.8 MB | 0.11 MB |
| 100,000 | 94,870 | 72,406 | 10 | 135.2 | 69.0 | 63.3 MB | 18.2 MB | 1.09 MB |
| 500,000 | 474,875 | 124,997 | 5 | 568.0 | 157.9 | 262.1 MB | 32.9 MB | 5.43 MB |

Both paths are linear in instances. The gap widens with size because the alpha's
cost is dominated by allocation and the columnar path's by two linear passes.

Repetitions fall as the model grows so that every scale costs about the same
wall time. Five rounds at ten thousand instances turned out not to be enough on a
machine running several agents at once: the two medians are only a few
milliseconds apart there and swapped places once. Twenty-five rounds hold.

## Recommended shape for V2

Ranked, with the measurement behind each point.

### 1. `RepresentationTable` is three `Int32Array`s and nothing else

```ts
type RepresentationTable = {
  readonly count: number;
  readonly objectIndex: Int32Array;    // row of the object table
  readonly groupIndex: Int32Array;     // which group buffer
  readonly instanceIndex: Int32Array;  // which slot in it
  readonly colorFactor?: Float32Array;      // 4 per row, only if some row overrides
  readonly localTransform?: Float32Array;   // 16 per row, only if some row overrides
};
```

Evidence: neither override column is allocated by any load path measured here.
Both loaders write the instance transform and colour into the group buffers, and
the alpha's copies of them are equal to what the buffers hold, to single
precision, on all 456,598 instances of the reference model. Keeping the columns
costs 5.23 MB against 234.8 MB. Materialize an override column the first time a
representation is given a value its group does not have — replacement, an edit
layer, a per-instance offset — not at load.

The transform and the colour of a row are read as views on the group buffer
(`instanceTransform`, `instanceColor`), so answering "what does instance i look
like" copies nothing.

### 2. One instance table type, in `render`, not three

Three tracks arrived at overlapping columns:

| Type | Columns | View |
|---|---|---|
| `InstanceRecords` (`model/src/mesh.ts`, Track M) | `meshIndex`, `transform`, `color`, `objectIndex` | format side, before grouping |
| `InstanceColumns` (`testing/src/perf/columns.ts`, Track PERF) | `groupOf`, `indexInGroup` | render side, for bulk updates |
| `RepresentationTable` (here) | `objectIndex`, `groupIndex`, `instanceIndex` | render side, addressable by object |

`InstanceRecords` is the right shape for what a format produces: it owns the
transform and colour because nothing else holds them yet. `RepresentationTable`
is the right shape for what `render` binds: the group owns the values, and the
table says where. They are different types for a reason and both should stay.
`InstanceColumns` is `RepresentationTable` without `objectIndex`; it should
become the same type, because a bulk update needs to go from an object to its
rows and cannot without that column.

Recommendation: `render` owns one `RepresentationTable` with the three integer
columns plus optional overrides; `formats` produces `InstanceRecords`; the step
between them is `buildRepresentationTable`, twelve milliseconds on the reference
model.

### 3. `LoadedModel` keeps objects as columns and derives the record

Evidence: 14 ms and two `Int32Array`s for 51,139 objects, against a `Map` of
51,139 records each holding a frozen reference object. Everything the alpha's
`ObjectRecord` holds is either constant (identity transform, default appearance)
or derived from two integers (entity row, source id). `objectAt(table, row,
modelId)` reproduces the record exactly when a caller wants one.

`ModelData.objects` in `model` is still `readonly ObjectRecord[]`. That is fine
for a model of tens of thousands of objects and it is the API consumers want;
the recommendation is that `formats` build the columns and expose the array as a
lazily materialized view, not that `ModelData` change.

### 4. Bind by column, not by loop with a callback

Evidence: the shipped loader spends 1687 ms where its parts sum to about 900 ms,
because it yields every 4096 instances to keep the page responsive during the
binding loop. A 12 ms column fill has nothing to yield for. Progress reporting
belongs to parse and conversion, which are 668 ms of the 896 ms and are already
per-group.

### 5. The next target is group conversion, not binding

Evidence: with binding removed, 574 ms of an 896 ms load is `bfastToGroups`. It
allocates a `Float32Array` for transforms and another for colours per group —
316,110 allocations for 158,055 groups averaging under three instances each —
plus a `number[]` of entity rows per group. One pair of buffers for the whole
model with per-group subarray slices would remove all of them, and the
representation columns would then index into one buffer instead of 158,055. That
is a `formats` and `render` design decision, and it is where the remaining time
is.

### 6. Two changes in the loaders would pay for themselves

Neither was made; the loaders are read-only for this track.

- `bfastToGroups` and `bosToGroups` should emit opaque materials and leave source
  alpha in the per-instance colour column. Saves the 10 ms rebuild and a copy of
  the buffers of every translucent group, in every consumer.
- `parseBfastModel` already validates every instance transform, so a consumer that
  trusts it can skip revalidation. Saves 41 ms. Expose it as a property of the
  parse result rather than making every consumer know.

## Limits of this evidence

- One machine, one model, one Node version, warm in-process runs. Cold-process
  numbers are higher; the supervisor's cold figure for the same file was 1981 ms
  against 1687 ms here.
- Heap growth is sampled, not counted, and needs `--expose-gc` to mean anything.
  The regression tests assert the structural byte count instead, which does not.
- GPU upload, transfer and first useful frame are not measured. This is CPU
  normalization only.
- Parity is established against the shipped `loadBosModel` for the BFAST path on
  the reference model, and against the alpha reference for both up axes on
  synthetic models. The BOS path was not measured; it produces the same
  `groupEntities` shape, so the columnar builder consumes it unchanged, but that
  is an argument, not a measurement.
