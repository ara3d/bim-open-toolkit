# PlatoFlow × IFC — design: semantics, architecture, and UX

> **AI-assisted design document** (Claude + Christopher Diggins, 2026-08-09).
> Captures the core design discussion for using PlatoFlow as a no-code visualization and
> analysis toolkit for IFC models and associated analytics (NRC brief:
> `C:\Users\cdigg\git\nrc-ifc-llm\statement-of-work.md`).
>
> Scope: **what flows, how nodes compose, and how the user experiences it.**
> Governed by the prioritized principles in `platoflow-design-principles.md` — read that
> first; when this document and the principles conflict, the principles win.
> Implementation staging lives separately in `platoflow-ifc-analytics-plan-2026-08-08.md`;
> that document's recommendations will be folded into this design later, not the other way
> around.

## 0. Release tiers

Features throughout this document are tagged with the tier where they best land:

- **V0 — first alpha (testable).** The smallest thing that proves the core loop: load a
  model, filter it, color it, see it, save the graph. Ruthlessly small; every V0 feature
  exists to validate a semantic decision, not to please users.
- **V1 — MVP.** Addresses the NRC brief end-to-end: full node vocabulary, enrichment,
  Pset writeback, exports, the LLM Ask node, subgraphs, solid editor UX.
- **V2 — rich full experience.** Copilot graph authoring, user plugin nodes, batch
  runner, geometry processing, live feeds, watching/auto-reload, multiple named views.
  Includes the single-ruleset `RuleCheck` seed node (hand-authored rule IR, model-derived
  facts only).
- **V3 — automated code compliance** (NBC Part 3/9). A third track on the same platform:
  rule IR + versioned libraries, classification-gated applicability, fact vocabulary,
  document/drawing ingestion, review and authoring surfaces. Designed in the companion
  document `platoflow-compliance-design.md`. One of its decisions applies to the core
  **now**: the five-category verdict system (Pass / Fail / NotApplicable /
  InfoNotAvailable / Uncertain) is defined in the `verdicts` wire type at V1, retiring
  the door-clearance demo's `Inconclusive`.

## 1. The central semantic decision: what flows through a wire

### 1.1 Proposal

The wire payload is the *whole scene* — but as an immutable **view over a shared store**,
never a copy of the underlying tables:

```
SceneValue = {
  model:     ModelRef              // loaded BIM Open Schema tables — shared, immutable
  instances: Uint32Array | bitmask // which instances this branch includes
  channels:  Map<name, Channel>    // overlay columns, per-entity or per-instance
  groups?:   GroupChannel          // partition of instances/entities, with labels
}
```

The substrate is **BIM Open Schema** (`C:\Users\cdigg\git\bim-open-schema`), whose two
halves map directly onto this design:

- `BimGeometry` — columnar instance/mesh/material/transform tables. An instance is the
  tuple `{entityIndex, materialIndex, meshIndex, transformIndex, flags}` (the
  `InstanceStruct` of Ara3D.Models); meshes, materials, and transforms are shared;
  an entity may own multiple instances.
- `BimOpenSchema` — the data half: entities, parameters, descriptors, relations,
  documents, points.

### 1.2 Why a view, not a copy

**Cost.** BimGeometry is columnar and potentially huge. If a filter node "outputs a scene"
by materializing new tables, every branch of the graph duplicates megabytes and memoization
becomes worthless. If it outputs a ~4-byte-per-instance index array plus a reference to the
shared model, fan-out is free, diffing is trivial, and cache keys are cheap hashes.

**Non-destructive edits as channels.** "Change the material," "override the transform,"
"substitute bounding boxes," "attach a computed carbon number" are all the same operation:
add an overlay column, keyed by **instance** (appearance, transform, mesh substitution) or
by **entity** (data — data is per-entity and broadcasts across an entity's multiple
instances). Base tables are never touched; a downstream node sees base-plus-overlays,
latest overlay wins. Precedent: this is the design that already worked in Ara3D.Studio —
Flow's color channel, where color is a FlowObject channel materialized only at the render
seam. The multiple-instances-per-entity case falls out naturally: a per-entity channel
broadcasts to all of that entity's instances at materialization time.

**Tables are derivable; scenes are not.** From a SceneValue you can always project a table
(one row per entity or instance, columns = base parameters + overlay channels). The reverse
is not true. So `scene` is the **dominant** wire type; `table`, `scalar`, `colormap`,
`verdicts` are auxiliary types for where data genuinely leaves the scene (external CSVs,
aggregates feeding charts, LLM answers). The `verdicts` type carries the five-category
compliance enum (see §0 V3 and the companion compliance design); V3 adds `facts`,
`rules`, and `classification` alongside these.

**Provenance.** Each channel records which node wrote it. Pset writeback and audit views
("what did this graph change?") read straight off the channel set — no separate edit-script
machinery needed.

