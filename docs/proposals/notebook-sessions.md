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

A notebook is one continuous document that grows like a chat. The user writes
a request; the response below it is a live component: a table, a chart, a 3D
view, a small graph, a file card, or a verdict list. Then the next request.
Every response is backed by nodes in one analysis graph, added through the
same edit path as the canvas (`addNode`, `connect`, `setParam`), so the
notebook is a reading order over a graph plus the conversation that built it.
Editing an earlier cell re-evaluates everything below it that depends on it,
as in Observable or marimo, and never replays the conversation.

## Cell vocabulary

Every session below is written in these cells. "Backed by" says what makes
the cell live; a cell with no graph behind it is prose.

| Cell | Shows | Interaction | Backed by |
|---|---|---|---|
| **Ask** | the user's request, as typed | edit and resubmit; the answer below is replaced, cells that depend on it re-evaluate | the transcript only |
| **Note** | the agent's short explanation: what it did, which nodes it added, any doubt | none | the transcript only |
| **Value** | one number with unit and source, such as `37,196.2 kgCO2e/yr` | hover shows the node and row it came from | a node's scalar output |
| **Table** | rows with a count, paged | sort, filter, select rows (selection is shared with 3D and charts) | a table node |
| **Chart** | bar, line, or scatter | hover for values, click a bar to select its rows | `chart.*` node |
| **3D** | the model, coloured, with a legend | orbit, pick an element for its property sets, section, isolate the selection | `view3d.*` nodes |
| **Params** | named inputs as widgets: a slider, a dropdown, a file picker | change a value and every dependent cell updates | graph parameters |
| **Graph** | the nodes behind one answer, as a small read-only canvas | "open in editor" | the graph itself |
| **File** | a file the notebook read or wrote: name, type, size, SHA-256, preview | open, download, show diff against another file | a source node, or a sink after Run |
| **Editor** | the text of a small file the user is creating: CSV, JSON, IDS XML, SQL | edit in place; saving updates the source node that reads it | a file in the notebook's folder |
| **Run** | an effect waiting for approval, then its record | a Run button; afterwards the graph hash, input hashes, and outputs | the engine's Run |
| **Verdicts** | pass, fail, not applicable, inconclusive per element and rule, with citation | filter by verdict, select the failures | `check.*` nodes |
| **Diff** | what changed between two files or two runs | expand a changed entity | a diff node |

Outputs are never saved into the notebook file. A reopened notebook
re-evaluates; a Run is the only place outputs are kept, on purpose.

## The sessions

Twelve sessions follow. Each is a numbered list of turns: **U** is the user,
**A** is the response, with its cells in brackets. Numbers are the real ones
from `samples/nrc` and the paper's expected answers where they exist; "(from
the graph)" marks a value the prototype would compute and this document does
not know. The first six follow the NRC statement of work and test kit; the
last six exercise editing, files, and handover.

### S1. First look at an unfamiliar model

The analyst has `duplex.ifc` and no idea what is in it.

1. **U:** Open `samples/nrc/duplex-base.ifc`.
   **A:** [File: 38,898 STEP entities, IFC4, SHA-256 `b347a2c8…06ed`] [3D: the whole model, grey] [Note: converted to BOS tables in memory; nothing written.]
2. **U:** What's in it?
   **A:** [Table: entity count per IFC class, largest first] [Chart: the same as bars, top 15]
3. **U:** Colour it by class.
   **A:** The 3D cell from turn 1 recolours in place and gains a legend. [Note: added `view3d.color` fed by the class column; the chart and the legend share one colour domain.]
4. **U:** Just the doors.
   **A:** [Table: 14 `IfcDoor` rows with name, storey, `OverallWidth`] and the 3D cell isolates the 14 doors.
5. **U:** *(clicks a door in 3D)*
   **A:** The table row highlights; a property panel under the 3D cell lists the door's property sets.

Ends with: a four-node graph and a notebook a newcomer can reread. Shows that a
turn may change an earlier cell (turn 3) instead of adding one.

### S2. The NRC test kit, steps 1 to 5

Follows `IFC-Test-Kit/README.md` in order, as a reviewer at NRC would.

1. **U:** Load `duplex.ifc`. *(step 1)*
   **A:** [File] [3D]
