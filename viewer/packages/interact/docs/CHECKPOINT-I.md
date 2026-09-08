# Track I checkpoint — interact

State: **verified** (all assigned gates pass; see the commands below).

Model revision built against: `@bim-open-toolkit/model` at commit `e2d71de`. `src/view.ts` landed in
`478984c`, so `CameraPose`, `Projection`, `ViewState`, `viewState`, `cameraPose`, `perspective`,
`orthographic`, `viewDirection`, `viewDistance`, `atDistance`, `panBy`, `fitDistance`,
`boundsCenter`, `boundsRadius`, `Vec3`, `Matrix4`, `Bounds`, `CoordinateContext`, `upVector` and
`Result` were all available. No local structural types were needed and `src/shapes.ts` was never
created.

Fence: `viewer/packages/interact/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts` (supervisor-owned). Nothing outside it was written.

Nested sub-agents spawned: **0**. Every chunk was small enough that writing a spec for a Sonnet
worker and checking its output would have cost more than doing it. The alpha controls tests were
ported by reading them and rewriting the behaviours against the new API, which needed the design
decisions in hand.

## The decision

`interact` **replaces** `@ara3d/viewer-controls` rather than wrapping it. Full reasoning in
`docs/DECISION-controls.md`, scored against the brief's four criteria in order.

Summary: the wrappable surface is `OrbitModel` and `OrbitControls`, about 325 lines of the alpha
package. Correctness rules most of it out — `OrbitModel.position` and `OrbitModel.pan` hardcode +Y
up, while V2 views declare their up axis through `CoordinateContext` and BIM data is Z-up — and
there is no projection, no first-person or overhead mode, no configurable bindings and no
animation, so most of F04 is new code either way. The deciding criterion is parallel development:
the alpha packages are read-only for every V2 track and are removed at the wave 4 cutover, so a
wrapper would put a V2 package behind a dependency no V2 track may change and behind alpha `dist`
that other sessions are rebuilding. Replacing leaves `interact` with one dependency-free
dependency, `@bim-open-toolkit/model`, and no `three`.

The alpha's verified behaviours were carried over as tests against the new API: clamped
multiplicative dolly, polar clamping at both poles, pan scaled by what the view covers and moving
the scene with the pointer, bounding-sphere framing, framing a box with no size, pointer capture,
ignoring pointers never seen pressed, recovery from `pointercancel` and `lostpointercapture`,
one-finger orbit against two-finger pan and pinch, and restoring `touch-action` and releasing
captures on dispose.

## Files

| File | What it owns |
|---|---|
| `src/vec.ts` | dot, cross, a stable perpendicular, straight-line and shorter-arc blending |
| `src/numbers.ts` | `clamp` and the `finite` guard every device value passes through |
| `src/camera.ts` | camera poses about a declared up axis, the view matrix, the top-down pose |
| `src/projection.ts` | clip matrices, frame height, projection switching, zoom, fit-to-bounds |
| `src/input.ts` | the normalised input record and the gesture arithmetic over it |
| `src/bindings.ts` | the binding table, defaults per mode, supported actions, validation |
| `src/navigation.ts` | `NavState`, `NavSettings` and the three mode reducers |
| `src/animation.ts` | `CameraFlight`, easings, blending, the interrupt rule |
| `src/session.ts` | navigation and a flight composed |
| `src/dom.ts` | the element adapter; the only impure module |
| `src/index.ts` | one level of exports, one `//` contract line each |
| `README.md` | what is here, how to compose with a renderer, what is not here |
| `test/*.test.ts` | ten files, 202 tests, no browser, no `three`, no DOM |

## Delivered behaviour

**Camera math.** Orbit, free look, dolly, screen-plane pan and walking, all about an up axis passed
in rather than assumed, so Z-up BIM data and Y-up scenes use one implementation. `orbitAngles` and
`poseFromOrbit` are inverses, which is what makes camera state saveable and restorable. Polar
clamping keeps the camera off both poles; a degenerate pose (no view direction, or looking straight
along its own up hint) still yields an orthonormal basis. `viewMatrix` and `projectionMatrix` are
column-major plain arrays, verified by projecting points to normalised device coordinates.

**Fit to bounds** places the camera so the box fills the picture in either viewport shape and
re-cuts the near and far planes around it. Verified by projecting all eight corners through
view times projection and asserting every one lands inside the picture, at three aspect ratios and
in both projections.

**Projection switching** keeps the framing: turning perspective off sizes the orthographic frame to
what the camera saw at its target; turning it on moves the camera to the distance that covers the
same height.