### 1.3 Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Flow raw materialized scenes (deep copies) | Simplest mental model; dies at scale; kills memoization |
| Flow element-ID sets, data in separate table wires | Relationally pure, but users wire join nodes constantly, and visualization needs a separate bridge type. Scene-centric framing is better |
| Flow commands/deltas (each node emits an edit script applied at the end) | Good writeback provenance, but intermediate inspection is opaque — can't show a table or viewport mid-graph without evaluating the whole prefix. Channels give the same provenance without the opacity |

### 1.4 The channel record (sharpened by the PoC)

The PoC validated the channel model as "the strongest idea here" — one resolve rule
(channel first, model parameter second) let filters and coloring work identically over
joined CSV data and native psets with no branching. It also exposed three requirements:

- **A channel is a record, not a bare array:** `{ values, source, numeric, unit? }`.
  Without provenance and type, `WritePset` must guess the IFC property type from JS
  values at write time, and nothing can display "came from carbon.csv:embodied_carbon".
- **Shadowing must be visible.** A channel named `Area` silently hides the model's
  `Area`. Either channels get their own namespace or the shadow raises a visible flag
  on the node that created it.
- **Keep the full-length-array invariant.** Selection and data stay separate — a node
  writes data for all entities and never touches `instances`, so narrowing a selection
  later loses nothing. Representation (sparse map, typed array + validity mask) is a
  profiling decision, not a semantic one.

Null semantics, now a documented commitment: **null means "absent", not "a value."**
Equality, ordered comparisons, and `contains` are false on null; only `!=` is true.
This is deliberate (most parameters are null on most entity types) and deliberately NOT
SQL's three-valued logic — the SQL node follows SQL, the scene nodes follow this rule,
and the docs must say so in both places.

## 2. Architecture: BOS in the middle

Making BIM Open Schema the substrate (rather than live IFC queries per node) restructures
the data plane:

- **Ingest once.** IFC → BOS (Parquet/DuckDB) via the existing `ifc_to_bos` conversion.
- **The host is C# — settled, not a proposal.** A single server process built on the
  Ara 3D SDK and `SimpleHttpServer` (API spec: `platoflow-host-api.md`): native DuckDB,
  BOS parsing, IFC patching, glTF export, MCP — the data plane, the effect edge, and the
  authority for headless evaluation.
- **Evaluation is hybrid, split by a per-definition *runtime class*:**
  - `host` — nodes needing DuckDB, the file system, the network, or the toolchain:
    sources, SQL, big joins/aggregates, WritePset, Export, Ask. These change at
    click-rate, and their results (tables, columns) ship to the client once per change.
  - `both` — the pure columnar scene→scene core (Select, Derive expressions, Group,
    Appearance, colormaps, set algebra): implemented in **both** C# (the authoritative
    reference — headless, tests, batch) and TS (the interactive client evaluator).
    These change at scrub-rate and must never cross a process boundary mid-gesture.
  - `client` — presentation-only projections inside viz sinks (datagrid views, chart
    geometry, 3D draw prep). Headless runs assert on their *inputs*; they never execute
    server-side.
- **The residency boundary is placed by the scheduler, not the user.** A node evaluates
  client-side iff its definition allows it and its inputs are resident (columns are
  fetched lazily from the host and cached by `(model, column, version)`). Upstream of the
  boundary: host evaluation, memoized. Downstream: pure in-browser recompute — a slider
  scrub is an index-array update and a redraw, no marshaling, no round trip. Effectful
  sinks are explicit-trigger (§6), so client-computed channels upload once, at the button
  press, inline in the request.
- **The browser renders from resident data.** Geometry transfers once —
  `InstanceMeshIndex`/`InstanceTransformIndex` map almost 1:1 onto
  `THREE.InstancedMesh` batches grouped by mesh: the fast path for 100k+ instances.

**Data-plane requirements the PoC promoted from nice-to-have to mandatory:**

- **Recolor must be a buffer upload, never a geometry rebuild.** The PoC's viewer
  re-merges on every color change; measured cost scales with instances *emitted* (~7 µs
  each) — fine at 20k instances (~25 ms), unusable at 300k (~2 s per slider tick). The
  real viewer keeps per-instance color attributes (`InstancedMesh.instanceColor` /
  color attribute on merged meshes) updated in place, and reserves rebuilds for
  structural changes. Corollary: hiding is ~10× cheaper than ghosting; the display
  path should prefer it where the design allows.
- **`ModelData` carries a drawable-entity mask.** In real models most entities have no
  geometry (rac_basic: 2070 of 2570) and they sort first — every viz node and every
  table feeding a viewer selection needs `hasGeometry` or each will rediscover the
  "highlight that highlights nothing" bug.
