# Appearance and edits

Contract: V1. State: verified (focused tests; integrated build owned by supervisor). Owned files: `src/appearance.ts`, `src/edits.ts`, their two test files, and this checkpoint.

`createCategoricalColorMap(entries, missingColor)` distinguishes number/string/boolean keys and returns a legend with an explicit Missing entry. Duplicate keys are rejected. `createNumericColorMap({min,max,low,high,missingColor})` interpolates linear RGB, clamps finite values and treats absent/nonfinite values as missing. Constant ranges use the midpoint. Both return `color(value)` and `legend`.

`composeAppearance(objects, options)` overlays ordered rules, an optional identity visibility allowlist, then optional selection color. Base invisibility and rule hides cannot be reversed by rules, filter or selection. Empty allowlists hide everything. Later edit operations may deliberately restore visibility before this composition. Inputs remain untouched. Compile rule membership once per composition; runtime is linear in objects plus rule memberships.

`composeEdits(objects, layers)` applies enabled layers in order, returning objects, tombstones and diagnostics. Deletion prevents later re-addition or modification for the same reference during that composition. Unknown references and duplicate base/add records are diagnosed; invalid operations are skipped. Transform operations replace the complete column-major matrix. Unchanged records share readonly input data; callers must respect readonly types.

Example: `composeAppearance(composeEdits(base, layers).objects, {rules, selection, selectionColor: [1, 1, 0]})`.

`createEditHistory()` creates an immutable history. `commitEditHistory(history, layers)` snapshots the complete layer list as one transaction and clears redo. `undoEditHistory` and `redoEditHistory` return histories; an empty stack returns the same history. Snapshot data uses platform `structuredClone`; history memory grows with transactions. History pruning and geometry replacement are postponed.

Checks: `../../node_modules/.bin/vitest.cmd run test/appearance.test.ts test/edits.test.ts --maxWorkers=1 --cache=false` passed: 2 files, 6 tests, 480 ms (September 7, 2026). No running processes. No blockers. Implementation commit: `6333d37c0f115d8d7969ad4488c4de3a5500c1ef`. This post-commit checkpoint line is available for the supervisor's integration commit.
