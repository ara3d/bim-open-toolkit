# Decision: `interact` replaces `@ara3d/viewer-controls`

Date: 2026-09-07. Decided by Track I (V2 plan unresolved decision 3). Status: taken.

## The choice

`viewer/packages/interact` implements camera state, navigation modes, bindings and camera
animation itself. It does not depend on `@ara3d/viewer-controls` and does not depend on `three`.
The alpha package stays untouched and keeps serving the alpha viewer until the wave 4 cutover.

## What the alpha package offers

`@ara3d/viewer-controls` 0.1.0 exports seven things. Only two are navigation:

| Export | Lines | Relevant to `interact` |
|---|---:|---|
| `OrbitModel` | 150 | yes: orbit, dolly, pan, frame, set pose |
| `OrbitControls` | 175 | yes: pointer, wheel and touch binding to a DOM element |
| `Picker`, `ndcFromClient`, `Selection`, `PickControls`, `SectionPlanes`, `Emitter` | 293 | no: picking, selection and clipping belong to Track R (`render`) |

So the wrappable surface is about 325 lines, of which the parts that already do what F04 asks
are orbit rotation, multiplicative dolly, screen-space pan, bounding-sphere framing, and the
pointer/wheel/touch gesture handling.

## Criteria, in the order the brief sets

### 1. Correctness on the F04 acceptance cases

F04 asks for perspective **and orthographic** cameras, fit-to-model and fit-to-selection, stable
camera state, projection switching that preserves target and approximate framing, first-person
navigation, a fixed overhead mode, adjustable speed and sensitivity, configurable input bindings
and interruptible camera animation. Its acceptance case is a camera laboratory that switches
modes, saves and restores a pose and alters controls, with overhead navigation fixed in
orientation and independent viewers not capturing each other's keyboard input.

Measured against that, `OrbitModel` is missing or wrong in five places:

1. **Up axis is hardcoded to +Y.** `position` builds the offset as `y + distance * cos(phi)`, and
   `pan` crosses with the literal `new Vector3(0, 1, 0)`. V2 declares the up axis per view through
   `CoordinateContext`, and `model`'s `defaultView` and `metresZUpLocal` are Z-up, which is what
   BIM data uses. Wrapping means either rotating every input and output through
   `upAxisMatrix` on each interaction, or accepting a viewer that tilts wrongly in Z-up scenes.
   This is a correctness failure of the wrap, not a missing feature.
2. **No projection.** `OrbitModel` has no field of view or orthographic frame; the caller passes a
   field of view into `frame()` only. There is nothing to switch and nothing to preserve framing
   across, so F04's projection requirement is entirely new code either way.
3. **No first-person and no overhead.** Both are new code either way. Overhead in particular has
   to hold orientation fixed, which a spherical orbit model with a clamped polar angle cannot
   express without being overridden on every step.
4. **No bindings.** `OrbitControls` hardcodes left-drag rotate, right-or-shift-left pan, wheel
   dolly. F04 requires the binding table to be configurable, so the binding layer is new code and
   `OrbitControls`'s event handling would have to be bypassed rather than reused.
5. **No animation and no keyboard**, so nothing to reuse for fly-to or for walking.

What is genuinely reusable is roughly 60 lines of arithmetic, and it has to be rewritten anyway to
carry an arbitrary up axis. The alpha's verified *behaviors* are worth more than its code; those
are ported as tests against the new API instead.

### 2. Testability without a browser

Both options test without a browser: `OrbitModel` is DOM-free and `OrbitControls` is tested in the
alpha with a fake element. The difference is what has to be present for the test to run. A wrapper
pulls in `three` (`Vector3`, and `PerspectiveCamera` in the alpha tests) to exercise mutable class
state, so every test allocates renderer-adjacent objects to check arithmetic. Replacing lets every
navigation test be a comparison of plain number arrays with no dependency loaded. It also makes
the reducers `(state, input, dt) => state`, which the brief requires; wrapping a mutable class
inside a pure reducer means cloning or reconstructing that class on each step.

Replacing wins, though not decisively: this criterion is about degree, not possibility.

### 3. Size of the dependency surface

Wrapping adds `@ara3d/viewer-controls` and, through its peer dependencies, `three` and
`@ara3d/viewer-core`. `interact` computes camera poses and matrices; it never touches a scene, a
material or a renderer. A camera-math package that cannot be used without a WebGL library is
harder to reuse and slower to load in a Node test.

Replacing keeps `interact` at exactly one dependency, `@bim-open-toolkit/model`, which is itself
dependency-free. Column-major `Matrix4` as a plain 16-number array is already `model`'s contract,
so a renderer binding is one array copy at the boundary.

### 4. Parallel-development friendliness

This is what settles it. The V2 plan makes `viewer/packages/{core,controls,loaders,visualization}`
read-only for every V2 track and removes `visualization` at the wave 4 cutover; the alpha packages
exist to keep the alpha viewer working while V2 is built. A wrapper would make a V2 package depend
on a package that no V2 track may change, so every gap found in `OrbitModel` becomes a request to
a session that owns alpha code, or a workaround inside the wrapper. It also puts a build-order
edge from `interact` back onto the alpha `dist`, so a V2 test run depends on alpha build state
that other sessions are changing.

Replacing removes that edge entirely: `interact` builds and tests from `model` source alone.

## Consequence and request

Requested of the supervisor: remove `"@ara3d/viewer-controls": "0.1.0"` from
`viewer/packages/interact/package.json` dependencies. It is unused. `three` is not requested as a
peer dependency and is not needed: the camera math produces column-major `Matrix4` arrays that a
renderer copies into `Matrix4.fromArray`.

Until the dependency is removed the package still declares it; nothing imports it, so tests,
typecheck and lint are unaffected.

## What is carried over rather than dropped

The alpha behaviors verified in `viewer/packages/controls/test/orbit-model.test.ts` and
`orbit-controls.test.ts` are re-tested against the new API: clamped multiplicative dolly, polar
clamping, pan scaled by orbit distance and moving the target opposite the drag, bounding-sphere
framing that keeps the viewing angle, framing a degenerate box, pointer capture, ignoring foreign
pointers, recovery from `pointercancel` and `lostpointercapture`, one-finger orbit against
two-finger pan and pinch, and restoring `touch-action` and releasing captures on dispose.

## What would change this decision

If a later track needs picking, selection or section planes, those are Track R's concern and are
not affected by this decision. If `interact` ever needs to drive an alpha `OrbitControls` instance
directly, the adapter for that is a few lines in the composition layer (read the pose out of
`NavState`, call `setPose`), not a dependency of this package.