- **The fact/parameter vocabulary must disambiguate class-like fields.** `Type` in BOS
  is the type-object/family string ("1000mm"); the IFC class lives in `Category`; the
  browser loader's "type" is the authoring tool's category name ("Walls"). The PoC
  tripped over all three in one afternoon. Canonical names (`ifcClass`, `familyType`,
  `category`) are part of the §1.4 channel/fact vocabulary, not documentation polish.
- **BOS files need a schema version, and shared enums need one owner.** Two BOS layouts
  exist in the wild with nothing in the file saying which; the parameter-type enum had
  three independent copies (converter, DuckDB views, TS loader) and two disagreed —
  producing *plausible wrong data*, no errors (the PoC found a live off-by-one this
  way). The parity-golden discipline (§8) exists precisely for this class of bug; a
  round-trip test of one known string + one known number per layer is the cheap
  tripwire.
- **Aggregates render the null group honestly.** In the PoC's demo data the *largest*
  carbon sum was the no-level group (unplaced structural elements). Dropping or
  mislabeling the null/empty group hides real data; selection linking must treat the
  empty group as "entities with no value for the grouping key".

**Why hybrid rather than host-only** *(supersedes the 2026-08-09 host-only revision,
which itself replaced browser-only DuckDB-WASM — the design has now converged from both
extremes)*: intermediate visualization nodes (datagrids over query results, 2D graphs,
3D draw nodes) and appearance scrubbing demand instantaneous feedback, and cross-process
marshaling of large intermediates at gesture rate is unwinnable even on localhost.
Equally decisive: **the web-application port.** When the host moves off localhost (cloud
service, object storage, auth), the client core keeps working unchanged — only data-plane
calls cross the network, at click-rate. The hybrid split is the remote-deployment
architecture, not a local optimization.

**The cost, stated honestly:** the `both` tier is implemented twice. It is confined to
the simplest nodes (columnar transforms, index set ops), the C# implementation is
authoritative, and parity is enforced the same way as the reducer pair — shared semantic
golden fixtures (same graph + data → same hashes) that both evaluators must reproduce.
Duplication is never allowed to leak upward: anything complex (SQL, conversion, patching)
is `host`-class by construction.

**Evaluation semantics.** Pull-based, memoized per node on `(paramHash, inputHashes)`,
invalidated downstream from the single reducer choke point. `host` nodes and effectful
sinks are async jobs; the `both`-tier tail is synchronous in whichever runtime owns it.
Errors flow along wires as poisoned values with per-node status surfaced in the UI.
Interactivity budget (V0 gate): slider-drag recolor under ~16ms on a 100k-instance
model — now met *structurally* (the scrub path never leaves the browser) rather than by
transport speed.

## 3. Node semantics: categorize by what a node does to the SceneValue

Classification principle: **a node is classified by which part of the SceneValue it
touches.** The palette stays predictable and the type system self-explanatory.

| # | Category | Signature | Touches | Nodes (tier-tagged) |
|---|---|---|---|---|
| 1 | **Source** | → scene / table | creates | LoadBOS (V0), LoadIFC via ifc_to_bos (V0), LoadTable CSV/Parquet (V1), SampleModel (V0) |
| 2 | **Select** | scene → scene | `instances` | ByType (V0), ByParameter (V0), ByStorey/Zone/Container (V1), ByElevation (V1), ByBoundsSize (V1), ByMaterial (V1), Search (V1); set algebra Union/Intersect/Subtract/Invert (V1) |
| 3 | **Derive** | scene → scene | `channels` (data) | GetParameter (V0), BoundsMetrics (V1), Elevation (V1), Taxonomy/Classify (V1), Expression (V1, see §11), JoinTable by GlobalId (V1) |
| 4 | **Group** | scene → scene | `groups` | GroupBy — storey, type, material, parameter value, spatial container, any channel (V1) |
| 5 | **Appearance** | scene → scene | `channels` (appearance) | ColorBy (V0), SetColor (V0), Transparency/Ghost (V1), Highlight (V1), Hide/Isolate (V1) |
| 6 | **Geometry** | scene → scene | `channels` (transform/mesh) | Offset/Explode (V1), BoundingBoxes (V1), ConvexHull (V2), Simplify/LOD (V2), Merge (V2) |
| 7 | **Reduce** | scene → table/scalar | leaves the scene | ToTable (V0), Aggregate (V1), Bins/Histogram (V1), Count (V0), Sql (V1, see §5.2) |
| 8 | **Sink** | terminal | consumes | View3D pane binding (V0), TablePane (V0), Chart (V1), Legend (V1), WritePset (V1), Export nodes (V1, see §6), Ask LLM (V1), RuleCheck seed (V2), compliance suite — Classify/SelectRuleset/ApplyRules/Report (V3, companion doc) |

Categories 2–6 are all **scene → scene**. That is deliberate: almost any node composes with
almost any node, which is what "flexible enough for new ideas" cashes out to. A new idea is
usually a new Derive or Geometry node — one file, zero editor changes.

