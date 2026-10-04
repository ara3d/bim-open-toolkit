# @bimopenflow/nrc-web

The toolkit's notebook pages, over the notebook package
(`@bimopenflow/bim-open-notebook`) and the toolkit's own samples:

- `notebook.html`: the notebook page (`startNotebookPage` from
  `@bimopenflow/bim-open-notebook/page`) over the sample notebooks in
  `samples/notebooks`.
- `nrc.html`: the landing page of the NRC work. Every sample notebook in
  `samples/notebooks` is a card that opens it in `notebook.html`, and every
  graph in `samples/nrc-analyses` (its row of that folder's README, served at
  `/__nrc/graphs.md`) is linked to the editor, and to the 3D page for the
  graphs that colour the model. A green dot marks a graph the connected host
  holds.

The pages live here, not in the notebook package, because they read
`samples/nrc-analyses`, `samples/nrc`, and the private Snowdon model, all of
which belong to this repository.

## Run it

```bash
node scripts/start-bim-flow.mjs --profile tables
npm run notebook --prefix bimopenflow/web
```

Open `http://127.0.0.1:5350/nrc.html` or `http://127.0.0.1:5350/notebook.html?notebook=nrc-eight-questions`.
`BOF_HOST` points the pages at another host (default `http://127.0.0.1:5224`,
the tables profile); the request box needs the studio host, which serves
`/api/ask`. `NOTEBOOK_PORT` changes the port. Editor links use
`VITE_BOF_EDITOR` (default `http://127.0.0.1:5310/`). The `notebook-web` entry
of `.claude/launch.json` starts the same server.

## Sample notebooks

`samples/notebooks/README.md` documents the outlines and gives the commands.
Two scripts here run the notebook package's scripts of the same name with the
toolkit's arguments:

| Script | Adds |
|---|---|
| `scripts/write-sample-notebooks.ts` | `--placeholder SNOWDON=<path>`, from `BIMOPENFLOW_SNOWDON` or the default Snowdon location (`scripts/snowdon.ts`), when a model is found and the command line gives none |
| `scripts/sync-embed-layouts.ts` | `--samples samples/notebooks --analyses samples/nrc-analyses` |

## Layout

| Path | Holds |
|---|---|
| `src/notebook.ts` | Entry point of `notebook.html` |
| `src/nrc.ts`, `src/nrcCatalog.ts`, `src/nrcView.ts` | The NRC landing page: fetching, the graph table and the notebooks that lead the page, and the DOM |
| `scripts/` | `snowdon.ts`, `notebookScript.ts` (finds and runs a notebook script under vite-node), and the two wrappers above |
| `test/` | The landing page's tests, `snowdon.test.ts`, and `samples.test.ts`: the answer tests of the sample notebooks (Q1 37,196.2 kgCO2e/yr; DC-W1 8 Pass, 6 Fail) |
| `vite.config.ts` | Serves `samples/notebooks` with the notebook's `sampleNotebooks` plugin, and the graph README; port 5350 |
