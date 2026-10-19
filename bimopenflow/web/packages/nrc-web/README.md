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

`npm run build:pages` makes the same two pages a static site, with no host: see
"Static site" below.

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

## Static site

```bash
npm run build:pages -w @bimopenflow/nrc-web --prefix bimopenflow/web
node gates/nrc-pages-smoke.mjs
```

`vite.pages.config.ts` writes `artifacts/nrc-site` (git-ignored), a folder that GitHub
Pages serves as plain files under any path (the base is relative). It is published at
https://ara3d.github.io/nrc-ifc-llm/ by the workflow in the `nrc-ifc-llm` repository. It
holds `index.html` (a redirect to `nrc.html`), `nrc.html`, `notebook.html`, `graphs.md`
(the graph list), `NOTICE.md` (the building licences), and `notebooks/`: every notebook
in `samples/notebooks` except `s10-snowdon` (its model is private, CC BY-NC-SA 3.0; the
landing page says so) and `s11-editing-history` (kept out by the owner's plan for the NRC notebooks), `index.json`, `catalog.json`, `node-catalog.json` (a copy of
`docs/nodes.catalog.json`, so graph cells draw their wires), and `models/` (the `.bos`
file each 3D view names, looked up in `samples/nrc`, then in
`deps/bim-open-data/samples/public`). The folder takes whatever notebooks are in
`samples/notebooks`; there is no fixed list. `nrc.html` orders them with `NRC_LEAD` in
`src/nrcCatalog.ts`, the rest by name.

The notebook package's `bundleSamples` does the bundling and its page code turns the host
features off in this mode (`src/page/site.ts`); `src/nrc.ts` does the same for the landing
page: no host banner, and each graph row links to the notebooks that show it instead of to
the editor and the 3D page, which need a host. The page says what is left out and gives the
commands for a local host.

A 3D view draws on the static site only when its notebook recorded the model file and the
rows (`model` and `snapshot` on the embed). The notebook package's
`write-sample-notebooks.ts` records them when a `.bos` sits beside the model's `.duckdb`.
`samples/nrc/duplex-enriched.bos` and `duplex-base.bos` are committed (`git add -f`, since `*.bos` is ignored) so a clean checkout, such as the Pages build, has the models; the host
rebuilds the enriched one from `duplex-enriched.ifc` (its stamp file is ignored), and
`duplex-base.bos` comes from `BuildingModel.Workflows.Cli convert-ifc`. The build stops with a
message when a notebook names a model file that is missing. `gates/nrc-pages-smoke.mjs` fails on a
view that does not draw. `NRC_PAGES_SAMPLES=<folder>` builds from another folder of
notebooks, to try one out.

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
| `vite.pages.config.ts` | The static site: `build:pages` (see above) |
| `vite.config.ts` | Serves `samples/notebooks` with the notebook's `sampleNotebooks` plugin, and the graph README; port 5350 |
