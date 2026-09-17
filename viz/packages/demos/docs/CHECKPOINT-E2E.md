# Track E2E: the end-to-end vertical slice
State: verified. Contract: M1 with M1.1 and M1.2 (`model` at working-tree state 2026-09-08). Fence:
`viewer/packages/demos/{src/slice,test/slice}/**`, `slice.html`, `vite.slice.config.mjs`, `docs/`.

Files. `src/slice/`: `data.ts` (build), `styles.ts` (resolve), `changes.ts` (resolution difference as
a change table), `readout.ts` (words), `camera.ts` (interact view onto a three camera, ndc to ray),
`adapters.ts` (the five render adapters over viewer-core and three), `mount.ts` (`mountSlice`),
`main.ts` (page entry). `test/slice/steps.test.ts` (16, no browser), `test/slice/page.test.ts`
(1 browser smoke). `slice.html`, `vite.slice.config.mjs`, `docs/slice.md`.

## Delivered

A page on port 5176: the synthetic building drawn by `render` on a viewer-core renderer, all 18
doors whose fire rating is missing or disputed red, orbit navigation from `interact`, click to pick
with name, category, the fire-rating observation in full and the coverage behind it, and a status
line of counts plus the last frame interval from `render`'s `FrameTimer`. One control hides the
walls, because the generator models a door leaf inside its wall and cuts no opening, so with walls
drawn no door is visible at all. `mountSlice(canvas)` returns a dispose function that removes its
elements, listeners, observer, adapters, models and renderer. Counts reported on `window.slice` and
read back by the smoke: 150 objects, 123 instances, 1,476 triangles, 29 doors of which 18 unrated,
84 instance rows written by the first styling, last frame 16.7 ms on software WebGL, GPU timing
unavailable with a stated reason. Screenshot `viewer/artifacts/slice/slice.png` (1280x800,
git-ignored); `CaptureTarget` encoded 69,392 PNG bytes.

## Commands, actual results (from `viewer/`)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/demos/tsconfig.json` | clean, 67 s |
| `npx eslint packages/demos` | clean, 14 s |
| `npx eslint --config eslint.typed.config.js packages/demos` | clean, 28 s |
| `npx vitest run --root packages/demos test/slice` | 2 files, 17 tests passed, 5.3 s |
| `npm test -w @bim-open-toolkit/demos` | 10 files, 95 tests, 94 passed, **1 failed**, 94 s |
| `npx vite --config packages/demos/vite.slice.config.mjs` | served `/slice.html` 200 on 5176; port released, no process left |

## Blockers and notes for the supervisor

- **`packages/demos` has two writers.** An ambient-occlusion track landed `src/ambient-occlusion`,
  `test/ambient-occlusion`, `ambient-occlusion.html`, `vite.ao.config.mjs` and a doc while this
  track ran. Fences did not collide, but its browser test is the one failure above (`expected 150 to
  be greater than 150`), so `npm test -w @bim-open-toolkit/demos` is red for reasons outside this
  fence. Nothing under `test/slice` fails.
- **A contract change landed and was withdrawn mid-track.** For about ten minutes `FactValue`
  carried a fifth kind, `bounds`, breaking this track's exhaustive switch and
  `synthetic/src/schedule.ts:54` together. `describeValue` now names the kinds it handles and
  reports any other by name, so it compiles either way. R's request stands: announce contract
  additions to running tracks.
- **Requests.** A root script `demo:slice` running
  `vite packages/demos/vite.slice.config.mjs --host 127.0.0.1 --port 5176 --strictPort`; and
  `@ara3d/viewer-core` and `three` in `packages/demos/package.json`, since both resolve today only
  because npm hoists them.

## Findings

The full list with line counts is `docs/slice.md`: the impure composition is 208 lines in `mount.ts`
plus 37 in `camera.ts` and 43 in `changes.ts`, almost all of it `createViewer`'s job. Three that
cost real time:

1. **Per-instance opacity is ignored** unless the group's material is itself below opaque
   (`buildMaterial` sets `transparent: opacity < 1`), so the building's translucent windows drew
   solid until the table was given a 0.999 material.
2. **Ghosting cannot reveal what a wall hides.** Materials write depth and three sorts transparent
   objects by whole object, so a ghosted wall group still hid 17 of 18 red doors. Hiding works.
3. **viewer-core's default lights are y-up.** A z-up model gets a sun near the horizon and every
   -y face painted the hemisphere's dark ground colour. `EnvironmentTarget`'s `LightRig` exists for
   this and had to be applied, replacing the lights viewer-core adds in its constructor.

Zero escape hatches. Two places needed a named type to avoid one: a type predicate for
`Mesh.material`, and a `{ kind: string }` parameter in `describeValue`.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---:|---:|---|---|---|
| `tsc --noEmit` | 9 | 15-67 s | 3 (arity after a signature change; the withdrawn `FactValue` kind twice) | Slows to a minute while other tracks compile | Keep |
| `eslint` (untyped) | 3 | 14 s | 0 | none | Keep, cheap |
| `eslint --config eslint.typed.config.js` | 3 | 28 s | 1 real (`Mesh.material` arrives as `any`, which the ratchet cannot see) | none | Keep for this package |
| `vitest` on `test/slice` | 12 | 1-8 s | 4 (favicon console error, an unmeasured first frame, two naming slips) | none | Keep |
| Browser smoke | 7 | 3-19 s | 3 (the findings above; invisible to every other check) | Needs a channel; skips cleanly | Keep, best value per second |
| Reading its screenshot | 5 | seconds | 2 (1 red door of 18; the dark rig) | none | The only check that saw the demo fail its purpose |
