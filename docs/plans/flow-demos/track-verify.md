# Track Verify checkpoint: 3D flows on Duplex in the browser, re-measured

State: done (2026-09-18, 02:52 to 03:03). All processes I started are stopped; nothing listens on 5227, 5314, or 5399. No source file edited. The worktree carried an untracked `src/flow/BimOpenFlow.Nodes.Support/TableRows.cs` before I began; it is not mine and I left it alone.

Verified at commit 4ae38b7 (worktree `worktree-table-graph-layers`). The three seeded view3d graphs that failed in track-3d with "Invalid BFAST transform 495" now render on `data/duplex.ifc`. The seeded `nrc-storey-of-element` answer is correct on a fresh store. The offline banner appears and clears.

## Commands (all from the worktree root)

Fresh state:
```
Remove-Item -Recurse -Force $env:LOCALAPPDATA\Temp\claude\bof-verify
```
Host build (private output, 10.2 s, 0 errors, 85 warnings):
```
dotnet build src/flow/BimOpenFlow.Host --artifacts-path artifacts/agent-verify
```
Host (Start-Process, stdout to scratchpad `host.out.log`):
```
artifacts/agent-verify/bin/BimOpenFlow.Host/debug/bimopenflow-host.exe --port 5227 --profile bim
  --models <worktree>/data --store %LOCALAPPDATA%/Temp/claude/bof-verify/store --cache %LOCALAPPDATA%/Temp/claude/bof-verify/cache
```
Web app (from `bimopenflow/web/packages/app`):
```
set BOF_HOST=http://127.0.0.1:5227 && npx vite --port 5314
```
Start-to-listening was measured by polling `GET /api/analyses` every 100 ms from the moment Start-Process returned until the first 200.

Canvas captures: the WebGL canvas reads back blank after the frame is presented (no preserveDrawingBuffer), so a `requestAnimationFrame` wrapper copied `canvas.toDataURL()` inside the frame right after the renderer drew, triggered by a real drag on the canvas, and POSTed it to a 20-line node receiver on 5399 (`scratchpad/capture-receiver.mjs`). The Browser pane had to be fronted first; while it was hidden no animation frame ever fired and the first attempt timed out at 45 s.

## Measurements

Host start (bim profile, four model roots: data, samples/bim, samples/nrc, `C:\Users\cdigg\Documents\BIM Open Schema`):

| Run | Store | Start to first 200 |
|---|---|---|
| 1 | empty store and cache, seeds 23 analyses | 3.37 s |
| 2 (restart for the banner test) | warm store, warm cache | 0.80 s |

Track-3d measured 0.87 s for the cold case with a different method (its host ran under `dotnet run`); the 3.37 s here includes the exe's runtime start and the full seeding pass, and three other sessions' hosts were running on the machine.

Browser `/api` and `/__bimflow` durations (Performance API in the page; host-side times from `host.out.log` in brackets). Requests over 1 s in bold.

| Page | Request | Duration |
|---|---|---|
| color-by-category, first load, cold catalog and cache | `GET /api/analyses/color-by-category/state` | **2542 ms** [2538 ms]: graph evaluation meshes duplex.ifc in the geometry pack |
| same | `GET /__bimflow/models/duplex.ifc` | **1024 ms** [1010 ms]: cold IFC to BOS conversion, 97,884 bytes (98,282 before 53a69d9; one mesh and its instance dropped) |
| same | `GET /api/models` (first call) | 53 ms [19 ms]; track-3d saw 2295 ms before 4ae38b7 made hashing lazy |
| same | `GET /api/catalog/nodes`, `GET /api/analyses` | 52 ms, 24 ms |
| same | `.../results/colored/instances?skip=0&take=10000` | 110 ms |
| ghost-context (warm) | `.../ghost-context/state` | 158 ms [117 ms]; everything else 3 to 15 ms; duplex.ifc 10 ms [4 ms] |
| massing-boxes (warm) | all requests | 3 to 28 ms; state 11 ms [8 ms] |
| ghost-context, second visit | state | [0.6 ms] |

Every later `/api/models` was 2 to 7 ms host-side (the client polls it every 5 s).

Offline banner (page: index.html with nrc-storey-of-element open):

