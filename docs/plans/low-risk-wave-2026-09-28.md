# Low-risk wave, 2026-09-28

Five small, independent tickets from the open list, built at once by parallel-wave builders in the shared checkout. Chosen for low risk: each is a bug fix, a doc correction, or a regeneration with its own test, and no two share a file. TKT-114 (repair the studio browser check) waits for TKT-113 because the check drives the Preview node picker.

Contracts: none; the chunks share no code.
Baseline gates: not run as a whole; other sessions are writing to the checkout. Each builder runs its package's tests before and after.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| W1 | TKT-111: the notebook page lays out at the window's width with no sideways scroll | `bimopenflow/web/packages/bim-open-notebook/notebook.html`, `bimopenflow/web/packages/bim-open-notebook/src/page/**`, `bimopenflow/web/packages/bim-open-notebook/test/**` (new or page tests only) | - | `npm test` and `npx tsc --noEmit` in bim-open-notebook | notebook page on port 5470 |
| W2 | TKT-113: the Preview node picker shows the chosen node in the right panel | `bimopenflow/web/packages/app/src/app.ts`, `bimopenflow/web/packages/app/test/**` | - | `npm test` and `npx tsc --noEmit` in app | DuckDB host 5480, page 5481, scratch store |
| W3 | TKT-70: two documents match the code again | `docs/proposals/core-node-sets.md`, `docs/CANDIDATE-WORK.md` | - | read the cited code lines | none |
| W4 | TKT-92: ClaudeCliLocator finds the packaged Claude Code copy | `src/studio/BimOpenFlow.Ask/ClaudeCli/ClaudeCliLocator.cs`, `tests/studio/**`, `docs/bim-flow-mcp-demo.md`, `docs/START.md` | - | `dotnet test` on the Ask tests project | none |
| W5 | TKT-119: the sample notebooks embed the relaid-out graphs | `samples/notebooks/**` | - | `npm run test:layout` in packages/graph, notebook tests | host on 5490, scratch store |
| W6 | TKT-114: the studio browser check passes end to end | `scripts/check-bim-flow-duckdb.mjs` | W2 | the script itself | DuckDB host 5482, page 5483, scratch store |

## Build log

- W3 `8ba3fee`: fence only; both corrections verified against ColorNode.cs and group-object.ts. The colormap node is `view.colormap`; CANDIDATE-WORK line 121 marked Partial, not Done.
- W5 `49d5639`: fence only; no regeneration needed, since 6cd915b already synced embed positions and `samples.test.ts` guards them. Changed the s10-snowdon storey sentence in the outline and the notebook. Notebook tests 288 pass.
- W1 `3d7c912`, `883149a`: fence only. Cause: `.nb-column` (auto margins in a flex column) sized to its widest child, 949 px; `width: 100%` fixes it. The viewport meta already existed. Headless Chrome: scrollWidth 805 at 820, 375 at 375. Notebook tests 289 pass, typecheck clean.
- W4 `e76d02c`: fence only. Locator order: ASK_CLAUDE_CLI, first PATH hit that passes `--version`, newest `claude.exe` across the packaged and %APPDATA% roots. Studio tests 99 pass. Found `~/.local/bin/claude.cmd` on this machine. The supervisor updated `docs/claude-cli-login.md` and the START.md Ask line, which W4 reported as outside its fence. The `ASK_CLAUDE_CLI` line in `.claude/launch.json` (pointing at 2.1.281; 2.1.284 is installed) can go, but another session has uncommitted edits in that file.
- W2 `babe6c0`: fence only. A picker choice counts as a deliberate choice like a double-click; choosing the flow's answer follows it again. New `previewPicker.test.ts` (3 cases, jsdom over the real `createApp`); app tests 267 pass, typecheck clean. Headless Edge on 5480/5481 confirmed Rooms by storey switches between the table and the chart. The prebuilt studio host (Sep 26) lacks `PUT /api/session`, hence the 404 toast. W6 dispatched.

- W6 `5527e7c`: fence only. Two stale steps: tab selectors matched the sidebar's new Steps/Nodes tabs (TKT-116), and the startup-error check expected the page's error where the host status banner now answers a 5xx. The sort-dropdown failure did not reproduce, probably fixed by W2. Passed three runs in a row against a host built from source: 142 doors, 290 spaces, 33 storey bars summing to 286, 50 nodes green, database hash unchanged.
- Supervisor `a3b519e`: the final gate found `samples.test.ts` failing in bim-open-notebook, because 899cbe7 (TKT-125, another session) relaid out 28 sample graphs without syncing the notebooks. Ran `sync-embed-layouts.ts`: 43 cards in four notebooks.

## Wave record

Outcome: success; all six tickets closed (TKT-111, 113, 70, 92, 119, 114).
Gates: app 36 files, graph 39, panes 15, bim-open-notebook 20 (after the sync), all pass with tsc clean in each; BimOpenFlow.Studio.Tests 99 of 99; check-bim-flow-duckdb.mjs passes end to end. Not run: the full .NET solution and the other gates, since other sessions were writing to the checkout.
Commits: W1 3d7c912, 883149a; W2 babe6c0; W3 8ba3fee; W4 e76d02c plus supervisor docs 222b4e6; W5 49d5639; W6 5527e7c; supervisor sync a3b519e.
Findings: no fence requests. The commit guard flagged files in five of six chunks because sibling agents had touched nearby files; each builder confirmed its diff with git diff and claimed. W4 and W6 reported stale docs outside their fences (claude-cli-login.md and START.md fixed by the supervisor; bim-flow-duckdb.md's node count added to TKT-115). W6 noted a reconnect loop when only /api/analyses fails with a 5xx (duckdbDemo.ts start, hostStatus.ts), not filed as a bug.
Timing: about 50 minutes from dispatch to gate; W6 waited on W2 (about 7 minutes). Sequential estimate about 2 hours.
