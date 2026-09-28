# @bimopenflow/bim-open-notebook

BIM Open Notebook: a document that records a session with the agent
(Claude through the Claude Code command line, behind the studio host's
`/api/ask`). Each turn is a request and a reply; a reply is text, the tool
calls the agent made, and embeds: a value, a table, a chart, the graph, a 3D
view, a picture, or a file. The file keeps a snapshot of every embed, so a
notebook opens with no host; an embed backed by a node can be re-evaluated
against the host and says whether its result changed.

Design and imagined sessions: [docs/proposals/notebook-sessions.md](../../../../docs/proposals/notebook-sessions.md).
Plan, chunks, and debt: [docs/plans/notebook.md](../../../../docs/plans/notebook.md).

It does not edit graphs (the editor does), run effects (a Run does), or keep
the agent's conversation (the host does, keyed by analysis id).

## Run it

```bash
node scripts/start-bim-flow.mjs --profile tables
```

```bash
npm run dev -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web
```

Open `http://127.0.0.1:5350/notebook.html`. `BOF_HOST` points the page at
another host; the request box needs the studio host, which serves `/api/ask`.
`NOTEBOOK_PORT` changes the page's port.

## Layout

| Folder | Holds |
|---|---|
| `src/document/` | The file format (`format.ts`), reading and writing it (`io.ts`), and pure edits with undo (`edits.ts`) |
| `src/embeds/` | The renderer contract (`contract.ts`), the shared selection (`selection.ts`), one renderer per embed kind, and the registry that maps kinds to renderers |
| `src/live/` | Comparing a snapshot with the host's current result |
| `src/ask/` | The `/api/ask` event stream, and turning a finished request into a reply with embeds |
| `src/page/` | The page: one turn's view, the notebook view with toolbar and request box, and the entry point |
| `scripts/` | Tools that write sample notebooks from a running host |
| `test/` | Vitest tests, one file per module |

## Depends on

`@bimopenflow/panes` (table, chart, verdict, and 3D panes), `@bimopenflow/api-client`
and `@bimopenflow/contracts` (the host API), and a few pure modules of
`@bimopenflow/app` imported by path (`src/paneContext`, `src/paneChoice`,
`src/hostStatus`, and the 3D feed helpers). Those imports are debt: the plan
says which modules should move to a library and why they have not yet.