| Event | Clock |
|---|---|
| `Stop-Process` on host PID 27492 | 03:00:59.4 |
| First Vite proxy `ECONNREFUSED` for `/api/models` | 03:01:13 |
| Banner visible, class `bof-app-host-banner-offline`, text "Host not reachable at http://127.0.0.1:5314/api. Start it and it will reconnect.", indicator "offline" | observed 03:01:20.6 (21 s after the stop; the previous check was at the stop itself) |
| Host restarted (PID 45972) / answering | 03:01:57.2 / 03:01:58.0 |
| Banner `hidden`, indicator "connected" | observed 03:02:17.9 (the last failing poll was 03:01:53, so the clear happened within 5 to 20 s of the restart) |

nrc-storey-of-element: the page was opened about 6 minutes after the fresh-store start; no node ever showed "not ready yet". The host log has no line for the background NRC database build, so its duration could not be read.

## What rendered

All three pages: status line "660 instances · orbit / pan / zoom", no `[role=alert]` text, zero console errors (only Vite's connecting/connected debug lines). Captures are 228x422 PNGs of the WebGL canvas in the right-hand preview pane; distinct-colour counts are on a 64x40 downsample (background alone gives 1).

- `3d.html?analysis=color-by-category`: the Duplex house, roof olive, walls green, openings dark red (category10 by category), 60 distinct colours. `C:\Users\cdigg\AppData\Local\Temp\claude\C--Users-cdigg-git-bim-open-toolkit\91e38ad8-2115-4a09-9176-748d58ed5565\scratchpad\3d-color-by-category-duplex.png`. The legend strip under the canvas is empty (see design note 2).
- `3d.html?analysis=ghost-context`: exterior walls opaque dark red, interior walls and slabs visible through translucent roof and floors, 57 distinct colours. `...\scratchpad\3d-ghost-context-duplex.png`.
- `3d.html?analysis=massing-boxes`: grey axis-aligned boxes, one per category group, over the ground grid, 23 distinct colours. `...\scratchpad\3d-massing-boxes-duplex.png`.
- `index.html`, sidebar item `nrc-storey-of-element`: seven nodes (`storeyOf`, `entities`, `withGlobalId`, `elements`, `analysed`, `perStorey`, `answer`). The `answer` node (`rel.sort`, at layout x=1360, off-screen until the canvas is panned) shows exactly four rows: Level 1 / 103 / 49451.2, Level 2 / 93 / 48696.79999999999, T/FDN / 14 / 11761.300000000001, Roof / 8 / 5821. The `analysed` join shows the per-element rows with the NRC carbon columns.

## Console errors

None on any 3D page or on the index page while the host was up. During the outage the console logged nine "Failed to load resource: 500 (Internal Server Error)" for `GET /api/models`: Vite's proxy answers 500 when the target refuses the connection (`vite.err.log`: `connect ECONNREFUSED 127.0.0.1:5227`, one every 5 s from 03:01:13 to 03:01:53). Expected while the host is down.

## Findings

No defects. The two requests over 1 s are both one-time cold costs (first evaluation of a duplex graph, first IFC conversion) and both drop under 160 ms on the next load.

Design notes (not fixed; outside this track's fence):

1. Selection is lost on reconnect. `bimopenflow/web/packages/app/src/app.ts:365-373` (`resync`) calls `openAnalysis(currentId)` after the host comes back, which rebuilds the editor; the right pane returned to "Select a node to see its data" although the graph was unchanged. Fix: remember the selected node id before `openAnalysis` and reselect it afterwards.
2. The 3D legend is empty for instance-table graphs. `bimopenflow/web/packages/panes/src/viewPane3D.ts:61-74` fills it from `rig.legend()`, which only recipe-driven rigs (Snowdon) provide; `view3d.color` output carries the colour map in the instance table, so a legend could be derived from the applied table's distinct `category` values and colours.
3. Table pane prints raw doubles: `48696.79999999999` and `11761.300000000001` in the `Embodied` column. Either round in `rel.aggregate`'s `sum` or format numbers in the relation table pane.
4. The host still adds `C:\Users\cdigg\Documents\BIM Open Schema` as a model root (log line "model roots:"); with lazy hashing this no longer costs anything on `/api/models` (53 ms), so track-3d finding 5 can be closed.
5. Host-side there is no log line when the background NRC database build starts or finishes (ff9f2aa); one line each would make the "not ready yet" window measurable.

## Processes

Started and stopped: host PID 27492 (run 1), host PID 45972 (run 2), Vite `cmd.exe` PID 39852 and its node PID 26856, capture receiver node PID 21896. None could not be stopped. Build output lives in `artifacts/agent-verify` (gitignored); temp state in `%LOCALAPPDATA%\Temp\claude\bof-verify` (store with 23 seeded analyses, cache with the single 97,884-byte duplex conversion).
