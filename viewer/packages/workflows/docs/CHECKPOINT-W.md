# Track W checkpoint — workflow adapters and recipes

Wave 1 of the visualization V2 plan. Opus track lead. Fence:
`viewer/packages/workflows/**` except `package.json`, `tsconfig.json`,
`tsconfig.build.json` and `vitest.config.ts`, which the supervisor owns.

Contract revision: **M1** at commit `641624b`
(`viewer/packages/model/docs/CONTRACTS-M1.md`). Nothing in `model` was edited.
Note that `model` has been committed to since M1 by another track
(`31ef243`, instance records as a table); this package typechecks and tests
against the working tree at each check recorded below.

## State

working — six chunks landed; workflows 3 to 8 are with two Sonnet workers and
are not yet reviewed or committed.

## Chunk commits

| Chunk | Commit | Checks at the time |
|---|---|---|
| Shared result shape, door schedule, projection input | `6b4f35c` | tsc clean, eslint clean, 12 tests pass |
| Revision comparison | `94c28c0` | tsc clean, eslint clean, 6 tests pass |
| Material carbon | `4727485` | tsc clean, eslint clean, 5 tests pass |
| Portfolio drill-through | `e3f5843` | tsc clean, eslint clean, 6 tests pass |
| Shared result, exception, overlay and recipe tests | `87fbd84` | eslint clean, 23 tests pass |
| Ambiguous carbon factor, README, workflows.md | `0a8c51e` | 6 tests pass |

## Delivered so far

Shared: `values.ts` (result rows as JSON, absent fields left out),
`observation.ts` (the JSON form of model's `Observation`, its schema, and how
one is written into a row), `exception.ts` (one exception shape for all ten),
`outcome.ts` (five outcomes, their appearance and precedence), `overlay.ts`
(markers, labels, directed lines, anchored to an object or a point),
`records.ts` (M1 values as plain records for command inputs), `keys.ts`
(object keys, named sets, diagnostics, the suggested view), `recipe.ts` (the
public command names in one place and the standard ordered recipe),
`result.ts` (`WorkflowResult` and its builder), `workflow.ts` (the
registry-facing workflow that validates its own input), `registry.ts`.

Workflows: 01 door schedule (with `door-projection.ts`, the door table of an
`ara3d.building-workflow-projection` version 1 envelope as a second input),
02 revision comparison, 09 material carbon, 10 portfolio drill-through.
Each has a test comparing its result rows and exception rows exactly against
the hand-written expected file, plus tests for the behaviour the brief names
that the fixture does not exercise.

## The eight open questions from CHECKPOINT-W0

1. **Observation nesting.** Adapters work on model's `Observation`. Inputs and
   result rows carry its JSON form, `ObservationJson`
   (`{kind, value, unit?, evidence?}` / `{kind, reason, evidence?}` /
   `{kind, values, unit?, evidence?}`), converted by `toObservation` and
   written by `observationCell`. The two round-trip. Evidence is carried and
   is written only when there is some, so the fixtures needed no change to
   their observation fields. A conflict keeps its unit only when every
   disputed value reports the same one; the fixtures state no unit for their
   conflicting values, so none is invented for them.
2. **Two-revision identity.** Both, and they do different jobs. The two
   snapshots are two revisions of one model identity (`modelA` and `modelB`
   with the same `id` and different `revision`), so an object of revision A
   and an object of revision B are two different object keys and a scene can
   hold both. The supplied correspondence table stays, because the ids differ
   across revisions and a correspondence is input, never inferred.
3. **Exception row shape.** Unified, one shape for all ten workflows:
   `{subjects, related, field, scope, observation, detail}`, rendered as a row
   with `related`, `scope` and `detail` left out when empty. This is the
   change behind most of the corrections listed below.
4. **Rate and factor ambiguity.** More than one match is itself unresolved.
   Workflow 09 reports `unresolved-source` with the number of matching factors
   rather than taking the first, which is the same treatment workflow 02 gives
   a correspondence with more than one candidate. Workflow 04 follows the
   same rule.
5. **Delivery-timeline demotion.** The fixture's non-demoting rule stands: a
   known higher state is not demoted because a lower step was never recorded.
   The unrecorded steps are a coverage note on the timeline row. See the
   correction to EQ-4 below.
6. **Coordinate-frame checking.** Not implemented. Workflow 07 compares boxes
   the input states are in one registered frame, as its fixture says. Doing it
   properly needs a `CoordinateContext` per table and a refusal when
   `contextTransform` cannot relate them; it is listed under remaining work
   rather than half-done, because a frame check that silently succeeds is
   worse than none.
7. **Multiple resolved metrics per building.** Both are kept: each resolved
   metric is its own drill-through row naming the document it came from, and
   the site rollup adds up every resolved figure of the requested metric.
   `resolvedBuildingCount` counts buildings, not rows, so a building with two
   documents counts once. Figures reported in more than one unit are not added
   up at all: the site is reported without a total.
8. **Unify before writing ten adapters.** Yes, done before the third adapter,
   as question 3 records.

## Corrections to the expected files

Every correction below changes the *shape* a row is written in, never which
rows are expected, which subject they are about, their reason, or their
disputed values, with the one exception marked.

