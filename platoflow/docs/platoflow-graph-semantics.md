# PlatoFlow — what a graph represents

> **AI-assisted design document** (Claude + Christopher Diggins, 2026-08-30).
> Companion to `platoflow-ifc-design.md` (core design), `platoflow-v1-nodes.md`
> (node vocabulary), and `platoflow-compliance-design.md` (verdicts). A thinking
> document: what does a graph *mean*, and what should we call it?
>
> Scope: conceptual semantics and vocabulary only. No new mechanisms.

The core design says "the graph JSON is the product" and "a folder of graph files IS
the workflow library." The node catalog says "graphs are documents (the compliance
track literally hands them to officials)." The compliance design hands a graph to a
regulator as evidence. These statements pull in different directions — library of
reusable things, document you read, proof of what ran — and the tension shows up
concretely in UI naming, versioning, and what gets signed. This document works out
what a graph actually is.

## 1. Candidate readings

Each taken seriously; each gets something right; most break somewhere.

**A workflow.** The word we keep using, and the worst fit. A workflow has sequenced
tasks, actors, handoffs, and state ("step 3 is waiting on Dana"). A PlatoFlow graph
has none of that: it is dataflow, always-on, wholly re-evaluated when anything
changes, with no notion of task order beyond data dependency and no actors at all.
The one thing "workflow" gets right is that a graph *encodes a practice* — the
missing-pset audit, the carbon rollup — something a person used to do by hand in
steps. The word describes the graph's ancestry, not its semantics.

**A program.** Strong fit for the `structure + values` layers: a pure function from
(model, external data) to tables, views, and verdicts, deterministically evaluated,
memoized, testable headless. The breaks: a graph file also carries `layout` and
`session` — presentation state no program has — and a graph is never "run to
completion"; it is a standing evaluation that preview sinks observe continuously.
Only the Run-gated sinks resemble program execution.

