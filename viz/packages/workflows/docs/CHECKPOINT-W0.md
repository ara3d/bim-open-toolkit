# Track W0 checkpoint — expected workflow results

Mechanical worker (Sonnet), wave 0 side-task per V2-PLAN.md. Writes only
`viewer/packages/workflows/test/expected/**` and
`viewer/packages/workflows/docs/**`. No source code touched, no npm/git
commands run.

## State

Complete. All ten workflows have `.md` + `.json` pairs under
`viewer/packages/workflows/test/expected/`; every JSON file parses
(`node -e "JSON.parse(...)"`, checked individually, see Tooling below).

## Shared conventions (apply to every workflow file)

- **Identity.** Fixtures use a plain `objectId` string, unique within one
  implied model/revision, standing in for the `objectId` field of
  `viewer/packages/model/src/identity.ts`'s `ObjectRef`. No `modelId`/
  `revision` pair is carried in these fixtures; a real adapter test will add
  it. The revision-comparison workflow uses two separate id spaces
  (`objectsA`, `objectsB`) instead of one `ObjectRef.revision` axis, because
  the fixture pre-dates a settled two-revision `ObjectRef` convention.
- **Observation shape.** Any field that the brief allows to be
  known/missing/conflicting is written as
  `{ "kind": "known", "value": ..., "unit"?: ... }` /
  `{ "kind": "missing", "reason": ... }` /
  `{ "kind": "conflicting", "values": [...] }`. The `kind` values and the
  five `reason` values (`not-provided`, `not-applicable`, `not-measured`,
  `unresolved-source`, `out-of-scope`) are copied verbatim from
  `viewer/packages/model/src/facts.ts`'s `MissingReason` and `Observation`.
  This is a flattened stand-in for the real (more deeply nested, with
  evidence lists) `Observation` type — noted per-file, not repeated here.