**Modes** are pure `(state, input, dt) => state` reducers over the normalised input record. Orbit
lets the scene follow the pointer and dollies with the wheel. First-person turns the view in place,
walks along the ground plane so looking down does not drive the camera into the floor, is not
faster diagonally, has a boost key and a wheel-adjustable speed with limits. Overhead is put back
top-down and orthographic after every step, so no binding, gesture, key or flight can turn the
picture, and it pans a screen height a second so it stays usable when zoomed far out. Entering
overhead takes its heading from where the camera was already facing.

**Bindings** map buttons with modifiers, wheel turns, held keys and finger counts to named actions.
Every mode has a default table and declares the actions it acts on. Resolution prefers the binding
with more modifiers. Validation reports repeats as errors and actions the mode ignores as warnings.

**Animation** is a `CameraFlight` value stepped by a clock the caller owns: the target moves
evenly, the direction turns along the shorter arc, and the distance changes by ratio, so a flight
across two orders of magnitude looks steady. At the end the view is exactly the destination.
`NavSession` composes it with navigation: a press, a wheel turn or a held key hands the camera back
at the point the flight had reached; a hovering mouse does not.

**DOM adapter.** `attachNavigation(element, options)` returns `{ session, setSession, dispose }`.
It listens on the element for pointer, wheel, key, blur and contextmenu events, captures pointers,
sets and restores `touch-action`, and steps the session on frames from an injectable scheduler.
Frames are only requested while something is happening, so a still view schedules nothing. Keys are
taken from the element and not the window, and blur clears them, which is the F04 acceptance case
about independent viewers; only keys the current bindings use are kept from the page.

## Requirements covered

| Requirement | Where |
|---|---|
| F04 perspective and orthographic cameras | `projection.ts`, `test/projection.test.ts` |
| F04 orbit navigation, stable camera state | `navigation.ts`, `orbitAngles`/`poseFromOrbit` |
| F04 fit to model or selection | `fitBounds`, `fitState` |
| F04 projection switch preserving target and framing | `setProjectionKind` and its tests |
| F04 first-person with free look | `firstPersonMode` |
| F04 fixed overhead mode | `overheadMode`, `constrainToMode`; "never turns" test |
| F04 adjustable speed and sensitivity | `NavSettings`, wheel `speed` action |
| F04 configurable bindings | `bindings.ts` |
| F04 interruptible camera animation | `animation.ts`, `session.ts` |
| F04 independent viewers do not take each other's keys | `dom.ts`, its two-controller test |
| F05 touch orbit, pan, pinch | `pinchScale`, touch bindings, `dom.ts` touch tests |
| F05 pointer cancellation | `pointercancel` and `lostpointercapture` handling and tests |
| F05 gesture ownership against the host page | `touch-action`, wheel and bound-key `preventDefault` |
| F09 keyboard | element-scoped key handling, key bindings |

Not covered here, and deliberately: collision-aware walking and gravity (F04 follow-on P1); tap
selection and hover naming (F06, Track R); the mobile quality preset and validation on named
devices (F05 next deliverable, needs hardware).

## Remaining work

- Nothing outstanding inside the fence. The package is feature-complete against F04 and the F05 and
  F09 points assigned to it.
- Follow-on, for whoever composes this into `viewer`: a `StateSlice` for `NavState` so a scene
  document persists it, and a set of `Command`s (`fit`, `setMode`, `flyTo`, `saveView`) once
  `model`'s command contract lands. Those belong to Track V, not here.
- Validation on real touch hardware is not something this package can do; it needs the Gratify
  shell and a device.

## Commands and results

