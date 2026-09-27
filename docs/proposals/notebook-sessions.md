# Analysis notebook: imagined sessions

> Proposal, 2026-09-27. Designs the interactions for a notebook prototype
> before any code is written. Sources: `nrc-ifc-llm` (`statement-of-work.md`,
> `IFC-Test-Kit/README.md`, `door-clearance-summary.md`,
> `poc/results/expected_answers.json`, `poc/data/nrc_analytics_storeys.csv`),
> this repository's `samples/nrc`, `samples/nrc-analyses/README.md`, and
> [nrc-deliverables.md](nrc-deliverables.md). Serves workflow 2 (ask in plain
> language and get a graph you can inspect), with sessions that also reach
> workflows 3 to 6. Nothing here is built.

## The idea in one paragraph

A notebook is a new kind of document: the transcript of one session with the
agent (Claude through the Claude Code command line, as TKT-45 decided), with
the things the agent produced embedded where they appeared. The user writes a
request; the agent's reply is text plus zero or more embeds: a graph, a table,
a chart, a picture, a 3D view, a file. Then the next request. It works like a
Jupyter notebook in which each code cell is replaced by a request in plain
language and the kernel by the agent. As in Jupyter, the outputs are saved in
the file; unlike Jupyter, most embeds are still live when reopened, because an
embedded graph can be evaluated again.

## How it relates to Jupyter

| | Jupyter (`.ipynb`) | This notebook |
|---|---|---|
| Input cell | code | a request in plain language |
| What runs it | a kernel | the agent, with the two MCP servers as its tools |
| Output | MIME bundles: text, image, HTML, widget state | text plus embeds: graph, table, chart, image, 3D view, file |
| Saved in the file | inputs and outputs | the transcript and every embed, with a snapshot of its result |
| Reopening | shows saved outputs; nothing runs until asked | shows the snapshots; each graph embed can be re-evaluated, and says when its result differs from the snapshot |
| Editing an earlier cell | rerun it by hand; cells below go silently stale | resend the request; the agent answers again from that point, and later turns are marked stale, not rerun |
| Reproducibility | depends on execution order | the transcript is a record, not a program; the embedded graphs are the reproducible part |

Saving outputs is right here for a reason Jupyter does not have: the agent's
reply cannot be regenerated exactly, so the transcript is a record of what
happened, like a lab notebook. The graphs inside it stay the way they are
elsewhere in the toolkit: a graph document holds no results
([platoflow-graph-semantics.md](../platoflow/platoflow-graph-semantics.md)
section 3), and the notebook stores the snapshot beside the graph, not in it.

## The pieces of a notebook

A notebook is an ordered list of **turns**. A turn is a user request and the
agent's reply. A reply is text and a list of **embeds**. Every session below
is written in these.

| Piece | Shows | Interaction | Saved as |
|---|---|---|---|
| **Request** | the user's text, and any file they dropped | edit and resend: the agent answers again from here | text |
| **Reply text** | what the agent did and any doubt it has; the tool calls fold under it | expand the tool calls | text and the tool-call log |
| **Value** | one number with unit and source, such as `37,196.2 kgCO2e/yr` | hover for the node and row it came from | the graph that computed it, and the value |
| **Table** | rows with a count, paged | sort, filter, select rows | the graph, and the first rows with the count |
| **Chart** | bar, line, or scatter | hover for values; click a bar to select its rows | the graph, and the plotted data |
| **3D** | the model, coloured, with a legend | orbit, pick an element for its property sets, section, isolate | the view recipe (graph, camera, colouring), the model's hash, and a still image |
| **Graph** | the nodes behind an answer, as a small canvas | parameters editable on the nodes; "open in editor" | the graph document |
| **Picture** | a PNG or SVG the agent made, such as a figure for the paper | enlarge, save | the image |
| **File** | a file read or written: name, type, size, SHA-256, preview | open, download, diff against another file | a path and a hash, not the bytes |
| **Editor** | the text of a small file the user is creating: CSV, JSON, IDS XML, SQL | edit in place and save | the path; the file itself lives beside the notebook |
| **Run** | an effect waiting for approval, then its record | a Run button; afterwards the graph hash, input hashes, and outputs | the run record |
| **Verdicts** | pass, fail, not applicable, inconclusive per element and rule, with citation | filter by verdict, select the failures | the graph, and the verdict rows |
| **Diff** | what changed between two files or two runs | expand a changed entity | the two hashes and the summary |
| **Script** | a script the agent or the user wrote (SQL, Python, PowerShell, JavaScript), its output below it, and the files it read and wrote | edit, run again, "turn into a graph" | the script text, its language, its output, and the hashes of what it touched |

