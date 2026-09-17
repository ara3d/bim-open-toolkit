# How the render package fits together

`@bim-open-toolkit/render` turns a model's geometry into something a viewer-core scene draws, and
turns bulk changes into writes against that scene. It has one rule that shapes everything else:
**anything that does not need a WebGL context is pure or data-structure level and is tested in
Node; anything that does is a small interface a test can substitute.**

There are five such interfaces in the whole package, each with one to four methods:

| Interface | What a renderer does for it |
|---|---|
| `RaycastSource` | Turns a ray into group-and-slot hits |
| `ClippingTarget` | Puts a list of planes in force |
| `EnvironmentTarget` | Draws a background, a light rig, a grid and axes |
| `OverlayRenderer` | Draws placed overlay primitives |
| `CaptureTarget` | Reads and changes the drawing buffer size, draws a frame, encodes it |
| `GpuFrameTimer` | Times work on the GPU, or says it cannot |

Everything else - the instance table, bulk updates, dirty ranges, picking arithmetic, clipping
geometry, representations and replacement, overlay projection and hit testing, frame statistics,
scene binding - runs and is tested without a browser. `three` is a peer dependency of the package
but nothing in `src` imports it.

## Binding: `instance-table.ts`

A model `Geometry` carries its meshes as records, as the M1.2 `meshTable`, or as both, and
`geometry-meshes.ts` is the one place this package reads them: the table wins when both are there, so
a BFAST model, whose `meshes` is empty, binds exactly as one carrying records does.

A model `Geometry` is a mesh library plus columnar instance records. Binding it produces an
`InstanceTable`: one **row** per rendered instance, and a set of typed-array index columns that
connect rows to everything a caller might address.

```
Geometry.instances (source order)          InstanceTable (row order)
  meshIndex   objectIndex                    rows sorted by mesh
  transform   color                          groupOfRow, groupStart
                                             objectOfRow, objectRows, objectStart
                                             opacity, visible
                                             colors[], transforms[]  (borrowed views)
```

Three decisions matter.

**One group per mesh, and rows sorted by mesh.** Every instance of one mesh goes into one
`InstancedGroup`, and the rows of that group are a contiguous run of the row space. A group's slot
is then `row - groupStart[group]` - two array reads, no search. It also means a bulk update that
touches nearby objects touches nearby memory, which is the single largest effect measured (see
below).

**No per-instance JavaScript object, anywhere.** Object keys reach rows through a
`Map<ObjectKey, number>` of object ordinals - one entry per *object*, of which the reference model
has 51,139, not per instance, of which it has 456,598 - and then through `objectStart` and
`objectRows`. Reading a row's colour or transform reads the group buffer.

**The group buffers are captured once.** `InstancedGroup.colors` and `.transforms` are getters that
build a fresh `subarray` view on every access. Reading them inside a per-row loop therefore
allocates once per instance. `InstanceTable` holds both views in `colors[]` and `transforms[]`, and
the writers use those. This is why nothing may append instances to a group after its table is
built: appending can reallocate the underlying buffer and the captured views would then be stale.

**Opacity and visibility are separate columns.** A source may declare a row hidden through
`InstanceRecords.visible`, and that is honoured at build time. viewer-core draws per-instance alpha and its
patched material discards fragments below `MIN_VISIBLE_ALPHA`, so hiding a row is a write of alpha
zero. If that were the only record, showing the row again would not know what opacity it had. The
table keeps `opacity` and `visible` per row, and the stored alpha is always `visible ? opacity : 0`.
Both writers maintain that, so hiding a ghosted object and showing it again returns it to ghosted.

## Bulk updates: `updates.ts`

Five writers - colour, opacity, visibility, whole transforms, translations - take a row selection
and a typed array of values, either one value broadcast to every row or one value per row. Each
returns how many rows it actually changed.

- **Change detection** compares before writing, against `Math.fround` of the incoming value, because
  a double stored into a `Float32Array` is rounded and comparing the unrounded double would report a
  change that did not happen.
- **Dirty slot ranges** are recorded per group during the write: the first and last slot touched.
  That is what an uploader needs to send a sub-range instead of a whole buffer.
- **`everyRow`** skips the row index entirely and walks the group buffers.
- **`publishDirty`** tells viewer-core what moved, once per touched group.

`applyUpdates` is the same thing driven by a model `Table`. The column names are the model package's
own instance-table names - `objectIndex`, `red`, `green`, `blue`, `alpha`, `m0` to `m15` - plus
`visible` and `key`, so a table produced by `instanceTable(records)` is a change table with no
translation and there is one vocabulary rather than two. One object expands to every row it draws. A
partial colour or transform is refused rather than half applied.

