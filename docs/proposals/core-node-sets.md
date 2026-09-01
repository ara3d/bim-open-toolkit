# Proposal: the four core node sets

> Proposal (Claude + Christopher Diggins, 2026-08-31). Defines the DuckDB, SQL,
> BIM Open Schema, and Visualization node sets for BimOpenFlow V1, against the
> node SDK in `Ara3D.DataFlowEngine.Abstractions` and the four existing packs
> (`BimOpenFlow.Nodes.Bos`, `.Geometry`, `.Compliance`, `.Effects`), which are
> keepers. Scope is V1 per `docs/proposals/bimopenflow-ux-proposal.md`: linear
> pipelines, no subgraphs, no 4D, no batch. Every PoC kind
> (`platoflow/web/src/flow/defs-*.ts`) is accounted for in the coverage table
> at the end.

## Ground rules

- **Tables are the currency.** Everything flows as `FlowValue`; almost
  everything useful is a `TableValue` wrapping an immutable
  `Ara3D.DataTable.IDataTable`. The PoC's "scene with channels" is gone:
  what was a channel is now a column, what was a selection is now a row set,
  and 3D state is the instance-table convention the Geometry pack already
  documents. Where a node needs structured output beyond plain rows (camera,
  colormap), it emits a small table with a documented column convention —
  conventions over types, conventions over shared code.
- **Pure by default.** Every node below is `Pure` unless marked `Effect`.
  Effects execute only inside a Run and live in `BimOpenFlow.Nodes.Effects`
  so purity stays enforceable by project reference.
- **No pack-to-pack references.** Shared behavior is either a library below
  the packs (`Ara3D.BimOpenSchema.DuckDb`) or a documented table convention.
- **Status per node** is one of: *exists* (keep as is), *extend* (new version
  of an existing node), *new*.

## Decision: SQL is a facade over DuckDB

The SQL set is not engine-agnostic. There is one engine in V1 — embedded
DuckDB — and the `sql.*` nodes are a thin surface over it: the dialect is
DuckDB's, stated openly in each node's description. Pretending otherwise
would mean either a lowest-common-denominator SQL nobody asked for or a
dialect fork the conformance suite cannot pin down. The engine-neutral
`sql.*` naming keeps the door open: if a second engine ever appears, it must
pass the same conformance vectors or it is wrong — the same rule the spec
already applies to evaluators.

Consequence for packaging: `duck.*` and `sql.*` live in **one new pack,
`BimOpenFlow.Nodes.DuckDb`**, so the native DuckDB dependency has exactly one
home among the packs and the facade needs no pack-to-pack reference. The pack
depends on `Ara3D.DataFlowEngine.Abstractions` and `Ara3D.BimOpenSchema.DuckDb`
(whose `Query`/`WriteTable`/`ReadOnlyQuery` helpers are generic despite the
BOS name — see open question 2).

