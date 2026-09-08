# @bim-open-toolkit/synthetic

Seeded generators for demonstration and test data: a pseudo-random generator, mesh primitives,
twelve generators covering the workflows in the product brief, and a catalog that builds any of
them by name.

| Generator | Produces | Read by |
|---|---|---|
| `building` | Storeys, rooms, walls, slabs, doors, windows, an optional roof and ceilings, and their schedules | Door schedule, fire-rating review, level navigation, hiding the roof to see inside |
| `services` | Pipe runs, valves, equipment, and connections nobody verified | Valve isolation trace |
| `revisions` | Two snapshots of one building with correspondence proposals | Revision comparison, linked views |
| `schedule` | Delivery, acceptance and installation events with dates and gaps | Delivery timeline, animation |
| `quantities` | Roof and finish faces with supplied measurements | Takeoff |
| `costs` | Scopes, rate sets, scenario policies, unpriced scopes | Pricing alternatives |
| `carbon` | Material quantities and factors with unit and scope mismatches | Material carbon heat map |
| `assets` | Equipment, service history and points of interest | Asset handover |
| `clearances` | Access envelopes and penetrations with candidate overlaps | Access coordination |
| `city` | Buildings with geographic anchors, and documents that are not buildings | Portfolio drill-through, maps |
| `field` | A scalar field sampled on a grid | Heat maps, voxel preview |
| `stress` | N instances across M meshes inside a triangle budget | Benchmarks |

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

## Table conventions

Every generator publishes `Table`s from `@bim-open-toolkit/model`: one typed array per column, one
scalar per cell. Three conventions follow from that and hold everywhere.

**An observed field is several columns.** A column of numbers cannot say "nobody measured this" or
"two sources disagree", so a field named `foo` becomes `foo` (the value), `fooUnit` for a quantity,
`fooState` (`known`, `missing` or `conflicting`), `fooMissingReason`, `fooConflict` (the disagreeing
values joined by ` vs `) and `fooEvidence` (the sources, `source (reference)` joined by `; `). Read
the state column, not the value: the value column is only meaningful where the state is `known`.

**An unknown number is NaN and an unknown string is empty.** Never zero, never a plausible default.
Where an identifier can be absent, a `<field>Known` boolean column sits beside it.

**A list lives in one cell.** `bIds` and `buildingIds` hold their ids separated by spaces, with a
count column beside them. Read them with `splitIds` and test the count column; the empty string is
no ids, not one empty id.

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

Dates are the ten characters `YYYY-MM-DD` and integer day numbers, converted by Howard Hinnant's
civil algorithms in `dates.ts`. `Date` is avoided: it carries a time zone and a time of day this
data does not have, and it would put a clock inside a function that must be a function of its seed.

Some gaps are drawn at a rate and some are structural — a fixed position in the sequence, so every
run exercises them. Where a generator's cases are structural its section says so, and `gapScale`
switches them off at 0 rather than scaling a rate.

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

