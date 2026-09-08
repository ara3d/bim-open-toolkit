# Checkpoint FB — clipping, layouts, environment, navigation aids, HUD

Fence `src/{clipping,layouts,environment,navigation-aids,hud}*` and matching tests. Contract M1 with M1.1 and M1.2; render as of `3d3e302`.

**State: implemented and verified.** Five features, 88 FB tests, zero escape hatches. Each owns a versioned slice with a schema and a migration table, validates command input through schemas, and exposes its render hook as a function over an interface a Node test substitutes. Each also has one test through Track V's real `createSession` and `featureHost`.

**Files.** `src/{clipping,layouts,environment,navigation-aids,hud}.ts`, `test/{same}.test.ts`, and `test/navigation-aids-fixture.ts` (a two-storey building and its instance table, shared by the FB tests).

**Command names (public API).** `clipping.setPlanes` `clipping.setBox` `clipping.sectionAt` `clipping.clear` `layouts.explode` `layouts.grid` `layouts.reset` `environment.set` `navigation.goToLevel` `navigation.frame` `navigation.saveView` `navigation.restoreView` `hud.toggle`.

**Index exports.** `export * from './{clipping,layouts,environment,navigation-aids,hud}.js';` — already in `src/index.ts`. No exported name in `src` is claimed twice, FA's and FC's included.

## Delivered

- **clipping**: planes, box, `sectionAt(elevation, thickness?, axis?, keep?)`; `sectionForLevel` gives a storey its slab and the topmost storey everything above it, its height being unstated. The region is saved state (the alpha lost it on reload), normalised through render's plane arithmetic before storing and applied through `applyClipping`; `isClipped` still keeps identity on the visible side.
- **layouts**: explode by storey (one average storey height per storey per unit of strength) or by category (fanned in the ground plane, name order), and a plan grid. The slice holds parameters only; `captureTranslations` takes the base at installation and the hook writes base plus offset through `writeTranslations`, so reset and disposal restore the model's placement exactly.
- **environment**: render's settings as a patch through `checkEnvironment`, plus a bounding-box display (twelve line segments) render's environment does not draw, on its own optional seam.
- **navigation-aids**: `levelsOf(model)` derives storeys rather than storing a stale copy; level navigation, framing bounds or points, and saved views over the view state this feature owns.
- **hud**: counts from `sceneStatistics`, frame and GPU timing from render's timing module, level indicator from the navigation slice (`dependsOn: ['navigation-aids']`); the reading is written by the hook at `intervalMs`, never by a command.

## Commands (from `viewer/`), commits `b07648d` and `eef7081`

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/features/tsconfig.json` | clean, 10.6 s |
| `npx eslint packages/features` | clean, 18.7 s |
| `npx vitest run --root packages/features test/{the five}.test.ts` | 5 files, 88 tests, 1.3 s |
| `npx vitest run --root packages/features` (all three tracks) | 16 files, 285 tests, 8.1 s |

## Requests

- **Supervisor (manifest)**: FB tests import `@bim-open-toolkit/viewer`, so it needs to be a dev dependency of `features`. It resolves from the workspace today.
- **Track V**: no `view` slice exists, so navigation aids holds the view in its own `navigation` slice; if the viewer defines a canonical one, `navigation.*` writes that instead — one reference. Seconding V's service request: a hook's `Session.write` publishes no event, so a UI cannot subscribe to the HUD reading.
- **Track FA**: saved views carry `StyleRule`s, so `navigation-aids.ts` holds a module-private style rule schema; if FA exports one, delete mine.
- **Wave 3**: `workflows/src/recipe.ts` calls the same operation `views.save` that FB calls `navigation.saveView`; one should win. `clipping.setBox` already matches.

## Findings

- A feature cannot reach `ModelData`, an `InstanceTable` or bounds through `Session`, so everything model-derived is a pure exported function the host calls (`levelsOf`, `layoutOffsets`, `boundsLines`) and the hooks take the model and table as arguments. Testable in Node, but a command cannot resolve "the top storey" itself: `navigation.goToLevel` carries the level it is sent to.
- A hook that lifts its effect before re-applying blinks the renderer through an unstyled frame on every change. Clipping and environment now replace in place and lift only on disposal; the environment test counting target calls found it.
- Render's `gridSpacingFor` sizes a floor grid to a model, not objects to a layout: 0.2 m for a 4 m building. `layouts.grid` derives spacing from the ground extent over the column count instead.

## Tooling

| Check | Runs | Wall time | Defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 14 | 10.6 s | 1: an optional-property patch type `exactOptionalPropertyTypes` rejected, before any test existed | other tracks' in-progress files must be filtered out of the output | keep; the strict flags earn their cost |
| `eslint` | 4 | 18.7 s | 0 | slowest check, least return over a package `tsc` already covers | keep at chunk boundaries, not per edit |
| `vitest` (5 files) | 12 | 1.3 s | 3: the hook blink above and two wrong expected offsets | none | keep; the only check that found behaviour |