Run from `viewer/`, 2026-09-07, after the last chunk:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/interact/tsconfig.json` | pass, no output |
| `npx eslint packages/interact` | pass, no output |
| `npm test -w @bim-open-toolkit/interact` | pass, 10 files, 202 tests, 1.12 s |
| escape-hatch scan (`any`, ` as `, `!.`, `@ts-`, `eslint-disable`) | no code hits; every match is the word "as" or "any" in prose |

Not run, and why: `tools/platonic-check.mts` and `npm run test:v2` cover the whole workspace, whose
inputs are other tracks' uncommitted files. Running them would report their state, not mine. The
supervisor owns the combined run.

## Chunk commits

| # | Concern | Commit |
|---|---|---|
| 1 | wrap-or-replace decision and this checkpoint | `9545032` |
| 2 | camera pose math about a declared up axis | `dbb444c` |
| 3 | projection matrices, fit-to-bounds, projection switching | `262f998` |
| 4 | normalized input record | `6bcd29d` |
| 5 | configurable bindings with defaults and validation | `97bf8f9` |
| 6 | orbit, first-person and overhead as pure reducers | `366299a` |
| 7 | interruptible camera flight and the session that composes it | `e1877ff` |
| 8 | DOM adapter, README, public API contract test | recorded on commit |

## Blockers

None.

## Requests to the supervisor

1. **Remove `"@ara3d/viewer-controls": "0.1.0"`** from `viewer/packages/interact/package.json`
   dependencies. Nothing in the package imports it. `three` is **not** requested. Until this lands
   the declaration is unused and harmless, so it blocks nothing.
2. No other manifest, tsconfig or vitest change is needed. The supervisor-owned files were left
   exactly as they were.

## Findings

1. **`model`'s `frameBounds` ignores the viewport aspect for orthographic projections.** It sizes
   the frame as `height = radius * 2`, which cuts the box off horizontally in a portrait viewport.
   `interact` computes its own fit as `height = 2 * radius * max(1, 1 / aspect)`. Suggested fix for
   Track M; not made here because `packages/model` is outside this fence.
2. **`model/math.ts` has no dot or cross product.** Every consumer of `Vec3` that does geometry
   needs both. `interact` defines them in `src/vec.ts` and exports them; they would sit better in
   `model` alongside `normalizeVec3`, and the local copies would then be deleted. Spherical
   interpolation of a unit vector (`unitSlerp`) is a second candidate.
3. **Rebuilding a pose from its angles is not exactly the identity.** A held mouse button that has
   not moved produced about 1e-15 of drift per frame, which over a minute of a still hand is
   visible in a comparison. `applyDrag` now returns the state unchanged when both deltas are zero,
   and there is a test that six hundred still frames leave the state identical. Anything else that
   round-trips through angles should take the same precaution.
4. **A pointer move for a pointer this element never saw pressed must be treated as a hover**, even
   when the event says a button is down. Without that, a move arriving after `pointercancel`
   re-arms the drag. This is the same class of defect the alpha's cancellation test guards against;
   worth repeating in any other adapter.
5. **The `dt` in a reducer must be guarded, not trusted.** A dropped frame, a paused tab and a
   fresh attachment all produce step lengths that are negative, enormous or not numbers. One
   `finite` guard at the entry of `stepNavigation` and `advanceFlight` covers every path, and every
   device delta passes through the same guard.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction or false positives | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/interact/tsconfig.json` | 11 | 5–7 s alone; **75 s** on the run at 23:23 while other tracks were compiling | 3: `perpendicularTo` left unexported after the move to `vec.ts`, an indexed access on a `readonly Vec3[]` in a test, and a stale import after a rename | The per-package tsconfig extends the root, whose `include` lists **every** V2 package, so this "package" check actually typechecks the whole workspace. Its cost and its output both depend on what other tracks have half-written. That is the friction, and it is real in a shared checkout. | **helpful**, but the config should be fixed: a per-package `include` would make it a per-package check |
| `eslint packages/interact` | 8 | 6–7 s throughout | 0 | None. Nothing it flags was not already flagged by `tsc`, on this package. | **neutral** — cheap enough to keep, but it earned nothing here |
| escape-hatch scan (grep for `any`, ` as `, `!.`, `@ts-`, `eslint-disable`) | 2 | under 1 s | 2, both in tests: an `as unknown as Vec3` and two `as EaseName` I had written before remembering the rule | Matches the English words "as" and "any" in comments, so every run needs reading. A parser-based check would be exact. | **helpful** — it is the only check that enforces the rule, and it caught real violations that `tsc` and `eslint` both accepted |
| `vitest run` (per package) | 14 | 0.5–1.4 s | 3: an orbit tilt sign I had backwards in a test expectation, the pointer-cancel drift above, and a `+0`/`-0` comparison | None worth naming. Fast enough to run after every edit, which is what made the sign errors cheap to find. | **helpful**, clearly the best value of the four |

Notes for the ledger:

- The order that worked was write, run vitest, run tsc, run eslint, scan. Vitest is fast enough to
  be the inner loop; the other three are worth one pass per chunk, not per edit.
- `noUncheckedIndexedAccess` changed how the code is written rather than catching mistakes: array
  indexing shows up as `| undefined` and gets handled at the point of use. Its value is the casts
  that were never written. `exactOptionalPropertyTypes` pushed `NavSession.flight` to be a required
  `CameraFlight | undefined` rather than an optional property, which is the better shape anyway.
- The strictness rules cost roughly two extra iterations across the whole track. The escape hatches
  they forbid were only reached for in tests, never in the source.
- `git` contention is worth recording: one commit failed on `.git/index.lock` held by another
  track and succeeded after an 18-attempt wait of about 36 seconds. Another track's files were in
  the index at that moment; the explicit pathspec kept them out of the commit and they were
  committed by their own agent moments later.
