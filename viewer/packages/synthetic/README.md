# @bim-open-toolkit/synthetic

Seeded generators for demonstration and test data: a pseudo-random generator, mesh primitives, a
building with a room and door schedule, and a stress scene sized to a triangle budget.

The package depends on `@bim-open-toolkit/model` and nothing else. It does not touch a browser, a
renderer or a file. Everything it produces is plain data: typed arrays for numeric columns, frozen
records for everything else. Every function is pure, and every generator is a function of its
options record alone.

## Why the data has holes in it

The workflows this data exists for are exception review, not display. A door schedule is useful
because it shows the doors whose fire rating nobody entered, and the ones where the door type and
the fire strategy drawing disagree. A generator that produced a complete, tidy schedule would let a
viewer look finished while being unable to show any of that.

So the building generator puts gaps and conflicts in on purpose, at rates listed below, and records
each one as a `model` `Observation`: `known`, `missing` with a `MissingReason`, or `conflicting`
with the values that disagree. Nothing is ever filled in with a plausible default. An unknown number
reads as `NaN` in its column, never as zero, and the `<field>State` column beside it is what a
reader should test.

## Determinism

The same options give byte-identical output on every engine and platform.

- All generator state arithmetic is 32-bit integer only (`Math.imul`, shifts, xor). No
  `Math.random`, no clock, no `Math.log`, `Math.cos` or other function whose precision ECMAScript
  leaves to the implementation.
- `gaussian` is the Irwin-Hall sum of twelve uniforms rather than Box-Muller, for the same reason.
  Values are truncated at six standard deviations, which is accurate enough for dimensional jitter.
- The colours in the stress scene come from fixed palettes rather than a hue computation.
- The number of draws a generator makes depends only on its options, so adding an option value
  never shifts the sequence for an unrelated one. Where a branch would have skipped a draw, the
  draw is made anyway and discarded; those places are commented.

Seeding is a plain integer: `seed(42)`. There is no global state to reset.

## `prng` — seeded pseudo-random generator

xoshiro128\*\* seeded by splitmix32, written as pure functions over an immutable `Rng` value. Every
draw returns `{ rng, value }`; the state passed in is never modified.

```ts
import { seed, int, float, pick, shuffle, gaussian } from '@bim-open-toolkit/synthetic';

let rng = seed(42);
const first = int(rng, 0, 10);   // { rng, value }
const second = float(first.rng); // continue from the returned state
```

`pick` and `shuffle` throw for arrays holding `undefined`, because the package uses no non-null
assertions.

## `primitives` — mesh plain data

`box`, `cylinder`, `plane`, `wedge` and `extrude` return the model package's `Mesh`, narrowed to
`ShadedMesh` because every one of them carries per-vertex normals.

Every primitive is centred on the origin and wound counter-clockwise seen from outside, so a face
normal points away from the solid. Placement, rotation and scale belong to the instance transform,
not to the mesh. Faces do not share vertices, so flat faces stay flat and a curved surface can
supply per-corner normals. Vertex counts are therefore not minimal.

`plane` is a single upward face, not a solid. `extrude` accepts a footprint wound either way and
normalizes it; a self-intersecting or zero-area outline throws rather than producing a plausible but
wrong mesh. Its ear clipping is O(n squared) and rejects holes, which is right for footprints with a
handful of corners.

## `building` — storeys, rooms, walls, slabs, doors, windows and their schedules

```ts
import { generateBuilding, defaultBuildingOptions } from '@bim-open-toolkit/synthetic';

const building = generateBuilding({ ...defaultBuildingOptions, seed: 7, storeys: 10, roomsPerStorey: 24 });
```

| Option | Meaning |
|---|---|
| `seed` | Integer. Also becomes the model revision, `seed-7`, so two buildings are never confused. |
| `storeys` | Number of storeys, each repeating the same plan grid. |
| `roomsPerStorey` | Rooms per storey. The plan is a grid of `ceil(sqrt(n))` columns; cells past `n` are outside the building. |
| `doorWidthPolicy` | `nominal-only`, `nominal-and-clear` or `mixed`; see below. |
| `storeyHeight` | Metres. Storey elevation is the top of its slab. |
| `gapScale` | Multiplies every rate at which a value is missing or disputed. `0` gives a complete building; `1` gives the rates below. |

The frame is metres, z up, local — the model package's `metresZUpLocal`.

### What it produces

- `model`: a `ModelData` of `ObjectRecord`s with categories `Storey`, `Slab`, `Wall`, `Room`,
  `Door` and `Window`. Rooms are parented to their storey, doors to their room, everything else to
  its storey.
- `geometry`: a `Geometry` — a small mesh library plus one columnar instance row per object, in the
  same order as `model.objects`, so `objectIndex` is the row itself. Storeys and rooms are
  geometry-free (`meshIndex` is `noMesh`): a room is a place, not a thing to draw.
- `meshGroups`: the mesh library named. Walls and slabs are a unit cube scaled by the instance
  transform; each standard door leaf width and each window size is its own mesh placed by
  translation alone, which is how repeated joinery actually behaves.
