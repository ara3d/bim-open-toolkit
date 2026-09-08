# The ten workflows

One section per workflow: what it is given, the rules it applies, what its result says and does not
say, and whether its demonstration runs on generated data, on a real source, or on both.

Read this with `test/expected/<workflow>.md`, which states the same rules as acceptance criteria, and
with `README.md`, which describes the shared shapes.

## What every workflow returns

`run(input)` returns a `Result<WorkflowResult>`. It fails only when the input cannot be read at all —
a table that repeats an id, or an input the schema refuses. A row pointing at something the input does
not contain is a warning diagnostic, not a failure: the row stays, with the unresolved link visible.

A `WorkflowResult` carries:

- **`tables`** — the result tables, then the exceptions table, which is always last and always present.
- **`summary`** — the scalars a table cannot hold: totals, counts, coverage. A total is written only
  when something resolved into it; a total is never zero because nothing did.
- **`exceptions`** — one shape for all ten workflows: the input-row ids it is about (`subjects`), any
  candidates that stay open (`related`), the field or step that could not be used (`field`), the
  scenario or revision it happened in (`scope`), the model observation that explains it
  (`observation`), and one sentence of context (`detail`). An exception never carries a guessed value.
- **`rules`** — style rules colouring by result. Most workflows use the five shared outcomes:
  `resolved`, `candidate`, `missing`, `conflicting`, `excluded`, where a conflict outranks a gap and a
  gap outranks a resolved value. The colours are a display convention and carry no domain meaning.
- **`sets`** — named object sets: everything the workflow looked at, and the objects a reader should
  act on. `selectSetId` names the set the recipe selects.
- **`overlays`** — markers, labels and directed lines as plain records, anchored to an object or to a
  point. An input that states no coordinates produces no positioned overlay; nothing invents a place.
- **`view`** — a suggested saved view: the selection and the rules, with the default camera, because
  an input of tables alone states no geometry to frame.
- **`recipe`** — the ordered public command names and inputs a demonstration dispatches. The commands
  do not exist yet; the names are in `src/recipe.ts` and nowhere else.

Observations travel as JSON: `{kind:'known', value, unit?}`, `{kind:'missing', reason}` or
`{kind:'conflicting', values}`, with `evidence` written only when there is some. The five missing
reasons are model's: `not-provided`, `not-applicable`, `not-measured`, `unresolved-source`,
`out-of-scope`. A conflict keeps every disputed value and keeps the unit only when they agree on one.

## 1. Room and door schedule — mixed

**Input.** `storeys`, `rooms` and `doors`. A door row carries its links (`storeyId`, `roomId`, either
of which may be `null`), whether it has geometry, and a `facts` record of one observation per reported
column. `exceptionFacts` names the facts under review.

**Rules.** One row per door, whether or not it has geometry, ordered by the storey table's order, then
by name, then by input order. Every reported fact is carried as observed. A door is an exception when
a reviewed fact is unavailable or disputed; the row carries the reason or the disputed values.

**Says.** Which doors are scheduled, what each reported column says about them, and which reviewed
facts cannot be relied on. Coverage per column is in the summary.

**Does not say.** Whether a rating is compliant, what a missing rating probably is, or anything about a
fact that is not under review — a missing width is reported in the schedule and raises no exception.

**Data.** Generated tables, and the door table of an `ara3d.building-workflow-projection` version 1
envelope through `doorScheduleFromProjection`, which is what the Snowdon door review supplies. The
converter maps the projection's reasons to model's (`NotObserved` to `not-measured`, `NotExported` to
`not-provided`, `NotApplicable` to `not-applicable`, `Invalid` to `unresolved-source`) and maps
`Conflicting` to a conflict with no values, because the projection states that the sources disagreed
without carrying what they said. Nominal and clear width stay separate facts and neither ever stands
in for the other. The projection carries no geometry, so without a supplied list of loaded object ids
every row is scheduled as geometry-free.