// A closed building, for a demo that hides the roof and the ceilings to see inside.
const closed = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
```

| Option | Meaning |
|---|---|
| `seed` | Integer. Also becomes the model revision, `seed-7`, so two buildings are never confused. |
| `storeys` | Number of storeys, each repeating the same plan grid. |
| `roomsPerStorey` | Rooms per storey. The plan is a grid of `ceil(sqrt(n))` columns; cells past `n` are outside the building. |
| `doorWidthPolicy` | `nominal-only`, `nominal-and-clear` or `mixed`; see below. |
| `storeyHeight` | Metres. Storey elevation is the top of its slab. |
| `gapScale` | Multiplies every rate at which a value is missing or disputed. `0` gives a complete building; `1` gives the rates below. |
| `roof` | Optional, off by default. One `Roof` slab over the top storey. |
| `ceilings` | Optional, off by default. One `Ceiling` plate per storey. |

The frame is metres, z up, local — the model package's `metresZUpLocal`.

### What it produces

- `model`: a `ModelData` of `ObjectRecord`s with categories `Storey`, `Slab`, `Wall`, `Room`,
  `Door` and `Window`, and `Roof` and `Ceiling` when they are asked for. Rooms are parented to their
  storey, doors to their room, everything else to its storey.
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

### The roof and the ceilings

A viewer that shows the inside of a building has to take something off it first. `roof: true` adds
one `Roof`, `ceilings: true` adds one `Ceiling` per storey, and a demo hides those two categories.

| Element | Where it is |
|---|---|
| `Roof`, object id `roof`, parented to the top storey | The plan extent by `slabThickness` (0.25 m), in the place the floor slab of one more storey would have occupied, so it rests on the top storey's walls. |
| `Ceiling`, object ids `ceiling-1` up, each parented to its storey | A 0.03 m plate against the underside of the slab above, or of the roof on the top storey, inset by half the exterior wall thickness on each side so it stops at the inner wall face rather than at the plan extent. It clears the 2.1 m doors below it. |

Both are off unless asked for, and both are emitted after everything else and draw no random
numbers, so a building that asks for them is byte-identical to the one that does not, plus these
objects. Each gets its own mesh group, `roof-slab` and `ceiling-panel`, appended after the window
meshes, so the mesh indices of a building without them never move.

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

## `services` — pipe runs, valves, equipment and the connections nobody verified

```ts
import { generateServices, defaultServicesOptions } from '@bim-open-toolkit/synthetic';

const network = generateServices({ ...defaultServicesOptions, seed: 4, storeys: 6 });
```

A riser off a plant room with `branchesPerStorey` branches on each storey, every run axis aligned.
Pipes are one unit cylinder scaled to a run; valves, the pump and terminal units are their own
meshes placed by translation.

| Table | Columns |
|---|---|
| `nodes` | `nodeId`, `kind`, `x`, `y`, `z` |
| `segments` | `objectId`, `fromNodeId`, `toNodeId`, `topologyStatus`, `system`, `lengthM`, and the six `diameter` columns |
| `valves` | `objectId`, `name`, `nodeId`, `nodeIdKnown`, `valveType` |
| `equipment` | `objectId`, `name`, `nodeId`, `category`, `categoryKnown` |

`startNodeId` and `closedValveIds` are one trace worth running: the terminal of the top storey's
first branch, with that branch's isolation valve closed.

| Gap | Rate | Reason it exists |
|---|---|---|
| `topologyStatus` is `unverified` | `unverifiedRate` on branch runs | A trace must leave an unverified connection out of its affected set and report it as a coverage gap at the boundary. The riser is always accepted, so a trace has something to walk. |
| `diameter` conflicting | 5% | The design model and the as-built survey disagree. |
| `diameter` missing, `not-provided` | 8% | Never scheduled. |
| Valve with no `nodeId` | 8% | Nobody recorded where the valve is, so it cannot block anything. `nodeIdKnown` is false and `nodeId` is `''`. |
| Equipment with no category | 10% | The schedule has to show it as unclassified. |

## `revisions` — two snapshots and the proposals between them

```ts
import { generateRevisions, defaultRevisionsOptions } from '@bim-open-toolkit/synthetic';

