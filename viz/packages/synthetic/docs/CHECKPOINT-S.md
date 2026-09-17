# Checkpoint S: synthetic generators

Track S of visualization V2 wave 0. Fence: `viewer/packages/synthetic/**` except `package.json`,
`tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`, which are supervisor-owned.

**State:** verified. Wave 0 scope is complete: seeded PRNG, mesh primitives, building generator,
stress generator, README and public surface.

**Model revision built against:** `M1-stub`, Track M commit `325e9d1`. Verified against the model
tree at `e91d856`, which adds `schema.ts`, `sets.ts`, `edits.ts`, `view.ts` and extends `style.ts`
and `math.ts` additively; nothing this package uses changed. The names taken from
`@bim-open-toolkit/model` are:

`Vec3`, `Bounds`, `Matrix4`, `Color`, `identityMatrix`, `translation`, `scaling`, `multiplyMatrix`;
`Mesh`, `boundsOfPositions`, `triangleCount`, `vertexCount`, `noMesh`, `Geometry`,
`InstanceRecord`, `InstanceRecords`, `instanceRecords`, `isGeometryFree`, `geometryBounds`;
`ModelRef`, `ObjectRef`, `objectRef`, `ObjectRecord`, `ModelData`; `Appearance`;
`CoordinateContext` via `metresZUpLocal`; `Table`, `Column`, `columnOf`, `isNumericColumn`,
`f64Column`, `i32Column`, `boolColumn`, `stringColumn`, `table`; `Fact`, `fact`, `Observation`,
`known`, `missing`, `conflicting`, `quantity`, `text`, `knownQuantity`, `Evidence`, `FactValue`,
`Coverage`, `coverageOf`.

Nested sub-agents spawned: 0.

## Chunks

| # | Delivers | State | Commit |
|---|---|---|---|
| 1 | Seeded PRNG | verified | `7f896b2` |
| 2 | Mesh primitives | verified | `0bb504a` |
| 3a | Adopt the model's types, drop `src/shapes.ts` | verified | `a9c32ba` |
| 3 | Building generator and schedules | verified | `de74166` |
| 4 | Stress generator | verified | `ac28ec0` |
| 5 | README and public surface review | verified | `b634d14` |

## Files

- `src/prng.ts` — xoshiro128\*\* over an immutable state value.
- `src/mesh-builder.ts` — triangle accumulator over the model's `Mesh`; `ShadedMesh`, `MeshGroup`.
- `src/triangulate.ts` — ear clipping for simple polygons in the horizontal plane; local `Vec2`.
- `src/primitives.ts` — box, cylinder, plane, wedge, extrude.
- `src/schedule.ts` — observations rendered as table columns without losing what is not known.
- `src/building.ts` — the building generator.
- `src/stress.ts` — the stress scene generator.
- `src/index.ts` — public exports, one level.
- `test/prng.test.ts`, `test/primitives.test.ts`, `test/building.test.ts`, `test/stress.test.ts`,
  `test/index.test.ts`.
- `README.md`, `docs/CHECKPOINT-S.md`.

## Delivered behavior

### Chunk 1 — PRNG

xoshiro128\*\* seeded by splitmix32, as pure functions over an immutable `Rng` value. Every draw
returns `{ rng, value }`; the input state is never modified. `seed`, `next`, `float`, `range`,
`int`, `pick`, `shuffle`, `gaussian`.

Determinism decisions:

- All state arithmetic is 32-bit integer only (`Math.imul`, shifts, xor), so sequences are identical
  on every engine and platform.
- `gaussian` is the Irwin-Hall sum of twelve uniforms, not Box-Muller. `Math.log` and `Math.cos`
  have implementation-defined precision in ECMAScript, so Box-Muller would not be bit-identical
  across platforms. The cost is truncation at six standard deviations.
- `int` uses `floor(float * span)`. The bias is below one part in 2^24 for the spans used here.
- `pick` and `shuffle` throw for arrays holding `undefined`, because `noUncheckedIndexedAccess` is
  on and the package uses no non-null assertions or casts.

### Chunk 2 — primitives

`box`, `cylinder` (segmented, radial side normals, flat caps), `plane` (a single upward face, not a
solid), `wedge` (right triangular prism) and `extrude` (a simple polygon along Y). Each is centred
on the origin and wound counter-clockwise seen from outside; placement belongs to the instance
transform. Faces do not share vertices, so flat faces stay flat. `extrude` accepts either winding
and normalizes it; a self-intersecting or zero-area outline throws rather than producing a plausible
but wrong mesh. Ear clipping is O(n squared), which is right for footprints with a few corners.

