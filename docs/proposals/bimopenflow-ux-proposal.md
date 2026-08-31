# Proposal: the BimOpenFlow user experience

> **AI-assisted design document** (Claude Fable 5 + Christopher Diggins, 2026-08-31).
> Method: an initial UX proposal was drafted from the system structure alone
> (`docs/bimopenflow-structure.md`, the `@bimopenflow/app` README), then checked
> against two earlier brainstorms — the node-editor idea bank
> (`studio/docs/kea-node-editor-ui-ux-ideas.md`, 2026-07-10) and the workflow
> brainstorm (§1 of `platoflow/docs/platoflow-v1-nodes.md`, 2026-08-30, 56
> workflows across 9 personas). This document records both the proposal and how
> the brainstorms shaped it.

## 1. The one-sentence version

BimOpenFlow's UX should be a **template-launched, verdict-centered,
everything-inspectable linear-pipeline editor** — not a general node-graph
instrument.

The justification is the interaction between the two brainstorms: the idea bank
is a menu of several hundred editor features; the workflow brainstorm is the
filter that selects among them. Nearly all 56 workflows are linear pipelines of
4–8 nodes — select → (join/derive) → rule or aggregate → verdicts/color/chart →
export. Nobody builds shader-graph sprawl. That deprioritizes most of the idea
bank's navigation and canvas machinery (semantic zoom, fisheye, subway maps,
workspaces, game systems) and elevates a small set of ideas the workflows hit
constantly.

## 2. Target workflows

The first UX cut serves these, all V1-buildable per the workflow brainstorm:

1. **Model QC / audit** (BM) — missing psets, naming, duplicates → verdicts →
   color-coded 3D + offender table → report. (Workflows 1–9.)
2. **Enrichment and rollup** (SA, CE) — CSV join by GlobalId → derived channel →
   color heat-map, aggregate by storey/type → chart + writeback. The carbon and
   cost families. (13–24.)
3. **Compliance check** (CR) — rule with citation → five-category verdicts →
   itemized report + evidence package. (26–33.)
4. **Ad-hoc data work** (DE) — SQL → table → chart/export; "ask the model" with
   the generated SQL shown. (49–51.)
5. **Publishing** — analysis → live dashboard or static run report others
   consume without the editor.
6. **Agent-assisted authoring** (AI) — an agent assembles or extends the graph
   via MCP; the human reviews the graph itself. (52.)

Dropped from the first cut: model version diff (V2+ — no cross-model nodes),
geometric checks beyond bounds, 4D/time, batch runs.

## 3. Layout

Graph canvas on the left; one linked pane area on the right (3D, table, chart,
verdicts, params as tabs); a run bar on top; the analysis library in a sidebar.

Selection is global and bidirectional: pick a node and the pane shows its
output; pick a verdict row and the 3D view highlights the element while the
responsible rule node glows; pick an element in 3D and see its rows and the
nodes that touched it.

## 4. UX pillars

1. **Data-first, graph-second.** A new analysis starts from a model with a live
   table pane, or from a template — never a blank canvas.
2. **Every wire is inspectable.** Hover or click any port to peek at the table
   or value flowing through it; row counts shown on wires. Every workflow flows
   tables or scenes, so this is the single highest-leverage feature.
3. **Cross-probing everywhere.** Selection links 3D ↔ table ↔ chart ↔ verdicts
   ↔ graph nodes, in both directions.
4. **Live evaluation made visible.** Node state badges (stale / computing /
   ready / error) on the canvas; errors name the upstream cause inline.
5. **Templates over blank canvas.** The workflow brainstorm is a template
   catalog in disguise: "New analysis" offers the 44 V1 workflows by name and
   persona, each opening a working graph with its parameters exposed. Most
   users tweak params before ever wiring a node.
6. **Verdicts as the center of gravity.** A dedicated verdict pane: rollups by
   rule and category, drill-through to offenders, citation display. The five
   categories are first-class — `InfoNotAvailable` is a deliverable, not an
   error. Categorical 3D coloring and report hand-off flow from here.
7. **Provenance surfaced.** Channels already carry `source`; show it. A value
   card answers "where did this number come from" ("carbon.csv joined by
   GlobalId, derived by `carbon / area`"). The compliance track makes this a
   product requirement, not polish.
8. **Runs as first-class UI.** Run history per analysis; open a run read-only;
   diff two runs; reports and evidence export from a run, never from the live
   session. Sink nodes visibly declare "will write on Run" so the pure/effect
   split is legible on the canvas.
9. **Fast node ergonomics.** Drag from a port to get a palette filtered to
   compatible nodes (snap-predicate typing — incompatible sockets never
   highlight); insert-node-on-wire; expression editor with column-name
   autocomplete and live what-if (edit the expression, watch the heat-map
   change).
10. **Params over wires for scalars.** Thresholds travel as params by design,
    so the params pane gets real investment: promote a node param to a graph
    parameter with one gesture; graph parameters render as a compact control
    strip on templates.
11. **Agent edits as reviewable patches.** Agent-proposed changes appear as
    ghost nodes and a topology diff the user accepts or rejects. Human and
    agent use the same operations (already true via MCP); the UI makes the
    agent's work inspectable and reversible.
12. **Scale affordances, later.** Groups/subgraphs, canvas annotations, and a
    minimap — real, but linear pipelines defer them.

## 5. Priorities

- **P0 (serves all 56 workflows):** template gallery keyed to the workflow
  list; port/wire table peeking with row counts; node state badges; drag-from-
  port filtered palette; expression autocomplete.
- **P1 (serves the audit/compliance/carbon spine, ~30 workflows):** verdict
  pane with rollups and citations; bidirectional 3D cross-probing; channel
  provenance cards; shared-colormap legend so parallel views are comparable;
  Run-gating UI on sinks.
- **P2 (scale and the agent persona):** agent patch review (ghosts +
  accept/reject + graph diff); run history and run-vs-run output diff;
  groups and annotations; minimap.

## 6. How the brainstorms changed the initial proposal

The initial draft (written before reading either document) already had
data-first entry, wire peeking, cross-probing, visible evaluation, templates,
first-class runs, node ergonomics, and agent collaboration. The brainstorms
made these corrections:

- **Model comparison dropped** — the initial draft listed it as a target
  workflow; it is V2+ (no cross-model diff nodes exist).
- **Templates promoted to the primary entry point** — 44 enumerated, buildable,
  persona-tagged workflows make the gallery nearly free to specify.
- **Verdict pane upweighted** — the workflows show it is where the compliance
  persona lives, not one pane among five.
- **Provenance added** — missing from the initial draft; the channel design
  already stores what the UI needs to show.
- **Params pane upweighted** — the wire-type decision (no scalar wires) moves
  threshold-tuning UX from wires to params.
- **Most of the idea bank consciously declined** — semantic zoom, 3D canvases,
  game feel, living infographics: good ideas for a general instrument, not
  demanded by any of the 56 workflows. Revisit if graph shapes change.
