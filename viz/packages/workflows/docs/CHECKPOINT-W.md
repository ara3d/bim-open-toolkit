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

verified. All ten adapters, the shared shapes, the recipes, the Snowdon
projection input, one exact test per workflow against its hand-written expected
file, and one test per workflow against Track S2's generated fixtures.
`tsc`, `eslint` and `npm test -w @bim-open-toolkit/workflows` are all clean at
commit `029fd37`: 24 test files, 121 tests.

## Chunk commits

| Chunk | Commit |
|---|---|
| Shared result shape, door schedule, projection input | `6b4f35c` |
| Revision comparison | `94c28c0` |
| Material carbon | `4727485` |
| Portfolio drill-through | `e3f5843` |
| Shared result, exception, overlay and recipe tests | `87fbd84` |
| Ambiguous carbon factor, README, workflows.md | `0a8c51e` |
| First checkpoint | `0a203c2` |
| Takeoff, pricing alternatives, delivery timeline | `d7f44d4` |
| Valve isolation, access coordination, asset handover, all ten registered | `d44abc8` |
| Generated door schedule and takeoff tests, `observationJson` | `eb1308f` |
| Portfolio: report a document naming a building nobody holds | `46251cd` |
| Tests for the trace's and the coordination check's own claims | `de57fb8` |
| Coordinate frames for access coordination (open question 6) | `50a3b66` |
| Two delivery records of one type read as a conflict | `29f9799` |
| Note on where the expected files and the adapters differ | `25284eb` |
| Checkpoint after all ten adapters | `50de1d3` |
| Place a door schedule exception by lookup, not by scan | `dc98fa8` |
| Colour and roll up by lookup, not by rescanning | `b342216` |
| Full suite result and README | `835e197` |
| The withheld takeoff subtotal, tested and no longer coloured settled | `fa438dc` |
| Two rates matching one scope leave it unpriced, tested | `58bbad5` |
| The other eight adapters on generated fixtures | `11e197d` |
| An unverified pipe away from the trace is not a coverage gap | `da93dc9` |
| Bounds a coordination participant's sources dispute | `029fd37` |

Every commit staged its own files by explicit pathspec. Twice another track's
files were staged in the shared index while this track was committing; the
pathspec commits left them alone and their owner committed them.

## Delivered

**Shared.** `values.ts` (result rows as JSON, absent fields left out),
`observation.ts` (the JSON form of model's `Observation`, its schema, and the
conversions both ways), `coordinates.ts` (a schema for `CoordinateContext`,
which model states but does not publish), `exception.ts` (one exception shape
for all ten), `outcome.ts` (five outcomes, their appearance and precedence),
`overlay.ts` (markers, labels, directed lines, anchored to an object or a
point), `records.ts` (M1 values as plain records for command inputs), `keys.ts`
(object keys, named sets, diagnostics, the suggested view), `recipe.ts` (the
public command names in one place and the standard ordered recipe),
`result.ts` (`WorkflowResult` and its builder), `workflow.ts` (the
registry-facing workflow that validates its own input), `registry.ts`.

**The ten workflows**, `src/01-door-schedule.ts` to
`src/10-portfolio-drill-through.ts`, each exporting its input types, its input
schema, its `run` and its descriptor, all registered in `registry.ts`.
`door-projection.ts` reads the door table of an
`ara3d.building-workflow-projection` version 1 envelope as a second input to
the door schedule.

**Tests.** One per workflow comparing result rows and exception rows exactly
against the hand-written expected file, plus tests for the behaviour the brief
names that a fixture does not exercise; the shared result, exception, overlay
and recipe helpers; the door schedule against a hand-made sample in the
projection's shape (no private data); and the door schedule and the takeoff
against Track S2's generated fixtures, asserting the generator's own
documented gap counts.

Zero escape hatches: no `any`, no `as` cast, no non-null assertion, no
compiler or lint directive anywhere in `src` or `test`.

## The eight open questions from CHECKPOINT-W0

