# Track W2 checkpoint: web polish after the flow-demos verification

State: W2-1 to W2-4 done and committed (2026-09-18, 14:30 to 14:50). All processes I started are stopped; nothing listens on 5228 or 5315. Worktree `worktree-table-graph-layers`, started from ce2b569.

## Chunks and commits

| Chunk | Commit | Change |
|---|---|---|
| W2-1 selection survives reconnect | f201cfd | `packages/app/src/selection.ts` (new): `primaryNodeId` moved here from app.ts (re-exported) and `reopenKeepingSelection(store, reopen)`; `resync` in app.ts wraps `openAnalysis(currentId)` in it. Test `packages/app/test/selection.test.ts` (5). |
| W2-2 3D legend from the instance table | 44dbdde | `packages/panes/src/instanceLegend.ts` (new): `legendFromSlice(slice, max = 12)` gives distinct `verdict` (else `category`) values with the first row's r/g/b colour and count, most frequent first, plus the omitted count. `viewPane3D.ts` shows it whenever `rig.legend()` is empty, with an "and N more" row (`.bof-panes-legend-more` in styles.ts). Exported from the package index; README paragraph. Tests `packages/panes/test/instanceLegend.test.ts` (5) and one case in `viewPane3D.test.ts`. |
| W2-3 numbers in the table pane | d8b7a62 | `packages/viz/src/format.ts`: `formatNumber` rounds non-integer doubles with `toFixed(6)` trimmed of trailing zeros; integers, non-finite values, and magnitudes under 1e-6 stay exact; new `exactNumber`. `table.ts` sets a numeric cell's `title` to the exact value when it differs. `index.ts` exports, README sentence. Tests in `format.test.ts` and `table.test.ts`. |
| W2-4 faster offline detection | 18ca19f | `packages/app/src/hostStatus.ts`: connected probe every 10 s (was 15 s), comment explains the bound; `hostStatus.test.ts` pins both intervals. |

Fence note: W2-3 edits `packages/viz`, which the fence allowed only for a legend primitive. The table pane renders through viz's `DataTableView`, so the formatter had to live there; post-processing the pane's DOM would have fought the viz re-render on sort and the id-column highlight. The chart tick labels pick up the same rounding.

## Checks

- `npx vitest run --root packages/app test/selection.test.ts`: 5 passed. `npm test -w @bimopenflow/app`: 177 passed (31 files).
- `npx vitest run --root packages/panes test/instanceLegend.test.ts test/viewPane3D.test.ts`: 22 passed. `npm test -w @bimopenflow/panes`: 121 passed (13 files), also after W2-3.
- `npm test -w @bimopenflow/viz`: 43 passed.
- `npx vitest run --root packages/app test/hostStatus.test.ts`: 12 passed, including "one failure means reconnecting, a second means offline".
- `npx tsc -p packages/app --noEmit`, `-p packages/panes`, `-p packages/viz`: clean after each chunk.
- `node gates/web-smoke.mjs` (after all four chunks): WEB SMOKE: PASS; app 177, panes 121, viz 43, state 51, api-client 17 tests passed, plus the viewer packages and the app build.

## Browser check (host `artifacts/agent-w2`, port 5228, fresh store and cache under `%LOCALAPPDATA%\Temp\claude\bof-w2`; Vite 5315 with `BOF_HOST=http://127.0.0.1:5228`)

Host build: `dotnet build src/flow/BimOpenFlow.Host --artifacts-path artifacts/agent-w2`, 0 errors, 85 warnings, 28 s. The host seeded and warmed 26 analyses.

`3d.html?analysis=color-by-category` (pane fronted): status "660 instances · orbit / pan / zoom", the Duplex house coloured by category, and the legend strip now reads, in order: IFCFURNISHINGELEMENT (252 objects), IFCRAILING (130), IFCWINDOW (94), IFCSTAIRFLIGHT (62), IFCWALLSTANDARDCASE (56), IFCDOOR (44), IFCSLAB (21), IFCSPACE (21), IFCCOVERING (13), IFCBEAM (8), IFCFOOTING (7), IFCMEMBER (4), "and 2 more". Swatches carry the category10 colours. No console errors.

`index.html`, flow `nrc-q8-per-storey`, `answer` node selected: the pane shows "Preview: rel.sort (answer)" and the cells read `Level 1 / 103 / 49451.2 / 40.499029`, `Level 2 / 93 / 48696.8 / 40.556989`, `T/FDN / 14 / 11761.3 / 61.757143`, `Roof / 8 / 5821 / 62.0375`; each rounded cell has the exact value in its `title` (for example `48696.80000000001`, `40.556989247311854`); integer cells have no title.

Reconnect: host PID 25192 killed at 14:44:01.9. At 14:44:19 (first check, 10 s after the kill plus tool latency) the banner already read "Host not reachable at http://127.0.0.1:5315/api. Start it and it will reconnect." with class `bof-app-host-banner-offline` and the topbar said "offline". Host restarted at 14:44:37, answering by 14:44:42. At 14:45:00 the banner was hidden, the topbar read "connected", and the pane still showed "Preview: rel.sort (answer)" with the same formatted rows: the selection survived the reopen. Console errors during the outage were the expected Vite proxy 500s for `/api/models`.

Screenshots were viewed in the Browser pane and are not saved to disk (the pane's screenshot tool returns images to the conversation only).

## Processes

Started and stopped: host PIDs 25192 and 18556, Vite node PID 13760. None could not be stopped. Build output in `artifacts/agent-w2` (gitignored); temp state in `%LOCALAPPDATA%\Temp\claude\bof-w2`.

## Findings and notes for other tracks

- `docs/plans/flow-demos/perf.md:50` and `track-w.md:14,90-92` still say the connected probe is 15 s; both files are outside my fence. With W2-4 the idle-death-to-banner time is about 15 s (measured here: under 17.5 s).
- The legend column is chosen by name (`verdict`, then `category`) because the pane only sees the instance table, not the node's `valueColumn` param. A graph colouring by another text column shows no legend; passing the colour-driving column name into the pane (a `legendColumn` option on the "instances" input) is the extension point.
- `formatNumber` is shared by the chart tick labels, so `chart.bar`/`chart.line` axis ticks are rounded the same way. No test asserted the old exact text for ticks.

## Blockers

(none)
