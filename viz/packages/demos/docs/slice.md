# The end-to-end slice

One page, built only from the V2 packages, that draws a synthetic building and colours every door
whose fire rating is missing or disputed red. It exists to answer a question the package tests
cannot: what does it actually cost to compose `synthetic`, `model`, `render` and `interact` into
something a person can look at?

The answer is at the bottom, as a list of glue. It is the point of this demo as much as the picture
is.

## Running it

From `viewer/`:

```
npx vite --config packages/demos/vite.slice.config.mjs
```

and open <http://localhost:5176/slice.html>. The config resolves `@bim-open-toolkit/*` to package
source with the same alias rule as `vitest.shared.ts`, and `@ara3d/viewer-core` to its built `dist`,
so nothing has to be built first except the alpha packages, which already are.

The checks, from `viewer/`:

```
npx tsc --noEmit -p packages/demos/tsconfig.json
npx eslint packages/demos
npx eslint --config eslint.typed.config.js packages/demos
npm test -w @bim-open-toolkit/demos
npx vitest run --root packages/demos test/slice/page.test.ts --reporter=verbose
```

The last one opens the page in a real browser on software WebGL, reads back what the page reports,
and writes a screenshot to `viewer/artifacts/slice/slice.png` (git ignores `artifacts/`). It skips
with a printed reason when no chromium channel can be launched, so a machine without one is not a
failure. The verbose reporter is needed to see what it printed.

## What is on the page

A three-storey building of eight rooms per storey: 150 objects, 123 drawn instances over 8 mesh
groups, 1,476 triangles, 29 doors. Eleven doors have a fire rating, sixteen have none recorded, and
two have sources that disagree; the eighteen that are not `known` are red, and the rest keep the
colour they were generated with.

- **Orbit navigation** from `interact`: drag to orbit, scroll to zoom, shift-drag to pan.
- **Click to pick**: the object's name, category, its fire-rating observation in full (`missing
  (not-provided)`, `conflicting (EI90 vs EI60)`, or the rating), and the coverage over all doors.
  The picked object is marked in the selection colour.
- **A status line**: objects, instances, triangles, unrated doors of doors, the last frame interval
  from `render`'s `FrameTimer`, and what GPU timing came to - which is a reason, not a number.
- **One control**: hide the walls. The generator models a door leaf inside its wall and cuts no
  opening, so with the walls drawn no door can be seen at all. Unticking it shows the building
  solid, which is what the data says and also what hides the subject.

The data is synthetic and the page says so.

## Two things that had to be found out by looking

**Ghosting does not work; hiding does.** The first attempt gave the walls a low opacity. Every
group's material writes depth, three sorts transparent objects against each other and by whole
object, and each wall group spans the whole building, so a ghosted wall drawn first still hid the
doors behind it: 1 red door of 18 was visible. Hiding writes alpha zero, which viewer-core's patched
material discards outright, and all 18 appear.

**The lights had to be applied.** viewer-core's constructor adds a y-up rig: a hemisphere light
whose ground colour is a dark blue and a sun at (1, 2, 1.5). The building is z-up, so the sun sat
near the horizon and every wall facing -y was painted the dark ground colour. `EnvironmentTarget`
carries a `LightRig` for exactly this; the adapter now applies it and replaces what was there.

## Findings: the glue a `viewer` package should absorb

`src/slice` is 616 lines of code, of which 208 are `mount.ts` - the impure composition - plus 37 in
`camera.ts` and 43 in `changes.ts` that exist only because no package owns them. `adapters.ts` (154)
is the renderer-specific part and belongs beside `render`, not in every host.

| Glue in `mount.ts` | Lines | Where it belongs |
|---|---:|---|
| Create the renderer, attach it, size it, cap the pixel ratio | 6 | `createViewer(canvas)` |
| Build a `SceneBinding`, add the model, hold statistics and bounds | 5 | `viewer.open(model)` |
| A material one shade below opaque, or per-instance opacity is ignored | 1 | `render`'s default table options |
| Environment target, its up axis, and applying it | 5 | an environment feature |
| Clipping target and applying an empty section | 2 | a clipping feature |
| GPU timer, capture target, raycast source | 3 | a default adapter set beside `render` |
| First styling, and remembering how many rows it wrote | 5 | `viewer.apply(rules)` |
| Status, readout and control elements, and taking them away again | 16 | a UI package |
| Assembling the counts and painting them four times a second | 18 | `viewer.statistics()` and a HUD |
| Resolve, diff, apply - the whole restyle path | 10 | one command |
| Selection: set it, restyle, write the readout | 12 | a selection feature |
| Aspect, fit-to-bounds, attach navigation, write the camera | 10 | `createViewer` |
| Press-and-release slop, ndc, ray, pick | 20 | a picking feature |
| A resize observer that guards against its own feedback | 10 | `createViewer` |
| A frame loop, the frame interval, a throttled repaint | 15 | `createViewer` |
| Disposing eight things in the right order | 13 | `viewer.dispose()` |

Outside `mount.ts`:

- **`camera.ts`, 37 lines.** An `interact` `ViewState` written onto a three `PerspectiveCamera`, and
  a three matrix converted to the model package's sixteen with sixteen `?? 0`s, because
  `noUncheckedIndexedAccess` makes `elements[i]` optional and no package offers
  `matrixFrom(values: ArrayLike<number>)`. An orthographic view cannot be shown at all, because
  viewer-core owns one perspective camera and swapping it is the host's problem.
- **`changes.ts`, 43 lines.** Two `ResolvedStyles` differenced into a `Table` in `render`'s update
  vocabulary. `SceneBinding.applyStyles` writes a whole resolution and lets change detection discard
  the rest, which is right for a first load and wrong for a click: this page resolves on every
  selection. The bridge is small, obvious, and every host will write it. It belongs in `model` beside
  `resolveStyles`, or in `render` beside `applyUpdates`.
- **`data.ts`, base appearances, 3 lines.** `resolveStyles` needs a base map or everything resolves
  to grey and the model is repainted flat on the first write. `ModelData` carries `appearance` per
  record, so the map is a one-liner - but nothing says you have to build it, and the failure is
  silent and total.

Smaller ones, each a line or two:

- `document.getElementById` returns `HTMLElement | null` and the strict rules allow no cast, so every
  host writes an `instanceof HTMLCanvasElement` check.
- `Mesh` without type arguments hands `material` back as `any`, so a type predicate has to name the
  shape before the typed lint will accept it.
- WebGL2 timer queries reach TypeScript through `getExtension` as `any`. With no escape hatches
  allowed, `GpuFrameTimer` can only report that the extension is present and unread. Typed bindings
  belong in whichever package owns the renderer adapter.
- `viewer-core` has no renderer-wide clipping plane list, so `ClippingTarget` walks the mirror and
  sets every material in turn.

## The beginner path this argues for

Three lines, with everything above absorbed:

```ts
const viewer = createViewer(canvas);                       // renderer, camera, input, frames, disposal
const model = await viewer.open(generateBuilding(defaultBuildingOptions));
viewer.apply(styleRule('unrated', 'Unrated doors', unratedDoors(model), { color: [1, 0, 0] }));
```

For that to be true, `createViewer` has to own the renderer, the size, the frame loop, navigation,
picking, statistics and disposal; `open` has to build the binding, take the base appearances off the
records and fit the view; and `apply` has to resolve, difference and write. The status line and the
readout are then a HUD feature and a selection feature reading published events, not host code.

Everything in the table above is already written once, here, and can be moved rather than invented.
