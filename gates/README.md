# Gates — headless integration smoke checks

Supervisor-run end-to-end checks that unit tests cannot cover: a real host
process, real HTTP, real npm builds. Run from the repo root with Node 18+.

| Script | What it proves |
|---|---|
| `node gates/host-smoke.mjs` | The host binary starts, serves the node catalog, accepts a graph PUT, evaluates it to Ok, pages results, records a run, and 404s unknown model bytes. |
| `node gates/web-smoke.mjs` | Every web/viewer package typechecks and passes tests, and the editor app builds a production bundle. |
| `node gates/all.mjs` | Solution build + all C# tests, then both gates above. The full pre-release gate. |

The host smoke uses temp dirs for models/cache/store and a random port, so it
never touches real data and can run alongside a dev host.

// TODO: add a publishing gate (dashboard + report + evidence package emitted
// from a recorded run file) once a CLI entry point for the publishing chain exists;
// today that path is covered only by the Dashboards/Reports/Evidence unit tests.
