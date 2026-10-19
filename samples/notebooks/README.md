# Sample notebooks

Notebook files (`bimopen-notebook/0.1`, the format in
`deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/document/format.ts`) that realise
sessions from `docs/proposals/notebook-sessions.md` and the NRC walkthrough. The table lists the first ones;
`ls *.notebook.json` gives all fourteen, twelve of which the NRC site publishes (`s10-snowdon` and
`s11-editing-history` stay off it):

| Notebook | Session | Host profile | Turns |
|---|---|---|---|
| `nrc-eight-questions.notebook.json` | S3, the paper's eight questions | tables | the eight questions of `samples/nrc/questions.txt` in order, then a chart of carbon per storey |
| `nrc-test-kit.notebook.json` | S2, the NRC IFC test kit, steps 1 to 5 | bim | join the CSV, colour by operational carbon, colour by category, totals per level, the storey chart, the written values read back |
| `nrc-door-check.notebook.json` | S4, door compliance | bim | DC-W1 verdicts in a table and in 3D, then `samples/nrc/door_verdicts.csv` as a file |
| `s14-door-bcf.notebook.json` | BCF round trip on NRC's door-clearance example | bim | DC-W1 verdicts in 3D, the comparison with NRC's ground truth (14 of 14), the 6 failing doors as BCF topics, the BCF written by a Run, a reviewer's comment with a camera, the architect's reply read back and the flagged doors coloured. Graphs in `graphs/s14-door-bcf`, the three BCF files in `samples/nrc/bcf` |
| `s15-text-annotation.notebook.json` | Text annotation in the 3D view (statement of work 1(a) and 2.2) | bim | each storey's operational carbon total written over its slabs, each door's width and DC-W1 verdict over the door, the ten highest elements labelled with the rest ghosted and what `view3d.label`'s `limit` does. Graphs in `graphs/s15-text-annotation` |

These files are generated; do not edit them by hand. Each is written by
`bimopenflow/web/packages/nrc-web/scripts/write-sample-notebooks.ts` (which runs
the notebook package's script of that name and fills `{SNOWDON}` from
`BIMOPENFLOW_SNOWDON` or the default Snowdon location) from an outline in
`outlines/` and a running host, so every snapshot, embed, and tool call comes
from a graph in `samples/nrc-analyses` or the outline's own `graphs`. The reply
texts are the outline's, written after reading the snapshots.
`test/samples.test.ts` in `bimopenflow/web/packages/nrc-web` checks the expected answers.

## Regenerating

Start a host of the outline's profile with a fresh store, so the NRC graphs
are seeded (seeding happens only into an empty store); the hosts start from
the repository root, the script from `bimopenflow/web/packages/nrc-web`:

```
node scripts/start-bim-flow.mjs --profile tables     # host on 5224
node scripts/start-bim-flow.mjs                      # bim host on 5214

cd bimopenflow/web/packages/nrc-web

npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5224 --outline ../../../../samples/notebooks/outlines/nrc-eight-questions.outline.json
npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5214 --outline ../../../../samples/notebooks/outlines/nrc-test-kit.outline.json
npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5214 --outline ../../../../samples/notebooks/outlines/nrc-door-check.outline.json

# s14-door-bcf: its graphs carry {SAMPLES} and {ARTIFACTS}, so the placeholders are passed too
npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5214 --outline ../../../../samples/notebooks/outlines/s14-door-bcf.outline.json --placeholder SAMPLES=<checkout>/samples/nrc --placeholder ARTIFACTS=<checkout>/artifacts

npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5214 --outline ../../../../samples/notebooks/outlines/s15-text-annotation.outline.json
```

Every other outline is run the same way (`--host` the bim host, `5224` for `nrc-eight-questions`).

A 3D view records its model only when the script finds the `.bos` file beside the graph's model path, and
it looks for that path relative to the working directory. The graphs name their models from the repository
root (`samples/nrc/duplex-enriched.ifc`), so from `bimopenflow/web/packages/nrc-web` a notebook gets a 3D view
with no model unless `samples` there points at the repository's `samples` folder. Before a run, make it a
directory junction (`mklink /J samples ..\..\..\..\samples` in that folder; Linux: `ln -s ../../../../samples samples`), and
remove it with `rmdir samples` afterwards, not `rm -r`. A model named by a graph input (`$model`, as in
`nrc-join-analytics` and `nrc-color-operational-carbon`) is not resolved at all, so a notebook that shows
such a graph's 3D view uses a copy of the graph with the path written out (`nb-nrc-test-kit-colour`,
`nb-s06-paper-figures-operational-carbon`).

On a cold start the bim host builds the Duplex DuckDB and BOS files in the
background (about 30 s each); wait until `GET /api/analyses/nrc-dc-w1-verdicts/state`
shows every node `Ok`.

The BCF files of `s14-door-bcf` are not regenerated with the notebook: `bcf.write` is an effect, so each is the file a Run of its graph wrote (`POST /api/analyses/{id}/runs`, then a copy from `artifacts/checking` to `samples/nrc/bcf`). The notebook embeds the committed file's size and SHA-256. The three `bcf.write` nodes fix `created` and `guidSeed` and give no `modelDate`, so every Run writes the same bytes; if a Run's bytes differ from the committed file, a graph or the writer changed, so commit the new file and regenerate the notebook. Run the graphs, copy the files, then regenerate the notebook, because the notebook script reads the files as they are when it runs.

