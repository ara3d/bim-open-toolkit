# Track 3D checkpoint: view3d flows end to end

State: done (2026-09-18). All servers stopped.

## Files touched
- data/** (fetched, gitignored): IFC Test Kit copied from `C:\Users\cdigg\git\nrc-ifc-llm\IFC-Test-Kit` and the SDK sample models from `C:\Users\cdigg\git\studio\ara3d-sdk\data`, via `data/get-test-data.ps1 -TestKit ... -SdkData ...`. `data/duplex.ifc` is the real Test Kit file (2,380,763 bytes); the enriched fallback was not needed.
- `C:\Users\cdigg\git\bim-open-toolkit\.claude\launch.json`: added `bof-3d-host` (5226) and `bof-3d-web` (5312); not committed, other entries untouched.
- bimopenflow/web/packages/app/src/graphDemo.ts, app/test/graphDemo.test.ts (chunk 1)
- bimopenflow/web/packages/panes/src/entityKeys.ts (new), panes/src/viewerDeps.ts, panes/test/entityKeys.test.ts (chunk 2)
- samples/view3d-analyses/README.md (chunk 3), data/README.md (chunk 4)
- docs/plans/flow-demos/track-3d.md (this file)

## Chunks
- 58f029e feat(web): 3d.html opens the analysis named in `?analysis=<id>`; the module boots only when #app exists so tests can import it.
- 151614d fix(panes): key 3D instances by the model's source id (STEP express id) instead of the BOS row id, for the group adapter and picks.
- 935cfc1 docs(samples): the view3d README's "not yet seeded" paragraph replaced; two paths gain `flow/`.
- fd8aaba docs(data): how to run get-test-data.ps1 from a worktree.

## Checks run
- `dotnet test tests/flow/BimOpenFlow.Nodes.Geometry.Tests --artifacts-path artifacts/agent-3d`: 102 passed, 0 skipped.
- `dotnet test tests/flow/BimOpenFlow.View3dWorkflows.Tests --artifacts-path artifacts/agent-3d`: 18 passed, 0 skipped; every sample evaluates green over data/duplex.ifc.
- packages/app: `npx vitest run test/graphDemo.test.ts` 4 passed; `npx tsc --noEmit` clean.
- packages/panes: `npx vitest run` 12 files, 115 passed (5 new); `npx tsc --noEmit` clean.
- Host build (`dotnet build src/flow/BimOpenFlow.Host`, default output) at 02:14: compile succeeded; the copy step failed on BimOpenFlow.Relations.DuckDb.dll because the other session's tables host (PID 46960, port 5224) runs from the same bin/. No flow source file was newer than the existing bin, so the host ran from it with `--no-build`.

## Browser verification (Vite 5312 proxying to the bim-profile host on 5226, warm store)
- `3d.html?analysis=color-by-category` (seeded, duplex.ifc): loads the graph, fetches the model, then fails with "The BOS archive could not be prepared: Invalid BFAST transform 495" (finding 1, outside fence). Not rendered.
- `3d.html?analysis=color-by-category-fzk` (same graph, `inst.path` pointed at data/AC20-FZK-Haus.ifc via PUT into the temp store): 241 instances render with category10 colors. Capture: `C:\Users\cdigg\AppData\Local\Temp\claude\C--Users-cdigg-git-bim-open-toolkit\91e38ad8-2115-4a09-9176-748d58ed5565\scratchpad\3d-color-by-category-fzk.png`.
- `3d.html?analysis=ghost-context-fzk` (ghost-context on the FZK model): walls opaque, everything else at alpha 0.15. Capture: `...\scratchpad\3d-ghost-context-fzk.png`.
- `3d.html?analysis=snowdon-toolkit` (control, prepared BFAST + recipes): renders, 456,598 instances, legend populated.
- Before chunk 2 the FZK graph showed only the ground grid although the status read "241 instances": a pixel histogram of the pane capture was 100% background (0.9, 0.91, 0.93). After chunk 2 the capture has 108 distinct colors.
- The two `-fzk` analyses exist only in the temp store `C:/Users/cdigg/AppData/Local/Temp/claude/bof-3d/store`.

## Measurements
Host start-to-listening (bimopenflow-host.exe, bim profile, `--models data`, polling GET /api/analyses every 100 ms until 200):
- cold store (empty store and cache; seeds 23 analyses): 0.87 s
- warm store: 0.98 s, then 0.66 s

Browser, first load of 3d.html with a cold catalog and conversion cache (Performance API resource durations):
- GET /api/analyses 148 ms and GET /api/catalog/nodes 152 ms (parallel)
- GET /api/analyses/color-by-category/state 801 ms: graph evaluation, which meshes duplex.ifc with Approach1Mesher inside the geometry pack.
- GET /api/models 2295 ms (over 1 s). `ModelCatalog.Scan` SHA-256-hashes every .ifc/.bos under every root on the first call. Roots: data (about 125 MB of IFC incl. schependomlaan 50 MB and large_test_model 49 MB), samples/bim, samples/nrc, and `C:\Users\cdigg\Documents\BIM Open Schema` (added by `BimSampleSeeding.SeededModelRoots` because Snowdon lives there; 17 .bos files, several large). Hashes are cached per (size, mtime, ctime): later calls take 4 to 10 ms.
- GET /__bimflow/models/duplex.ifc 439 ms: cold IFC-to-BOS conversion (98,282 bytes).
- GET /api/models/ac20-fzk-haus.ifc/bos 987 ms via curl: cold conversion of the 2.5 MB FZK IFC (108,210 bytes).
- Everything else under 50 ms; warm loads of the FZK page have every /api request under 12 ms.

Time to first rendered frame: the viewer has the model bound and the instance table applied 466 ms after navigation start on a warm dev server (1.39 s on a cold one; `load-parse`, the browser-side BOS to BFAST conversion, is 131 to 698 ms of that). The first frame follows on the next animation frame in a normal browser. In the Browser pane `render-submit` fired only when a screenshot forced a paint (at about 8.4 s in two runs, i.e. when the screenshot was taken), so the pane's requestAnimationFrame throttling makes a direct first-frame number meaningless here.

## Running processes
None. Vite (preview e06b608f) stopped with preview_stop; host (bimopenflow-host PID 35184, parent dotnet run PID 35640) and the capture receiver (node PID 2228, port 5399) stopped; nothing listens on 5226 or 5399.

## Blockers (all worked around)
- preview_start refused `bof-3d-host`: "Maximum 5 dev servers per folder reached; 4 belong to other chats". The host ran from my shell with the launch entry's exact command.
- src/flow/BimOpenFlow.Host/bin cannot be refreshed while the other session's tables host runs from it; the existing bin matched the sources.
- The shared Browser tab "seed" was navigated by another session mid-batch twice; I used my own tab (tab-1).

## Findings
1. DEFECT (root cause outside fence; blocks every seeded view3d graph on duplex.ifc): `src/data/Ara3D.IfcLoader/IfcToModelConverters.cs:56-71` copies web-ifc's per-mesh transform verbatim. For data/duplex.ifc web-ifc returns one zero-vertex mesh (BOS mesh 320, instance 495, BOS entity index 3405) whose translation is +Infinity on all three axes; `BimGeometryBuilder.BuildModel` (src/data/Ara3D.BimOpenSchema.ObjectModel/BimGeometryBuilder.cs:136-155) writes it because `Matrix4x4.Decompose` succeeds on it. The web viewer rejects the whole model at viz/packages/loaders/src/bfast-loader.ts:36. A loaders test already documents the same row (viz/packages/loaders/test/bos-file.test.ts:70, "Infinity in transform row 484"). The geometry pack's own path (Approach1Mesher via `ModelGeometry.FromModel`) is clean (all 714 instance rows finite), which is why the .NET tests pass. AC20-FZK-Haus.ifc converts with 0 bad rows.
2. DEFECT (fixed, chunk 2): bimopenflow/web/packages/panes/src/viewerDeps.ts derived the pane's entity key from `ref.objectId` ("bos:<entity row>", see viz/packages/formats/src/bfast.ts:535) while the geometry pack keys instance tables by STEP express id (`sourceId` in the same record). No key matched, `groupColorPlan` (panes/src/instanceTable.ts) faded every instance to alpha 0, and every view3d instance-table graph showed an empty scene while the status line counted the loaded instances. Snowdon graphs use recipes and never hit it.
3. DEFECT (Host.Catalog, not fixed: the catalog's test project is outside my fence): `ModelCatalog.Slug` (src/flow/BimOpenFlow.Host.Catalog/ModelCatalog.cs) strips every non-ASCII letter, so `Documents\BIM Open Schema\サンプル意匠.bos` gets the catalog id `.bos` (visible in GET /api/models).
4. `data/get-test-data.ps1` defaults do not work from a worktree (documented in chunk 4).
5. Timing: the first GET /api/models after start hashes every model file in every root (2.3 s here, and it grows with whatever sits in Documents\BIM Open Schema). Because `HostRunner` adds that folder as a root whenever Snowdon is present, a user's whole model library is hashed on the first catalog request. Candidate fixes (outside fence): hash lazily per entry or key the cache on (size, mtime) without a content hash until the bytes are requested.

## Requests
1. `src/data/Ara3D.IfcLoader/IfcToModelConverters.cs`, in the `foreach (var mesh in g.GetMeshes())` loop of `ToModel3D(IfcFile, origin)`: skip degenerate meshes before adding an instance, for example `if (mesh.NumVertices == 0) continue;`, and defensively skip any instance whose matrix has a non-finite component. Alternatively guard in `BimGeometryBuilder.BuildModel`: treat a non-finite component of `mat` as a failed decomposition. Regression test: convert data/duplex.ifc and assert every Transforms row is finite; viz/packages/loaders/test/bos-file.test.ts "rejects a prepared export when source transforms are nonfinite" then needs a synthetic fixture instead of the duplex file. After this, re-run the browser check on `3d.html?analysis=color-by-category` (delete the cached `b347a2c8...bos` under the cache dir first, or the stale conversion is served).
2. `src/flow/BimOpenFlow.Host.Catalog/ModelCatalog.cs` `Slug`: fall back to the content-hash prefix when the slug has no stem (finding 3), with a test in the catalog test project.
3. Consider not hashing every root file on the first `/api/models` (finding 5).
