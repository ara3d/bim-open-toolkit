# BIM Open Toolkit: agent orientation

@PROJECT.md

The brief above says what the project is for. A plan names the workflow it serves and takes its acceptance criteria from that workflow's Done line; a review checks the change against the same workflow. Lines in the brief that end with `(unconfirmed)` are drafts awaiting the owner; do not build on one without saying so.

## Where the state lives

| Question | Where |
|---|---|
| How to build, run, and demo | `README.md`, `docs/DEMOS.md`, and `.claude/launch.json` (the named dev servers) |
| How it is put together | `docs/ARCHITECTURE.md`; `docs/OVERVIEW.md` is the one-page version |
| Which repository holds what | `docs/plans/repository-split.md` (phases and build log). The generic graph system (node packs, host, flow MCP server, Ask loop, editor packages) is `deps/bim-open-flow`; BIM data code is `deps/bim-open-data`; this repository holds the BIM node packs, the studio host that composes the `bim` profile (`src/studio/BimOpenFlow.Studio`), the 3D pane, the notebook, the studio pages, the samples, and the gates |
| How it should look: mark, fonts, colours | `docs/BRANDING.md`; assets under `docs/brand/` |
| Which nodes exist | `docs/nodes.md` and `docs/nodes.catalog.json` (both generated); the BIM packs under `src/flow/BimOpenFlow.Nodes.*`, the generic ones under `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.*` |
| Ideas gathered, ranked, and tied to workflows | `docs/CANDIDATE-WORK.md` |
| Open decisions and work items | `tickets/`; `kind: question` marks a decision to make |
| Earlier proposals and their status | `docs/proposals/` and `docs/plans/`; `docs/platoflow/` is the pre-rewrite design from 2026-08-30, history unless a newer document repeats it |
| What agents already know | `.claude/skills/bim-flow/`, `.claude/skills/ifc-ask/`; `.mcp.json` names the two MCP servers |
| Runnable proof | `samples/*/` (each README lists its graphs and numbers), `gates/` (host and web smokes), `tests/` |
| Where the dependencies come from | `deps.json` lists them, pinned by commit; `node deps.mjs` fills the git-ignored `deps/`. The 3D viewer's code is in `deps/bim-open-viewer`, a separate repository (`ara3d/bim-open-viewer`), and Gratify is in `deps/gratify`: change them, and `deps/bim-open-flow`, `deps/bim-open-data`, `deps/bim-open-schema`, `deps/ara3d-sdk`, and `deps/ara3d-dataflow`, in their own repositories, then update the pin |
| Private data | The Snowdon model lives outside the repository (`BIMOPENFLOW.md` says where); `data/` is fetched by script and never committed |

## Working here

- Tickets use platonic-coder's `ticket.py`: `python ~/.claude/plugins/marketplaces/platonic/scripts/ticket.py --dir tickets <command>`.
- The three guide files under `.claude/skills/bim-flow/` are also the Ask box's system prompt, so an edit there changes both.
