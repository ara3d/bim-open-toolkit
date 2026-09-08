# Track S2 checkpoint — the remaining synthetic generators

Wave 1 of the visualization V2 plan. Opus track lead. Fence:
`viewer/packages/synthetic/**` except `package.json`, `tsconfig.json`,
`tsconfig.build.json` and `vitest.config.ts`, which the supervisor owns.
Nothing outside the fence was written.

Contract revision: **M1** at commit `641624b`
(`viewer/packages/model/docs/CONTRACTS-M1.md`). Nothing in `model` was edited.

Nested delegates: **none**. Every generator makes design decisions about which
gaps exist and why, which the plan reserves for the track lead, and the twelve
generators share a set of helpers whose shape only settled while they were
written. Snapshots are produced by the package's own test rather than by hand,
so there was no mechanical task left to hand to a Sonnet worker.

## State

**verified** — ten new generators, the catalog, the snapshots, the tests and the
README. `tsc`, `eslint` and `npm test` all clean, results below.

## Files

New in `src`: `arrays.ts`, `cursor.ts`, `dates.ts`, `scene.ts`, `placement.ts`,
`fixtures.ts`, and the generators `services.ts`, `revisions.ts`, `deliveries.ts`,
`quantities.ts`, `costs.ts`, `carbon.ts`, `assets.ts`, `clearances.ts`,
`city.ts`, `field.ts`. Edited: `index.ts`, and `building.ts` and `stress.ts` to
import the shared cursor instead of their private copies (no change in output).

New in `test`: `dates.test.ts`, `services.test.ts`, `revisions.test.ts`,
`deliveries.test.ts`, `quantities.test.ts`, `costs.test.ts`, `assets.test.ts`,
`city.test.ts`, `fixtures.test.ts`, the helper `snapshot.ts`, and twelve JSON
files under `test/snapshots/`.

Docs: this file, and `README.md` gained a section per generator plus the table
conventions, the catalog and the snapshot workflow.

## Delivered behaviour

One generator per module, each deterministic from a seed, each with documented
gaps. What each produces is in the README; what each gap is for, in one line:

| Generator | The gap it exists to make visible |
|---|---|
| `services` | A branch connection that is recorded but unverified. A trace must leave it out of the affected set and report it at the boundary. The riser is always accepted so a trace has something to walk. Also: a valve nobody located, so it blocks nothing. |
| `revisions` | Both ways a match goes unresolved — a proposal with two candidates, and one object named by two proposals — plus deletions, additions and confidence nobody recorded. |
| `schedule` | Nothing recorded at all, versus not delivered yet; a date nobody wrote down; a date two sources dispute; and a future-dated event, which is normal, not an exception. |
| `quantities` | An area that is a supplied measurement, differing from the mesh by a few per cent, so a takeoff that computed from geometry disagrees with the table. Plus unassigned finishes and disputed areas. |
| `costs` | A scope type nobody prices, a rate in the wrong unit, a scenario in another currency, and two rates matching one scope. |
| `carbon` | A material with no factor, a factor for the wrong lifecycle scope, and a factor in the wrong unit. |
| `assets` | "Never tracked" against "tracked, nothing recorded" — the same zero events, two different facts, carried by a separate register. |
| `clearances` | A box nobody registered and a box surveyed twice, neither testable, neither clear. Candidate overlaps are structural so an adapter can be checked against a count. |
| `city` | A document that names two buildings, one that names none, a building nobody geolocated, and a site whose every figure is unusable so its rollup must be omitted rather than reported as zero. |
| `field` | A corner nobody sampled, as NaN rather than a cold spot. |

Shared helpers, extracted because six or more generators needed them:
`cursor.ts` (the draw cursor `building.ts` and `stress.ts` each had privately),
`scene.ts` (keeping an object record and its instance row in step),
`placement.ts` (a box scaled to a size, an axis-aligned run between two points),
`dates.ts`, `arrays.ts`.

Zero escape hatches: no `any`, no `as` cast, no non-null assertion, no compiler
or lint directive in `src` or `test`. Two consequences worth naming. The
snapshot test compares the file's **text** rather than a parsed object, because
`JSON.parse` returns `unknown` and typing it would need a cast. `fixtureNames`
is written out rather than read from `Object.keys(fixtures)`, for the same
reason; a test asserts the two agree.

## Verification

Run from `viewer/`, all after the last chunk:

| Check | Result |
|---|---|
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | clean |
| `npx eslint packages/synthetic` | clean |
| `npm test -w @bim-open-toolkit/synthetic` | 14 files, 212 tests, all pass, 1.6 s |
| Every default fixture builds in under 500 ms | asserted in `fixtures.test.ts`; the whole catalog builds in about 300 ms, of which the stress scene is most |