`bos.query` in the Bos pack — SQL over one flowing table — is exactly what
`sql.query` should be. It moves to the DuckDb pack under the new kind; the
Bos pack keeps no SQL surface. Its own comment already concedes the name was
a packaging accident ("named bos.* because the DuckDB dependency lives in
this pack").

---

## Set 1: DuckDB — `BimOpenFlow.Nodes.DuckDb`

Nodes wrapping the embedded DuckDB instance for data that lives *outside*
the graph: files on disk and existing DuckDB databases. Results are
materialized `IDataTable`s by construction — there is no lazy table in the
engine, so no separate materialize node is needed.

### `duck.read` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath); `format` (Enum: `auto` \| `csv` \| `parquet` \| `json`, default `auto`); `options` (Json, reader options such as delimiter/header, default empty) |

Loads one data file into a table via DuckDB's readers, cached by file content
hash (the `bos.load` pattern) so unchanged files never reload. Replaces PoC
`data.csv` and the planned `data.parquet` in one node.

### `duck.query` — new, Pure

| | |
|---|---|
| Inputs | — |
| Outputs | `table` (Table) |
| Params | `path` (FilePath, a `.duckdb` database); `sql` (Text, one read-only SELECT/WITH); `args` (Json, named bindings, default empty) |

Attaches an existing DuckDB database read-only and runs one validated query
against it. This is the door to warehouses of pre-computed data (LCA factors,
rate libraries) without importing them into the graph. Replaces nothing in
the PoC; serves the data-engineering workflows (49, 50).

### `sink.exportParquet` — new, Effect, housed in `BimOpenFlow.Nodes.Effects`

| | |
|---|---|
| Inputs | `in` (Table) |
| Outputs | one-row summary table (`path`, `rowCount`) |
| Params | `path` (FilePath) |

Writes the input table to a Parquet file; the Power BI / pipeline hand-off
(workflow 49). It belongs conceptually to this set but must live in the
Effects pack per the all-effects-in-one-place rule — which means granting
that pack a Parquet writer dependency, the same structure-doc inconsistency
its README already flags for GLB/BOS export (open question 3).

## Set 2: SQL — `BimOpenFlow.Nodes.DuckDb`

SQL over tables already flowing through the graph.

### `sql.query` — extend (relocation and rename of `bos.query` v1), Pure

| | |
|---|---|
| Inputs | `t` (Table) |
| Outputs | `table` (Table) |
| Params | `sql` (Text, one read-only SELECT/WITH; input available as `t`); `args` (Json, named bindings substituted as prepared-statement parameters, default empty) |

Loads the input table into an in-memory DuckDB as `t` and runs one validated
read-only query. `args` is the parameterized-query surface: thresholds and
names bind as values, never by string splicing, and promote naturally to
graph parameters (UX pillar 10). Replaces PoC `table.sql` and today's
`bos.query`. V1 keeps the single-table shape; SQL over several flowing
tables waits on optional/variadic ports (open question 1) — until then,
`table.join` covers the two-table case.

### `sql.ask` — new, Pure

| | |
|---|---|
| Inputs | `t` (Table) |
| Outputs | `table` (Table) |
| Params | `question` (Text); `sql` (Text, the generated query — visible, editable, stored in the graph) |

"Ask the model" with the determinism problem solved by construction:
generation is an *authoring-time* act, not an evaluation-time one. A host
service (reachable from the inspector and from MCP) turns `question` into
SQL and writes it into the `sql` param; evaluation only ever runs the stored
SQL through the same read-only validator as `sql.query`. The graph therefore
stays deterministic and replayable, the generated SQL is always shown (the
NRC objective), and an empty `sql` renders as needs-setup, never as an
error. Replaces PoC `table.ask` (the catalog's `ai.ask`). The LLM produces
data, never verdicts: answers feeding compliance still pass through the
check nodes.

---

## Set 3: BIM Open Schema — `BimOpenFlow.Nodes.Bos` (+ one Effects keeper)

The workhorse set. Existing keepers, unchanged: **`bos.load`** (three-table
source: entities, parameters, relations), **`table.filter`**,
**`table.derive`**, **`table.aggregate`**, **`table.sort`** — and
**`sink.writePsets`** in the Effects pack for pset write-back. New nodes:

### `bos.parameters` — new, Pure

| | |
|---|---|
| Inputs | `entities` (Table); `parameters` (Table) |
| Outputs | `table` (Table) |
| Params | `names` (Text, comma-separated parameter names) |

Pivots the long ParameterText table wide: the entity rows plus one column
per requested parameter, null where an entity lacks the value. This is the
channel system reborn as a plain join — selection by parameter is
`bos.parameters` → `table.filter`, derivation over parameters is
`bos.parameters` → `table.derive`, and every downstream node (color, check,
chart, export) consumes the columns with zero new machinery. Replaces the
scene-channel half of `select.byParameter`, `compute.expr`'s parameter
environment, and `attach.column`'s model-side lookups.

### `bos.selectType` — new, Pure

| | |
|---|---|
| Inputs | `entities` (Table) |
| Outputs | `entities` (Table) |
| Params | `types` (Text, comma-separated IFC class names, i.e. BOS `Category`) |

Keeps entity rows whose `Category` is in the list; unmatched names warn with
counts. Multi-valued by design, so the editor can render it as a live
checklist. Replaces `select.byType` and `select.checklist`.

### `bos.selectLevel` — new, Pure

| | |
|---|---|
| Inputs | `entities` (Table); `relations` (Table) |
| Outputs | `entities` (Table) |
| Params | `level` (Text, storey name) |

Keeps entities contained in the named storey by following BOS containment
relations (EntityText has no level column; containment is relational).
Replaces `select.byLevel`. Whether containment must be transitive
(element → space → storey) is open question 5.

### `table.join` — new, Pure

| | |
|---|---|
| Inputs | `a` (Table); `b` (Table) |
| Outputs | `table` (Table) |
| Params | `aKey` (Text, default `GlobalId`); `bKey` (Text, default = `aKey`); `mode` (Enum: `left` \| `inner`, default `left`) |

Joins `b`'s columns onto `a` by key, canonical-text key comparison as in
`view3d.color`. The external-enrichment workhorse: carbon CSV by GlobalId,
rate tables by Type, required-ratings by wall type. Unmatched counts on both
sides surface as warnings; duplicate right-side keys warn (fan-out visible,
never silent). Replaces `attach.column`, generalized exactly the way the
PoC catalog's `joinOn` param intended.

### `table.setOp` — new, Pure

| | |
|---|---|
| Inputs | `a` (Table); `b` (Table) |
| Outputs | `table` (Table) |
| Params | `op` (Enum: `union` \| `intersect` \| `subtract`); `key` (Text, default `GlobalId`) |

Row-set algebra on a key column; `a`'s columns and row order pass through
(union appends `b` rows unmatched in `a`). One node replaces four PoC kinds:
`select.union`, `select.intersect`, `select.subtract`, and `select.invert`
(subtract the selection from the full entities table). Serves scope-split
views (workflow 39).

### `table.project` — new, Pure

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `columns` (Text, comma-separated names, kept in this order) |

Keeps named columns in order; unknown names warn, never error. The trimmed
export (workflow 24) and tidy-report step. Replaces `table.columns`.

---

## Set 4: Visualization — `BimOpenFlow.Nodes.Geometry` + new pack `BimOpenFlow.Nodes.Viz`

3D nodes stay in the Geometry pack (they share the instance-table
conventions and the meshing dependency's windows/x64 constraint). Charts and
table views get a **new pack `BimOpenFlow.Nodes.Viz`** depending only on
`Ara3D.DataFlowEngine.Abstractions` — no reason for a bar chart to inherit a
native meshing constraint. Panes consume node *outputs* plus node *params*:
a chart node's output is the projected data table; its axes and title are
params the chart pane reads from the catalog and graph.

Existing keepers, unchanged: **`view3d.instances`**, **`view3d.isolate`**,
**`view3d.camera`** (Geometry pack).

### `view3d.color` — extend to v2, Pure (Geometry pack)

Adds three params to v1's `joinColumn`/`valueColumn`/`colorMap`:
`auto` (Boolean, default `true`), `min`, `max` (Number). Auto keeps today's
normalize-over-the-column behavior; a manual domain makes colors comparable
across nodes by promoting `min`/`max` to graph parameters — domain sharing
travels as params, not wires, per UX pillar 10 and the PoC's own
scalar-wire exclusion. Replaces `viz.colorBy` and the sharing role of
`viz.colormap`.

### `view3d.colormap` — new, Pure (Geometry pack)

| | |
|---|---|
| Inputs | `values` (Table) |
| Outputs | `colormap` (Table, one row: `valueColumn`, `ramp`, `min`, `max`) |
| Params | `valueColumn` (Text); `ramp` (Enum: `viridis` \| `category10` \| `redgreen`, default `viridis`); `auto` (Boolean, default `true`); `min`, `max` (Number) |

Emits the legend/domain table the panes render (shared legend, UX P1); with
`auto` it reports the domain actually in use — the PoC's #1 novice trap was
a silently clamped manual domain, so the truth is always on the wire.
Coloring nodes do not consume this table in V1 (no optional ports — open
questions 1 and 6); they share domains via graph parameters as above.

### `chart.bar` — new, Pure (Viz pack)

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table, projected label + value columns) |
| Params | `labelColumn` (Text); `valueColumns` (Text, comma-separated); `title` (Text); `sort` (Enum: `none` \| `asc` \| `desc`, default `none`) |

Validates and projects the chart data; one bar (group) per row. The chart
pane renders output + params. Replaces PoC `chart.bar`.

### `chart.line` — new, Pure (Viz pack)

Same shape as `chart.bar` with `xColumn` / `yColumns` / `title`; rows
ordered by `xColumn` (numeric or lexical). New — no PoC ancestor; required
for trend-shaped aggregates.

### `view.table` — new, Pure (Viz pack)

| | |
|---|---|
| Inputs | `table` (Table) |
| Outputs | `table` (Table) |
| Params | `title` (Text); `columns` (Text, optional projection, default all) |

Names and optionally projects a table for the table pane — a pinned,
titled view rather than the transient click-a-node inspection. Replaces
`view.table` and `sink.table`. Note the general rule that makes most
view/sink-preview nodes unnecessary: every node's output is inspectable in
the panes by selection, so pass-through watchers earn a node only when they
add naming or projection.

---

## Coverage: every PoC kind

| PoC kind | Replacement |
|---|---|
| `load.model` | `bos.load` + `view3d.instances` (both exist) |
| `select.byType` | `bos.selectType` (new) |
| `select.byLevel` | `bos.selectLevel` (new) |
| `select.byParameter` | `bos.parameters` (new) → `table.filter` (exists) |
| `select.union` | `table.setOp` (new) |
| `select.intersect` | `table.setOp` (new) |
| `select.subtract` | `table.setOp` (new) |
| `select.invert` | `table.setOp` subtract from the full entities table |
| `select.checklist` | `bos.selectType` multi-value param + checklist editor UI; dropped as a kind |
| `data.csv` | `duck.read` (new) |
| `table.sql` | `sql.query` (relocated `bos.query`) |
| `table.fromScene` | dropped — there is no scene type; tables are native |
| `table.columns` | `table.project` (new) |
| `table.count` | dropped — `table.aggregate` with `count(*)`; wire row counts show it anyway |
| `table.stats` | dropped — `table.aggregate` / `sql.query` cover it; revisit on demand |
| `table.aggregate` | `table.aggregate` (exists) |
| `table.filter` | `table.filter` (exists) |
| `table.sort` | `table.sort` (exists) |
| `table.ask` | `sql.ask` (new; generation moved to authoring time) |
| `attach.column` | `table.join` (new) |
| `compute.expr` | `table.derive` (exists) |
| `group.by` | dropped — `table.aggregate` group-by + `view3d.color` categorical cover both roles |
| `check.rule` | `check.rule` (exists; `check.required`/`rollup`/`union` already exceed the PoC) |
| `chart.bar` | `chart.bar` (new) |
| `viz.colorBy` | `view3d.color` (exists; v2 adds manual domain) |
| `viz.colormap` | `view3d.colormap` (new, legend only) + graph-parameter domain sharing |
| `viz.boxes` | dropped V1 — bounds are already instance-table columns; a pane render mode, not a node |
| `viz.explode` | dropped V1 — outside this proposal's viz scope; revisit with the VDC workflows |
| `view.scene` | dropped — any node's output is pane-inspectable by selection |
| `view.table` | `view.table` (new, adds naming/projection) |
| `sink.table` | dropped — pane behavior |
| `sink.exportCsv` | `sink.exportCsv` (exists) |
| `sink.writePset` | `sink.writePsets` (exists) |
| `graph.sub` | dropped — V1 has no subgraphs per the UX proposal |

## Census

| Set | Exists | Extend | New | Home |
|---|---|---|---|---|
| DuckDB | 0 | 0 | 3 (`duck.read`, `duck.query`, `sink.exportParquet`) | Nodes.DuckDb (new pack); the sink in Nodes.Effects |
| SQL | 0 | 1 (`sql.query` ← `bos.query`) | 1 (`sql.ask`) | Nodes.DuckDb |
| BIM Open Schema | 6 (`bos.load`, `table.filter/derive/aggregate/sort`, `sink.writePsets`) | 0 | 6 (`bos.parameters`, `bos.selectType`, `bos.selectLevel`, `table.join`, `table.setOp`, `table.project`) | Nodes.Bos; the sink in Nodes.Effects |
| Visualization | 3 (`view3d.instances/isolate/camera`) | 1 (`view3d.color` v2) | 4 (`view3d.colormap`, `chart.bar`, `chart.line`, `view.table`) | Nodes.Geometry; charts and `view.table` in Nodes.Viz (new pack) |

Two new packs (`BimOpenFlow.Nodes.DuckDb`, `BimOpenFlow.Nodes.Viz`),
fourteen new kinds, two extensions, no removals of shipped behavior
(`bos.query` relocates before any graphs exist to migrate).

## Open questions

1. **Optional/variadic input ports.** `NodeSpec` input lists are fixed and
   required. Three designs above want optional inputs: `sql.query` over
   several flowing tables, `view3d.color` consuming a colormap wire, and
   `check.union` beyond two inputs. This is a spec + engine decision, not a
   pack decision — the sets above are shaped to not need it in V1.
2. **Where generic DuckDB code lives.** `Ara3D.BimOpenSchema.DuckDb` carries
   the generic `Query`/`WriteTable`/`ReadOnlyQuery` helpers under a BOS name.
   Should a BIM-free `Ara3D.DuckDb` graduate out of it, per the structure
   doc's BIM-free engine-group rule?
3. **Effects pack dependency grants.** `sink.exportParquet` needs a Parquet
   writer in Nodes.Effects — the same inconsistency the Effects README
   already flags for GLB/BOS export. Grant the dependency, or relax
   all-effects-in-one-pack?
4. **The `sql.ask` generation service.** Where the LLM call lives (host
   service exposed to inspector and MCP), and whether regeneration is a graph
   operation (recorded, undoable) or a pure editor gesture.
5. **`bos.selectLevel` containment depth.** Direct containment only, or
   transitive (element → space → storey)? Decide against real models.
6. **Colormap sharing mechanics.** Is graph-parameter promotion of
   `min`/`max` sufficient for comparable views, or does the legend table
   eventually need to feed coloring nodes (returns to question 1)?
7. **`bos.query` retirement.** Delete outright when `sql.query` lands (no
   shipped graphs exist), or keep a deprecated alias for one release?
