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
| Where the dependencies come from | `deps.json` lists them, pinned by commit; `node deps.mjs` fills the git-ignored `deps/`. The 3D viewer's code is in `deps/bim-open-viewer`, a separate repository (`ara3d/bim-open-viewer`), and Gratify is in `deps/gratify`: change them, and `deps/bim-open-flow`, `deps/bim-open-data`, `deps/bim-open-schema`, `deps/bim-open-plot` (the chart and figure layer, `ara3d/bim-open-plot`, brand and research only as of 2026-10-11), `deps/ara3d-sdk`, and `deps/ara3d-dataflow`, in their own repositories, then update the pin |
| Private data | The Snowdon model lives outside the repository (`BIMOPENFLOW.md` says where); `data/` is fetched by script and never committed |

## Working here

- Tickets use platonic-coder's `ticket.py`: `python ~/.claude/plugins/marketplaces/platonic/scripts/ticket.py --dir tickets <command>`.
- Tickets for every repository under `deps/` live here too, with the fence under `deps/<repo>/`, so ids never collide and cross-repository work has one list; a commit in that repository carries the same `Ticket: TKT-n` trailer. Each repository keeps its own `PROJECT.md`, a component brief whose workflows serve this one's (`deps/bim-open-plot/PROJECT.md` is the first).
- The three guide files under `.claude/skills/bim-flow/` are also the Ask box's system prompt, so an edit there changes both.
- Closing a ticket: tick each acceptance box that is met; `ticket.py close` refuses while one is unchecked unless `--waive` says why. It also runs the gates in `tickets/close-gates.toml` that the ticket's fence touches (sample graphs, the bim-open-flow pin) and quotes their output in the ticket; a failing gate means the work is not done.
- Sample graph positions come from the layout tool, never from a hand: after adding or changing a sample, run `npm run relayout-samples --prefix deps/bim-open-flow/bimopenflow/web/packages/graph -- --root <toolkit> --catalog docs/nodes.catalog.json --samples <folders>` (the folders are in `bimopenflow/web/packages/studio-web/test/sampleDirs.ts`). The sample layout tests fail on any position the tool would not give.
- A change to card sizes (bim-open-flow's graph package: `nodeSize.ts`, `nodeRender.ts`, `viewModel.ts`, the card text, or the catalog's ports and params) owns its follow-through in the same ticket: relay out the samples in both repositories, and move the bim-open-flow pin in `deps.json` to the pushed commit. Its fence names `samples/**`, `deps/bim-open-flow/samples/**`, and `deps.json`; the close gates check all three.