### Chunk 3a — adoption of the model contracts

The private `src/shapes.ts` is gone. `Vector3` became `Vec3`, `Bounds3` became `Bounds`, `MeshData`
became `Mesh`. Because `Mesh.normals` is optional and every primitive here produces normals,
`src/mesh-builder.ts` exports `ShadedMesh = Mesh & { readonly normals: Float32Array }`; `build`
returns that shape directly, so no cast is needed and callers read `mesh.normals` without a check.
`triangleCount` and `vertexCount` are the model's and are not re-exported. The model has no
two-dimensional vector, so `src/triangulate.ts` keeps a local `Vec2` for footprint corners.

### Chunk 3 — building generator

`generateBuilding(options)` where options are `seed`, `storeys`, `roomsPerStorey`,
`doorWidthPolicy`, `storeyHeight` and `gapScale`. The frame is `metresZUpLocal`.

Produces:

- `model`: `ModelData` with categories `Storey`, `Slab`, `Wall`, `Room`, `Door`, `Window`. Rooms are
  parented to their storey, doors to their room. The model revision is `seed-<n>`, so two buildings
  are never confused for two revisions of one building.
- `geometry`: a mesh library plus one columnar instance row per object, in `model.objects` order.
  Storeys and rooms are geometry-free (`noMesh`), which exercises that path.
- `meshGroups`: the library named, with per-mesh instance and triangle counts. Walls and slabs are a
  unit cube scaled by the instance transform; each standard door leaf width (762, 838, 926, 1000 mm)
  and each window size is its own mesh placed by translation, as repeated joinery really behaves.
- `facts`: three `Fact`s per door.
- `doorSchedule`, `roomSchedule`: `Table`s. Each observed field becomes six columns — value, unit,
  state, missing reason, disagreeing values, evidence. An unknown number is `NaN`, never zero.
- `doorCoverage`: `Coverage` per field, always agreeing with the state columns.

Deliberate gaps, all listed with their rates and reasons in `README.md`: nominal width disputed
between the door type and the wall opening (6%) or never entered (4%); clear width absent by policy
or unresolvable where the nominal width is unknown; fire rating not applicable on doors off a
protected route, never entered (12% of rated doors) or disputed between the door type and the fire
strategy drawing (8%); doors and rooms without names (3% and 5%); rooms that lost their storey link
(4%), which level navigation must show as unassigned rather than guess.

`gapScale` multiplies every gap rate: `0` gives a complete building, so tests can pin both ends.
`not-applicable` is not scaled, because it is a fact about the door rather than a gap in the data.

Plan layout: one grid of `ceil(sqrt(roomsPerStorey))` columns, drawn once and repeated on every
storey, so walls stack and are shared between neighbouring rooms rather than duplicated per room.

Measured: 10 storeys of 40 rooms is 2,015 objects, 501 doors, 400 rooms, generated in about 15 ms.

### Chunk 4 — stress generator

`generateStressScene(options)` where options are `seed`, `instances`, `meshes`, `triangleBudget`,
`maxMeshTriangles` and `mix`.

The budget is the drawn triangle count of the whole scene summed over instances, not the size of the
mesh library, because that is what the performance targets in brief section 8 mean. Before choosing
a mesh for an instance the generator reserves the cheapest mesh for every instance not yet placed
and picks only from what is still affordable, allowing up to three times an even share so the budget
is spread rather than spent on the first instances. Options whose instance count cannot fit even at
the cheapest mesh are refused with an error, never satisfied by dropping instances.

The material mix (`opaque`, `transparent`, `metal`, `painted`) is there because it decides how a
renderer must batch and sort. `materialClass` is one byte per instance indexing `materialClasses`;
`materialCounts` is the tally. Only transparent instances have an opacity below one. Colours come
from fixed palettes rather than a hue computation, so no transcendental function enters the output.

Every instance is an addressable object in `model.objects`, in instance-row order, which is what the
"ten thousand independently addressable render instances" target needs.

Measured, at `defaultStressOptions` (10,000 instances, 24 meshes, 10,000,000 triangle budget):
7,779,292 triangles drawn, 78% of budget, in about 83 ms. Instance counts per mesh range from 76 on
the 8,192-triangle cylinder to 543 on a 96-triangle one.

### Chunk 5 — README and public surface