A script embed is what the agent already does in a Claude Code session when no
tool fits: it writes a script and runs it. The notebook keeps the script, its
output, and what it touched, so the step can be read and rerun. Two limits
keep it inside the project's principles. A script runs only after the user
approves it, like a Run, because it may write files (principle 2); a SQL
script over the read-only DuckDB copy is the one kind that runs without
asking. And a script is a first draft: when a step proves useful, "turn into
a graph" asks the agent for the same result as nodes, which can be inspected,
parameterised, and reused, and the two outputs are compared.

Three rules follow from the transcript being a record:

- **A turn never changes an earlier embed.** "Colour it by class" produces a
  new 3D embed below; the grey one above stays as it was shown. Several
  embeds may point at the same graph, each at its own version of it.
- **Interaction inside an embed stays inside it.** Moving a threshold on a
  graph embed re-evaluates that embed. The next request can read what the
  user changed, because the agent sees the notebook's current state.
- **Selection is shared.** A row picked in a table, a bar clicked in a chart,
  and an element picked in 3D select the same elements everywhere in the
  notebook, and the agent can read the selection.

## The sessions

Thirteen sessions follow. Each is a numbered list of turns: **U** is the user,
**A** is the reply, with its embeds in brackets. Numbers are the real ones
from `samples/nrc` and the paper's expected answers where they exist; "(from
the graph)" marks a value the prototype would compute and this document does
not know. The first six follow the NRC statement of work and test kit; the
last seven exercise editing, files, scripts, and handover.

### S1. First look at an unfamiliar model

The analyst has `duplex.ifc` and no idea what is in it.

1. **U:** Open `samples/nrc/duplex-base.ifc`.
   **A:** [File: 38,898 STEP entities, IFC4, SHA-256 `b347a2c8…06ed`] [3D: the whole model, grey] [Reply: converted to BOS tables in memory; nothing written.]
2. **U:** What's in it?
   **A:** [Table: entity count per IFC class, largest first] [Chart: the same as bars, top 15]
3. **U:** Colour it by class.
   **A:** [3D: a new view, coloured by class, with a legend] [Reply: added `view3d.color` fed by the class column; the legend and the chart above share one colour domain.] The grey view from turn 1 stays as it was.
4. **U:** Just the doors.
   **A:** [Table: 14 `IfcDoor` rows with name, storey, `OverallWidth`] [3D: the 14 doors isolated]
