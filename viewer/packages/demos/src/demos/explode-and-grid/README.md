# Explode and grid

**Question.** Pull it apart so I can see every part.

**Basis.** Mixed. The default fixture is Snowdon Towers, read from `snowdon.bfast` by the dev server;
the second is the `building` fixture from `@bim-open-toolkit/synthetic`, generated from a fixed seed:
three storeys of rooms, walls, doors and windows, with enough storeys and categories for both kinds
of explode to have something to separate.

**What the widget shows.** A bar along the bottom edge of the viewport. A pair of chips chooses what an
explode separates, Storey or Category; a slider from 0 to 2 sets how strong the separation is; a line
under them says how many of the model's objects the layout in force actually moves; a Grid button
arranges every object on a grid in the ground plane; a Reset button puts everything back. Moving the
slider or choosing a separator dispatches `layouts.explode` with the chosen values, so the model
redraws as the pointer moves. The bar never remembers a strength it did not actually apply: `sync` reads
the applied explode's `by` and `strength` back out of the layouts slice after every change, so a layout
set by a saved scene or a script shows here too. Grid and Reset carry no separator or strength of their
own, so after either one the bar keeps offering what was last asked for, ready to explode again.

**What the inspector shows.** First what the open model offers a layout — how many objects it has, how
many storeys and categories it records, and how many distinct placements its object records carry.
Then the layout in force. For an explode: which separator, its strength, and one row on how the offset
is computed — one average storey height per storey per unit of strength for Storey, the model's own
ground radius per unit of strength for Category, categories taken in name order. For a grid: spacing,
columns and how many objects are arranged. A spacing or column count of zero is shown as missing with
the reason, because zero means render chooses it from the model rather than a number somebody set;
printing it as `0` would claim a choice nobody made. Last, how many objects the layout moved, and when
the model is one no layout can do anything useful with, a row saying why.

**What the real model does to this demo.** Snowdon Towers, as `snowdon.bfast`, carries none of what a
layout needs. It is 25,675 objects with no names, no categories and no storeys: the file has no BOS
tables at all, which `formats` reports as `formats/missing-entity-table` when it loads. More decisive,
a prepared BFAST keeps every placement in its instance table and gives each object record the identity
transform, so `placementsOf` reads 25,675 objects at one point. That defeats both separators —
`storeyExplodeOffsets` finds no storeys and `categoryExplodeOffsets` finds one category, and both need
at least two — and it makes a grid an arrangement in file order rather than by where anything is. So on
the real model the demo opens with a storey explode that moves nothing, and says so: the bar reads
"Moves 0 of 25675 objects", the inspector gives the count of storeys, categories and placements it
found, and the report carries `moved: 0` with the reason. Choose the generated building in the fixture
picker to see the layouts do their work. The larger export, `snowdon-bim.bfast`, does carry the BIM
tables (51,139 objects, 98 categories) and would give the Category separator something to fan, but its
object records are identity too, so its category fan is computed against a zero-size footprint.

**A layout is parameters only.** `layouts.explode` and `layouts.grid` never rewrite an object's own
transform; they write a strength, a separator or a spacing into the layouts slice, and the render side
turns that into an offset every frame. That is what makes `layouts.reset` an exact undo rather than a
best effort, and it is also why a storey explode has nothing to move on a model with only one storey:
there is no separation between one thing and itself.

**Limitations.**

- The separator chip and the strength slider are parts defined in `panels.ts` because ui-gratify's
  `Segmented` and `Slider` have not been published. `Grid` and `Reset` already use the published
  `Button`; when `Segmented` and `Slider` land, the two local parts go and the bar keeps its shape.
- Nothing here draws. The layouts feature's own hook applies the parameters to the instance buffers;
  this demo only chooses them, which is why the whole demo tests in Node.
- The demo cannot make the real model explode. Layouts read object transforms, and a prepared BFAST
  puts its placements in the instance table; until `layouts.ts` derives a placement from the instance
  rows of an object, or `formats` fills in object transforms, the honest reporting above is all this
  demo can show on Snowdon.

**Reset.** Disposing what `start` returns dispatches `layouts.reset`, which puts every object back
exactly where the model placed it, and releases the survey it took when it started.

**Verification.**

```
npx vitest run --root packages/demos test/demos/explode-and-grid
```

The one test that reads `snowdon.bfast` skips itself when the file is not on the machine; the file is
private and a hundred megabytes, so it is never committed.
