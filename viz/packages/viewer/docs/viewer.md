# How the viewer package fits together

`@bim-open-toolkit/viewer` is the default composition: the one place that knows a session, a
command bus, a feature host, a document, a renderer, a canvas and a camera all exist at once. Every
other V2 package is deliberately ignorant of at least one of those. This one is where they meet, and
its whole job is that a person should not have to.

The measure of it is the list in `packages/demos/docs/slice.md`, which counted every line of glue a
host had to write by hand to see a synthetic building with unrated doors coloured red. That list is
this package's specification, and the table at the end of this file says where each line went.

## The shape

```
createViewer(canvas)
├── createSession()                  slice store, change events, command bus       (no canvas, no three)
│   ├── commandBus                   M1's CommandRegistry, rebuilt as features come and go
│   └── featureHost                  install order, dependencies, rollback, disposal
├── SceneBinding(hostScene)          the model bound once, for every view          (render package)
├── viewSet()                        one View per canvas
│   └── createView(renderer, canvas) camera, input, frame loop, size, disposal
│       └── ViewRenderer             five methods and six adapters                 (src/adapters, the only three)
└── viewerAccess                     how a command reaches the scene and the views
```

The arrows all point one way. A slice never knows about a renderer; a renderer never reads a slice.
Between them is one subscription, in `create-viewer.ts`: when the appearance slice changes, resolve
it and write it into the buffers; when the view slice changes, put the cameras and the mode where it
says. Nothing else crosses.

## Why the session is not the fixture

`model/test/session-fixture.ts` is forty lines and satisfies `Session` exactly. Everything this one
adds is something only a running viewer needs:

- **A slice registry**, because a document is the composition of the installed slices and something
  has to hold the list. Reading and writing deliberately do *not* register: a value written by a
  slice nobody declared is held but never saved, since a document carrying it could not be restored
  by anyone.
- **A commit that is the outermost dispatch.** The fixture publishes once per dispatch; a command
  that dispatches another would then publish twice and a subscriber would see the model half
  repainted. Here the depth is counted and one event names everything that changed.
- **Diagnostics with nowhere else to go.** `write` returns void, so a write after disposal, a stored
  value that no longer checks, and two slices claiming one id are collected and reported by
  `session.diagnostics()`.
- **Disposal that keeps the values.** A disposed session refuses commands and drops its listeners,
  but can still be saved. Losing a scene because the page is closing would be the wrong trade.

### The one cost

`read` validates. A stored value is `unknown` — it may have come from a document written against an
older version of the slice — and the only way back to `S` without a cast is the slice's own schema.
So every read walks the value. For a slice holding a handful of fields that is nothing; for one
holding ten thousand object keys it is not. The advice, and what this package does itself, is to
hold the value you were given and subscribe to changes rather than reading in a loop.

The alternative would be to trust that everything in the store arrived through a typed `write`. It
does not: `loadScene` writes what a document held. Correctness first.

## Why features cannot reach the renderer, and what is done about it

M1's `Session` is four methods, and it should be: it is what makes a command testable with no
canvas anywhere. But clipping a section, flying a camera and fitting to a selection all need
something that is not plain data.

`src/services.ts` is the local answer. A `Service<T>` is a key object holding its own
`WeakMap<Session, T>`, so `get` returns the declared type with no cast and no runtime check, and a
session nobody gave one reads back `undefined`. `viewerAccess` is the one this package declares, and
every command in `core-features.ts` reports `viewer/no-scene` rather than failing quietly when it is
absent — which is what lets all of them be tested in Node.

**The gap.** `@bim-open-toolkit/features` cannot import this package: the dependency runs the other
way. So a feature written there cannot name `viewerAccess`, and today a feature that needs live
access has to be installed by whoever holds the service. The request to the model package is in the
checkpoint: a `Service<T>` key type in `model`, and an optional lookup on `Session`, so both sides
can name the same key.

## The document

`saveScene` walks the slice registry and puts one envelope per slice, at that slice's current
version. `loadScene` reads and migrates *every* slice before writing any of them, so a document with
one unreadable slice leaves the session exactly as it was. A missing migration is a refusal — the
model package decided that for one slice, and this keeps it true of the whole scene.

The models a scene was saved against are digested into eight hex digits under a reserved slice id,
`viewer.fingerprint`. A document saved against another model, or another revision of the same one, is
refused: its rules and its selection address object keys that are not there, so restoring it would
paint nothing and say nothing. `anyModel: true` overrides it and the mismatch stays in the
diagnostics.

Slices the document carries that nothing installed owns are reported and **left in the document**.
Install the missing feature, load again, and they restore.

## The view

One canvas is one `View`: a `NavSession` from `interact`, the DOM adapter on the element, a frame
loop, a size, and disposal.

**The loop draws only when something asked.** `requestRender` marks the view dirty; navigation marks
it dirty when it actually changed; a resize marks it dirty. A view sitting still schedules a frame
and draws nothing, so the intervals `FrameTimer` records are the frames a viewer really saw rather
than a stream of identical pictures. The scheduler is `interact`'s `FrameScheduler`, so a test winds
a clock by hand and there are no timers in the suite.

**Resize cannot feed back.** The observer compares the client size with the one in force and returns
when they are equal, which is the guard the end-to-end slice found it needed.

