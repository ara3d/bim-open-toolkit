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

Open `http://127.0.0.1:5354/notebook.html`. `BOF_HOST` points the page at
another host; the request box needs the studio host, which serves `/api/ask`.
`NOTEBOOK_PORT` changes the page's port. Editor links use `VITE_BOF_EDITOR`
(default `http://127.0.0.1:5310/`, the tables profile).

BIM Open Toolkit serves its own notebook page and its NRC landing page from
its package `@bimopenflow/nrc-web`, on port 5350, through this package's
exports.

## Static site

```bash
npm run build:pages -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web -- --outDir <folder> --emptyOutDir
```

builds `notebook.html` with every sample notebook copied into `notebooks/`,
plus `notebooks/index.json` (the file names) and `notebooks/catalog.json` (title,
turn count, and first request of each, for a landing page). The base is
relative and no host stands behind it (`vite.pages.config.ts`, `src/page/site.ts`):
the page shows every answer as recorded, leaves out Re-evaluate, and says in
the request box that asking needs a host. Without `--outDir` it writes
`dist/pages`. The public copy is the `site/app` folder of
[ara3d/bim-open-notebook](https://github.com/ara3d/bim-open-notebook).

## Layout

| Folder | Holds |
|---|---|
| `src/document/` | The file format (`format.ts`), reading and writing it (`io.ts`), and pure edits with undo (`edits.ts`) |
| `src/embeds/` | The renderer contract (`contract.ts`), the shared selection (`selection.ts`), one renderer per embed kind, and the registry that maps kinds to renderers |
| `src/live/` | Comparing a snapshot with the host's current result |
| `src/ask/` | The `/api/ask` event stream, and turning a finished request into a reply with embeds |
| `src/page/` | The notebook page: one turn's view, the notebook view with toolbar and request box, the landing-page catalog (`catalog.ts`), and `startNotebookPage` (`entry.ts`), which `main.ts` calls |
| `vite/` | The Vite plugins that serve a folder of notebooks in dev (`sampleNotebooks`) and bundle it into the static site (`bundleSamples`); the caller names the folder and the notebooks that lead the catalog |
| `scripts/` | Tools that write sample notebooks from a running host, given `--placeholder NAME=path` for each `{NAME}` in an outline's graphs, and that sync embedded graph layouts, given `--samples` and `--analyses` folders |
| `test/` | Vitest tests, one file per module |

## Exports

| Specifier | What |
|---|---|
| `@bimopenflow/bim-open-notebook` | The format, edits, embed registry, live comparison, ask reply, catalog, `mountNotebook`, and the page helpers a caller's landing page needs (`listSamples`, `fetchSample`, `ensureNotebookStyles`, `editorUrl`, `viewer3dUrl`) |
| `@bimopenflow/bim-open-notebook/page` | `startNotebookPage({ renderers?, root? })`, the whole page for a caller's `notebook.html` |
| `@bimopenflow/bim-open-notebook/vite` | `sampleNotebooks(dir)` and `bundleSamples(dir, lead)` for a caller's Vite config |
| `@bimopenflow/bim-open-notebook/layouts` | `sampleGraphFiles`, `staleLayouts`, and `syncLayouts` (`scripts/embedLayouts.ts`), for a caller that tests its own sample notebooks |

## Depends on

`@bimopenflow/graph` (the graph editor, mounted read-only in every graph embed),
`@bimopenflow/panes` (table, chart, verdict, and 3D panes), `@bimopenflow/api-client`
and `@bimopenflow/contracts` (the host API), and a few pure modules of
`@bimopenflow/app` imported by path (`src/paneContext`, `src/paneChoice`,
`src/hostStatus`, and the 3D feed helpers). Those imports are debt: the plan
says which modules should move to a library and why they have not yet.
