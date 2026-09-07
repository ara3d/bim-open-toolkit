# Foundation wave findings — 2026-09-07

Outcome: implemented and verified the bounded foundation increment; the full product brief remains incomplete. No private model data was copied. Core, controls and loader source were reused without changes; renderer version remains host-owned.

## Baseline and stable integration

Baseline: existing workspace builds passed; 110 tests passed (core 58, controls 28, loaders 24). Initial tree was clean. The first scaffold build was accidentally invoked from the repository root and failed for lack of package.json; rerunning from viewer passed. No baseline code defect blocked this wave.

Agent commits: contracts/plan `82d7f41`; identity/selection `0a8943b`; appearance/edits `6333d37`; persistence `863f5cd`; persistence numeric-domain and large-collection follow-up `cfba29e`. Each track reported stopped writes/processes before final checks. Supervisor owned integration and browser resources. Test inputs were `cfba29e` plus the integration files included in the subsequent integration commit. No implementation inputs changed after final gates; only documentation/checkpoint updates followed.

Final gates, from viewer:

| Gate | Result |
|---|---|
| `npm run build` | All four packages passed, dependency order core -> controls/loaders -> visualization |
| core tests | 58 passed / 9 files |
| controls tests | 28 passed / 5 files |
| loaders tests | 24 passed / 4 files |
| visualization tests | 43 passed / 7 files |
| `npm run demo:check` | Passed |
| `npm run demo:build` | Passed; JS bundle 553.46 kB, gzip 140.70 kB |
| `git diff --check` | Passed before final documentation updates; rechecked at commit |

The four package test commands ran concurrently against stable builds, alongside demo checks/build. npm consumed attempted worker/cache forwarding flags for the existing packages and warned about `maxWorkers`; their existing default Vitest settings ran successfully. Visualization explicitly uses two workers. No check failure was waived.

## Browser evidence

Codex in-app browser, local Vite server at port 5173. Actual WebGL geometry was visually inspected. Browser checks exercised select-all -> hide -> undo (100 selected, transaction count 1 -> 0), heat-map activation, stress fixture and CPU measurement, name filtering with `000` returning separate model-1/model-2 identities, and save -> page reload -> restore preserving one selected object and one transform transaction. A subsequent move/save after restore succeeded with two distinct transactions. Final fixture reset to 100 objects.

The first demo check found an incorrect orbit method name and an input-listener TypeScript boundary mismatch; both were fixed. Framing now accounts for the narrower horizontal/vertical field of view. A restore/edit transaction-ID collision was fixed and verified through the UI. Browser behavior is smoke coverage, not exhaustive end-to-end automation or physical-device certification.

## Measurements and limits

Observed CPU color/unchanged-transform batch submission on 10,000 synthetic objects (120,000 triangles): 5 warmups, 20 samples, nearest-rank p50 16.50 ms / p95 20.80 ms. Includes validation and CPU buffer writes, excludes drawing/GPU/display completion. No claim about changed-transform or geometry replacement throughput follows from this sample. Timing control remains in the demo for repeatability.

No named hardware/browser-version baseline, FPS path, GPU timing, 10-million-triangle workload, Snowdon, multiple-view, mobile, memory-growth or context-loss gate was run. These remain release acceptance work. Pure large-collection persistence regression covers 150,000 members; it is not a rendering measurement.

Vite warns about the single bundle exceeding 500 kB and the explicit output directory outside the demo root; output is isolated and Git-ignored. Splitting Three and feature routes belongs with the gallery wave. No new rendering dependency was downloaded; offline installation linked the new workspace package and exposed the already-installed Vite dependency.

## Remaining work

The implementation is an API foundation with one runnable combined demo. Full F01/F03/F06/F07/F08/F15/F17/F27 acceptance remains broader than the delivered subsets. Rendered additions/replacements, source normalization, independent representation offsets, complete persistence, generated reference site and standalone feature routes remain deferred. Coordinates are declared, not converted. The renderer adapter expects stable bound group instance counts.

F02 loaders lack cancellation despite having progress; no adapter claims otherwise. Planned Gratify/React/mobile work, other formats, cameras, layouts, two-view comparison, markup/overlays, screenshots, animation, map/MCP, advanced lighting, voxels and BuildingModel workflows are explicitly deferred to bounded later waves. The next gallery wave is described in PLAN.md.

Local integration and publication are distinct: final commit/push outcome is reported in the task response. Development server session is supervisor-owned and remains available for the delivered local demo.