1. **Observation nesting.** Adapters work on model's `Observation`. Inputs and
   result rows carry its JSON form, `ObservationJson`
   (`{kind, value, unit?, evidence?}` / `{kind, reason, evidence?}` /
   `{kind, values, unit?, evidence?}`), converted by `toObservation` and
   `observationJson` and written by `observationCell`. The three round-trip.
   Evidence is carried and written only when there is some, so the fixtures
   needed no change to their observation fields. A conflict keeps its unit only
   when every disputed value reports the same one; the fixtures state no unit
   for their conflicting values, so none is invented for them.
2. **Two-revision identity.** Both, and they do different jobs. The two
   snapshots are two revisions of one model identity (`modelA` and `modelB`
   with the same `id` and different `revision`), so an object of revision A and
   an object of revision B are two different object keys and a scene can hold
   both. The supplied correspondence table stays, because the ids differ across
   revisions and a correspondence is input, never inferred.
3. **Exception row shape.** Unified, one shape for all ten workflows:
   `{subjects, related, field, scope, observation, detail}`, rendered as a row
   with `related`, `scope` and `detail` left out when empty. This is the change
   behind most of the corrections listed below.
4. **Rate and factor ambiguity.** More than one match is itself unresolved.
   Workflows 04 and 09 report `unresolved-source` with the number of matching
   rates or factors rather than taking the first, which is the same treatment
   workflow 02 gives a correspondence with more than one candidate.
5. **Delivery-timeline demotion.** The fixture's non-demoting rule stands: a
   known higher state is not demoted because a lower step was never recorded,
   and the unrecorded steps are a coverage note on the row. Two records of one
   event type are merged rather than one replacing the other, so two records
   that disagree read as a conflict and that date drops out of the ranking.
6. **Coordinate-frame checking.** Done. Each of workflow 07's two tables states
   the frame its boxes are in; a penetration box is read into the envelope
   frame before anything is compared, and two frames that cannot be related
   produce no finding at all and one exception naming both. Comparing boxes
   across an unstated frame is exactly how a confident wrong answer is
   produced, so the run reports the frames instead.
7. **Multiple resolved metrics per building.** Both are kept: each resolved
   metric is its own drill-through row naming the document it came from, and
   the site rollup adds up every resolved figure of the requested metric.
   `resolvedBuildingCount` counts buildings, not rows. Figures reported in more
   than one unit are not added up at all: the site is reported without a total.
8. **Unify before writing ten adapters.** Yes, done before the third adapter,
   as question 3 records.

## Corrections to the expected files

Every correction below changes the *shape* a row is written in, never which
rows are expected, which subject they are about, their reason, or their
disputed values, with the one exception marked. A note beside the fixtures
(`test/expected/README.md`) says the same thing to a reader who opens one.

| File | Correction | Reason |
|---|---|---|
| all ten `.json` | `expected.exceptions` rows rewritten to the unified shape: `objectId` becomes `subjects`, candidate lists become `related`, a scenario becomes `scope`, everything else becomes `detail` | question 3: one exception shape across ten workflows, decided before the adapters were written, which is cheap now and expensive later |
| `01-door-schedule.json` | input door rows carry their fact columns under `facts` instead of at the top of the row | model's `object()` returns the value it was given, so an input contract cannot accept a row of arbitrary extra columns without an escape hatch. Nesting keeps the schema purely validating and honest. No expected value changed |
| `05-delivery-timeline.json` | EQ-4's `coverageNote` becomes `"delivered, accepted not observed"` | the `.md` worked example names only `accepted`, but EQ-4 has no `delivered` event either. The rule is every lower-ranked state with no known qualifying date, in ranking order. This is the only correction to a result row |
| `03-takeoff.json` | the cross-context fields (`finishType` on an area exception, `areaM2` on a finish exception) become a `detail` sentence | the unified shape has one place for context |
| `05`, `06`, `09` `.json` | exception rows gain a `field` where the hand-written row had none (`events`, `topologyStatus`, `factor`) | the unified shape names the field or step that could not be used; each names the column the gap is about |
| `10-portfolio-drill-through.json` | `metricId` and `documentId` become `subjects: [metricId, documentId]`; `candidateBuildingIds` becomes `related`; the details are reworded as sentences | the unified shape; nothing about which metrics are exceptions changed |

## Remaining work

- Wave 3 wires the recipes: the command names in `src/recipe.ts` do not exist
  yet, and nothing here has ever dispatched one.
