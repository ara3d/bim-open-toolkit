# Checkpoint FA — appearance, sets, edits, replacement

Fence `packages/features/{src,test}/{appearance,sets,edits,replacement}*` and this file. Contract M1 + M1.1 + M1.2.

**State: implemented and verified.** Four features, each a version-1 slice with schema and an empty migration table, schema-validating commands, and a render hook. Each has a document round-trip test, a command test through `test/support/fake-session.ts` *and* Track V's `createSession` + `featureHost`, and a render-hook test against a real `SceneBinding` over a viewer-core `ViewerScene` in Node. Zero escape hatches. 86 tests.

**Files.** `src/appearance-schemas.ts` shared plain-data schemas · `src/appearance-render.ts` `RenderTarget`, the one render seam, and `sceneRenderTarget(binding)` · `src/appearance.ts` rules, legends, `categoryStyling`, `numericStyling`, the M1 composition, `writeAppearance` · `src/{sets,edits,replacement}.ts` · `test/appearance-fixture.ts` (three objects on one shared cube, a bound scene, `featureSession`, `installedSession`, a recording representation target) · `test/{appearance,sets,edits,replacement}.test.ts`.

**Commands.** `appearance.` addRule, addRules, removeRule, setRuleEnabled, reorder, clear · `sets.` define, remove, select, selectSet, union, intersect, difference, isolate, showAll, clear · `edits.` apply, addLayer, removeLayer, enableLayer, undo, redo, clear · `replacement.` set, clear.

**Index lines needed** (supervisor owns `src/index.ts`; nothing collides between the four):

```ts
export * from './appearance-schemas.js';   // shared plain-data schemas and the empty input
export * from './appearance-render.js';    // the render seam and the SceneBinding adapter
export * from './appearance.js';           // rules, legends, colourings, the M1 composition
export * from './sets.js';                 // named sets, algebra, isolation, selection
export * from './edits.js';                // edit layers with undo and redo
export * from './replacement.js';          // geometry replacement that keeps identity
```

`writeAppearance` is deliberately not `applyAppearance`, which is M1's own `(base, change)`.

**Commits.** `ddc4f8d` features and tests · `1913b6e` the four through Track V's real session · `b8ed230` this checkpoint.

**Commands run.** `tsc --noEmit -p packages/features/tsconfig.json` clean for FA (FB's `test/layouts.test.ts` has a mid-edit syntax error; not mine) · `eslint` over my eleven files clean · `vitest run --root packages/features test/{appearance,sets,edits,replacement}.test.ts` 4 files, 86 tests, pass · whole package 15/16 files, 272/274 tests, both failures FC's `animation.test.ts`.

## Decisions

- **Colouring is a builder, not a rule kind.** `categoryStyling` / `numericStyling` read a table once and return ordinary `StyleRule`s plus a `Legend`, so the slice stays plain data. A numeric scale is banded (band count in the legend) because one rule carries one colour; the range is given, not measured, so two models compare. Absent, non-numeric and unlisted values get the stated missing colour, never an invented one.
- **The composition lives in `appearance`**, reading the sets and edits slices into M1's `styleComposition`. `appearance` depends on `['sets','edits']`, `sets` on `['edits']`, `replacement` on `['appearance']`.
- **Selection.** `sets.select` drops keys an edit deleted as it writes; `effectiveSelection` drops hidden ones as the style composes, so they return when the object does. Both tested.
- **Every edits command commits**, `enableLayer` included: one command is one transaction.
- **Replacement hides by change table** (`replacementChanges`), writing only the keys that move and restoring a freed key at the visibility the styling resolved. Its hook runs after the appearance hook by dependency, so a restyle under it cannot un-hide a replaced object.

## Requests

1. `src/index.ts`: the six lines above.
2. `package.json`: `@bim-open-toolkit/viewer` as a **devDependency** — the real-session tests import `createSession` and `featureHost`. It resolves today through the workspace symlink and tsconfig `paths`, and `tsconfig.build.json` (src only) never sees it.
3. **Track V persistence: honour `ephemeralSlices`** from `replacement.ts`. The replacement slice must not be saved (alpha decision, `visualization/docs/replacement.md`); its schema round-trips faithfully because a session reads a slice back through it, so the exclusion belongs at save time.
4. A home for `test/appearance-fixture.ts`, shared by all four FA tests and named `appearance*` only because of my fence. `test/support/fixture.ts` is the honest place.
5. **Naming to settle.** `workflows/src/recipe.ts` names `style.addRule`, `sets.create`, `selection.setFromSet`, `sets.isolate`; I used the brief's names and only `sets.isolate` matches. Either `workflowCommands` changes or wave 3 adds aliases — I added none, two names being two public APIs.

## Findings

- `styleComposition` cannot be given a `selectionChange`, so the selection colour is fixed at M1's default; F08 wants selected-versus-context configurable. An M2 request if a UI needs it.
- `SceneBinding.applyStyles` addresses every row per change. Change detection makes that free downstream (asserted), but it is a full pass per command — measure first if anything ever dispatches per frame.
- Track V's `read` validates against the slice schema every time, and `resolveAppearance` reads three slices per model per change. Worth watching, not worth changing.

## Tooling

| Check | Runs | Wall | Real defects | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | ~12 | 7.0 s | 4 (an invented helper, an input typed against the wrong schema, two dead imports) | Reports other tracks' mid-edit files; had to grep my paths | Keep — cheapest real signal |
| `eslint` untyped | 3 | 13.6 s | 0 | Twice tsc's cost for nothing tsc missed | Style gate only; zero value here |
| `vitest` (mine) | ~10 | 7.9 s | 5, one a design bug: clearing a replacement left the row hidden, the appearance hook not watching that slice | None | Keep — every design error was found here |
| `vitest` (package) | 2 | 5 s | 0 for FA | Fails on other tracks' files | Once, at the end |
