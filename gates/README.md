# Gates — headless integration smoke checks

Supervisor-run end-to-end checks that unit tests cannot cover: a real host
process, real HTTP, real npm builds. Run from the repo root with Node 20.19 or 22.12 and later (the range scripts/preflight.mjs checks).

| Script | What it proves |
|---|---|
| `node gates/host-smoke.mjs` | The host binary starts, serves the node catalog, accepts a graph PUT, evaluates it to Ok, pages results, records a run, and 404s unknown model bytes. |
| `node gates/e2e-smoke.mjs` | One studio build in a temp folder (so a running dev studio cannot lock it), then a studio host, a studio MCP server (`mcp --http`), and a fake Anthropic Messages API, all on loopback ports over one temp store. Four steps, each asserted: (1) SQL: `table.inline` into `sql.query` with a `GROUP BY` returns columns `type,n,total`, two groups, and the right counts and sums; (2) write-back: `sink.writePsets` is `EffectPending` and the target IFC is absent before Run, and after `POST runs` the copy of `samples/nrc/duplex-base.ifc` holds the new property set, the source hash is unchanged, and the run record names the graph hash; (3) MCP intent: `initialize` and `tools/list` over JSON-RPC, then `addNode`, `setParam`, `evaluate`, `getResult`, and the host reads the same graph as Ok; (4) Ask: `POST /api/ask` streams events to `done` with `built` and `verified`, the fake model saw three well-formed requests (key, version header, cached system block, the MCP tools offered), its two tool calls succeeded, and the graph it built evaluates to one row. Not covered: a real model's answers, the OpenAI provider, and stdio MCP transport. Prints `E2E SMOKE: PASS` or the first failure. |
| `node gates/web-smoke.mjs` | Every web/viewer package typechecks and passes tests, and the editor app builds a production bundle. |
| `node gates/nrc-pages-smoke.mjs` | The static NRC walkthrough site (`npm run build:pages -w @bimopenflow/nrc-web --prefix bimopenflow/web` writes `artifacts/nrc-site`) works as plain files under a sub-path: `nrc.html` and every notebook open in a headless browser (Edge, or `NRC_PAGES_BROWSER_CHANNEL=chrome`), no failed request, every notebook draws all its turns, every 3D view draws its recorded model, no link needs a host, and the private Snowdon notebook is absent. Needs `playwright-core`. |
| `node gates/all.mjs` | Solution build + all C# tests, then both gates above. The full pre-release gate. |

The host smoke uses temp dirs for models/cache/store and a random port, so it
never touches real data and can run alongside a dev host.

// TODO: add a publishing gate (dashboard + report + evidence package emitted
// from a recorded run file) once a CLI entry point for the publishing chain exists;
// today that path is covered only by the Dashboards/Reports/Evidence unit tests.
