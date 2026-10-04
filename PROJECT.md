# BIM Open Toolkit: project brief

Written 2026-09-26 from the repository's documents; rewritten 2026-10-04 after an alignment interview with the owner (the elicitation, three rounds of forced choices, and the diff are in `docs/plans/brief-alignment-2026-10-04.md`). It covers the family of repositories the toolkit composes: bim-open-schema, bim-open-data, bim-open-flow, bim-open-notebook, bim-open-viewer, and this one. A line ending `(unconfirmed)` rests on an inference; the owner confirms or corrects it and removes the marker.

## Purpose

Working with a building model today means a vendor's tool, its API, and a specialist. BIM Open Toolkit lets people work with building models through Claude: ask a question, delegate a task, and get the answer as a table, a chart, a picture, a 3D view, a document, or a file, with the workflow that produced it kept as evidence that can be run again. It is meant to stand out on four counts: what it can do, how easy it is to start, how large a model it handles, and how little time and how few tokens an answer costs.

## Users

- **A BIM professional working through Claude**: a BIM manager, architect, or engineer with a model and a question or a task, who writes no code and wants something to share. The project is shaped for this user first (TKT-1, decided 2026-10-04).
- **Claude**, in the Claude Code desktop app over the MCP (Model Context Protocol) servers and skills, or in the studio's Ask box. Needs a self-describing catalog, results it can show inline, and a session it can keep as a notebook.
- **A data scientist** who codes a little: SQL, a script that becomes a node, raw tables out.
- **A software developer** extending the family: a node pack, a pane, a viewer feature, an MCP tool.

## Workflows

1. **Look, then install one thing.** Actor and trigger: someone hears of the toolkit and wants to see it, then use it on their own model. Today: the family page and the sample pages exist but the notebook's GitHub Pages is not switched on; working locally needs .NET, Node, a dependency fetch, a build, and two servers with a port to get right. With this project: the public pages open the sample notebooks and 3D demos with nothing installed; one install registers the MCP servers and skills in Claude Code, and the user points Claude at an IFC or BOS (BIM Open Schema) file. Done: on a fresh machine, the documented install takes one command, and Claude answers a question about a public sample model; the public pages open every sample notebook. Cost of failure: nobody outside the owner's machine ever sees it work.
2. **Ask or delegate in Claude, and keep the session.** Actor and trigger: a user asks a question or hands over a task ("a door schedule per storey with a chart, as a report") in Claude Code or the studio. Today: Claude answers questions over the DuckDB export and over IFC files through the two MCP servers and builds graphs that open in the editor; the Ask box's Claude backend is being moved off the API key (TKT-45); results are text in chat, and the sample notebooks are reconstructed afterwards, not recorded live. With this project: Claude builds the workflow, runs it, and shows each result inline, like a notebook: a table, a chart, a 3D view, a picture; it fixes a red node or explains one on request; the session is saved as a notebook file. Done: the committed benchmark (workflow 5) scores correct on its questions and tasks with Claude; a session in Claude Code saves as a notebook that opens with no host. Cost of failure: the AI story is a demo that worked once, and people go back to hand-written SQL.
3. **Get the answer in every form and hand it to someone.** Actor and trigger: a user wants a chart, a rendered picture of the model, a dashboard, or a report a colleague can open without the toolkit. Today: the studio has a chart pane and tables; the 3D pane renders and captures by script; exports and reports wait on a Run the editor cannot start (TKT-12); a notebook shows its results read-only with no host. With this project: a picture of the coloured or sectioned model, a document or dashboard as one file, and a notebook another person opens in their own notebook environment or online, with every result still carrying its graph. Done: a notebook made in workflow 2 holding a table, a chart, and a picture of the model opens from the public page and in a second person's local notebook; after Run, the report and export exist on disk and the run record names them. Cost of failure: "detailed analysis and charts" stays a screenshot of a table.
4. **Extend it with a script or a pack.** Actor and trigger: a data scientist, a developer, or Claude needs a node that does not exist. Today: a node is a C# class in a pack; adding one means a build of the host; a scripting surface was out of scope until 2026-10-04. With this project: a script in a documented place becomes a node, with its catalog entry and a test, and Claude can write it when a task needs it; node packs grow in the same way. Done: a node written as a script appears in the catalog, in Claude's tool description, and in a graph Claude builds, without editing the host. Cost of failure: every new capability waits for the owner, and Claude cannot do work it could already do.
5. **Measure it against doing without it.** Actor and trigger: the owner before a release or a demo, or anyone asked "why not just use Claude on the raw files?". Today: a ten-question set over the DuckDB export, eight IFC questions, and a first 100-question run of IFC-Bench, an external benchmark with ground truth (TKT-145), all scored for correctness only; nothing compares the toolkit to a bare session. With this project: a committed benchmark of questions and tasks over public models, run twice with the same model, once with the toolkit's MCP servers and skills and once with only the raw files and a shell, scoring correctness, time, and tokens. Done: one command runs both arms and writes a report with the three scores per arm, committed with the transcript before each release. Cost of failure: no way to know whether the toolkit helps, and no number to put on a slide.

