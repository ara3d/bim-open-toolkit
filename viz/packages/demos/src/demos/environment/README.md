# Environment

**Question.** Make it readable: light, ground, grid.

**Basis.** Synthetic. The model is the `building` fixture from `@bim-open-toolkit/synthetic`, generated
from a fixed seed. Nothing here comes from a real project, and no lighting value claims to match a
real one; the presets are review settings, not a physical simulation.

**What the widget shows.** A row of four buttons in the top-left of the viewport: Studio, Overcast,
Night, Plan. Pressing one sets the whole environment — background, sky and sun, grid, ground plane,
axes and the up axis — through the `environment.set` command. The row does not remember what it set:
it reads the settings back out of the environment slice after every change, so a preset applied by a
saved scene, a script or an assistant shows here as well. Settings that match no preset read
`Custom`.

**What the inspector shows.** The preset in force and what it is for, then every value behind it: sky
and sun intensity, the sun's direction, warmth, the background colour, whether the ground plane and
axes are drawn, the up axis, and the grid's spacing and emphasis. A grid spacing of zero is shown as
missing with the reason — zero means render chooses the spacing from the size of the model, and
printing it as the number zero would be a lie about what was configured.

**The up axis.** Every preset states `z`, which is what `@bim-open-toolkit/render` defaults to and
what the synthetic building is built in. Choosing a preset therefore never leaves the grid lying in
the plane the previous one used.

**Limitations.**

- Four presets and no free editing. Editing individual light values is `environment.set`'s to do and
  needs an inspector row that writes; the property-sheet contract has an `edit` field for it, and the
  Gratify layer has not published the editor yet.
- The preset buttons are drawn by a part defined in `panels.ts` because the `ui-gratify` widget kit
  has not been published. When its `Segmented` lands, the part goes and the panel keeps its shape.
- Nothing here draws. The environment feature's own hook applies the settings to a renderer; this
  demo only chooses them, which is why the whole demo tests in Node.

**Reset.** Disposing what `start` returns writes back the settings that were in force before it ran.
Choosing a different preset is itself the reset for anything the row did.

**Verification.**

```
npx vitest run --root packages/demos test/demos/environment
```