Limits of that verification:

- `npx tsc --noEmit -p packages/synthetic/tsconfig.build.json` fails, on the
  files that existed before this track as well as the new ones, because the
  build config resolves `@bim-open-toolkit/model` through `dist` and no V2
  package has been built in this checkout. It is a missing build step, not a
  regression; `build:v2` in dependency order is the supervisor's gate.
- No generator has been rendered. Geometry is asserted structurally — one
  instance row per object, `objectIndex` equal to the row, mesh groups whose
  instance counts sum to the instance count — not visually.
- Determinism is asserted by regenerating in the same process. It is not
  asserted across engines or platforms; the argument for that is the arithmetic
  (integers, multiplication and division only), not a measurement.

## Chunk commits

| Chunk | Commit |
|---|---|
| Shared cursor, array helpers, calendar arithmetic | `7ce5ce5` |
| `services` | `60aa64a` |
| `revisions` | `835755b` |
| `schedule` (module `deliveries.ts`) | `9615e9a` |
| `quantities` | `68e08a9` |
| `costs` and `carbon` | `786d5ea` |
| `assets` and `clearances` | `c73030a` |
| `city` and `field` | `ebbfeaa` — see the note below |
| Fixture catalog and snapshots | `2ac2b34` |
| README and this checkpoint | recorded below when it lands |