### What publishing costs, and the one thing viewer-core is missing

Writing goes straight into the borrowed buffers, which viewer-core knows nothing about. Something
has to bump its version counters or the mirror will not sync. `InstancedGroup` offers no way to say
"this range changed" without also supplying the values, so `publishDirty` hands a group back the
slice it already holds (`setColors`) and rewrites one transform slot with the value already there
(`setTransform`). Both are self-copies, and both bump the counter exactly once per group.

Measured, this is the most expensive part of a bulk update: writing 10,000 scattered rows of the
reference model takes 3.66 ms and publishing what it touched takes another 5.31 ms, because those
rows fall in nearly 10,000 distinct groups. A `markColorsChanged(start, count)` and
`markTransformsChanged(start, count)` on `InstancedGroup` would remove both self-copies. That is
requested in `CHECKPOINT-R.md`.

## Picking: `picking.ts`

The renderer answers "which group and slot, where, how far". Everything after that is here:

1. `rowOfSlot` turns the group and slot into a row.
2. Hidden rows and rows the renderer would discard for transparency are rejected, unless the caller
   asks for them. A ghosted object stays pickable; a fully transparent one does not.
3. Hits removed by the clipping planes are rejected, so a cut-away surface does not block a pick.
4. The row becomes an object key. Hits are never reported as a group and slot, because those are
   this package's bookkeeping and change when a model is rebuilt.
5. `nearestHit` chooses across the instances and any extra sources.

An **extra source** is anything that draws its own geometry and wants to compete: a replacement
mesh, an overlay volume, a proxy. `intersectMesh` and `intersectTriangle` are here so such a source
can be written and tested in Node. They accept back faces, because a section cut leaves back faces
towards the camera and rejecting them would report the surface behind the one being looked at.

`rayThroughNdc` builds a world ray from an inverse view-projection and a point in normalized device
coordinates, including the perspective divide that the model package's affine `transformPoint` does
not do.

## Clipping: `clipping.ts`

A plane keeps `dot(normal, point) + constant >= 0`, which is three.js's convention for `Plane` and
for material clipping with `clipIntersection` false, so an adapter copies planes across without
reinterpreting them. A box is the intersection of six of them. `boundsClipped` is exact: a box that
straddles a plane is kept, only a box wholly outside is removed.

## Representations and replacement: `representations.ts`

A `ReplacementState` records which representation stands in for which object key. Applying it does
not edit rows, remove a group or rebuild anything: the replaced object's rows are hidden and the
substitute is drawn beside them, so the shared prototype other instances draw from is untouched.
`changedReplacements` names exactly the keys whose rows have to be shown or hidden again.

`drawnReplacements` produces the list a renderer draws; `replacementSource` produces a pick source
over that same list, so picking a substitute reports the object it stands for and a hidden
substitute is not picked. `boxMesh` builds the standard stand-in with no geometry generation at all.

## Overlays: `overlays.ts`

Every primitive has one shape: a kind, an ordered list of anchors, a style, optional text and an
optional click action. That is why one projection function and one hit test serve points, lines,
arrows, labels, paths and boxes. `overlayItem` refuses an anchor count a kind cannot draw and a
label with no text.

An anchor is a world point or an object key; object anchors resolve through a function the caller
supplies, so this module never learns how an object is placed and an anchor whose object has gone
stays unresolved rather than moving to a different object. A primitive is drawn only when *every*
anchor resolved and landed in the view, so a leader line with one end behind the camera is not drawn
half way across the screen. A hidden layer neither projects nor answers a click.

## Environment: `environment.ts`

Settings plus generated line segments. The grid picks a spacing of 1, 2 or 5 times a power of ten so
that between ten and fifty lines cross the model, which makes one set of settings correct for a door
handle and for a city block. None of it is model geometry - it is not in the instance table - so it
cannot enter an object inventory or a fit-to-selection bound.

## Capture: `capture.ts`

The ordering is the whole point. Render immediately before encoding, because a canvas that does not
preserve its drawing buffer has nothing to read otherwise. Apply a requested size, draw at it, then
put the original size back even when encoding fails, so making a thumbnail from a saved view does
not disturb the active camera. A refused encode or an empty result is a diagnostic naming the
reason, never a blank image with no explanation.

## Timing: `timing.ts`

Nothing here reads a clock: `mark` is given the timestamp, so the whole thing is tested with a
made-up sequence of times. Percentiles are by nearest rank, so a reported value is one that was
measured. `withinBudget` compares the 95th percentile with the 33.3 ms of a 30 frames a second
target, so an occasional long frame is visible rather than averaged away.