`GroupBy` is the hinge node: it is what Aggregate, categorical ColorBy, and Explode
consume. "Associating instances with additional data" = a group channel plus per-group
derived channels. Example: exploded-storey view is a two-node graph —
`GroupBy(storey) → Explode(Z)`.

Set algebra over index arrays (category 2) is trivial to implement and is
disproportionately what makes a node graph feel powerful.

**Node-semantics rules settled by the PoC:**

- **Colormaps auto-range by default** (V1, and worth having even in V0). The PoC's #1
  novice trap: a domain of 0–150 over data running 221–412 clamps everything to one
  color and scrubbing changes nothing — *silently*. `viz.colormap` defaults to the
  observed min/max of the incoming channel with manual override; the node body always
  shows the domain it is actually using.
- **An unconfigured node is "needs setup", not "error".** A freshly dropped select node
  with no parameter reports a distinct neutral state (gray chip, "choose a type"), so
  red is reserved for genuinely broken graphs.
- **Silently dropped rows get counted.** Ordered comparisons over non-numeric data
  (`FireRating > 1`) legitimately drop rows — the node surfaces "N rows dropped as
  non-numeric" rather than presenting an empty result as if the filter matched nothing.
- **Poisoned nodes name the root cause.** Downstream status carries the originating
  failed node's id and message, not just the immediate parent — three hops down a chain
  the user should never have to walk wires backwards.
- **Per-aggregation param schemas.** `count` needs no value column; giving every
  aggregation the same schema forced a special case. Param schemas may depend on
  another param's value (a small, worthwhile inspector feature).
- **CSV column typing is per-column, not per-cell.** Quoting shouldn't decide types;
  infer over the whole column, preserving numeric-looking identifiers as strings when
  the column is id-like.

## 4. UX: one canvas with display flags, plus in-node 2D bodies

### 4.1 The question

Should there be a single draw canvas, or special draw nodes (2D/3D) activated as data flows
through the graph?

### 4.2 The design space

| Option | Precedent | Trade-off |
|---|---|---|
| **A.** One global viewport, everything always draws | Grasshopper default | Simple, but ambiguous and noisy with multiple branches; users spend real effort toggling per-node preview off |
| **B.** Draw nodes are the only way to see anything | strict dataflow sinks | Explicit and pure, but peeking requires wiring a viewer node; multiple live WebGL panes are expensive (context limits, GPU memory) and eat screen space |
| **C.** One main 3D pane + a **display flag** on any scene node | Houdini display flag, Nuke viewer | Viewport is a *pane*, not a node; clicking a small eye icon on any scene-typed node routes the pane to that node's evaluated output. One-click peeking, exactly one WebGL context, "what am I looking at" always answerable |

### 4.3 Recommendation: C, with B layered on top

- **Display flag** (V0) is the everyday interaction: eye icon on every scene-typed node;
  the single three.js pane shows the flagged node's output.
- **`View3D` sink nodes** (V2) exist for *named, saved views* — each stores camera +
  isolation; the pane's tab strip switches between them. Optional, not required for peeking.
- **2D outputs are different**: charts, legends, and small tables are cheap, so they render
  as **in-node bodies** (Gratify parts, V1) — Grasshopper-style at-a-glance readability —
  with a "pop out to pane" affordance for the big ones (V1). 3D never multiplies canvases;
  2D freely does, because it costs nothing.

### 4.4 Interactions that make the single canvas sing

Both are nearly free once scenes are index arrays:

- **Wire/node hover ⇄ viewport linking** (V1). Hovering a scene wire ghost-highlights that
  subset in the 3D pane; selecting elements in the pane highlights which wires carry them.
  This bidirectional link is what makes a node graph over a building feel alive.
- **Count badges on scene wires** (V1, Grasshopper-style): "312 entities / 1,240 instances"
  rendered on the wire. Instantly shows where a filter went wrong.

Supporting UX:

- **Palette** organized by the eight categories; drag-to-canvas creates nodes (V0).
- **Inspector** auto-generated from each node's parameter schema (V0 minimal, V1 full) —
  registry-driven, so adding a node never touches the editor.
- **Per-node status chips** (V0) — idle / running / ok / error — with errors poisoning
  downstream wires visibly rather than failing silently.
- **Undo/redo** across all graph edits (V0; see §7.3 for the deliberately simple design).

## 5. AI and MCP integration

Two directions; the second is the bigger one.

### 5.1 AI *inside* the graph (nodes)

- **Ask** (V1) — natural-language Q&A over the enriched scene; the NRC brief's objective 3.
  Answers cite the queries they ran.
- **Classify** (V2) — LLM maps messy free-text type names/descriptions onto a taxonomy; a
  genuinely hard-to-code, easy-for-LLM task.
- **Rule authoring assist** (V3.1) — AI drafts executable rule IR from annotated code
  text, gated by expert approval against a reference corpus; designed in the companion
  compliance document.

### 5.2 AI as *param authoring assist* — SQL and expressions