**Both projections are shown.** viewer-core owns one perspective camera, so the adapter keeps an
orthographic one beside it and hands the renderer whichever the view state asks for through
`setRenderCamera`. The alpha and the slice could only ever draw perspective, which meant the
overhead navigation mode could not be seen.

## Several canvases

Everything drawn belongs to the session, so a second view costs a camera, a canvas and a renderer —
not a second copy of the model. The binding builds its groups into a `ViewerScene` the viewer owns,
and each view adds those same `InstancedGroup`s to its own scene. One colour write moves both
pictures, and `viewer.binding.models` stays at one.

Linking is in `multi-view.ts` rather than in a view, because a view cannot know about its
neighbours. The copy is guarded by a flag so two linked views do not chase each other around the
loop, which the tests assert directly.

## What needs a browser, and is therefore not tested in Node

- That a WebGL context can be made at all, and that the picture is not black.
- That the three.js mirror syncs when a group's version counter moves.
- That clipping planes set on every material actually cut.
- That `canvas.toBlob` encodes.

`test/browser/smoke.test.ts` covers exactly that much: it bundles `test/browser/page.ts` — the three
documented lines and nothing else — with vite, writes it to `viewer/artifacts/viewer/browser`, and
runs it through the testing package's playwright runner. It asserts a drawn frame, the red channel in
the instance buffer, the restored slice list and an empty console. On this machine: msedge
152.0.4191.66, ANGLE SwiftShader, 1.1 s in the browser and about 10 s including the bundle. Where no
chromium channel launches it prints the reason and passes.

## Where the slice's glue went

Every row of the table in `packages/demos/docs/slice.md` under "Findings: the glue a `viewer`
package should absorb":

| Glue the slice wrote by hand | Where it is now |
|---|---|
| Create the renderer, attach it, size it, cap the pixel ratio | `adapters/webgl.ts`, `view.ts` |
| Build a `SceneBinding`, add the model, hold statistics and bounds | `createViewer`, `viewer.show` |
| A material one shade below opaque | `adapters/webgl.ts`, `blendableMaterial`, used by `show` |
| Environment target, its up axis, and applying it | `adapters/scene-dressing.ts`, `view.setEnvironment` |
| Clipping target and applying an empty section | `adapters/scene-dressing.ts`, `view.setClipping` |
| GPU timer, capture target, raycast source | `adapters/capture.ts`, `adapters/raycast.ts` |
| First styling, and how many rows it wrote | `viewer.apply`, and the restyle bridge |
| Assembling the counts | `viewer.statistics()`, `viewer.hud()` |
| Resolve, diff, apply — the whole restyle path | one subscription in `create-viewer.ts` |
| Selection: set it, restyle, write the readout | `appearance.select`, the restyle bridge |
| Aspect, fit-to-bounds, attach navigation, write the camera | `view.ts`, the `view.fit` command |
| Press-and-release slop, ndc, ray, pick | `create-viewer.ts`, `attachSelection` |
| A resize observer that guards against its own feedback | `view.ts` |
| A frame loop, the frame interval, a throttled repaint | `view.ts` |
| Disposing eight things in the right order | `viewer.dispose()` |
| `camera.ts`: a view state onto a three camera, a matrix converted | `adapters/camera.ts` |
| `data.ts`: base appearances off the object records | `viewer.show` |

Two are **not** absorbed, deliberately:

- **The status line, the readout and the control elements.** Those are a user interface, and
  `ui-gratify` and `ui-react` own them. `viewer.hud()` is the data they read.
- **`changes.ts`, differencing two `ResolvedStyles` into a change table.** This package uses
  `SceneBinding.applyStyles`, which addresses every row and lets change detection discard the rest.
  That is right for a load and, as the slice found, wasteful for a click on a large model: it walks
  every object of every model to build three arrays. The bridge belongs beside `resolveStyles` in
  `model` or beside `applyUpdates` in `render`, and until it exists this package pays the whole-model
  cost per selection change. Measured on the reference model's shape by Track R, a whole-model colour
  write is 9.35 ms; that is the ceiling, not a guess, but it has not been measured through this path.

## What the strictness cost, and caught

Zero escape hatches held. Four places wanted one:

1. `transformOfRow` in `render` returns `readonly number[]`, and a `Matrix4` is a sixteen-tuple, so
   `matrixFrom` writes sixteen `?? 0`s. The same conversion is in `adapters/camera.ts` for a three
   matrix, and the end-to-end slice wrote a third copy. A `matrixFrom(values: ArrayLike<number>)` in
   `model/math.ts` would remove all three.
2. `Mesh` without type arguments hands `material` back as `any`, so `carriesMaterial` names the shape
   and `instanceof` proves it.
3. WebGL2 timer queries reach TypeScript through `getExtension` as `any`, so `GpuFrameTimer` reports
   that the extension is present and unread rather than inventing a number.
4. A value that crossed JSON out of a browser is `unknown`, so the smoke test parses it with a model
   schema instead of asserting a shape.

The type checker caught three real defects while this was written, all of them in tests asserting
something that was not true: `readonly string[]` has no `sort`, a `Disposable` returns `void` rather
than `undefined`, and a `ClipRegion` box carries `min` and `max` rather than a `bounds`.
