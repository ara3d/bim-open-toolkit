# PlatoFlow V1 — node vocabulary and wire types

> **AI-assisted design document** (Claude + Christopher Diggins, 2026-08-30).
> Companion to `platoflow-ifc-design.md` (the core design; its release ladder and §3
> classification govern this document) and `platoflow-compliance-design.md` (source of
> the five-category verdict semantics). Grounded in the PoC's shipped vocabulary
> (`ara3d-sdk/wip/platoflow-poc/web/src/kinds.ts`, 34 kinds) and the NRC brief
> (`nrc-ifc-llm/statement-of-work.md`).
>
> Scope: **what a user could want to build in V1, and therefore which wire types and
> node kinds V1 must ship.** V1 is the MVP tier: the NRC brief end-to-end — full node
> vocabulary, analytics enrichment, IFC Pset writeback, exports, the LLM Ask node,
> subgraphs, and the `verdicts` wire type. Method: brainstorm the workflows first,
> derive the types from the workflows, derive the nodes from both, and park everything
> that no V1 workflow demands.

Context for a reader who has not seen the PoC: PlatoFlow (working name "Studio Graph")
is a browser-based dataflow editor over BIM building models. The data substrate is BIM
Open Schema (BOS) — columnar Parquet/DuckDB tables produced by converting IFC or Revit
files. The dominant wire payload is a *scene*: an immutable view over one loaded model
(a selected-entity index array plus overlay "channels" — full-length per-entity data
columns with provenance). External analytics arrive as CSV and join onto the scene by
GlobalId. SQL over DuckDB is a first-class node. An MCP endpoint lets LLM agents author
graphs through the same intent/reducer API as humans. Geometry authoring/editing is
explicitly out of scope (that is Ara 3D Studio's job); PlatoFlow reads, enriches,
analyzes, visualizes, and writes *data* back. All write effects (pset writeback, file
export) are explicit Run-gated sink nodes — nothing writes as a side effect of
evaluation.

---

## 1. Workflow brainstorm

Everything below is a graph a real user would plausibly build. One line each: **name —
what flows through it.** Tagged **[V1]** (buildable with the section-3 catalog),
**[V1p]** (partially — the data path works, one aspect waits), or **[V2+]** (needs
parked capability). Personas: BIM manager (BM), sustainability analyst (SA), cost
estimator (CE), FM/owner-operator (FM), code/compliance reviewer (CR), VDC coordinator
(VDC), structural/MEP engineer (ENG), architect (AR), data engineer (DE), LLM agent
(AI). The point of the volume is coverage: a node earns its place in section 3 only by
appearing on one of these lines.

### Model QA and hygiene (BM)

1. **Missing-pset audit** [V1] — model → walls/doors by type → "FireRating exists" rule → verdicts → color-coded 3D + CSV of offenders.
2. **Naming-convention check** [V1] — SQL regex over entity names → violating rows → verdicts via table bridge → data grid + export.
3. **Duplicate-GlobalId detection** [V1] — SQL `GROUP BY GlobalId HAVING count>1` → table → verdict bridge → report.
4. **Unplaced-element census** [V1] — select where Level is absent → count + color; the PoC's own demo data hid its largest carbon sum here.
5. **Proxy-element hunt** [V1] — select IfcBuildingElementProxy → group by name → bar chart of what should have been modeled properly.
6. **Parameter-completeness dashboard** [V1] — SQL null-fraction per type per parameter → table → chart + report sink.
7. **Classification coverage** [V1] — fraction of elements carrying a Uniclass/OmniClass code, by type → chart; offenders exported.
8. **Classification mapping** [V1] — CSV mapping family/type string → Uniclass code, joined onto the scene by Type (not GlobalId) → written back as a pset.
9. **Units/georeferencing sanity** [V1] — SQL over project/context rows → one-row table eyeballed in the grid.
10. **Model version diff** [V2+] — two versions of one model → added/removed/changed elements → color + change table. Needs a cross-model diff node.
11. **IDS validation** [V2+] — IDS XML spec → per-requirement verdicts. Needs an IDS parser; V1 approximates single requirements with rule nodes.
12. **Federated multi-model overlay** [V2+] — architectural + MEP models in one 3D view with per-model tinting. Viewer is single-model in V1.

### Sustainability (SA)

13. **Embodied-carbon heat-map** [V1] — the NRC core loop: model → CSV join by GlobalId → colorBy(embodied_carbon) → legend + writeback.
14. **Carbon per storey rollup** [V1] — group by Level → aggregate sum → bar chart; the same aggregate joined onto storey entities and written as a storey-level pset (the brief's component/storey/building levels).
15. **Carbon intensity** [V1] — expression `carbon / area` as a new channel → colormap; live what-if by editing the expression.
16. **Energy-use-intensity dashboard** [V1] — energy CSV + area quantities → per-zone aggregate → chart + report.
17. **Material takeoff for LCA** [V1] — SQL quantities by material/type → export CSV for the LCA tool; results come back as workflow 13.
18. **Benchmark check** [V1] — "EUI ≤ target" rule over the aggregate table → verdicts → building-level pass/fail in the report.
19. **Window-wall ratio by orientation** [V2+] — needs facade orientation derived from geometry; V1 can do overall glazing ratio from areas [V1p].
20. **Operational vs embodied comparison** [V1] — two CSVs joined onto one scene as two channels → expression sum → color + chart.

### Cost estimation (CE)

21. **Quantity takeoff by type/assembly** [V1] — quantities table (from parameters or SQL) → aggregate by type → export.
22. **Unit-rate cost estimate** [V1] — rate table (CSV or typed inline) joined by type/classification → `qty * rate` column → rollup by storey and by Uniclass → chart + grid.
23. **Cost heat-map** [V1] — cost channel → colorBy; expensive elements glow.
24. **Estimate export for the estimator's spreadsheet** [V1] — trimmed columns → CSV (XLSX parked).
25. **Change-order impact** [V2+] — model diff × unit rates → cost delta. Blocked on workflow 10.

### Compliance and accessibility (CR)

26. **Door clear-width compliance** [V1] — doors → width parameter → rule with citation → five-category verdicts → categorical color + itemized report. The door-clearance demo re-homed onto the platform.
27. **Fire-rating verification** [V1] — required-ratings table (per wall type, from CSV) joined onto walls → compare actual vs required → verdicts.
28. **Stair geometry checks** [V1p] — riser/tread/headroom rules where psets carry the values; `InfoNotAvailable` where they don't — which is itself the deliverable.
29. **Occupancy load calc** [V1] — space areas × load-factor table → expression → aggregate per storey → rule against egress capacity.
30. **Egress door count per storey** [V1] — doors on egress paths by parameter/relation → count per storey → rule → verdicts.
31. **Travel-distance / egress-path analysis** [V2+] — needs path geometry over space adjacency; out of V1's data-only scope.
32. **Accessibility clearance zones** [V2+] — needs geometric clearance testing (the full door-swing volume story); V1 checks the declared clearance parameters only [V1p].
33. **Compliance summary report** [V1] — several rule nodes → merged verdicts → verdict summary + offender tables → report sink + pset writeback of verdicts.

### Coordination and VDC (VDC)

34. **Level-exploded review views** [V1] — group by storey → explode → colorBy(type); the massing/diagram view for coordination meetings.
35. **Phasing groups** [V1] — group by phase parameter → categorical color; 4D timeline animation is V2+.
36. **Zone program vs design** [V1] — spaces → areas vs program CSV → delta column → rule → verdicts + color by deviation.
37. **Bounding-box clearance/clash scan** [V2+] — pairwise AABB proximity between two selections. Bounds exist in V1 (`derive.bounds`) but the pairwise spatial join is a performance project; parked.
38. **MEP system tracing** [V1p] — select a system → follow relations (assignments, connectivity) to members → color the run. Single-hop and system-membership work in V1; deep transitive tracing with direction is V2+.
39. **Scope-split views** [V1] — set algebra: (my package) minus (issued elements) → what's left → count badge + grid.

### FM and handover (FM)

40. **Handover-readiness audit (COBie-ish)** [V1] — maintainable asset types → required-attribute checklist (manufacturer, model, serial, warranty) as rules → verdicts + gap report.
41. **Asset register export** [V1] — filter maintainable assets → project columns → CSV/Parquet for the CAFM import.
42. **Warranty/asset enrichment** [V1] — vendor CSV joined by type or tag → channels → pset writeback so the data travels in the IFC.
43. **Space schedule by department** [V1] — spaces → aggregate area by department parameter → chart + export.
44. **Maintenance-zone map** [V1] — group spaces by zone → categorical color → saved graph as the FM orientation document.

### Design and documentation (AR)

45. **Area schedule vs program** [V1] — same graph as 36 with architect's thresholds.
46. **Room finish schedule** [V1] — SQL over space↔covering relations → table → export.
47. **Glazing schedule** [V1] — windows → dimensions/areas → aggregate per elevation-as-parameter → grid.
48. **Massing diagram** [V1] — bounding boxes + explode + color by function → screenshot for the deck.

### Data engineering and automation (DE, AI)

49. **Power BI feed** [V1] — any table → Parquet/CSV export on Run; the BI tool ingests the file.
50. **Ad-hoc SQL anything** [V1] — the SQL node is the escape hatch that keeps every other workflow honest.
51. **Ask the model** [V1] — enriched scene → natural-language question → LLM-authored SQL → answer table with the SQL shown. NRC objective 3.
52. **Agent-authored audit** [V1] — an LLM agent, via MCP, assembles workflows 1–7 into one QA graph, runs it, and reads the verdict outputs; the human reviews the graph itself.
53. **Scheduled batch re-run over a model set** [V2+] — graph-as-function with parameter overrides; the batch runner is V2 by design.
54. **Copilot graph authoring** [V2+] — "build me a carbon dashboard" → generated subgraph; V2 by the release ladder.

### Engineering sanity checks (ENG)

55. **Structural member sanity** [V1] — beams/columns → section/material parameters exist + span-vs-depth rule of thumb via expression → verdicts.
56. **Duct/pipe sizing vs design flows** [V1] — design-flow CSV joined by system/tag → compare vs modeled size → verdicts → color the offending runs.

Tally: 44 of 56 land fully in V1, five more partially. The twelve V2+ lines cluster
around exactly four missing capabilities — cross-model operations (10, 12, 25),
geometry computation beyond bounds (19, 31, 32, 37), time (35's animation, 53), and
the copilot (54) — which is reassuring: V1's cut line is four capabilities, not forty
nodes.

---

## 2. Wire types

### 2.1 The principle

Fewer wire types with strong table conventions beat many bespoke types. A wire type
earns existence only when (a) some node must *demand* it at the socket — wiring
anything else should be impossible at the snap gesture, not an error afterwards — or
(b) it carries structure a table genuinely cannot (shared model reference, typed
enums with semantics attached). Everything else is a table with a documented column
convention. The PoC ran 34 kinds on four types; V1 adds exactly one.

### 2.2 The V1 set: five types

**`scene`** — the dominant type. An immutable view over one loaded BOS model:

    SceneValue = {
      model:    ModelData          // shared, immutable columnar tables
      entities: Uint32Array        // selected entity indices, ascending
      channels: Map<name, Channel> // { values, source, numeric, unit? } — full-length
      groups?:  GroupChannel       // flat partition with labels; null = unnamed group
    }

Produced by `load.model` and every scene→scene node. Consumed by selects, groups,
derives, joins, `viz.colorBy`, `table.fromScene`, `table.count`, `ai.ask`,
`sink.writePset`. Channels keep the full-length-array invariant (data for *all*
entities; selection narrows nothing destructively) and carry provenance — writeback
and the "where did this number come from" UI read straight off the channel record.
Element sets, group partitions, model references, and geometry summaries are all
*facets of scene*, not separate types (see 2.3).

**`table`** — `{ columns, rows, source? }`, cells number/string/null. The lingua
franca for everything that leaves the scene: CSVs, SQL results, aggregates, projections,
Ask answers. Produced by sources, `table.*`, `table.fromScene`, `ai.ask`; consumed by
`attach.column`, every `table.*` node, `verdict.fromTable`, charts, grids, exports.
Column typing is per-column (numeric-looking identifier columns stay strings).

**`verdicts`** — new in V1, mandated by the compliance track. Structurally a table
with a guaranteed schema; nominally a distinct type so compliance nodes can demand it
at the socket and it renders with its own wire color:

    VerdictRow = {
      subject:  string             // GlobalId, or a storey/zone/building identifier
      subjectKind: "element" | "storey" | "zone" | "space" | "building"
      ruleId:   string
      verdict:  "Pass" | "Fail" | "NotApplicable" | "InfoNotAvailable" | "Uncertain"
      evidence?: string            // the value(s) tested, human-readable
      citation?: string            // code clause reference
    }

The five categories are the compliance design's §2 enum, defined now precisely so that
graphs and psets written in V1 never need a migrating enum later. V1 populates mostly
Pass/Fail/NotApplicable/InfoNotAvailable (rule applicability filters and missing
parameters produce the latter two mechanically); `Uncertain` exists, is legal, and is
mostly unused until V3's interpretive-rule metadata. Produced by `verdict.rule` and
`verdict.fromTable`; consumed by `verdict.merge`, `attach.verdicts`, `view.verdicts`,
`sink.report`, and — via coercion — every table node.

**`colormap`** — `{ ramp, min, max }`. Unchanged from the PoC. Exists as a type for
one reason: sharing a single ramp/domain across several views so their colors are
comparable. Produced by `viz.colormap`; consumed (optionally) by `viz.colorBy`.
Auto-ranging remains the default — the PoC's #1 novice trap was a silently clamped
manual domain.

**`view`** — what the 3D pane renders: entities + per-entity colors + legend +
ghosting + offsets + box-rendering flags. Produced by `viz.colorBy`; transformed by
`viz.boxes`, `viz.explode`, `viz.labels`; consumed by the display flag and
`sink.report`. Deliberately downstream-only: no node turns a view back into a scene
(re-select upstream instead — the graph, not the view, is the record of what you did).

### 2.3 Coercions

Kept deliberately few, and all lossless:

- **`verdicts` → `table`** — implicit and free. A verdicts value *is* a table with
  guaranteed columns, so it snaps into any table socket (filter, sort, aggregate,
  grid, export). This one coercion replaces a whole family of verdict-summary nodes:
  "count by verdict" is `table.aggregate` on the coerced value.
- **`table` → `verdicts`** — never implicit. Only `verdict.fromTable` performs it,
  with validation (verdict column must hold the five legal strings; bad rows are
  reported, not dropped silently).
- **`scene` → `table`** — explicit via `table.fromScene`, not a coercion. The
  projection has real choices (which channels, which base columns) and hiding a
  default projection inside a snap gesture is how columns go missing invisibly. The
  node is one click; the honesty is worth it.
- Everything else: no coercion. An incompatible socket never highlights during the
  wire drag (the PoC validated snap-predicate typing over post-connect errors).

### 2.4 Considered and excluded

- **`number` / `string` scalar wires** — excluded. Every candidate consumer ("compare
  against this threshold") wants the value as a *param*, not a wire; graph parameters
  (V1, per the core design §9) cover promoting such params to graph level without any
  wire. Where a *computed* number must flow (an aggregate feeding a rule), it flows as
  a one-row table and the consuming node names the column — a convention, not a type.
  If V1 usage shows people fighting this, a scalar type is a registry entry away
  (wire types are registry data by the extensibility guardrails).
- **`model` reference** — excluded; the model rides inside `scene`. A bare model
  handle with no selection is just `load.model`'s full-selection scene.
- **element set** — excluded; a scene with no channels *is* an element set. The
  PoC proved selects/set-algebra need nothing thinner.
- **`groups`** — excluded as a wire; a group partition is scene state (`groups`
  facet) written by `group.by` and consumed downstream. Making it a wire would force
  every scene node to pass two wires in lockstep.
- **chart spec** — excluded. Charts are sink/body nodes configured by params; a
  declarative chart-spec pipeline (Vega-style) is machinery V1 workflows never asked
  for.
- **report/document** — excluded as a wire. `sink.report` consumes tables, verdicts,
  and a view directly; a flowing document type earns its keep only when reports
  compose from reports, which is V2+ at the earliest.
- **file/blob** — excluded. Files enter through source nodes' params and leave
  through Run-gated sinks; a blob on a wire would smuggle effects into pure
  evaluation.
- **schedule/time** — excluded; nothing in V1 flows time-indexed data. 4D is parked
  wholesale.
- **geometry summary (bounds, volumes, centroids)** — excluded as a type. These are
  per-entity *numbers*, which is exactly what channels are: `derive.bounds` writes
  them as channels and every existing node (filter, color, aggregate, export) consumes
  them with zero new machinery. This is the payoff of the channel design and the
  clearest case for conventions over types. Meshes never flow — the viewer reads
  geometry from the shared model, and PlatoFlow does not author geometry.
- **`facts` / `rules` / `classification`** — V3 types per the compliance design;
  defining them before the fact vocabulary and rule IR exist would be guessing.

---

## 3. Node catalog for V1

49 kinds: the PoC's 34 (three renamed, one output-changed, one param-generalized —
each flagged) plus 15 new kinds demanded by section 1. Format per node: kind — purpose;
**in** / **out** ports (name: type); key params; notes only where behavior is
non-obvious. House rules inherited from the PoC and kept throughout: unconfigured
nodes report *needs-setup* (gray), never error (red); silently-dropped rows,
unmatched join keys, and shadowed parameter names surface as amber warnings with
counts; downstream failures name the originating node; the null/unnamed group is real
data and is always shown.

### Source

- **`load.model`** — load a converted BOS model as a full-selection scene. **out** out: scene. Params: model (host-served pick). Body shows entity count, load time, reload button; stale badge when the source file changes.
- **`data.csv`** — fetch and parse a CSV into a table. **out** out: table. Params: url. Per-column type inference; id-like numeric columns stay strings. Feeds workflows 8, 13, 22, 27, 42, 56.
- **`data.parquet`** *(new)* — load a Parquet file into a table via DuckDB on the host. **out** out: table. Params: url/path. BOS is Parquet-native; analytics pipelines increasingly are too (17, 49).
- **`data.literal`** *(new)* — a small table typed directly into the node (inline grid body). **out** out: table. Params: the cells. For unit rates, thresholds, required-ratings lookups (22, 27, 29) without a round-trip through a file. The graph then carries its reference data — self-contained and diffable.

### Select (scene → scene; channels always pass through)

- **`select.byType`** — keep entities of one IFC class. Params: type (dynamic enum). Vocabulary note per the core design: this filters the IFC class (`Category` in BOS), not the family/type string.
- **`select.byContainer`** *(rename of `select.byLevel`)* — keep entities in a spatial container: storey, space, or zone. Params: scope (storey | space | zone), container (dynamic enum). Default scope storey makes it byLevel-compatible; old graphs migrate by rename + default. Demanded by space/zone workflows (29, 36, 43, 44) that byLevel could not serve.
- **`select.byParameter`** — keep entities where a parameter/channel passes a comparison. Params: parameter, op (== != > >= < <= contains exists), value. Null means absent: fails every test except !=. Non-numeric values dropped by ordered comparisons — with a count, as a warning.
- **`select.byIds`** *(new)* — keep entities whose GlobalId appears in a table column. **in** in: scene, ids: table. Params: idColumn (default GlobalId). The bridge back from any table — SQL results, verdict offenders, an agent's list — to the scene (1, 2, 33, 52). Unmatched ids reported as a warning with count.
- **`select.byRelation`** *(new)* — from the current selection, follow BOS relations to related entities: contained elements, containing structure, system/group members, connected elements, aggregated parts. **in** in: scene. **out** out: scene (the related entities). Params: relation (dynamic enum of relation kinds present in the model), direction (forward | reverse), keepOriginal (bool). Single-hop in V1; deep transitive tracing is parked (38). The dynamic enum lists only relations the model actually contains — no dead options.
- **`select.union`** — entities in either input (same model). **in** a, b: scene. Channel name clashes: second input wins, amber warning.
- **`select.intersect`** — entities in both inputs. Same channel rule.
- **`select.subtract`** — a minus b; a's channels pass through. Workflow 39.
- **`select.invert`** — the model's other entities.
- **`select.checklist`** — live checkbox filter over the values actually present (types or levels), with counts. New upstream values default to ticked.

### Group

- **`group.by`** — partition the selection into named groups by Type, Level, or any parameter/channel value; attaches the `groups` facet. Entities with no value form the unnamed group — never dropped (4, 14, 34, 35, 44). Flat partition only in V1 (nesting is an open question the core design already carries).

### Data (scene enrichment)

- **`attach.column`** *(param-generalized)* — join a table column onto the scene as a channel. **in** scene: scene, table: table. Params: keyColumn (table side), **joinOn** *(new param)*: which entity-side key to match — GlobalId (default) | Type | Name | Level | any channel. The generalization is what makes classification mapping (8), unit-rate costing (22), required-ratings lookup (27), and storey-rollup writeback (14) all one node instead of four: join by GlobalId for per-element analytics, by Type for lookups, by Name onto storey entities for aggregate writeback. Unmatched rows and unmatched entities both reported with counts; a channel shadowing a model parameter raises a visible flag.
- **`compute.expr`** — new channel per entity from a JS expression (`gid`, `type`, `name`, `level`, `param('X')`, `ch('X')` in scope). Return null to leave an entity blank. The what-if engine (15, 20, 29, 55). AI assist lives in the inspector (generate/fix), not a separate node.
- **`derive.bounds`** *(new)* — write per-entity geometry summaries as channels: bounds min/max, sizeX/Y/Z, footprint area, AABB volume, centroid, elevation. **in** in: scene. **out** out: scene. Params: which metrics (checklist). The entire geometry story of V1: numbers about geometry, never meshes. Serves massing (48), elevation filters, crude size sanity checks (55), and is the substrate the parked clash scan (37) will build on. Entities without geometry get null (the drawable-entity mask makes this honest, not mysterious).

### Table (ETL)

- **`table.sql`** — read-only DuckDB SQL over the input scene's model (EntityText, ParameterText, RelationText views). **in** in: scene. **out** out: table. The escape hatch that keeps "no-code" honest (2, 3, 6, 9, 46, 50). Vocabulary note stays on the node: `Category` is the IFC class; `Type` is the family/type string.
- **`table.fromScene`** — project the selection to a table: GlobalId, Type, Name, Level + one column per channel. The explicit scene→table seam (see 2.3).
- **`table.filter`** — keep rows passing a comparison. Same null/coercion rules as `select.byParameter`, same dropped-row warnings.
- **`table.sort`** — sort by a column; numbers numerically, strings lexically, nulls last.
- **`table.aggregate`** — group by a column, aggregate another (sum/avg/min/max/count). The empty group is reported. Param schema adapts per aggregation (count needs no value column).
- **`table.columns`** — keep or drop named columns in order. Unknown names warn, never error.
- **`table.expr`** *(new)* — new column per row from a JS expression over the row's fields. **in** in: table. **out** out: table. Params: column, expr. The table twin of `compute.expr`, for math that never touches the scene: `qty * rate` (22), program deltas (36), flow comparisons (56). Without it, every arithmetic step detours through SQL.
- **`table.join`** *(new)* — join two tables on key columns (inner | left). **in** a, b: table. **out** out: table. Params: aKey, bKey, mode. Pure-table ETL without SQL (16, 21, 22). Unmatched-row counts reported both sides; duplicate right-side keys warn (fan-out is visible, not silent).
- **`table.stats`** — per-numeric-column count/min/max/mean/sum. Non-numeric cells ignored per column, with a report.
- **`table.count`** — count the scene's selected entities into a one-row table. The quickest sanity check on a filter chain (in: scene).

### Compliance

- **`verdict.rule`** *(rename + output change of `check.rule`)* — evaluate one rule over the input and emit **verdicts** (previously: emitted violating rows as a table; the verdicts wire type supersedes that shape — flagged as the one breaking change in this catalog). **in** in: scene *or* table. **out** out: verdicts. Params: ruleId, citation (free text), subject column/key, parameter/column to test, op, value, applicability (optional pre-filter: type + parameter predicate). Semantics are where the five categories come from mechanically: entities failing the applicability filter → `NotApplicable`; entities where the tested value is null/absent → `InfoNotAvailable` (carrying what was looked for); otherwise Pass/Fail by the comparison. `Uncertain` is never produced by this node in V1 — it enters via `verdict.fromTable` or V3 rule metadata. This node is deliberately a *single* rule: one rule, one citation, one traceable verdict stream (1, 18, 26–30, 40, 55, 56).
- **`verdict.fromTable`** *(new)* — construct verdicts from any table carrying subject + verdict columns. **in** in: table. **out** out: verdicts. Params: subject column, verdict column, ruleId (constant or column), evidence/citation columns (optional). The bridge from SQL-authored and LLM-authored checks into the verdict system (2, 3, 52): the SQL node stays the power tool, and its results still become first-class, reportable, writeback-able verdicts. Rows with illegal verdict strings are reported and excluded — never coerced.
- **`verdict.merge`** *(new)* — concatenate several verdict streams into one. **in** a, b, c (c optional): verdicts. **out** out: verdicts. Duplicate (subject, ruleId) pairs warn. Multi-rule audits (33, 40) need one stream feeding the report; chain merges for more than three inputs (or wrap in a subgraph).
- **`attach.verdicts`** *(new)* — join element-subject verdicts onto a scene as a channel (verdict category per entity, plus optional ruleId filter to pick one rule). **in** scene: scene, verdicts: verdicts. **out** out: scene. The hinge that makes compliance heat-maps a two-node tail: attach → colorBy categorical (26, 33, 56). Non-element subjects (storey/building verdicts) don't attach here and the node says how many it skipped; they remain visible via the table coercion and the report.

### Viz

- **`viz.colormap`** — numeric ramp + domain, auto-ranged from the consuming channel by default; the node body always shows the domain actually in use. **out** out: colormap. Exists to share one ramp across views.
- **`viz.colorBy`** — color the scene by a channel or numeric parameter, producing a view. **in** scene: scene, colormap: colormap (optional, overrides embedded ramp). Params: channel, mode (auto | numeric | categorical), embedded ramp/domain, ghostOthers. Grouped scenes with no channel color by group; verdict channels color categorically with the five-category palette. Entities with no value render gray — visibly, in the legend.
- **`viz.boxes`** — re-render a view's entities as their bounding boxes (massing view). **in/out**: view.
- **`viz.explode`** — displace each storey's entities vertically. **in/out**: view. Params: spacing, hidden categories. Entities with no level stay put.
- **`viz.labels`** *(new)* — per-entity 3D text annotation from a channel or parameter, HUD-projected. **in** in: view. **out** out: view. Params: source channel, format (e.g. `{value} kgCO2e`), max labels (default modest — a label per 100k entities is noise, and the node says when it truncates). The NRC brief names text annotation explicitly alongside color coding; this is that node (13, 26).
- **`chart.bar`** — bar chart of a table in the node body; one bar per row. Params: label column, value column. In-node 2D bodies are cheap and multiply freely; 3D never does.

### View (pass-through inspectors)

- **`view.scene`** — watch selection count and channels mid-flow; select to grid its entities, flag its eye for 3D.
- **`view.table`** — watch row/column counts mid-flow; select to grid the rows.
- **`view.verdicts`** *(new)* — watch a verdict stream: per-category counts as five chips (Pass 128 / Fail 7 / NA 300 / Info 12 / Unc 0) on the node body. **in/out**: verdicts. The at-a-glance compliance health check; clicking a chip grids that category's rows. Cheap, and it makes the five-category system legible everywhere it flows.

### Sink

- **`sink.table`** — show a table in the data-grid pane; rows with GlobalId or Level highlight in 3D on click. Pure preview, auto-evaluates.
- **`sink.writePset`** — write the scene's channels into the source IFC as a property set per element (byte-exact patch; produces the enriched copy plus a diff). Run-gated. Params: pset name, channels. Verdict channels write as strings of the five-category enum; the pset name convention (`Ara3D_Analytics` vs `Ara3D_Compliance`) is an open question below. Writing aggregate values onto storey/building entities is this same node after selecting those entities and attaching the aggregate (14).
- **`sink.exportCsv`** — write a table to CSV in the host's output folder. Run-gated.
- **`sink.exportParquet`** *(new)* — write a table to Parquet. Run-gated. Params: filename. Nearly free via DuckDB, and it is the Power BI / data-pipeline handoff format (49).
- **`sink.report`** *(new)* — compose an HTML report from wired inputs. **in** table: table (opt), verdicts: verdicts (opt), view: view (opt). Run-gated. Params: title, notes (markdown). Renders: notes, verdict summary grouped by rule with citations and per-category counts, the table, a snapshot of the view, and provenance (model id, graph name, run timestamp). Serves the compliance report (33), the FM gap report (40), and the NRC deliverable demos. Deliberately fixed-arity and template-light in V1; report *composition* is parked.

### Meta

- **`graph.sub`** — a collapsed node group with boundary wires promoted to ports (dynamic arity, from the node's own sub spec). Enter to edit. Subgraphs saved to a user library are V1's no-code extensibility tier.
- **`graph.note`** *(new)* — a sticky note on the canvas; no ports, no evaluation. Params: text. Graphs are documents (the compliance track literally hands them to officials); documents need annotations. Costs an afternoon, pays forever.

### AI

- **`ai.ask`** *(rename of `table.ask`)* — natural-language question about the input scene's model; a host-side LLM writes a DuckDB query, which runs read-only; output is the result table with the generated SQL shown on the node. **in** in: scene. **out** out: table. Moved out of the `table` category because its trust story is different (an LLM authored the query) and because the palette should say so. Answers feeding compliance go through `verdict.fromTable`, keeping the deterministic boundary explicit: the LLM produces data, never verdicts (52).

### Count and provenance

4 source + 10 select + 1 group + 3 data + 10 table + 4 compliance + 6 viz + 3 view +
5 sink + 2 meta + 1 ai = **49 kinds**. Renames from the PoC: `select.byLevel` →
`select.byContainer`, `check.rule` → `verdict.rule` (with the output type change),
`table.ask` → `ai.ask`. Param generalization: `attach.column` gains `joinOn`. Every
new kind traces to numbered workflows above; nothing in the catalog exists "because a
node graph usually has one."

---

## V2+ parking lot

One line each on why parked. These are cuts, not rejections — most have a designed
home in the core/compliance documents already.

- **`model.diff`** (two models → change table) — cross-model semantics (entity identity across versions) is a project, not a node; blocks workflows 10, 25.
- **`view.federate`** / multi-model overlay — the V1 viewer and scene are single-model by design; federation touches viewer, scene type, and set-algebra guards at once.
- **`ids.validate`** — needs an IDS XML parser and its facet semantics; V1's rule nodes approximate single requirements meanwhile.
- **`clash.aabb`** (pairwise bounds proximity) — the spatial join needs indexing to not be O(n²) on real models; `derive.bounds` lays the substrate.
- **`derive.orientation`** (facade normal/azimuth) — needs per-face geometry inspection, past the bounds-only line V1 draws.
- **path/egress analysis** — space-adjacency graph traversal with door topology; V3-adjacent (rides with the compliance fact pipeline).
- **`select.search`** (fuzzy find across name/type/id) — convenience; `select.byParameter` contains-on-Name covers the V1 need.
- **`table.pivot` / `table.append`** — SQL covers both; add native nodes only if usage shows non-SQL users hitting the wall.
- **`chart.line` / `chart.pie` / richer dashboards** — bar + grid + report cover V1 demos; a chart family deserves one coherent design pass, not accretion.
- **`sink.exportXlsx`** — CSV covers V1; XLSX brings a dependency and formatting scope.
- **`sink.exportGltf` / `sink.exportIfcGeom`** — geometry export is Studio's lane; PlatoFlow exports data.
- **`sink.exportIds`** — emit an IDS spec describing required analytics properties; stretch item riding with `ids.validate`.
- **live BI feed** (OData/REST endpoint serving a node's table) — file export covers V1; a live endpoint is a service-lifetime commitment.
- **`ai.classify`** (LLM maps messy type names onto a taxonomy) — designed for V2 in the core doc; V1's CSV mapping via `attach.column` joinOn Type is the deterministic 80%.
- **copilot / generate-subgraph-from-prompt** — V2 by the release ladder; the MCP surface it needs ships earlier and agents can already author graphs tool-by-tool.
- **batch runner / `graph.forEach`** — graphs-as-functions with parameter overrides is the V2 design; V1 ships graph parameters only.
- **`rule.check` over rule-IR libraries, `classify`, `applyRules`, facts/drawings ingestion** — the V2-seed and V3 compliance suite; V1 deliberately ships only the verdict *type* and single-rule nodes so those graphs and psets stay forward-compatible.
- **4D/phasing timeline animation** — time on wires or in the viewer is a new axis; V1 colors by phase statically.
- **auto-reload / file watching** — per the core design §10, stale badges are V1, auto-reload V2 (mid-edit surprise reloads are hostile).
- **scripted plugin nodes** (`registerNode` from a plugins folder) — V2 tier-3 extensibility; V1's subgraph + SQL + expression tiers absorb the demand meanwhile.

---

## Open questions for V1 implementation

1. **Quantities: parameters or a node?** If BOS conversion surfaces IFC base
   quantities (NetArea, GrossVolume…) as ordinary parameters, `select.byParameter` /
   `compute.expr` reach them and no node is needed; if not, V1 needs a
   `derive.quantities`. Audit the converter before catalog freeze.
2. **Verdict subjects beyond elements.** `attach.verdicts` skips storey/building
   subjects; how does the *report* address them, and how does storey-level writeback
   name its subject — storey entity GlobalId, or level name? Pick one identifier rule.
3. **Pset naming for verdicts.** One pset (`Ara3D_Analytics`) for everything, or
   `Ara3D_Compliance` for verdicts per the door-clearance precedent? Affects the Ask
   node's prompt conventions too.
4. **`select.byRelation` vocabulary.** Which BOS relation kinds are guaranteed present
   across both IFC-sourced and Revit-sourced conversions, and what does the dynamic
   enum show when a model has none?
5. **`derive.bounds` residency and cost.** Are per-entity bounds precomputed in BOS
   (cheap column read) or computed on demand (host job with progress)? Decides its
   runtime class (`both` vs `host`).
6. **Report view snapshot.** Where does `sink.report`'s 3D image come from — client
   canvas capture at Run (simple, but headless runs have no canvas) or a host-side
   render (new capability)? Headless evaluation must at minimum degrade gracefully.
7. **Graph parameters without scalar wires.** The binding mechanism (promote a node
   param to graph level) needs a concrete UI and JSON shape; confirm no workflow
   actually needs a computed value to *flow* into a param, or the scalar-wire decision
   reopens.
8. **`data.literal` editing.** Inline grid editing in the node body is new UI
   machinery (the PoC kept text entry in the DOM); is a CSV-text param with preview
   body an acceptable V1 stand-in?
9. **One-cell-table convention.** `verdict.rule` comparing against an aggregate needs
   a computed threshold; does V1 implement "read cell [0,0] of a wired table as the
   comparison value" on that node, or defer and keep thresholds as params only?
10. **Two models in one graph.** Two `load.model` nodes are legal (independent
    chains); set-algebra and attach nodes must error clearly on mixed models. What is
    the exact message and where does it surface?
11. **Host API additions.** New dynamic enums (relations, containers, zones) and
    Parquet load/export need host endpoints; enumerate them against
    `platoflow-host-api.md` before the parallel tracks start.
12. **Breaking-change migration.** `check.rule` → `verdict.rule` changes an output
    type; do saved PoC graphs migrate mechanically (loader rewrite rule) or via the
    tolerant-placeholder path? Decide before any graph corpus grows.