The `Sql` node (V1) is a first-class Reduce node: inputs (scenes or tables) are registered
as DuckDB views (`in1`, `in2`, or user-named), the SQL text is a param, output is a
`table`. DuckDB-WASM makes it local and instant.

AI assist lives **in the inspector, not a separate node**: a "generate" affordance sends
the schema (tables, columns, types, sample rows) plus the user's English intent to the
sidecar and fills the SQL box (V1). The English prompt is stored *next to* the SQL as
provenance — the graph then documents intent, not just mechanics. A "fix with AI" button
on SQL errors closes the loop. The user always sees and can edit the SQL; AI lowers the
floor without hiding the mechanism. The same pattern applies to the Expression node and to
rule authoring.

### 5.3 AI *above* the graph: PlatoFlow as an MCP server (V0 surface, V2 copilot)

Per principle P3 (MCP agents are first-class users from day zero), the graph
**edit/evaluate/inspect surface ships in V0** and bootstraps the system: agents author the
test-corpus graphs, demo workflows, and regression suite before the mouse UI is polished.
Copilot assistance (generate-subgraph-from-prompt, explain, fix) and screenshot tooling
remain V2. Expose the app (or its sidecar) as an MCP server with tools such as:

- `list_node_kinds` — straight from the node registry
- `get_graph` / `add_nodes` / `connect` / `set_param` — graph edits
- `evaluate(nodeId)` / `read_output(nodeId)` — inspect any wire's value
- `screenshot` / `set_display_flag` — see what the user sees

Two properties make this nearly free rather than a project:

1. **The registry is the single source of truth** — typed ports and param schemas generate
   the MCP tool documentation automatically, so a new node is instantly known to both the
   palette and the AI.
2. **AI edits go through the same Intent reducer as mouse edits** — undoable, animated
   into view, reviewable. That is the trust model: the copilot proposes a subgraph, it
   appears selected, the user keeps it or hits Ctrl-Z.

This follows the Ara3D.Studio precedent (app driven over MCP). Copilot modes: generate a
subgraph from a prompt, explain a graph, fix type errors, suggest the next node. The batch
runner (§9) also falls out of this surface — `evaluate` with parameter overrides *is*
batch execution.

## 6. Sinks, exports, and effects

The important distinction is not node-vs-menu — it is **pure vs effectful evaluation**:

- *Preview sinks* (View3D, table pane, chart) are pure — they auto-evaluate on every
  upstream change.
- *Effectful sinks* (write XLSX / CSV / glTF / IFC / BOS) must **never auto-run**. An
  export node holds *configuration* (format, path/filename pattern, column mapping) and
  runs only on an explicit trigger.

Design: **export is a node with a run button in its body** (V1) — a configured export is
part of the reusable, documented, batchable pipeline — plus app-level conveniences layered
on top: a "Run all exports" toolbar command (V1), and a context-menu "Export output…" on
any node that creates-and-runs a transient export node (V1). One mechanism, three entry
points.

