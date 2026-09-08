# Explode and grid

**Question.** Pull it apart so I can see every part.

**Basis.** Synthetic. The model is the `building` fixture from `@bim-open-toolkit/synthetic`, generated
from a fixed seed: three storeys of rooms, walls, doors and windows, enough storeys and categories for
both kinds of explode to have something to separate.

**What the widget shows.** A bar along the bottom edge of the viewport. A pair of chips chooses what an
explode separates, Storey or Category; a slider from 0 to 2 sets how strong the separation is; a Grid
button arranges every object on a grid in the ground plane; a Reset button puts everything back. Moving
the slider or choosing a separator dispatches `layouts.explode` with the chosen values, so the model
redraws as the pointer moves. The bar never remembers a strength it did not actually apply: `sync` reads
the applied explode's `by` and `strength` back out of the layouts slice after every change, so a layout
set by a saved scene or a script shows here too. Grid and Reset carry no separator or strength of their
own, so after either one the bar keeps offering what was last asked for, ready to explode again.

**What the inspector shows.** The layout in force. For an explode: which separator, its strength, and
one row on how the offset is computed — one average storey height per storey per unit of strength for
Storey, the model's own ground radius per unit of strength for Category, categories taken in name order.
For a grid: spacing, columns and how many objects are arranged. A spacing or column count of zero is
shown as missing with the reason, because zero means render chooses it from the model rather than a
number somebody set; printing it as `0` would claim a choice nobody made.

**A layout is parameters only.** `layouts.explode` and `layouts.grid` never rewrite an object's own
transform; they write a strength, a separator or a spacing into the layouts slice, and the render side
turns that into an offset every frame. That is what makes `layouts.reset` an exact undo rather than a
best effort, and it is also why a storey explode has nothing to move on a model with only one storey:
there is no separation between one thing and itself. The synthetic building has three, so this demo
never shows that case; a single-storey model would open already at rest under the Storey separator.

**Limitations.**

- The separator chip and the strength slider are parts defined in `panels.ts` because ui-gratify's
  `Segmented` and `Slider` have not been published. `Grid` and `Reset` already use the published
  `Button`; when `Segmented` and `Slider` land, the two local parts go and the bar keeps its shape.
- Nothing here draws. The layouts feature's own hook applies the parameters to the instance buffers;
  this demo only chooses them, which is why the whole demo tests in Node.

**Reset.** Disposing what `start` returns dispatches `layouts.reset`, which puts every object back
exactly where the model placed it.

**Verification.**

```
npx vitest run --root packages/demos test/demos/explode-and-grid
```