2. **U:** Connect `analytics_dataset_with_levels.csv` using GlobalId. *(step 2)*
   **A:** [File: the CSV, 268 rows, columns `GlobalId, Name, Level, operational_carbon, energy_intensity, category`] [Table: match report: rows matched to an entity, rows unmatched, matched entities with a mesh (from the graph)] [Note: any unmatched row is listed, not dropped silently.]
3. **U:** Colour by operational carbon. *(step 3, numeric)*
   **A:** [3D: viridis gradient, unmatched elements grey, legend in kgCO2e/yr]
4. **U:** Now by category instead. *(step 3, categorical)*
   **A:** [Params: a "colour by" dropdown with `operational_carbon`, `energy_intensity`, `category`] The 3D cell now reads the dropdown; the user flips between the three without asking again.
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
   **A:** [Table: Level 2 40.56, Level 1 40.5 kWh/m²/yr] [Note: Level 2, by 0.06; the storeys differ by less than the rounding of the source data.]
3. **U:** Which five elements have the highest operational carbon?
   **A:** [Table: five rows, top is `Basic Wall:Interior - Partition (92mm Stud):190140` at 412.0] and the five are selected, so the S1-style 3D cell, if present, highlights them.
4. **U:** Show me them in the building.
   **A:** [3D: the five highlighted, the rest ghosted]
5. **U:** What is the operational carbon of the door named M_Single-Flush:0762 x 2032mm?
   **A:** [Table: four doors share that type name] [Note: this is a type name, not an instance name; which one do you mean? The paper used the first by STEP id, 54.0.] The agent asks instead of guessing.
6. **U:** Sum them.
   **A:** [Value: the four-door total (from the graph)] added below the table from turn 5.
7. **U:** How much operational carbon is in each category?
   **A:** [Chart: Wall 22,854.1 down to Railing 164.8, nine bars] [Table]
8. **U:** Which analysis run produced these values, and when?
   **A:** [Value: `run-2026-09-17-01`, computed 2026-09-17, by `generate_synthetic_analytics.py`]
9. **U:** What is the embodied carbon of the roof?
   **A:** [Value: not available] [Note: the roof `0jf0rYHfX3RAB3bSIRjmxl` has no `Pset_NRCEmbodiedCarbon`; no value is inferred.] Honest absence, principle 3.
10. **U:** Total embodied carbon A1-A3 per storey.
    **A:** [Chart + Table: Level 1 49,451.2, Level 2 48,696.8, T/FDN 11,761.3, Roof 5,821.0 kgCO2e] (paper Figure 2 adds operational carbon beside it)

Ends with: the paper's section 6.2 as a document whose every number links to
a node. Turns 4 and 6 are follow-ups that only work because the agent knows
what the previous cell selected (principle 7).

### S4. Door compliance, from rule to evidence

A compliance checker applies DC-W1 (door leaf width at least 850 mm).

1. **U:** Check every door against a minimum clear width of 850 mm.
   **A:** [Params: threshold 850 mm, property `OverallWidth`] [Verdicts: 14 doors, 8 pass, 6 fail] [3D: doors green and red]
2. **U:** Why does the first failing door fail?
   **A:** [Table: its evidence row: `OverallWidth` 762 mm, rule, citation text]
3. **U:** Use `Pset_DoorCommon.ClearWidth` instead.
   **A:** [Verdicts: 14 inconclusive] [Note: no door carries `ClearWidth`; inconclusive, not fail.] This is rule DC-W2 from the door-clearance demo.
4. **U:** Go back to OverallWidth. What if the threshold were 800?
   **A:** The user drags the Params slider from turn 1 to 800 mm; the verdicts, 3D, and every cell below update. (With 762 mm doors failing and 813 mm doors passing, 10 pass and 4 fail.)
5. **U:** Put it back to 850 and make the report.
   **A:** [Run: pending; will write `report.html` and `dc-w1-evidence.zip`; Run button]
6. **U:** *(clicks Run)*
   **A:** [Run record: graph hash, IFC hash, parameter values] [File: `report.html`, opens in a pane] [File: the zip, with `manifest.json` listing a SHA-256 per member]

Ends with: workflow 5's Done line reached from a conversation. Turn 4 shows why
parameters must be cells, not re-asked questions.