Practicalities: in-browser, CSV / XLSX / glTF / BOS-Parquet are downloads (or File System
Access API paths). IFC writeback goes through the server — the proven byte-identical patch
path (V1). Power BI = "export Parquet/CSV it can ingest" (V1); a live feed (a small
OData/REST endpoint on the sidecar serving a node's table) is V2.

## 7. Persistence: the graph JSON is the product

### 7.1 Requirements

- **Fully accurate round-trip.** Save → load → save is byte-identical. The JSON is the
  single authoritative representation of a graph; nothing the user built may live only in
  UI state.
- **Independent of the UI layers.** A graph must be loadable, evaluable, and testable with
  no editor, no canvas, no Gratify — headless. The UI is a *view* of the JSON, never its
  owner.
- **Small, diffable, git-friendly.** Graphs are documents; versioning them in a repo *is*
  the workflow library. Demo workflows are files in a `workflows/` folder feeding a picker.
- **Data referenced, never embedded.** Source nodes store paths plus a content hash for
  staleness detection, not payloads. Caches are never persisted — reload recomputes
  (cheap, because of memoization). Optional V2: "pin" a node's evaluated table into the
  file for sharing a graph without its source model.

### 7.2 Representation: four separated layers

> The full specification proposal — including definition/graph separation, URN-style
> versioned definition identifiers, the semver evolution contract, and canonical
> serialization — is `platoflow-graph-json-spec.md`. It supersedes the sketch below
> where they differ.

The proposed shape separates concerns so each layer can evolve, be validated, and be
ignored independently:

```jsonc
{
  "schemaVersion": 1,
  "structure": {                          // pure topology
    "nodes": [ { "id": "n1", "kind": "select.byType", "kindVersion": 1 } ],
    "wires": [ { "from": {"node":"n1","slot":"out"},
                 "to":   {"node":"n2","slot":"scene"} } ]
  },
  "values": {                             // user-entered params, keyed node → slot
    "n1": { "type": "IfcWall" }
  },
  "layout": {                             // canvas placement; deletable without loss of meaning
    "n1": { "x": 120, "y": 80, "w": 180 }
  },
  "session": {                            // optional, most volatile: viewport, displayFlag, selection
    "displayFlag": "n2"
  }
}
```

Design notes:

- **Socket references are `{node, slot-name}` pairs, not positional indices or flat
  synthetic socket ids.** Names survive node-kind evolution (a new optional input doesn't
  renumber everything) and make diffs readable.
- **`structure` + `values` fully determine evaluation.** `layout` and `session` can be
  stripped and the graph still means the same thing — this is what "independent from the
  UI layers" cashes out to, and it is enforced by the test split in §8.
- **`kindVersion` per node** + a tolerant loader: an unknown or newer kind loads as a
  placeholder node that preserves its slots, values, and wires untouched, so old graphs
  degrade gracefully and round-trip losslessly even through an editor that doesn't
  understand them.
- Layer separation also gives undo (§7.3) and collaboration options later: layout-only
  edits (dragging nodes around) can be excluded from semantic history or merged trivially.

### 7.3 Undo: deliberately simple

**V0/V1: a running stack of serialized graph JSON snapshots.** Push before every mutating
intent, coalesce per gesture, drop no-ops by string comparison. Graph JSON is small (tens
of KB at worst); a few hundred snapshots are negligible next to one model's geometry.
Precedent: Kea's `history.ts` (~96 lines, structuredClone snapshots) shipped and works.

**V2, only if profiling demands it:** a chain of **diff records** describing how the graph
changed (`addNode`, `removeWire`, `setValue`, `moveNode` …). The four-layer split makes
these diffs natural to express, and the diff chain doubles as the collaboration/audit
format. Do not build this speculatively — the snapshot stack is likely sufficient forever
at these document sizes.

## 8. Testing: semantics headless, UI apart

Two test suites with a hard boundary, mirroring the §7.2 layer split:

- **Core semantics tests (V0, the important ones).** Input: a graph as
  `structure + values` JSON plus fixture data (a small recorded BOS model). Execution:
  the host's headless evaluator (C#/NUnit), no canvas, no Gratify, no browser.
  Assertions: output tables, instance counts, channel contents/hashes, error poisoning,
  memoization behavior (evaluate twice, second is cache hits), and **round-trip goldens**
  (load → save byte-identical; strip layout/session → same evaluation results).
  Plus the **parity golden corpora** quarantining the system's two confined duplications
  (see the host API spec §1): intent-stream fixtures the C# and TS reducers must both
  reproduce byte-identically, and per-node semantic fixtures the C# (authoritative) and
  TS `both`-tier evaluators must both reproduce hash-identically.
- **UI tests (separate).** Gratify's headless harness (`NullPainter` + deterministic
  `step()`): palette creates nodes, wires connect, undo restores, inspector edits dispatch
  the right intents. These never assert on evaluation results; they assert that UI actions
  produce the right *intents/JSON*.

The boundary is the point: any test that needs both layers at once is a design smell —
it means UI state leaked into semantics or vice versa.

One addition the PoC proved out: a third, thin, **end-to-end browser gate** — a
committed Node script driving a *private headless Chrome over CDP* (launch with
`--headless=new --remote-debugging-port`, `Runtime.evaluate`, console capture), which
asserts the demo workflows on real pixels: force a render, `gl.readPixels`, and compare
statistics over only the non-background pixels (whole-canvas means prove nothing when
the model covers 3% of the canvas). This is the only trustworthy way to prove "the 3D
view actually changed," and it must be a private browser: shared/embedded browser panes
freeze background-tab timers and suspend hidden renderers, which stalls loaders and
invalidates any timing. The PoC's `tools/intgate.mjs` is the template. This gate is
few in number (demo workflows only) and sits on top of the two suites above, not in
place of them.

## 9. Batch processing: parameterize the graph, don't listify the wires

Two designs considered:

**A. Collection wires** — sources emit lists of scenes; every scene→scene node implicitly
maps. This is Grasshopper's implicit looping, and a known complexity tarpit (list-matching
rules, longest-list vs cross-product, users lost in tree paths). It infects the type
system and every node.

**B. Graphs as functions** — a graph declares *graph parameters* (promote any source path
or node param to graph level); a **batch runner** — headless sidecar or CLI — evaluates
the same graph JSON once per input with parameter overrides, running the effectful sinks
each time (filename patterns like `{model}-carbon.xlsx`).

**Recommendation: B, at V2** (graph parameters themselves are V1, since subgraphs want
them too). The editor stays single-model, interactive, comprehensible. The headless
evaluator required by §8 is the same engine the batch runner uses — batch is a for-loop
around a test harness that already exists. If per-item iteration *inside* a graph is ever
needed, add one explicit `ForEach` subgraph node (a lambda region — the Kea heritage
already knows how to draw those) rather than making every wire secretly a list (V2+, only
on demonstrated need).

