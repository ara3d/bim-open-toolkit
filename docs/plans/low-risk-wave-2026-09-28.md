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

## Wave record
