# Start here

One page, one command per service, for the first thing to run after cloning this
repository. It ends at a table graph in the browser, using only committed sample
data — no private model required.

## 1. Check prerequisites

```bash
node scripts/preflight.mjs
```

This names what is missing — Node version, .NET SDK, uninitialized submodules, the
private Snowdon model — before you run anything else. A missing submodule or SDK
fails the check; a missing private model does not, because the first demo below
does not need one.

## 2. One-time setup

```bash
git submodule update --init --recursive
npm ci --prefix bimopenflow/web
```

## 3. Start the tables demo

Two terminals, from the repository root.

Terminal A — the host, over the committed sample tables:

```bash
dotnet run --project src/flow/BimOpenFlow.Host -- --profile tables --models samples/tables --store artifacts/start-demo/store --cache artifacts/start-demo/cache
```

Terminal B — the editor:

```bash
npm run web --prefix bimopenflow/web
```

Open [http://127.0.0.1:5300/](http://127.0.0.1:5300/) and choose a seeded sample
analysis. You should see a graph on the left and its result table on the right.

The host's default port (5214) and the editor's default proxy target
(`bimopenflow/web/packages/app/vite.config.ts`, also 5214) are the same number, so
neither command above needs a `--port` flag or a `BOF_HOST` override. Pass `--port`
to the host and `BOF_HOST=http://127.0.0.1:<port>` to the editor together if you
need a different port — for example, to run a second host at the same time.

I ran the two commands above against a clean `artifacts/start-demo` store and saw
the editor load with the table pane populated from `samples/tables`.

## Supported demos beyond this page

These need the private Snowdon BOS model, which is not distributed with this
repository — see [data/README.md](../data/README.md) for how to obtain a copy of
your own building model in its place.

- **3D Snowdon demo** (colors, sections, explode a real building from an editable
  graph). Setup and troubleshooting: [../BIMOPENFLOW.md](../BIMOPENFLOW.md).
- **DuckDB workflow studio** (nine SQL-backed schedule/join/aggregation graphs over
  a typed Snowdon database). Setup: [bim-flow-duckdb.md](bim-flow-duckdb.md).
- **Ask box** (an agent builds a DuckDB graph from a plain-language request; needs
  an Anthropic or OpenAI key in addition to the Snowdon database). Setup:
  [bim-flow-mcp-demo.md](bim-flow-mcp-demo.md).
  - Optional: instead of a key, `npm install -g @anthropic-ai/claude-code`, then
    run `claude` once and `/login`. The Ask box finds the desktop app's bundled
    copy of `claude` automatically, but that copy is not signed in for
    command-line use until you log in this way.

`npm run demo` (from `viz/`) opens the older visualization alpha gallery, a
separate reference application predating this graph editor. It is not part of the
first run above; see [REPOSITORY-HANDOFF.md](REPOSITORY-HANDOFF.md) for what it
still demonstrates.

See [DEMOS.md](DEMOS.md) for every sample graph, its input format, and the test
that guards it.
