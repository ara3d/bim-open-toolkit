# BIM Open Toolkit: project brief

Written 2026-09-26 by an unattended session from the repository's documents; `docs/CANDIDATE-WORK.md` lists the sources and the ideas gathered. A line ending `(unconfirmed)` rests on a proposal, an inference, or conflicting sources; the owner confirms or corrects it and removes the marker.

## Purpose

Building data is locked behind each authoring tool's API, and the exchange formats that exist were shaped for geometry handoff, not analysis. BIM Open Toolkit stores a model as plain tables (BIM Open Schema) and turns questions about those tables into small, inspectable, reproducible graphs (BimOpenFlow) that people and AI agents build with the same four operations. It exists so that an analyst gets a schedule, a check, a chart, or a coloured model out of a building without a vendor's process, and so that an agent doing it for them produces evidence rather than a guess.

## Users

- **BIM analyst or manager** with a converted model and a question: a door schedule, rooms per storey, what is missing. Writes no code. Served today through the Snowdon DuckDB studio and the sample graphs.
- **An agent acting for them**: Claude in the studio's Ask box, or in Claude Code through the two MCP servers (`bimopenflow-duckdb`, `bimopen-ifc`) and the two skills. Needs a self-describing catalog, paged read-back, safe exploration, and a run record to hand over.
- **Compliance checker, and the official who receives the result**: a rule with a citation, five verdict categories, offenders coloured in 3D, a report, and an evidence package with hashes.
- **Reviewer of the model in 3D**: category colours, sections, exploded views, plans, ghosting; pick an element and read its property sets.
- **Researcher** reproducing the NRC paper's figures and numbers from one command.
- **Enrichment writer** (carbon, cost, QC) putting per-element results back into a copy of the IFC without disturbing any other byte.
- **Tabular analyst without BIM data** (CSV, XLSX, SQLite, DuckDB, Parquet) using the tables profile.
- **Developer or coding agent** extending the toolkit with a node pack, a pane, a viewer feature, or an MCP tool, guarded by layering tests and headless gates.

## Workflows

1. **Answer a question about Snowdon from a clean clone.** Actor and trigger: an analyst needs a door schedule, rooms per storey, or a missing-width list from the Snowdon model. Today: prepare, run, and export a typed DuckDB by hand, open `/duckdb.html`, and pick one of nine sample graphs whose sources are absolute paths, so a fresh clone does not reproduce it. With this project: the nine graphs open green from a clean clone plus the private files, sources resolved by name, and the result can be charted or exported without leaving the page. Done: `/duckdb.html` shows 142 doors and 290 spaces, and `check-bim-flow-duckdb.mjs` evaluates all 48 nodes with the database hash unchanged. Cost of failure: the owner's only large real model is unusable, and every chart and every Claude demo downstream loses its data.
2. **Ask in plain language and get a graph you can inspect.** Actor and trigger: an analyst who will not wire nodes types a question in the Ask box, or a developer asks it in Claude Code. Today: with an API key, the agent calls `describeDatabase`, one `editGraph` batch, `evaluate`, and `getResult`; the graph is saved as `ask-<words>` and the studio needs a reload to show it; measured only with gpt-5 (8 correct graphs, 2 honest refusals, 0 wrong of 10). With this project: Claude is the default, the agent's edits appear live and as reviewable patches, and a failure teaches instead of erroring. Done: the ten-question set yields at least 8 correct graphs and 0 wrong answers with Claude, recorded in a transcript per release, and `scripts/demo-bim-flow-mcp.mjs` prints PASS with 142 doors. Cost of failure: the AI story is a demo that worked once, and people go back to hand-written SQL.
3. **Chart it and take it with you.** Actor and trigger: an analyst wants rooms per storey or elements per type as a chart, and an Excel or Parquet file for the next tool. Today: `chart.bar`, `chart.line`, and the export sinks exist, but the Snowdon demo shows tables only, and an export waits for a Run that is created through the HTTP API rather than from the editor. With this project: a chart pane sits next to every Snowdon table, and a Run button writes the export with a run record. Done: a chart of rooms across 34 storeys renders in the studio, and an `.xlsx` exists on disk after Run, named in the run record. Cost of failure: "detailed analysis and charts" stays a screenshot of a table. (unconfirmed)
4. **See it in the building.** Actor and trigger: a reviewer wants Snowdon coloured by category, sectioned, exploded, and to pick an element for its property sets. Today: `/3d.html?analysis=snowdon-toolkit` renders 456,598 instances from an eleven-node recipe, 5.2 to 5.8 s to first frame, with no shared legend. With this project: a coarse first frame within about a second, one colour domain with a legend across panes, saved views, and selection linked between graph, table, and 3D. Done: the four Snowdon captures regenerate, the legend is populated, and the measured first-frame time is logged under its target. Cost of failure: the most persuasive demo of graphs meeting visualisation feels slow and unfinished.
5. **Check a rule and hand over the evidence.** Actor and trigger: a compliance checker applies DC-W1 (door leaf width at least 850 mm), or an enrichment writer puts per-element results back into the IFC. Today: `check.rule`, `view3d.color`, `chart.bar`, and `sink.report` give 8 Pass and 6 Fail on the Duplex sample; `sink.writePsets` writes 2,438 values byte-exactly; both sinks stay `EffectPending` because no Run exists outside the tests. With this project: a verdict pane with rollups and citations, a Run that pins the graph and input hashes, and a static report and evidence package produced from the run without writing code. Done: after Run, `report.html` and `evidence.zip` with a SHA-256 manifest exist, and the enriched IFC differs from the original only in the new property sets. Cost of failure: the NRC deliverable and the claim "evidence, not suggestion" have no artefact behind them.
6. **Reproduce the paper with one command.** Actor and trigger: the researcher or the owner before a submission or a demo. Today: `npm run nrc:walkthrough` builds the host and both MCP servers and captures 10 Duplex and 6 Snowdon figures with transcripts in 291 s, run by hand. With this project: the same, kept green as nodes and UX change, with the eight cited numbers asserted. Done: the walkthrough index lists every figure and `NrcWorkflows.Tests` pass on every push. Cost of failure: the paper's claims drift from the code and nobody notices until review.

