# @bim-open-toolkit/interact

Camera state and navigation for a 3D view: where the camera is, how input moves it, and how it
flies from one view to another.

Everything here is pure except one file. Camera arithmetic, the three navigation modes, the binding
table and camera animation are plain functions over plain data, so they are tested in Node without
a browser, a canvas or a renderer. `src/dom.ts` is the only module that touches a DOM, and it does
one job: turn element events into the normalised input record and step the pure reducers with it.

The only dependency is `@bim-open-toolkit/model`, which has no dependencies of its own. There is no
`three`, no WebGL and no scene graph. Matrices come out as plain 16-number arrays in column-major
order, which is the layout `Matrix4.fromArray` and `gl.uniformMatrix4fv` already expect.

## What is here

| Module | What it owns |
|---|---|
| `vec.ts` | Vector arithmetic `model` does not carry: dot, cross, a stable perpendicular, straight-line and shorter-arc blending. |
| `camera.ts` | Camera poses about a declared up axis: orbit, free look, dolly, screen-plane pan, walking, the view matrix, and a top-down pose that holds a heading. |
| `projection.ts` | Perspective and orthographic clip matrices, the height of scene a projection covers, switching between the two kinds while the picture stays the same size, orthographic zoom, and fit-to-bounds. |
| `input.ts` | The normalised input record: viewport, pointers with their movement over the step, modifiers, held keys, wheel movement. Plus the gesture arithmetic over it. |
| `bindings.ts` | The configurable map from buttons, modifiers, keys and finger counts to named actions, a default table per mode, and validation. |
| `navigation.ts` | `NavState` and the three mode reducers: orbit, first-person, overhead. |
| `animation.ts` | `CameraFlight`: an interruptible camera flight as plain data stepped by a clock the caller owns. |
| `session.ts` | Navigation and a flight composed: user input hands the camera back mid-flight. |
| `dom.ts` | The element adapter. The only impure module. |

## The three modes

**Orbit** swings the camera around a target it keeps. The scene follows the pointer; the wheel
moves closer. This is the mode for inspecting a model.

**First-person** turns the view in place and walks with the movement keys along the ground plane,
so looking down does not drive the camera into the floor. Speed is a setting and the wheel changes
it. It does not know about collision or gravity, deliberately: the product brief lists those as a
later stage.

**Overhead** is a top-down orthographic view that only pans and zooms. After every step the camera
is put back looking straight down at the heading it had, so no binding, gesture or flight can turn
the picture. Entering the mode takes the heading from where the camera was already facing, so
lifting a walking camera overhead keeps the plan pointing the same way. Leaving the mode does not
undo the orthographic projection: what the user can see is what they asked for, and
`setProjectionKind` is one call away.

## Composing with a renderer

`interact` never draws. A renderer reads two matrices out of the state each frame:

```ts
import { attachNavigation, navSession, navState, viewMatrix, projectionMatrix, aspectOf } from '@bim-open-toolkit/interact';
import { defaultView } from '@bim-open-toolkit/model';

const controller = attachNavigation(canvas, {
  session: navSession(navState(defaultView, 'orbit')),
  onChange: (session) => {
    const { camera, projection } = session.nav.view;
    renderer.setView(
      viewMatrix(camera),
      projectionMatrix(projection, aspectOf({ width: canvas.clientWidth, height: canvas.clientHeight })),
    );
  },
});

// Later, when the view is torn down:
controller.dispose();
```

`onChange` is called only after a step that changed something, and frames are only asked for while
something is happening: a pointer is down, a key is held, the wheel has turned, or a flight is
running. A view sitting still schedules nothing.

Commands that move the view go through `setSession`:

```ts
controller.setSession(startFlight(controller.session(), savedView.view, 600));
controller.setSession({ ...controller.session(), nav: setMode(controller.session().nav, 'overhead') });
controller.setSession({ ...controller.session(), nav: fitState(controller.session().nav, modelBounds, { aspect, padding: 1.05 }) });
```

A flight is interrupted by a press, a wheel turn or a held key, keeping the view it had reached; a
mouse merely crossing the picture does not interrupt it.

## Testing without a browser

Every reducer has the shape `(state, input, dt) => state`, so a test writes an `InputFrame` by hand:

```ts
const dragged = stepNavigation(state, {
  viewport: { width: 800, height: 400 },
  pointers: [{ id: 1, kind: 'mouse', x: 100, y: 0, dx: 100, dy: 0, buttons: ['left'] }],
  modifiers: [],
  keys: [],
  wheel: 0,
}, 1 / 60);
```

The DOM adapter takes its frame scheduler as an option, so its own tests wind a fake clock and
raise events on a stand-in element. Nothing in this package needs a headless browser.

## Rebinding controls

Each mode has a default table and declares which actions it acts on. A rebound table is checked
against the mode it is for:

```ts
const table = { ...defaultBindings.orbit, drags: [{ button: 'left', modifiers: [], action: 'pan' }] };
const checked = validateBindings(table, 'orbit');
```

Repeating a button and modifier set, a key or a finger count is an error, because only the first of
them could ever apply. Binding an action the mode ignores is a warning, so one table can serve
several modes. Resolution prefers the binding with more modifiers, which is how shift with the left
button can differ from the left button alone.

## What is not here

- **Picking, selection and clipping.** Those belong to `@bim-open-toolkit/render`. This package
  never asks what is under the pointer.
- **Rendering of any kind**, including navigation aids, a compass or a view cube. Those are
  features built on top.
- **Collision, gravity and walking on floors.** First-person navigation flies; making it walk needs
  geometry queries this package has no access to.
- **Commands, events and persistence.** `NavState` is plain data that a scene document can hold,
  but the command bus and the slice that stores it live in `@bim-open-toolkit/viewer`.
- **Multiple views.** One `NavState` is one view. Linking two of them is composition above here.

## Decisions

`docs/DECISION-controls.md` records why this package implements navigation itself rather than
wrapping `@ara3d/viewer-controls`. `docs/CHECKPOINT-I.md` records what is verified and how.