## 10. Sources, reload, and staleness

A "file changed on disk" *node* is the wrong altitude — staleness is *source-node state*,
not data that flows. So:

- Source node body shows path, entity count, load timestamp, and a **reload button** (V0).
- A **stale badge** appears when the file's hash/mtime changes (V1 — File System Access
  API polling in-browser; fs-watch when the sidecar is involved).
- **Auto-reload** is a per-source toggle, off by default — mid-edit surprise reloads are
  hostile (V2).
- A global **"Reload all"** toolbar command (V1).
- Reload just invalidates that node's memo; the evaluator recomputes downstream and every
  preview updates. No special machinery.

## 11. Extensibility: the dynamic node library

### 11.1 Four tiers of "writing a new node"

1. **Subgraphs (no code, V1).** Group a selection into a reusable node with promoted
   params; save to a user library as JSON. The group/subgraph + port-promotion machinery
   exists in the Kea heritage. This is the tier most users live in.
2. **Expression / SQL nodes (escape hatch, V1).** New *behavior* without new *kinds*.
3. **Scripted nodes (one file, V2).** A module calling
   `registerNode({kind, ports, params, evaluate})` is a complete plugin; a `plugins/`
   folder loaded at startup, hot-reloaded in dev. Matches the house scripting-first
   doctrine. The small surface — `evaluate(inputs, params, ctx)` over tables and
   channels — is the API to keep stable.
4. **AI-authored nodes (V2).** "Make me a node that computes façade orientation" — the
   copilot writes the tier-3 module via MCP. Tier 3's smallness is what makes tier 4
   reliable.

### 11.2 Architecture guardrails — assumptions that must NOT creep in

The registry is dynamic from day one even though V0 ships with a static node set. The
danger is not missing features; it is quiet assumptions that are hard to undo later. Rules:

- **Node kinds are string ids + versions, everywhere.** The core (evaluator, serializer,
  type checker, undo) depends only on the `NodeDef` interface — never imports a concrete
  node module, never switches on a kind enum. (This is the lesson of old platoflow's
  six-switch problem, applied forward.)
- **Registry initialization is async from day one.** V0 loads a static manifest, but
  through the same `await registry.load(manifest)` path a V2 dynamic `import()` of user
  plugins will use. Retrofitting async loading into a synchronously-initialized core is
  exactly the kind of surgery this rule avoids.
- **Wire types are also registry entries.** Type ids are strings; the coercion table is
  data, not code. A plugin can introduce a new wire type (with socket color/shape theme
  entries) without core edits.
- **Param widgets resolve by param-type string** through an inspector widget registry —
  a plugin node with a `"colormap"` param gets the colormap picker for free; a plugin can
  register a new widget kind.
- **Unknown kinds round-trip.** The §7.2 placeholder rule is what makes a plugin
  ecosystem safe: a graph using someone's plugin still opens, shows, and re-saves
  faithfully in an editor without that plugin.
- **Sandboxing decision deferred, interface not.** Tier-3 plugins run trusted (own files,
  own machine) in V2; if untrusted sharing ever matters, the `evaluate(inputs, params,
  ctx)` seam is where a worker/sandbox boundary drops in without API change.

## 12. Expression language: retire the Plato⇄graph flip

PlatoFlow's origin — flipping between Plato source and the graph — is **not carried
forward** into this system. Honest assessment of the arguments:

- The flip demonstrated graph↔code isomorphism, which was its own point. Here the graph's
  authoritative textual form is the **JSON** (§7) — that is what diffs, round-trips, and
  what LLMs read and write. A second textual form earns nothing.
- The audience is analysts and BIM specialists, not Plato authors. For per-row formulas,
  **JavaScript expressions** (V1 Expression node) are familiar, need no parse service, and
  evaluate in-process; for relational work, **SQL** (§5.2) is strictly better than either.