## Principles

1. **One edit path.** `addNode`, `connect`, `setParam`, and `removeNode` back the HTTP API, the MCP tools, the Ask box, and every editor gesture: an agent's graph is one a person could have built, and no surface drifts from another.
2. **Nothing writes until Run.** Pure nodes memoize and re-evaluate freely; every writer lives in one pack and stays `EffectPending` until an explicit Run: evaluating for display can never touch a file, so exploration by a person or an agent is safe.
3. **Honest absence.** A missing measure stays missing: no NULL turned into 0, no size read from a name, no identity merged on a matching position; `InfoNotAvailable` is a deliverable: a fabricated complete answer misleads every decision downstream.
4. **Runs are the evidence.** A run pins the graph hash and every input by content hash and replays; a number an agent reports comes from a tool result, never from memory: that is the difference between a suggestion and evidence.
5. **Tables are the currency, and every wire can be peeked at.** Five value kinds travel on edges and almost everything is an immutable table; scalars are parameters, and a new type is a parameter kind, never a wire type: one vocabulary lets ETL, SQL, 3D, charts, and checks compose, and each wire type costs five pieces of machinery.
6. **The catalog is the documentation; warn, never block.** Every node declares its ports, parameter kinds, enums, and purity; `docs/nodes.md` is generated from that; live suggestions never reject a value, and an unknown column is a warning with a count: people wire graphs before the data exists, and agents ask instead of guessing.
7. **Dependencies point one way, and a test says so.** Spec, engine, BIM data, node packs, surfaces; packs never reference each other, and nothing below the packs knows BIM: the engine and the viewer can stand alone, and a rule the build checks needs no reviewer.
8. **The AI produces data, never verdicts.** A model may draft SQL, a graph, or a fact with provenance, always shown; a verdict is the deterministic execution of an approved rule, and approve, publish, and issue stay human verbs. (unconfirmed)
9. **Start from data, not a blank canvas.** A new analysis opens from a model with a live table or from a template, and most people adjust parameters before they ever wire a node; the pleasure of the tool is immediate feedback: peek at any wire, watch a heat-map change as an expression is edited, click a verdict and see the element. (unconfirmed)

## Replaces or augments

Replaces: SQL typed into a DuckDB shell and spreadsheet checks over exports; scripts against an authoring tool's API to get numbers out; screenshots and pasted tables as deliverables. Augments: DuckDB, Parquet, and Excel (BOS loads straight in, exports go straight out); Claude Code (two MCP servers and two skills); the IFC file itself, which stays the source of truth because write-back is byte-exact; web-ifc for parsing and three.js for rendering.

## Scope

In: the BOS reference implementation with IFC loading, meshing, and byte-exact property-set editing; the specified dataflow engine (`submodules/ara3d-dataflow`) and its conformance suite; the node packs, the headless host, the two MCP servers, the web editor and panes, the 3D viewer workspace, and the publishing chain (report, dashboard, evidence package); samples that run without private data, and headless gates; Windows.
Out: authoring or editing geometry; a live connection to any authoring tool (the Revit exporter is postponed); a multi-user hosted service, accounts, or authentication; a second scripting API or an agent-as-code surface; an agent that grades a building, negotiates between disciplines, or issues a verdict; general node-graph instrument features no target workflow needs (semantic zoom, 3D canvases, new wire types); cross-model comparison; porting the retired PoC or the alpha gallery; Gratify learning anything about BIM.

## Success

- A fresh clone plus the private Snowdon files reaches the studio with all nine graphs green and no hand edits (today: absolute paths break it).
- The ten-question Ask set scores at least 8 correct and 0 wrong with Claude, on every release (today: measured once, with gpt-5).
- Snowdon's first frame in `/3d.html` under 2 s warm, with a populated legend (today: 5.2 to 5.8 s, no legend).
- A rule check produces `report.html` and `evidence.zip` from a Run with no code written (today: unit tests only).
- The NRC walkthrough is green on every push (today: run by hand, 291 s).
- Someone who has never seen the editor makes a chart from a template within ten minutes without reading a document. (unconfirmed)

## Open questions

- TKT-1 Who comes first when they conflict: the analyst with an agent in the studio, or the developer integrating the libraries?
- TKT-2 Which Snowdon DuckDB export is canonical: the 48-table export with walls and windows, or the 11-table one without?
- TKT-3 Is the DuckDB workflow studio behind the Ask box a committed, supported demo?
- TKT-4 The user-facing noun: analysis, workflow, or graph?
- TKT-5 Scalar parameters: inline on the canvas, in the params pane, or both?
- TKT-6 Does the Ask box default to Claude, and which request set measures it?
