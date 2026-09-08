# Point and read

**What is this object, and what do we actually know about it?**

Move the pointer over the building and the object under it is marked and named. Click and the demo
pins it, so the tag and the sidebar stay on that object while the pointer moves on. Click where
there is nothing and the pin is dropped.

## The data

Two fixtures. The first, and the default, is source-backed; the second is generated.

**Snowdon Towers** (`/fixtures/snowdon-bim.bfast`, read from wherever the machine keeps its models).
51,139 objects, 471,462 placements and 6,250,792 triangles. It carries the BOS tables, so it records
far more than geometry: 48,844 of its objects are named, in 98 categories including 1,348 Walls; its
parameter table is 1,620,524 rows over 2,545 descriptors, none of them dropped; and every one of the
51,139 objects is attributed to one of seven source documents - Architectural, Facades, Structural,
Plumbing, HVAC, Site and Electrical, each with the path of the `.rvt` it was exported from.

Every object carries a property sheet: between three and a hundred and twenty properties, thirty-two
on average. The demo shows them in the groups the file puts them in - `Dimensions`, `Constraints`,
`Identity Data`, `RevitAPI`, `Electrical - Loads` and the rest - in the order the file records them.
Picking the wall `bos:1165` gives 44 properties in 9 groups: `Area` reads `465.619 SQUARE_FEET` and
`Volume` reads `525.759 CUBIC_FEET`, both in the unit the exporter wrote and neither converted.

**Synthetic building.** From `@bim-open-toolkit/synthetic`, generated with the generator's own
default options: seed 1, three storeys of eight rooms, the mixed door-width policy, and the
documented rates at which a value is missing or disputed. 150 objects: 3 storeys, 3 slabs, 66 walls,
24 rooms, 29 doors and 25 windows. Five of them carry no recorded name. It records no properties and
no source documents at all, so the demo shows neither for it. What it does record, and what no file
the loaders read records, is 87 observations about its doors: 47 known, 36 missing and 4 whose
sources disagree. That is why it is still the second fixture - it is the only one with the
known/missing/conflicting states to point at.

## The widget

A tag anchored to the centre of the object's box, drawn on its own Gratify canvas. It shows the
object's name, its category and the storey it belongs to, and whether it is pinned. An object with no
recorded name says so and prints its id instead of borrowing its category; an object with no storey
link says that too.

## The inspector

Four kinds of group, and a sheet only shows the ones the model has something to put in.

**Identity** is what the object record itself says: category, name, storey and object id, each known
or missing with the reason.

**Source** is which of the file's documents the object came from, and the path that document was
exported from. Absent for a model that names no documents.

**Facts** is every observation recorded about the object - the known/missing/conflicting vocabulary -
one row each:

- a known value with its unit and the sources that back it;
- a missing value with the reason from the data - not provided, not applicable, not measured,
  unresolved source, or out of scope - and no substitute value;
- a conflicting value listing every reading the sources gave, joined by "vs", with no winner picked.

A door on an unrated partition has no fire rating to record. That reads as missing for the reason
"not applicable", which is a different answer from a rating nobody entered, and the sheet keeps the
two apart. When there are none, the group's title says which kind of nothing it is: *none recorded
for this object*, or *this file records no observations*, which is what a BOS export earns - it has a
million and a half properties and not one observation, and those are different things.

**One group per property group the file records**, in the file's own order. Every kind of value the
tables hold has its own answer, and every one of them that carries no value says so with the reason
its encoding gives rather than showing zero or an empty cell:

- a number or an integer, printed to six significant figures with the unit exactly as recorded -
  `SQUARE_FEET` stays `SQUARE_FEET`, `FEET_AND_FRACTIONAL_INCHES` stays that. Nothing is converted,
  because a converted number that has lost the name it was recorded in cannot be checked;
- a string, or *recorded, with no text written in it* where the exporter pooled the empty string;
- an entity, which is a reference to another object of the same model. It reads as that object's
  name, with its object id kept as the evidence line - `Base Constraint` on `bos:1165` reads
  `L1 - Block 35`, evidenced `references bos:1057 (Levels)`. The row number the file actually holds
  is never printed as if it were a value, and the `-1` an exporter writes for a property that
  references nothing reads as *recorded as a reference to nothing*;
- a point, as its three coordinates in the file's own coordinates;
- anything else as *recorded under a value kind this reader does not know*.

The subtitle counts what is there: "44 properties in 9 groups".

### Where a storey comes from

Three things in the file can say which storey an object sits on, and the sheet names which one
answered, as the evidence line under the value.

A **parent link** is the model saying so directly. A **recorded level** is the `Rvt:Element:Level`
property, an entity value naming the level object; 17,106 of Snowdon's objects carry one and every
one of them resolves to an object recorded under `Levels`. A storey object is its own storey, and
that reads as *found by being a storey itself*. An object that carries none of the three reads as
*no storey link recorded* - 33,941 of Snowdon's do - and no level is guessed from an elevation.

## Limitations

- No format the loaders read carries observations, so a model read from a file has no facts. It has
  properties, which are a different thing and are shown as one: a property is a value somebody
  recorded, with no statement about whether it was measured, disputed or left out.
- A number is printed to six significant figures, which is more than the `float32` the file stores
  carries. That is a rounding for the eye and the only one on the sheet; the unit and the scale are
  untouched.
- A long unit name can run past the right edge of the inspector column - `FEET_AND_FRACTIONAL_INCHES`
  does at the default width. The value is drawn in full and the unit is clipped rather than
  abbreviated, because abbreviating it would be inventing a unit name the file does not use. Widening
  or wrapping that column belongs to `ui-gratify`'s inspector, not to this demo.
- The generator cuts no openings, so a door leaf sits entirely inside its wall. The demo hides the
  walls as it opens, through one style rule over every object recorded under `Wall` or `Walls` - all
  66 in the generated building, 1,348 on Snowdon. Slabs stay, so the storeys remain readable.
- Pointing writes the selection, so the object under the pointer is also the marked object. There is
  no separate hover state in the features yet.
- A reference row names the object it points at but does not pin it when clicked. Making the row an
  action would give the sheet a fresh input object after every change event, which is what the
  inspector compares to decide whether to keep the scroll position and the opened rows.
- Objects that draw no geometry have no box, so their tag anchors at the point their transform
  places them.

## Reset

Disposing the demo removes the wall-hiding rule and clears every named set, the selection and the
isolation, which puts the scene back to the appearance the model was opened with, and forgets the
model's derivations so the page does not keep a hundred megabytes alive behind a gallery it has left.

## Verification

From `viewer/`:

```
npx vitest run --root packages/demos test/demos/point-and-read
```

The block that reads the real file is skipped when the file is not on the machine; everything else
runs on the generated building, with the parameter tables built by hand through the loader's own
decoder in `test/demos/point-and-read/properties-fixture.ts`.

In the browser, from `viewer/`:

```
node packages/demos/scripts/.check.mjs point-and-read out.png
```

which prints `report()`. On the real model it reads `properties: 1620524`, `propertyDescriptors:
2545`, `propertiesDropped: 0`, `documents: 7`, `storeyLinks: 17198` and `facts: 0`, and once an
object is picked it also reports `shownProperties`, `shownPropertyGroups`, `shownDocument`,
`shownStorey`, `shownStoreyVia` and `shownQuantity` - one real reading with its real unit, so the
smoke records a value and not only a count.
