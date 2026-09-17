# Checkpoint FC — annotations, overlays, animation, comparison, storage, capture

State: implemented and verified against contract M1 of 2026-09-08; no contract additions needed.
Each feature is exercised twice: through the shared fake session and through V's `createSession`.

## Files
`src/{annotations,overlays,animation,comparison,storage,capture}.ts` and the matching
`test/*.test.ts`; nothing else touched. Each module: one slice at version 1 with a schema and an
exported (empty) migration table, commands validating through schemas, and — where a port is
injected — a factory beside the plain `Feature`: `overlaysFeatureWith(sink)`,
`animationFeatureWith(clock, sink?)`, `storageFeatureWith(adapter, scene)`,
`captureFeatureWith(target)`. `Feature<S>` has no slot for a dependency, so a bare
`<name>Feature` refuses what it cannot do rather than no-ops.

## Command names (public API)
`annotations.add|edit|remove`; `overlays.set|add|clear`; `animation.load|seek|play|pause`;
`comparison.load|link|resolve`; `storage.save|load|list|delete`; `capture.image|forget`.
Two beyond the brief: `overlays.add` takes a workflow result's `overlayRecord` as it stands, so
wave 3 needs no translation (`recipe.ts` names it); `capture.forget` removes a thumbnail.

## Index export lines (supervisor owns `src/index.ts`)
`export * from './annotations.js';` and the same for `./overlays.js`, `./animation.js`,
`./comparison.js`, `./storage.js`, `./capture.js` — nothing is exported that is not public surface,
no name collides, the order is free.

## Commits and commands
- `b9a8d0c` the six modules and their tests; `bdd5e2b` a test per feature through V's session.
- `npx tsc --noEmit -p packages/features/tsconfig.json` — clean, ~13 s.
- `npx eslint packages/features` — clean, ~3 s.
- `npm test -w @bim-open-toolkit/features -- <six files>` — 116 passed, 1.3 s.
- `npm test -w @bim-open-toolkit/features` — 16 files, 291 passed, 4.2 s (FA and FB included).

## Requests
- Supervisor: add the six index lines, and `@bim-open-toolkit/{synthetic,testing}` as
  devDependencies of `features` (tests use the `revisions` and `schedule` fixtures and the fake
  clock; both already resolve through tsconfig paths and the vitest alias, so nothing is broken).
- Track W: `recipe.ts`'s `timeline.setDate` is `animation.seek` over milliseconds here, and its
  `views.link` is `comparison.link`. Say which side moves before wave 3 wires recipes up.

## Findings
- A `Command` returns synchronously and encoding an image cannot, so `capture.image` returns a
  `PendingCapture` carrying a promise and stores the finished thumbnail by dispatching itself in a
  `store` form — the slice is still only written by a command. An async bus collapses the two.
- `Session` cannot be enumerated, which is right, but saving a document needs every installed slice,
  so `storage` takes a `SceneSource` port. V supplies it; nothing else can.
- A load keeps the slices it can read and downgrades a broken slice's diagnostics to warnings:
  refusing a whole document over one stale slice loses the parts that are fine.
- `overlays` hands the renderer the layers, not placed primitives — projection needs a camera and a
  viewport belonging to the view, so the sink calls render's `projectOverlays` itself.
- The `revisions` fixture's duplicated case is one A-side object claimed twice, not a B-side one,
  so `contestedIds` reads both sides; counts then match `changeCounts`.

## Tooling
| Check | Runs | Wall time | Real defects | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 3 | ~13 s | 0 in FC; caught FA's `Legend` import once | none | Keep: the strict flags are why no cast was needed |
| `eslint` | 1 | ~3 s | 0 | none | Keep, but found nothing tsc had not |
| `vitest` (six files) | 3 | ~1.3 s | 2 (my own wrong timeline expectations) | none | Keep: the only check that caught anything |
| `vitest` (package) | 2 | ~4.2 s | 0 | none | Keep at hand-off; confirms FA and FB still pass |
