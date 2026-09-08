# Checkpoint FA — appearance, sets, edits, replacement

Track FA, fence `viewer/packages/features/{src,test}/{appearance,sets,edits,replacement}*` plus this
file. Contract revision: M1 with the M1.1 and M1.2 additions.

## State

**Implemented and verified.** Four features, each with a versioned slice, a schema, an empty
migration table at version 1, commands that validate through their own schema, and a render hook.
Every feature has a document round-trip test, a command test through `test/support/fake-session.ts`
*and* through Track V's `createSession` + `featureHost`, and a render-hook test against a real
`SceneBinding` over a viewer-core `ViewerScene` in Node. Zero escape hatches.

## Files

| File | What it holds |
|---|---|
| `src/appearance-schemas.ts` | The plain-data schemas all four share: colour, matrix, extras, appearance, appearance change, style rule, object keys, empty input |
| `src/appearance-render.ts` | `RenderTarget`, the one seam to render; `sceneRenderTarget(binding)`; `noRenderTarget` |
| `src/appearance.ts` | Rules, legends, `categoryStyling`, `numericStyling`, the M1 composition, `writeAppearance`, `appearanceRenderHook`, `appearanceFeature`, `appearanceFeatureFor` |
| `src/sets.ts` | `SavedSet`, selection, isolation, set algebra, `effectiveSelection`, `setsFeature` |
| `src/edits.ts` | Layer and history schemas, `editEffect`, `editEffectOf`, `editsFeature` |
| `src/replacement.ts` | `ReplacementsState`, `ephemeralSlices`, `replacementChanges`, `replacementRenderHook`, `replacementFeature`, `replacementFeatureFor` |
| `test/appearance-fixture.ts` | Shared: three objects on one shared cube, a bound scene, `featureSession`, `installedSession`, a recording representation target |
| `test/{appearance,sets,edits,replacement}.test.ts` | 86 tests |

## Command names (the public API)

`appearance.addRule`, `appearance.addRules`, `appearance.removeRule`, `appearance.setRuleEnabled`,
`appearance.reorder`, `appearance.clear`;
`sets.define`, `sets.remove`, `sets.select`, `sets.selectSet`, `sets.union`, `sets.intersect`,
`sets.difference`, `sets.isolate`, `sets.showAll`, `sets.clear`;
`edits.apply`, `edits.addLayer`, `edits.removeLayer`, `edits.enableLayer`, `edits.undo`,
`edits.redo`, `edits.clear`;
`replacement.set`, `replacement.clear`.

## Index export lines needed (supervisor owns `src/index.ts`)

```ts
// The schemas and the render seam the four appearance features share.
export * from './appearance-schemas.js';
export * from './appearance-render.js';
// Rules, legends, category and numeric colourings, and the M1 style composition.
export * from './appearance.js';
// Named sets, set algebra, isolation and the transient selection.
export * from './sets.js';
// Edit layers with undo and redo.
export * from './edits.js';
// Geometry replacement that keeps identity.
export * from './replacement.js';
```

No name collides between the four modules. `writeAppearance` is deliberately not called
`applyAppearance`, which is M1's own `(base, change)` function.

## Commits

