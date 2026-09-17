# Track M checkpoint — model contracts

State: verified (all chunks implemented and green against the assigned gates)
Contract revision in force: P0 (the text of `docs/plans/visualization/V2-PLAN.md`). Acknowledged.
Proposed revision: M1, written up in [CONTRACTS-M1.md](CONTRACTS-M1.md) for the supervisor to review.
Chunk 1 published the stub `M1-stub` that Track S imports from; those names have not changed since.

Fence: `viewer/packages/model/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json` and
`vitest.config.ts` (supervisor-owned). Nothing outside the fence was written.

Nested sub-agents spawned: 0. The work was small enough per chunk that a written spec for a Sonnet
worker would have cost more than doing it.

## Chunks and commits

| # | Concern | Commit | State |
|---|---|---|---|
| 1 | Stub types Track S needs: result, math, identity, coordinates, objects, style appearance, table, mesh, facts | `325e9d1` | verified |
| 2 | Schema combinators | `fdfd508` | verified |
| 3 | Object sets and named sets | `ca7de9d` | verified |
| 4 | Edit layers and undo history | `20d2968` | verified |
| 5 | Style rules, precedence and scene composition | `4377ddd` | verified |
| 6 | View state, framing and saved views | `478984c` | verified |
| 7 | State slices and the scene document | `e2d71de` | verified |
| 8 | Table select, filter, sort and join | `9736d6d` | verified |
| 9 | Fact lookup, reconciliation and coverage | `b5682d0` | verified |
| 10 | Feature, command, event and session | `7f484e8` | verified |
| 11 | `docs/CONTRACTS-M1.md`, `README.md`, this checkpoint | this commit | verified |

## Delivered

19 modules in `src`, 351 exported declarations, 2,470 lines of source and 1,703 lines of test.
One test file per module plus `test/session-fixture.ts` (a working `Session`) and
`test/readme.test.ts` (the README examples, run, so the documentation cannot drift).

Every concern the brief lists is present: identity, coordinates, sets, style with rule ordering and
the full composition, edit layers with undo and redo, view state and saved views, `StateSlice<S>`
with the scene document and migration, schema combinators with JSON-schema description, `Result` and
`Diagnostic`, the facts vocabulary, the columnar `Table`, mesh and instance data, and the `Feature`,
`Command`, `Event` and `Session` contracts.

No runtime dependencies of any kind. No `any`, no `as` cast, no non-null assertion, no compiler or
lint directive, in `src` or in `test`. One type predicate (`narrow` in `schema.ts`) is the single
point where a completed runtime check establishes a static type; see the escape-hatch section of
CONTRACTS-M1.md for why it cannot be avoided and what the alternative would be.

## Commands and results

Run from `viewer/` after chunk 11, 2026-09-07:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, no output, 5.4 s |
| `npx eslint packages/model` | pass, no output, 13.4 s |
| `npm test -w @bim-open-toolkit/model` | pass, 18 files, 198 tests, 1.6 s |

All three were run before every chunk commit. The combined gate
(`tools/platonic-check.mts`) is the supervisor's to run.

## Verification limits

- Only this package was checked. Nothing here has been used by another package yet, so the contracts
  are proven implementable (the session fixture) but not proven convenient.
- No performance measurement was taken in this package. The table and instance shapes follow the
  measurements in `viewer/packages/testing/docs/instance-updates.md`, which were taken against alpha
  renderer objects, not against this code.
- `Matrix4` conventions are asserted by unit tests, not against a renderer. The first track that
  binds a matrix to three.js should confirm the column-major layout end to end.
- Migration is tested through declared steps only. No document written by an earlier real version
  exists yet.

## Blockers

None.

## Requests to the supervisor

1. Review revision M1 in [CONTRACTS-M1.md](CONTRACTS-M1.md), in particular the four deliberate
   departures from P0: `Session` in its own module, `Command` erasing its input type,
   `OptionalSchema` as the optionality marker, and `resolveStyles` taking the scene's object keys.
2. No change is needed to the supervisor-owned files in this package. `package.json`,
   `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts` are all correct as they stand.

## Findings

- The instance-update study landed while this track was running and is directly relevant. Two of its
  recommendations are already reflected here: bulk updates travel as a `Table` of changed columns
  (recommendation 8), and sorting rows into buffer order before writing them is a first-class table
  operation (recommendation 5). The remaining recommendations are for `render`, not for `model`:
  publish once per bulk update, record dirty slot ranges, detect a full-table update and drop the
  row index, one allocation per attribute, no per-group bulk API, visibility as a column write. The
  columnar `InstanceRecords` here already gives one allocation per attribute for the whole model.
- The alpha `RepresentationTable` idea in P0 lists `objectIndex`, `groupIndex` and `instanceIndex`.
  `InstanceRecords` here carries `meshIndex`, `transform`, `color` and `objectIndex`: the row itself
  is the instance, and mapping rows to renderer groups is `render`'s business, not the model's. If
  the supervisor wants group and instance indices in the model-level shape, say so and it is a small
  addition.
- The previous Track M agent stalled after writing chunk 1 without verifying it. The code it wrote
  passed all three checks unchanged; one comment was corrected (`Coverage` said four counts sum to
  `total`; it is three).
- `edits.ts` has `addLayer`, `removeLayer` and `updateLayer`, which are ordinary list operations on
  records with an id. If a second concern needs the same three, extract them rather than copying;
  `style.ts` deliberately does not have them for that reason.
- `History<S>` is unbounded. A long editing session will want a limit. Noted, not built, because
  nothing yet knows what the limit should be.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction or false positives | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 12 | 5 s each once warm, 25 s cold | 3, all real: an over-eager optional-property inference (a schema of `unknown` became an optional property), a variance error that forced the `Command` design, and a union-inference question it answered in a 5-line probe | none | helpful, and cheap enough to run on every edit |
| `eslint` (typed rules) | 12 | 13 s on 19 source and 20 test files | 3, all in tests: two `expect.closeTo` results typed `any` flowing into `toEqual`, and one variable used only as a type | the `any` from `expect.closeTo` is a vitest typing issue, not a defect in the code, but rewriting the assertion made it clearer, so not a false positive | helpful, but 13 s for 39 small files is the cost to watch as packages grow |
| escape-hatch grep (`any`, `as`, `!`, directives) | 4 | under 1 s | 0 | matches prose comments containing the word "as", so it needs eyes on the output; a parser-based scan would not | neutral: cheap insurance, no defects found because the constraint was applied while writing |
| `vitest` | 12 | 0.6 to 1.6 s for 198 tests | 4, all real: a stale set-order expectation, two wrong precedence expectations while composing styles, one wrong migration expectation | none; the suite is fast enough to run on every save | helpful, the highest value per second of the four |
| strict compiler settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | with each tsc run | included above | they are what makes writing this without casts possible at all: indexed access returning `T \| undefined` forced explicit fallbacks in the mesh, table and history code, several of which were real edge cases (an empty column, an empty history, a row past the end) | `exactOptionalPropertyTypes` makes optional properties on plain-data records tedious: every one has to be declared `?: T \| undefined` | helpful, keep both |