- Two generated-fixture tests lean on a generator setting rather than on the
  adapter's own reachability: the valve isolation test asks for one fixture per
  branch so that every unverified connection touches the trace, and the carbon
  and pricing tests count only the quantity gaps because the factor and rate
  sets' own holes are policy rather than coverage. Both are explained in place.
  A generator that published which of its gaps a trace should reach would let
  those assertions stand without the tuning.

## Commands and their actual results

From `viewer/`:

- `npx tsc --noEmit -p packages/workflows/tsconfig.json` — clean for every
  chunk above; 18.1 s.
- `npx eslint packages/workflows` — clean for every chunk above; 13.5 s for a
  single file, so the cost is startup, not file count.

From `viewer/packages/workflows/`:

- `npm test -w @bim-open-toolkit/workflows` — 24 files, 121 tests passed, at
  commit `029fd37`. Runs while a nested worker was writing in this package were
  per-file, so its unfinished files could not fail a check of mine.

## Blockers

None.

## Requests to the supervisor

1. `viewer/packages/workflows/package.json` needs
   `@bim-open-toolkit/synthetic` as a dev dependency. The generated-fixture
   tests import it; it resolves today through the workspace tsconfig paths and
   the shared vitest aliases, so both the typecheck and the tests pass, but the
   manifest does not declare it and this package is published.

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
3. **A schema for `CoordinateContext`.** Written here in `src/coordinates.ts`
   because workflow 07 has to be given two frames as JSON. It is model's type;
   the schema belongs beside it.
4. Minor: `sumQuantities` refusing to add mixed units is exactly what workflow
   10 needed, `mergeObservations` is what the delivery timeline needed for two
   records of one event, and `coverageByName` is what the door schedule
   summary reports. No change wanted; recorded because all three were reused
   unchanged.

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
- Track S2's generators publish their facts as model `Fact`s and their gaps as
  model `Coverage`, which is what let an adapter be run against one and checked
  against the generator's own numbers rather than against numbers observed by
  running it. That is worth keeping as the convention for the rest.
- A type with two states where the data has three hides the third. Workflow
  07's box observation had only known and missing, so a participant surveyed
  twice with two different answers had to be read as simply missing, losing the
  fact that somebody measured it and the answers disagree. It has three now.
  The generated fixtures found this, because the generator models the case and
  the adapter had nowhere to put it.
- Asking the building generator for a building with no gaps still leaves fire
  ratings that do not apply. That is correct: a door in a room whose use is not
  fire rated has no rating to record, `not-applicable` says so, and it still
  belongs in the exceptions table. A gap and a non-applicability are different
  things and the vocabulary keeps them apart.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/workflows` | 12 | 18 s | 0 in code that had a test | Whole-package scope: with workers writing other files in the same package, a run reports their in-progress errors and cannot be scoped to mine | neutral |
| `eslint packages/workflows` | 8 | 13.5 s | 0 | Cost is startup, not file count, so linting one file costs the same as linting the package | hindrance at this cost for this benefit; it has caught nothing in this package |
| `vitest run <files>` | 20 | 0.7 s warm, 20 s cold | 3: the schema that silently did not convert, a subtotal that would have added two units together, and an assumption that a complete building has no unavailable fire rating | None. Per-file runs keep concurrent workers from tripping over each other | helpful |
| Hand-written expected files as the acceptance test | — | — | They are the reason the adapters are honest rather than plausible: every row was decided before any code existed | Their exception rows were ten different shapes, which cost one unifying pass | helpful |
| Generated fixtures as a second test | — | — | Confirms the adapters agree with an independently generated data set and its documented gap counts | Needs a small reader per generator, and an undeclared dev dependency | helpful |
| Sonnet workers for adapters 3 to 8 and the generated tests | 3 agents | 12, 12 and 22 minutes | They produced adapters and tests that matched the fixtures on the first run, and the third found a real hole in an adapter's types | Each needed the full brief, the pattern and an exact sub-fence; they cannot commit, so integration is a review pass. Review found four honesty gaps in their six adapters (a subtotal across two units, two records of one event silently replacing each other, a directed line between segments that only happened to be adjacent, and a workflow with no overlays at all), which is the cost of the speed | helpful with review, not without |
