# Point and read

**What is this object, and what do we actually know about it?**

Move the pointer over the building and the object under it is marked and named. Click and the demo
pins it, so the tag and the sidebar stay on that object while the pointer moves on. Click where
there is nothing and the pin is dropped.

## The data

Two fixtures. The first, and the default, is source-backed; the second is generated.

**Snowdon Towers** (`/fixtures/snowdon.bfast`, read from wherever the machine keeps its models).
25,675 objects, 171,569 meshes and 471,462 placements, of which 14,864 are marked hidden in the
file. That is everything the file carries. It has no embedded BOS tables, so the loader reports
"This BFAST carries no BOS tables, so its objects come from its instance records only", and each
object arrives as an id (`bos:1165`), a transform and the placements that draw it - no name, no
category, no source id, no parent link, and no observations of any kind. The demo shows exactly
that: the tag reads "No name recorded (bos:1165)" over "No category recorded, no storey link
recorded", the identity group gives three missing rows and the object id, and the facts group is
titled "Facts: none recorded" with nothing under it. Nothing is inferred to fill a gap - not a
category from a mesh, not a storey from an elevation.

What the demo can read from that file is geometric, and it does: each object's box comes from the
meshes its placements draw, which is what the tag anchors to and what a colouring or a fit uses.

The sibling export `snowdon-bim.bfast` does carry the BOS tables - 51,139 objects, 48,844 of them
named, 98 categories including 1,348 Walls, 167 Doors and 92 Levels - and pointing this demo at it
would give the identity group something to say. It still records no parent link and no observations,
so the storey row and the facts group would stay empty. Which file `/fixtures/snowdon.bfast` names is
`demos/src/demos/_shared/snowdon.ts`, not this demo.

**Synthetic building.** From `@bim-open-toolkit/synthetic`, generated with the generator's own
default options: seed 1, three storeys of eight rooms, the mixed door-width policy, and the
documented rates at which a value is missing or disputed. 150 objects: 3 storeys, 3 slabs, 66 walls,
24 rooms, 29 doors and 25 windows. Five of them carry no recorded name. The generator records three
facts about each door, 87 in all: 47 are known, 36 are missing and 4 have sources that disagree. The
fire rating alone is known for 11 doors, missing for 16 and disputed for 2. It is the second fixture
because it is the one with facts, storey links and deliberate conflicts to point at, and this demo is
about what is known.

## The widget

A tag anchored to the centre of the object's box, drawn on its own Gratify canvas. It shows the
object's name, its category, the storey it belongs to, and whether it is pinned. An object with no
recorded name says so and prints its id instead of borrowing its category; an object with no storey
link says that too.

## The inspector

Two groups. **Identity** is what the model itself records: category, name, storey and object id,
each shown as known or as missing with the reason. **Facts** is every observation recorded about that
object, one row each, in the state the data leaves it in:

- a known value with its unit and the sources that back it;
- a missing value with the reason from the data - not provided, not applicable, not measured,
  unresolved source, or out of scope - and no substitute value;
- a conflicting value listing every reading the sources gave, joined by "vs", with no winner picked.

A door on an unrated partition has no fire rating to record. That reads as missing for the reason
"not applicable", which is a different answer from a rating nobody entered, and the sheet keeps the
two apart.

## Limitations

- No format the loaders read carries observations, so a model read from a file has no facts and the
  demo shows none. The generated building is the only fixture here with any.
- A storey is read by walking parent links to an object recorded as one. No loaded model records a
  parent link today, so on Snowdon nothing is linked to a storey and every storey row is missing.
  An elevation would let one be guessed; guessing is not what this demo does.
- The generator cuts no openings, so a door leaf sits entirely inside its wall. The demo hides the
  walls as it opens, through one style rule over every object recorded under `Wall` or `Walls` -
  all 66 in the generated building, none at all in a model that records no category. Slabs stay, so
  the storeys remain readable.
- Pointing writes the selection, so the object under the pointer is also the marked object. There is
  no separate hover state in the features yet.
- The tag has no leader line and no callout shape: it is built from Gratify's `Stack` and `Label`
  until Track UG's `Tag` widget lands.
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
runs on the generated building.