## 2. Revision comparison — synthetic

**Input.** `objectsA` and `objectsB` at two revisions of one model identity, and the `correspondences`
supplied with them. A correspondence names one A object (or none, an addition) and zero, one or
several B candidates.

**Rules.** A correspondence resolves only when it names one A object, exactly one B candidate, and no
other correspondence competes for either. A resolved pair is `unchanged`, `renamed` (the name differs)
or `recategorized` (the category differs). No A object means `added`; no B candidate means `deleted`.
Anything else stays `ambiguous` and is an exception carrying every candidate. An object no
correspondence names at all is a gap in the supplied correspondences, not a change.

**Says.** What the supplied correspondences imply, and which of them are still open.

**Does not say.** Which candidate is the right one, whether a geometry moved, or that an object with
no correspondence was added or deleted. The comparison table holds resolved rows only; an unresolved
correspondence appears in the exceptions and nowhere else.

**Colours.** This workflow colours by change type rather than by the five shared outcomes, because the
brief asks for change colours; the palette is in `changeColors` and is a display convention.

## 3. Roof and room-finish takeoff — synthetic

**Input.** `surfaces`, one row per distinct finish face, each with an observed `finishType`, an
observed `areaM2` and the `basis` the measurement came from.

**Rules.** Subtotal by finish type over the surfaces whose finish type and area are both known. A
finish type with no contributing surface gets no subtotal row at all. A surface whose finish type or
area is unavailable or disputed is an exception, one per offending field, and contributes to nothing.
A finish type whose known areas are not all reported in one unit is not added up either: the subtotal
is withheld and the surfaces are reported instead.

**Says.** The area that is actually supported by known measurements, per finish type and in total.

**Does not say.** The area of a room, or any area derived from geometry. `basis` is provenance only:
it never rescues a missing or disputed measurement, and rendered triangles are never a quantity.

## 4. Pricing alternatives — synthetic

**Input.** `scopes` with an observed `quantity`, `rates` per scope type, scenario, currency and unit,
and the `scenarios` to price.

**Rules.** A scope is priced in a scenario when exactly one rate matches its scope type, that
scenario, and the unit its known quantity is in; the cost is quantity times rate, reported in the
rate's currency. No rate is `not-provided`; a rate whose unit does not match is `unresolved-source`
and is never converted. A quantity that is itself unavailable or disputed leaves the scope unpriced
for its own reason, so "no rate" and "no quantity" stay distinguishable.

**Says.** What each scenario prices and what it leaves unpriced, with the reason.

**Does not say.** Any converted currency, any converted unit, or a total that quietly excludes the
unpriced scope.

## 5. Delivery and installation timeline — synthetic

**Input.** `objects`, dated `events` of type `delivered`, `accepted` or `installed`, and one
`asOfDate`.

**Rules.** An object's state is the highest-ranked event whose date is known and not after the as-of
date; with none, it is `scheduled`. A date that is unavailable or disputed does not count for ranking.
A higher state is not demoted because a lower step was never recorded: the unrecorded steps are a
coverage note on the row. An object with no events at all is an exception; a disputed date is an
exception; a known future date is not — it is reported separately and simply has not happened yet.
Two rows of the same event type for one object are merged rather than one replacing the other, so
two records that disagree read as a conflict.

**Says.** One state per object as of one date, with the known dates behind it, and which lower steps
were never recorded.

**Does not say.** That delivered, accepted and installed are the same thing, that a missing step did
not happen, or a state inferred from a date the sources disagree about.

## 6. Valve isolation trace — synthetic

**Input.** `nodes`, `segments` with a topology status of `accepted` or `unverified`, `valves` at
nodes, the `startNodeId` and the `closedValveIds` for this trace.

**Rules.** Traverse accepted segments only, from the start node, stopping at any node hosting a closed
valve. The node with the closed valve is affected; nothing beyond it is. An unverified segment that
touches the affected set is a trace-coverage exception: it may extend the affected area, and it is
neither included nor dismissed.

