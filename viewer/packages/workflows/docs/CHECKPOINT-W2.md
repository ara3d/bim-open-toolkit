# Checkpoint W2 — recipe command names corrected to the feature packages' own names

Fence: `src/recipe.ts`, `test/recipe*`, `docs/workflows.md`, `README.md`, this file.
Verified against the `command({ name: ... })` calls in `features/src/*.ts` (source over checkpoint).

## Mapping (old name -> new name, input change)

| Old | New | Input change |
|---|---|---|
| `model.open` | `model.open` | none — not a `features` command, unchanged |
| `results.showTable` | `results.showTable` | none — not a `features` command, unchanged |
| `sets.create` | `sets.define` | none — `{id, name, members}` already matches |
| `selection.setFromSet` | `sets.selectSet` | `{setId}` -> `{id}` |
| `sets.isolate` | `sets.isolate` | none — already matched, unused by any of the ten recipes yet |
| `style.addRule` | `appearance.addRule` | `StyleRule` fields at top level -> wrapped as `{rule: StyleRule}` |
| `overlays.add` | `overlays.add` | none — already matched |
| `views.save` | `navigation.saveView` | `savedViewRecord` (`id,name,view,selection,rules,filter,savedAt`) -> `{id, name, selection?, rules?}`; the feature saves the session's current camera, so `view`, `filter`, `savedAt` are dropped |
| `views.link` | `comparison.link` | see "No feature command fits" below |
| `timeline.setDate` | `animation.seek` | see "No feature command fits" below |
| `clipping.setBox` | `clipping.setBox` | none — already matched, unused by any of the ten recipes yet |
| `capture.image` | `capture.image` | none — already matched |

## No feature command fits the recipe's actual payload

Two renames are correct by name but the *payload* the workflow files build for them does not fit
the feature's input schema, and those files are outside this fence:

- **`comparison.link`** takes `{linked: boolean}` only — it toggles camera linking, nothing else.
  `02-revision-comparison.ts`, `04-pricing-alternatives.ts` and `09-material-carbon.ts` each build
  `workflowCommands.linkViews` with `{views: [...]}`, naming the models or scenarios being compared.
  No feature command accepts that; the closest is `comparison.load` (`before`, `after`,
  `correspondences`), which is a different step already dispatched by nothing here. Needed: change
  each of those three `extraSteps` to `{linked: true}` (losing the per-view descriptors), or decide
  `comparison.load`'s shape is what these three actually mean and add that step instead.
- **`animation.seek`** takes `{timeMs: number}`. `05-delivery-timeline.ts` builds
  `workflowCommands.setTimelineDate` with `{date: input.asOfDate}`. Needed: `{timeMs: <asOfDate as
  milliseconds since the epoch>}`.
- `test/02-revision-comparison.test.ts:35` asserts the literal `'views.link'` is among the dispatched
  commands; it now fails (`toContain('views.link')` against a recipe that dispatches
  `comparison.link`). Needed: change the literal to `'comparison.link'`.

None of these four files are in this fence (`02-revision-comparison.ts`, `04-pricing-alternatives.ts`,
`09-material-carbon.ts`, `05-delivery-timeline.ts`, and the one test file above); listed here rather
than edited.

## No `// TODO: no feature command yet` steps

Every name `workflowCommands` lists now has a feature command of that exact name behind it. The gap
above is a payload mismatch in call sites outside this fence, not a missing command.

## Commands and results

From `viewer/`:
- `npx tsc --noEmit -p packages/workflows/tsconfig.json` — clean.
- `npx eslint packages/workflows` — clean.

From `viewer/packages/workflows/`:
- `npm test -w @bim-open-toolkit/workflows` — 135 tests, 134 passed, 1 failed:
  `test/02-revision-comparison.test.ts > ... > reads the two revisions at two revisions of one model
  identity`, the literal-`'views.link'` assertion above. Every other test, including the new
  `test/recipe-names.test.ts` (10 cases, one per workflow, run for real against its fixture and
  checked that every dispatched command name is in `workflowCommands`), passes.

## New test

`test/recipe-names.test.ts` runs all ten workflows against their `test/expected` fixtures (same
inputs the existing per-workflow tests use) and asserts every command name in every resulting
`recipe` is one of `Object.values(workflowCommands)`. This is what catches an `extraSteps` command
built inside a workflow file rather than inside `standardRecipe`.

## Commit

`recipe.ts`, `test/recipe.test.ts`, `test/recipe-names.test.ts`, `docs/workflows.md`, `README.md`:
committed together, hash below.

## Tooling

| Check | Runs | Wall time | Real defects caught | Verdict |
|---|---|---|---|---|
| `tsc --noEmit` | 1 | ~8 s | 0 (the mismatches above are shape-correct JSON the schema-less `ResultRecord` type cannot see) | keep, cheap |
| `eslint` | 1 | ~90 s (background) | 0 | slow relative to signal, ran once at the end |
| `vitest run` (package) | 2 | ~2-40 s (cold vs warm) | 1 real: the out-of-fence literal-name test above; would have caught the `{setId}` vs `{id}` and flat-vs-wrapped `addRule` shape mismatches too, had they not been fixed before the first run | the only check that caught anything of substance |