**A query.** Better than program for the always-on character: a persistent,
composable question asked of a model, re-answered whenever the model or the question
changes. `select → derive → aggregate` *is* a query plan you can see. Breaks on the
sinks (queries don't write psets or export files) and on the annotation/presentation
layer (queries aren't read in meetings).

**A document / report.** Right about the social life of a graph: it has a name, it
carries notes (`graph.note` exists precisely because "documents need annotations"),
it is diffed and reviewed like prose, and the compliance track hands it to an
official. Breaks on agency: a document doesn't *do* anything, and the most important
property of a graph — deterministic re-evaluation — is exactly what documents lack.

**A recipe.** Captures reuse-across-models: the carbon heat-map graph applied to the
next project. But note what the format actually says: a graph *names its model* in a
`load.model` node's params. A graph is bound to a model by default and becomes a
recipe only when that binding is promoted to a graph parameter (V1) or overridden by
the batch runner (V2). So "recipe" describes a graph after parameterization, not a
graph as such. This is a real fork in the semantics — see §4 on versioning.

**A lens / view.** True of the middle of every graph — a way of seeing the model,
non-destructive by construction (views over shared immutable tables, overlay
channels, selection that narrows nothing). Fails as a total account because graphs
also *produce*: new channels, verdicts, exported files, written psets. A lens does
not enrich what it looks at.

**A contract / specification.** The FM handover-readiness audit is the sharpest
case: the graph does not merely check requirements, it *is* the requirement,
stated executably. "Maintainable assets must carry manufacturer, model, serial,
warranty" exists nowhere but as that graph. Right for compliance and QA graphs;
wrong for exploratory ones (the massing diagram specifies nothing).

**A record / evidence.** What the compliance track needs: proof that this analysis
ran, deterministically, on this model, replayable by anyone. But the graph file
alone is not that — it contains no results, no model hash pinned at run time, no
timestamp. Evaluation is deterministic *given* the model and external data; the file
references them by path plus content hash for staleness, which detects change but
does not freeze anything. The evidence is graph + pinned inputs + outputs, which is
a *run*, not a graph. The file is the replay instrument, not the recording.

**A definition of a derived dataset.** The dbt-model / materialized-view reading: a
graph defines tables, channels, and verdicts *derivable* from a model, kept fresh by
re-evaluation. Quietly the most technically accurate reading for the semantic core —
it is what memoization, staleness badges, and reload semantics already assume. Its
weakness is purely social: nobody hands a view definition to a building official, and
it says nothing about the 3D pane or the notes.

## 2. What the invariants say

Every graph, whatever it does, shares: JSON-canonical with byte-identical round-trip;
`structure + values` fully determine evaluation, `layout + session` strippable;
diffable and git-friendly; deterministic, memoized, whole-graph evaluation;
effect-free until an explicit Run; self-describing (channels carry provenance,
verdicts carry citations, warnings are counted, the SQL node stores the English
intent beside the SQL); and model-relative (meaningless without a model to stand
against, but touching the model only through explicit Run-gated sinks).

These invariants are the invariants of **source code for a deterministic
derivation**. Round-trip fidelity, diffability, headless evaluation, the
layout/session split, effect-gating — all of it is machinery for treating the file
as reviewable source whose meaning is a pure function. None of it is machinery for
sequencing tasks (workflow), for prose fidelity (document), or for freezing results
(record). The invariants favor the program/query/derived-dataset cluster and
firmly reject "workflow." The document reading survives not in the invariants but
in the *affordances layered on top of them*: notes, names, the review culture.

## 3. Are graphs artifacts?

Three senses of the word, three different answers.

**AEC deliverable sense** — drawings, schedules, reports. The graph is *not* this
artifact; it is the thing that produces them. `sink.report`'s HTML, the exported
CSV, the enriched IFC are the deliverables. But the compliance track deliberately
promotes the graph itself into a deliverable — the official receives the graph
*because* it is better than a report: a report says what was found, the graph shows
how, and can be re-run to check. So: normally the producer of artifacts, sometimes
elevated to one.

**Software sense** — source vs build artifact. Unambiguous: the graph is source.
Authored, versioned, reviewed, diffed. Its evaluated state (memoized node outputs,
the rendered view) is the build product, explicitly never persisted ("caches are
never persisted — reload recomputes"). The V2 "pin a node's table into the file"
option is the exception that proves the rule: embedding a result is a deliberate,
marked act, not the default.

**Claude/AI sense** — a shareable generated product. Partially: agents author graphs
via MCP and humans review them, so a graph can be an AI artifact in provenance. But
unlike a chat artifact it has ongoing execution semantics; it is closer to
AI-generated source than to AI-generated content.

**The dual nature is real, and it is one file, two things.** The file is the
*definition* — source, pure, model-relative. The definition standing in front of a
model, evaluated, is the *live document* — the thing shown in a meeting, colored in
3D, read off the verdict chips. Excel is the honest precedent: a workbook is
formulas (program) and their current values (document) sharing one file, and Excel's
long-standing confusions (stale values, "which numbers are typed and which
computed?") come precisely from not separating the two. PlatoFlow already separates
them structurally — values are never in the file, evaluation is always fresh — which
is why its version of the dual nature is benign. The Jupyter comparison is the
cautionary one: notebooks embed outputs in the file, making the document-vs-program
tension a permanent source of dirty diffs and stale-state bugs. PlatoFlow is a
notebook that never saves its outputs — and for the evidence use case, a *run* (§4)
is how outputs get saved on purpose.

## 4. Consequences

**Naming.** Users should not see "workflow" — it promises sequencing and actors the
system doesn't have, and it undersells the live, re-evaluating character. "Program"
and "query" are semantically right and socially wrong for the audience (analysts,
BIM managers, officials). "Notebook" imports Jupyter's baggage. "Board" says
nothing. **"Graph" is fine for the canvas-facing editor**, where the user is looking
at literal nodes and wires; the better user-facing noun for the *thing as a whole*
is **"analysis"** — an analysis is something you author, apply to a model, read the
results of, hand to someone, and re-run. It covers audit, rollup, check, and
dashboard graphs without lying about any of them.

**The library.** A folder of analyses is a *capability library* (recipe reading),
not a document set: what earns a place there is reusability across models, which
means the library entries are exactly the graphs whose model binding has been
promoted to a graph parameter. This suggests a soft distinction the UI can surface:
a graph bound to its model (a project analysis) vs a parameterized graph (a library
analysis). Same format, one flag of difference — the same file becomes a recipe by
abstraction, not by conversion.

**Versioning.** A project analysis pins its model (path + content hash; staleness
badges make drift visible). A library analysis roams — the model is a parameter and
the graph carries only expectations about it (types, parameters, relations it
selects on). The failure mode to design for is a library graph silently half-working
on a model that lacks its expected parameters — the `InfoNotAvailable` verdict and
needs-setup/warning machinery are the right surface for that, and this is an
argument for running even non-compliance library graphs through nodes that report
absence rather than skipping it.

**What gets signed.** Not the graph — the graph is source and keeps evolving. What
an official signs is a **run**: graph (content hash) + model (content hash) +
external data (content hashes) + outputs (report, verdicts) + timestamp. This is
the door-clearance precedent (SHA-256'd deterministic reports) generalized.
`sink.report` already records model id, graph name, and run timestamp; the missing
piece is content hashes of all inputs, which the format already collects for
staleness. A frozen run is cheap to define and should be a named concept in the
compliance track: the graph is handed over *alongside* the signed run, as the
replay instrument for it.

**Precedents, placed.** Grasshopper definition — closest in feel (dataflow over a
model, live), but GH definitions are famously not documents: unannotated,
undiffable, unreviewable, and PlatoFlow's document affordances are the deliberate
inversion of that. Jupyter — the warning about embedding outputs (§3). dbt model —
the right versioning story (source-controlled derivation definitions, run
artifacts separate) and the closest match to the semantic core. Excel workbook —
the closest cousin in *audience* and dual nature; PlatoFlow is an Excel where the
formulas are visible as structure and the values are never stale. Power BI /
saved SQL view — right about model-relativity and refresh, missing the
authorship/review story.

## 5. Recommended vocabulary

- **Primary user-facing noun: "analysis."** The library is a library of analyses;
  the tab strip lists analyses; an agent authors an analysis. "Graph" remains the
  term for the editable structure itself (the canvas view of an analysis) and stays
  in all technical/API contexts. "Workflow" is retired from user-facing surfaces
  and survives only informally, as in "workflow brainstorm."
- **Make definition vs run explicit.** A *graph* (or analysis) is the versioned
  source definition — pure, model-relative, never containing results. A *run* is a
  frozen evaluation — graph hash + input hashes + outputs + timestamp — and is the
  only thing signed, archived, or submitted as evidence. The UI never needs to show
  "run" until an effectful sink or the compliance track is involved.
- **One file remains one graph.** The dual nature (source and live document) is a
  property of the *session*, not the file; nothing is embedded to serve the
  document reading. Pinning (V2) is the sole, explicit exception.

**Open questions.**

1. Does "analysis" survive contact with users whose graphs are dashboards or FM
   orientation documents rather than analyses in any strict sense — or do we accept
   the stretch the way "notebook" and "workbook" are stretched?
2. Where exactly does the project-vs-library distinction live — a flag in the file,
   the presence of a promoted model parameter, or just which folder it sits in?
3. What is a run, concretely — a sibling JSON file, a section appended to the
   report HTML, or a record in the host? And does replaying a run require pinning
   copies of external CSVs, or are content hashes plus the user's storage enough?
4. When the compliance track hands a graph to an official, is the deliverable the
   run plus the graph, or a third packaged form (graph + pinned inputs + outputs in
   one archive) that neither concept currently names?
5. If `session` state (display flag, camera) is part of how a graph works as a
   document in a meeting, should a *named presentation state* become a first-class
   layer — or is that V2's named views question in disguise?
