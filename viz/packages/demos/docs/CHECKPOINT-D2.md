# Checkpoint D2 — cut, arrange, scale

Track D2 of the gallery wave: demos 5 to 11 of GALLERY-PLAN.md section 5. Contract revision G1
(`demos/src/gallery/contracts.ts`, `ui-gratify/src/contracts.ts`), read at 39a01b5.

Branch note: this checkout is on `build`, not `main`. Another session switched it; commits below are
on `build`.

## State per demo

| Demo | State | Commit |
|---|---|---|
| environment | verified | f2bc8b6 |
| capture | verified | 0528034 |
| section-studio | working | |
| explode-and-grid | working | |
| ten-thousand | working | |
| load-a-file | not started | |
| saved-views | not started | |

## Files

- `src/demos/{environment,capture}/**` — `index.ts`, `panels.ts`, `inspector.ts`, `README.md`, and
  one module each for the pure data the three share (`presets.ts`, `request.ts`).
- `test/demos/{environment,capture}/demo.test.ts`.
- `test/demos/_d2-support/{fake-session,panel-harness}.ts` — see the fence note below.

## Delivered behaviour

- **environment**: four presets (studio, overcast, night, plan) as whole settings resolved against
  render's default, so the row reads the preset in force back out of the slice instead of remembering
  what it sent; settings matching none read `Custom`. Every preset is z-up. The sheet reports the rig,
  background, ground, axes and grid, and shows an automatic grid spacing as missing with its reason.
- **capture**: three stated pixel sizes, a capture button and a HUD switch; `capture.image` stores the
  picture in the scene document and the bar reads it back. The sheet reports size, bytes and format,
  and states that a capture is of the model canvas only, so no panel and no readout reaches the file.

## Remaining work

The five demos above without a commit, their READMEs and tests, and every thumbnail (waiting on GAL's
smoke and thumbnail command).

## Commands, with results

From `viewer/`:

- `npx tsc --noEmit -p packages/demos/tsconfig.json` — clean at 0528034. At f2bc8b6 it reported one
  error in `src/demos/point-and-read/inspector.ts`, which is track D1's file; D1 has since fixed it.
- `npx vitest run --root packages/demos test/demos/environment` — 11 passed (86 s wall, almost all of
  it transform and import while other tracks were compiling).
- `npx vitest run --root packages/demos test/demos/capture` — 11 passed (1.8 s wall).

No browser run yet: GAL's smoke and thumbnail command has not landed. Port 5192 is unused so far.

## Blockers

None hard. Two things make a demo report an honest failure rather than work:

1. The capture button cannot produce a file until the gallery installs the capture feature with its
   renderer (request 2 below).
2. Thumbnails wait on GAL.

## Requests

- **To FC (capture)**: record what a capture cost. The slice keeps the picture, its size and its
  format, and nothing about how long the capture took, so the sheet has to show the time as missing.
  A `lastCapture: { key, width, height, bytes, elapsedMs }` on the slice, written by the same store
  dispatch, would let the sheet answer the question the demo is named for.
- **To GAL**: `createGalleryViewer` already builds a `captureTarget`. When a demo declares the
  target-less `captureFeature`, install `captureFeatureWith(target)` in its place. A demo cannot build
  the targeted feature itself because it never sees the renderer, and declaring both would be a
  duplicate slice.
- **To UG**: the widget kit. Every panel here defines a chip part of its own because `Button`,
  `Segmented`, `Toggle`, `Slider` and `Sparkline` are not published; each is marked in its file and is
  deleted when the kit lands. Also `flagValue(on: boolean): PropertyValue`, which two sheets have now
  written for themselves.
- **To the supervisor**: `gratify` is a devDependency of the workspace root and resolves into
  `packages/demos` by hoisting, but `demos/package.json` does not declare it. The panels import it
  directly for `AppSpec`, the containers and `part`. Please add it.
- **To the supervisor (fence)**: `test/demos/_d2-support/**` holds the fake session and the headless
  panel harness the seven demos share. Copying them into seven directories would be worse. The
  directory is named for the track so it cannot collide with any demo id; please record it as D2's.

## Findings

- Gratify's `Runtime` runs headless against a null painter and takes real pointer input, so a panel
  test presses the control a person would press. Controls are found through `semanticsTree()`, which
  is also what the gallery's DOM mirror walks: a control the test cannot reach is one a keyboard
  cannot reach. This is worth making the standard way panels are tested in this wave.
- `GalleryViewer` extends `Session`, so a demo's opening sequence, readiness test, report and sheet
  can all be plain functions of a `Session`. Written that way they need no DOM, which is what lets the
  demos verify in Node; `start` is a one-line wrapper. Recommended for the other demo tracks.
- A capture is an encode of the model canvas, so nothing drawn on the panel or inspector canvases is
  in it. That is worth stating in the gallery's own documentation, not only in this demo.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/demos` | 3 | 25 to 60 s | 0 in D2's own files | Reports other tracks' errors in a shared package; costs a re-read to attribute | Keep; it is the only thing checking the contract types |
| `vitest run --root packages/demos test/demos/<id>` | 2 | 1.8 to 86 s | 0 so far; the tests were written with the code | First run of a session pays about 80 s of transform under load | Keep; scoped runs are cheap once warm |
| Zero escape hatches | continuous | none | 1: forced the fixture to be built by its own generator rather than narrowed out of the catalog union | None | Keep |