A graph change shows up as a diff in the regenerated
file; reread the snapshots and update the outline's reply texts to match.

A graph embed keeps its own copy of the graph, card positions included. After
the sample graphs are relaid out (`npm run relayout-samples` in
`bimopenflow/web/packages/graph`), run `npx vite-node scripts/sync-embed-layouts.ts`
from `bimopenflow/web/packages/nrc-web` to copy the new positions into the
notebooks; it runs the notebook package's script with
`--samples ../../../../samples/notebooks --analyses ../../../../samples/nrc-analyses`.
No host is needed, and `test/samples.test.ts` fails until the copies match.

## Outline format

`outlines/<name>.outline.json` gives `<name>.notebook.json` in this folder.

```json
{
  "title": "The NRC paper's eight questions",
  "createdUtc": "2026-09-27T00:00:00Z",
  "host": { "profile": "tables" },
  "turns": [
    {
      "request": "What is the total operational carbon for the building?",
      "reply": "37,196.2 kgCO2e/yr. ...",
      "analysisId": "nrc-q1-building-total",
      "embeds": [
        { "kind": "value", "node": "answer", "port": "relation", "column": "Total", "unit": "kgCO2e/yr" },
        { "kind": "auto" }
      ]
    }
  ]
}
```

- `title`, `createdUtc`, and `host` are copied to the notebook. `createdUtc`
  is fixed so that regenerating an unchanged sample gives the same bytes.
- Each turn's `request` and `reply` are the request text and the agent's
  reply text. `analysisId` names a seeded analysis in `samples/nrc-analyses`
  and becomes the reply's `analysisId`.
- `embeds` is optional. Without it the turn gets the automatic choice,
  `embedsForAnalysis` in `src/ask/reply.ts`: one embed per answer node (a
  node no edge reads from) and a graph embed. With it, the listed entries
  replace that choice, in order:

| `kind` | Fields | Gives |
|---|---|---|
| `auto` | `analysisId`? | the automatic embeds for that analysis |
| `graph` | `analysisId`?, `focus`? (node ids) | the graph embed alone, with the given focus |
| `value` | `node`, `port`, `column`?, `unit`?, `caption`?, `analysisId`? | one value from the first row of that output |
| `table` | `node`, `port`, `caption`?, `analysisId`? | that output's rows (a table with `checkId` and `verdict` columns shows as verdicts) |
| `view3d` | `node`, `port`, `caption`?, `analysisId`? | a 3D view of a `view3d.*` output |
| `file` | `path` (from the repository root), `mediaType`?, `caption`? | the file's size, SHA-256, and first six lines |

`analysisId` on an entry defaults to the turn's. Embeds are numbered `e1`,
`e2`, ... in the order they appear.

Tool calls are not written in the outline. The script records the calls an
agent would have made to reach the same embeds, with what the host returned:
`getAnalysis` and `evaluate` for each analysis the embeds read, `Read` for
each file, and `getResult` once for each node output with a snapshot. No
agent took part, so replies carry no `agent` information.

## Outline extensions for reconstructed sessions

Added for the second wave of samples (`docs/plans/notebook.md`, wave 2), in
which subagents play the agent for the sessions in
`docs/proposals/notebook-sessions.md`. The script supports these fields once
chunk W1 lands; until then outlines may use them but cannot be generated.

| Where | Field | Meaning |
|---|---|---|
| top level | `graphs` | Paths, relative to the outline, of graph documents in the same format as `samples/nrc-analyses/*.json`. Before any snapshot is taken, the script saves each one to the host under its file name without `.json` as the analysis id (`PUT /api/analyses/{id}`) and waits until its nodes are no longer evaluating. Ids start with `nb-<outline name>-` so outlines never collide. |
| top level | `host.note` | Shown to the reader. Every reconstructed sample says: "Reconstructed session: the replies were written by an agent playing this session; every embed was computed by the host from the graphs named." |
| turn | `analysisId` | Optional. A turn without one is text only (a clarifying question, an answer that needs no new result). |
| turn | `tools` | Optional list of `{ "name", "ok", "summary" }`, the tool calls the agent made (tool names of the `bimopenflow` MCP server: `describeDatabase`, `editGraph`, `evaluate`, `getResult`, ...). Replaces the generated list; each summary must be true of what the host returned. |
| turn | `stale` | Optional `true`: an earlier turn was edited after this one was made. |
| turn | `earlier` | Optional list of `{ "request", "reply" }`, oldest first: the versions this turn had before its request was edited and resent. Text only. |
| embed | `picture` | `path` (from the repository root, PNG or SVG, at most 400 KB), `alt`, `caption`?. Inlined as a `data:` URL, so the notebook stays one file. |
| embed | `chart` | `node`, `port`, `caption`?, `analysisId`?: that output as a chart, with the chart options `chartPaneOptions` gives for the node's kind and parameters. |

## Attribution

`s10-snowdon.notebook.json`, its outline, and its graphs hold counts and names computed from Autodesk's Snowdon Towers Sample Project (CC BY-NC-SA 3.0); see `samples/snowdon-analyses/NOTICE.md`. The NRC notebooks' Duplex data is buildingSMART's (CC BY 4.0, `samples/nrc/NOTICE.md`).