`README.md` documents each generator, what it produces, every gap rate with its reason, the
determinism decisions and the labelling requirement. `src/index.ts` is one level of re-exports, each
group preceded by a `//` line; every exported declaration has its own `//` contract line at its
declaration site, checked mechanically across `src/*.ts`.

## Commands and actual results

Run from `viewer/`.

| Chunk | `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | `npx eslint packages/synthetic` | `npm test -w @bim-open-toolkit/synthetic` |
|---|---|---|---|
| 1 | passed, no output | passed, no output | 2 files, 14 tests, 929 ms |
| 2 | passed, no output | passed, no output | 3 files, 24 tests, 1.18 s |
| 3a | passed, no output | passed, no output | 3 files, 24 tests, 802 ms |
| 3 | passed, no output | passed, no output | 4 files, 56 tests, 918 ms |
| 4 | passed, no output | passed, no output | 5 files, 78 tests, 1.73 s |
| 5 | passed, no output | passed, no output | 5 files, 78 tests, 1.26 s |

Escape hatches: a grep for `any`, ` as `, `!.`, `@ts-` and `eslint-disable` over `src` and `test`
returns only prose inside comments and test names. There are no casts, no non-null assertions and
no suppressions in the package.

### What the tests check

- **PRNG.** Pinned integer sequences, produced by a second, independent implementation of splitmix32
  and xoshiro128\*\* written from the published algorithms in a scratch file, not copied from the
  package. Plus property checks on range, distribution and immutability of the input state.
- **Primitives.** Properties rather than vertex data: every index addresses a vertex, every normal
  is unit length, the bounds contain every position, each triangle's normals agree with the
  direction its winding faces, and the enclosed volume by the divergence theorem matches the
  analytic volume. The cylinder is checked against the inscribed-prism volume at 3, 8 and 64
  segments and against pi r squared h at 256.
- **Building.** Same options give an equal result; different seeds differ; the revision follows the
  seed. One instance row per object in the same order; unique identities; every category present;
  every mesh index valid; storeys and rooms geometry-free and everything else drawn; mesh group
  counts add up; stack height matches the storey count. Schedule: one row per door; three facts per
  door; a width is never a number unless its state is `known` and is always NaN otherwise; every
  missing value has a reason and every conflict has its values; coverage agrees with the state
  columns; each width policy behaves as documented; clear width is always narrower than the nominal
  it came from; `gapScale` 0 leaves nothing unknown except what does not apply, and a higher
  `gapScale` opens more gaps. Rooms: one row each, positive areas, rooms that lost their storey link
  shown as unassigned in both the table and the object record, door counts summing to the schedule.
  Size: 10 storeys of 40 rooms in under 500 ms (actual, about 15 ms).
- **Stress.** Determinism both ways. Exactly the requested instances, all drawn, none dropped;
  exactly the requested meshes, all used; group counts summing to the instances; each instance an
  addressable object whose representation matches its instance row. Budget: the reported triangle
  count equals the count recomputed from the instance rows; it never exceeds the budget across three
  seeds by three budgets; a budget exactly equal to instances times the cheapest mesh is filled
  exactly, with the full instance count; a generous budget is more than half used, so the generator
  is not trivially passing by drawing the cheapest mesh throughout. Mix: all four classes appear,
  the per-instance column agrees with the tally, shares match the request to within a few per cent,
  only transparent instances are see-through, and a mix naming one class produces only that class.
  Size: the 10,000 instance, 10,000,000 triangle scene in under 3 s (actual, about 83 ms).

### Verification limits

- Byte-identical output across engines is argued from the implementation (32-bit integer arithmetic
  only, no transcendental functions, fixed palettes) and is not tested on a second engine. The tests
  prove determinism within one engine only.
- The performance numbers are from this machine under vitest, single-threaded, with no warm-up
  protocol. They establish that generation is not a bottleneck; they are not benchmark results.
- Nothing here has been rendered. Winding, normals and bounds are checked arithmetically, not
  visually, and no track has yet drawn a generated building.
- The building's plausibility is not tested, only its structure. Rooms are rectangles on a grid,
  doors are placed at fixed offsets in a wall rather than fitted into an opening, and no wall has a
  hole cut for its door or window. This is demonstration data for schedules and for counts, not a
  believable model of a building.
- The gap rates are checked as "greater than zero" on a large sample, not as distributions. A change
  that halved a rate would not fail a test.

## Remaining work

None in wave 0 scope. Wave 1 (track S2) adds the remaining generators: services, revisions,
quantities, costs, carbon, assets, clearances, city and field data.

Two things a later chunk should revisit:

- Doors and windows do not cut openings in their walls. A section or a clip plane will show that.
  Cutting openings needs either a boolean or a wall built from segments around each opening; the
  second is cheap and deterministic and is the one to do.
- `meshGroups` counts instances with a filter per mesh, which is O(meshes times instances). It is a
  few milliseconds of the stress scene's 83 ms at the default size and would matter at a hundred
  thousand instances.

## Blockers

None.

## Requests

To Track M:

- **A two-dimensional vector.** `Vec2 = readonly [number, number]`. Footprints, plan outlines and
  any two-dimensional layout need one; this package exports a local `Vec2` from `src/triangulate.ts`
  until the model has it. This is the only type this package needed and did not find.
- Not a request, but worth recording: `Mesh.normals` being optional means every caller that wants
  normals must narrow. This package's `ShadedMesh` intersection does that once. If most producers
  always emit normals, the model may prefer a required field and a separate positions-only type.

To the supervisor:

- No change is needed to `package.json`, `tsconfig.json`, `tsconfig.build.json` or
  `vitest.config.ts`. The package builds, lints and tests as they stand.

## Findings

- **The escape-hatch rule paid for itself once.** Adopting the model's `Mesh`, whose `normals` is
  optional, the obvious move is a cast in `build`. Being unable to cast forced the `ShadedMesh`
  intersection type instead, which is a better design: the guarantee is in the type, so every caller
  and every test reads `mesh.normals` without a check, rather than each one re-asserting it.
- **`noUncheckedIndexedAccess` costs a small `at()` helper in every file** that walks arrays. It is
  three lines and it has never been wrong; the alternative would be a non-null assertion at every
  index. Worth keeping.
- **The model's `Observation` type is the right shape for this data.** Three cases — known, missing
  with a reason, conflicting with the values — cover every gap this generator needed to express, and
  the split between `not-applicable` and `not-provided` is exactly the distinction the door schedule
  workflow has to show. No extension was needed.
- **A columnar table cannot carry an unknown by itself.** Six columns per observed field is verbose
  but it is the only honest rendering: value, unit, state, missing reason, conflict, evidence. Any
  consumer that reads only the value column will silently treat NaN as data, so the README says to
  test the state column first and the tests assert the value is NaN whenever the state is not
  `known`.
- **Reserving the budget forward is what makes the stress generator's guarantee simple.** Choosing a
  mesh only from those affordable after reserving the cheapest for every instance still to place
  makes "never exceeds the budget" and "never drops an instance" both true by construction, and the
  test that a tight budget is filled exactly is a one-liner. A greedy version would have needed a
  repair pass.

## Tooling

Tools run per check across the whole track. Wall times are single runs on this machine.

| Check | Runs | Wall time | Real defects caught | False positives or friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | ~14 | 6.7 s | 2. An unused `gapScale` parameter, which was a real bug — the mixed width policy was ignoring the option. And a stale re-export after `MeshGroup` moved between modules. | None. Every message was accurate and pointed at the line. | Helpful |
| `eslint` (typed, recommendedTypeChecked) | ~8 | 11.6 s | 0 | None, but it is the slowest check and it has not reported anything in this package at any point. Its value here is `no-explicit-any` and `no-floating-promises`, which the escape-hatch discipline and the absence of async code already cover. | Neutral |
| Escape-hatch rules (no `any`, `as`, `!`, `@ts-`, `eslint-disable`) | continuous, plus a grep per commit | under 1 s | 1, and it changed a design: see the first finding. Without it `build` would have carried a cast and `ShadedMesh` would not exist. | It forces `at()` helpers and explicit `undefined` checks where a cast would be shorter. That cost is real and it is small. | Helpful |
| `vitest` | ~12 | 0.8–1.7 s for 78 tests | 1, in a test rather than in the source: a gap-rate assertion on a sample of 85 doors that a sequence shift turned into a false failure. Fixed by asserting on a sample large enough that zero would mean the generator is wrong. | Fast, no flakiness once the sample sizes were right. The building and stress suites passed on first run, which says the invariants were designed in rather than discovered; their value is regression protection and executable documentation of the contract, not defect discovery today. | Helpful |

Note on the balance: `tsc` and the escape-hatch rule caught things; `eslint` did not, and it costs
more wall time than the other three together. If one check were to be dropped for this package,
`eslint` is the candidate — with the caveat that `no-floating-promises` will start to matter in
packages that do I/O, which this one never will.
