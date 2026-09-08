# Checkpoint W3 — recipe step payloads matched to the feature schemas

Fence: `src/02-revision-comparison.ts`, `src/04-pricing-alternatives.ts`, `src/05-delivery-timeline.ts`,
`src/09-material-carbon.ts`, `test/02-revision-comparison.test.ts`, this file.

## Changes per file

- `02-revision-comparison.ts`, `04-pricing-alternatives.ts`, `09-material-carbon.ts`: the `comparison.link`
  extra step now sends `{ linked: true }` (its only accepted input). The revision ids / scenario ids that
  used to sit in the dropped `{views: [...]}` payload are now stated in the step's own `note` text instead
  (e.g. "Show both revisions side by side (`<rev A>` and `<rev B>`).").
- `05-delivery-timeline.ts`: `animation.seek` now sends `{ timeMs: Date.parse(input.asOfDate) }` instead of
  `{ date: input.asOfDate }`.
- `test/02-revision-comparison.test.ts:35`: literal `'views.link'` -> `'comparison.link'`.

## Unparseable-date rule

If `Date.parse(input.asOfDate)` is not finite, the workflow does not guess a `timeMs` (not `0`, not "now"):
it omits the `animation.seek` extra step entirely and adds a `workflowException([], 'asOfDate', missing('unresolved-source'), ...)`
naming the unparsed string. No fixture exercises this path — `generateDeliverySchedule`'s `asOfDate` is
always a valid `IsoDate` — but the rule is in place and documented at the call site.

## Commands and results

From `viewer/`:
- `npx tsc --noEmit -p packages/workflows/tsconfig.json` — clean.
- `npx eslint packages/workflows` — clean.
- `npm test -w @bim-open-toolkit/workflows` — 135 tests, 135 passed (was 134/135 before this fence).

No conflict with M5's in-flight edit to `src/observation.ts`; not touched here, no retry needed.

## Commit

`02-revision-comparison.ts`, `04-pricing-alternatives.ts`, `05-delivery-timeline.ts`,
`09-material-carbon.ts`, `test/02-revision-comparison.test.ts`, this file: `3bbad2a`.

## Tooling

| Check | Runs | Wall time | Real defects caught | Verdict |
|---|---|---|---|---|
| `tsc --noEmit` | 1 | ~8 s | 0 (shape mismatch was invisible to the schema-less `ResultRecord` type) | keep, cheap |
| `eslint` | 1 | ~15 s | 0 | keep, cheap here |
| `vitest run` (package) | 2 | ~2-5 s | 1 real: the stale `'views.link'` literal | the only check that caught anything |