### S5. Writing the analytics back into the IFC

Workflow 6's write-back, seen from the analyst's side.

1. **U:** Put the analytics values into a copy of `duplex-base.ifc` as property sets.
   **A:** [Table: rows to write, 2,441 values on 224 entities, grouped by property set] [Run: pending; target `duplex-enriched.ifc`]
2. **U:** Which sets go on the storeys?
   **A:** [Table: `Pset_NRCStoreySummary` rows only] [Note: computed by `nrc-rollup` from the element rows; nothing in the source CSV is a total.]
3. **U:** *(clicks Run)*
   **A:** [Run record] [File: `duplex-enriched.ifc`, new hash]
4. **U:** Prove nothing else changed.
   **A:** [Diff: base against enriched: every original line byte-identical; only appended entities; 659 new property sets]
5. **U:** Read the values back from the new file.
   **A:** [Table: 2,441 property values read from the enriched IFC, each matched to the row that wrote it] (paper Figure 4)

Ends with: the byte-exact claim demonstrated by a cell, not asserted in prose.

### S6. Paper figures on request

The owner is preparing the paper and wants figures, not analyses.

1. **U:** Make Figure 5: the Duplex coloured by operational carbon.
   **A:** [3D: viridis, legend] [Note: camera from the saved view "paper-iso".]
2. **U:** Save that view as a PNG at 1600 × 1000 for the paper.
   **A:** [File: `fig05-operational-carbon.png`, preview]
3. **U:** Same for embodied carbon, and point out the grey roof.
   **A:** [3D + File: `fig06-embodied-carbon.png`] [Note: the roof has no embodied value and stays grey by design.]
4. **U:** Make the storey chart larger text and export it as SVG.
   **A:** [Chart, restyled] [File: `fig02-storey-carbon.svg`]
5. **U:** Regenerate every figure.
   **A:** [Table: each figure, its source cell, its file, and whether its hash changed since the last run]

Ends with: `scripts/nrc-walkthrough.mjs` as a notebook, where each figure can
be tuned by a person before export.

### S7. Bringing your own data

A second consultant has results from another tool, keyed differently.

1. **U:** *(drops `energy-results.xlsx` on the notebook)*
   **A:** [File: 3 sheets] [Table: first 20 rows of each sheet] [Note: sheet "Elements" has a column `IFC GUID` that looks like GlobalIds.]
2. **U:** Join sheet Elements to the model on IFC GUID.
   **A:** [Table: match report: matched, unmatched in file, unmatched in model] [Note: 12 rows do not match; their GUIDs have 21 characters, not 22.] Warn, never block.
3. **U:** Show me the unmatched ones.
   **A:** [Table: 12 rows]
4. **U:** Drop them and colour by `Annual kWh`.
   **A:** [3D: coloured, legend] [Params: a "drop unmatched" toggle, on]
5. **U:** Save this as a template that asks for the model and the spreadsheet.
   **A:** [File: `join-and-colour.analysis.json`] [Params: the two inputs, now named graph parameters] [Note: this is now a library analysis; any model and spreadsheet can be supplied.]

Ends with: test kit step 2 for an arbitrary file, and a reusable template
(principle 9: start from data).

### S8. Thermal zones (proposal P2, not built)

Operational energy is computed per zone; the Duplex has 21 spaces and no zones.

1. **U:** List the spaces with their storey.
   **A:** [Table: 21 `IfcSpace` rows]
2. **U:** Create a file that groups them into one zone per unit and storey.
   **A:** [Editor: `nrc-zones.csv`, `ZoneName,SpaceGlobalId`, filled with a first guess of four zones] [Note: edit before use; this is a proposal, not a fact.]
3. **U:** *(edits two rows in the Editor cell, saves)*
   **A:** The table below it updates: [Table: spaces per zone]
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
   **A:** The Editor cell gains a second specification; the verdicts re-evaluate. [Verdicts: the roof fails the embodied requirement]
4. **U:** Is failing the roof right?
   **A:** [Note: yes by the specification as written; the roof has no embodied value. If the roof should be exempt, the applicability needs an exclusion.] [Params: a proposed exclusion, off]
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

### S11. Editing history, saving, and loading