- `facts`: three `Fact`s per door — `nominalWidth`, `clearWidth`, `fireRating`.
- `doorSchedule` and `roomSchedule`: `Table`s read off those facts.
- `doorCoverage`: `Coverage` per field. The counts always agree with the state columns.

Each room gets one door, and a quarter of rooms get a second one in the adjacent wall. About 65% of
exterior wall segments get a window. Wall segments are shared between neighbouring rooms, because
they sit on the plan grid rather than around each room, and the same grid repeats on every storey so
the walls stack.

### Door schedule columns

`objectId`, `name`, `nameKnown`, `storey`, `roomId`, then for each observed field:

| Column | Contents |
|---|---|
| `<field>` | The value, as `f64` for a quantity and a string for text. Meaningless unless the state is `known`: `NaN` or `''` otherwise. |
| `<field>Unit` | The unit of a known quantity, `''` otherwise. Widths are millimetres. |
| `<field>State` | `known`, `missing` or `conflicting`. Test this column, not the value. |
| `<field>MissingReason` | The `MissingReason`, or `''` when not missing. |
| `<field>Conflict` | The disagreeing values joined by ` vs `, or `''`. |
| `<field>Evidence` | The sources, `source (reference)` joined by `; `. |

The fields are `nominalWidth`, `clearWidth` and `fireRating`.

### The gaps, and why each one is there

Rates are per door, before `gapScale` is applied.

| Gap | Rate | Reason it exists |
|---|---|---|
| `nominalWidth` conflicting | 6% | The door type says one width, the opening measured off the wall says 50 mm more. Two sources, no resolution. |
| `nominalWidth` missing, `not-provided` | 4% | The parameter was never filled in. |
| `clearWidth` missing, `not-measured` | policy | Clear width is a site measurement, so it is absent wherever nobody surveyed. |
| `clearWidth` missing, `unresolved-source` | follows nominal | Where the nominal width itself is unknown, there is nothing to survey against. |
| `fireRating` missing, `not-applicable` | rooms not on a protected route (Lobby, WC) | A door with no rating to record is a different fact from one whose rating was never entered. This one is not a gap and `gapScale` does not remove it. |
| `fireRating` missing, `not-provided` | 12% of rated doors | The rating was never entered. |
| `fireRating` conflicting | 8% of rated doors | The door type and the fire strategy drawing disagree. |
| Door has no name | 3% | The schedule has to fall back to the id. |
| Room has no name | 5% | The room schedule's `name` is `''` and the object record has no `name`, so a reader has to fall back to the id. |
| Room has no storey link | 4% | Level navigation must show the room as unassigned rather than putting it on a guessed level. `storeyKnown` is false and `storey` is `''`. |

Door width policy:

- `nominal-only` — clear width is never recorded. This is a policy, not a gap, so `gapScale` does
  not affect it.
- `nominal-and-clear` — clear width is recorded wherever the nominal width is known, at 60 mm less
  than nominal: a leaf loses the frame stop and the open leaf's own thickness on the way through.
- `mixed` — clear width is recorded for about 60% of doors at `gapScale` 1.

### Size

A ten-storey building of forty rooms per storey is about 2,000 objects, 500 doors and 400 rooms,
generated in roughly 15 ms on the machine this was written on.

## `stress` — many instances inside a triangle budget

```ts
import { generateStressScene, defaultStressOptions } from '@bim-open-toolkit/synthetic';

const scene = generateStressScene(defaultStressOptions);
```

The default is the scene the performance targets name: ten thousand instances inside ten million
triangles. It produces about 7.8 million triangles across 24 meshes in roughly 80 ms.

| Option | Meaning |
|---|---|
| `seed` | Integer; also the model revision. |
| `instances` | Exactly this many instances are placed. None is ever dropped. |
| `meshes` | Size of the mesh library: one box, then cylinders whose triangle counts rise geometrically. |
| `triangleBudget` | The drawn triangle count of the whole scene, summed over instances — not the size of the mesh library. |
| `maxMeshTriangles` | Cap on the largest single mesh. |
| `mix` | Relative shares of `opaque`, `transparent`, `metal` and `painted`. Normalized, so the weights need not sum to one. |

The budget is never exceeded. Before choosing a mesh for an instance, the generator reserves the
cheapest mesh for every instance it has not placed yet and picks only from what is still affordable,
spreading the budget rather than spending it on the first instances. Options whose instance count
cannot fit even at the cheapest mesh are refused with an error rather than satisfied by dropping
instances.

The material mix is there because it decides how a renderer must batch and sort: transparent
instances cannot join an opaque batch, and metal and painted surfaces shade differently. A scene of
one material would flatter any implementation. `materialClass` is one byte per instance indexing
`materialClasses`; `materialCounts` is the tally. Only transparent instances have an opacity below
one, between 0.2 and 0.5.

Every instance is an addressable object in `scene.model.objects`, in instance-row order, which is
what the "ten thousand independently addressable render instances" target needs.

## Labelling

Data from this package is synthetic. Anything shown from it should say so. It preserves realistic
material and instance diversity but it is not a substitute for a real source model, and its
quantities are not measurements of anything.