const pair = generateRevisions(defaultRevisionsOptions);
```

`before` is exactly what `generateBuilding` produces for `options.building`. `after` is derived from
it, keeping the model id and taking a new revision, which is how `identity.ts` models the same
object at two revisions. Its object ids are nonetheless disjoint from A's — every id gains a `-b`
suffix — because a comparison that could match by id would not exercise the correspondence table.

`objectsA` and `objectsB` carry `objectId`, `name`, `nameKnown`, `category`, `categoryKnown` and the
position `x`, `y`, `z`, so a move is visible without a precomputed answer column.
`correspondences` carries `id`, `aId`, `aIdKnown`, `bIds`, `candidateCount`, `basis`, `confidence`
and `confidenceKnown`. `bIds` is a space-separated list in one cell; read it with `splitIds` and
test `candidateCount`, never the string.

| Case | Rate | What it forces |
|---|---|---|
| Renamed | `renameRate` | A match that is not an addition and a deletion. |
| Recategorized | `recategorizeRate` | The same, on the category axis. |
| Moved | `moveRate` | A change no name or category comparison can see. |
| Deleted | `deleteRate` | `bIds` empty: no candidate in B. |
| Added | `additions` | `aIdKnown` false: no candidate in A. |
| Ambiguous | `ambiguousRate` | An element split in two: `candidateCount` is 2 and neither is chosen. |
| Duplicated | exactly one | One object of A named by two separate proposals, the other way a match goes unresolved. |
| Confidence not recorded | 6% | `confidence` is NaN beside `confidenceKnown`, never 0. |

`changeCounts` reports how many of each the generator produced. It is a summary for a reader and a
test, not an input column: a comparison that read the answer would prove nothing.

## `schedule` — delivery, acceptance and installation

```ts
import { generateDeliverySchedule, defaultDeliveryOptions } from '@bim-open-toolkit/synthetic';

const record = generateDeliverySchedule({ ...defaultDeliveryOptions, asOfDate: '2026-07-01' });
```

The module is `deliveries.ts`, because `schedule.ts` is the helper that turns observations into
schedule columns. The catalog name is `schedule`, which is what the plan calls it.

`objects` carries `objectId`, `name`, `category`; `events` carries `id`, `objectId`, `eventType` and
the five `date` columns. Every item is drawn as a crate in a laydown area, so a timeline has
something to colour.

| Case | Rate | Reason it exists |
|---|---|---|
| No events at all | 6% | "Nothing recorded yet" is not "delivered". |
| Delivered, accepted or installed absent | 10%, 25%, 45% | Progress, not a gap: an item that is not installed yet is not missing data. `gapScale` does not remove these. |
| `date` missing, `not-provided` | 6% | The event happened; nobody wrote down when. It cannot rank the item. |
| `date` conflicting | 7% | The delivery note and the site record differ by three days. |
| Event dated after `asOfDate` | window | Normal timeline behaviour, not an exception. |

Acceptance always postdates delivery and installation always postdates acceptance, so a workflow
that ranks the three states can be checked against the dates.

## `quantities` — roof and finish faces

```ts
import { generateQuantities, defaultQuantityOptions } from '@bim-open-toolkit/synthetic';

const takeoff = generateQuantities(defaultQuantityOptions);
```

`surfaces` carries `objectId`, `roomId`, `roomIdKnown`, `scope` (`room-finish` or `roof`), `basis`,
the five `finishType` columns and the six `areaM2` columns. Each face is drawn as one unit plane
scaled to its size.

The area is a supplied measurement drawn separately from the face's geometry and differing from it
by a few per cent, the way a measurement taken to the finish face differs from a model face. A
takeoff that computed area from the mesh would disagree with the table, which is what makes the
rule testable.

| Gap | Rate | Reason it exists |
|---|---|---|
| `finishType` missing, `not-provided` | 8% | An unassigned face contributes to no subtotal. |
| `finishType` conflicting | 5% | Two candidate finishes, always two different ones. |
| `areaM2` missing, `not-measured` | 7% | No usable number, so no subtotal and no zero. |
| `areaM2` conflicting | 5% | Two surveys disagree. |
| Finish face with no room | 3% | The face is not attributable to a room subtotal. |
| Roof face with no room | policy | A roof belongs to the building. `gapScale` does not change it. |

## `costs` — scopes, rates, scenarios

```ts
import { generateCosts, defaultCostOptions } from '@bim-open-toolkit/synthetic';

