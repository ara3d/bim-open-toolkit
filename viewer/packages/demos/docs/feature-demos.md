# Feature demo pages

One page per request from the user, built on the wave 2 features and a thin shared host. Plan and
status: `docs/plans/visualization/FEATURE-DEMOS-PLAN.md`. Pages live at
`viewer/packages/demos/feature-demos/<id>.html`, code at `src/feature-demos/<id>/`, tests at
`test/feature-demos/<id>/`.

Run a page from `viewer/`:

```
npx vite --config packages/demos/vite.feature-demos.config.mjs
```

then open `http://localhost:5181/feature-demos/<id>.html`. A browser test starts its own server on
the track's port and needs nothing running.

## The shared pieces (`src/feature-demos/_shared/`)

| File | What it gives a page |
|---|---|
| `host.ts` | `createDemoHost({ canvas })` → `DemoHost`: the viewer package's `session` and `features` host, the render `binding`, `open(modelId, model, geometry)` → `OpenedModel` (table, dirty sets, keys, base appearances, bounds), `fit`, `setView`, `flyTo`, `view`, `project`, `pick`, `clipping` seam, `gpu` timer, `onFrame`, `publish`, `capture`. Replaced by `createViewer` when Track V lands it. |
| `page.ts` | `mountFeatureDemo(setup)`: finds `#viewport`, `#stage`, `#controls`, `#status`, makes the host, runs your setup, publishes `window.demo`. Your setup returns `{ report, act?, dispose? }`. |
| `controls.ts` | `addSelect`, `setChoices`, `addButton`, `addCheckbox`, `addSlider`, `addStatus`. |
| `overlay.ts` | `overlayPanel(stage, { corner, width, height })`: a Canvas2D panel in a corner of the viewport for HUD drawings. |
| `protocol.ts` | `DemoReport`, `DemoWindow`: what `window.demo` holds; also imported by the gallery wave, so its names are a contract. |
| `test/feature-demos/_shared/browser.ts` | `runDemoPage({ page, port })` runs a page in a real browser with software WebGL, or returns `{ skipped }`; `reportedNumber`, `reportedString`. |

`src/feature-demos/host-smoke/main.ts` and `test/feature-demos/host-smoke/page.test.ts` are the
smallest complete example: open the building, add a control, report, test in a browser.

## Installing features with their hooks

A feature from `@bim-open-toolkit/features` is plain data; its render hook is bound to what the
host has open, in the order the hooks' dependencies need:

```ts
const model = host.open('building', building.model, building.geometry).value;
host.features.install([
  editsFeature,
  setsFeature,
  appearanceFeatureFor(sceneRenderTarget(host.binding), model.base),
  { ...layoutsFeature, install: layoutsHook({ table: model.table, model: model.model, dirty: model.dirty, moved: () => host.publish() }) },
  { ...clippingFeature, install: clippingHook(host.clipping) },
  { ...navigationAidsFeature, install: navigationHook({ setView: host.setView }) },
]);
```

The HUD feature's hook returns a sampler the page calls once a frame:

```ts
const sampler = hudHook({ table: model.table, geometry: model.geometry, frames: new FrameTimer(), gpu: host.gpu, camera: host.cameraKind })(host.session);
host.onFrame((frame) => sampler.sample(frame.time));
```

State changes only through `host.session.dispatch(name, input)`; the command names and inputs are
in each feature module (`sets.isolate`, `sets.showAll`, `appearance.addRule`, `layouts.explode`,
`layouts.grid`, `layouts.reset`, `clipping.sectionAt`, `clipping.clear`, `navigation-aids.goToLevel`,
`hud.toggle`, and so on). Read the feature's test file for a worked example of each.

## Tests

- Pure logic (derived sets, offsets, drawings) in Node, through `createSession` and `featureHost`
  from `@bim-open-toolkit/viewer` with `noRenderTarget` where a render target is needed, never
  through a canvas.
- One browser test per page through `runDemoPage`, asserting on `window.demo.report()`; it skips
  with a printed reason when no browser launches. Screenshots land in `viewer/artifacts/feature-demos/`.

## Rules

Zero escape hatches (no `any`, no `as` except `as const`, no `!`, no directives). Commit by
pathspec from the repository root with the message in a file; never amend, never push. Fences and
ports are in `.claude/wave.json` and the plan. Anything a feature lacks is shimmed in the demo and
requested back in the checkpoint.