## Principles

1. **One edit path.** Every gesture, MCP edit, Ask turn, and script-made node goes through the same graph operations: an agent's graph is one a person could have built, and no surface drifts from another.
2. **Nothing writes until Run.** Evaluation for display, by a person or Claude, never touches a file; writers stay pending until an explicit Run: delegation is safe because exploring cannot do harm.
3. **Honest absence.** A missing measure stays missing: no NULL turned into 0, no size read from a name, no identity merged on a matching position: a fabricated complete answer misleads every decision downstream.
4. **Runs are the evidence.** A run pins the graph and every input by content hash and replays; a number Claude reports comes from a tool result, never from memory.
5. **Tables are the currency.** Almost everything on a wire is a table; scalars are parameters on the node; a new need is a node or a parameter kind, never a wire type: one vocabulary serves ETL, SQL, 3D, charts, documents, and checks.
6. **The catalog is the documentation; warn, never block.** Every node declares its ports, kinds, and purity, and the docs are generated from that; an unknown column or a bad query is a warning shown before any run: people wire graphs before the data exists, and agents ask instead of guessing.
7. **The agent works in the open graph.** Claude knows which graph is open, what is selected, and the last result without being told an id, and its edits land selected and undoable.
8. **It explains itself.** Every result names the graph that made it, every node shows its state and the upstream cause, every wire can be peeked at: the owner can say at a demo what each step did and what the output means.
9. **Work names its workflow and its measure.** No work starts without naming the workflow above that it serves and the Done line or benchmark score it moves; a session that cannot name one stops and asks: polishing a low-priority thing costs the owner's credits and time.

## Replaces or augments

Replaces: SQL typed into a DuckDB shell and spreadsheet checks over exports; scripts against an authoring tool's API; screenshots and pasted tables as deliverables; an AI answer whose origin nobody can show. Augments: Claude Code and the studio's Ask box; DuckDB, Parquet, and Excel; the IFC file, which stays the source of truth because write-back is byte-exact; web-ifc and three.js.

## Scope

In: the schema and its reference implementation; the dataflow engine, host, MCP servers, editor, and panes; the notebook; the 3D viewer; the BIM node packs, studio, samples, and gates; scripts as node definitions; the public sample pages; the benchmark. Also kept and tested, no longer driving priorities: the rule check with its evidence package, and the NRC (National Research Council Canada) paper's reproduction and byte-exact IFC write-back. Windows for the full toolkit; the engine, schema, and web parts are portable.
Out: authoring or editing geometry; a live connection to any authoring tool (the Revit add-in exports and is not extended); a hosted multi-user service with accounts; a general scripting API outside node definitions; several models in one graph or one Run (TKT-21 may reopen this); clash detection beyond bounding-box candidates; node-graph instrument features no workflow needs; Gratify learning anything about BIM.

## Success

- The benchmark's toolkit arm scores higher on correctness and lower on time and tokens than the bare arm, on every release, with the transcript committed.
- A fresh machine goes from nothing to a correct answer from Claude about a public model with one documented install, and the public pages open every sample notebook with nothing installed.
- A notebook recorded live in Claude Code, with a chart and a picture of the model, opens on another person's machine and online.
- A model of Snowdon's size (about 450,000 instances) stays usable: the first 3D frame and a benchmark question each fit a published budget. (unconfirmed)
- A node written as a script, by a person or by Claude, is in a graph the same day without a host build.

## Open questions

- TKT-4 The user-facing noun: analysis, workflow, or graph?
- TKT-21 Is the multi-building query platform over the 467-file corpus part of this stretch?
- TKT-162 Which language do script nodes use, and where do they run?
- TKT-163 Does "open a notebook online" need a hosted host, or only the public page with snapshots?