| File | Correction | Reason |
|---|---|---|
| all ten `.json` | `expected.exceptions` rows rewritten to the unified shape: `objectId` becomes `subjects`, candidate lists become `related`, a scenario becomes `scope`, everything else becomes `detail` | question 3: one exception shape across ten workflows, decided before the adapters were written, which is cheap now and expensive later |
| `01-door-schedule.json` | input door rows carry their fact columns under `facts` instead of at the top of the row | model's `object()` returns the value it was given, so an input contract cannot accept a row of arbitrary extra columns without an escape hatch. Nesting keeps the schema purely validating and honest. No expected value changed |
| `05-delivery-timeline.json` | EQ-4's `coverageNote` becomes `"delivered, accepted not observed"` | the `.md` worked example names only `accepted`, but EQ-4 has no `delivered` event either. The rule is now: every lower-ranked state with no known qualifying date, in ranking order. This is the only correction to a result row |
| `09-material-carbon.json` | exception rows gain `field: "factor"` on the two factor exceptions | the unified shape requires a field; the two rows had a `detail` about the factor and no field |
| `10-portfolio-drill-through.json` | `metricId` and `documentId` become `subjects: [metricId, documentId]`; `candidateBuildingIds` becomes `related`; the detail sentences are reworded to full sentences | the unified shape; nothing about which metrics are exceptions changed |

## Remaining work

- Review, integrate and commit workflows 3 to 8 from the two Sonnet workers.
- A coordinate-frame check for workflow 07 (question 6), which needs a
  `CoordinateContext` per input table.
- Second tests running the adapters on Track S2's generated fixtures and
  asserting the documented gap counts appear as exceptions. S2's checkpoint
  (`viewer/packages/synthetic/docs/CHECKPOINT-S2.md`) records only its shared
  cursor, array and date helpers as landed at the time of writing; none of the
  ten generators is available yet, so no adapter can be run against one.

## Commands and their actual results

From `viewer/`:

- `npx tsc --noEmit -p packages/workflows/tsconfig.json` — clean for every
  chunk above; 18.1 s.
- `npx eslint packages/workflows` — clean for every chunk above; 13.5 s for a
  single file, so the cost is startup, not file count.

From `viewer/packages/workflows/`:

- `npx vitest run test/01-door-schedule.test.ts` — 6 passed.
- `npx vitest run test/door-projection.test.ts` — 6 passed.
- `npx vitest run test/02-revision-comparison.test.ts` — 6 passed.
- `npx vitest run test/09-material-carbon.test.ts` — 6 passed.
- `npx vitest run test/10-portfolio-drill-through.test.ts` — 6 passed.
- `npx vitest run test/result.test.ts test/recipe.test.ts test/index.test.ts` —
  23 passed.

The full `npm test -w @bim-open-toolkit/workflows` is deliberately not run
while two workers are writing files in this package; it runs at integration.

## Blockers

None.

## Requests to Track M (model)

1. **A schema that converts what it accepts.** `object()` and `tuple()` return
   the value they were given, so a schema under an object cannot decode a JSON
   encoding into a richer type: the field types would be a lie at runtime,
   which is exactly the defect the door schedule hit. `array()`, `record()` and
   `union()` do carry their checked values through. Either a `mapped(schema,
   convert)` combinator plus an `object` that rebuilds from its checked field
   values, or a documented note that `object` is validate-only, would settle
   it. This package works around it by keeping every input schema purely
   validating and converting inside `run`.
2. **A schema for a closed string vocabulary.** `enumeration(values)` is
   written here over `union(...values.map(literal))`; it belongs in `schema.ts`
   next to `literal`, and would let a generated tool descriptor say `enum`.
3. Minor: `sumQuantities` refusing to add mixed units is exactly what workflow
   10 needed, and `coverageByName` is what the door schedule summary reports.
   No change wanted; recorded because both were reused unchanged.

## Findings

- The type system cannot see the `object()` behaviour above: `tsc` was clean
  while `input.doors[n].facts` was `undefined` at runtime. Only a test caught
  it. Anything that converts inside a schema is worth a round-trip test.
- Model's facts vocabulary carried every exception the ten fixtures need. The
  one place it does not fit is a source that says "the sources disagreed"
  without carrying what they said: the door projection's `Conflicting` reason.
  It is mapped to a conflict with no values, which keeps it out of the missing
  counts and does not invent the disputed values. If that reads wrong to the
  supervisor, the alternative is `missing('unresolved-source')`, which loses
  the fact that a disagreement was recorded.
- The five missing reasons were enough for ten workflows, but three of them
  (`not-provided`, `not-measured`, `unresolved-source`) do most of the work,
  and the boundary between "no rate exists" and "a rate exists that does not
  apply" is a per-workflow decision the vocabulary does not make for you. The
  fixtures state it each time; the adapters follow the fixture.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/workflows` | 8 | 18 s | 0 in my own code | Whole-package scope: with two workers writing other files in the same package, a run reports their in-progress errors and cannot be scoped to mine | neutral |
| `eslint packages/workflows` | 5 | 13.5 s | 0 | Cost is startup, not file count, so linting one file costs the same as linting the package | neutral so far |
| `vitest run <files>` | 10 | 0.7 s warm, 20 s cold | 1, and it was the important one: the schema that silently did not convert | None. Per-file runs keep concurrent workers from tripping over each other | helpful |
| Hand-written expected files as the acceptance test | — | — | They are the reason the adapters are honest rather than plausible: every row was decided before any code existed | Their exception rows were ten different shapes, which cost one unifying pass | helpful |
| Sonnet workers for adapters 3 to 8 | 2 agents | in progress | — | Each needed the full brief, the pattern and an exact sub-fence; they cannot commit, so integration is one more review pass for me | to be scored at integration |
