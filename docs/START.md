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

One command, from the repository root:

```bash
node scripts/start-bim-flow.mjs --profile tables
```

It builds the host into `artifacts/bim-flow/host`, starts the host on port 5224
over the committed sample tables and the editor on port 5310, waits until both
answer, and prints the editor URL. Both run as detached processes, so they keep
running after the terminal or agent session that started them closes. Running
the command again reuses whatever is already listening.

Open [http://127.0.0.1:5310/](http://127.0.0.1:5310/) and choose a seeded sample
analysis. You should see a graph on the left and its result table on the right.

The same script serves the `bim` profile over `data/` (host 5214, editor 5300),
which is the default when `--profile` is omitted. `--status` reports what is
listening and where the logs are, `--stop` ends the profile's two processes, and
`--restart` stops, rebuilds, and starts. Logs, store, and cache live under
`artifacts/bim-flow/<profile>/`.

The host's default port (5214) and the editor's default proxy target
(`bimopenflow/web/packages/app/vite.config.ts`, also 5214) are the same number, so
the two can also be run by hand with no `--port` flag or `BOF_HOST` override; see
[DEMOS.md](DEMOS.md) for the commands.

## Supported demos beyond this page

These need the private Snowdon BOS model, which is not distributed with this
repository — see [data/README.md](../data/README.md) for how to obtain a copy of
your own building model in its place.

- **3D Snowdon demo** (colors, sections, explode a real building from an editable
  graph). Setup and troubleshooting: [../BIMOPENFLOW.md](../BIMOPENFLOW.md).
- **DuckDB workflow studio** (nine SQL-backed schedule/join/aggregation graphs over
  a typed Snowdon database). Setup: [bim-flow-duckdb.md](bim-flow-duckdb.md).
- **Ask box** (an agent builds a DuckDB graph from a plain-language request; needs
  the Claude Code command line, or an Anthropic or OpenAI key, in addition to the
  Snowdon database). Setup: [bim-flow-mcp-demo.md](bim-flow-mcp-demo.md).
  - The Claude Code command line needs no key. The Ask box
    finds it on `PATH` or in the Claude desktop app's own folders, newest
    version first, with no path to set. Run `node scripts/claude-login.mjs`
    once to find it and sign it in ([claude-cli-login.md](claude-cli-login.md));
    without the desktop app, `npm install -g @anthropic-ai/claude-code` first.

`npm run demo` (from `viz/`) opens the older visualization alpha gallery, a
separate reference application predating this graph editor. It is not part of the
first run above; see [REPOSITORY-HANDOFF.md](REPOSITORY-HANDOFF.md) for what it
still demonstrates.

See [DEMOS.md](DEMOS.md) for every sample graph, its input format, and the test
that guards it.