Exercises the notebook as a document rather than a chat.

1. **U:** *(opens the notebook saved from S3)*
   **A:** Every cell re-evaluates from the current files. [Note: model hash unchanged since save; nothing stale.]
2. **U:** *(edits the Ask in turn 3: "top five" becomes "top ten")*
   **A:** That table becomes ten rows; the 3D cell below it, which reads the selection, highlights ten.
3. **U:** Delete the cell about the door type name.
   **A:** The cell and its nodes go; cells that depended on them turn grey with "input removed", not red. [Note: the sum in turn 6 depended on it.]
4. **U:** Undo.
   **A:** Both come back.
5. **U:** Move the category chart to the top.
   **A:** The document order changes; the graph does not.
6. **U:** Save as `nrc-questions.notebook.json` and export a static copy.
   **A:** [File: the notebook: cells, transcript, graph, no outputs] [File: `nrc-questions.html`, outputs frozen, with a Run record at the top]
7. **U:** *(replaces `duplex-enriched.ifc` with a regenerated file and reopens)*
   **A:** [Note: model hash changed since save; 2 cells changed value] and the two cells carry a "changed" badge showing the old and new value.

Ends with: the document operations a notebook needs, and the staleness
behaviour a Run-pinned document needs.

### S12. Handover to an NRC reviewer

1. **U:** Show me how the total operational carbon was computed.
   **A:** [Graph: the nodes behind S3's first answer] [Note: source `nrc`, filter, sum; open in editor.]
2. **U:** Package everything in this notebook for someone without the toolkit.
   **A:** [Run: pending; will write the static HTML, every exported file, the IFC files, and a manifest]
3. **U:** *(Run)*
   **A:** [File: `nrc-handover.zip`] [Table: its members with SHA-256 each] [Note: the reviewer opens `index.html`; no install.]
4. **U:** What would they need to rerun it?
   **A:** [Note: the toolkit at commit (from git), the notebook file, and the two IFC files; the manifest names each by hash.]

Ends with: deliverable D2 (proof-of-concept package) produced from the
document that did the work.

## What the sessions require

Read across the sessions, the prototype needs:

- **Cells bound to nodes.** Every response cell names the node it renders;
  changing an earlier cell re-evaluates, never replays the chat (S3 turn 4,
  S4 turn 4, S11 turn 2).
- **Shared selection.** A table row, a bar, and a 3D pick select the same
  elements, and the agent can read the selection (S1 turn 5, S3 turn 4,
  S10 turn 4).
- **Params as cells.** A threshold or a "colour by" choice is a widget the
  user moves, not a question asked again (S2 turn 4, S4 turn 4).
- **Files in and out.** Open IFC, CSV, XLSX; create CSV, IDS, JSON in an
  Editor cell; write PNG, SVG, XLSX, HTML, ZIP, and IFC only through Run
  (S5, S6, S8, S9, S12).
- **A notebook file.** Cells in order, the transcript, and the graph; no
  outputs; a hash per input so a reopen can say what went stale (S11).
- **An agent that asks.** Ambiguity (S3 turn 5), absence (S3 turn 9), and
  doubt (S8 turn 2, S9 turn 4) are answers, not failures.

## Proposed order for a prototype

1. A static notebook page that renders S3 from a hand-written notebook file
   over the existing `nrc-q*` graphs: Ask, Note, Value, Table, Chart, Graph
   cells, no agent. Proves the file format and the cell-to-node binding.
2. Add 3D and shared selection; render S1 and S2.
3. Add Params cells and re-evaluation; render S4 up to the Run.
4. Connect the Ask box so new turns append cells live.
5. Add Run, File, Editor, and Diff cells; S5, S8, S9.
6. Save, load, reorder, delete, staleness: S11.

## Open questions

- Is a notebook one graph, or one graph per cell group? One graph keeps
  "follow-ups see earlier results" simple; several keep templates small.
- Does the user-facing noun stay "analysis" (TKT-4), with the notebook as its
  reading view, or is "notebook" the noun?
- Is the transcript part of the saved file, or only the cells it produced?
  Keeping it makes the document a record of how it was built; dropping it
  makes edited notebooks cleaner.
- Where does a notebook live: the host's analysis store, or a file beside the
  model?
