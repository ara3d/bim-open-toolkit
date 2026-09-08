# Checkpoint V — viewer composition

Track V, fence `viewer/packages/viewer/**` (not `package.json`, `tsconfig*.json`, `vitest*.ts`).
Contract revision: M1 with the M1.1 and M1.2 additions.

## State: verified

All five deliverables landed. `createViewer` is published, so Track D (gallery) is unblocked; FA, FB
and FC can drive `createSession` instead of `features/test/support/fake-session.ts`.

Chunk commits: `bbc9dfc` session, bus and feature host; `8297df6` the scene document; `dbca382`
adapters, view, `createViewer`, multi-view and the browser smoke; this commit the documentation.

## The three-line path, as it actually is

```ts
const viewer = createViewer(canvas);
await viewer.open('/models/building.bfast');
viewer.run('view.fit', {});
```

Verified in a real browser (`test/browser/smoke.test.ts`): a frame drawn, a colour rule in the
instance buffer, a scene saved and restored, zero console errors. Colouring is `viewer.apply(rule)`;
saving is `viewer.save()`; a second canvas is `viewer.addView(canvas)`.

## Delivered, in short

`createSession` (a read validates; a commit is the outermost dispatch; reading never registers),
`commandBus`, `featureHost` (order, all-or-nothing rollback, reverse disposal), `saveScene` and
`loadScene` (all or nothing, migration, model fingerprint, orphans reported not dropped), the six
render adapters plus both camera kinds over viewer-core and three, `createView` (a loop that draws
only when asked, a resize that cannot feed back), `viewSet` (several canvases sharing one set of
groups, linked or not), and `defaultFeatures()` — three ordinary features a host can replace.
Details in `README.md` and `docs/viewer.md`.

## Commands and results (from `viewer/`)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/viewer/tsconfig.json` | clean |
| `npx eslint packages/viewer` | clean |
| `npx eslint --config eslint.typed.config.js packages/viewer` | clean |
| `npm test -w @bim-open-toolkit/viewer` | 9 files, 95 tests passed, 5.5 s |

Browser run: msedge 152.0.4191.66, ANGLE SwiftShader, 1.1 s in the browser; skips with a printed
reason where no chromium channel launches.

## Requests

- **Supervisor (manifest).** Declare `three` and `@ara3d/viewer-core` as dependencies of
  `@bim-open-toolkit/viewer`, and `@bim-open-toolkit/testing` and `vite` as dev dependencies. All
  four resolve from the workspace today, so nothing is blocked.
- **Model (additive).** (a) A `Service<T>` key type and an optional service lookup on `Session`: a
  feature in `features` cannot name the capability the viewer holds, because the dependency runs the
  other way, so one needing live access must be installed by whoever holds the service. (b) Schemas
  for `ViewState` and `StyleRule` beside their types (mine are in `src/schemas.ts`). (c)
  `matrixFrom(values: ArrayLike<number>)` in `math.ts`: three copies of sixteen `?? 0`s now exist.
- **Render (additive).** A bridge differencing two `ResolvedStyles` into a change table. This package
  uses `applyStyles`, which addresses every row of every model on every selection change: correct,
  and the wrong cost for a click on a large model. The demos slice wrote the same bridge by hand.

## Findings

- `installFeatures` does not guard a hook that throws, so the host runs the hooks itself to roll back.
- Sharing `InstancedGroup`s across two `ViewerScene`s works (`addGroup` registers a listener per
  scene), which is what makes a second view cost a camera rather than a model. viewer-core's `Viewer`
  builds its own scene and takes no injection, so the binding's scene is the viewer's own.
- `docs/viewer.md` maps every line of glue in `demos/docs/slice.md` to where it went.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---:|---:|---|---|---|
| `tsc --noEmit` | 14 | 6 to 25 s (25 under load from other tracks) | 3, all in tests asserting something untrue (`readonly[]` has no `sort`; `Disposable` returns `void`; a `ClipRegion` box has `min`/`max`) | none | keep |
| `eslint` untyped | 4 | 3 to 40 s under load | 0 | none | keep, cheap |
| `eslint` typed | 4 | 12 s to over 300 s under load | 1 (an unused parameter) | timed out twice while five tracks compiled | keep, but it is the check that suffers most from a shared machine |
| `npm test` | 20 | 0.4 to 5.5 s | 7, all wrong expectations of my own | none | keep |
| browser smoke | 3 | 10 to 11 s | 0 so far; it is the only proof the picture exists | needs a bundle step (vite `build` with `write: false`) because a data URL cannot carry three | keep |
| Zero escape hatches | — | — | held; four places wanted one, all recorded in `docs/viewer.md` | the `Matrix4` tuple conversion is written three times across the repository | keep, and close the gap with `matrixFrom` |
