# NRC walkthrough: analytics on IFC, from file to figure to question

This is the demonstration behind the NRC paper *Storing, Displaying, and Querying
Building Analytics on IFC Models*. It runs on two models in order: the public
buildingSMART Duplex apartment, enriched with synthetic analytics, and then the
private Snowdon Towers sample, which shows the same toolkit on a real building of
456,598 instances. One command produces every figure and transcript:

```bash
npm run nrc:walkthrough --prefix bimopenflow/web
```

It builds the host and both MCP servers into `artifacts/nrc-walkthrough/build`,
starts what each step needs on random ports, and writes
`artifacts/nrc-walkthrough/README.md` with a link and caption for every capture.
Nothing it starts is left running. `--no-build` reuses the last build,
`--skip-snowdon` stops after Duplex, `--skip-mcp` leaves out the two MCP replays.
The run takes about four minutes on a laptop; most of it is the Duplex IFC
conversion and meshing, which the host does once and caches.

## What the paper claims, and where each claim is shown

| Claim (paper section) | Shown by | Guarded by |
|---|---|---|
| Analytics are stored in IFC property sets and travel with the file (3) | `samples/nrc/duplex-enriched.ifc`: 664 sets, 2,438 typed values, written byte-exactly; Figure 4 lists the rows | `Ara3D.Ifc.Tests`, `NrcWorkflows.Tests` `nrc-enrich-run` |
| The external table is referenced from the project (3.4) | `IfcDocumentReferenceBuilder` writes `IfcDocumentInformation`, `IfcDocumentReference`, `IfcRelAssociatesDocument` | `Ara3D.Ifc.Tests/DocumentReferenceTests` |
| Values are displayed on geometry from the same tables (4) | Figures 5 to 8: three colourings and the DC-W1 verdicts on the Duplex model | `NrcWorkflows.Tests/FigureGraphTests` |
| Aggregates per storey and per category (4.1) | Figures 2, 3, and 10 | `FigureGraphTests`, `ModelGraphTests` |
| A small tool surface answers plain-language questions (5, 6.2) | The IFC MCP replay transcript; the unattended run with `bimopenmcp-ifc-ask` | `BimOpenMcp.Ifc.Tests`, `BimOpenMcp.Ifc.Ask.Tests` |
| The same applies to a large real model | The Snowdon captures and the dataflow MCP replay | `View3dWorkflows.Tests`, `TableWorkflows.Tests` |

## Part 1: Duplex

The bim-profile host starts over `samples/nrc`, seeds every graph in
`samples/nrc-analyses`, and prepares the Duplex DuckDB and BOS in the background.
The walkthrough waits until `nrc-dc-w1-verdicts` and `nrc-color-category` report
every node Ok, then captures, from the editor's `3d.html?analysis=<id>` page:

| Figure | Graph, node, pane | What it shows |
|---|---|---|
| 2 | `nrc-storey-carbon-chart`, answer, Chart | embodied and operational carbon per storey |
| 3 | same, Table | the same rows as a table |
| 4 | `nrc-property-values`, answer, Table | the 2,438 property writes |
| 5 | `nrc-color-operational-carbon`, answer, 3D | viridis gradient, unmatched grey |
| 6 | `nrc-color-embodied-carbon`, answer, 3D | the roof has no value and stays grey |
| 7 | `nrc-color-category`, answer, 3D | nine categories, one colour each |
| 8 | `nrc-dc-w1-verdicts`, coloured, 3D | door verdicts on the doors |
| 9 | same, answer, Verdicts | the verdict rows with evidence |
| 10 | `nrc-storey-of-element`, answer, Table | 103 elements on Level 1 |

Then the IFC MCP server runs over stdio and `scripts/demo-ifc-mcp.mjs` replays the
tool calls of the recorded session for questions Q1, Q5, Q7, and Q8, checking each
answer against `expected_answers.json`. The transcript records every call and
result. This proves the connection and the tool surface without a language model.

The language-model run is separate, because it costs money and needs a key:

```bash
npm run ifc:ask-build --prefix bimopenflow/web
```

```bash
set OPENAI_API_KEY_FILE=C:\path\to\key.txt && dotnet artifacts/bim-flow-ifc/ask/bimopenmcp-ifc-ask.dll --model samples/nrc/duplex-enriched.ifc --questions samples/nrc/questions.txt --out artifacts/nrc-walkthrough/duplex/transcript-unattended.md --results artifacts/nrc-walkthrough/duplex/results-unattended.json
```

`samples/nrc/questions.txt` holds the paper's eight questions verbatim. Each runs
in a fresh conversation against the in-process IFC MCP server; the transcript
records the model name, every tool call, the answer, turns, and tokens, and the
JSON carries the same for a results table.

## Part 2: Snowdon

The same host, with `BIMOPENFLOW_SNOWDON` pointing at the BOS file, seeds
`samples/snowdon-analyses/snowdon-toolkit.json` and captures four of its recipe
nodes: category colours, a horizontal section, an exploded view, and a plan
projection. No table joins are needed here; the recipes describe the presentation
and the browser applies them to the 456,598 instances.

A tables-profile host then serves the Snowdon typed DuckDB export
(`artifacts/building-model-workflows/snowdon-cli.duckdb`) with the nine workflows
from `samples/duckdb-analyses` prepared into a temporary store, and the walkthrough
captures the door schedule and the rooms-per-storey table from `duckdb.html`.
Finally `scripts/demo-bim-flow-mcp.mjs` drives the dataflow MCP server over stdio
to build, evaluate, and read the door schedule (142 doors) from tool calls alone.

## Connecting an MCP client yourself

`.mcp.json` registers both servers for Claude Code in this repository:
`bimopen-ifc` (the IFC server, after `npm run ifc:mcp-build --prefix bimopenflow/web`)
and `bimopenflow-duckdb` (the dataflow server over the Snowdon export). Any other
MCP client uses the same commands; the IFC server also listens on HTTP with
`--http 8766` for manual `tools/call` posts, which is how the paper's recorded
session was driven.

## Capturing something else

`scripts/capture-bim-flow.mjs` takes a JSON list of captures (page, analysis, node,
pane, file, caption) against any running host and editor, and
`scripts/bim-flow-processes.mjs` holds the build, start, wait, and stop helpers the
walkthrough uses, so a new demonstration is a new list, not a new script.