**Note on `ebbfeaa`.** That commit holds exactly this track's four files
(`city.ts`, `field.ts`, `index.ts`, `city.test.ts`) but carries Track F's commit
message, "perf(formats): measure the BFAST path and drop the per-instance
closures". What happened: this track's `git add` succeeded, this track's `git
commit` was refused with `index.lock` held by another session, and that
session's next `git commit` then committed the index, which still held this
track's staged files. Its own files had already gone in as `daf335a`, which is
why the same message appears twice. No content was lost and no file was
committed twice. The lesson for the wave: a chunk commit that fails on
`index.lock` leaves the index staged, and another track's commit can pick it up,
so a failed commit should be retried immediately or the staging dropped. A
commit turn granted by the supervisor would prevent it; the standing per-fence
grant in `V2-STATUS.md` does not.

## Where a W0 contract and M1 disagreed

The ten hand-written expected-result files in
`viewer/packages/workflows/test/expected/` are the consumers of these tables.
Every disagreement found, and what was chosen:

1. **`Observation` as a column type.** Every W0 file writes a fact-like field as
   a nested value — `{kind, value, unit}` / `{kind, reason}` / `{kind, values}` —
   and its own checkpoint flags this as a flattened stand-in for M1's
   `Observation`. A `Table` column holds one scalar per cell, so a nested value
   cannot be a cell at all. **Chosen:** the convention Track S already
   established in `schedule.ts` — one observed field becomes `foo`, `fooUnit`,
   `fooState`, `fooMissingReason`, `fooConflict`, `fooEvidence`. The vocabulary
   is M1's exactly (`known`/`missing`/`conflicting`, and the five
   `MissingReason` values), so the mapping is mechanical, and generators that
   also publish facts publish the real `Observation` in their `facts` array.
   Track W reads either.
2. **`null` for an absent identifier.** W0 uses `roomId: string | null`,
   `aId: string | null`. A string column has no null. **Chosen:** the empty
   string plus a `<field>Known` boolean column, which is what the building
   generator already did with `storeyKnown`.
3. **Array-valued columns.** W0 has `bIds: string[]` and
   `buildingIds: string[]`. **Chosen:** a space-separated list in one string
   cell plus a count column, with `splitIds` to read it. `joinIds`/`splitIds`
   are exported so the encoding is not folklore.
4. **A box-valued observation (workflow 07).** W0 writes
   `bbox: Observation of box`. M1's `FactValue` is quantity, text, flag or
   reference — there is no bounds-valued fact, so a box observation cannot be a
   `Fact` at all. **Chosen:** six numeric columns that read NaN when the state is
   not `known`, beside the same four state columns an observed field carries.
   **Request to Track M:** add a `bounds` kind to `FactValue`, or a
   `FactValue` that carries a `Bounds`. It is the only place in these ten
   workflows where M1's vocabulary could not express the data.
5. **Two-revision identity (workflow 02).** W0 uses two disjoint id spaces and
   flags the mismatch with `identity.ts`, where a revision is part of
   `ObjectRef`. **Chosen: both.** Snapshot B keeps the model id and takes a new
   revision, which is M1's model, while its object ids are disjoint from A's,
   which is W0's harder case and the one a real comparison faces. Neither
   convention is contradicted.
6. **Rate and factor ambiguity (W0 open question 4).** W0's fixtures do not
   exercise two rates matching one scope and ask for it to be decided.
   **Chosen:** the `costs` fixture includes exactly one such pair, so whatever
   Track W decides is testable rather than assumed. Nothing else in the fixture
   depends on the answer.
7. **A metric with no `unit` column.** W0's workflow 10 gives `metrics.value` an
   observation "unit varies" but no unit column. **Chosen:** `valueUnit` is
   present, as it is for every observed quantity. An adapter that ignores it
   still works.
8. **Coordinate-frame checking (W0 open question 6).** W0 assumes both
   coordination tables share a frame and asks for a real adapter to check.
   **Chosen:** `clearances` publishes its `CoordinateContext` and `city`
   publishes one per building, so the check has something to read. A fixture in
   which the two tables are in *different* frames is not generated; it needs a
   decision about what a frame mismatch means that belongs to Track W.

Nothing else in the ten contracts conflicted with M1. Column names follow W0
exactly wherever W0 names one.

## Requests

- **To Track M (for a later revision, not M1):** a bounds-valued `FactValue`,
  per finding 4. Track S's earlier requests still stand.
- **To the supervisor:** the commit-turn observation in the `ebbfeaa` note.
- **To Track W:** the fixtures publish more columns than the W0 contracts name
  (`category`, `system`, `basis`, `lengthM`, positions). They are additive;
  nothing an adapter needs was renamed.

## Findings

- The gaps that matter most are the ones a workflow could pass over silently —
  a scope no rate set covers, an asset nobody was tracking, a document that
  names two buildings. Drawing those at a rate leaves some seeds with none of
  them, and a fixture that proves less on some seeds is worse than one that
  proves less always. Six generators therefore place their cases structurally
  and draw only the numbers. Where that is done, `gapScale` is a switch rather
  than a multiplier, and the module says so.
- `gapScale` does not mean the same thing for every generator, and pretending it
  did would have been wrong. In `schedule`, an item that has not been installed
  yet is not missing data, so progress is not scaled; in `quantities`, a roof
  face belongs to no room whatever the gap scale. Each README section says which
  of its absences are policy.
- The building generator's private cursor was duplicated in the stress
  generator, and would have been duplicated ten more times. Extracting it first,
  with both existing test suites as the check, cost one chunk and removed the
  duplication before it existed.
- `noUncheckedIndexedAccess` with no non-null assertions makes reading an
  element of a `readonly T[]` verbose enough that a single `elementAt` helper
  pays for itself immediately. Every generator uses it.

## Tooling

Per check, over about four hours of work in this track.

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | 11 | 6 to 9 s | 3 — a generic `indexOf` against a literal tuple, an unused binding in a test, a mesh-group field that did not exist on `StressScene` (a real bug in the catalog, caught before any test ran) | none | **helpful** |
| `npm test -w @bim-open-toolkit/synthetic` | 12 | 1.2 to 2.7 s for 212 tests | 3 — two probabilistic assertions that were false for the default seed and exposed a real weakness in the design (see the structural-gaps finding), one date window too narrow to produce a future-dated event | none; the suite is fast enough to run on every change | **helpful** |
| `npx eslint packages/synthetic` | 7 | 2 to 4 s | 0 | none | **neutral** — it has caught nothing `tsc` did not in this track, but it costs almost nothing and it is the gate that would catch a `no-explicit-any` if one were ever written |
| Snapshot regeneration and comparison | 3 | under 1 s | 0 so far, by construction — it exists to make the next change visible | none once the text comparison replaced the parsed comparison; parsing back would have needed a cast, which the no-escape-hatch rule forbids | **helpful**, on the evidence of what it makes reviewable rather than what it has caught |
| `npx tsc -p tsconfig.build.json` | 1 | 8 s | 0 | it fails for everyone until `build:v2` has run, so it is not usable as a per-track gate | **hindrance as a track check**; correct as an integration gate |
| Chunk commits by explicit pathspec | 9 | seconds | — | two `index.lock` collisions with other sessions, one of which cost a commit message (see `ebbfeaa`) | **helpful with a caveat**: the pathspec discipline worked exactly as intended; the standing grant without a turn did not |

Two notes for the ledger beyond the table:

- The `.md` expected-result files from Track W0 were worth more than any tool
  here. Eight of the design decisions above came from reading them, and all
  eight would otherwise have surfaced as a rename after Track W had written its
  adapters.
- The most expensive minutes in this track were spent on assertions that were
  true for one seed. That is a design smell, not a testing cost: the fix was to
  make the case structural, which improved the fixture.

## Blockers

None.