- The one compelling future argument for Plato is **portability**: Plato compiles to
  multiple backends (C#, GLSL), so if expressions ever need to run server-side during
  writeback, or per-vertex in shaders, a Plato expression node becomes the
  write-once-run-anywhere option. That is a V2+ possibility, kept open by making the
  Expression node's language a pluggable property — not a reason to carry the parser
  service or the flip UI now.

## 13. What this design enables (workflow sketches)

1. **Enrich & color** (V0/V1) — LoadIFC → ByType(walls) → JoinTable(carbon.csv) →
   ColorBy(embodied_carbon, viridis) → *display flag*; Legend + ToTable alongside.
2. **Aggregate views** (V1) — GroupBy(storey) → Aggregate(sum carbon) → Chart; same
   aggregate feeds WritePset onto storey entities (component / storey / building levels
   per brief).
3. **Store & round-trip** (V1) — channels → WritePset(`Ara3D_Analytics`) → diff view →
   ExportIFC; re-open and re-query the psets to prove portability.
4. **Ask the model** (V1) — enriched scene → Ask: "Which storey has the highest embodied
   carbon per m²?" — LLM answers via the data plane, citing its queries.
5. **Compliance heat-map** (V2 seed; full permit workflow V3) — RuleCheck →
   ColorBy(verdict, categorical); overrides written back as psets. The V3 permit-check,
   rule-authoring, and missing-information workflows live in the companion doc.
6. **Massing/what-if** (V1/V2) — BoundingBoxes → Explode(storey) →
   ColorBy(energy_intensity): diagrammatic views from the same graph vocabulary, no
   special-casing.

## 14. Open questions (deliberately unresolved here)

- Channel merge semantics on Union/Intersect when both inputs carry a channel of the same
  name (last-wins vs error vs rename). Related but now partially settled by §1.4: shadow
  of a *model parameter* by a channel must be visible; channel-vs-channel merge remains
  open.
- Whether `groups` supports nesting (group-within-group) in V1 or stays a flat partition.
- Mesh-substitution channels: per-instance mesh index override vs a substitution table per
  scene — matters for Simplify/LOD sharing.
- Instance-level vs entity-level selection in the viewport link (probably: pick instance,
  select entity, modifier key for instance-only).
- Exact JSON schema details (§7.2 is a shape, not a schema): slot-name stability rules
  across kind versions, value encoding for rich params (colormaps, column mappings),
  whether `session` persists at all or lives in browser storage keyed by graph hash.

## 15. PoC validation record (2026-08-09)

A throwaway five-beat PoC (`labs/platoflow-poc`; full findings in its `NOTES.md`, the
PoC's real deliverable) exercised this design end-to-end: Gratify node editor, typed
wires, in-browser evaluator with 13 node kinds including a DuckDB SQL node, three.js
BOS viewer with color/ghost/highlight/pick, C# host (SimpleHttpServer, DuckDB, pset
writeback, MCP with a live agent-edit loop), verified 14/14 in a headless-Chrome gate.

**What the PoC confirmed, verbatim into this design:**

- **The P2 seams work.** Four agents built editor, viewer, evaluator, and host against
  the shared contracts without meeting; the assembly typechecked first try with zero
  interface mismatches. Every integration failure was data or environment, never a seam.
- Scene-as-wire-payload, the display flag, count badges, wire-typed sockets, the SQL
  node, the byte-clean pset round trip, and MCP-agent-as-first-class-user (P3) all
  landed as designed and demoed well.
- Type-checked wiring belongs in the connection gesture's snap predicate (an
  incompatible socket never highlights), not in post-connect validation.
- The reducer's one-wire-per-input invariant bought reconnect-replaces with zero code —
  keep illegal states unrepresentable.
- Schema-driven HTML for parameter editing (text in the DOM, canvas for everything
  else) is the right seam; ~120 lines gave native focus/IME/clipboard.

**Changes this document absorbed from the PoC:** the §1.4 channel record and null
semantics; the §2 data-plane requirements (in-place recolor, drawable mask, vocabulary
disambiguation, BOS schema version + single-owner enums, honest null groups); the §3
node-semantics rules (auto-range colormaps, needs-setup state, dropped-row counts,
root-cause poisoning, per-agg schemas, per-column CSV typing); the §8 headless-CDP
browser gate. The host API spec absorbed the create-intent/id-return revision, the
error-shape split, and the transport-free MCP handler prerequisite.

**Requirements this project places on its dependencies** (tracked here until filed
upstream):

- *ara3d-webgl*: export the loader's result types; make `three` a peer dependency
  (bundled copy breaks consumers' materials); read `SingleParameters` as floats (the
  `Int32Array` coercion truncates every numeric parameter — analytics-fatal); an
  in-place per-instance color API + owned geometry lifecycle (rebuild leaks);
  normals (or documented unlit-overlay rule); a columnar parameter accessor; viewer
  takes a container element; loader takes bytes or reports fetch progress.
- *BIM Open Schema / ara3d-sdk*: schema version marker in the file; one generated owner
  for the parameter-type enum (three copies existed, two disagreed, silently); the
  DuckDB view layer (`CreateViews`) moves from the MCP tool project into the reader
  library; converter conversion cached by content hash with a progress channel (43 s of
  silent startup is not shippable); promote the pset write path out of the test project
  (e.g. `Ara3D.Ifc.Editing`); `Ara3D.MCP` gains a public transport-free JSON-RPC
  handler (string in, string out) so hosts can own the socket.
- *Gratify*: an `onCommit(doc)` subscription on the runtime (external UI needs to know
  the doc changed); adornment z-tiers or popups-as-adornments (flat overlay breaks
  world-layer popups); `modal()` beyond adornments; keep text entry in the DOM
  (validated, not a gap).