const pricing = generateCosts(defaultCostOptions);
```

`scopes` carries `objectId`, `scopeType`, `description` and the six `quantity` columns; `rates`
carries `id`, `scopeType`, `scenario`, `currency`, `unit`, `ratePerUnit`; `scenarios` carries `id`,
`name`, `currency`, `policy`.

Which cases exist is structural rather than drawn, so an adapter that dropped one would fail on
every seed rather than on some:

- **Steelwork is priced by nobody**, in any scenario. Unpriced, reason `not-provided`.
- **Paint is priced in the base scenario only.** The same scope is priced in one scenario and not in
  another, which is the point of scenarios.
- **The alternate carpet rate is quoted per `ea`** against a quantity in `m2`. A usable rate exists
  and still does not apply: unpriced, reason `unresolved-source`, never converted.
- **The value scenario is quoted in EUR.** A total that added scenarios together would be wrong in a
  way a reader can see.
- **The value scenario quotes Doors twice.** Two rates match one scope, which W0's contract left as
  an open question; the fixture exercises it so the answer can be tested rather than assumed.
- **Quantities**: every fifth scope is disputed and every fifth is unmeasured, by position.

`gapScale` switches the quantity gaps off at 0. It does not remove the absent rates: what a rate
set does not cover is a fact about the rate set.

## `carbon` — material quantities and factors

```ts
import { generateCarbon, defaultCarbonOptions } from '@bim-open-toolkit/synthetic';

const carbon = generateCarbon({ ...defaultCarbonOptions, requestedLifecycleScope: 'A1-A3' });
```

`quantities` carries `objectId`, `materialId`, `materialName` and the six `quantity` columns;
`factors` carries `id`, `materialId`, `scenario`, `unit`, `lifecycleScope`, `factorValue`.

- **Timber has no factor at all**, in either scenario: unresolved, `not-provided`.
- **The as-designed steel factor covers `A1-A5`** when `A1-A3` was requested: unresolved,
  `unresolved-source`.
- **The low-carbon steel factor is quoted per tonne** against a quantity in kilogrammes: the same
  reason, a different mismatch. Neither is converted.
- **Aluminium has a factor in the as-designed scenario only.**
- **Quantities**: every fifth object is disputed and every fifth is missing, by position.

## `assets` — handover and maintenance

```ts
import { generateAssets, defaultAssetOptions } from '@bim-open-toolkit/synthetic';

const handover = generateAssets(defaultAssetOptions);
```

`assets` carries `objectId`, `name`, `category` and the five `installDate` columns;
`maintenanceEvents` carries `id`, `assetId`, `date`, `note`; `serviceHistoryStatus` carries
`assetId`, `status` and `tracked`; `pointsOfInterest` carries `id`, `assetId`, `name`, `note` and
`x`, `y`, `z`.

The register of what is tracked is a separate table from the events, because the same zero events
means two different things. The first five assets carry the cases a handover has to tell apart:

| Asset | Service history | Events | Install date |
|---|---|---|---|
| 1 | recorded | 3 | known |
| 2 | recorded | 0 | known — a genuine, tracked zero, not an exception |
| 3 | **not recorded** | 0 | known — never tracked, which is an exception |
| 4 | recorded | 2 | **missing**, `not-provided` |
| 5 | recorded | 1 | **conflicting** — commissioning record and manual differ by three weeks |

A recorded maintenance event always has a date: the row exists because somebody wrote it down.

## `clearances` — envelopes, penetrations and candidates

```ts
import { generateClearances, defaultClearanceOptions } from '@bim-open-toolkit/synthetic';

const coordination = generateClearances(defaultClearanceOptions);
```

`envelopes` and `penetrations` carry the same columns: `objectId`, `name`, `discipline`, the six box
columns `minX` to `maxZ`, and `bboxState`, `bboxMissingReason`, `bboxConflict`, `bboxEvidence`.
`coordinates` is the frame both report in, registered to the project; a comparison between boxes in
different frames is meaningless, so the frame is stated rather than assumed.

Every other penetration is placed inside an access envelope, so a candidate overlap is structural
rather than a matter of which numbers came up. `candidateOverlaps` reports how many pairs overlap
on all three axes, for a test to check an adapter against.

- **One envelope was never registered.** `bboxState` is `missing` and its six box columns are NaN.
  It cannot be tested, and it is not "no overlap".
- **One penetration was surveyed twice** and the two boxes disagree. `bboxState` is `conflicting`,
  `bboxConflict` shows both boxes, and the numeric columns are NaN. It would otherwise have been a
  candidate, so a review can neither report it nor clear it.

A box is not a `FactValue` in model revision M1, so these tables carry the observation state in
columns rather than as a `Fact`. See the track checkpoint.

## `city` — buildings, anchors and documents

```ts
import { generateCity, defaultCityOptions } from '@bim-open-toolkit/synthetic';