**Says.** What the accepted topology says is affected, and where the trace runs out of accepted
topology.

**Does not say.** That nearby pipes are connected, that an unverified segment is or is not part of the
affected set, or that everything beyond a closed valve is safe by inference — it is simply not reached
by this trace.

## 7. Shared penetrations and equipment access — synthetic

**Input.** `envelopes` and `penetrations`, each with an observed axis-aligned bounding box, and the
coordinate frame each of the two tables states its boxes in.

**Rules.** A penetration box is read into the envelope frame before anything is compared, and the
findings are reported in that frame. Two frames that cannot be related — different units, or a
registration that is not stated — are not compared at all: the run reports the two frames as an
exception and produces no finding, because comparing boxes across an unstated frame is exactly how a
confident wrong answer is produced. Two boxes are a candidate finding when their intervals intersect
on all three axes; touching faces count. Every candidate names both participants, both disciplines,
and the basis `bounding-box-overlap`. An item with no bounding box, and an item whose sources state
different bounds, cannot be tested at all: each is a coordination gap exception, never silently
treated as not overlapping. A disputed box carries the bounds each source stated, as text; the
workflow shows both and uses neither, because two sources that disagree about where something is
have not given it a box it may compare.

**Says.** Which pairs are worth a person's attention, and which items could not be tested.

**Does not say.** That a candidate is a clash. A bounding-box overlap is a candidate and is coloured
as one; exact intersection is not computed here, and an item with a box that overlaps nothing produces
no row at all.

## 8. Asset handover and maintenance — synthetic

**Input.** `assets` with an observed install date, `maintenanceEvents`, and a `serviceHistoryStatus`
per asset saying whether service history was ever tracked.

**Rules.** One handover row per asset with its event count and its last service date, or `null` when
there are no events. An asset whose history was never tracked is an exception even though its count is
zero; an asset whose history is tracked and genuinely empty is not. An install date that is unavailable
or disputed is an exception in its own right.

**Says.** What is on record for each asset, and which records cannot be trusted to be complete.

**Does not say.** That an asset with no events has never needed service. A zero is allowed to stand
only once its provenance says it means "none happened".

## 9. Material carbon — synthetic

**Input.** `quantities` per object and material, `factors` per material, scenario, unit and lifecycle
scope, and the one `requestedLifecycleScope` this run asks about. The scenarios are the ones the
factors name.

**Rules.** A contribution is computed only from a known quantity and a factor matching the material,
the scenario, the quantity's unit and the requested scope. No factor is `not-provided`; a unit or scope
mismatch is `unresolved-source` and is never converted. A quantity that is itself unavailable or
disputed settles the contribution on its own, and the reason reported is the quantity's, not a claim
about the factor. A scenario with no resolved contribution has no total at all.

**Says.** What each scenario can account for, and exactly what it cannot.

**Does not say.** A carbon total for anything unresolved, a converted unit, or a comparison of
lifecycle scopes — one scope is requested per run. An object is coloured resolved only when every
scenario accounted for it.

## 10. Portfolio comparison and drill-through — synthetic

**Input.** `buildings` grouped by site, `documents` with the buildings each is understood to represent,
`metrics` reported per document, and the `requestedMetricName` the rollup adds up.

**Rules.** A figure is attributed to a building only through a document naming exactly one. A document
naming several, naming none, or absent from the input is an exception carrying its candidates; a
figure that is unavailable or disputed is an exception of its own. The rollup sums the resolved
figures of the requested metric per site and reports how many of the site's buildings were excluded. A
site with no resolved contributor has no rollup row. Figures reported in more than one unit are not
added up: the site is reported without a total.

**Says.** Which building each figure belongs to, which document it came from, and what a site's total
is actually made of.

**Does not say.** That a source document is a building, which of several candidate buildings a figure
belongs to, or a site total that silently omits or invents a contributor.
