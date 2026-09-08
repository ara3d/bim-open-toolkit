# Point and read

**What is this object, and what do we actually know about it?**

Move the pointer over the building and the object under it is marked and named. Click and the demo
pins it, so the tag and the sidebar stay on that object while the pointer moves on. Click where
there is nothing and the pin is dropped.

## The data

Synthetic. The building comes from `@bim-open-toolkit/synthetic`, generated with the generator's own
default options: seed 1, three storeys of eight rooms, the mixed door-width policy, and the
documented rates at which a value is missing or disputed. Nothing here is measured from a real
building, and nothing is loaded from a file.

The generated building has 150 objects: 3 storeys, 3 slabs, 66 walls, 24 rooms, 29 doors and 25
windows. Five of them carry no recorded name. The generator records three facts about each door,
87 in all: 47 are known, 36 are missing and 4 have sources that disagree. The fire rating alone is
known for 11 doors, missing for 16 and disputed for 2.

## The widget

A tag anchored to the centre of the object's box, drawn on its own Gratify canvas. It shows the
object's name, its category, the storey it belongs to, and whether it is pinned. An object with no
recorded name says so and prints its id instead of borrowing its category; an object with no storey
link says that too.

## The inspector

Two groups. **Identity** is what the model itself records: category, name, storey and object id,
each shown as known or as missing with the reason. **Facts** is every observation the generator
recorded about that object, one row each, in the state the data leaves it in:

- a known value with its unit and the sources that back it;
- a missing value with the reason from the data - not provided, not applicable, not measured,
  unresolved source, or out of scope - and no substitute value;
- a conflicting value listing every reading the sources gave, joined by "vs", with no winner picked.

A door on an unrated partition has no fire rating to record. That reads as missing for the reason
"not applicable", which is a different answer from a rating nobody entered, and the sheet keeps the
two apart.

## Limitations

- The generator cuts no openings, so a door leaf sits entirely inside its wall. The demo hides all
  66 walls as it opens, through one style rule, or none of the doors could be seen. Slabs stay, so
  the storeys remain readable.
- Pointing writes the selection, so the object under the pointer is also the marked object. There is
  no separate hover state in the features yet.
- The tag has no leader line and no callout shape: it is built from Gratify's `Stack` and `Label`
  until Track UG's `Tag` widget lands.
- Objects that draw no geometry - storeys and rooms - have no box, so their tag anchors at the point
  their transform places them.

## Reset

Disposing the demo removes the wall-hiding rule and clears every named set, the selection and the
isolation, which puts the scene back to the appearance the model was generated with.

## Verification

From `viewer/`:

```
npx vitest run --root packages/demos test/demos/point-and-read
```
