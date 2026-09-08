# Track UG — Gratify layer

State: **verified** for chunk 1 (`hostPanel`, `Button`, `Tag`, theme bridge). Chunks 2 to 5 outstanding.

Contract: G1 at `39a01b5`, plus **G1.1** below. Model M1 with M1.1 to M1.3. Gratify 0.2.0 (`submodules/gratify`, read-only).

## G1.1 — additive change to `Hosted` (announced)

`Hosted` gained two members, both needed by the DOM mirror of decision 1:

- `activate(path: string): boolean` — presses the control at a semantics path exactly as a pointer
  would, so a hidden DOM button runs the same intent as the canvas control.
- `onChanged(run): Disposable` — runs after each committed document change, so a mirror rebuilds
  only when something changed.

Nothing was removed or renamed. GAL and the demo tracks consume `Hosted`; no change is needed on
their side unless they want the mirror.

## Files

- `src/theme.ts` — the section 3 palette, the type scale, `applyGalleryTheme`.
- `src/surface.ts` — the page seam: structural `SurfaceElement`/`SurfaceEvent`, `FrameScheduler`,
  `renderLoop`, `bindSurfaceInput`, `ScaledPainter`. No DOM types, so it is all testable.
- `src/host.ts` — `hostSurface`: one headless `Runtime` on one canvas, sized to content or to its
  container, with owned input, an rAF loop that sleeps, and idempotent disposal.
- `src/panel.ts` — `hostPanel`, `panelMount`, `hostAnyPanel`, corner/edge/world placement.
- `src/widgets/` — `common.ts` (tones, surface blend, focus ring), `button.ts`, `tag.ts`.
- `test/theme.test.ts`, `test/widgets.test.ts`, `test/surface.test.ts`.

## Delivered

- `hostPanel(container, panel, session, options?)` returns `Result<Hosted>`; `panelMount(container,
  session, options?)` is the `PanelMount` a demo hands to `AnyHudPanel.host`.
- One Gratify `Runtime` per panel, headless, on its own transparent canvas (`bg` alpha 0) sized to
  what the panel drew, at the requested corner or edge, or over a world point.
- World placement: `options.world = { project, onFrame }`. `project` is the gallery's own
  projection; `onFrame` is its after-frame hook, so a tag follows a moving camera. The canvas's
  **bottom-left** corner sits on the projected point, which is where `Tag` puts the foot of its
  leader line. A point that does not project hides the canvas.
- `panel.sync` runs after each session change event and replaces the document; `panel.onCommit` runs
  after each committed change **except** a sync, so a mirroring panel cannot drive itself in a loop.
- `applyGalleryTheme(theme, textScale)` registers the palette as a Gratify theme and cross-fades to
  it; `fontSize`, `spaceOf`, `controlHeight` carry the text scale (Gratify has no size token).
- `Button` (tones, disabled, focus, keyboard activation, semantics) and `Tag` (leader line, optional
  second line, optional press).

## Remaining

Chunk 2 inspector (virtualized list, badges, tables, row actions); chunk 3 the rest of the kit
(`Toggle`, `Segmented`, `Slider`, `NumberScrub`, `Card`, `Labeled`, `Legend`, `Sparkline`,
`Timeline`, `Chip`, `List`); chunk 4 island editing and `semanticsMirror`; chunk 5 README.

## Commands (actual)

From `viewer/`, at chunk 1:

- `npx tsc --noEmit -p packages/ui-gratify/tsconfig.json` — clean, about 12 s.
- `npm test -w @bim-open-toolkit/ui-gratify` — 5 files, 18 tests, passed in 1.15 s.

## Chunk commits

1. `hostPanel`, `Button`, `Tag`, theme bridge — see the commit that adds this file.

## Blockers

None.

## Requests

- **GAL**: `GalleryViewer` needs `project(worldPoint) => {x, y} | undefined` in the container's own
  pixels and `onFrame(run) => Disposable`; both are already in section 4.3. Pass them as
  `hostPanel`'s `options.world`. The panel container must be positioned; the host sets
  `position: relative` when it is `static`.
- **Supervisor**: no `package.json` or `tsconfig` change is needed so far.

## Findings (Gratify upstream, for a later submodule bump)

1. `Runtime.stop()` still does not detach `attach()`'s listeners or its `ResizeObserver`; this
   package avoids `mount()` entirely, as the alpha does. Confirmed by reading `runtime.ts`.
2. A headless `Runtime` never learns a device pixel ratio (`dpr` is private and set only by
   `attach`), so `ScaledPainter` overrides `screen` and `view`. A `RuntimeOpts.dpr` would remove it.
3. `Runtime.syncIslands` appends island elements to `islandLayer`, which is null unless `attach()`
   ran, so **islands do not work on a headless runtime**. Chunk 4 will therefore position its own
   DOM input over the canvas instead of using the `island` facet. A public `Runtime.setIslandLayer`
   (or creating the layer lazily) would fix it.
4. There is no public way to register a theme palette: `themes` is an exported mutable record and
   this package writes into it. A `defineTheme(name, palette)` would make that a contract.
5. Gratify has no size or spacing token, so a text-scale change cannot cross-fade the way colours
   do; this package keeps its own scale in `theme.ts`.
6. `Runtime` has no public hit test (`hitAt`), which is why `activate` synthesises a pointer press.

Local note: `FrameScheduler`/`browserFrames` here duplicate `interact/src/dom.ts`. Adding a
dependency on `interact` for two lines was not worth it; if a third package needs them, they belong
in `model`.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 3 | ~12 s | 0 | none | Cheap; the strict flags shaped the design rather than catching mistakes. |
| `vitest run` | 2 | ~1.2 s | 2 (shared colour objects in the palette; a fake that never detached) | none | Worth every second. Keep. |
| Zero escape hatches | — | — | 1 design win: the DOM seam is structural, so the lifecycle is testable in node | Real cost: no `as` means no fake `HTMLCanvasElement`, which forced `SurfaceElement`. Better code. | Keep. |