- `ddc4f8d` the four features and their tests
- `1913b6e` the same four run through Track V's real session

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/features/tsconfig.json` | Clean for FA's files. Track FB's `test/layouts.test.ts` has a syntax error mid-edit; not mine |
| `npx eslint packages/features/{src,test}/{appearance*,sets*,edits*,replacement*}` | Clean |
| `npx vitest run --root packages/features test/{appearance,sets,edits,replacement}.test.ts` | 4 files, 86 tests, all pass |
| `npx vitest run --root packages/features` (whole package) | 15 of 16 files pass, 272 of 274 tests. The two failures are Track FC's `test/animation.test.ts` |

## Decisions worth knowing

- **Colouring is a builder, not a rule kind.** `categoryStyling` and `numericStyling` read a table
  once and return ordinary `StyleRule`s plus a `Legend`, so the slice stays plain data and a saved
  document holds exactly what was applied. A numeric scale is **banded** (the band count is in the
  legend) because one rule carries one colour; the range is given, not measured, so two models
  compare. A value that is absent, not a number, or not in the palette gets the stated missing
  colour, never an invented one.
- **The composition lives in `appearance`.** It reads the `sets` and `edits` slices and hands them
  to M1's `styleComposition`, so nothing re-implements the order. `appearanceFeature.dependsOn` is
  `['sets', 'edits']`; `setsFeature.dependsOn` is `['edits']`; `replacementFeature.dependsOn` is
  `['appearance']`.
- **Selection.** `sets.select` drops keys an edit layer deleted as it writes (they are gone);
  `effectiveSelection` drops hidden ones as the style composes (hiding is reversible, so the
  selection comes back when the object does). Tested both ways.
- **Every edits command commits**, including `edits.enableLayer`, so the transaction boundary is one
  command and a layer toggle is reversible in the same way an edit is.
- **Replacement hides by change table.** The hook writes only the keys whose rows have to move
  (`replacementChanges`), and restores a key that stopped being replaced at whatever visibility the
  styling resolved. It runs after the appearance hook because of the dependency, so an appearance
  rewrite under it does not un-hide a replaced object. Tested.

## Requests

1. **`src/index.ts`**: add the six export lines above.
2. **`package.json`**: `@bim-open-toolkit/viewer` as a **devDependency** of `@bim-open-toolkit/features`.
   The real-session tests import `createSession` and `featureHost` from it. It resolves today
   through the workspace symlink and the root tsconfig `paths`, and it is test-only, so the built
   `tsconfig.build.json` (which includes `src` alone) never sees it — but the manifest should say so.
3. **Track V, persistence**: honour `ephemeralSlices` from `@bim-open-toolkit/features` when writing
   a scene document. The replacement slice must not be saved (alpha decision, restated in
   `visualization/docs/replacement.md`). Its schema round-trips faithfully because a session reads a
   slice back through it; the exclusion has to happen at save time.
4. **Track V or the supervisor**: a home for `test/appearance-fixture.ts`. It is shared by all four
   FA test files and only lives under an `appearance` name because that is what my fence allows;
   `test/support/fixture.ts` would be the honest place.
5. **Naming, for the supervisor to settle.** `workflows/src/recipe.ts` names `style.addRule`,
   `sets.create`, `selection.setFromSet` and `sets.isolate`. I implemented the brief's names:
   `appearance.addRule`, `sets.define`, `sets.selectSet`, `sets.isolate`. Only `sets.isolate`
   matches. Either the recipe's `workflowCommands` map changes, or wave 3 adds aliases; I have not
   added aliases, because two names for one command is two public APIs.

## Findings

- `styleComposition` gives no way to supply a `selectionChange`, so the selection colour is fixed at
  M1's `defaultSelectionChange`. F08 asks for "selected versus context appearance" to be
  configurable. Not blocking; a request for M2 if a UI needs it.
- `SceneBinding.applyStyles` addresses every row of the model on every change. With change detection
  that costs nothing downstream, and the "writes nothing the second time" test asserts it — but it
  is a full pass per command. If a HUD or a hover ever dispatches per frame, that is the thing to
  measure first.
- The M1 `Session.read` in Track V's implementation validates against the slice schema on every
  read. `resolveAppearance` reads three slices per model per change; on a big model that is three
  schema walks over the rule list per render write. Worth watching, not worth changing yet.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | ~12 | 7.0 s | 4: an invented `toMatrix`, a command input typed as `number[]` against a `Matrix4` schema, two unused imports | Reports Track FB's and FC's mid-edit files too; had to grep for my own paths | Keep. Cheapest real signal here |
| `eslint` (untyped set) | 3 | 13.6 s over the whole package | 0 | Twice the cost of tsc for nothing tsc did not already have | Keep only as a cheap style gate; its value on this track was zero |
| `vitest` (my four files) | ~10 | 7.9 s | 5: two float32 comparisons, two wrong document paths in a negative test that made it pass for the wrong reason, and one real bug — clearing a replacement left the row hidden because the appearance hook does not watch the replacement slice | None | Keep. Every design error on this track was found here, not by a type |
| `vitest` (whole package) | 2 | ~5 s | 0 for FA | Fails on other tracks' mid-edit files | Run once at the end, as briefed |