GPU timing is an interface, and its unavailability carries a reason. A HUD shows that reason; it
never substitutes a CPU number, which would be an answer to a different question.

`sceneStatistics` distinguishes source objects, groups, rendered instances, visible instances and
rendered triangles, which is what the HUD requirement asks for. Visible instances and triangles are
counted on demand rather than kept as running totals, because keeping them would make every bulk
update pay for a number most frames never read.

## Composition: `scene-binding.ts`

The only stateful thing in the package. It owns which groups are in the `ViewerScene` and borrows
everything else. `addModel` builds a table and adds its groups; `removeModel` takes them out.

`applyStyles` takes an M1 `ResolvedStyles` and writes it. It addresses **every** row of the model,
not only the keys the resolution names, because `resolveStyles` deliberately omits a key whose
appearance equals the fallback: an object a rule has stopped applying to must go back to the
fallback and is not in `byKey` to say so. Change detection is what makes that affordable - a second
identical resolution writes zero rows, which is a test.

Renderer hits carry their model id, because group ordinals are per table. `groupIndex()` gives an
adapter the mapping from a group object to its model and ordinal.

## What needs a browser, and is therefore not tested here

- That the three.js mirror actually syncs when a group's version counter moves. `GroupObject.sync`
  is alpha code with its own tests; this package's contribution is bumping the counter once per
  group, which is asserted here against the counter itself.
- That an alpha of zero is discarded rather than drawn. That is viewer-core's patched material.
- Raycasting against instanced and batched geometry. `SceneObject.raycast` provides it; this package
  consumes it through `RaycastSource`.
- Anything a `CaptureTarget`, `EnvironmentTarget`, `OverlayRenderer` or `ClippingTarget` does once it
  is handed the data.
- GPU upload cost and draw time. No number in the performance suite includes either.

## Performance

`npm run perf -w @bim-open-toolkit/render -- --reporter=verbose`. The verbose reporter is required:
the default one hides console output from passing tests, which is the evidence these tests print.

Machine: Intel Core Ultra 7 155H, 22 logical cores, 64 GB, Windows 11 (10.0.26200), Node v22.13.1,
vitest 4.1.11. Scenes are synthetic and have the reference model's shape: 456,598 rendered instances
over 158,055 groups and 51,139 objects. CPU only; no WebGL context is created.

### Changing 10,000 of 456,598 rows

| Operation | scattered | sorted | contiguous |
|---|---:|---:|---:|
| Colour | 3.39 ms | 2.11 ms | 0.45 ms |
| Visibility | 3.07 ms | 1.67 ms | 0.54 ms |
| Translation | 3.80 ms | 2.69 ms | 0.27 ms |
| Whole 4x4 transform | 9.74 ms | 6.47 ms | - |

Sorting the rows of an update into buffer order is worth about a third; having them contiguous is
worth about seven eighths. This is the same relationship the instance-update study measured, and it
is why `InstanceTable` orders rows by mesh rather than leaving the order to the caller.

Recording dirty ranges costs about 20 % on top of a scattered colour write (4.08 ms against
3.39 ms). Change detection costs between nothing and about 50 %, depending on how wide the compared
value is relative to the write; for scattered rows it does not save CPU even when nothing has moved,
because the cache line has to be fetched either way. What it saves is downstream: the dirty ranges
stay empty, so nothing is published and nothing is uploaded.

### What the group count costs

| Whole-model colour write, 456,598 rows | median |
|---|---:|
| 158,055 groups, one per element (the alpha's shape) | 14.6 ms |
| 2,048 groups, one per mesh (this package's shape) | 9.35 ms |
| One allocation, straight pass (not reachable through viewer-core) | 8.98 ms |

For 10,000 scattered rows the same comparison is 1.48 ms against 0.58 ms, a factor of 2.6.

The instance-update study's fourth recommendation was to hold each attribute in one allocation for
the whole model with each group's buffer a view into it. `InstancedGroup` allocates its own buffers
in its constructor and offers no way to supply one, so that is not reachable. The measurement above
says most of what it would buy is obtained instead by grouping instances by mesh, which is what this
package does: 9.35 ms against a floor of 8.98 ms. The remaining 4 % does not justify a change to
viewer-core.

### Against the requirement

Brief section 8 asks for a 10,000-object bulk update to complete below 1,000 ms at the 95th
percentile, from submission to the frame showing the result. The CPU submission measured here is
3 to 10 ms for 10,000 rows of a 456,598-row model, plus 5 ms to publish. GPU upload and draw are not
included and have not been measured; that belongs to a browser run.
