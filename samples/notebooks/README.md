# Sample notebooks

Notebook files (`bimopen-notebook/0.1`, the format in
`deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/document/format.ts`) that realise three
of the sessions in `docs/proposals/notebook-sessions.md`:

| Notebook | Session | Host profile | Turns |
|---|---|---|---|
| `nrc-eight-questions.notebook.json` | S3, the paper's eight questions | tables | the eight questions of `samples/nrc/questions.txt` in order, then a chart of carbon per storey |
| `nrc-test-kit.notebook.json` | S2, the NRC IFC test kit, steps 1 to 5 | bim | join the CSV, colour by operational carbon, colour by category, totals per level, the storey chart, the written values read back |
| `nrc-door-check.notebook.json` | S4, door compliance | bim | DC-W1 verdicts in a table and in 3D, then `samples/nrc/door_verdicts.csv` as a file |

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
```

On a cold start the bim host builds the Duplex DuckDB and BOS files in the
background (about 30 s each); wait until `GET /api/analyses/nrc-dc-w1-verdicts/state`
shows every node `Ok`. A graph change shows up as a diff in the regenerated
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