5. **U:** *(clicks a door in 3D; its row highlights in the table above)* What's on this one?
   **A:** [Table: the door's property sets] The agent read the selection; the user named nothing.

Ends with: a four-node graph and a notebook a newcomer can reread. Shows that a
turn adds a new view (turn 3) rather than repainting an old one.

### S2. The NRC test kit, steps 1 to 5

Follows `IFC-Test-Kit/README.md` in order, as a reviewer at NRC would.

1. **U:** Load `duplex.ifc`. *(step 1)*
   **A:** [File] [3D]
2. **U:** Connect `analytics_dataset_with_levels.csv` using GlobalId. *(step 2)*
   **A:** [File: the CSV, 268 rows, columns `GlobalId, Name, Level, operational_carbon, energy_intensity, category`] [Table: match report: rows matched to an entity, rows unmatched, matched entities with a mesh (from the graph)] [Reply: any unmatched row is listed, not dropped silently.]
3. **U:** Colour by operational carbon. *(step 3, numeric)*
   **A:** [3D: viridis gradient, unmatched elements grey, legend in kgCO2e/yr]
4. **U:** Now by category instead. *(step 3, categorical)*
   **A:** [3D: coloured by `category`, with a "colour by" parameter on its graph offering `operational_carbon`, `energy_intensity`, `category`] The user flips between the three inside this embed without asking again.
5. **U:** *(picks a wall)* *(step 4)*
   **A:** [Table: that element's analytics values beside its IFC property sets]
6. **U:** Totals by level. *(step 5)*
   **A:** [Table: per level: element count, total operational carbon, mean energy intensity (from the graph)] [Chart: operational carbon per level]
7. **U:** Record what preprocessing this needed. *(step 7)*
   **A:** [Note + File: `test-kit-record.md`, listing each conversion the notebook performed and its time]

Ends with: steps 1 to 5 and 7 of the test kit as one document an NRC reviewer
can scroll, with the dropdown from turn 4 as the one reusable control.

### S3. The paper's eight questions as a conversation

The eight questions from `samples/nrc/questions.txt`, asked in a row over the
enriched model. The point is the follow-ups, which a question list cannot show.

1. **U:** What is the total operational carbon for the building?
   **A:** [Value: 37,196.2 kgCO2e/yr, 218 elements] [Graph: three nodes, collapsed]
2. **U:** Which storey has the higher mean energy intensity, Level 1 or Level 2?
   **A:** [Table: Level 2 40.56, Level 1 40.5 kWh/m²/yr] [Reply: Level 2, by 0.06; the storeys differ by less than the rounding of the source data.]
3. **U:** Which five elements have the highest operational carbon?
   **A:** [Table: five rows, top is `Basic Wall:Interior - Partition (92mm Stud):190140` at 412.0] and the five are selected.
4. **U:** Show me them in the building.
   **A:** [3D: the five highlighted, the rest ghosted]
5. **U:** What is the operational carbon of the door named M_Single-Flush:0762 x 2032mm?
   **A:** [Table: four doors share that type name] [Reply: this is a type name, not an instance name; which one do you mean? The paper used the first by STEP id, 54.0.] The agent asks instead of guessing.
6. **U:** Sum them.
   **A:** [Value: the four-door total (from the graph)] added below the table from turn 5.
7. **U:** How much operational carbon is in each category?
   **A:** [Chart: Wall 22,854.1 down to Railing 164.8, nine bars] [Table]
8. **U:** Which analysis run produced these values, and when?
   **A:** [Value: `run-2026-09-17-01`, computed 2026-09-17, by `generate_synthetic_analytics.py`]
9. **U:** What is the embodied carbon of the roof?
   **A:** [Value: not available] [Reply: the roof `0jf0rYHfX3RAB3bSIRjmxl` has no `Pset_NRCEmbodiedCarbon`; no value is inferred.] Honest absence, principle 3.
10. **U:** Total embodied carbon A1-A3 per storey.
    **A:** [Chart + Table: Level 1 49,451.2, Level 2 48,696.8, T/FDN 11,761.3, Roof 5,821.0 kgCO2e] (paper Figure 2 adds operational carbon beside it)

Ends with: the paper's section 6.2 as a document whose every number links to
a node. Turns 4 and 6 are follow-ups that only work because the agent knows
what the previous turn selected (principle 7).

### S4. Door compliance, from rule to evidence

A compliance checker applies DC-W1 (door leaf width at least 850 mm).

1. **U:** Check every door against a minimum clear width of 850 mm.
   **A:** [Graph: `check.rule` with threshold 850 mm and property `OverallWidth` editable on the node] [Verdicts: 14 doors, 8 pass, 6 fail] [3D: doors green and red]
2. **U:** Why does the first failing door fail?
   **A:** [Table: its evidence row: `OverallWidth` 762 mm, rule, citation text]
3. **U:** Use `Pset_DoorCommon.ClearWidth` instead.
   **A:** [Verdicts: 14 inconclusive] [Reply: no door carries `ClearWidth`; inconclusive, not fail.] This is rule DC-W2 from the door-clearance demo.
4. **U:** Go back to OverallWidth. What if the threshold were 800?
   **A:** [Graph + Verdicts: the same rule at 800 mm: 10 pass, 4 fail] (the 762 mm doors fail, the 813 mm doors now pass) [Reply: the turn 1 embed still shows 850 mm.] Alternatively the user moves the threshold on the turn 1 embed itself, and only that embed changes.
5. **U:** Put it back to 850 and make the report.
   **A:** [Run: pending; will write `report.html` and `dc-w1-evidence.zip`; Run button]
6. **U:** *(clicks Run)*
   **A:** [Run record: graph hash, IFC hash, parameter values] [File: `report.html`, opens in a pane] [File: the zip, with `manifest.json` listing a SHA-256 per member]

Ends with: workflow 5's Done line reached from a conversation. Turn 4 shows
the two ways to try a value: ask, which adds a record, or edit an embed in
place, which does not.

### S5. Writing the analytics back into the IFC

Workflow 6's write-back, seen from the analyst's side.

1. **U:** Put the analytics values into a copy of `duplex-base.ifc` as property sets.
   **A:** [Table: rows to write, 2,441 values on 224 entities, grouped by property set] [Run: pending; target `duplex-enriched.ifc`]
2. **U:** Which sets go on the storeys?
   **A:** [Table: `Pset_NRCStoreySummary` rows only] [Reply: computed by `nrc-rollup` from the element rows; nothing in the source CSV is a total.]
3. **U:** *(clicks Run)*
   **A:** [Run record] [File: `duplex-enriched.ifc`, new hash]
4. **U:** Prove nothing else changed.
   **A:** [Diff: base against enriched: every original line byte-identical; only appended entities; 659 new property sets]
5. **U:** Read the values back from the new file.
   **A:** [Table: 2,441 property values read from the enriched IFC, each matched to the row that wrote it] (paper Figure 4)

Ends with: the byte-exact claim demonstrated by an embed, not asserted in prose.

### S6. Paper figures on request

The owner is preparing the paper and wants figures, not analyses.

1. **U:** Make Figure 5: the Duplex coloured by operational carbon.
   **A:** [3D: viridis, legend] [Reply: camera from the saved view "paper-iso".]
2. **U:** Save that view as a PNG at 1600 × 1000 for the paper.
   **A:** [File: `fig05-operational-carbon.png`, preview]
3. **U:** Same for embodied carbon, and point out the grey roof.
   **A:** [3D + File: `fig06-embodied-carbon.png`] [Reply: the roof has no embodied value and stays grey by design.]
4. **U:** Make the storey chart larger text and export it as SVG.
   **A:** [Chart, restyled] [File: `fig02-storey-carbon.svg`]
5. **U:** Regenerate every figure.
   **A:** [Table: each figure, the turn that made it, its file, and whether its hash changed since the last run]

Ends with: `scripts/nrc-walkthrough.mjs` as a notebook, where each figure can
be tuned by a person before export.

### S7. Bringing your own data

A second consultant has results from another tool, keyed differently.

1. **U:** *(drops `energy-results.xlsx` on the notebook)*
   **A:** [File: 3 sheets] [Table: first 20 rows of each sheet] [Reply: sheet "Elements" has a column `IFC GUID` that looks like GlobalIds.]
2. **U:** Join sheet Elements to the model on IFC GUID.
   **A:** [Table: match report: matched, unmatched in file, unmatched in model] [Reply: 12 rows do not match; their GUIDs have 21 characters, not 22.] Warn, never block.
3. **U:** Show me the unmatched ones.
   **A:** [Table: 12 rows]
4. **U:** Drop them and colour by `Annual kWh`.
   **A:** [3D: coloured, legend] [Reply: dropped with a `table.filter`; the toggle is on its node in the graph embed.]
5. **U:** Save this as a template that asks for the model and the spreadsheet.
   **A:** [File: `join-and-colour.analysis.json`] [Graph: the two inputs, now named graph parameters] [Reply: this is now a library analysis; any model and spreadsheet can be supplied.]

Ends with: test kit step 2 for an arbitrary file, and a reusable template
(principle 9: start from data).

### S8. Thermal zones (proposal P2, not built)

Operational energy is computed per zone; the Duplex has 21 spaces and no zones.

1. **U:** List the spaces with their storey.
   **A:** [Table: 21 `IfcSpace` rows]
2. **U:** Create a file that groups them into one zone per unit and storey.
   **A:** [Editor: `nrc-zones.csv`, `ZoneName,SpaceGlobalId`, filled with a first guess of four zones] [Reply: edit before use; this is a proposal, not a fact.]
3. **U:** *(edits two rows in the Editor embed, saves)*
   **U:** Show spaces per zone.
   **A:** [Table: spaces per zone, read from the saved file]
4. **U:** Which zone has the highest energy use intensity?
   **A:** [Chart: mean EUI per zone] [3D: spaces coloured by zone value]
5. **U:** Write the zones into the enriched IFC too.
   **A:** [Run: pending; adds `IfcZone` and `IfcRelAssignsToGroup`] then, after Run, [Diff: the new entities only]

Ends with: a user creating an input file inside the notebook, and the
statement of work's zone level filled in.

### S9. IDS: say what the file must contain, then check it

1. **U:** Write an IDS that requires every analysed element to have `Pset_NRCOperationalCarbon.OperationalCarbon_kgCO2e_per_year` as a number.
   **A:** [Editor: `nrc-analytics.ids`, IDS 1.0 XML generated from `nrc-metrics.csv`] [File: audit result: valid against the IDS 1.0 schema]
2. **U:** Check the enriched model against it.
   **A:** [Verdicts: per specification and element] [Chart: pass and fail per specification]
3. **U:** Add a requirement for embodied carbon too.
   **A:** [Editor: the same file with a second specification] [Verdicts: the roof fails the embodied requirement]
4. **U:** Is failing the roof right?
   **A:** [Reply: yes by the specification as written; the roof has no embodied value. If the roof should be exempt, the applicability needs an exclusion.] [Editor: the file with a proposed exclusion, not yet saved]
5. **U:** Check the base model too.
   **A:** [Table: base against enriched verdict counts, side by side]

Ends with: an IDS file created, validated, and applied without leaving the
document; the AI drafts the file and the checker decides (principle 8).

### S10. Snowdon at scale (test kit step 6)

1. **U:** Open the Snowdon model.
   **A:** [File: the federated store, seven discipline files] [3D: coarse first frame, then 456,598 instances] [Value: time to first frame (from the startup log)]
2. **U:** How many doors and spaces?
   **A:** [Value: 142 doors] [Value: 290 spaces]
3. **U:** Rooms per storey as a chart.
   **A:** [Chart: 33 storeys with rooms] [Table]
4. **U:** Doors narrower than 850 mm, on the chart's tallest storey.
   **A:** Clicking the tallest bar selects its storey; [Verdicts: that storey's doors] [3D: isolated]
5. **U:** Record load time and memory for the test kit.
   **A:** [Table: load, first frame, full frame, memory] [File: `performance.csv`]

Ends with: the same conversation shape as S2 over a model 100 times larger,
and the performance numbers step 6 asks for.

### S11. Editing, saving, and loading the notebook

Exercises the notebook as a document rather than a chat.

1. **U:** *(opens `nrc-questions.notebook` saved from S3)*
   **A:** Every embed shows its saved snapshot at once. [Banner: the model's hash matches the one recorded; "Re-evaluate all" is available.]
2. **U:** *(edits the request in S3's turn 3: "top five" becomes "top ten", and resends)*
   **A:** The agent answers again from that turn: [Table: ten rows]. Turns 4 to 10 get a "stale: an earlier turn changed" mark and keep their content. The old reply is kept as a folded earlier version, as a chat app keeps an edited branch.
3. **U:** *(clicks "continue from here" on the stale turn 4)*
   **A:** The agent resends turn 4's request with the new context: [3D: ten elements highlighted]. Turns 5 onward stay marked.
4. **U:** Delete the turn about the door type name.
   **A:** The turn and its embeds go. [Reply: turn 6 ("sum them") referred to it and is now marked.]
5. **U:** Undo.
   **A:** The turn comes back.
6. **U:** Save, and export a copy I can email.
   **A:** [File: `nrc-questions.notebook`: transcript, embeds, snapshots, and the graphs] [File: `nrc-questions.html`, static, every snapshot as it was shown, no toolkit needed]
7. **U:** *(regenerates `duplex-enriched.ifc`, reopens, clicks "Re-evaluate all")*
   **A:** [Banner: the model's hash changed since save] Two embeds carry a "result changed" badge showing the saved and the new value; the transcript text is untouched.

Ends with: the document operations a notebook needs, and why a transcript
marks later turns stale instead of rewriting them.

### S12. A step no node covers yet

The large test model is IFC2X3 and the user wants a quick count of entities
by schema class before deciding whether to convert it.

1. **U:** How many entities of each class are in `large_test_model.ifc`? Don't convert it yet.
   **A:** [Reply: no node reads an IFC without converting it; I wrote a script that scans the STEP lines.] [Script: Python, 20 lines, pending approval; reads `large_test_model.ifc` (49 MB), writes nothing]
2. **U:** *(approves)*
   **A:** [Script: the same, with its output: a count per class and the time taken] [Chart: top 20 classes]
3. **U:** Also count the property sets.
   **A:** [Script: a new version with one more pattern, pending approval] The first script stays as it was.
4. **U:** *(approves)* Now do the same thing with the toolkit.
   **A:** [Graph: `ifc.open` then a class count, over the converted model] [Diff: the script's counts against the graph's, class by class] [Reply: 3 classes differ; the script counted entities inside comments.]

Ends with: a script as a first draft and a graph as the answer that stays,
with the difference between them shown instead of hidden.

### S13. Handover to an NRC reviewer

1. **U:** Show me how the total operational carbon was computed.
   **A:** [Graph: the nodes behind S3's first answer] [Reply: source `nrc`, filter, sum; open in editor.]
2. **U:** Package everything in this notebook for someone without the toolkit.
   **A:** [Run: pending; will write the static HTML, every exported file, the IFC files, and a manifest]
3. **U:** *(Run)*
   **A:** [File: `nrc-handover.zip`] [Table: its members with SHA-256 each] [Reply: the reviewer opens `index.html`; no install.]
4. **U:** What would they need to rerun it?
   **A:** [Reply: the toolkit at commit (from git), the notebook file, and the two IFC files; the manifest names each by hash.]

Ends with: deliverable D2 (proof-of-concept package) produced from the
document that did the work.

## What the sessions require

Read across the sessions, the prototype needs:

- **A notebook file.** The turns in order; each reply's text, its tool-call
  log, and its embeds; each embed's graph or recipe and its snapshot; the
  hash of every input file (S11).
- **A turn loop over the Claude Code command line.** `BimOpenFlow.Ask`
  already reads `claude -p --output-format stream-json` into events
  (`src/studio/BimOpenFlow.Ask/ClaudeCli/`); a turn becomes an embed when a
  tool result carries a graph, a table, or a file.
- **The notebook as context.** The agent receives the earlier turns, the
  current selection, and any value the user changed inside an embed, so "show
  me them" and "sum them" work (S3 turns 4 and 6).
- **Embeds that re-evaluate.** A graph embed evaluates against the host and
  compares its result with the snapshot (S11 turn 7).
- **Files in and out.** Open IFC, CSV, XLSX; create CSV, IDS, JSON in an
  Editor embed; write PNG, SVG, XLSX, HTML, ZIP, and IFC only through a Run
  (S4, S5, S6, S8, S9, S13).
- **Scripts with approval.** A Script embed that waits for the user before it
  runs, records what it read and wrote, and can be turned into a graph (S12).
- **An agent that asks.** Ambiguity (S3 turn 5), absence (S3 turn 9), and
  doubt (S8 turn 2, S9 turn 4) are answers, not failures.

## Proposed order for a prototype

1. A page that renders a hand-written notebook file of S3: requests, reply
   text, and Value, Table, Chart, and Graph embeds from snapshots. No agent.
   Proves the file format.
2. Re-evaluate a graph embed against the running host and badge a difference.
3. 3D and Picture embeds, and shared selection: S1 and S2.
4. The turn loop: a request box that calls the Claude Code command line and
   appends a turn with its embeds.
5. Editor, File, Run, and Diff embeds: S4, S5, S8, S9.
6. Edit and resend, stale marks, delete, undo, save, and the static export:
   S11 and S13; Script embeds and S12.

## Open questions

- Is a notebook built from a Claude Code session's own log (the JSONL file
  the command line keeps), or does the notebook page own the loop and write
  its own file? The first lets a session in a terminal become a notebook; the
  second controls the format.
- How large may a snapshot be? A table snapshot of 456,598 rows is not a
  snapshot; the first rows and the count probably are.
- Is a notebook its own file beside the model (`*.notebook`), or an entry in
  the host's analysis store?
- `PROJECT.md` puts "a second scripting API or an agent-as-code surface" out
  of scope. Does a Script embed cross that line, or is it acceptable as a
  recorded first draft that the notebook pushes towards a graph?
- Which script languages: SQL and Python only, or whatever the agent reaches for?
- Does the user-facing noun "analysis" (TKT-4) now name the graph, with
  "notebook" naming this document?