const portfolio = generateCity({ ...defaultCityOptions, sites: 3 });
```

`buildings` carries `buildingId`, `name`, `siteId`, `registration`, `registered`, `latitude`,
`longitude`, `altitude`, `trueNorthDegrees`. `anchors` is the same information as one
`CoordinateContext` per building, which is what a map reads: the model's own frame places every
building in one local site plan, while each building is registered on its own.

`documents` carries `documentId`, `name`, `buildingIds` (a space-separated list in one cell) and
`buildingIdCount`. `metrics` carries `id`, `documentId`, `metricName` and the six `value` columns.

- **One building was never surveyed.** Its registration is `unknown` and its latitude is NaN. A map
  has to leave it off rather than place it at the origin.
- **One document per site names two buildings.** Its figures cannot be attributed to either.
- **One document names none.** Nobody has mapped it to a building yet.
- **Every figure reported about the last site is disputed or absent**, so the site has no resolved
  contributor and a rollup for it has to be left out rather than reported as zero.

## `field` — a sampled scalar field

```ts
import { generateField, defaultFieldOptions, cellIndex } from '@bim-open-toolkit/synthetic';

const field = generateField(defaultFieldOptions);
const middle = field.values[cellIndex(field.dimensions, 12, 8, 3)];
```

`values` is one `Float32Array` in x-fastest order: `index = x + nx * (y + ny * z)`. `dimensions`,
`spacing` and `origin` say where each cell is; `bounds` is the box the samples occupy, which is what
a voxel preview needs before any mesh exists. `sampled`, `minimum`, `maximum` and `mean` are over
the sampled cells only.

An unsampled cell is NaN, never zero: a heat map that painted an unsampled cell at the bottom of its
colour scale would be inventing a cold spot. A quarter of the plate on the lowest two levels was
never covered at all, so the map has a hole in it rather than a cold corner, and
`unsampledRate` scatters further dropouts.

The value is a sum of four sources with a quadratic falloff plus a vertical gradient. That shape is
arbitrary; what matters is that it uses multiplication and division only, so the field is
bit-identical on every engine, which a field built out of sines would not be.

## The catalog

```ts
import { fixture, fixtureNames, summaryOf } from '@bim-open-toolkit/synthetic';

const services = fixture('services');
const rows = summaryOf('city').tables;
```

`fixtures` holds one function per generator, so asking for one fixture never builds the others.
`fixture(name)` builds one; `fixtureNames` lists them in the order a gallery shows them. A generator
may have more than one entry where a demo wants a variant by name: `buildingWithRoof` is the default
building with `roof` and `ceilings` on, which is what a demo opens to remove them.

`summaryOf(name)` reduces any fixture to the same shape — objects drawn, mesh library, facts
recorded, tables published, and a few generator-specific numbers — which is what a gallery lists and
what the snapshot test compares. Adding a generator is one entry in the catalog and no change
anywhere else.

## Snapshots

`test/snapshots/*.json` holds the summary of every default fixture, one line per column.
`test/fixtures.test.ts` regenerates them and compares, so a change to a generator shows up in review
as a diff of the columns it changed. A number JSON cannot hold is written as text: `"NaN"`, not
`null` and not `0`, because reporting an unknown number as nothing is the mistake these fixtures
exist to catch.

To accept a deliberate change:

```
SYNTHETIC_UPDATE_SNAPSHOTS=1 npm test -w @bim-open-toolkit/synthetic
```

then read the diff before committing it.

## Labelling

Data from this package is synthetic. Anything shown from it should say so. It preserves realistic
material and instance diversity but it is not a substitute for a real source model, and its
quantities are not measurements of anything.