- **Exceptions never guess.** Per F26 acceptance ("incomplete quantities
  never appear as zero; uncertain matches are not forced into
  additions/deletions; bounding-box candidates are not presented as
  verified clashes"), every exception row carries its `reason`/`kind`
  and is additive: it never replaces a value with `0`, `null`-as-if-known,
  or a guessed classification.
- **JSON shape.** Every fixture file follows
  `{ "workflow", "inputs": { "<table>": [...] }, "expected": { "<result table>": [...], "exceptions": [...] }, "notes" }`
  exactly as specified in the task.
- **Numbering/slugs.** Fixed by the task: 01-door-schedule,
  02-revision-comparison, 03-takeoff, 04-pricing-alternatives,
  05-delivery-timeline, 06-valve-isolation, 07-access-coordination,
  08-asset-handover, 09-material-carbon, 10-portfolio-drill-through.

## Files and assumptions so far

### 01-door-schedule
- Files: `01-door-schedule.md`, `01-door-schedule.json` (JSON validated).
- Assumption: fire rating is the only exception axis; width is
  informational and never generates an exception in this workflow.
- Assumption: a door with `roomId: null` is valid input (unlinked door),
  not an error.
- 8 input doors, 2 storeys; 3 exception rows (missing/not-provided,
  conflicting, missing/not-measured); one door (`hasGeometry: false`) still
  gets a schedule row per the brief.

### 02-revision-comparison
- Files: `02-revision-comparison.md`, `02-revision-comparison.json` (JSON
  validated).
- Assumption: `unchanged`/`renamed`/`recategorized` are display refinements
  of a single "matched" outcome; not mandated by the brief text itself but
  consistent with it.
- Assumption: an object id that appears only as a candidate inside an
  ambiguous correspondence is not separately reported as an addition.
- 5 objects per revision; 4 resolved comparison rows, 1 ambiguous exception
  (2 candidates) that must stay unresolved rather than being forced into
  added/deleted.

### 03-takeoff
- Files: `03-takeoff.md`, `03-takeoff.json` (JSON validated).
- Assumption: a finish-type subtotal is omitted entirely (not emitted as
  zero) when it has no surface with a known area.
- Assumption: exceptions are per offending field, not deduplicated to one
  row per surface (not exercised — no surface in this fixture has two
  problems at once).
- 9 input surfaces across 2 rooms; subtotals Carpet 39 m² and Tile 11 m²
  (no Vinyl subtotal); 3 exception rows (conflicting area, missing finish
  type, missing area).

### 04-pricing-alternatives
- Files: `04-pricing-alternatives.md`, `04-pricing-alternatives.json`
  (JSON validated).
- Assumption: exactly one matching rate is required per scope/scenario/unit;
  more than one matching rate (not exercised) would itself be an ambiguous
  finding, flagged as an open question below.
- Assumption: currency is reported alongside cost, never converted.
- 3 scopes, 2 scenarios (base, alternate), 4 rates; 3 priced rows, 3
  exceptions (missing quantity in both scenarios, one unit-mismatched rate).

### 05-delivery-timeline
- Files: `05-delivery-timeline.md`, `05-delivery-timeline.json` (JSON
  validated).
- Assumption: a known higher-ranked event (e.g. `installed`) is not
  demoted by a missing lower-ranked event (e.g. no `accepted` row); the gap
  becomes a non-blocking coverage note instead. Flagged as an open question
  below since a stricter reading could demote instead.
- Assumption: a future-dated known event is normal (not an exception).
- 8 objects, 12 events, one as-of date; 2 exceptions (conflicting date, no
  events at all).

### 06-valve-isolation
- Files: `06-valve-isolation.md`, `06-valve-isolation.json` (JSON
  validated).
- Assumption: the node hosting a closed valve is included in the affected
  set; nothing reachable only beyond it is.
- Assumption: an unverified segment is reported only when it touches the
  affected set, not for every unverified segment network-wide.
- 6 nodes, 5 segments (1 unverified), 1 closed valve; affected set of 3
  nodes/2 segments, 1 trace-coverage exception.

### 07-access-coordination
- Files: `07-access-coordination.md`, `07-access-coordination.json` (JSON
  validated).
- Assumption: both tables share one coordinate frame in this fixture; a
  real adapter would check `CoordinateContext` compatibility first (flagged
  below).
- Assumption: touching bounds (`<=`, not `<`) count as overlapping.
- 3 envelopes (1 missing bbox), 3 penetrations; 1 candidate
  bounding-box-overlap finding, 1 coordination-gap exception; two
  penetrations produce no rows at all (no overlap, no gap).

### 08-asset-handover
- Files: `08-asset-handover.md`, `08-asset-handover.json` (JSON validated).
- Assumption: `eventCount` is a plain integer (a maintenance-events row
  always exists when recorded); what can be missing is only whether "zero
  rows" means "none happened" or "never tracked," disambiguated by a
  separate `serviceHistoryStatus` table.
- 5 assets; 5 handover rows always produced; 2 exceptions (untracked
  service history despite zero events, and a missing install date) — a
  third asset with zero events but tracked status is correctly not an
  exception.

### 09-material-carbon
- Files: `09-material-carbon.md`, `09-material-carbon.json` (JSON
  validated).
- Assumption: only one lifecycle scope is requested per run; scope
  comparison (as opposed to scenario comparison) is out of scope for this
  fixture.
- Assumption: a missing factor and a wrong-unit/wrong-scope factor are both
  "unresolved," distinguished only by `reason`.
- 3 objects, 2 scenarios, 4 factors; 2 resolved contributions (one per
  scenario, same object), 4 exceptions (scope mismatch, unit mismatch,
  and the third object's own conflicting quantity in both scenarios).

### 10-portfolio-drill-through
- Files: `10-portfolio-drill-through.md`, `10-portfolio-drill-through.json`
  (JSON validated).
- Assumption: a site with zero resolved contributors gets no rollup row at
  all (never a `0` total).
- Assumption: more than one resolved metric for the same building/metric
  name is not addressed by this fixture (flagged below).
- 3 buildings across 2 sites, 5 documents, 5 metrics; 2 resolved
  drill-through rows, 3 exceptions (ambiguous document, unresolved document,
  conflicting value), 1 rollup row (the other site has no resolved
  contributor).

## Open questions for Track W

1. **Observation nesting.** These fixtures use a flattened
   `{kind, value, reason, values}` shape instead of the real nested
   `Observation`/`FactValue`/`Evidence` structure in `facts.ts` (which also
   carries an `evidence: Evidence[]` list per observation). If Track W's
   adapters consume the real `Observation` type directly, the fixtures will
   need an evidence array added and the value re-wrapped in `FactValue`
   (`{kind:'quantity', quantity:{value, unit}}` etc.). Flagging now so the
   translation is mechanical rather than a redesign.
2. **Two-revision identity.** `identity.ts` models a revision as part of
   `ObjectRef` (`{modelId, revision, objectId}`), one shared id space across
   revisions. The 02 fixture instead uses two disjoint id spaces
   (`objectsA`/`objectsB`) joined by an explicit `correspondences` table.
   Confirm which convention the real revision-comparison adapter expects;
   if it expects same-`objectId`-different-`revision`, the fixture's join
   table becomes redundant for the "same-id" case but is still needed for
   renamed/moved/ambiguous cases where the id differs across revisions.
3. **Exception row shape.** Each workflow's exception rows currently carry
   only the fields needed to explain the exception (object id(s), a
   `field` name where relevant, `kind`/`reason`, and enough context to
   locate the row in the corresponding input table). If Track W's pure
   adapters return a single unified exception record shape across all ten
   workflows, confirm the field names now so later fixtures don't have to
   be renamed.
4. **Rate/factor ambiguity.** Workflows 04 and 09 assume exactly one
   matching rate/factor per scope-or-material + scenario + unit + scope
   combination. Neither fixture exercises two rates/factors matching the
   same key at once; if that can happen in real data, it needs its own
   exception category (e.g. `"ambiguous-rate"`), analogous to workflow 02's
   `ambiguous` correspondence handling.
5. **Delivery-timeline demotion policy.** Workflow 05 assumes a known
   higher-ranked event is never demoted by a missing lower-ranked one (see
   its `.md` rule 2). Confirm this against how BuildingModel's real
   delivery/acceptance/installation data behaves — a stricter workflow
   might prefer to demote or to require all three events for `installed`
   to be trustworthy.
6. **Coordinate-frame checking.** Workflow 07's bounding-box overlap test
   assumes both tables already share one coordinate frame. A real adapter
   should check `CoordinateContext` compatibility (per F01/F04) before
   comparing boxes at all and raise a distinct exception for a frame
   mismatch; this fixture does not exercise that case.
7. **Multiple resolved metrics per building.** Workflow 10 does not test
   what happens when two different resolved documents both contribute the
   same `metricName` for the same building (sum? most recent? both kept
   visible as separate drill-through rows?). Left open rather than guessed.
8. Every fixture's exception-row shape is workflow-specific (see the
   "Exception row shape" open question above); a Track W reviewer should
   confirm early whether to unify the shape before writing the pure
   adapters, since that is a cheap change now and an expensive one after
   ten adapters exist.

## Tooling

No code is run to produce these fixtures — every expected value is computed
by hand from the brief text and the stated rule, as instructed. `node -e
"JSON.parse(...)"` is used only to confirm each JSON file parses (run once
per file, individually, after every file was written; all ten pass); no
test runner, npm, or git command is invoked.

Friction reading the source documents:
- `docs/plans/visualization/PRODUCT-BRIEF.md` is long (672 lines); reading
  it in full (rather than section 6 alone) was necessary because section 6
  cross-references F07/F08/F11/F12/F14/F18/F19/F21/F26, and several of the
  "required input" phrases in section 6 only make sense with the fuller
  feature descriptions (e.g. "bounding-box candidates are not presented as
  verified clashes" for workflow 07 comes from F26's acceptance criteria,
  not from the section 6 table row itself).
- `viewer/packages/model/src/facts.ts` was read read-only as instructed;
  it is still Track M's work in progress, so the vocabulary alignment above
  is stated as a mapping instruction rather than an exact type match — see
  open question 1.
- No other friction: the V2-PLAN.md synthetic-data-catalog and
  workflow-demonstrations sections were internally consistent with the
  brief's section 6 table.
